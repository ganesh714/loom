import React from 'react';
import type { DiagramNode } from '@/types';
import { getSemanticStyle } from '../../../utils/semanticStyles';

export function parseMarkdown(text: string): React.ReactNode {
  if (!text) return '';
  
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|_.*?_)/g;
  const parts = text.split(regex);
  
  return parts.reduce<React.ReactNode[]>((acc, part, index) => {
    if (part === '') return acc;
    
    if (part.startsWith('**') && part.endsWith('**')) {
      acc.push(<strong key={index}>{part.slice(2, -2)}</strong>);
    } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      acc.push(<em key={index}>{part.slice(1, -1)}</em>);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      acc.push(
        <code key={index} style={{
          fontFamily: 'monospace',
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '90%'
        }}>
          {part.slice(1, -1)}
        </code>
      );
    } else {
      const lines = part.split('\n');
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
          acc.push(<br key={`${index}-br-${lineIndex}`} />);
        }
        if (line) {
          acc.push(<React.Fragment key={`${index}-${lineIndex}`}>{line}</React.Fragment>);
        }
      });
    }
    
    return acc;
  }, []);
}

interface ShapeRendererProps {
  node: DiagramNode;
  textStyle: React.CSSProperties;
  shadowFilter: string;
}

export function renderExtendedShape({ node, textStyle, shadowFilter }: ShapeRendererProps) {
  // Merge user style with semantic style
  const semanticStyle = getSemanticStyle(node.tag);
  const bgColor = node.style?.backgroundColor || semanticStyle.backgroundColor || '#2c2c2c';
  const borderColor = node.style?.borderColor || semanticStyle.borderColor || '#555555';
  const borderStyle = node.style?.borderStyle || semanticStyle.borderStyle || 'solid';
  const color = node.style?.color || semanticStyle.color || textStyle.color;

  const mergedTextStyle = { ...textStyle, color };
  const content = parseMarkdown(node.content);

  switch (node.type) {
    case 'rounded-rect':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', padding: '8px', boxShadow: node.style?.boxShadow || 'none'
        }}>
          <div style={mergedTextStyle}>{content}</div>
        </div>
      );
    case 'terminator':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', padding: '8px 20px', boxShadow: node.style?.boxShadow || 'none'
        }}>
          <div style={mergedTextStyle}>{content}</div>
        </div>
      );
    case 'process':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', padding: '8px', boxShadow: node.style?.boxShadow || 'none'
        }}>
          <div style={mergedTextStyle}>{content}</div>
        </div>
      );
    case 'uml-class':
    case 'uml-interface':
    case 'uml-abstract':
    case 'uml-enum':
      const isInterface = node.type === 'uml-interface' || node.tag === 'interface';
      const isAbstract = node.type === 'uml-abstract' || node.tag === 'abstract';
      const actualBorderStyle = (isInterface || node.style?.borderStyle === 'dashed') ? 'dashed' : 'solid';
      
      const stereotypeMap: Record<string, string> = {
        'uml-interface': '<<Interface>>',
        'uml-enum': '<<Enum>>',
        'uml-abstract': '<<Abstract>>'
      };
      
      const defaultStereotype = stereotypeMap[node.type];
      const stereotype = node.stereotype || defaultStereotype;

      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `2px ${actualBorderStyle} ${borderColor}`,
          borderRadius: '4px', display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box', boxShadow: node.style?.boxShadow || 'none',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '8px', borderBottom: (node.sections && node.sections.length > 0) ? `1px solid ${borderColor}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
            {stereotype && <div style={{ fontSize: '9px', fontWeight: 'bold', opacity: 0.8, color }}>{stereotype}</div>}
            <div style={{ ...mergedTextStyle, fontStyle: isAbstract ? 'italic' : 'normal', fontWeight: 'bold', paddingTop: stereotype ? '4px' : '0' }}>{content}</div>
          </div>
          
          {/* Sections */}
          {node.sections?.map((section, idx) => (
            <div key={idx} style={{ padding: '6px 8px', borderBottom: idx < node.sections!.length - 1 ? `1px solid ${borderColor}` : 'none', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              {section.title && <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '4px', color, opacity: 0.7 }}>{section.title}</div>}
              {section.items.map((item, i) => (
                <div key={i} style={{ ...mergedTextStyle, textAlign: 'left', fontSize: '10px', padding: '1px 0' }}>{item}</div>
              ))}
            </div>
          ))}
        </div>
      );
    case 'actor':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
            {/* Head */}
            <circle cx="50" cy="20" r="15" fill={bgColor} stroke={borderColor} strokeWidth="3" />
            {/* Body */}
            <line x1="50" y1="35" x2="50" y2="70" stroke={borderColor} strokeWidth="3" />
            {/* Arms */}
            <line x1="20" y1="45" x2="80" y2="45" stroke={borderColor} strokeWidth="3" />
            {/* Legs */}
            <line x1="50" y1="70" x2="25" y2="95" stroke={borderColor} strokeWidth="3" />
            <line x1="50" y1="70" x2="75" y2="95" stroke={borderColor} strokeWidth="3" />
          </svg>
          <div style={{ position: 'absolute', bottom: '-20px', left: 0, width: '100%', textAlign: 'center' }}>
            <div style={{ ...mergedTextStyle, padding: '2px' }}>{content}</div>
          </div>
        </div>
      );
    case 'use-case':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', padding: '12px 24px', boxShadow: node.style?.boxShadow || 'none'
        }}>
          <div style={mergedTextStyle}>{content}</div>
        </div>
      );
    case 'component':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
            <rect x="10" y="0" width="calc(100% - 10px)" height="100%" fill={bgColor} stroke={borderColor} strokeWidth="2" />
            <rect x="0" y="20%" width="20" height="15%" fill={bgColor} stroke={borderColor} strokeWidth="2" />
            <rect x="0" y="65%" width="20" height="15%" fill={bgColor} stroke={borderColor} strokeWidth="2" />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: '20px', width: 'calc(100% - 20px)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '10px' }}>{content}</div>
          </div>
        </div>
      );
    case 'cloud':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M 30,90 Q 10,90 10,70 Q 10,60 20,50 Q 15,30 35,20 Q 50,5 70,20 Q 90,20 90,40 Q 100,50 95,70 Q 95,90 70,90 Z" 
                  fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'absolute', top: '15%', left: '15%', width: '70%', height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '5px' }}>{content}</div>
          </div>
        </div>
      );
    case 'cylinder':
    case 'server':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M 5,20 L 5,80 C 5,95 95,95 95,80 L 95,20 Z" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <ellipse cx="50" cy="20" rx="45" ry="15" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {node.type === 'server' && (
              <>
                <line x1="20" y1="40" x2="80" y2="40" stroke={borderColor} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
                <line x1="20" y1="55" x2="80" y2="55" stroke={borderColor} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
                <line x1="20" y1="70" x2="80" y2="70" stroke={borderColor} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
                <circle cx="25" cy="40" r="2" fill={borderColor} opacity="0.7" />
                <circle cx="25" cy="55" r="2" fill={borderColor} opacity="0.7" />
                <circle cx="25" cy="70" r="2" fill={borderColor} opacity="0.7" />
              </>
            )}
          </svg>
          <div style={{ position: 'absolute', top: '35%', left: '10%', width: '80%', height: '55%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '5px' }}>{content}</div>
          </div>
        </div>
      );
    case 'queue':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M 20,5 L 80,5 C 95,5 95,95 80,95 L 20,95 Z" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <ellipse cx="20" cy="50" rx="15" ry="45" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <line x1="40" y1="5" x2="40" y2="95" stroke={borderColor} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
            <line x1="60" y1="5" x2="60" y2="95" stroke={borderColor} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
          </svg>
          <div style={{ position: 'absolute', top: '10%', left: '35%', width: '55%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '5px' }}>{content}</div>
          </div>
        </div>
      );
    case 'document':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M 5,5 L 95,5 L 95,85 C 75,100 50,75 25,90 C 10,98 5,95 5,85 Z" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'absolute', top: '5%', left: '5%', width: '90%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '5px' }}>{content}</div>
          </div>
        </div>
      );
    case 'manual-input':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon points="5,25 95,5 95,95 5,95" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'absolute', top: '25%', left: '5%', width: '90%', height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '5px' }}>{content}</div>
          </div>
        </div>
      );
    case 'decision-merge':
      return (
        <div style={{
          width: '70.7%', height: '70.7%', transform: `rotate(${45 + (node.rotation || 0)}deg)`,
          backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', filter: shadowFilter
        }}>
          <div style={{ transform: `rotate(${-45 - (node.rotation || 0)}deg)`, width: '141.4%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ ...mergedTextStyle, padding: '4px' }}>{content}</div>
          </div>
        </div>
      );
    case 'io-data':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon points="20,5 100,5 80,95 0,95" fill={bgColor} stroke={borderColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ ...mergedTextStyle, padding: '10px 20px' }}>{content}</div>
          </div>
        </div>
      );
    case 'group-frame':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor !== '#2c2c2c' ? bgColor : 'transparent',
          border: `2px dashed ${node.groupColor || borderColor}`,
          borderRadius: '8px', display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box', boxShadow: node.style?.boxShadow || 'none'
        }}>
          {node.groupTitle && (
            <div style={{ padding: '8px 12px', borderBottom: `2px dashed ${node.groupColor || borderColor}`, fontWeight: 'bold', ...mergedTextStyle, color: node.groupColor || color, textAlign: 'left' }}>
              {node.groupTitle}
            </div>
          )}
          <div style={{ flex: 1, padding: '12px' }}>
             {/* Children would be inside the bounds naturally */}
          </div>
        </div>
      );
    case 'callout':
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', filter: shadowFilter }}>
          <div style={{
            width: '100%', height: 'calc(100% - 15px)',
            backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
            borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box', padding: '8px'
          }}>
            <div style={mergedTextStyle}>{content}</div>
          </div>
          {/* Pointer tail */}
          <div style={{
            position: 'absolute', bottom: '0px', left: '20px',
            width: '0', height: '0',
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: `15px solid ${borderColor}`
          }} />
          <div style={{
            position: 'absolute', bottom: '3px', left: '22px',
            width: '0', height: '0',
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `12px solid ${bgColor}`
          }} />
        </div>
      );
    case 'badge':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `1px ${borderStyle} ${borderColor}`,
          borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', padding: '4px 8px', boxShadow: node.style?.boxShadow || 'none'
        }}>
          <div style={{ ...mergedTextStyle, fontSize: '9px', fontWeight: 'bold' }}>{content}</div>
        </div>
      );
    case 'browser':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: '4px', display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box', boxShadow: node.style?.boxShadow || 'none',
          overflow: 'hidden'
        }}>
          {/* Chrome bar */}
          <div style={{ height: '24px', backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
            <div style={mergedTextStyle}>{content}</div>
          </div>
        </div>
      );
    case 'mobile':
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: bgColor, border: `3px ${borderStyle} ${borderColor}`,
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box', boxShadow: node.style?.boxShadow || 'none',
          overflow: 'hidden', padding: '4px'
        }}>
           {/* Notch */}
           <div style={{ alignSelf: 'center', width: '30%', height: '6px', backgroundColor: borderColor, borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', marginBottom: '4px' }} />
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
             <div style={mergedTextStyle}>{content}</div>
           </div>
           {/* Home button line */}
           <div style={{ alignSelf: 'center', width: '40%', height: '3px', backgroundColor: borderColor, borderRadius: '4px', marginTop: '4px' }} />
        </div>
      );
    default:
      return null;
  }
}
