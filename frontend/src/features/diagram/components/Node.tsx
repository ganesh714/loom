import { MessageSquare } from 'lucide-react';
import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { useDiagram } from '@/context/DiagramContext';
import type { DiagramNode } from '@/types';
import styles from './Node.module.css';
import { renderExtendedShape, parseMarkdown } from './ShapeRenderers';
import { getSemanticStyle } from '../../../utils/semanticStyles';
import { getClosestPointOnLineNode } from '../../../utils/geometry';

const parseCssString = (css: string) => {
  if (!css || typeof css !== 'string') return null;
  return css.split(';').reduce((acc, rule) => {
    const [key, ...valueParts] = rule.split(':');
    const value = valueParts.join(':');
    if (key && value) {
      const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      if (camelKey !== 'position' && camelKey !== 'top' && camelKey !== 'left') {
        acc[camelKey] = value.trim();
      }
    }
    return acc;
  }, {} as any);
};

interface NodeProps {
  node: DiagramNode;
  onWaypointDragStart?: (e: React.PointerEvent, nodeId: string, index: number) => void;
  onMiddleSegmentDragStart?: (e: React.PointerEvent, nodeId: string, axis: 'x' | 'y') => void;
}

export function Node({ node, onWaypointDragStart, onMiddleSegmentDragStart }: NodeProps) {
  const { 
    selectedNodeIds, 
    selectNode, 
    moveNode, 
    moveSelectedNodes, 
    resizeNode, 
    zoom, 
    activeTool, 
    selectToolMode, 
    nodes, 
    updateNode, 
    saveHistoryState,
    setActiveSnapLines,
    setNodes
  } = useDiagram();
  const isSelected = selectedNodeIds.includes(node.id);
  const [isCardOpen, setIsCardOpen] = useState(node.content === '');
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Figma resize handle - scales inversely with zoom to maintain constant screen size
  const renderFigmaHandle = (position: string) => {
    const handleSize = 6 / zoom;
    const borderSize = 1.5 / zoom;
    const offsetPos = -3 / zoom;
    const shadowSize = 1 / zoom;
    const shadowBlur = 2 / zoom;
    const borderRadius = 1 / zoom;

    const offsets: Record<string, React.CSSProperties> = {
      topLeft: { top: `${offsetPos}px`, left: `${offsetPos}px`, cursor: 'nwse-resize' },
      topRight: { top: `${offsetPos}px`, right: `${offsetPos}px`, cursor: 'nesw-resize' },
      bottomLeft: { bottom: `${offsetPos}px`, left: `${offsetPos}px`, cursor: 'nesw-resize' },
      bottomRight: { bottom: `${offsetPos}px`, right: `${offsetPos}px`, cursor: 'nwse-resize' },
      top: { top: `${offsetPos}px`, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
      bottom: { bottom: `${offsetPos}px`, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
      left: { left: `${offsetPos}px`, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
      right: { right: `${offsetPos}px`, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
    };

    return (
      <div
        style={{
          width: `${handleSize}px`,
          height: `${handleSize}px`,
          backgroundColor: '#ffffff',
          border: `${borderSize}px solid #0c8ce9`,
          borderRadius: `${borderRadius}px`,
          position: 'absolute',
          boxShadow: `0 ${shadowSize}px ${shadowBlur}px rgba(0,0,0,0.3)`,
          pointerEvents: 'none',
          ...offsets[position],
        }}
      />
    );
  };

  const handleStartDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialStart = { ...node.startPoint! };
    const initialNodes = [...nodes];
    let hasMoved = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasMoved = true;
      }

      const currentX = initialStart.x + dx;
      const currentY = initialStart.y + dy;

      // Snapping logic
      let bestAnchor: { nodeId: string; anchor: 'top' | 'bottom' | 'left' | 'right' | 'closest'; x: number; y: number } | null = null;
      let minDistance = 20 / zoom;

      for (const n of nodes) {
        if (n.id === node.id) continue;
        
        if (n.type === 'line' || n.type === 'arrow') {
          const closest = getClosestPointOnLineNode({ x: currentX, y: currentY }, n);
          const dist = Math.sqrt(Math.pow(currentX - closest.x, 2) + Math.pow(currentY - closest.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestAnchor = { nodeId: n.id, anchor: 'closest', x: closest.x, y: closest.y };
          }
          continue;
        }
        
        const anchors: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
        for (const a of anchors) {
          let ax = n.position.x;
          let ay = n.position.y;
          if (a === 'top') { ax += n.dimensions.width / 2; }
          else if (a === 'bottom') { ax += n.dimensions.width / 2; ay += n.dimensions.height; }
          else if (a === 'left') { ay += n.dimensions.height / 2; }
          else if (a === 'right') { ax += n.dimensions.width; ay += n.dimensions.height / 2; }

          const dist = Math.sqrt(Math.pow(currentX - ax, 2) + Math.pow(currentY - ay, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestAnchor = { nodeId: n.id, anchor: a, x: ax, y: ay };
          }
        }
      }

      if (bestAnchor) {
        updateNode({
          ...node,
          startPoint: { x: bestAnchor.x, y: bestAnchor.y },
          startConnection: { nodeId: bestAnchor.nodeId, anchor: bestAnchor.anchor }
        }, false);
      } else {
        updateNode({
          ...node,
          startPoint: { x: currentX, y: currentY },
          startConnection: undefined,
          position: { x: Math.min(currentX, node.endPoint!.x), y: Math.min(currentY, node.endPoint!.y) },
          dimensions: { 
            width: Math.max(15, Math.abs(node.endPoint!.x - currentX)), 
            height: Math.max(15, Math.abs(node.endPoint!.y - currentY)) 
          }
        }, false);
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (hasMoved) {
        saveHistoryState(initialNodes);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleEndDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialEnd = { ...node.endPoint! };
    const initialNodes = [...nodes];
    let hasMoved = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasMoved = true;
      }

      const currentX = initialEnd.x + dx;
      const currentY = initialEnd.y + dy;

      // Snapping logic
      let bestAnchor: { nodeId: string; anchor: 'top' | 'bottom' | 'left' | 'right' | 'closest'; x: number; y: number } | null = null;
      let minDistance = 20 / zoom;

      for (const n of nodes) {
        if (n.id === node.id) continue;
        
        if (n.type === 'line' || n.type === 'arrow') {
          const closest = getClosestPointOnLineNode({ x: currentX, y: currentY }, n);
          const dist = Math.sqrt(Math.pow(currentX - closest.x, 2) + Math.pow(currentY - closest.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestAnchor = { nodeId: n.id, anchor: 'closest', x: closest.x, y: closest.y };
          }
          continue;
        }
        
        const anchors: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
        for (const a of anchors) {
          let ax = n.position.x;
          let ay = n.position.y;
          if (a === 'top') { ax += n.dimensions.width / 2; }
          else if (a === 'bottom') { ax += n.dimensions.width / 2; ay += n.dimensions.height; }
          else if (a === 'left') { ay += n.dimensions.height / 2; }
          else if (a === 'right') { ax += n.dimensions.width; ay += n.dimensions.height / 2; }

          const dist = Math.sqrt(Math.pow(currentX - ax, 2) + Math.pow(currentY - ay, 2));
          if (dist < minDistance) {
            minDistance = dist;
            bestAnchor = { nodeId: n.id, anchor: a, x: ax, y: ay };
          }
        }
      }

      if (bestAnchor) {
        updateNode({
          ...node,
          endPoint: { x: bestAnchor.x, y: bestAnchor.y },
          endConnection: { nodeId: bestAnchor.nodeId, anchor: bestAnchor.anchor }
        }, false);
      } else {
        updateNode({
          ...node,
          endPoint: { x: currentX, y: currentY },
          endConnection: undefined,
          position: { x: Math.min(node.startPoint!.x, currentX), y: Math.min(node.startPoint!.y, currentY) },
          dimensions: { 
            width: Math.max(15, Math.abs(currentX - node.startPoint!.x)), 
            height: Math.max(15, Math.abs(currentY - node.startPoint!.y)) 
          }
        }, false);
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (hasMoved) {
        saveHistoryState(initialNodes);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const activeHandles = isSelected ? {
    topLeft: renderFigmaHandle("topLeft"),
    topRight: renderFigmaHandle("topRight"),
    bottomLeft: renderFigmaHandle("bottomLeft"),
    bottomRight: renderFigmaHandle("bottomRight"),
    top: renderFigmaHandle("top"),
    bottom: renderFigmaHandle("bottom"),
    left: renderFigmaHandle("left"),
    right: renderFigmaHandle("right"),
  } : undefined;

  const isLine = node.type === 'line' || node.type === 'arrow' || node.type === 'custom-connector';
  const isComment = node.type === 'comment';

  // Semantic auto-coloring
  const semanticStyle = getSemanticStyle(node.tag);
  const effectiveBorder = node.style?.borderColor || semanticStyle.borderColor;
  const effectiveColor = node.style?.color || semanticStyle.color;

  // Build text style object
  const textStyle: React.CSSProperties = {
    color: effectiveColor || '#e3e3e3',
    fontFamily: node.style?.fontFamily || 'inherit',
    fontSize: node.style?.fontSize || '11px',
    fontWeight: node.style?.fontWeight || 'normal',
    textAlign: node.style?.textAlign || 'center',
    width: '100%',
    wordBreak: 'break-word',
    opacity: isEditing ? 0 : 1,
  };

  // Shadow filters vs css box shadows
  const hasShadow = !!node.style?.boxShadow;
  const shadowFilter = hasShadow ? `drop-shadow(${node.style!.boxShadow})` : 'none';

  const extendedShape = renderExtendedShape({ node, textStyle, shadowFilter });

  return (
    <Rnd
      position={node.position}
      size={{ width: node.dimensions.width, height: node.dimensions.height }}
      onDoubleClick={(e: React.MouseEvent) => {
        if (activeTool === 'select' && !isLine) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
      onDrag={(_e, d) => {
        // Smart Guides Logic
        if (activeTool !== 'select' || selectToolMode !== 'move') return;
        
        const SNAP_THRESHOLD = 5;
        const currentLeft = d.x;
        const currentRight = d.x + node.dimensions.width;
        const currentCenterX = d.x + node.dimensions.width / 2;
        const currentTop = d.y;
        const currentBottom = d.y + node.dimensions.height;
        const currentCenterY = d.y + node.dimensions.height / 2;

        const newSnapLines: { axis: 'x' | 'y', position: number }[] = [];

        nodes.forEach(otherNode => {
          // Skip self and lines/arrows
          if (otherNode.id === node.id || otherNode.type === 'line' || otherNode.type === 'arrow') return;
          // Skip other selected nodes if we are dragging a multi-selection group
          if (selectedNodeIds.includes(otherNode.id)) return;

          const otherLeft = otherNode.position.x;
          const otherRight = otherNode.position.x + otherNode.dimensions.width;
          const otherCenterX = otherNode.position.x + otherNode.dimensions.width / 2;
          const otherTop = otherNode.position.y;
          const otherBottom = otherNode.position.y + otherNode.dimensions.height;
          const otherCenterY = otherNode.position.y + otherNode.dimensions.height / 2;

          // X-Axis alignments
          if (Math.abs(currentLeft - otherLeft) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'x', position: otherLeft });
          else if (Math.abs(currentRight - otherRight) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'x', position: otherRight });
          else if (Math.abs(currentCenterX - otherCenterX) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'x', position: otherCenterX });
          else if (Math.abs(currentLeft - otherRight) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'x', position: otherRight });
          else if (Math.abs(currentRight - otherLeft) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'x', position: otherLeft });

          // Y-Axis alignments
          if (Math.abs(currentTop - otherTop) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'y', position: otherTop });
          else if (Math.abs(currentBottom - otherBottom) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'y', position: otherBottom });
          else if (Math.abs(currentCenterY - otherCenterY) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'y', position: otherCenterY });
          else if (Math.abs(currentTop - otherBottom) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'y', position: otherBottom });
          else if (Math.abs(currentBottom - otherTop) < SNAP_THRESHOLD) newSnapLines.push({ axis: 'y', position: otherTop });
        });

        // Deduplicate lines
        const uniqueLines = newSnapLines.filter((line, index, self) => 
          index === self.findIndex((t) => t.axis === line.axis && t.position === line.position)
        );

        setActiveSnapLines(uniqueLines);
      }}
      onDragStop={(_e, d) => {
        setActiveSnapLines([]);
        if (selectedNodeIds.includes(node.id)) {
          moveSelectedNodes(node.id, { x: d.x, y: d.y });
        } else {
          moveNode(node.id, { x: d.x, y: d.y });
        }
      }}
      onDragStart={(e) => {
        // Prevent drag triggers when editing comments
        if (isComment && isCardOpen) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        const newWidth = parseInt(ref.style.width, 10);
        const newHeight = parseInt(ref.style.height, 10);
        
        if (selectToolMode === 'scale') {
          const oldWidth = node.dimensions.width;
          const factor = newWidth / oldWidth;
          const currentFontSizeStr = node.style?.fontSize || '11px';
          const currentFontSizeNum = parseFloat(currentFontSizeStr) || 11;
          const newFontSizeNum = Math.max(8, Math.round(currentFontSizeNum * factor));
          const newFontSizeStr = `${newFontSizeNum}px`;
          
          resizeNode(
            node.id,
            { width: newWidth, height: newHeight },
            position
          );
          
          updateNode({
            ...node,
            position,
            dimensions: { width: newWidth, height: newHeight },
            style: {
              ...node.style,
              fontSize: newFontSizeStr
            }
          });
        } else {
          resizeNode(
            node.id,
            { width: newWidth, height: newHeight },
            position
          );
        }
      }}
      scale={zoom}
      className={`${styles.node} ${isSelected ? styles.selected : ''}`}
      enableResizing={
        (isLine || isComment || activeTool === 'hand' || activeTool === 'erase')
          ? {
              top: false,
              bottom: false,
              left: false,
              right: false,
              topLeft: false,
              topRight: false,
              bottomLeft: false,
              bottomRight: false,
            }
          : {
              top: true,
              bottom: true,
              left: true,
              right: true,
              topLeft: true,
              topRight: true,
              bottomLeft: true,
              bottomRight: true,
            }
      }
      disableDragging={activeTool === 'erase' || activeTool === 'hand' || (isComment && isCardOpen)}
      resizeHandleComponent={(isComment || activeTool === 'hand' || activeTool === 'erase') ? undefined : activeHandles}
      onMouseDown={(e: any) => {
        if (activeTool === 'hand') return; // let mouse down bubble up to pan the canvas
        e.stopPropagation();
        if (activeTool === 'erase') {
          saveHistoryState(nodes);
          setNodes(nodes.filter(n => n.id !== node.id));
          return;
        }
        if (e.shiftKey) {
          selectNode(node.id, true);
          return;
        }
        if (!selectedNodeIds.includes(node.id)) {
          selectNode(node.id, false);
        }
      }}
      onMouseEnter={(e: any) => {
        setIsHovered(true);
        // Drag-erasing functionality
        if (activeTool === 'erase' && e.buttons === 1) {
          saveHistoryState(nodes);
          setNodes(nodes.filter(n => n.id !== node.id));
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onClick={(e: React.MouseEvent) => {
        if (activeTool === 'hand') return;
        e.stopPropagation();
        if (activeTool === 'erase') return;
        if (!e.shiftKey && selectedNodeIds.includes(node.id) && selectedNodeIds.length > 1) {
          selectNode(node.id, false);
        }
      }}
      style={{
        backgroundColor: 'transparent',
        outline: activeTool === 'erase' && isHovered 
          ? `${1.5 / zoom}px solid #f04438` 
          : (isSelected && node.type !== 'line' && node.type !== 'arrow')
            ? `${1.5 / zoom}px solid #0c8ce9` 
            : 'none',
        pointerEvents: (node.type === 'line' || node.type === 'arrow') ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: isSelected ? 30 : 1,
        opacity: node.style?.opacity !== undefined ? Number(node.style.opacity) : 1,
      }}
    >
      {extendedShape ? extendedShape : node.type === 'diamond' ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: node.style?.backgroundColor || semanticStyle.backgroundColor || '#2e2c24',
            border: `2px ${node.style?.borderStyle || 'solid'} ${effectiveBorder || '#c69c3a'}`,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            filter: shadowFilter
          }}
        >
          <div style={{ ...textStyle, padding: '16px', textAlign: 'center' }}>
            {parseMarkdown(node.content)}
          </div>
        </div>
      ) : node.type === 'circle' ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${node.rotation || 0}deg)`,
            borderRadius: '50%',
            backgroundColor: node.style?.backgroundColor || '#2c2c2c',
            border: `1.5px solid ${node.style?.borderColor || '#555555'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            boxShadow: node.style?.boxShadow || 'none'
          }}
        >
          <div style={{ ...textStyle, padding: '8px' }}>
            {parseMarkdown(node.content)}
          </div>
        </div>
      ) : node.type === 'triangle' ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', transform: `rotate(${node.rotation || 0}deg)`, filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            {(() => {
              const r = parseInt(node.style?.borderRadius || '0', 10);
              const s = Math.max(0, Math.min(25, r * 0.5));
              
              const p1x = 50 - s * 0.45;
              const p1y = 3 + s * 0.90;
              const p2x = 50 + s * 0.45;
              const p2y = 3 + s * 0.90;
              
              const p3x = 97 - s * 0.45;
              const p3y = 97 - s * 0.90;
              const p4x = 97 - s;
              const p4y = 97;
              
              const p5x = 3 + s;
              const p5y = 97;
              const p6x = 3 + s * 0.45;
              const p6y = 97 - s * 0.90;
              
              const pathData = `M ${p1x} ${p1y} Q 50 3 ${p2x} ${p2y} L ${p3x} ${p3y} Q 97 97 ${p4x} ${p4y} L ${p5x} ${p5y} Q 3 97 ${p6x} ${p6y} Z`;
              
              return (
                <path
                  d={pathData}
                  fill={node.style?.backgroundColor || '#1c2e24'}
                  stroke={node.style?.borderColor || '#2b8a4e'}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })()}
          </svg>
          <div 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'none' 
            }}
          >
            <div style={{ ...textStyle, padding: '30px 15px 15px 15px' }}>
              {parseMarkdown(node.content)}
            </div>
          </div>
        </div>
      ) : node.type === 'star' ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', transform: `rotate(${node.rotation || 0}deg)`, filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
            <polygon 
              points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" 
              fill={node.style?.backgroundColor || '#38301b'} 
              stroke={node.style?.borderColor || '#9e7c1d'} 
              strokeWidth="2" 
            />
          </svg>
          <div 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'none' 
            }}
          >
            <div style={{ ...textStyle, padding: '24px 20px 20px 20px' }}>
              {parseMarkdown(node.content)}
            </div>
          </div>
        </div>
      ) : node.type === 'pill' ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${node.rotation || 0}deg)`,
            backgroundColor: node.style?.backgroundColor || '#2c2c2c',
            border: `1.5px solid ${node.style?.borderColor || '#555555'}`,
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            boxShadow: node.style?.boxShadow || 'none'
          }}
        >
          <div style={{ ...textStyle, padding: '8px 20px' }}>
            {parseMarkdown(node.content)}
          </div>
        </div>
      ) : node.type === 'hexagon' ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', transform: `rotate(${node.rotation || 0}deg)`, filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon 
              points="25,5 75,5 100,50 75,95 25,95 0,50" 
              fill={node.style?.backgroundColor || '#2e2438'} 
              stroke={node.style?.borderColor || '#824ea0'} 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'none' 
            }}
          >
            <div style={{ ...textStyle, padding: '10px' }}>
              {parseMarkdown(node.content)}
            </div>
          </div>
        </div>
      ) : node.type === 'parallelogram' ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', transform: `rotate(${node.rotation || 0}deg)`, filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon 
              points="20,5 100,5 80,95 0,95" 
              fill={node.style?.backgroundColor || '#242e38'} 
              stroke={node.style?.borderColor || '#4e82a0'} 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'none' 
            }}
          >
            <div style={{ ...textStyle, padding: '10px 20px' }}>
              {parseMarkdown(node.content)}
            </div>
          </div>
        </div>
      ) : node.type === 'database' ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', transform: `rotate(${node.rotation || 0}deg)`, filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path 
              d="M 5,20 C 5,10 95,10 95,20 L 95,80 C 95,90 5,90 5,80 Z" 
              fill={node.style?.backgroundColor || '#382424'} 
              stroke={node.style?.borderColor || '#a04e4e'} 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke"
            />
            <path 
              d="M 5,20 C 5,30 95,30 95,20" 
              fill="none" 
              stroke={node.style?.borderColor || '#a04e4e'} 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div 
            style={{ 
              position: 'absolute', 
              top: '25%', 
              left: 0, 
              width: '100%', 
              height: '75%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'none' 
            }}
          >
            <div style={{ ...textStyle, padding: '10px' }}>
              {parseMarkdown(node.content)}
            </div>
          </div>
        </div>
      ) : node.type === 'note' ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${node.rotation || 0}deg)`,
            backgroundColor: node.style?.backgroundColor || '#fef3c7',
            border: `1.5px solid ${node.style?.borderColor || '#f59e0b'}`,
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            padding: '12px',
            boxShadow: node.style?.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            clipPath: 'polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%)'
          }}
        >
          {/* Note fold */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '15%',
            height: '15%',
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderLeft: `1px solid ${node.style?.borderColor || '#f59e0b'}`,
            borderTop: `1px solid ${node.style?.borderColor || '#f59e0b'}`,
          }} />
          <div style={{ ...textStyle, color: node.style?.color || '#92400e' }}>
            {parseMarkdown(node.content)}
          </div>
        </div>
      ) : node.type === 'custom-block' ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${node.rotation || 0}deg)`,
            background: node.style?.background || node.style?.backgroundColor || '#2c2c2c',
            borderWidth: node.style?.borderWidth || '1.5px',
            borderStyle: node.style?.borderStyle || 'solid',
            borderColor: node.style?.borderColor || '#555555',
            borderRadius: node.style?.borderRadius || '0px',
            clipPath: node.style?.clipPath || 'none',
            backdropFilter: node.style?.backdropFilter || 'none',
            filter: node.style?.filter || shadowFilter,
            boxShadow: node.style?.boxShadow || 'none',
            display: node.content ? 'flex' : 'block',
            alignItems: node.content ? 'center' : undefined,
            justifyContent: node.content ? 'center' : undefined,
            boxSizing: 'border-box',
            padding: node.content ? '8px' : '0px',
            ...parseCssString(node.style?.customCss || '')
          }}
        >
          {node.content ? (
            <div style={textStyle}>
              {parseMarkdown(node.content)}
            </div>
          ) : null}
        </div>
      ) : isLine ? (
        node.type === 'custom-connector' ? (() => {
          const startX = node.startPoint!.x - node.position.x;
          const startY = node.startPoint!.y - node.position.y;
          const endX = node.endPoint!.x - node.position.x;
          const endY = node.endPoint!.y - node.position.y;
          const dx = endX - startX;
          const dy = endY - startY;
          const length = Math.sqrt(dx * dx + dy * dy);
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);

          const connectorStyle = node.customConnectorStyle || {};

          const lineCss = parseCssString(String(connectorStyle.lineCss || ''));
          const startMarkerCss = parseCssString(String(connectorStyle.startMarkerCss || ''));
          const endMarkerCss = parseCssString(String(connectorStyle.endMarkerCss || ''));

          const defaultBorderWidth = node.style?.borderWidth || '2px';
          const defaultBorderStyle = node.style?.borderStyle || 'dashed';
          const defaultBorderColor = node.style?.borderColor || '#e74c3c';

          return (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: `${startX}px`,
                top: `${startY}px`,
                width: `${length}px`,
                borderTop: `${defaultBorderWidth} ${defaultBorderStyle} ${defaultBorderColor}`,
                transform: `rotate(${angle}deg)`,
                transformOrigin: '0 0',
                pointerEvents: 'none',
                filter: shadowFilter,
                ...lineCss
              }} />

              {startMarkerCss && (
                <div style={{
                  position: 'absolute',
                  left: `${startX}px`,
                  top: `${startY}px`,
                  pointerEvents: 'none',
                  filter: shadowFilter,
                  ...startMarkerCss
                }} />
              )}

              {endMarkerCss ? (
                <div style={{
                  position: 'absolute',
                  left: `${endX}px`,
                  top: `${endY}px`,
                  pointerEvents: 'none',
                  filter: shadowFilter,
                  ...endMarkerCss
                }} />
              ) : (
                <div style={{
                  position: 'absolute',
                  left: `${endX}px`,
                  top: `${endY}px`,
                  width: 0,
                  height: 0,
                  borderLeft: `calc(12px * 0.6) solid transparent`,
                  borderRight: `calc(12px * 0.6) solid transparent`,
                  borderBottom: `12px solid ${defaultBorderColor}`,
                  transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                  pointerEvents: 'none',
                  filter: shadowFilter
                }} />
              )}
            </div>
          );
        })() : (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <svg width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }}>
            <defs>
              <marker
                id={`arrowhead-end-${node.id}`}
                markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto"
              >
                {node.arrowHead === 'hollow' ? (
                  <polygon points="0 0, 6 2.5, 0 5" fill="#ffffff" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1" />
                ) : node.arrowHead === 'open' ? (
                  <polyline points="0 0, 5 2.5, 0 5" fill="none" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1.5" />
                ) : node.arrowHead === 'diamond-filled' ? (
                  <polygon points="0 2.5, 3 0, 6 2.5, 3 5" fill={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} />
                ) : node.arrowHead === 'diamond-hollow' ? (
                  <polygon points="0 2.5, 3 0, 6 2.5, 3 5" fill="#ffffff" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1" />
                ) : node.arrowHead === 'circle' ? (
                  <circle cx="3" cy="2.5" r="2.5" fill="#ffffff" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1" />
                ) : (
                  <polygon points="0 0, 6 2.5, 0 5" fill={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} />
                )}
              </marker>
              <marker
                id={`arrowhead-start-${node.id}`}
                markerWidth="6" markerHeight="5" refX="1" refY="2.5" orient="auto"
              >
                {node.arrowTail === 'hollow' ? (
                  <polygon points="6 0, 0 2.5, 6 5" fill="#ffffff" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1" />
                ) : node.arrowTail === 'open' ? (
                  <polyline points="6 0, 1 2.5, 6 5" fill="none" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1.5" />
                ) : node.arrowTail === 'diamond-filled' ? (
                  <polygon points="6 2.5, 3 0, 0 2.5, 3 5" fill={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} />
                ) : node.arrowTail === 'diamond-hollow' ? (
                  <polygon points="6 2.5, 3 0, 0 2.5, 3 5" fill="#ffffff" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1" />
                ) : node.arrowTail === 'circle' ? (
                  <circle cx="3" cy="2.5" r="2.5" fill="#ffffff" stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} strokeWidth="1" />
                ) : (
                  <polygon points="6 0, 0 2.5, 6 5" fill={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')} />
                )}
              </marker>
            </defs>

            {node.routing === 'elbow' ? (() => {
              const startX = node.startPoint!.x - node.position.x;
              const startY = node.startPoint!.y - node.position.y;
              const endX = node.endPoint!.x - node.position.x;
              const endY = node.endPoint!.y - node.position.y;
              
              const effectiveArrowType = node.arrowType || (node.type === 'arrow' ? 'single' : 'none');
              const dasharray = node.lineStyle === 'dashed' ? '5 4' : node.lineStyle === 'dotted' ? '2 2' : undefined;

              const startAnchor = node.startConnection?.anchor;
              const endAnchor = node.endConnection?.anchor;
              const isStartHoriz = startAnchor === 'left' || startAnchor === 'right';
              const isStartVert = startAnchor === 'top' || startAnchor === 'bottom';
              const isEndHoriz = endAnchor === 'left' || endAnchor === 'right';
              const isEndVert = endAnchor === 'top' || endAnchor === 'bottom';
              const isPerpendicular = (isStartHoriz && isEndVert) || (isStartVert && isEndHoriz);
              const isVerticalElbow = isStartVert || (!startAnchor);
              const midY = (startY + endY) / 2;
              const midX = (startX + endX) / 2;
              
              let elbowPath = '';
              let generatedWaypoints: { x: number, y: number }[] = [];
              if (node.waypoints && node.waypoints.length > 0) {
                elbowPath = `M ${startX} ${startY}`;
                for (const wp of node.waypoints) {
                  elbowPath += ` L ${wp.x - node.position.x} ${wp.y - node.position.y}`;
                }
                elbowPath += ` L ${endX} ${endY}`;
              } else if (isPerpendicular) {
                // L-shape: 2 segments for perpendicular anchor pairs (e.g. right→top)
                if (isStartHoriz) {
                  // Horizontal first, then vertical
                  elbowPath = `M ${startX} ${startY} L ${endX} ${startY} L ${endX} ${endY}`;
                  generatedWaypoints = [
                    { x: endX + node.position.x, y: startY + node.position.y }
                  ];
                } else {
                  // Vertical first, then horizontal
                  elbowPath = `M ${startX} ${startY} L ${startX} ${endY} L ${endX} ${endY}`;
                  generatedWaypoints = [
                    { x: startX + node.position.x, y: endY + node.position.y }
                  ];
                }
              } else {
                // Step shape: 3 segments for parallel anchor pairs (existing behavior)
                elbowPath = isVerticalElbow 
                  ? `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`
                  : `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                  
                // Store generated midpoints so they can be grabbed
                if (isVerticalElbow) {
                  generatedWaypoints = [
                    { x: startX + node.position.x, y: midY + node.position.y },
                    { x: endX + node.position.x, y: midY + node.position.y }
                  ];
                } else {
                  generatedWaypoints = [
                    { x: midX + node.position.x, y: startY + node.position.y },
                    { x: midX + node.position.x, y: endY + node.position.y }
                  ];
                }
              }

              return (
                <g style={{ cursor: 'move', pointerEvents: 'all' }}>
                  <path
                    d={elbowPath}
                    stroke="transparent"
                    strokeWidth="16"
                    fill="none"
                    style={{ pointerEvents: 'stroke' }}
                  />
                  <path
                    d={elbowPath}
                    stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={dasharray}
                    markerStart={effectiveArrowType === 'double' ? `url(#arrowhead-start-${node.id})` : undefined}
                    markerEnd={(effectiveArrowType === 'single' || effectiveArrowType === 'double') ? `url(#arrowhead-end-${node.id})` : undefined}
                  />
                  
                  {/* Faint midpoints to add new waypoints */}
                  {isSelected && (() => {
                    const currentWps = node.waypoints || generatedWaypoints;
                    if (currentWps.length === 0) return null;
                    
                    const hints = [
                      { x: (startX + node.position.x + currentWps[0].x) / 2, y: (startY + node.position.y + currentWps[0].y) / 2 },
                      ...currentWps.slice(0, -1).map((wp, idx) => ({
                        x: (wp.x + currentWps[idx+1].x) / 2,
                        y: (wp.y + currentWps[idx+1].y) / 2
                      })),
                      { x: (currentWps[currentWps.length-1].x + endX + node.position.x) / 2, y: (currentWps[currentWps.length-1].y + endY + node.position.y) / 2 }
                    ];
                    
                    return hints.map((hp, i) => (
                      <g key={`hint-${i}`} style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const newWaypoints = [...currentWps];
                          newWaypoints.splice(i, 0, { x: hp.x, y: hp.y });
                          updateNode({ ...node, waypoints: newWaypoints });
                          setTimeout(() => {
                             onWaypointDragStart?.(e, node.id, i);
                          }, 0);
                        }}
                        onMouseDown={(e) => { e.stopPropagation(); }}
                      >
                        <circle cx={hp.x - node.position.x} cy={hp.y - node.position.y} r={4} fill="white" stroke="#0c8ce9" strokeWidth={1} opacity={0.6} />
                        <text x={hp.x - node.position.x} y={hp.y - node.position.y} fill="#0c8ce9" fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="central" opacity={0.8}>+</text>
                      </g>
                    ));
                  })()}
                  
                  {/* Draggable waypoints (bend points) */}
                  {isSelected && (node.waypoints || generatedWaypoints).map((wp, i) => (
                    <circle 
                      key={i} 
                      cx={wp.x - node.position.x} 
                      cy={wp.y - node.position.y} 
                      r={5}
                      fill="white" 
                      stroke="#0c8ce9" 
                      strokeWidth={2}
                      style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                      onPointerDown={(e) => {
                        if (e.button === 2) return; // ignore right click
                        e.stopPropagation();
                        // If these are generated, the caller needs to know to initialize them first
                        onWaypointDragStart?.(e, node.id, i);
                      }}
                      onMouseDown={(e) => { e.stopPropagation(); }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (node.waypoints) {
                          const newWaypoints = node.waypoints.filter((_, idx) => idx !== i);
                          updateNode({ ...node, waypoints: newWaypoints.length ? newWaypoints : undefined });
                        }
                      }}
                    />
                  ))}
                  
                  {/* Middle segment drag handle */}
                  {isSelected && onMiddleSegmentDragStart && !isPerpendicular && (() => {
                    const currentWps = node.waypoints || generatedWaypoints;
                    if (currentWps.length !== 2) return null;
                    
                    const handleX = (currentWps[0].x + currentWps[1].x) / 2 - node.position.x;
                    const handleY = (currentWps[0].y + currentWps[1].y) / 2 - node.position.y;
                    const axis = isVerticalElbow ? 'y' : 'x';
                    const cursor = isVerticalElbow ? 'ns-resize' : 'ew-resize';
                    const width = isVerticalElbow ? 24 : 8;
                    const height = isVerticalElbow ? 8 : 24;
                    
                    return (
                      <rect
                        x={handleX - width / 2}
                        y={handleY - height / 2}
                        width={width}
                        height={height}
                        rx={4}
                        fill="#0c8ce9"
                        opacity={0.8}
                        style={{ cursor, pointerEvents: 'all' }}
                        onPointerDown={(e) => {
                          if (e.button === 2) return;
                          e.stopPropagation();
                          onMiddleSegmentDragStart(e, node.id, axis);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    );
                  })()}
                </g>
              );
            })() : node.lineCurve === 'curved' ? (() => {
              const startX = node.startPoint!.x - node.position.x;
              const startY = node.startPoint!.y - node.position.y;
              const endX = node.endPoint!.x - node.position.x;
              const endY = node.endPoint!.y - node.position.y;
              const dx = endX - startX;
              const dy = endY - startY;
              const len = Math.sqrt(dx * dx + dy * dy);
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;
              const curveOffset = Math.max(15, Math.min(60, len * 0.15));
              const nx = len > 0 ? -dy / len : 0;
              const ny = len > 0 ? dx / len : 0;
              const controlX = midX + nx * curveOffset;
              const controlY = midY + ny * curveOffset;

              const effectiveArrowType = node.arrowType || (node.type === 'arrow' ? 'single' : 'none');
              const dasharray = node.lineStyle === 'dashed' ? '5 4' : node.lineStyle === 'dotted' ? '2 2' : undefined;
              const curvedPath = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

              return (
                <g style={{ cursor: 'move', pointerEvents: 'all' }}>
                  <path
                    d={curvedPath}
                    stroke="transparent"
                    strokeWidth="16"
                    fill="none"
                    style={{ pointerEvents: 'stroke' }}
                  />
                  <path
                    d={curvedPath}
                    stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={dasharray}
                    markerStart={effectiveArrowType === 'double' ? `url(#arrowhead-start-${node.id})` : undefined}
                    markerEnd={(effectiveArrowType === 'single' || effectiveArrowType === 'double') ? `url(#arrowhead-end-${node.id})` : undefined}
                  />
                </g>
              );
            })() : (() => {
              const startX = node.startPoint!.x - node.position.x;
              const startY = node.startPoint!.y - node.position.y;
              const endX = node.endPoint!.x - node.position.x;
              const endY = node.endPoint!.y - node.position.y;

              const effectiveArrowType = node.arrowType || (node.type === 'arrow' ? 'single' : 'none');
              const dasharray = node.lineStyle === 'dashed' ? '5 4' : node.lineStyle === 'dotted' ? '2 2' : undefined;

              return (
                <g style={{ cursor: 'move', pointerEvents: 'all' }}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="transparent"
                    strokeWidth="16"
                    style={{ pointerEvents: 'stroke' }}
                  />
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={effectiveBorder || (node.type === 'line' ? '#888888' : '#0c8ce9')}
                    strokeWidth="2"
                    strokeDasharray={dasharray}
                    markerStart={effectiveArrowType === 'double' ? `url(#arrowhead-start-${node.id})` : undefined}
                    markerEnd={(effectiveArrowType === 'single' || effectiveArrowType === 'double') ? `url(#arrowhead-end-${node.id})` : undefined}
                  />
                </g>
              );
            })()}
          </svg>
          
          {/* Edge Label */}
          {node.label && (() => {
            const startX = node.startPoint!.x - node.position.x;
            const startY = node.startPoint!.y - node.position.y;
            const endX = node.endPoint!.x - node.position.x;
            const endY = node.endPoint!.y - node.position.y;
            let labelX = (startX + endX) / 2;
            let labelY = (startY + endY) / 2;
            const labelOffset = 14; // px offset to avoid sitting on the line

            if (node.waypoints && node.waypoints.length > 0) {
              const midIndex = Math.floor((node.waypoints.length - 1) / 2);
              const wp1 = midIndex >= 0 ? node.waypoints[midIndex] : { x: startX + node.position.x, y: startY + node.position.y };
              const wp2 = midIndex + 1 < node.waypoints.length ? node.waypoints[midIndex + 1] : { x: endX + node.position.x, y: endY + node.position.y };
              labelX = (wp1.x + wp2.x) / 2 - node.position.x;
              labelY = (wp1.y + wp2.y) / 2 - node.position.y;
              // Offset perpendicular to the segment
              const segDx = wp2.x - wp1.x;
              const segDy = wp2.y - wp1.y;
              if (Math.abs(segDx) > Math.abs(segDy)) {
                labelY -= labelOffset; // horizontal segment -> push up
              } else {
                labelX += labelOffset; // vertical segment -> push right
              }
            } else if (node.routing === 'elbow') {
              const startAnchorL = node.startConnection?.anchor;
              const endAnchorL = node.endConnection?.anchor;
              const isStartHorizL = startAnchorL === 'left' || startAnchorL === 'right';
              const isStartVertL = startAnchorL === 'top' || startAnchorL === 'bottom';
              const isEndHorizL = endAnchorL === 'left' || endAnchorL === 'right';
              const isEndVertL = endAnchorL === 'top' || endAnchorL === 'bottom';
              const isPerpendicularL = (isStartHorizL && isEndVertL) || (isStartVertL && isEndHorizL);
              
              if (isPerpendicularL) {
                // L-shape: label at the corner
                if (isStartHorizL) {
                  labelX = endX;
                  labelY = startY - labelOffset;
                } else {
                  labelX = startX + labelOffset;
                  labelY = endY;
                }
              } else {
                const isVerticalElbowL = isStartVertL || !startAnchorL;
                const midYL = (startY + endY) / 2;
                const midXL = (startX + endX) / 2;
                if (isVerticalElbowL) {
                  labelX = (startX + endX) / 2;
                  labelY = midYL - labelOffset;
                } else {
                  labelX = midXL + labelOffset;
                  labelY = (startY + endY) / 2;
                }
              }
            } else if (node.lineCurve === 'curved') {
              const dx = endX - startX;
              const dy = endY - startY;
              const len = Math.sqrt(dx * dx + dy * dy);
              const curveOffset = Math.max(15, Math.min(60, len * 0.15));
              const nx = len > 0 ? -dy / len : 0;
              const ny = len > 0 ? dx / len : 0;
              labelX += nx * (curveOffset * 0.5);
              labelY += ny * (curveOffset * 0.5);
            } else {
              // Straight line — offset perpendicular (above the line)
              const dx = endX - startX;
              const dy = endY - startY;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                labelX += (-dy / len) * labelOffset;
                labelY += (dx / len) * labelOffset;
              } else {
                labelY -= labelOffset;
              }
            }

            if (node.labelPosition === 'start') {
              labelX = startX + (endX - startX) * 0.2;
              labelY = startY + (endY - startY) * 0.2;
            } else if (node.labelPosition === 'end') {
              labelX = startX + (endX - startX) * 0.8;
              labelY = startY + (endY - startY) * 0.8;
            }

            return (
              <div style={{
                position: 'absolute',
                left: `${labelX}px`,
                top: `${labelY}px`,
                transform: 'translate(-50%, -50%)',
                background: 'var(--bg-canvas, #1a1a2e)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: node.style?.fontSize || '10px',
                color: effectiveColor || 'var(--text-primary)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
              }}>
                {node.label}
              </div>
            );
          })()}
        </div>
        )
      ) : node.type === 'path' ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <svg width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }}>
            <path
              d={(() => {
                const pts = node.points || [];
                if (pts.length === 0) return '';
                const xs = pts.map(p => p.x);
                const ys = pts.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);
                const origW = Math.max(1, maxX - minX);
                const origH = Math.max(1, maxY - minY);
                
                const scaleX = node.dimensions.width / origW;
                const scaleY = node.dimensions.height / origH;
                
                return `M ${pts[0].x * scaleX} ${pts[0].y * scaleY} ` + 
                       pts.slice(1).map(p => `L ${p.x * scaleX} ${p.y * scaleY}`).join(' ');
              })()}
              fill="none"
              stroke={node.style?.borderColor || '#0c8ce9'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : node.type === 'comment' ? (
        <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'auto' }}>
          {/* Comment Bubble Pin */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setIsCardOpen(!isCardOpen);
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50% 50% 50% 4px',
              backgroundColor: 'var(--accent-purple)',
              border: '2px solid #ffffff',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
              color: 'white'
            }}
            title={node.content || "Add comment"}
          >
            <MessageSquare size={14} strokeWidth={2.5} />
          </div>

          {/* Comment Details Card */}
          {isCardOpen && (
            <div 
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: '34px',
                top: '0',
                backgroundColor: 'var(--bg-panel-solid)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '12px',
                width: '240px',
                boxShadow: 'var(--shadow-depth)',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)' }} />
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Comment</span>
                </div>
                <button
                  onClick={() => setIsCardOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}
                >
                  ✕
                </button>
              </div>

              {node.content ? (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: '1.4' }}>
                    {node.content}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Just now</span>
                    <button
                      onClick={() => {
                        saveHistoryState(nodes);
                        setNodes(nodes.filter(n => n.id !== node.id));
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#f04438', cursor: 'pointer', fontSize: '10px' }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    placeholder="Type a comment..."
                    autoFocus
                    style={{
                      width: '100%',
                      height: '60px',
                      backgroundColor: 'var(--bg-hover)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '4px',
                      padding: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      outline: 'none',
                      resize: 'none'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const val = (e.target as HTMLTextAreaElement).value.trim();
                        if (val) {
                          updateNode({ ...node, content: val });
                          setIsCardOpen(false);
                        } else {
                          setNodes(nodes.filter(n => n.id !== node.id));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        updateNode({ ...node, content: val });
                        setIsCardOpen(false);
                      } else {
                        setNodes(nodes.filter(n => n.id !== node.id));
                      }
                    }}
                  />
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Press Enter to save</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `rotate(${node.rotation || 0}deg)`,
            backgroundColor: node.style?.backgroundColor || '#2c2c2c',
            border: `1.5px solid ${node.style?.borderColor || '#555555'}`,
            borderRadius: node.style?.borderRadius || '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            padding: '8px',
            boxShadow: node.style?.boxShadow || 'none'
          }}
        >
          <div style={textStyle}>
            {parseMarkdown(node.content)}
          </div>
        </div>
      )}

      {/* Anchor Dots (When drawing or selecting a line) */}
      {!isLine && (activeTool === 'arrow' || activeTool === 'line' || (selectedNodeIds.length === 1 && (nodes.find(n => n.id === selectedNodeIds[0])?.type === 'line' || nodes.find(n => n.id === selectedNodeIds[0])?.type === 'arrow'))) && (
        <>
          {['top', 'bottom', 'left', 'right'].map((anchor) => {
            let left = '50%';
            let top = '50%';
            if (anchor === 'top') top = '0%';
            if (anchor === 'bottom') top = '100%';
            if (anchor === 'left') left = '0%';
            if (anchor === 'right') left = '100%';
            return (
              <div
                key={anchor}
                data-anchor={anchor}
                data-node-id={node.id}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: `${8 / zoom}px`,
                  height: `${8 / zoom}px`,
                  backgroundColor: '#0c8ce9',
                  border: `${1.5 / zoom}px solid white`,
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                  zIndex: 20,
                  opacity: 0.8
                }}
              />
            );
          })}
        </>
      )}

      {isSelected && isLine && (
        <>
          {/* Start Point Handle */}
          <div
            style={{
              position: 'absolute',
              left: node.startPoint!.x - node.position.x,
              top: node.startPoint!.y - node.position.y,
              width: `${8 / zoom}px`,
              height: `${8 / zoom}px`,
              backgroundColor: '#ffffff',
              border: `${2 / zoom}px solid #0c8ce9`,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              zIndex: 30,
              boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0,0,0,0.3)`,
            }}
            onMouseDown={handleStartDrag}
          />
          {/* End Point Handle */}
          <div
            style={{
              position: 'absolute',
              left: node.endPoint!.x - node.position.x,
              top: node.endPoint!.y - node.position.y,
              width: `${8 / zoom}px`,
              height: `${8 / zoom}px`,
              backgroundColor: '#ffffff',
              border: `${2 / zoom}px solid #0c8ce9`,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              zIndex: 30,
              boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0,0,0,0.3)`,
            }}
            onMouseDown={handleEndDrag}
          />
        </>
      )}
      {isEditing && (
        <textarea
            id={`node-edit-${node.id}`}
            key={node.content}
            defaultValue={node.content}
            autoFocus
            onBlur={(e) => {
              const val = e.target.value.trim();
              updateNode({ ...node, content: val });
              setIsEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const val = (e.target as HTMLTextAreaElement).value.trim();
                updateNode({ ...node, content: val });
                setIsEditing(false);
              }
              if (e.key === 'Escape') {
                setIsEditing(false);
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: textStyle.color,
              fontFamily: 'inherit',
              fontSize: textStyle.fontSize,
              fontWeight: textStyle.fontWeight,
              textAlign: textStyle.textAlign,
              padding: '16px', // average padding for most shapes
              resize: 'none',
              outline: 'none',
              zIndex: 100,
              boxSizing: 'border-box'
            }}
          />
      )}
    </Rnd>
  );
}
