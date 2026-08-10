import type { DiagramNode } from '../types';
import { parseMarkdown } from '../features/diagram/components/ShapeRenderers';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

function getBoundingBox(nodes: DiagramNode[]) {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    if (n.type === 'line' || n.type === 'arrow') {
      if (n.startPoint) {
        minX = Math.min(minX, n.startPoint.x);
        minY = Math.min(minY, n.startPoint.y);
        maxX = Math.max(maxX, n.startPoint.x);
        maxY = Math.max(maxY, n.startPoint.y);
      }
      if (n.endPoint) {
        minX = Math.min(minX, n.endPoint.x);
        minY = Math.min(minY, n.endPoint.y);
        maxX = Math.max(maxX, n.endPoint.x);
        maxY = Math.max(maxY, n.endPoint.y);
      }
    } else {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + n.dimensions.width);
      maxY = Math.max(maxY, n.position.y + n.dimensions.height);
    }
  });

  return { minX, minY, maxX, maxY };
}

function getStrokeDasharray(style: string | undefined): string {
  if (style === 'dashed') return '5,5';
  if (style === 'dotted') return '2,2';
  return 'none';
}

function generateMarkdownHtml(content: string, style: React.CSSProperties): string {
  const parsed = parseMarkdown(content);
  // Render the parsed React nodes to static HTML
  const staticHtml = renderToStaticMarkup(
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
  return staticHtml;
}

export function generateSvgExport(nodes: DiagramNode[], bgColor: string = '#1e1e1e'): string {
  const padding = 50;
  const { minX, minY, maxX, maxY } = getBoundingBox(nodes);
  
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const viewBox = `${minX - padding} ${minY - padding} ${width} ${height}`;

  let svgElements = '';

  nodes.forEach(node => {
    const isLine = node.type === 'line' || node.type === 'arrow';
    if (isLine && node.startPoint && node.endPoint) {
      const color = node.style?.borderColor || '#555555';
      const strokeWidth = node.style?.borderWidth ? parseInt(node.style.borderWidth) : 2;
      const strokeDash = getStrokeDasharray(node.lineStyle);

      let pathData = '';
      if (node.waypoints && node.waypoints.length > 0) {
        pathData = `M ${node.startPoint.x} ${node.startPoint.y} ` + node.waypoints.map(w => `L ${w.x} ${w.y}`).join(' ') + ` L ${node.endPoint.x} ${node.endPoint.y}`;
      } else if (node.routing === 'elbow') {
        const startAnchor = node.startConnection?.anchor;
        const endAnchor = node.endConnection?.anchor;
        const isStartHoriz = startAnchor === 'left' || startAnchor === 'right';
        const isStartVert = startAnchor === 'top' || startAnchor === 'bottom';
        const isEndHoriz = endAnchor === 'left' || endAnchor === 'right';
        const isEndVert = endAnchor === 'top' || endAnchor === 'bottom';
        const isPerpendicular = (isStartHoriz && isEndVert) || (isStartVert && isEndHoriz);
        
        const midX = (node.startPoint.x + node.endPoint.x) / 2;
        const midY = (node.startPoint.y + node.endPoint.y) / 2;
        const isVerticalElbow = isStartVert || !startAnchor;
        
        if (isPerpendicular) {
          if (isStartHoriz) {
            pathData = `M ${node.startPoint.x} ${node.startPoint.y} L ${node.endPoint.x} ${node.startPoint.y} L ${node.endPoint.x} ${node.endPoint.y}`;
          } else {
            pathData = `M ${node.startPoint.x} ${node.startPoint.y} L ${node.startPoint.x} ${node.endPoint.y} L ${node.endPoint.x} ${node.endPoint.y}`;
          }
        } else {
          pathData = isVerticalElbow 
            ? `M ${node.startPoint.x} ${node.startPoint.y} L ${node.startPoint.x} ${midY} L ${node.endPoint.x} ${midY} L ${node.endPoint.x} ${node.endPoint.y}`
            : `M ${node.startPoint.x} ${node.startPoint.y} L ${midX} ${node.startPoint.y} L ${midX} ${node.endPoint.y} L ${node.endPoint.x} ${node.endPoint.y}`;
        }
      } else if (node.lineCurve === 'curved') {
        const cx1 = node.startPoint.x + (node.endPoint.x - node.startPoint.x) / 2;
        const cy1 = node.startPoint.y;
        const cx2 = node.startPoint.x + (node.endPoint.x - node.startPoint.x) / 2;
        const cy2 = node.endPoint.y;
        pathData = `M ${node.startPoint.x} ${node.startPoint.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${node.endPoint.x} ${node.endPoint.y}`;
      } else {
        pathData = `M ${node.startPoint.x} ${node.startPoint.y} L ${node.endPoint.x} ${node.endPoint.y}`;
      }

      svgElements += `  <path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />\n`;

      if (node.type === 'arrow') {
        const dx = node.endPoint.x - node.startPoint.x;
        const dy = node.endPoint.y - node.startPoint.y;
        const angle = Math.atan2(dy, dx);
        
        // Simple arrow head
        const headLength = 10;
        const p1x = node.endPoint.x - headLength * Math.cos(angle - Math.PI / 6);
        const p1y = node.endPoint.y - headLength * Math.sin(angle - Math.PI / 6);
        const p2x = node.endPoint.x - headLength * Math.cos(angle + Math.PI / 6);
        const p2y = node.endPoint.y - headLength * Math.sin(angle + Math.PI / 6);
        
        svgElements += `  <polygon points="${node.endPoint.x},${node.endPoint.y} ${p1x},${p1y} ${p2x},${p2y}" fill="${color}" />\n`;
      }
    } else {
      const bg = node.style?.backgroundColor || '#ffffff';
      const border = node.style?.borderColor || '#000000';
      const strokeWidth = node.style?.borderWidth ? parseInt(node.style.borderWidth) : 2;
      const strokeDash = getStrokeDasharray(node.style?.borderStyle);
      const color = node.style?.color || '#000000';
      const fontSize = node.style?.fontSize || '11px';
      const fontFamily = node.style?.fontFamily || 'sans-serif';
      const fontWeight = node.style?.fontWeight || 'normal';
      const textAlign = node.style?.textAlign || 'center';

      let shapeSvg = '';

      if (node.type === 'group-frame') {
        const title = node.groupTitle || '';
        const titleHeight = 24;
        const colorHex = node.groupColor || '#0c8ce9';
        shapeSvg = `<rect x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" fill="transparent" stroke="${colorHex}" stroke-width="2" stroke-dasharray="8,4" />
                    <rect x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${titleHeight}" fill="${colorHex}22" />
                    <text x="${node.position.x + node.dimensions.width / 2}" y="${node.position.y + 16}" font-family="${fontFamily}" font-size="12" font-weight="bold" fill="${colorHex}" text-anchor="middle">${title}</text>`;
        
        svgElements += `  <g>\n    ${shapeSvg}\n  </g>\n`;
        return; // skip the rest of the node rendering for group-frame
      } else if (node.type === 'circle') {
        const cx = node.position.x + node.dimensions.width / 2;
        const cy = node.position.y + node.dimensions.height / 2;
        const rx = node.dimensions.width / 2;
        const ry = node.dimensions.height / 2;
        shapeSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />`;
      } else if (node.type === 'diamond') {
        const cx = node.position.x + node.dimensions.width / 2;
        const cy = node.position.y + node.dimensions.height / 2;
        shapeSvg = `<polygon points="${cx},${node.position.y} ${node.position.x + node.dimensions.width},${cy} ${cx},${node.position.y + node.dimensions.height} ${node.position.x},${cy}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />`;
      } else if (node.type === 'pill') {
        const rx = node.dimensions.height / 2;
        shapeSvg = `<rect x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" rx="${rx}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />`;
      } else if (node.type === 'triangle') {
        shapeSvg = `<svg x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,3 97,97 3,97" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'star') {
        shapeSvg = `<svg x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'hexagon') {
        shapeSvg = `<svg x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="25,5 75,5 100,50 75,95 25,95 0,50" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'parallelogram') {
        shapeSvg = `<svg x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="20,5 100,5 80,95 0,95" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
      } else if (node.type === 'database') {
        shapeSvg = `<svg x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 5,20 C 5,10 95,10 95,20 L 95,80 C 95,90 5,90 5,80 Z" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" />
          <path d="M 5,20 C 5,30 95,30 95,20" fill="none" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>`;
      } else if (node.type === 'note') {
        shapeSvg = `<svg x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="0,0 100,0 100,85 85,100 0,100" fill="${bg}" stroke="${border}" stroke-width="2" vector-effect="non-scaling-stroke" />
          <polygon points="100,85 85,85 85,100" fill="rgba(0,0,0,0.05)" stroke="${border}" stroke-width="1" vector-effect="non-scaling-stroke" />
        </svg>`;
      } else {
        // default rectangle/rounded-rect
        const rx = node.type === 'rounded-rect' ? 12 : 0;
        shapeSvg = `<rect x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}" rx="${rx}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />`;
      }

      svgElements += `  <g transform="rotate(${node.rotation || 0} ${node.position.x + node.dimensions.width/2} ${node.position.y + node.dimensions.height/2})">\n`;
      svgElements += `    ${shapeSvg}\n`;
      
      if (node.content) {
        // Using foreignObject for accurate text wrapping and Markdown support
        const htmlContent = generateMarkdownHtml(node.content, {
          color, fontSize, fontFamily, fontWeight, textAlign: textAlign as any,
          padding: '8px'
        });
        
        svgElements += `    <foreignObject x="${node.position.x}" y="${node.position.y}" width="${node.dimensions.width}" height="${node.dimensions.height}">\n`;
        svgElements += `      <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">\n`;
        svgElements += `        ${htmlContent}\n`;
        svgElements += `      </div>\n`;
        svgElements += `    </foreignObject>\n`;
      }
      svgElements += `  </g>\n`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" style="background-color: ${bgColor};">\n${svgElements}</svg>`;
}
