import type { DiagramNode } from '../types';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderExtendedShape, parseMarkdown } from '../features/diagram/components/ShapeRenderers';
import React from 'react';

function generateMarkdownHtml(content: string, style: React.CSSProperties): string {
  const parsed = parseMarkdown(content);
  return renderToStaticMarkup(
    React.createElement('div', { 
      style: { 
        ...style,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100%', 
        height: '100%',
        boxSizing: 'border-box'
      } 
    }, parsed as React.ReactNode)
  );
}

export function generateExportCode(nodes: DiagramNode[]): string {
  let html = `<div style="position: relative; width: 1080px; height: 600px; border: 1px solid #ccc; background-color: #ffffff;">\n`;

  nodes.forEach((node) => {
    if (node.type === 'diamond') {
      const bg = node.style?.backgroundColor || '#fff3cd';
      const border = node.style?.borderColor || '#ffc107';
      const color = node.style?.color || '#000000';
      const fontSize = node.style?.fontSize || '11px';
      const fontWeight = node.style?.fontWeight || 'normal';
      const fontFamily = node.style?.fontFamily || 'sans-serif';
      const textAlign = node.style?.textAlign || 'center';
      
      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; display: flex; align-items: center; justify-content: center; font-family: ${fontFamily}; z-index: 5;">\n`;
      html += `    <div style="width: 100%; height: 100%; background-color: ${bg}; border: 2px solid ${border}; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); display: flex; align-items: center; justify-content: center; box-sizing: border-box;">\n`;
      html += `      <div style="text-align: ${textAlign}; color: ${color}; font-size: ${fontSize}; word-wrap: break-word; padding: 16px;">\n`;
      html += `        ${generateMarkdownHtml(node.content || '', { color, fontSize, fontWeight, textAlign: textAlign as any, fontFamily })}\n`;
      html += `      </div>\n`;
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else if (node.type === 'circle') {
      const bg = node.style?.backgroundColor || '#f1f5f9';
      const border = node.style?.borderColor || '#64748b';
      const color = node.style?.color || '#000000';
      const fontSize = node.style?.fontSize || '11px';
      const fontWeight = node.style?.fontWeight || 'normal';
      const fontFamily = node.style?.fontFamily || 'sans-serif';
      const textAlign = node.style?.textAlign || 'center';
      
      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; display: flex; align-items: center; justify-content: center; font-family: ${fontFamily}; z-index: 5;">\n`;
      html += `    <div style="width: 100%; height: 100%; border-radius: 50%; border: 2px solid ${border}; background-color: ${bg}; transform: rotate(${node.rotation || 0}deg); display: flex; align-items: center; justify-content: center; box-sizing: border-box;">\n`;
      html += `      <div style="text-align: ${textAlign}; color: ${color}; font-size: ${fontSize}; word-wrap: break-word; padding: 8px;">\n`;
      html += `        ${generateMarkdownHtml(node.content || '', { color, fontSize, fontWeight, textAlign: textAlign as any, fontFamily })}\n`;
      html += `      </div>\n`;
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else if (node.type === 'triangle') {
      const bg = node.style?.backgroundColor || '#f0fdf4';
      const border = node.style?.borderColor || '#16a34a';
      const color = node.style?.color || '#000000';
      const fontSize = node.style?.fontSize || '11px';
      const fontWeight = node.style?.fontWeight || 'normal';
      const fontFamily = node.style?.fontFamily || 'sans-serif';
      const textAlign = node.style?.textAlign || 'center';
      
      const r = parseInt(node.style?.borderRadius || '0', 10);
      const s = Math.max(0, Math.min(25, r * 0.5));
      const p1x = 50 - s * 0.45, p1y = 3 + s * 0.90;
      const p2x = 50 + s * 0.45, p2y = 3 + s * 0.90;
      const p3x = 97 - s * 0.45, p3y = 97 - s * 0.90;
      const p4x = 97 - s, p4y = 97;
      const p5x = 3 + s, p5y = 97;
      const p6x = 3 + s * 0.45, p6y = 97 - s * 0.90;
      
      const pathData = `M ${p1x} ${p1y} Q 50 3 ${p2x} ${p2y} L ${p3x} ${p3y} Q 97 97 ${p4x} ${p4y} L ${p5x} ${p5y} Q 3 97 ${p6x} ${p6y} Z`;

      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; transform: rotate(${node.rotation || 0}deg); z-index: 5;">\n`;
      html += `    <div style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;">\n`;
      html += `      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="display: block;">\n`;
      html += `        <path d="${pathData}" fill="${bg}" stroke="${border}" stroke-width="2.5" vector-effect="non-scaling-stroke" />\n`;
      html += `      </svg>\n`;
      html += `    </div>\n`;
      html += `    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: ${fontFamily}; pointer-events: none;">\n`;
      html += `      <div style="text-align: ${textAlign}; color: ${color}; font-size: ${fontSize}; word-wrap: break-word; padding: 30px 15px 15px 15px;">\n`;
      html += `        ${generateMarkdownHtml(node.content || '', { color, fontSize, fontWeight, textAlign: textAlign as any, fontFamily })}\n`;
      html += `      </div>\n`;
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else if (node.type === 'custom-block') {
      const bg = node.style?.background || node.style?.backgroundColor || '#2c2c2c';
      const borderWidth = node.style?.borderWidth || '1.5px';
      const borderStyle = node.style?.borderStyle || 'solid';
      const borderColor = node.style?.borderColor || '#555555';
      const borderRadius = node.style?.borderRadius || '0px';
      const clipPath = node.style?.clipPath || 'none';
      const backdropFilter = node.style?.backdropFilter || 'none';
      const boxShadow = node.style?.boxShadow || 'none';
      const display = node.content ? 'flex' : 'block';
      const alignItems = node.content ? 'align-items: center;' : '';
      const justifyContent = node.content ? 'justify-content: center;' : '';
      const padding = node.content ? '8px' : '0px';
      const customCss = node.style?.customCss || '';
      
      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; z-index: 5;">\n`;
      html += `    <div style="width: 100%; height: 100%; transform: rotate(${node.rotation || 0}deg); background: ${bg}; border: ${borderWidth} ${borderStyle} ${borderColor}; border-radius: ${borderRadius}; clip-path: ${clipPath}; backdrop-filter: ${backdropFilter}; box-shadow: ${boxShadow}; display: ${display}; ${alignItems} ${justifyContent} box-sizing: border-box; padding: ${padding}; ${customCss}">\n`;
      if (node.content) {
        const color = node.style?.color || '#e3e3e3';
        const fontSize = node.style?.fontSize || '11px';
        const fontWeight = node.style?.fontWeight || 'normal';
        const textAlign = node.style?.textAlign || 'center';
        html += `      <div style="color: ${color}; font-size: ${fontSize}; font-weight: ${fontWeight}; text-align: ${textAlign}; word-wrap: break-word; width: 100%; pointer-events: none;">\n`;
        html += `        ${generateMarkdownHtml(node.content || '', { color, fontSize, fontWeight, textAlign: textAlign as any, fontFamily: 'sans-serif' })}\n`;
        html += `      </div>\n`;
      }
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else if (node.type === 'custom-connector') {
      const startX = node.startPoint!.x - node.position.x;
      const startY = node.startPoint!.y - node.position.y;
      const endX = node.endPoint!.x - node.position.x;
      const endY = node.endPoint!.y - node.position.y;
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);

      const connectorStyle = node.customConnectorStyle || {};
      const lineCss = connectorStyle.lineCss || '';
      const startMarkerCss = connectorStyle.startMarkerCss || '';
      const endMarkerCss = connectorStyle.endMarkerCss || '';

      const defaultBorderWidth = node.style?.borderWidth || '2px';
      const defaultBorderStyle = node.style?.borderStyle || 'dashed';
      const defaultBorderColor = node.style?.borderColor || '#e74c3c';
      
      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; z-index: 5;">\n`;
      html += `    <div style="position: relative; width: 100%; height: 100%;">\n`;
      html += `      <div style="position: absolute; left: ${startX}px; top: ${startY}px; width: ${length}px; border-top: ${defaultBorderWidth} ${defaultBorderStyle} ${defaultBorderColor}; transform: rotate(${angle}deg); transform-origin: 0 0; pointer-events: none; ${lineCss}"></div>\n`;
      
      if (startMarkerCss) {
        html += `      <div style="position: absolute; left: ${startX}px; top: ${startY}px; pointer-events: none; ${startMarkerCss}"></div>\n`;
      }
      
      if (endMarkerCss) {
        html += `      <div style="position: absolute; left: ${endX}px; top: ${endY}px; pointer-events: none; ${endMarkerCss}"></div>\n`;
      } else {
        html += `      <div style="position: absolute; left: ${endX}px; top: ${endY}px; width: 0; height: 0; border-left: calc(12px * 0.6) solid transparent; border-right: calc(12px * 0.6) solid transparent; border-bottom: 12px solid ${defaultBorderColor}; transform: translate(-50%, -50%) rotate(${angle + 90}deg); pointer-events: none;"></div>\n`;
      }
      
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else if (node.type === 'line' || node.type === 'arrow') {
      const color = node.style?.borderColor || (node.type === 'line' ? '#475569' : '#0284c7');
      const startX = node.startPoint!.x - node.position.x;
      const startY = node.startPoint!.y - node.position.y;
      const endX = node.endPoint!.x - node.position.x;
      const endY = node.endPoint!.y - node.position.y;

      const effectiveArrowType = node.arrowType || (node.type === 'arrow' ? 'single' : 'none');
      const dashStr = node.lineStyle === 'dashed' ? ' stroke-dasharray="8 6"' : '';

      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; z-index: 5;">\n`;
      html += `    <svg width="100%" height="100%" style="overflow: visible; display: block;">\n`;
      html += `      <defs>\n`;
      html += `        <marker id="arrowhead-end-${node.id}" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">\n`;
      if (node.arrowHead === 'hollow') {
        html += `          <polygon points="0 0, 6 2.5, 0 5" fill="#ffffff" stroke="${color}" stroke-width="1" />\n`;
      } else if (node.arrowHead === 'open') {
        html += `          <polyline points="0 0, 5 2.5, 0 5" fill="none" stroke="${color}" stroke-width="1.5" />\n`;
      } else if (node.arrowHead === 'diamond-filled') {
        html += `          <polygon points="0 2.5, 3 0, 6 2.5, 3 5" fill="${color}" />\n`;
      } else if (node.arrowHead === 'diamond-hollow') {
        html += `          <polygon points="0 2.5, 3 0, 6 2.5, 3 5" fill="#ffffff" stroke="${color}" stroke-width="1" />\n`;
      } else if (node.arrowHead === 'circle') {
        html += `          <circle cx="3" cy="2.5" r="2.5" fill="#ffffff" stroke="${color}" stroke-width="1" />\n`;
      } else {
        html += `          <polygon points="0 0, 6 2.5, 0 5" fill="${color}" />\n`;
      }
      html += `        </marker>\n`;

      html += `        <marker id="arrowhead-start-${node.id}" markerWidth="6" markerHeight="5" refX="1" refY="2.5" orient="auto">\n`;
      if (node.arrowTail === 'hollow') {
        html += `          <polygon points="6 0, 0 2.5, 6 5" fill="#ffffff" stroke="${color}" stroke-width="1" />\n`;
      } else if (node.arrowTail === 'open') {
        html += `          <polyline points="6 0, 1 2.5, 6 5" fill="none" stroke="${color}" stroke-width="1.5" />\n`;
      } else if (node.arrowTail === 'diamond-filled') {
        html += `          <polygon points="6 2.5, 3 0, 0 2.5, 3 5" fill="${color}" />\n`;
      } else if (node.arrowTail === 'diamond-hollow') {
        html += `          <polygon points="6 2.5, 3 0, 0 2.5, 3 5" fill="#ffffff" stroke="${color}" stroke-width="1" />\n`;
      } else if (node.arrowTail === 'circle') {
        html += `          <circle cx="3" cy="2.5" r="2.5" fill="#ffffff" stroke="${color}" stroke-width="1" />\n`;
      } else {
        html += `          <polygon points="6 0, 0 2.5, 6 5" fill="${color}" />\n`;
      }
      html += `        </marker>\n`;
      html += `      </defs>\n`;

      const startAnchor = node.startConnection?.anchor;
      const endAnchor = node.endConnection?.anchor;
      const isStartHoriz = startAnchor === 'left' || startAnchor === 'right';
      const isStartVert = startAnchor === 'top' || startAnchor === 'bottom';
      const isEndHoriz = endAnchor === 'left' || endAnchor === 'right';
      const isEndVert = endAnchor === 'top' || endAnchor === 'bottom';
      const isPerpendicular = (isStartHoriz && isEndVert) || (isStartVert && isEndHoriz);
      
      if (node.waypoints && node.waypoints.length > 0) {
        const pathData = `M ${startX} ${startY} ` + node.waypoints.map(w => `L ${w.x - node.position.x} ${w.y - node.position.y}`).join(' ') + ` L ${endX} ${endY}`;
        const startMarkerStr = effectiveArrowType === 'double' ? ` marker-start="url(#arrowhead-start-${node.id})"` : '';
        const endMarkerStr = (effectiveArrowType === 'single' || effectiveArrowType === 'double') ? ` marker-end="url(#arrowhead-end-${node.id})"` : '';
        html += `      <path d="${pathData}" stroke="${color}" stroke-width="2" fill="none"${dashStr}${startMarkerStr}${endMarkerStr} />\n`;
      } else if (node.routing === 'elbow') {
        const midX = (startX + endX) / 2;
        const isVerticalElbow = isStartVert || !startAnchor;
        const midY = (startY + endY) / 2;
        let elbowPath = '';
        
        if (isPerpendicular) {
          if (isStartHoriz) {
            elbowPath = `M ${startX} ${startY} L ${endX} ${startY} L ${endX} ${endY}`;
          } else {
            elbowPath = `M ${startX} ${startY} L ${startX} ${endY} L ${endX} ${endY}`;
          }
        } else {
          elbowPath = isVerticalElbow 
            ? `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`
            : `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
        }
          
        const startMarkerStr = effectiveArrowType === 'double' ? ` marker-start="url(#arrowhead-start-${node.id})"` : '';
        const endMarkerStr = (effectiveArrowType === 'single' || effectiveArrowType === 'double') ? ` marker-end="url(#arrowhead-end-${node.id})"` : '';

        html += `      <path d="${elbowPath}" stroke="${color}" stroke-width="2" fill="none"${dashStr}${startMarkerStr}${endMarkerStr} />\n`;
      } else if (node.lineCurve === 'curved') {
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

        const startMarkerStr = effectiveArrowType === 'double' ? ` marker-start="url(#arrowhead-start-${node.id})"` : '';
        const endMarkerStr = (effectiveArrowType === 'single' || effectiveArrowType === 'double') ? ` marker-end="url(#arrowhead-end-${node.id})"` : '';

        html += `      <path d="M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}" stroke="${color}" stroke-width="2" fill="none"${dashStr}${startMarkerStr}${endMarkerStr} />\n`;
      } else {
        const startMarkerStr = effectiveArrowType === 'double' ? ` marker-start="url(#arrowhead-start-${node.id})"` : '';
        const endMarkerStr = (effectiveArrowType === 'single' || effectiveArrowType === 'double') ? ` marker-end="url(#arrowhead-end-${node.id})"` : '';

        html += `      <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="2"${dashStr}${startMarkerStr}${endMarkerStr} />\n`;
      }

      html += `    </svg>\n`;

      if (node.label) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        html += `    <div style="position: absolute; left: ${midX}px; top: ${midY}px; transform: translate(-50%, -50%); background: #ffffff; padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; color: #333; z-index: 10; font-family: sans-serif;">\n`;
        html += `      ${node.label}\n`;
        html += `    </div>\n`;
      }

      html += `  </div>\n`;
    } else if (node.type === 'group-frame') {
      const title = node.groupTitle || '';
      const titleHeight = 24;
      const colorHex = node.groupColor || '#0c8ce9';
      
      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; border: 2px dashed ${colorHex}; border-radius: 4px; z-index: 1; box-sizing: border-box;">\n`;
      html += `    <div style="width: 100%; height: ${titleHeight}px; background-color: ${colorHex}22; border-bottom: 2px dashed ${colorHex}; display: flex; align-items: center; justify-content: center; font-family: sans-serif; font-size: 12px; font-weight: bold; color: ${colorHex}; box-sizing: border-box;">\n`;
      html += `      ${title}\n`;
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else if (['star', 'pill', 'hexagon', 'parallelogram', 'database', 'note'].includes(node.type)) {
      const bg = node.style?.backgroundColor || '#ffffff';
      const border = node.style?.borderColor || '#000000';
      const color = node.style?.color || '#000000';
      const fontSize = node.style?.fontSize || '11px';
      const fontWeight = node.style?.fontWeight || 'normal';
      const fontFamily = node.style?.fontFamily || 'sans-serif';
      const textAlign = node.style?.textAlign || 'center';
      
      let innerSvg = '';
      if (node.type === 'pill') {
        innerSvg = `<rect x="0" y="0" width="100%" height="100%" rx="50%" fill="${bg}" stroke="${border}" stroke-width="3" />`;
      } else if (node.type === 'star') {
        innerSvg = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'hexagon') {
        innerSvg = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="25,5 75,5 100,50 75,95 25,95 0,50" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'parallelogram') {
        innerSvg = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="20,5 100,5 80,95 0,95" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'database') {
        innerSvg = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 5,20 C 5,10 95,10 95,20 L 95,80 C 95,90 5,90 5,80 Z" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" />
          <path d="M 5,20 C 5,30 95,30 95,20" fill="none" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>`;
      } else if (node.type === 'note') {
        innerSvg = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="0,0 100,0 100,85 85,100 0,100" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" />
          <polygon points="100,85 85,85 85,100" fill="rgba(0,0,0,0.05)" stroke="${border}" stroke-width="1" vector-effect="non-scaling-stroke" />
        </svg>`;
      }

      html += `  <div style="position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; transform: rotate(${node.rotation || 0}deg); z-index: 5;">\n`;
      html += `    <div style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;">\n`;
      html += `      ${innerSvg}\n`;
      html += `    </div>\n`;
      html += `    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: ${fontFamily}; pointer-events: none;">\n`;
      html += `      <div style="text-align: ${textAlign}; color: ${color}; font-size: ${fontSize}; word-wrap: break-word; padding: 15px;">\n`;
      html += `        ${generateMarkdownHtml(node.content || '', { color, fontSize, fontWeight, textAlign: textAlign as any, fontFamily })}\n`;
      html += `      </div>\n`;
      html += `    </div>\n`;
      html += `  </div>\n`;
    } else {
      const extendedShape = renderExtendedShape({
        node,
        textStyle: {
          color: node.style?.color || '#e3e3e3',
          fontSize: node.style?.fontSize || '11px',
          fontWeight: node.style?.fontWeight || 'normal',
          textAlign: (node.style?.textAlign as any) || 'center',
          width: '100%',
          wordBreak: 'break-word',
        },
        shadowFilter: 'none'
      });

      if (extendedShape) {
        const innerHtml = renderToStaticMarkup(extendedShape);
        let wrapperStyle = `position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; box-sizing: border-box; z-index: 5;`;
        if (node.rotation) {
          wrapperStyle += ` transform: rotate(${node.rotation}deg);`;
        }
        html += `  <div style="${wrapperStyle}">\n    ${innerHtml}\n  </div>\n`;
      } else {
        let styleStr = `position: absolute; left: ${node.position.x}px; top: ${node.position.y}px; width: ${node.dimensions.width}px; height: ${node.dimensions.height}px; box-sizing: border-box; z-index: 5; `;
        
        const fontFamily = node.style?.fontFamily || 'sans-serif';
        const fontWeight = node.style?.fontWeight || 'normal';
        const textAlign = node.style?.textAlign || 'center';
        
        if (node.style) {
          if (node.style.backgroundColor) styleStr += `background-color: ${node.style.backgroundColor}; `;
          if (node.style.borderColor) styleStr += `border: 2px solid ${node.style.borderColor}; `;
          if (node.style.color) styleStr += `color: ${node.style.color}; `;
          if (node.style.fontSize) styleStr += `font-size: ${node.style.fontSize}; `;
          styleStr += `border-radius: ${node.style.borderRadius || '4px'}; `;
          styleStr += `transform: rotate(${node.rotation || 0}deg); `;
          styleStr += `display: flex; align-items: center; justify-content: center; font-family: ${fontFamily}; `;
        } else {
          styleStr += `background-color: #f0f0f0; border: 2px solid #333; border-radius: 4px; transform: rotate(${node.rotation || 0}deg); display: flex; align-items: center; justify-content: center; font-family: sans-serif; `;
        }
        
        html += `  <div style="${styleStr.trim()}">\n    ${generateMarkdownHtml(node.content || '', { color: node.style?.color || '#000000', fontSize: node.style?.fontSize || '11px', fontWeight, textAlign: textAlign as any, fontFamily })}\n  </div>\n`;
      }
    }
  });

  html += `</div>`;

  return html;
}
