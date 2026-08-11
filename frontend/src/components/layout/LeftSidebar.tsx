import { useState, useEffect } from 'react';
import { useDiagram } from '@/context/DiagramContext';
import { useNavigate } from 'react-router-dom';
import styles from './LeftSidebar.module.css';
import { 
  Layers, 
  Square, 
  Circle, 
  Triangle, 
  Diamond, 
  Minus, 
  ArrowRight, 
  Trash2, 
  GripVertical,
  Hexagon,
  Database,
  StickyNote,
  Sparkles,
  Link,
  Cpu,
  Globe,
  Server,
  Cloud,
  ChevronDown,
  ChevronRight,
  Workflow,
  Box,
  Pin,
  LayoutTemplate,
  Folder,
  Edit,
  MoreVertical,
  Type,
} from 'lucide-react';

// ─── Shape Categories ───────────────────────────────────────────────────────
const SHAPE_CATEGORIES = [
  {
    label: 'Basic',
    shapes: [
      { type: 'box',          label: 'Box',          icon: Square },
      { type: 'rounded-rect', label: 'Rounded Rect', icon: Square },
      { type: 'circle',       label: 'Circle',       icon: Circle },
      { type: 'diamond',      label: 'Diamond',      icon: Diamond },
      { type: 'hexagon',      label: 'Hexagon',      icon: Hexagon },
      { type: 'pill',         label: 'Pill',         icon: Square },
      { type: 'triangle',     label: 'Triangle',     icon: Triangle },
      { type: 'star',         label: 'Star',         icon: Sparkles },
      { type: 'parallelogram',label: 'Parallelogram',icon: Square },
      { type: 'badge',        label: 'Badge',        icon: Box },
    ]
  },
  {
    label: 'Flowchart',
    shapes: [
      { type: 'terminator',     label: 'Start / End',   icon: Circle },
      { type: 'process',        label: 'Process',        icon: Square },
      { type: 'decision-merge', label: 'Decision Merge', icon: Diamond },
      { type: 'document',       label: 'Document',       icon: StickyNote },
      { type: 'manual-input',   label: 'Manual Input',   icon: Box },
      { type: 'io-data',        label: 'I/O Data',       icon: Box },
      { type: 'callout',        label: 'Callout',        icon: Box },
      { type: 'note',           label: 'Note',           icon: StickyNote },
      { type: 'text',           label: 'Text',           icon: Type },
      { type: 'group-frame',    label: 'Group Frame',    icon: Layers },
    ]
  },
  {
    label: 'UML',
    shapes: [
      { type: 'uml-class',     label: 'Class',      icon: Cpu },
      { type: 'uml-interface', label: 'Interface',  icon: Cpu },
      { type: 'uml-abstract',  label: 'Abstract',   icon: Cpu },
      { type: 'uml-enum',      label: 'Enum',       icon: Cpu },
      { type: 'actor',         label: 'Actor',      icon: Workflow },
      { type: 'use-case',      label: 'Use Case',   icon: Circle },
      { type: 'component',     label: 'Component',  icon: Box },
    ]
  },
  {
    label: 'Architecture',
    shapes: [
      { type: 'cloud',    label: 'Cloud',    icon: Cloud },
      { type: 'server',   label: 'Server',   icon: Server },
      { type: 'cylinder', label: 'Database', icon: Database },
      { type: 'queue',    label: 'Queue',    icon: Box },
      { type: 'browser',  label: 'Browser',  icon: Globe },
      { type: 'mobile',   label: 'Mobile',   icon: Box },
      { type: 'database', label: 'DB Icon',  icon: Database },
    ]
  },
  {
    label: 'Connectors',
    shapes: [
      { type: 'line',  label: 'Line',  icon: Minus },
      { type: 'arrow', label: 'Arrow', icon: ArrowRight },
    ]
  },
];

const PRESET_COLORS = [
  '#0f0f0f', // Dark Canvas
  '#ffffff', // White
  '#f8f9fa', // Light Gray
  '#e2e8f0', // Slate
  '#fdf6e3', // Solarized Light
  '#1a1a1a', // Dark Gray
  '#0f172a', // Slate Dark
  '#002b36', // Solarized Dark
];

interface LeftSidebarProps {
  isPinned?: boolean;
  onPinToggle?: () => void;
  activeTab?: 'files' | 'layers' | 'shapes' | 'templates' | 'settings';
  onTabChange?: (tab: 'files' | 'layers' | 'shapes' | 'templates' | 'settings') => void;
}

