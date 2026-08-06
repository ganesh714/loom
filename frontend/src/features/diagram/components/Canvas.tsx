import { useState, useEffect, useRef } from 'react';
import { useDiagram } from '@/context/DiagramContext';
import type { NodeType } from '@/types';
import { Node } from './Node';
import { RemoteCursors } from './RemoteCursors';
import { useCollaboration } from '@/context/CollaborationContext';
import styles from './Canvas.module.css';
import { 
  MousePointer2, 
  Square, 
  Circle, 
  Triangle, 
  Minus, 
  ArrowRight,
  Gem,
  Star as StarIcon,
  Plus,
  Minus as ZoomOutIcon,
  Bold,
  Trash2,
  ChevronDown,
  Pencil,
  Eraser,
  MessageSquare,
  Scaling as ScalingIcon,
  Hand,
  Redo2,
  Hexagon,
  Database,
  StickyNote,
  Sparkles,
  Link,
  Unlink,
  Undo2,
  CornerDownRight,
  Activity,
  BringToFront,
  SendToBack,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  AlignEndVertical,
  Layers,
  Scissors
} from 'lucide-react';

export function Canvas() {
  const { 
    nodes, 
    projects,
    activeProjectId,
    activeFileId,
    selectedNodeIds,
    selectNode,
    setSelectedNodeIds,
    setNodes,
    updateNode,
    addBox,
    addDiamond,
    addCircle,
    addTriangle,
    addStar,
    addPill,
    addHexagon,
    addParallelogram,
    addDatabase,
    addNote,
    addLine,
    addArrow,
    addCustomBlock,
    addCustomConnector,
    updateWaypoint,
    zoom,
    setZoom,
    activeTool,
    setActiveTool,
    selectToolMode,
    setSelectToolMode,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    activeSnapLines,
    alignSelected,
    undo,
    redo,
    canUndo,
    canRedo,
    saveHistoryState,
    copySelected,
    pasteSelected,
    cutSelected,
    deleteSelected,
    groupSelected,
    ungroupSelected,
    panOffset,
    setPanOffset,
    splitElbowLine
  } = useDiagram();
  const { broadcast } = useCollaboration();

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeFile = activeProject?.files.find(f => f.id === activeFileId);
  const canvasBgColor = activeFile?.canvasConfig?.backgroundColor || 'var(--bg-canvas)';

  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastCursorBroadcastRef = useRef<number>(0);

  const [drawingPreview, setDrawingPreview] = useState<{
    type: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    points?: { x: number; y: number }[];
  } | null>(null);

  const drawingPreviewRef = useRef(drawingPreview);
  
  const [_draggingWaypoint, setDraggingWaypoint] = useState<{
    nodeId: string;
    index: number;
  } | null>(null);

  const findNodeAndAnchor = (x: number, y: number, excludeIds: string[], targetElement?: EventTarget | null) => {
    // Explicit fixed anchor drop
    if (targetElement && (targetElement as HTMLElement).hasAttribute && (targetElement as HTMLElement).hasAttribute('data-anchor')) {
      const el = targetElement as HTMLElement;
      const anchor = el.getAttribute('data-anchor') as 'top' | 'bottom' | 'left' | 'right';
      const nodeId = el.getAttribute('data-node-id') as string;
      
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const left = node.position.x;
        const right = node.position.x + node.dimensions.width;
        const top = node.position.y;
        const bottom = node.position.y + node.dimensions.height;
        const cx = left + node.dimensions.width / 2;
        const cy = top + node.dimensions.height / 2;
        
        let anchorPt = { x: cx, y: cy };
        if (anchor === 'top') anchorPt = { x: cx, y: top };
        if (anchor === 'bottom') anchorPt = { x: cx, y: bottom };
        if (anchor === 'left') anchorPt = { x: left, y: cy };
        if (anchor === 'right') anchorPt = { x: right, y: cy };
        return { nodeId, anchor, point: anchorPt };
      }
    }

    // Search in reverse to get topmost node
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (excludeIds.includes(node.id) || ['line', 'arrow', 'path', 'custom-connector'].includes(node.type)) continue;
      
      const left = node.position.x;
      const right = node.position.x + node.dimensions.width;
      const top = node.position.y;
      const bottom = node.position.y + node.dimensions.height;
      
      if (x >= left && x <= right && y >= top && y <= bottom) {
        const cx = left + node.dimensions.width / 2;
        const cy = top + node.dimensions.height / 2;
        
        const dx = x - cx;
        const dy = y - cy;
        let anchor = 'bottom';
        if (Math.abs(dx) > Math.abs(dy)) {
          anchor = dx > 0 ? 'right' : 'left';
        } else {
          anchor = dy > 0 ? 'bottom' : 'top';
        }
        
        let anchorPt = { x: cx, y: cy };
        if (anchor === 'top') anchorPt = { x: cx, y: top };
        if (anchor === 'bottom') anchorPt = { x: cx, y: bottom };
        if (anchor === 'left') anchorPt = { x: left, y: cy };
        if (anchor === 'right') anchorPt = { x: right, y: cy };

        return { nodeId: node.id, anchor, point: anchorPt };
      }
    }
    return null;
  };

  useEffect(() => {
    drawingPreviewRef.current = drawingPreview;
  }, [drawingPreview]);

  const [selectDropdownOpen, setSelectDropdownOpen] = useState(false);
  const [shapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const [currentShapeType, setCurrentShapeType] = useState<NodeType>('box');

  // Close shape and select dropdown on click away
  useEffect(() => {
    if (!shapeDropdownOpen && !selectDropdownOpen) return;
    const handleOutsideClick = () => {
      setShapeDropdownOpen(false);
      setSelectDropdownOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [shapeDropdownOpen, selectDropdownOpen]);

  // Keyboard Space detection for panning cursor and tool hotkeys
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      const targetTag = document.activeElement?.tagName;
      if (
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      const key = e.key.toLowerCase();

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Copy / Paste / Cut
      if ((e.ctrlKey || e.metaKey) && key === 'c') {
        if (window.getSelection()?.toString().trim() !== '') {
          return; // Let the browser handle text copy
        }
        e.preventDefault();
        copySelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'v') {
        // Only prevent default if we are specifically focused on the canvas body, not if focused elsewhere.
        // But for paste, it's safer just to try pasteSelected.
        e.preventDefault();
        pasteSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'x') {
        if (window.getSelection()?.toString().trim() !== '') {
          return; // Let the browser handle text cut
        }
        e.preventDefault();
        cutSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'd') {
        e.preventDefault();
        copySelected();
        setTimeout(() => pasteSelected(), 50);
        return;
      }

      // Group / Ungroup
      if ((e.ctrlKey || e.metaKey) && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          ungroupSelected();
        } else {
          groupSelected();
        }
        return;
      }

      // Layer Arrangement Shortcuts
      if ((e.ctrlKey || e.metaKey) && key === ']') {
        e.preventDefault();
        if (e.shiftKey) {
          bringToFront(selectedNodeIds);
        } else {
          bringForward(selectedNodeIds);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === '[') {
        e.preventDefault();
        if (e.shiftKey) {
          sendToBack(selectedNodeIds);
        } else {
          sendBackward(selectedNodeIds);
        }
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        selectNode(null);
        return;
      }

      // Hotkeys for switching tools
      if (key === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('select');
        setSelectToolMode('move');
      } else if (key === 'k' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('select');
        setSelectToolMode('scale');
      } else if (key === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('hand');
      } else if (key === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('pen');
      } else if (key === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('erase');
      } else if (key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('circle');
        setCurrentShapeType('circle');
      } else if (key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('comment');
      } else if (key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('box');
        setCurrentShapeType('box');
      } else if (key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setActiveTool('note');
        setCurrentShapeType('note');
      } else if (key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.shiftKey) {
          setActiveTool('arrow');
          setCurrentShapeType('arrow');
        } else {
          setActiveTool('line');
          setCurrentShapeType('line');
        }
      }
    };

    const handleKeyUpGlobal = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal);
    window.addEventListener('keyup', handleKeyUpGlobal);
    return () => {
      window.removeEventListener('keydown', handleKeyDownGlobal);
      window.removeEventListener('keyup', handleKeyUpGlobal);
    };
  }, [undo, redo, copySelected, pasteSelected, cutSelected, deleteSelected]);

  // Wheel listener: Ctrl + scroll zooms, regular scroll pans (trackpad)
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheelRaw = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomFactor = 0.05;
        const direction = e.deltaY < 0 ? 1 : -1;
        const newZoom = Math.min(3.0, Math.max(0.1, zoom + direction * zoomFactor));
        setZoom(Number(newZoom.toFixed(2)));
      } else {
        e.preventDefault();
        setPanOffset(prev => ({
          x: prev.x - e.deltaX / zoom,
          y: prev.y - e.deltaY / zoom
        }));
      }
    };

    canvasEl.addEventListener('wheel', handleWheelRaw, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleWheelRaw);
    };
  }, [zoom]);

  // Keyboard arrow keys nudging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = document.activeElement?.tagName;
      if (
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT'
      ) {
        return;
      }

      if (selectedNodeIds.length === 0) return;

      let dx = 0;
      let dy = 0;
      const nudgeAmount = e.shiftKey ? 10 : 1;

      switch (e.key) {
        case 'ArrowUp':
        case 'Up':
          dy = -nudgeAmount;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'Down':
          dy = nudgeAmount;
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'Left':
          dx = -nudgeAmount;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'Right':
          dx = nudgeAmount;
          e.preventDefault();
          break;
        default:
          return;
      }

      const updatedNodes = nodes.map((node) => {
        if (selectedNodeIds.includes(node.id)) {
          const newPos = { x: node.position.x + dx, y: node.position.y + dy };
          if (node.startPoint && node.endPoint) {
            return {
              ...node,
              position: newPos,
              startPoint: { x: node.startPoint.x + dx, y: node.startPoint.y + dy },
              endPoint: { x: node.endPoint.x + dx, y: node.endPoint.y + dy }
            };
          }
          return { ...node, position: newPos };
        }
        return node;
      });
      saveHistoryState(nodes);
      setNodes(updatedNodes);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeIds, setNodes, nodes, saveHistoryState]);

  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [portSnapTarget, setPortSnapTarget] = useState<{ nodeId: string; anchor: string; screenX: number; screenY: number } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/arc-node-type');
    if (!type) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - panOffset.x;
    const y = (e.clientY - rect.top) / zoom - panOffset.y;

    if (type === 'box') addBox({ x, y });
    else if (type === 'diamond') addDiamond({ x, y });
    else if (type === 'circle') addCircle({ x, y });
    else if (type === 'triangle') addTriangle({ x, y });
    else if (type === 'star') addStar({ x, y });
    else if (type === 'pill') addPill({ x, y });
    else if (type === 'hexagon') addHexagon({ x, y });
    else if (type === 'parallelogram') addParallelogram({ x, y });
    else if (type === 'database') addDatabase({ x, y });
    else if (type === 'note') addNote({ x, y });
    else if (type === 'line') addLine({ x, y });
    else if (type === 'arrow') addArrow({ x, y });
    else if (type === 'custom-block') addCustomBlock({ x, y });
    else if (type === 'custom-connector') addCustomConnector({ x, y });

  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('handleMouseDown triggered, activeTool:', activeTool, 'button:', e.button);

    // BUG FIX: Close toolbar dropdowns when clicking on canvas
    if (selectDropdownOpen) setSelectDropdownOpen(false);
    if (shapeDropdownOpen) setShapeDropdownOpen(false);

    const isMiddleClick = e.button === 1;
    const isSpaceDrag = spacePressed || activeTool === 'hand';

    if (isMiddleClick || isSpaceDrag) {
      console.log('panning mode triggered');
      e.preventDefault();
      setIsPanning(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const initialPan = { ...panOffset };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        setPanOffset({
          x: initialPan.x + dx / zoom,
          y: initialPan.y + dy / zoom
        });
      };

      const handleMouseUp = () => {
        setIsPanning(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    if (activeTool !== 'select') {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const startX = (e.clientX - rect.left) / zoom - panOffset.x;
      const startY = (e.clientY - rect.top) / zoom - panOffset.y;

      if (activeTool === 'comment') {
        const id = Math.random().toString(36).substring(2, 10);
        const newNode: any = {
          id,
          type: 'comment',
          position: { x: startX - 16, y: startY - 16 },
          dimensions: { width: 32, height: 32 },
          content: '',
          style: {
            backgroundColor: '#ffc000'
          }
        };
        saveHistoryState(nodes);
        setNodes([...nodes, newNode]);
        selectNode(id, false);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'pen') {
        const pointsList = [{ x: startX, y: startY }];
        setDrawingPreview({
          type: 'pen',
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          points: pointsList
        });

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const currentX = (moveEvent.clientX - rect.left) / zoom - panOffset.x;
          const currentY = (moveEvent.clientY - rect.top) / zoom - panOffset.y;
          pointsList.push({ x: currentX, y: currentY });
          setDrawingPreview({
            type: 'pen',
            startX,
            startY,
            currentX,
            currentY,
            points: [...pointsList]
          });
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);

          const currentPreview = drawingPreviewRef.current;
          if (currentPreview && currentPreview.points && currentPreview.points.length > 1) {
            const pts = currentPreview.points;
            const xs = pts.map(p => p.x);
            const ys = pts.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const w = Math.max(10, maxX - minX);
            const h = Math.max(10, maxY - minY);

            const relativePoints = pts.map(p => ({
              x: p.x - minX,
              y: p.y - minY
            }));

            const id = Math.random().toString(36).substring(2, 10);
            const newNode: any = {
              id,
              type: 'path',
              position: { x: minX, y: minY },
              dimensions: { width: w, height: h },
              content: '',
              style: {
                borderColor: '#0c8ce9'
              },
              points: relativePoints
            };

            saveHistoryState(nodes);
            setNodes([...nodes, newNode]);
            selectNode(id, false);
          }

          setDrawingPreview(null);
          setActiveTool('select');
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return;
      }

      // Regular shape drawing mode (box, circle, triangle, diamond, star, line, arrow)
      console.log('starting shape drawing:', activeTool);
      setDrawingPreview({
        type: activeTool,
        startX,
        startY,
        currentX: startX,
        currentY: startY
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = (moveEvent.clientX - rect.left) / zoom - panOffset.x;
        const currentY = (moveEvent.clientY - rect.top) / zoom - panOffset.y;
        setDrawingPreview(prev => prev ? { ...prev, currentX, currentY } : null);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        console.log('handleMouseUp triggered');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        const currentPreview = drawingPreviewRef.current;
        if (currentPreview) {
          const sX = currentPreview.startX;
          const sY = currentPreview.startY;
          const cX = currentPreview.currentX;
          const cY = currentPreview.currentY;

          const left = Math.min(sX, cX);
          const top = Math.min(sY, cY);
          const width = Math.max(10, Math.abs(cX - sX));
          const height = Math.max(10, Math.abs(cY - sY));

          if (width > 5 || height > 5) {
            const id = Math.random().toString(36).substring(2, 10);
            const isLineType = activeTool === 'line' || activeTool === 'arrow' || activeTool === 'custom-connector';
            let newNode: any;

            if (isLineType) {
              const startSnap = findNodeAndAnchor(sX, sY, []);
              const endSnap = findNodeAndAnchor(cX, cY, [], upEvent.target);

              const finalStartX = startSnap ? startSnap.point.x : sX;
              const finalStartY = startSnap ? startSnap.point.y : sY;
              const finalEndX = endSnap ? endSnap.point.x : cX;
              const finalEndY = endSnap ? endSnap.point.y : cY;

              const minX = Math.min(finalStartX, finalEndX);
              const minY = Math.min(finalStartY, finalEndY);
              const w = Math.max(10, Math.abs(finalEndX - finalStartX));
              const h = Math.max(10, Math.abs(finalEndY - finalStartY));

              if (activeTool === 'custom-connector') {
                newNode = {
                  id,
                  type: 'custom-connector',
                  position: { x: minX, y: minY },
                  dimensions: { width: w, height: h },
                  content: '',
                  style: {
                    borderColor: '#e74c3c',
                    borderStyle: 'dashed',
                    borderWidth: '2px',
                    opacity: '0.8'
                  },
                  startPoint: { x: finalStartX, y: finalStartY },
                  endPoint: { x: finalEndX, y: finalEndY },
                  startConnection: startSnap ? { nodeId: startSnap.nodeId, anchor: startSnap.anchor } : undefined,
                  endConnection: endSnap ? { nodeId: endSnap.nodeId, anchor: endSnap.anchor } : undefined,
                  customConnectorStyle: {
                    borderBottomColor: '#e74c3c',
                    borderWidth: '12px'
                  }
                };
              } else {
                newNode = {
                  id,
                  type: activeTool,
                  position: { x: minX, y: minY },
                  dimensions: { width: w, height: h },
                  content: '',
                  style: {
                    borderColor: activeTool === 'arrow' ? '#0c8ce9' : '#888888',
                  },
                  startPoint: { x: finalStartX, y: finalStartY },
                  endPoint: { x: finalEndX, y: finalEndY },
                  startConnection: startSnap ? { nodeId: startSnap.nodeId, anchor: startSnap.anchor } : undefined,
                  endConnection: endSnap ? { nodeId: endSnap.nodeId, anchor: endSnap.anchor } : undefined
                };
              }
            } else if (activeTool === 'custom-block') {
              newNode = {
                id,
                type: 'custom-block',
                position: { x: left, y: top },
                dimensions: { width, height },
                content: '',
                style: {
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  clipPath: 'polygon(0% 15%, 15% 15%, 15% 0%, 85% 0%, 85% 15%, 100% 15%, 100% 85%, 85% 85%, 85% 100%, 15% 100%, 15% 85%, 0% 85%)',
                  color: '#ffffff',
                  borderWidth: '0px',
                  opacity: '0.9'
                }
              };
            } else {
              let defaultBg = '#2c2c2c';
              let defaultBorder = '#0c8ce9';
              let defaultText = 'Rectangle';
              let customStyle: any = {};

              if (activeTool === 'diamond') {
                defaultBg = '#2c2c2c';
                defaultBorder = '#c69c3a';
                defaultText = 'Diamond';
                customStyle = { borderRadius: '2px' };
              } else if (activeTool === 'circle') {
                defaultText = 'Ellipse';
              } else if (activeTool === 'triangle') {
                defaultBg = '#2c2c2c';
                defaultBorder = '#2b8a4e';
                defaultText = 'Triangle';
              } else if (activeTool === 'star') {
                defaultBg = '#2c2c2c';
                defaultBorder = '#9e7c1d';
                defaultText = 'Star';
              } else if (activeTool === 'pill') {
                defaultText = 'Pill';
                customStyle = { borderRadius: '999px' };
              } else if (activeTool === 'hexagon') {
                defaultBg = '#2c2c2c';
                defaultBorder = '#824ea0';
                defaultText = 'Hexagon';
              } else if (activeTool === 'parallelogram') {
                defaultBg = '#2c2c2c';
                defaultBorder = '#4e82a0';
                defaultText = 'Parallelogram';
              } else if (activeTool === 'database') {
                defaultBg = '#2c2c2c';
                defaultBorder = '#a04e4e';
                defaultText = 'Database';
              } else if (activeTool === 'note') {
                defaultBg = '#fef3c7';
                defaultBorder = '#f59e0b';
                defaultText = 'Note';
                customStyle = { color: '#92400e' };
              }

              newNode = {
                id,
                type: activeTool,
                position: { x: left, y: top },
                dimensions: { width, height },
                content: defaultText,
                style: {
                  backgroundColor: defaultBg,
                  borderColor: defaultBorder,
                  color: customStyle.color || '#e3e3e3',
                  ...customStyle
                }
              };
            }

            saveHistoryState(nodes);
            setNodes([...nodes, newNode]);
            selectNode(id, false);
          }
        }

        setDrawingPreview(null);
        setActiveTool('select');
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // Select tool — check if we should drag-select or interact with a node
    if (e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / zoom - panOffset.x;
    const startY = (e.clientY - rect.top) / zoom - panOffset.y;

    // Begin marquee regardless of whether we hit a node or empty space.
    // The marquee will only commit if the user dragged more than a threshold.
    setMarquee({ startX, startY, currentX: startX, currentY: startY });
    setIsDragSelecting(false);

    // Record where we started for click-vs-drag detection
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;
      const dragDist = Math.sqrt(dx * dx + dy * dy);

      if (dragDist > 4) {
        setIsDragSelecting(true);
      }

      const currentX = (moveEvent.clientX - rect.left) / zoom - panOffset.x;
      const currentY = (moveEvent.clientY - rect.top) / zoom - panOffset.y;
      setMarquee(prev => prev ? { ...prev, currentX, currentY } : null);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      setMarquee(currentMarquee => {
        setIsDragSelecting(false);
        if (!currentMarquee) return null;

        const left = Math.min(currentMarquee.startX, currentMarquee.currentX);
        const top = Math.min(currentMarquee.startY, currentMarquee.currentY);
        const right = Math.max(currentMarquee.startX, currentMarquee.currentX);
        const bottom = Math.max(currentMarquee.startY, currentMarquee.currentY);
        const width = right - left;
        const height = bottom - top;

        // Small drag (< 5px) = treat as a click, not a marquee
        if (width < 5 && height < 5) {
          // Only deselect if clicking directly on the canvas background
          const target = upEvent.target as HTMLElement;
          const isCanvasBackground = target === canvasRef.current || target.classList.contains(styles.canvas);
          
          if (isCanvasBackground) {
            if (!upEvent.shiftKey) selectNode(null);
          }
          return null;
        }

        const intersectingIds = nodes
          .filter(node => {
            const nodeLeft = node.position.x;
            const nodeTop = node.position.y;
            const nodeRight = node.position.x + node.dimensions.width;
            const nodeBottom = node.position.y + node.dimensions.height;
            return nodeLeft < right && nodeRight > left && nodeTop < bottom && nodeBottom > top;
          })
          .map(node => node.id);

        if (upEvent.shiftKey) {
          setSelectedNodeIds(Array.from(new Set([...selectedNodeIds, ...intersectingIds])));
        } else {
          setSelectedNodeIds(intersectingIds);
        }

        return null;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleZoomIn = () => {
    setZoom(Math.min(3.0, zoom + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(0.1, zoom - 0.1));
  };

  const handleZoomReset = () => {
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Quick contextual changes
  const selectedNode = selectedNodeIds.length === 1 ? nodes.find(n => n.id === selectedNodeIds[0]) : null;

  const handleQuickChange = (field: string, value: string) => {
    if (!selectedNode) return;
    updateNode({
      ...selectedNode,
      style: {
        ...selectedNode.style,
        [field]: value
      }
    });
  };

  const handleUpdateNodeProperty = (key: string, value: any) => {
    if (!selectedNode) return;
    saveHistoryState(nodes);
    const updates: any = { [key]: value };
    
    if (key === 'routing' && value === 'elbow') updates['lineCurve'] = undefined;
    if (key === 'lineCurve' && value === 'curved') updates['routing'] = undefined;
    if (key === 'routing' && value === 'straight') {
      updates['routing'] = undefined;
      updates['lineCurve'] = undefined;
    }
    
    updateNode({ ...selectedNode, ...updates });
  };

  const handleDeleteNode = (id: string) => {
    saveHistoryState(nodes);
    setNodes(nodes.filter(n => n.id !== id));
    setSelectedNodeIds([]);
  };

  const PillIcon = ({ size = 15, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="6" />
    </svg>
  );

  const ParallelogramIcon = ({ size = 15, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 4 22 4 18 20 2 20" />
    </svg>
  );

  const FlowchartDiamondIcon = ({ size = 15, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 12 12 22 2 12" />
    </svg>
  );

  const shapeIcons = {
    box: <Square size={15} />,
    pill: <PillIcon size={15} />,
    circle: <Circle size={15} />,
    triangle: <Triangle size={15} />,
    hexagon: <Hexagon size={15} />,
    diamond: <FlowchartDiamondIcon size={15} />,
    parallelogram: <ParallelogramIcon size={15} />,
    star: <StarIcon size={15} />,
    database: <Database size={15} />,
    note: <StickyNote size={15} />,
    comment: <MessageSquare size={15} style={{ color: 'var(--accent-purple)' }} />,
    line: <Minus size={15} />,
    arrow: <ArrowRight size={15} />,
    'custom-block': <Sparkles size={15} style={{ color: '#8b5cf6' }} />,
    'custom-connector': <Link size={15} style={{ color: '#8b5cf6' }} />
  };

  const shapeLabels = {
    box: 'Rectangle (R)',
    pill: 'Pill',
    circle: 'Ellipse (O)',
    triangle: 'Triangle',
    hexagon: 'Hexagon',
    diamond: 'Diamond',
    parallelogram: 'Parallelogram',
    star: 'Star',
    database: 'Database',
    note: 'Sticky Note',
    comment: 'Comment (C)',
    line: 'Line (L)',
    arrow: 'Arrow (Shift+L)',
    'custom-block': 'Custom Block',
    'custom-connector': 'Custom Connector'
  };

  const tooltips = {
    box: 'Rectangle',
    pill: 'Pill',
    circle: 'Ellipse',
    triangle: 'Triangle',
    hexagon: 'Hexagon',
    diamond: 'Diamond',
    parallelogram: 'Parallelogram',
    star: 'Star',
    database: 'Database',
    note: 'Sticky Note',
    comment: 'Comment',
    line: 'Line',
    arrow: 'Arrow',
    'custom-block': 'Custom Block',
    'custom-connector': 'Custom Connector'
  };

  const nodeIcons = {
    box: <Square size={15} />,
    pill: <PillIcon size={15} />,
    circle: <Circle size={15} />,
    triangle: <Triangle size={15} />,
    hexagon: <Hexagon size={15} />,
    diamond: <FlowchartDiamondIcon size={15} />,
    parallelogram: <ParallelogramIcon size={15} />,
    star: <StarIcon size={15} />,
    database: <Database size={15} />,
    note: <StickyNote size={15} />,
    comment: <MessageSquare size={15} />,
    line: <Minus size={15} />,
    arrow: <ArrowRight size={15} />,
    'custom-block': <Sparkles size={15} />,
    'custom-connector': <Link size={15} />
  };

  const getCursorClass = () => {
    if (isPanning) return styles.grabbingCursor;
    if (spacePressed || activeTool === 'hand') return styles.grabCursor;
    if (activeTool === 'erase') return styles.cellCursor;
    if (isDragSelecting || activeTool !== 'select') return styles.crosshairCursor;
    return '';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastCursorBroadcastRef.current > 50) {
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = (e.clientX - rect.left) / zoom - panOffset.x;
      const currentY = (e.clientY - rect.top) / zoom - panOffset.y;
      
      broadcast('CURSOR_MOVED', { x: currentX, y: currentY });
      lastCursorBroadcastRef.current = now;

      // Port snapping visual feedback during line/arrow drawing
      if (activeTool === 'line' || activeTool === 'arrow') {
        const PORT_SNAP_RADIUS = 24;
        let bestSnap: typeof portSnapTarget = null;
        let bestDist = PORT_SNAP_RADIUS;
        const canvasRect = e.currentTarget.getBoundingClientRect();
        nodes.forEach(n => {
          if (n.type === 'line' || n.type === 'arrow') return;
          const ports: Record<string, { px: number; py: number }> = {
            top: { px: n.position.x + n.dimensions.width / 2, py: n.position.y },
            bottom: { px: n.position.x + n.dimensions.width / 2, py: n.position.y + n.dimensions.height },
            left: { px: n.position.x, py: n.position.y + n.dimensions.height / 2 },
            right: { px: n.position.x + n.dimensions.width, py: n.position.y + n.dimensions.height / 2 }
          };
          Object.entries(ports).forEach(([anchor, { px, py }]) => {
            const dist = Math.sqrt(Math.pow(currentX - px, 2) + Math.pow(currentY - py, 2));
            if (dist < bestDist) {
              bestDist = dist;
              bestSnap = {
                nodeId: n.id, anchor,
                screenX: (px + panOffset.x) * zoom + canvasRect.left,
                screenY: (py + panOffset.y) * zoom + canvasRect.top
              };
            }
          });
        });
        setPortSnapTarget(bestSnap);
      } else {
        setPortSnapTarget(null);
      }
    }
  };

  return (
    <div className={styles.canvasWrapper} style={{ backgroundColor: canvasBgColor }}>
      {/* Main Canvas Area */}
      <div 
        ref={canvasRef}
        className={`${styles.canvas} ${getCursorClass()}`} 
        onMouseDown={handleMouseDown}
        onPointerMove={handlePointerMove}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDoubleClick={(e) => {
          if (activeTool !== 'select') return;
          const target = e.target as HTMLElement;
          const isCanvasBg = target === canvasRef.current || target.classList.contains(styles.canvas) || target.id === 'arc-export-area';
          if (!isCanvasBg) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const canvasX = (e.clientX - rect.left) / zoom - panOffset.x;
          const canvasY = (e.clientY - rect.top) / zoom - panOffset.y;
          setQuickAdd({ x: e.clientX, y: e.clientY, canvasX, canvasY });
        }}
        style={{
          backgroundColor: canvasBgColor,
          backgroundImage: 'radial-gradient(var(--border-default) 1px, transparent 1px)',
          backgroundSize: `${16 * zoom}px ${16 * zoom}px`,
          backgroundPosition: `${panOffset.x * zoom}px ${panOffset.y * zoom}px`,
        }}
      >
        {/* Scaled viewport container */}
        <div style={{
          transform: `translate(${panOffset.x * zoom}px, ${panOffset.y * zoom}px) scale(${zoom})`,
          transformOrigin: 'top left',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}>
          <div id="arc-export-area" className={getCursorClass()} style={{ pointerEvents: 'auto', width: '100%', height: '100%', position: 'relative' }}>
            {nodes.map((node) => (
              <Node 
                key={node.id} 
                node={node} 
                onWaypointDragStart={(e, nodeId, index) => {
                  e.stopPropagation();
                  setDraggingWaypoint({ nodeId, index });
                  saveHistoryState(nodes); // Save pre-drag state
                  
                  // If this is a newly initialized waypoint (from the generated elbows),
                  // we need to make sure the state is initialized in the context
                  if (!node.waypoints || node.waypoints.length === 0) {
                    const startX = node.startPoint!.x;
                    const startY = node.startPoint!.y;
                    const endX = node.endPoint!.x;
                    const endY = node.endPoint!.y;
                    const isVertical = node.startConnection?.anchor === 'bottom' || node.startConnection?.anchor === 'top' || !node.startConnection?.anchor;
                    
                    let initialWaypoints = [];
                    if (isVertical) {
                      const midY = (startY + endY) / 2;
                      initialWaypoints = [{ x: startX, y: midY }, { x: endX, y: midY }];
                    } else {
                      const midX = (startX + endX) / 2;
                      initialWaypoints = [{ x: midX, y: startY }, { x: midX, y: endY }];
                    }
                    // Use setNodes to avoid recursive broadcast/history issues
                    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, waypoints: initialWaypoints } : n));
                  }
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const currentX = (moveEvent.clientX - rect.left) / zoom - panOffset.x;
                    const currentY = (moveEvent.clientY - rect.top) / zoom - panOffset.y;
                    updateWaypoint(nodeId, index, { x: currentX, y: currentY });
                  };
                  
                  const handleMouseUp = (upEvent: MouseEvent) => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    setDraggingWaypoint(null);
                    
                    setNodes(prev => {
                      let nextNodes = [...prev];
                      const lineNode = nextNodes.find(n => n.id === nodeId);
                      if (lineNode) {
                        const isStart = index === 0;
                        const isEnd = (lineNode.waypoints && index === lineNode.waypoints.length - 1) || (!lineNode.waypoints && index === 1);
                        
                        if (isStart || isEnd) {
                           const pt = isStart ? lineNode.startPoint! : lineNode.endPoint!;
                           const snap = findNodeAndAnchor(pt.x, pt.y, [nodeId], upEvent.target);
                           if (snap) {
                             if (isStart) {
                               lineNode.startPoint = snap.point;
                               lineNode.startConnection = { nodeId: snap.nodeId, anchor: snap.anchor as any };
                             } else {
                               lineNode.endPoint = snap.point;
                               lineNode.endConnection = { nodeId: snap.nodeId, anchor: snap.anchor as any };
                             }
                           } else {
                             if (isStart) lineNode.startConnection = undefined;
                             if (isEnd) lineNode.endConnection = undefined;
                           }
                           
                           const minX = Math.min(lineNode.startPoint!.x, lineNode.endPoint!.x);
                           const minY = Math.min(lineNode.startPoint!.y, lineNode.endPoint!.y);
                           lineNode.position = { x: minX, y: minY };
                           lineNode.dimensions = { 
                             width: Math.max(15, Math.abs(lineNode.endPoint!.x - lineNode.startPoint!.x)),
                             height: Math.max(15, Math.abs(lineNode.endPoint!.y - lineNode.startPoint!.y))
                           };
                        }
                      }
                      
                      const finalNode = nextNodes.find(n => n.id === nodeId);
                      if (finalNode) {
                        setTimeout(() => broadcast('NODE_UPDATED', finalNode), 0);
                      }
                      return nextNodes;
                    });
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            ))}
            <RemoteCursors />

            {/* Live Drawing Preview */}
            {drawingPreview && (() => {
              const { type, startX, startY, currentX, currentY } = drawingPreview;
              const left = Math.min(startX, currentX);
              const top = Math.min(startY, currentY);
              const width = Math.abs(currentX - startX);
              const height = Math.abs(currentY - startY);

              if (type === 'pen' && drawingPreview.points && drawingPreview.points.length > 0) {
                const pts = drawingPreview.points;
                const xs = pts.map(p => p.x);
                const ys = pts.map(p => p.y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);
                const w = Math.max(1, maxX - minX);
                const h = Math.max(1, maxY - minY);
                
                const d = `M ${pts[0].x - minX} ${pts[0].y - minY} ` + pts.slice(1).map(p => `L ${p.x - minX} ${p.y - minY}`).join(' ');

                return (
                  <div style={{
                    position: 'absolute',
                    left: `${minX}px`,
                    top: `${minY}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                    pointerEvents: 'none',
                    overflow: 'visible'
                  }}>
                    <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                      <path
                        d={d}
                        fill="none"
                        stroke="#0c8ce9"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                );
              }

              if (type === 'line' || type === 'arrow' || type === 'custom-connector') {
                const minX = Math.min(startX, currentX);
                const minY = Math.min(startY, currentY);
                const w = Math.max(1, Math.abs(currentX - startX));
                const h = Math.max(1, Math.abs(currentY - startY));
                const x1 = startX - minX;
                const y1 = startY - minY;
                const x2 = currentX - minX;
                const y2 = currentY - minY;

                return (
                  <div style={{
                    position: 'absolute',
                    left: `${minX}px`,
                    top: `${minY}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                    pointerEvents: 'none',
                    overflow: 'visible'
                  }}>
                    <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                      {type === 'arrow' && (
                        <defs>
                          <marker
                            id="preview-arrowhead"
                            markerWidth="6"
                            markerHeight="5"
                            refX="5"
                            refY="2.5"
                            orient="auto"
                          >
                            <polygon points="0 0, 6 2.5, 0 5" fill="#0c8ce9" />
                          </marker>
                        </defs>
                      )}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#0c8ce9"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        markerEnd={type === 'arrow' ? "url(#preview-arrowhead)" : undefined}
                      />
                    </svg>
                  </div>
                );
              }

              // Rendering box, circle, diamond, triangle, star
              let innerElement = null;
              if (type === 'box') {
                innerElement = (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '1.5px dashed #0c8ce9',
                    backgroundColor: 'rgba(12, 140, 233, 0.1)',
                    boxSizing: 'border-box',
                    borderRadius: '4px'
                  }} />
                );
              } else if (type === 'circle') {
                innerElement = (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '1.5px dashed #0c8ce9',
                    backgroundColor: 'rgba(12, 140, 233, 0.1)',
                    boxSizing: 'border-box',
                    borderRadius: '50%'
                  }} />
                );
              } else if (type === 'diamond') {
                innerElement = (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{
                      width: '70.7%',
                      height: '70.7%',
                      transform: 'rotate(45deg)',
                      border: '1.5px dashed #0c8ce9',
                      backgroundColor: 'rgba(12, 140, 233, 0.1)',
                      boxSizing: 'border-box',
                      borderRadius: '2px'
                    }} />
                  </div>
                );
              } else if (type === 'triangle') {
                innerElement = (
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polygon
                      points="50,5 95,95 5,95"
                      fill="rgba(12, 140, 233, 0.1)"
                      stroke="#0c8ce9"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  </svg>
                );
              } else if (type === 'star') {
                innerElement = (
                  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
                    <polygon
                      points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36"
                      fill="rgba(12, 140, 233, 0.1)"
                      stroke="#0c8ce9"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  </svg>
                );
              } else if (type === 'hexagon') {
                innerElement = (
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polygon
                      points="25,5 75,5 95,50 75,95 25,95 5,50"
                      fill="rgba(12, 140, 233, 0.1)"
                      stroke="#0c8ce9"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  </svg>
                );
              } else if (type === 'parallelogram') {
                innerElement = (
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polygon
                      points="25,5 95,5 75,95 5,95"
                      fill="rgba(12, 140, 233, 0.1)"
                      stroke="#0c8ce9"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  </svg>
                );
              } else if (type === 'pill') {
                innerElement = (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '1.5px dashed #0c8ce9',
                    backgroundColor: 'rgba(12, 140, 233, 0.1)',
                    boxSizing: 'border-box',
                    borderRadius: '999px'
                  }} />
                );
              } else {
                // Fallback for box, note, database, custom-block, etc.
                innerElement = (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '1.5px dashed #0c8ce9',
                    backgroundColor: 'rgba(12, 140, 233, 0.1)',
                    boxSizing: 'border-box',
                    borderRadius: '4px'
                  }} />
                );
              }

              return (
                <div style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  pointerEvents: 'none'
                }}>
                  {innerElement}
                </div>
              );
            })()}

            {/* Smart Guides (Snap Lines) */}
            {activeSnapLines.map((line, i) => {
              if (line.axis === 'x') {
                return (
                  <div key={`snap-x-${i}`} style={{
                    position: 'absolute',
                    left: `${line.position}px`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    backgroundColor: '#ff007f', // Pink/red guide
                    zIndex: 1000,
                    pointerEvents: 'none',
                    opacity: 0.7
                  }} />
                );
              } else {
                return (
                  <div key={`snap-y-${i}`} style={{
                    position: 'absolute',
                    top: `${line.position}px`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#ff007f',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    opacity: 0.7
                  }} />
                );
              }
            })}

            {/* Marquee Selection inside scaled viewport (canvas coordinates) */}
            {marquee && isDragSelecting && (() => {
              const left = Math.min(marquee.startX, marquee.currentX);
              const top = Math.min(marquee.startY, marquee.currentY);
              const width = Math.abs(marquee.currentX - marquee.startX);
              const height = Math.abs(marquee.currentY - marquee.startY);
              
              return (
                <div 
                  className={styles.marqueeBox}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`
                  }}
                />
              );
            })()}
          </div>
        </div>
      </div>
      {/* Quick Add Shape Popup (double-click on empty canvas) */}
      {quickAdd && (
        <div
          onClick={() => setQuickAdd(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9998, background: 'transparent'
          }}
        />
      )}
      {quickAdd && (
        <div
          style={{
            position: 'fixed',
            left: `${quickAdd.x}px`,
            top: `${quickAdd.y}px`,
            zIndex: 9999,
            transform: 'translate(-50%, -110%)',
            background: 'var(--bg-surface, #1e1e1e)',
            border: '1px solid var(--border-default, #333)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '160px',
            animation: 'quickAddIn 0.15s cubic-bezier(0.4,0,0.2,1)'
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 8px 4px', fontWeight: 600, letterSpacing: '0.05em' }}>QUICK ADD</div>
          {([
            { type: 'box', label: 'Rectangle', icon: <Square size={14} /> },
            { type: 'circle', label: 'Ellipse', icon: <Circle size={14} /> },
            { type: 'diamond', label: 'Diamond', icon: <Gem size={14} /> },
            { type: 'arrow', label: 'Arrow', icon: <ArrowRight size={14} /> },
            { type: 'note', label: 'Sticky Note', icon: <StickyNote size={14} /> },
            { type: 'uml-class', label: 'UML Class', icon: <Sparkles size={14} /> },
          ] as const).map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                const { canvasX, canvasY } = quickAdd;
                const pos = { x: canvasX - 60, y: canvasY - 20 };
                if (type === 'box') addBox(pos);
                else if (type === 'circle') addCircle(pos);
                else if (type === 'diamond') addDiamond(pos);
                else if (type === 'arrow') addArrow(pos);
                else if (type === 'note') addNote(pos);
                else if (type === 'uml-class') addCustomBlock(pos);
                setQuickAdd(null);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px', borderRadius: '8px', border: 'none',
                background: 'transparent', color: 'var(--text-primary)',
                cursor: 'pointer', fontSize: '12px', width: '100%', textAlign: 'left',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.07))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ display: 'flex', alignItems: 'center', width: '14px', height: '14px' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Port Snap Visual Indicator (pulsing ring around anchor on hover during line/arrow draw) */}
      {portSnapTarget && (
        <div
          style={{
            position: 'fixed',
            left: `${portSnapTarget.screenX}px`,
            top: `${portSnapTarget.screenY}px`,
            width: '16px', height: '16px',
            borderRadius: '50%',
            background: 'rgba(12,140,233,0.25)',
            border: '2px solid #0c8ce9',
            boxShadow: '0 0 10px rgba(12,140,233,0.6)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 9997,
            animation: 'portSnapPulse 0.8s ease-in-out infinite'
          }}
        />
      )}

      {/* Floating Contextual Menu directly above the selected shape */}
      {selectedNode && (() => {
        const isLine = selectedNode.type === 'line' || selectedNode.type === 'arrow';

        return (
          <div className={styles.contextMenu}>
            <div className={styles.toolIcon}>
              {(nodeIcons as Record<string, React.ReactNode>)[currentShapeType as string] || nodeIcons['box']}
            </div>
            {/* Fill Color Picker (Only if shape) */}
            {!isLine && (
              <div className={styles.contextColorWrapper} title="Fill Color">
                <input 
                  type="color" 
                  className={styles.contextColorPicker}
                  value={selectedNode.style?.backgroundColor || '#2c2c2c'}
                  onChange={(e) => handleQuickChange('backgroundColor', e.target.value)}
                />
              </div>
            )}

            {/* Border / Line Color Picker */}
            <div className={styles.contextColorWrapper} title={isLine ? "Line Color" : "Stroke Color"}>
              <input 
                type="color" 
                className={styles.contextColorPicker}
                value={selectedNode.style?.borderColor || (isLine ? '#888888' : '#555555')}
                onChange={(e) => handleQuickChange('borderColor', e.target.value)}
              />
            </div>

            {/* Text Bold Toggle (Only if shape) */}
            {!isLine && (
              <>
                <div className={styles.divider} style={{ height: '12px' }} />
                <button 
                  className={`${styles.contextBtn} ${selectedNode.style?.fontWeight === 'bold' ? styles.contextBtnActive : ''}`}
                  onClick={() => handleQuickChange('fontWeight', selectedNode.style?.fontWeight === 'bold' ? 'normal' : 'bold')}
                  title="Toggle Bold Text"
                >
                  <Bold size={11} />
                </button>
              </>
            )}

            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Line Style Controls (Only if line) */}
            {isLine && (
              <>
                <button 
                  className={`${styles.contextBtn} ${selectedNode.routing !== 'elbow' && selectedNode.lineCurve !== 'curved' ? styles.contextBtnActive : ''}`}
                  onClick={() => handleUpdateNodeProperty('routing', 'straight')}
                  title="Straight Line"
                >
                  <Minus size={11} />
                </button>
                <button 
                  className={`${styles.contextBtn} ${selectedNode.routing === 'elbow' ? styles.contextBtnActive : ''}`}
                  onClick={() => handleUpdateNodeProperty('routing', 'elbow')}
                  title="Elbow Line"
                >
                  <CornerDownRight size={11} />
                </button>
                <button 
                  className={`${styles.contextBtn} ${selectedNode.lineCurve === 'curved' ? styles.contextBtnActive : ''}`}
                  onClick={() => handleUpdateNodeProperty('lineCurve', 'curved')}
                  title="Curved Line"
                >
                  <Activity size={11} />
                </button>
                {selectedNode.routing === 'elbow' && (
                  <button 
                    className={styles.contextBtn}
                    onClick={() => splitElbowLine(selectedNode.id)}
                    title="Split into Straight Lines"
                  >
                    <Scissors size={11} />
                  </button>
                )}
                <div className={styles.divider} style={{ height: '12px' }} />
              </>
            )}

            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Group / Ungroup (Single Node in Group) */}
            {selectedNode.groupId && (
              <>
                <button 
                  className={styles.contextBtn} 
                  onClick={ungroupSelected} 
                  title="Ungroup"
                >
                  <Unlink size={11} />
                </button>
                <div className={styles.divider} style={{ height: '12px' }} />
              </>
            )}

            {/* Z-Index Controls */}
            <button 
              className={styles.contextBtn} 
              onClick={() => bringToFront([selectedNode.id])} 
              title="Bring to Front"
            >
              <BringToFront size={11} />
            </button>
            <button 
              className={styles.contextBtn} 
              onClick={() => sendToBack([selectedNode.id])} 
              title="Send to Back"
            >
              <SendToBack size={11} />
            </button>
            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Delete Element */}
            <button 
              className={styles.contextBtn} 
              onClick={() => handleDeleteNode(selectedNode.id)} 
              title="Delete element"
              style={{ color: '#f04438' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })()}

      {/* Multi-Select Floating Contextual Menu */}
      {selectedNodeIds.length > 1 && (() => {
        const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
        if (selectedNodes.length === 0) return null;
        
        const allGrouped = selectedNodes.every(n => n.groupId) && new Set(selectedNodes.map(n => n.groupId)).size === 1;

        return (
          <div className={styles.contextMenu}>
            <div className={styles.toolIcon}>
              <Layers size={14} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '0 4px' }}>
              {selectedNodes.length}
            </span>
            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Alignment Controls */}
            <button className={styles.contextBtn} onClick={() => alignSelected('left')} title="Align Left">
              <AlignLeft size={11} />
            </button>
            <button className={styles.contextBtn} onClick={() => alignSelected('center')} title="Align Center">
              <AlignCenter size={11} />
            </button>
            <button className={styles.contextBtn} onClick={() => alignSelected('right')} title="Align Right">
              <AlignRight size={11} />
            </button>
            <button className={styles.contextBtn} onClick={() => alignSelected('top')} title="Align Top">
              <AlignStartVertical size={11} />
            </button>
            <button className={styles.contextBtn} onClick={() => alignSelected('middle')} title="Align Middle">
              <AlignVerticalSpaceAround size={11} />
            </button>
            <button className={styles.contextBtn} onClick={() => alignSelected('bottom')} title="Align Bottom">
              <AlignEndVertical size={11} />
            </button>
            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Z-Index Controls */}
            <button className={styles.contextBtn} onClick={() => bringToFront(selectedNodeIds)} title="Bring to Front">
              <BringToFront size={11} />
            </button>
            <button className={styles.contextBtn} onClick={() => sendToBack(selectedNodeIds)} title="Send to Back">
              <SendToBack size={11} />
            </button>
            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Grouping */}
            {allGrouped ? (
              <button className={styles.contextBtn} onClick={ungroupSelected} title="Ungroup">
                <Unlink size={11} />
              </button>
            ) : (
              <button className={styles.contextBtn} onClick={groupSelected} title="Group">
                <Link size={11} />
              </button>
            )}
            <div className={styles.divider} style={{ height: '12px' }} />

            {/* Delete All Selected */}
            <button 
              className={styles.contextBtn} 
              onClick={() => {
                selectedNodes.forEach(n => handleDeleteNode(n.id));
              }} 
              title="Delete elements"
              style={{ color: '#f04438' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })()}

      {/* Figma Floating Toolbar - Bottom Center (Fixed overlay inside wrapper) */}
      <div className={styles.toolbar}>
        <div className={styles.shapeSelectorContainer}>
          <button 
            className={`${styles.toolButton} ${activeTool === 'select' ? styles.toolButtonActive : ''}`}
            onClick={() => {
              setActiveTool('select');
            }}
            title={selectToolMode === 'move' ? "Move (V)" : "Scale (K)"}
          >
            {selectToolMode === 'move' ? <MousePointer2 size={15} /> : <ScalingIcon size={15} />}
          </button>
          <button
            className={`${styles.chevronButton} ${selectDropdownOpen ? styles.chevronButtonActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectDropdownOpen(!selectDropdownOpen);
            }}
            title="Select mode options"
          >
            <ChevronDown size={12} />
          </button>

          {selectDropdownOpen && (
            <div className={styles.shapeDropdown} style={{ left: 0 }} onClick={(e) => e.stopPropagation()}>
              <button
                className={`${styles.dropdownItem} ${selectToolMode === 'move' ? styles.dropdownItemActive : ''}`}
                onClick={() => {
                  setSelectToolMode('move');
                  setActiveTool('select');
                  setSelectDropdownOpen(false);
                }}
              >
                <span className={styles.dropdownItemIcon}><MousePointer2 size={14} /></span>
                <span className={styles.dropdownItemLabel}>Move</span>
                <span className={styles.dropdownItemShortcut}>V</span>
              </button>
              <button
                className={`${styles.dropdownItem} ${selectToolMode === 'scale' ? styles.dropdownItemActive : ''}`}
                onClick={() => {
                  setSelectToolMode('scale');
                  setActiveTool('select');
                  setSelectDropdownOpen(false);
                }}
              >
                <span className={styles.dropdownItemIcon}><ScalingIcon size={14} /></span>
                <span className={styles.dropdownItemLabel}>Scale</span>
                <span className={styles.dropdownItemShortcut}>K</span>
              </button>
            </div>
          )}
        </div>

        {/* Hand tool */}
        <button
          className={`${styles.toolButton} ${activeTool === 'hand' ? styles.toolButtonActive : ''}`}
          onClick={() => setActiveTool('hand')}
          title="Hand / Pan Canvas (H)"
        >
          <Hand size={15} />
        </button>

        <div className={styles.divider} />
        
        <div className={styles.shapeSelectorContainer}>
          <button
            className={`${styles.toolButton} ${['box', 'circle', 'triangle', 'star', 'pill', 'diamond', 'hexagon', 'parallelogram', 'database', 'note', 'line', 'arrow', 'custom-block', 'custom-connector'].includes(activeTool) ? styles.toolButtonActive : ''}`}
            onClick={() => setActiveTool(currentShapeType)}
            title={`Draw ${(tooltips as Record<string, string>)[currentShapeType as string] || 'Shape'} (S)`}
          >
            {(shapeIcons as Record<string, React.ReactNode>)[currentShapeType as string]}
          </button>
          <button
            className={`${styles.chevronButton} ${shapeDropdownOpen ? styles.chevronButtonActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShapeDropdownOpen(!shapeDropdownOpen);
            }}
            title="More shapes"
          >
            <ChevronDown size={12} />
          </button>

          {shapeDropdownOpen && (
            <div className={styles.shapeDropdown} onClick={(e) => e.stopPropagation()}>
              <div className={styles.dropdownColumn}>
                <div className={styles.dropdownCategory}>Basic Shapes</div>
                {['box', 'circle', 'triangle', 'star', 'pill'].map((type) => {
                  const isSelected = currentShapeType === type;
                  return (
                    <button
                      key={type}
                      className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        setCurrentShapeType(type as any);
                        setActiveTool(type);
                        setShapeDropdownOpen(false);
                      }}
                    >
                      <span className={styles.dropdownItemIcon}>{shapeIcons[type as keyof typeof shapeIcons]}</span>
                      <span className={styles.dropdownItemLabel}>{shapeLabels[type as keyof typeof shapeLabels].split(' (')[0]}</span>
                      <span className={styles.dropdownItemShortcut}>
                        {type === 'box' ? 'R' : type === 'circle' ? 'O' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              <div className={styles.columnDivider} />

              <div className={styles.dropdownColumn}>
                <div className={styles.dropdownCategory}>Flowchart</div>
                {['diamond', 'hexagon', 'parallelogram', 'database', 'note'].map((type) => {
                  const isSelected = currentShapeType === type;
                  return (
                    <button
                      key={type}
                      className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        setCurrentShapeType(type as any);
                        setActiveTool(type);
                        setShapeDropdownOpen(false);
                      }}
                    >
                      <span className={styles.dropdownItemIcon}>{shapeIcons[type as keyof typeof shapeIcons]}</span>
                      <span className={styles.dropdownItemLabel}>{shapeLabels[type as keyof typeof shapeLabels].split(' (')[0]}</span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.columnDivider} />

              <div className={styles.dropdownColumn}>
                <div className={styles.dropdownCategory}>Connectors</div>
                {['line', 'arrow'].map((type) => {
                  const isSelected = currentShapeType === type;
                  return (
                    <button
                      key={type}
                      className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        setCurrentShapeType(type as any);
                        setActiveTool(type);
                        setShapeDropdownOpen(false);
                      }}
                    >
                      <span className={styles.dropdownItemIcon}>{shapeIcons[type as keyof typeof shapeIcons]}</span>
                      <span className={styles.dropdownItemLabel}>{shapeLabels[type as keyof typeof shapeLabels].split(' (')[0]}</span>
                      <span className={styles.dropdownItemShortcut}>
                        {type === 'line' ? 'L' : type === 'arrow' ? '⇧L' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              <div className={styles.columnDivider} />

              <div className={styles.dropdownColumn}>
                <div className={styles.dropdownCategory}>Custom (AI)</div>
                {['custom-block', 'custom-connector'].map((type) => {
                  const isSelected = currentShapeType === type;
                  return (
                    <button
                      key={type}
                      className={`${styles.dropdownItem} ${styles.dropdownItemAi} ${isSelected ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        setCurrentShapeType(type as any);
                        setActiveTool(type);
                        setShapeDropdownOpen(false);
                      }}
                    >
                      <span className={styles.dropdownItemIcon}>{shapeIcons[type as keyof typeof shapeIcons]}</span>
                      <span className={styles.dropdownItemLabel}>{shapeLabels[type as keyof typeof shapeLabels].split(' (')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Pen/Pencil drawing tool */}
        <button
          className={`${styles.toolButton} ${activeTool === 'pen' ? styles.toolButtonActive : ''}`}
          onClick={() => setActiveTool('pen')}
          title="Pen / Freehand (P)"
        >
          <Pencil size={15} />
        </button>

        {/* Eraser tool */}
        <button
          className={`${styles.toolButton} ${activeTool === 'erase' ? styles.toolButtonActive : ''}`}
          onClick={() => setActiveTool('erase')}
          title="Eraser (E)"
        >
          <Eraser size={15} />
        </button>

        <div className={styles.divider} />

        {/* Standalone Comment tool - Theme consistent */}
        <button
          className={`${styles.toolButton} ${activeTool === 'comment' ? styles.toolButtonActive : ''}`}
          onClick={() => {
            setActiveTool('comment');
          }}
          title="Comment (C)"
          style={activeTool === 'comment' ? { backgroundColor: 'var(--accent-purple)' } : { color: 'var(--accent-purple)' }}
        >
          <MessageSquare size={15} />
        </button>
      </div>

      {/* Floating History HUD (Undo/Redo) - Positioned above Zoom HUD */}
      <div className={styles.historyHUD}>
        <button 
          className={styles.zoomBtn} 
          onClick={undo} 
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <Undo2 size={13} />
        </button>
        <button 
          className={styles.zoomBtn} 
          onClick={redo} 
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <Redo2 size={13} />
        </button>
      </div>

      {/* Floating Zoom HUD (Fixed overlay inside wrapper) */}
      <div className={styles.zoomHUD}>
        <button className={styles.zoomBtn} onClick={handleZoomOut} title="Zoom Out">
          <ZoomOutIcon size={10} />
        </button>
        <span className={styles.zoomLabel} onClick={handleZoomReset} title="Reset to 100%">
          {Math.round(zoom * 100)}%
        </span>
        <button className={styles.zoomBtn} onClick={handleZoomIn} title="Zoom In">
          <Plus size={10} />
        </button>
      </div>
    </div>
  );
}
