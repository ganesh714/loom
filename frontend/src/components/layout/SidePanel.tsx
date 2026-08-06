import { useState } from 'react';
import { useDiagram } from '@/context/DiagramContext';
import type { DiagramNode } from '@/types';
import styles from './SidePanel.module.css';
import { 
  X as CloseIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  ArrowUp, 
  ArrowDown
} from 'lucide-react';

export function SidePanel() {
  const { 
    nodes, 
    selectedNodeIds, 
    updateNode, 
    updateMultipleNodes, 
    selectNode, 
    moveNode, 
    resizeNode, 
    updateLinePoints,
    bringToFront,
    sendToBack,
    alignSelected,
    groupSelected,
    ungroupSelected
  } = useDiagram();

  const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));

  const [canvasBg, setCanvasBg] = useState(() => {
    return '#1e1e1e';
  });

  const handleCanvasBgChange = (color: string) => {
    setCanvasBg(color);
    document.documentElement.style.setProperty('--bg-canvas', color);
  };

  if (selectedNodes.length === 0) {
    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <h3>Design</h3>
        </div>
        <div className={styles.propertiesContent}>
          {/* Canvas Settings */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Page</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Background</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <div className={styles.colorPickerWrapper}>
                  <input
                    type="color"
                    value={canvasBg}
                    onChange={(e) => handleCanvasBgChange(e.target.value)}
                  />
                  <span className={styles.colorHex}>{canvasBg}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
                  {['#1e1e1e', '#ffffff', '#f8fafc', '#111827', '#252526', '#0f172a', '#3b82f6'].map(color => (
                    <button
                      key={color}
                      onClick={() => handleCanvasBgChange(color)}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: color,
                        border: color.toLowerCase() === canvasBg.toLowerCase() ? '2px solid var(--text-primary)' : '1px solid var(--border-default)',
                        cursor: 'pointer',
                        padding: 0,
                        boxSizing: 'border-box'
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Layer stats */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Document Info</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Total Layers</span>
              <span className="text-xs text-slate-400 font-bold">{nodes.length}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Selection</span>
              <span className="text-xs text-slate-500 italic">None selected</span>
            </div>
          </div>
          
          <div className="p-4 text-xs text-slate-500 text-center bg-[#1e1e1e] m-3 rounded border border-dashed border-neutral-800">
            Select a layer on the canvas or layers list to inspect and edit its properties.
          </div>
        </div>
      </div>
    );
  }

  const node = selectedNodes[0];

  const handleChange = (field: string, value: string) => {
    if (field === 'content') {
      updateNode({ ...node, content: value });
    } else {
      updateNode({
        ...node,
        style: {
          ...node.style,
          [field]: value,
        },
      });
    }
  };

  const handleMultipleChange = (field: string, value: any) => {
    if (field === 'content') {
      updateMultipleNodes(selectedNodeIds, { content: value });
    } else if (field === 'rotation') {
      updateMultipleNodes(selectedNodeIds, { rotation: value });
    } else if (field === 'lineCurve' || field === 'lineStyle' || field === 'arrowType') {
      updateMultipleNodes(selectedNodeIds, { [field]: value });
    } else {
      updateMultipleNodes(selectedNodeIds, {
        style: {
          [field]: value
        }
      });
    }
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    if (!node) return;
    moveNode(node.id, {
      ...node.position,
      [axis]: isNaN(value) ? 0 : value,
    });
  };

  const handleDimensionChange = (dimension: 'width' | 'height', value: number) => {
    if (!node) return;
    resizeNode(
      node.id,
      { ...node.dimensions, [dimension]: value },
      node.position
    );
  };



  const handleStartPointChange = (axis: 'x' | 'y', value: number) => {
    if (!node || !node.startPoint || !node.endPoint) return;
    const val = isNaN(value) ? 0 : value;
    const newStart = { ...node.startPoint, [axis]: val };
    updateLinePoints(node.id, newStart, node.endPoint);
  };

  const handleEndPointChange = (axis: 'x' | 'y', value: number) => {
    if (!node || !node.startPoint || !node.endPoint) return;
    const val = isNaN(value) ? 0 : value;
    const newEnd = { ...node.endPoint, [axis]: val };
    updateLinePoints(node.id, node.startPoint, newEnd);
  };

  const handleLengthChange = (newLength: number) => {
    if (!node || !node.startPoint || !node.endPoint) return;
    const len = isNaN(newLength) || newLength < 5 ? 5 : newLength;
    const start = node.startPoint;
    const end = node.endPoint;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angleRad = Math.atan2(dy, dx);
    
    const newEndX = start.x + len * Math.cos(angleRad);
    const newEndY = start.y + len * Math.sin(angleRad);
    updateLinePoints(node.id, start, { x: newEndX, y: newEndY });
  };

  const handleAngleChange = (newAngle: number) => {
    if (!node || !node.startPoint || !node.endPoint) return;
    const ang = isNaN(newAngle) ? 0 : newAngle;
    const start = node.startPoint;
    const end = node.endPoint;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    const angleRad = (ang * Math.PI) / 180;
    const newEndX = start.x + len * Math.cos(angleRad);
    const newEndY = start.y + len * Math.sin(angleRad);
    updateLinePoints(node.id, start, { x: newEndX, y: newEndY });
  };

  const getShadowParts = (shadowStr?: string) => {
    if (!shadowStr) return { x: 0, y: 4, blur: 8, color: '#000000' };
    const clean = shadowStr.replace(/px/g, '');
    const parts = clean.split(' ');
    const x = parseInt(parts[0], 10) || 0;
    const y = parseInt(parts[1], 10) || 0;
    const blur = parseInt(parts[2], 10) || 0;
    const color = parts.slice(3).join(' ') || '#000000';
    return { x, y, blur, color };
  };

  const handleShadowChange = (part: 'x' | 'y' | 'blur' | 'color', val: any) => {
    const current = getShadowParts(node.style?.boxShadow);
    if (part === 'x') current.x = parseInt(val, 10) || 0;
    else if (part === 'y') current.y = parseInt(val, 10) || 0;
    else if (part === 'blur') current.blur = parseInt(val, 10) || 0;
    else if (part === 'color') current.color = val;

    handleChange('boxShadow', `${current.x}px ${current.y}px ${current.blur}px ${current.color}`);
  };

  const handleMultipleShadowChange = (part: 'x' | 'y' | 'blur' | 'color', val: any) => {
    selectedNodeIds.forEach(id => {
      const targetNode = nodes.find(n => n.id === id);
      if (!targetNode || targetNode.type === 'line' || targetNode.type === 'arrow' || targetNode.type === 'custom-connector') return;
      const current = getShadowParts(targetNode.style?.boxShadow);
      if (part === 'x') current.x = parseInt(val, 10) || 0;
      else if (part === 'y') current.y = parseInt(val, 10) || 0;
      else if (part === 'blur') current.blur = parseInt(val, 10) || 0;
      else if (part === 'color') current.color = val;

      updateNode({
        ...targetNode,
        style: {
          ...targetNode.style,
          boxShadow: `${current.x}px ${current.y}px ${current.blur}px ${current.color}`
        }
      });
    });
  };

  const getNodeTitle = (n: DiagramNode) => {
    return n.type.toUpperCase() + ` (${n.id})`;
  };

  // Alignment Toolbar JSX
  const AlignmentToolbar = () => (
    <div className={styles.alignGrid}>
      <button className={styles.alignButton} onClick={() => alignSelected('left')} title="Align Left">
        <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
          <rect x="10" y="10" width="10" height="80" />
          <rect x="30" y="25" width="50" height="20" rx="5" />
          <rect x="30" y="55" width="30" height="20" rx="5" />
        </svg>
      </button>
      <button className={styles.alignButton} onClick={() => alignSelected('center')} title="Align Horizontal Centers">
        <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
          <rect x="45" y="10" width="10" height="80" />
          <rect x="20" y="25" width="60" height="20" rx="5" />
          <rect x="30" y="55" width="40" height="20" rx="5" />
        </svg>
      </button>
      <button className={styles.alignButton} onClick={() => alignSelected('right')} title="Align Right">
        <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
          <rect x="80" y="10" width="10" height="80" />
          <rect x="20" y="25" width="50" height="20" rx="5" />
          <rect x="40" y="55" width="30" height="20" rx="5" />
        </svg>
      </button>
      <button className={styles.alignButton} onClick={() => alignSelected('top')} title="Align Top">
        <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
          <rect x="10" y="10" width="80" height="10" />
          <rect x="25" y="30" width="20" height="50" rx="5" />
          <rect x="55" y="30" width="20" height="30" rx="5" />
        </svg>
      </button>
      <button className={styles.alignButton} onClick={() => alignSelected('middle')} title="Align Vertical Centers">
        <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
          <rect x="10" y="45" width="80" height="10" />
          <rect x="25" y="20" width="20" height="60" rx="5" />
          <rect x="55" y="30" width="20" height="40" rx="5" />
        </svg>
      </button>
      <button className={styles.alignButton} onClick={() => alignSelected('bottom')} title="Align Bottom">
        <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
          <rect x="10" y="80" width="80" height="10" />
          <rect x="25" y="20" width="20" height="50" rx="5" />
          <rect x="55" y="40" width="20" height="30" rx="5" />
        </svg>
      </button>
    </div>
  );

  // Depth and Grouping control buttons
  const DepthAndGroupArrangement = ({ ids }: { ids: string[] }) => {
    // Check if the current selection forms a single existing group
    const isSingleGroup = ids.length > 1 && ids.every(id => {
      const n = nodes.find(node => node.id === id);
      return n?.groupId && n.groupId === nodes.find(node => node.id === ids[0])?.groupId;
    });

    return (
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Arrange & Group</span>
        <div className={styles.paddedGrid}>
          <button className={styles.select} onClick={() => bringToFront(ids)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <ArrowUp size={12} />
            <span>To Front</span>
          </button>
          <button className={styles.select} onClick={() => sendToBack(ids)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <ArrowDown size={12} />
            <span>To Back</span>
          </button>
          
          {!isSingleGroup ? (
            <button className={styles.select} onClick={groupSelected} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', gridColumn: 'span 2', marginTop: '4px', backgroundColor: 'var(--primary-color)' }}>
              <span style={{color: 'white'}}>Group Selection</span>
            </button>
          ) : (
            <button className={styles.select} onClick={ungroupSelected} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', gridColumn: 'span 2', marginTop: '4px' }}>
              <span>Ungroup</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  if (selectedNodes.length > 1) {
    const allShapes = selectedNodes.every(n => n.type !== 'line' && n.type !== 'arrow' && n.type !== 'custom-connector');
    const allConnectors = selectedNodes.every(n => n.type === 'line' || n.type === 'arrow' || n.type === 'custom-connector');
    const noCircles = selectedNodes.every(n => n.type !== 'circle');

    const firstNode = selectedNodes[0];
    const getCommonStyleValue = (field: string, fallback: string) => {
      const isCommon = selectedNodes.every(n => n.style?.[field as keyof typeof n.style] === firstNode.style?.[field as keyof typeof firstNode.style]);
      return isCommon ? (firstNode.style?.[field as keyof typeof firstNode.style] || fallback) : fallback;
    };

    const getCommonValue = (field: keyof DiagramNode, fallback: any) => {
      const isCommon = selectedNodes.every(n => n[field] === firstNode[field]);
      return isCommon ? (firstNode[field] ?? fallback) : fallback;
    };

    const commonBg = getCommonStyleValue('backgroundColor', '#ffffff');
    const commonBorder = getCommonStyleValue('borderColor', '#333333');
    const commonRadius = parseInt(getCommonStyleValue('borderRadius', '4px'), 10);
    const commonRotation = getCommonValue('rotation', 0);
    const commonLineCurve = getCommonValue('lineCurve', 'straight');
    const commonLineStyle = getCommonValue('lineStyle', 'solid');
    const commonArrowType = getCommonValue('arrowType', 'none');
    const commonOpacityVal = getCommonStyleValue('opacity', '1');
    const commonOpacity = Math.round((commonOpacityVal !== undefined ? Number(commonOpacityVal) : 1) * 100);

    // Multi-selection Typography properties
    const commonFontSize = getCommonStyleValue('fontSize', '11px');
    const commonFontWeight = getCommonStyleValue('fontWeight', 'normal');
    const commonTextAlign = getCommonStyleValue('textAlign', 'center');

    // Multi-selection Shadows properties
    const firstShadow = getShadowParts(firstNode.style?.boxShadow);
    const isShadowCommon = selectedNodes.every(n => n.style?.boxShadow === firstNode.style?.boxShadow);
    const commonShadow = isShadowCommon ? firstShadow : { x: 0, y: 4, blur: 8, color: '#000000' };

    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <h3>Mixed Selection ({selectedNodes.length})</h3>
          <button className={styles.close} onClick={() => selectNode(null)}>
            <CloseIcon size={12} />
          </button>
        </div>

        <AlignmentToolbar />

        <div className={styles.propertiesContent}>
          {allShapes && (
            <>
              <div className={styles.section}>
                <span className={styles.sectionTitle}>Layout</span>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Rotation</span>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={commonRotation}
                      onChange={(e) => handleMultipleChange('rotation', parseInt(e.target.value, 10))}
                      className={styles.slider}
                    />
                    <div className={styles.inputWrapper}>
                      <input
                        type="number"
                        min="0"
                        max="360"
                        value={commonRotation}
                        onChange={(e) => handleMultipleChange('rotation', parseInt(e.target.value, 10) || 0)}
                        className={styles.numberInput}
                      />
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>°</span>
                    </div>
                  </div>
                </div>

                {noCircles && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Corner</span>
                    <div className={styles.sliderContainer}>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={commonRadius}
                        onChange={(e) => handleMultipleChange('borderRadius', `${e.target.value}px`)}
                        className={styles.slider}
                      />
                      <div className={styles.inputWrapper}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={commonRadius}
                          onChange={(e) => handleMultipleChange('borderRadius', `${e.target.value}px`)}
                          className={styles.numberInput}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.row}>
                  <span className={styles.rowLabel}>Opacity</span>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={commonOpacity}
                      onChange={(e) => handleMultipleChange('opacity', String(Number(e.target.value) / 100))}
                      className={styles.slider}
                    />
                    <div className={styles.inputWrapper}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={commonOpacity}
                        onChange={(e) => {
                          let val = parseInt(e.target.value, 10);
                          if (isNaN(val)) val = 100;
                          val = Math.max(0, Math.min(100, val));
                          handleMultipleChange('opacity', String(val / 100));
                        }}
                        className={styles.numberInput}
                      />
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>

              <DepthAndGroupArrangement ids={selectedNodeIds} />

              <div className={styles.section}>
                <span className={styles.sectionTitle}>Typography</span>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Size</span>
                  <select
                    className={styles.select}
                    value={commonFontSize}
                    onChange={(e) => handleMultipleChange('fontSize', e.target.value)}
                  >
                    <option value="9px">9 px</option>
                    <option value="11px">11 px</option>
                    <option value="13px">13 px</option>
                    <option value="16px">16 px</option>
                    <option value="20px">20 px</option>
                    <option value="24px">24 px</option>
                    <option value="32px">32 px</option>
                  </select>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Format</span>
                  <div className={styles.toggleGroup}>
                    <button
                      className={`${styles.toggleButton} ${commonFontWeight === 'bold' ? styles.toggleButtonActive : ''}`}
                      onClick={() => handleMultipleChange('fontWeight', commonFontWeight === 'bold' ? 'normal' : 'bold')}
                      title="Bold"
                    >
                      <Bold size={11} />
                    </button>
                    <button
                      className={`${styles.toggleButton} ${commonTextAlign === 'left' ? styles.toggleButtonActive : ''}`}
                      onClick={() => handleMultipleChange('textAlign', 'left')}
                      title="Align Left"
                    >
                      <AlignLeft size={11} />
                    </button>
                    <button
                      className={`${styles.toggleButton} ${commonTextAlign === 'center' ? styles.toggleButtonActive : ''}`}
                      onClick={() => handleMultipleChange('textAlign', 'center')}
                      title="Align Center"
                    >
                      <AlignCenter size={11} />
                    </button>
                    <button
                      className={`${styles.toggleButton} ${commonTextAlign === 'right' ? styles.toggleButtonActive : ''}`}
                      onClick={() => handleMultipleChange('textAlign', 'right')}
                      title="Align Right"
                    >
                      <AlignRight size={11} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionTitle}>Fill & Stroke</span>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Fill</span>
                  <div className={styles.colorPickerWrapper}>
                    <input
                      type="color"
                      value={commonBg}
                      onChange={(e) => handleMultipleChange('backgroundColor', e.target.value)}
                    />
                    <span className={styles.colorHex}>{commonBg}</span>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Stroke</span>
                  <div className={styles.colorPickerWrapper}>
                    <input
                      type="color"
                      value={commonBorder}
                      onChange={(e) => handleMultipleChange('borderColor', e.target.value)}
                    />
                    <span className={styles.colorHex}>{commonBorder}</span>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionTitle}>Effects</span>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Blur</span>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={commonShadow.blur}
                      onChange={(e) => handleMultipleShadowChange('blur', e.target.value)}
                      className={styles.slider}
                    />
                    <div className={styles.inputWrapper}>
                      <input
                        type="number"
                        value={commonShadow.blur}
                        onChange={(e) => handleMultipleShadowChange('blur', e.target.value)}
                        className={styles.numberInput}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Offset</span>
                  <div className={styles.grid}>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>X</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={commonShadow.x}
                        onChange={(e) => handleMultipleShadowChange('x', e.target.value)}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>Y</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={commonShadow.y}
                        onChange={(e) => handleMultipleShadowChange('y', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Color</span>
                  <div className={styles.colorPickerWrapper}>
                    <input
                      type="color"
                      value={commonShadow.color}
                      onChange={(e) => handleMultipleShadowChange('color', e.target.value)}
                    />
                    <span className={styles.colorHex}>{commonShadow.color}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {allConnectors && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Connector</span>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Color</span>
                <div className={styles.colorPickerWrapper}>
                  <input
                    type="color"
                    value={commonBorder}
                    onChange={(e) => handleMultipleChange('borderColor', e.target.value)}
                  />
                  <span className={styles.colorHex}>{commonBorder}</span>
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Route</span>
                <select
                  className={styles.select}
                  value={commonLineCurve}
                  onChange={(e) => handleMultipleChange('lineCurve', e.target.value as 'straight' | 'curved')}
                >
                  <option value="straight">Straight</option>
                  <option value="curved">Curved</option>
                </select>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Pattern</span>
                <select
                  className={styles.select}
                  value={commonLineStyle}
                  onChange={(e) => handleMultipleChange('lineStyle', e.target.value as 'solid' | 'dashed')}
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                </select>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Arrows</span>
                <select
                  className={styles.select}
                  value={commonArrowType}
                  onChange={(e) => handleMultipleChange('arrowType', e.target.value as 'none' | 'single' | 'double')}
                >
                  <option value="none">None</option>
                  <option value="single">Single End</option>
                  <option value="double">Double Ended</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isLine = node.type === 'line' || node.type === 'arrow' || node.type === 'custom-connector';
  const shadow = getShadowParts(node.style?.boxShadow);

  const formatCss = (css: string) => {
    if (!css) return '';
    return css.split(';')
      .map(s => s.trim())
      .filter(s => s)
      .join(';\n') + (css.trim().endsWith(';') || css.includes(';') ? ';' : '');
  };

  const renderCssTextarea = (key: string, title: string, target: 'style' | 'customConnectorStyle' = 'customConnectorStyle') => {
    const value = String((node as any)[target]?.[key] || '');
    return (
      <div className={styles.row} key={key} style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span className={styles.rowLabel} style={{ marginBottom: '4px', width: 'auto' }}>{title}</span>
        <textarea
          className={styles.textarea}
          style={{ width: '100%', minHeight: '60px', fontFamily: 'monospace', padding: '8px', fontSize: '11px', resize: 'vertical' }}
          value={value}
          placeholder="e.g. width: 10px; height: 10px;"
          onChange={(e) => {
            updateNode({
              ...node,
              [target]: {
                ...((node as any)[target] || {}),
                [key]: e.target.value
              }
            });
          }}
          onBlur={(e) => {
            const formatted = formatCss(e.target.value);
            if (formatted !== e.target.value) {
              updateNode({
                ...node,
                [target]: {
                  ...((node as any)[target] || {}),
                  [key]: formatted
                }
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  };
  const renderCustomBlockCssTextarea = () => {
    const value = String(node.style?.customCss || '');
    return (
      <div style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '8px', width: '100%' }}>
        <textarea
          className={styles.textarea}
          style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', padding: '8px', fontSize: '11px', resize: 'vertical', boxSizing: 'border-box' }}
          value={value}
          placeholder="e.g. width: 100px; height: 100px; content: 'Hello';"
          onChange={(e) => {
            updateNode({
              ...node,
              style: {
                ...(node.style || {}),
                customCss: e.target.value
              }
            });
          }}
          onBlur={(e) => {
            const css = e.target.value;
            let newWidth = node.dimensions.width;
            let newHeight = node.dimensions.height;
            let newX = node.position.x;
            let newY = node.position.y;
            let newRotation = node.rotation || 0;
            let newContent = node.content;
            
            const rules = css.split(';');
            const customRules = [];
            
            for (const rule of rules) {
              if (!rule.trim()) continue;
              const parts = rule.split(':');
              if (parts.length < 2) {
                customRules.push(rule.trim());
                continue;
              }
              const key = parts[0];
              const val = parts.slice(1).join(':').trim();
              const lowerKey = key.trim().toLowerCase();
              
              if (lowerKey === 'width' && val.endsWith('px')) {
                 newWidth = parseInt(val, 10) || newWidth;
              } else if (lowerKey === 'height' && val.endsWith('px')) {
                 newHeight = parseInt(val, 10) || newHeight;
              } else if (lowerKey === 'left' && val.endsWith('px')) {
                 newX = parseInt(val, 10) || newX;
              } else if (lowerKey === 'top' && val.endsWith('px')) {
                 newY = parseInt(val, 10) || newY;
              } else if (lowerKey === 'transform' && val.includes('rotate')) {
                 const match = val.match(/rotate\(([-\d.]+)deg\)/);
                 if (match) {
                   newRotation = parseInt(match[1], 10) || newRotation;
                 }
                 if (!match || val.replace(/rotate\(([-\d.]+)deg\)/, '').trim() !== '') {
                   customRules.push(rule.trim());
                 }
              } else if (lowerKey === 'content') {
                 const contentMatch = val.match(/^['"]?(.*?)['"]?$/);
                 if (contentMatch) {
                    newContent = contentMatch[1];
                 }
              } else {
                 customRules.push(rule.trim());
              }
            }
            
            const formattedCss = customRules.length > 0 
              ? customRules.join(';\n') + (customRules.length ? ';\n' : '')
              : '';
              
            if (css !== formattedCss || newWidth !== node.dimensions.width || newHeight !== node.dimensions.height || newX !== node.position.x || newY !== node.position.y || newRotation !== (node.rotation || 0) || newContent !== node.content) {
              updateNode({
                ...node,
                content: newContent,
                dimensions: { width: newWidth, height: newHeight },
                position: { x: newX, y: newY },
                rotation: newRotation,
                style: {
                  ...(node.style || {}),
                  customCss: formattedCss
                }
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <h3>{getNodeTitle(node)}</h3>
        <button className={styles.close} onClick={() => selectNode(null)}>
          <CloseIcon size={12} />
        </button>
      </div>

      <AlignmentToolbar />

      <div className={styles.propertiesContent}>
        {!isLine && node.type !== 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Shape Properties</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Shape Type</span>
              <select
                className={styles.select}
                value={node.type.startsWith('uml-') ? node.type : node.tag || 'rectangle'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('uml-')) {
                    updateNode({ ...node, type: val as any, tag: val.split('-')[1] as any });
                  } else {
                    updateNode({ ...node, type: 'rounded-rect', tag: val as any });
                  }
                }}
              >
                <option value="rectangle">Rectangle</option>
                <option value="circle">Ellipse</option>
                <option value="diamond">Diamond</option>
                <option value="terminator">Terminator (Pill)</option>
                <option value="process">Process (Square)</option>
                <option value="uml-class">UML Class</option>
                <option value="uml-interface">UML Interface</option>
                <option value="database">Database</option>
                <option value="note">Sticky Note</option>
              </select>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Alignment & Dimensions</span>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Position</span>
            <div className={styles.grid}>
              <div className={styles.inputWrapper}>
                <span className={styles.inputLabel}>X</span>
                <input
                  type="number"
                  className={styles.numberInput}
                  value={Math.round(node.position.x)}
                  onChange={(e) => handlePositionChange('x', parseInt(e.target.value, 10))}
                />
              </div>
              <div className={styles.inputWrapper}>
                <span className={styles.inputLabel}>Y</span>
                <input
                  type="number"
                  className={styles.numberInput}
                  value={Math.round(node.position.y)}
                  onChange={(e) => handlePositionChange('y', parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          </div>

          {!isLine ? (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Size</span>
              <div className={styles.grid}>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputLabel}>W</span>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={Math.round(node.dimensions.width)}
                    onChange={(e) => handleDimensionChange('width', parseInt(e.target.value, 10))}
                    min={20}
                  />
                </div>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputLabel}>H</span>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={Math.round(node.dimensions.height)}
                    onChange={(e) => handleDimensionChange('height', parseInt(e.target.value, 10))}
                    min={20}
                  />
                </div>
              </div>
            </div>
          ) : node.startPoint && node.endPoint && (() => {
            const start = node.startPoint;
            const end = node.endPoint;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.round(Math.sqrt(dx * dx + dy * dy));
            let angle = Math.round(Math.atan2(dy, dx) * (180 / Math.PI));
            if (angle < 0) angle += 360;

            return (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Start</span>
                  <div className={styles.grid}>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>SX</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={Math.round(start.x)}
                        onChange={(e) => handleStartPointChange('x', parseInt(e.target.value, 10))}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>SY</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={Math.round(start.y)}
                        onChange={(e) => handleStartPointChange('y', parseInt(e.target.value, 10))}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>End</span>
                  <div className={styles.grid}>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>EX</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={Math.round(end.x)}
                        onChange={(e) => handleEndPointChange('x', parseInt(e.target.value, 10))}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>EY</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={Math.round(end.y)}
                        onChange={(e) => handleEndPointChange('y', parseInt(e.target.value, 10))}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Line</span>
                  <div className={styles.sliderContainer}>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>L</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={length}
                        onChange={(e) => handleLengthChange(parseInt(e.target.value, 10))}
                        min={5}
                      />
                    </div>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputLabel}>A</span>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={angle}
                        onChange={(e) => handleAngleChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {!isLine && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Rotation</span>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={node.rotation || 0}
                  onChange={(e) => updateNode({ ...node, rotation: parseInt(e.target.value, 10) })}
                  className={styles.slider}
                />
                <div className={styles.inputWrapper}>
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={node.rotation || 0}
                    onChange={(e) => updateNode({ ...node, rotation: parseInt(e.target.value, 10) || 0 })}
                    className={styles.numberInput}
                  />
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>°</span>
                </div>
              </div>
            </div>
          )}

          {!isLine && node.type !== 'circle' && node.type !== 'custom-block' && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Corner</span>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={parseInt(node.style?.borderRadius || (node.type === 'box' || node.type === 'diamond' ? '4' : '0'), 10)}
                  onChange={(e) => handleChange('borderRadius', `${e.target.value}px`)}
                  className={styles.slider}
                />
                <div className={styles.inputWrapper}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={parseInt(node.style?.borderRadius || (node.type === 'box' || node.type === 'diamond' ? '4' : '0'), 10)}
                    onChange={(e) => handleChange('borderRadius', `${e.target.value}px`)}
                    className={styles.numberInput}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={styles.row}>
            <span className={styles.rowLabel}>Opacity</span>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((node.style?.opacity !== undefined ? Number(node.style.opacity) : 1) * 100)}
                onChange={(e) => handleChange('opacity', String(Number(e.target.value) / 100))}
                className={styles.slider}
              />
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((node.style?.opacity !== undefined ? Number(node.style.opacity) : 1) * 100)}
                  onChange={(e) => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val)) val = 100;
                    val = Math.max(0, Math.min(100, val));
                    handleChange('opacity', String(val / 100));
                  }}
                  className={styles.numberInput}
                />
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>
          </div>
        </div>

        {/* <DepthArrangement ids={selectedNodeIds} /> */}

        {!isLine && node.type !== 'custom-block' && (
          <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>Content</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { label: 'B', prefix: '**', suffix: '**', tooltip: 'Bold' },
                  { label: 'I', prefix: '*', suffix: '*', tooltip: 'Italic' },
                  { label: '<>', prefix: '`', suffix: '`', tooltip: 'Code' },
                ].map(({ label, prefix, suffix, tooltip }) => (
                  <button
                    key={label}
                    title={tooltip}
                    onClick={() => {
                      const ta = document.getElementById('sidepanel-content-textarea') as HTMLTextAreaElement;
                      if (!ta) return;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const text = ta.value;
                      const before = text.substring(0, start);
                      const selected = text.substring(start, end);
                      const after = text.substring(end);
                      const newVal = before + prefix + selected + suffix + after;
                      handleChange('content', newVal);
                      setTimeout(() => {
                        ta.focus();
                        ta.setSelectionRange(start + prefix.length, end + prefix.length);
                      }, 0);
                    }}
                    style={{
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: label === 'B' ? 'bold' : 'normal',
                      fontStyle: label === 'I' ? 'italic' : 'normal',
                      fontFamily: label === '<>' ? 'monospace' : 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="sidepanel-content-textarea"
              className={styles.textarea}
              value={node.content}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={3}
              placeholder="Enter text..."
            />
          </div>
        )}

        {!isLine && node.type !== 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Typography</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Font</span>
              <select
                className={styles.select}
                value={node.style?.fontFamily || 'var(--sans)'}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
              >
                <option value="var(--sans)">Sans-serif</option>
                <option value="var(--mono)">Monospace</option>
                <option value="serif">Serif</option>
                <option value="'Comic Sans MS', cursive, sans-serif">Handwritten</option>
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Size</span>
              <select
                className={styles.select}
                value={node.style?.fontSize || '11px'}
                onChange={(e) => handleChange('fontSize', e.target.value)}
              >
                <option value="9px">9 px</option>
                <option value="11px">11 px</option>
                <option value="13px">13 px</option>
                <option value="16px">16 px</option>
                <option value="20px">20 px</option>
                <option value="24px">24 px</option>
                <option value="32px">32 px</option>
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Format</span>
              <div className={styles.toggleGroup}>
                <button
                  className={`${styles.toggleButton} ${node.style?.fontWeight === 'bold' ? styles.toggleButtonActive : ''}`}
                  onClick={() => handleChange('fontWeight', node.style?.fontWeight === 'bold' ? 'normal' : 'bold')}
                  title="Bold"
                >
                  <Bold size={11} />
                </button>
                <button
                  className={`${styles.toggleButton} ${node.style?.textAlign === 'left' ? styles.toggleButtonActive : ''}`}
                  onClick={() => handleChange('textAlign', 'left')}
                  title="Align Left"
                >
                  <AlignLeft size={11} />
                </button>
                <button
                  className={`${styles.toggleButton} ${node.style?.textAlign === 'center' ? styles.toggleButtonActive : ''}`}
                  onClick={() => handleChange('textAlign', 'center')}
                  title="Align Center"
                >
                  <AlignCenter size={11} />
                </button>
                <button
                  className={`${styles.toggleButton} ${node.style?.textAlign === 'right' ? styles.toggleButtonActive : ''}`}
                  onClick={() => handleChange('textAlign', 'right')}
                  title="Align Right"
                >
                  <AlignRight size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!isLine && node.type !== 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Fill</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Color</span>
              <div className={styles.colorPickerWrapper}>
                <input
                  type="color"
                  value={node.style?.backgroundColor || '#2c2c2c'}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                />
                <span className={styles.colorHex}>{node.style?.backgroundColor || '#2c2c2c'}</span>
              </div>
            </div>
          </div>
        )}

        {node.type !== 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Stroke</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Color</span>
              <div className={styles.colorPickerWrapper}>
                <input
                  type="color"
                  value={node.style?.borderColor || (node.type === 'line' ? '#888888' : node.type === 'arrow' ? '#0c8ce9' : '#555555')}
                  onChange={(e) => handleChange('borderColor', e.target.value)}
                />
                <span className={styles.colorHex}>
                  {node.style?.borderColor || (node.type === 'line' ? '#888888' : node.type === 'arrow' ? '#0c8ce9' : '#555555')}
                </span>
              </div>
            </div>

            {isLine && node.type !== 'custom-connector' && (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Route</span>
                  <select
                    className={styles.select}
                    value={node.routing || 'straight'}
                    onChange={(e) => updateNode({ ...node, routing: e.target.value as 'straight' | 'elbow' | 'curved' })}
                  >
                    <option value="straight">Straight</option>
                    <option value="elbow">Elbow</option>
                    <option value="curved">Curved</option>
                  </select>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Pattern</span>
                  <select
                    className={styles.select}
                    value={node.lineStyle || 'solid'}
                    onChange={(e) => updateNode({ ...node, lineStyle: e.target.value as 'solid' | 'dashed' })}
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Arrows</span>
                  <select
                    className={styles.select}
                    value={node.arrowType || (node.type === 'arrow' ? 'single' : 'none')}
                    onChange={(e) => updateNode({ ...node, arrowType: e.target.value as 'none' | 'single' | 'double' })}
                  >
                    <option value="none">None</option>
                    <option value="single">Single End</option>
                    <option value="double">Double Ended</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {isLine && node.type !== 'custom-connector' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Connections</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Start Target</span>
              <select
                className={styles.select}
                value={node.startConnection ? `${node.startConnection.nodeId}:${node.startConnection.anchor}` : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    updateNode({ ...node, startConnection: undefined });
                  } else {
                    const [nodeId, anchor] = val.split(':');
                    updateNode({ ...node, startConnection: { nodeId, anchor: anchor as any } });
                  }
                }}
              >
                <option value="">None (Floating)</option>
                {nodes.filter(n => n.id !== node.id).flatMap(n => {
                  if (n.type === 'line' || n.type === 'arrow') {
                    return [
                      <option key={`${n.id}:closest`} value={`${n.id}:closest`}>[Line] {n.id.substring(0,8)} (Closest)</option>,
                      <option key={`${n.id}:start`} value={`${n.id}:start`}>[Line] {n.id.substring(0,8)} (Start)</option>,
                      <option key={`${n.id}:end`} value={`${n.id}:end`}>[Line] {n.id.substring(0,8)} (End)</option>
                    ];
                  } else {
                    return [
                      <option key={`${n.id}:bottom`} value={`${n.id}:bottom`}>[{n.type}] {n.content || n.id.substring(0,8)}</option>
                    ];
                  }
                })}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>End Target</span>
              <select
                className={styles.select}
                value={node.endConnection ? `${node.endConnection.nodeId}:${node.endConnection.anchor}` : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    updateNode({ ...node, endConnection: undefined });
                  } else {
                    const [nodeId, anchor] = val.split(':');
                    updateNode({ ...node, endConnection: { nodeId, anchor: anchor as any } });
                  }
                }}
              >
                <option value="">None (Floating)</option>
                {nodes.filter(n => n.id !== node.id).flatMap(n => {
                  if (n.type === 'line' || n.type === 'arrow') {
                    return [
                      <option key={`${n.id}:closest`} value={`${n.id}:closest`}>[Line] {n.id.substring(0,8)} (Closest)</option>,
                      <option key={`${n.id}:start`} value={`${n.id}:start`}>[Line] {n.id.substring(0,8)} (Start)</option>,
                      <option key={`${n.id}:end`} value={`${n.id}:end`}>[Line] {n.id.substring(0,8)} (End)</option>
                    ];
                  } else {
                    return [
                      <option key={`${n.id}:top`} value={`${n.id}:top`}>[{n.type}] {n.content || n.id.substring(0,8)}</option>
                    ];
                  }
                })}
              </select>
            </div>
          </div>
        )}

        {node.type === 'custom-connector' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Advanced Connector CSS</span>
            {renderCssTextarea('lineCss', 'Connector Line CSS')}
            {renderCssTextarea('startMarkerCss', 'Start Marker CSS')}
            {renderCssTextarea('endMarkerCss', 'End Marker CSS')}
          </div>
        )}

        {node.type === 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Custom Block CSS</span>
            {renderCustomBlockCssTextarea()}
          </div>
        )}

        {!isLine && node.type !== 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Text</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Color</span>
              <div className={styles.colorPickerWrapper}>
                <input
                  type="color"
                  value={node.style?.color || '#e3e3e3'}
                  onChange={(e) => handleChange('color', e.target.value)}
                />
                <span className={styles.colorHex}>{node.style?.color || '#e3e3e3'}</span>
              </div>
            </div>
          </div>
        )}

        {!isLine && node.type !== 'custom-block' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Effects</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Blur</span>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={shadow.blur}
                  onChange={(e) => handleShadowChange('blur', e.target.value)}
                  className={styles.slider}
                />
                <div className={styles.inputWrapper}>
                  <input
                    type="number"
                    value={shadow.blur}
                    onChange={(e) => handleShadowChange('blur', e.target.value)}
                    className={styles.numberInput}
                  />
                </div>
              </div>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Offset</span>
              <div className={styles.grid}>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputLabel}>X</span>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={shadow.x}
                    onChange={(e) => handleShadowChange('x', e.target.value)}
                  />
                </div>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputLabel}>Y</span>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={shadow.y}
                    onChange={(e) => handleShadowChange('y', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Color</span>
              <div className={styles.colorPickerWrapper}>
                <input
                  type="color"
                  value={shadow.color}
                  onChange={(e) => handleShadowChange('color', e.target.value)}
                />
                <span className={styles.colorHex}>{shadow.color}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