export function LeftSidebar({ isPinned = true, onPinToggle, activeTab, onTabChange }: LeftSidebarProps) {
  const [localActiveTab] = useState<'files' | 'layers' | 'shapes' | 'templates' | 'settings'>('layers');
  const currentTab = onTabChange ? activeTab : localActiveTab;

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Basic', 'Flowchart']));
  const { 
    nodes, 
    selectedNodeIds, 
    selectNode, 
    setNodes, 
    setSelectedNodeIds, 
    saveHistoryState, 
    addShape,
    projects,
    activeProjectId,
    activeFileId,
    updateFile,
    deleteFile,
    updateCanvasConfig
  } = useDiagram();
  
  const navigate = useNavigate();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  const handleRenameFile = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const newName = prompt('Enter new file name:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      updateFile(id, newName.trim());
    }
  };

  const handleDeleteFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (confirm('Are you sure you want to delete this file?')) {
      deleteFile(id);
      if (activeFileId === id) {
        const proj = projects.find(p => p.id === activeProjectId);
        const remainingFiles = proj?.files.filter(f => f.id !== id) || [];
        if (remainingFiles.length > 0) {
          navigate(`/project/${activeProjectId}/file/${remainingFiles[0].id}`);
        } else {
          navigate('/dashboard');
        }
      }
    }
  };

  const loadTemplate = (templateNodes: any[], name: string) => {
    if (window.confirm(`Load ${name}? This will clear your current workspace nodes.`)) {
      saveHistoryState(nodes);
      setNodes(templateNodes);
      setSelectedNodeIds([]);
    }
  };
  
  // Drag and drop states for layer reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const getNodeIcon = (type: string) => {
    const size = 12;
    switch (type) {
      case 'box': case 'rounded-rect': case 'process':
        return <Square size={size} className={styles.layerIcon} />;
      case 'pill': case 'badge': case 'terminator':
        return <Square size={size} style={{ borderRadius: '3px' }} className={styles.layerIcon} />;
      case 'circle': case 'use-case':
        return <Circle size={size} className={styles.layerIcon} />;
      case 'triangle':
        return <Triangle size={size} className={styles.layerIcon} />;
      case 'hexagon':
        return <Hexagon size={size} className={styles.layerIcon} />;
      case 'diamond': case 'decision-merge':
        return <Diamond size={size} className={styles.layerIcon} />;
      case 'parallelogram': case 'io-data':
        return <Square size={size} style={{ transform: 'skewX(-15deg)' }} className={styles.layerIcon} />;
      case 'star':
        return <Layers size={size} style={{ color: '#d69e2e' }} className={styles.layerIcon} />;
      case 'database': case 'cylinder':
        return <Database size={size} className={styles.layerIcon} />;
      case 'note': case 'callout': case 'document':
        return <StickyNote size={size} className={styles.layerIcon} />;
      case 'cloud':
        return <Cloud size={size} className={styles.layerIcon} />;
      case 'server':
        return <Server size={size} className={styles.layerIcon} />;
      case 'browser':
        return <Globe size={size} className={styles.layerIcon} />;
      case 'uml-class': case 'uml-interface': case 'uml-abstract': case 'uml-enum': case 'component':
        return <Cpu size={size} className={styles.layerIcon} />;
      case 'actor':
        return <Workflow size={size} className={styles.layerIcon} />;
      case 'line':
        return <Minus size={size} className={styles.layerIcon} />;
      case 'arrow':
        return <ArrowRight size={size} className={styles.layerIcon} />;
      case 'custom-block':
        return <Sparkles size={size} className={styles.layerIcon} style={{ color: '#8b5cf6' }} />;
      case 'custom-connector':
        return <Link size={size} className={styles.layerIcon} style={{ color: '#8b5cf6' }} />;
      default:
        return <Square size={size} className={styles.layerIcon} />;
    }
  };

  const getNodeLabel = (node: any) => {
    if (node.type === 'line') return 'Line';
    if (node.type === 'arrow') return 'Arrow';
    if (node.content && node.content.trim() !== '') {
      return node.content.length > 20 ? `${node.content.slice(0, 18)}...` : node.content;
    }
    const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
    return `${typeLabel} (${node.id})`;
  };

  const handleDeleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveHistoryState(nodes);
    setNodes(nodes.filter(n => n.id !== id));
    setSelectedNodeIds(selectedNodeIds.filter(selectedId => selectedId !== id));
  };

  // Reorder HTML5 drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const dragOriginalIdx = nodes.length - 1 - draggedIndex;
    const dropOriginalIdx = nodes.length - 1 - targetIndex;

    const newNodes = [...nodes];
    const [removed] = newNodes.splice(dragOriginalIdx, 1);
    newNodes.splice(dropOriginalIdx, 0, removed);

    saveHistoryState(nodes);
    setNodes(newNodes);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const displayNodes = [...nodes].reverse();

  return (
    <div className={styles.container}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        height: '68px', 
        padding: '0 16px', 
        borderBottom: '1px solid var(--border-default)', 
        flexShrink: 0 
      }}>
        {/* Brand text */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} 
          onClick={() => navigate('/dashboard')}
          title="Go to Dashboard"
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>Arqulat Arc</span>
        </div>

        {onPinToggle && (
          <button 
            onClick={onPinToggle} 
            className={styles.pinBtn} 
            title={isPinned ? "Unpin sidebar (auto-collapse on hover leave)" : "Pin sidebar"}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Pin size={13} style={{ transform: isPinned ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s', color: isPinned ? '#0c8ce9' : 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      <div className={styles.panelContent}>
        {currentTab === 'files' ? (
          <div className={styles.projectList}>
            {projects.find(p => p.id === activeProjectId)?.files.map((file) => {
              const isActive = file.id === activeFileId;
              return (
                <div key={file.id} style={{ position: 'relative' }}>
                  <button
                    className={`${styles.projectBtn} ${isActive ? styles.activeProject : ''}`}
                    onClick={() => navigate(`/project/${activeProjectId}/file/${file.id}`)}
                    style={{ paddingRight: '28px' }}
                  >
                    <Folder size={14} className={styles.itemIcon} />
                    <span className={styles.projectName}>{file.name}</span>
                    <span className={styles.itemCount}>{file.nodes.length}</span>
                  </button>
                  
                  <button 
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === file.id ? null : file.id);
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {activeMenuId === file.id && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      backgroundColor: 'var(--bg-panel-solid)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      boxShadow: 'var(--shadow-sm)',
                      zIndex: 50,
                      minWidth: '120px',
                      overflow: 'hidden'
                    }}>
                      <button 
                        onClick={(e) => handleRenameFile(e, file.id, file.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Edit size={12} /> Rename
                      </button>
                      <button 
                        onClick={(e) => handleDeleteFile(e, file.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : currentTab === 'layers' ? (
          nodes.length === 0 ? (
            <div className={styles.emptyState}>
              <Layers size={24} strokeWidth={1.5} />
              <span className={styles.emptyTitle}>No layers yet</span>
              <span className={styles.emptyDesc}>Add shapes using the Shapes tab or AI generation</span>
            </div>
          ) : (
            <div className={styles.layerList}>
              {displayNodes.map((node, index) => {
                const isSelected = selectedNodeIds.includes(node.id);
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div 
                    key={node.id}
                    className={`${styles.layerItem} ${isSelected ? styles.selectedLayer : ''} ${isDragging ? styles.draggingLayer : ''} ${isDragOver ? styles.dragOverLayer : ''}`}
                    onClick={(e) => selectNode(node.id, e.shiftKey)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className={styles.layerLeft}>
                      <div className={styles.gripHandle} title="Drag to reorder layer">
                        <GripVertical size={11} />
                      </div>
                      {getNodeIcon(node.type)}
                      <span className={styles.layerName}>{getNodeLabel(node)}</span>
                    </div>
                    <div className={styles.layerActions}>
                      <button 
                        className={styles.layerActionBtn}
                        onClick={(e) => handleDeleteNode(node.id, e)}
                        title="Delete element"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : currentTab === 'shapes' ? (
          <div className={styles.shapesPanel}>
            {SHAPE_CATEGORIES.map(cat => {
              const isOpen = expandedCategories.has(cat.label);
              return (
                <div key={cat.label} className={styles.shapeCategory}>
                  <button
                    className={styles.categoryHeader}
                    onClick={() => toggleCategory(cat.label)}
                  >
                    {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span>{cat.label}</span>
                    <span className={styles.categoryCount}>{cat.shapes.length}</span>
                  </button>
                  {isOpen && (
                    <div className={styles.shapeGrid}>
                      {cat.shapes.map(shape => {
                        const Icon = shape.icon;
                        return (
                          <button
                            key={shape.type}
                            className={styles.shapeBtn}
                            title={`Insert ${shape.label}`}
                            onClick={() => addShape(shape.type)}
                          >
                            <Icon size={16} className={styles.shapeBtnIcon} />
                            <span className={styles.shapeBtnLabel}>{shape.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : currentTab === 'templates' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px' }}>
            {/* User Authentication Flowchart */}
            <button
              onClick={() => loadTemplate([
                  { id: 'start', type: 'terminator', content: 'Start', position: { x: 250, y: 50 }, dimensions: { width: 100, height: 45 }, style: { backgroundColor: '#10b981', color: '#fff', borderColor: '#059669', strokeWidth: 1 } },
                  { id: 'login', type: 'process', content: 'Login Page', position: { x: 230, y: 140 }, dimensions: { width: 140, height: 60 }, style: { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155', strokeWidth: 1 } },
                  { id: 'decision', type: 'decision-merge', content: 'Credentials\nValid?', position: { x: 240, y: 250 }, dimensions: { width: 120, height: 90 }, style: { backgroundColor: '#d97706', color: '#fff', borderColor: '#b45309', strokeWidth: 1 } },
                  { id: 'dashboard', type: 'process', content: 'Dashboard', position: { x: 120, y: 400 }, dimensions: { width: 120, height: 60 }, style: { backgroundColor: '#0c8ce9', color: '#fff', borderColor: '#0284c7', strokeWidth: 1 } },
                  { id: 'error', type: 'process', content: 'Show Error', position: { x: 360, y: 400 }, dimensions: { width: 120, height: 60 }, style: { backgroundColor: '#ef4444', color: '#fff', borderColor: '#dc2626', strokeWidth: 1 } },
                  { id: 'conn1', type: 'arrow', startConnection: { nodeId: 'start', anchor: 'bottom' }, endConnection: { nodeId: 'login', anchor: 'top' }, startPoint: { x: 300, y: 95 }, endPoint: { x: 300, y: 140 } },
                  { id: 'conn2', type: 'arrow', startConnection: { nodeId: 'login', anchor: 'bottom' }, endConnection: { nodeId: 'decision', anchor: 'top' }, startPoint: { x: 300, y: 200 }, endPoint: { x: 300, y: 250 } },
                  { id: 'conn3', type: 'arrow', startConnection: { nodeId: 'decision', anchor: 'left' }, endConnection: { nodeId: 'dashboard', anchor: 'top' }, startPoint: { x: 240, y: 295 }, endPoint: { x: 180, y: 400 } },
                  { id: 'conn4', type: 'arrow', startConnection: { nodeId: 'decision', anchor: 'right' }, endConnection: { nodeId: 'error', anchor: 'top' }, startPoint: { x: 360, y: 295 }, endPoint: { x: 420, y: 400 } },
              ], 'User Authentication Flowchart')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '12px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(12, 140, 233, 0.05)'; e.currentTarget.style.borderColor = 'rgba(12, 140, 233, 0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; }}
            >
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '8px', borderRadius: '8px' }}>
                <Workflow size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>User Authentication</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Flowchart login pattern</span>
              </div>
            </button>

            {/* 3-Tier Architecture Grid */}
            <button
              onClick={() => loadTemplate([
                  { id: 'browser', type: 'browser', content: 'Browser App', position: { x: 50, y: 180 }, dimensions: { width: 120, height: 70 }, style: { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155', strokeWidth: 1 } },
                  { id: 'gateway', type: 'server', content: 'API Gateway', position: { x: 230, y: 180 }, dimensions: { width: 110, height: 70 }, style: { backgroundColor: '#0c8ce9', color: '#fff', borderColor: '#0284c7', strokeWidth: 1 } },
                  { id: 'server', type: 'server', content: 'App Server', position: { x: 410, y: 180 }, dimensions: { width: 110, height: 70 }, style: { backgroundColor: '#8b5cf6', color: '#fff', borderColor: '#7c3aed', strokeWidth: 1 } },
                  { id: 'db', type: 'database', content: 'SQL Database', position: { x: 590, y: 180 }, dimensions: { width: 110, height: 70 }, style: { backgroundColor: '#10b981', color: '#fff', borderColor: '#059669', strokeWidth: 1 } },
                  { id: 'conn1', type: 'arrow', startConnection: { nodeId: 'browser', anchor: 'right' }, endConnection: { nodeId: 'gateway', anchor: 'left' }, startPoint: { x: 170, y: 215 }, endPoint: { x: 230, y: 215 } },
                  { id: 'conn2', type: 'arrow', startConnection: { nodeId: 'gateway', anchor: 'right' }, endConnection: { nodeId: 'server', anchor: 'left' }, startPoint: { x: 340, y: 215 }, endPoint: { x: 410, y: 215 } },
                  { id: 'conn3', type: 'arrow', startConnection: { nodeId: 'server', anchor: 'right' }, endConnection: { nodeId: 'db', anchor: 'left' }, startPoint: { x: 520, y: 215 }, endPoint: { x: 590, y: 215 } },
              ], '3-Tier Architecture template')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '12px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(12, 140, 233, 0.05)'; e.currentTarget.style.borderColor = 'rgba(12, 140, 233, 0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; }}
            >
              <div style={{ backgroundColor: 'rgba(12, 140, 233, 0.1)', color: '#38bdf8', padding: '8px', borderRadius: '8px' }}>
                <LayoutTemplate size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>3-Tier Architecture</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Client-Server-DB grid layout</span>
              </div>
            </button>

            {/* UML Design patterns */}
            <button
              onClick={() => loadTemplate([
                  { id: 'user', type: 'uml-class', content: 'User\n--\n+ id: string\n+ name: string\n--\n+ login(): void', position: { x: 100, y: 100 }, dimensions: { width: 150, height: 100 }, style: { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155', strokeWidth: 1 } },
                  { id: 'account', type: 'uml-class', content: 'Account\n--\n+ balance: double\n--\n+ deposit(amt): void', position: { x: 320, y: 100 }, dimensions: { width: 150, height: 100 }, style: { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155', strokeWidth: 1 } },
                  { id: 'conn1', type: 'line', startConnection: { nodeId: 'user', anchor: 'right' }, endConnection: { nodeId: 'account', anchor: 'left' }, startPoint: { x: 250, y: 150 }, endPoint: { x: 320, y: 150 } },
              ], 'UML Classes template')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '12px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(12, 140, 233, 0.05)'; e.currentTarget.style.borderColor = 'rgba(12, 140, 233, 0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; }}
            >
              <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', padding: '8px', borderRadius: '8px' }}>
                <Cpu size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>UML Class Diagram</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Object oriented structural pattern</span>
              </div>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Canvas Background
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                Choose a preset or a custom color for your canvas background
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {(() => {
                const activeProject = projects.find(p => p.id === activeProjectId);
                const activeFile = activeProject?.files.find(f => f.id === activeFileId);
                const canvasBg = activeFile?.canvasConfig?.backgroundColor || '#0f0f0f';

                return PRESET_COLORS.map(color => {
                  const isSelected = canvasBg === color;
                  return (
                    <button
                      key={color}
                      onClick={() => updateCanvasConfig(activeFileId, { backgroundColor: color })}
                      style={{
                        height: '28px',
                        backgroundColor: color,
                        border: isSelected ? '2px solid #0c8ce9' : '1px solid var(--border-default)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.1s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title={color}
                    >
                      {isSelected && (
                        <div style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          backgroundColor: ['#ffffff', '#f8f9fa', '#e2e8f0', '#fdf6e3'].includes(color) ? '#000' : '#fff'
                        }} />
                      )}
                    </button>
                  );
                });
              })()}
            </div>

            {/* Custom Color Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-primary)' }}>Custom Color</span>
              {(() => {
                const activeProject = projects.find(p => p.id === activeProjectId);
                const activeFile = activeProject?.files.find(f => f.id === activeFileId);
                const canvasBg = activeFile?.canvasConfig?.backgroundColor || '#0f0f0f';

                return (
                  <div 
                    style={{ 
                      height: '36px', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-default)',
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                  >
                    <input 
                      type="color" 
                      value={canvasBg}
                      onChange={(e) => updateCanvasConfig(activeFileId, { backgroundColor: e.target.value })}
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        left: '-5px',
                        width: '120%',
                        height: '120%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}>
                      <span style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        fontFamily: 'monospace'
                      }}>
                        {canvasBg.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
