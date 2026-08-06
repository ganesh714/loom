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
      if (node.lineCurve === 'curved') {
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

      if (node.type === 'circle') {
        const cx = node.position.x + node.dimensions.width / 2;
        const cy = node.position.y + node.dimensions.height / 2;
        const rx = node.dimensions.width / 2;
        const ry = node.dimensions.height / 2;
        shapeSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />`;
      } else if (node.type === 'diamond') {
        const cx = node.position.x + node.dimensions.width / 2;
        const cy = node.position.y + node.dimensions.height / 2;
        shapeSvg = `<polygon points="${cx},${node.position.y} ${node.position.x + node.dimensions.width},${cy} ${cx},${node.position.y + node.dimensions.height} ${node.position.x},${cy}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />`;
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
