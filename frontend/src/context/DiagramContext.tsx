import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { DiagramNode } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from './AuthContext';
import { useCollaboration } from './CollaborationContext';
import { getClosestPointOnLineNode } from '../utils/geometry';

export interface CanvasConfig {
  backgroundColor: string;
}

export interface DiagramFile {
  id: string;
  name: string;
  nodes: DiagramNode[];
  canvasConfig: CanvasConfig;
  updatedAt: number;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  category: string;
  files: DiagramFile[];
  updatedAt: number;
}

export interface SnapLine {
  axis: 'x' | 'y';
  position: number;
}

interface DiagramContextType {
  nodes: DiagramNode[];
  selectedNodeIds: string[];
  addBox: (position?: { x: number; y: number }) => void;
  addDiamond: (position?: { x: number; y: number }) => void;
  addCircle: (position?: { x: number; y: number }) => void;
  addTriangle: (position?: { x: number; y: number }) => void;
  addStar: (position?: { x: number; y: number }) => void;
  addPill: (position?: { x: number; y: number }) => void;
  addHexagon: (position?: { x: number; y: number }) => void;
  addParallelogram: (position?: { x: number; y: number }) => void;
  addDatabase: (position?: { x: number; y: number }) => void;
  addNote: (position?: { x: number; y: number }) => void;
  addLine: (position?: { x: number; y: number }) => void;
  addArrow: (position?: { x: number; y: number }) => void;
  addCustomBlock: (position?: { x: number; y: number }) => void;
  addCustomConnector: (position?: { x: number; y: number }) => void;
  addShape: (type: string, position?: { x: number; y: number }) => void;
  updateLinePoints: (id: string, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) => void;
  updateWaypoint: (id: string, index: number, pos: { x: number; y: number }) => void;
  updateNode: (updatedNode: DiagramNode, saveHistory?: boolean) => void;
  updateMultipleNodes: (ids: string[], updates: Partial<DiagramNode>) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  moveSelectedNodes: (draggedNodeId: string, position: { x: number; y: number }) => void;
  splitElbowLine: (id: string) => void;
  resizeNode: (id: string, dimensions: { width: number; height: number }, position: { x: number; y: number }) => void;
  selectNode: (id: string | null, multi?: boolean) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setNodes: (nodes: DiagramNode[] | ((prev: DiagramNode[]) => DiagramNode[])) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  bringForward: (ids: string[]) => void;
  sendBackward: (ids: string[]) => void;
  activeSnapLines: SnapLine[];
  setActiveSnapLines: (lines: SnapLine[]) => void;
  alignSelected: (alignmentType: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  selectToolMode: 'move' | 'scale';
  setSelectToolMode: (mode: 'move' | 'scale') => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  projects: WorkspaceProject[];
  activeProjectId: string;
  activeFileId: string;
  switchProject: (id: string, fileId?: string) => void;
  addProject: (name: string, category?: string, backgroundColor?: string) => Promise<WorkspaceProject | null | void>;
  switchFile: (id: string, projectId?: string) => void;
  addFile: (projectId: string, name: string, backgroundColor?: string) => Promise<string | undefined>;
  updateProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateFile: (id: string, name: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  updateCanvasConfig: (fileId: string, config: Partial<CanvasConfig>) => void;
  isLoadingProjects: boolean;
  isFileLoading: boolean;
  
  // Sidebar state
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // AI Chat state
  isAiChatOpen: boolean;
  toggleAiChat: () => void;

  // Version History state
  isVersionHistoryOpen: boolean;
  toggleVersionHistory: () => void;
  versions: { id: string; createdAt: number }[];
  fetchVersions: (fileId?: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;

  // Design Panel state
  isDesignPanelOpen: boolean;
  toggleDesignPanel: () => void;
  
  // History states/functions
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveHistoryState: (customNodes: DiagramNode[]) => void;
  
  // Clipboard functions
  copySelected: () => void;
  pasteSelected: () => void;
  cutSelected: () => void;
  deleteSelected: () => void;
  
  // Theme state
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  // Save status
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
}

const DiagramContext = createContext<DiagramContextType | undefined>(undefined);

const initialProjects: WorkspaceProject[] = [
  {
    id: 'project-1',
    name: 'Arc Diagram',
    category: 'Arc Diagrams',
    updatedAt: Date.now(),
    files: [
      {
        id: 'file-1',
        name: 'Main Canvas',
        updatedAt: Date.now(),
        canvasConfig: { backgroundColor: '#0f0f0f' },
        nodes: [
          {
            id: 'node-1',
            type: 'box',
            position: { x: 80, y: 80 },
            dimensions: { width: 160, height: 100 },
            content: 'Figma Canvas',
            style: {
              backgroundColor: '#2c2c2c',
              borderColor: '#555555',
              color: '#e3e3e3'
            }
          },
          {
            id: 'node-2',
            type: 'circle',
            position: { x: 340, y: 80 },
            dimensions: { width: 100, height: 100 },
            content: 'Brainstorm',
            style: {
              backgroundColor: '#2c2c2c',
              borderColor: '#555555',
              color: '#e3e3e3'
            }
          },
          {
            id: 'node-3',
            type: 'arrow',
            position: { x: 240, y: 120 },
            dimensions: { width: 100, height: 20 },
            content: '',
            style: {
              borderColor: '#0c8ce9'
            },
            startPoint: { x: 240, y: 130 },
            endPoint: { x: 340, y: 130 }
          }
        ]
      }
    ]
  },
  {
    id: 'project-2',
    name: 'Personal Flowchart',
    category: 'Arc Diagrams',
    updatedAt: Date.now() - 3600000,
    files: [
      {
        id: 'file-2',
        name: 'Untitled',
        updatedAt: Date.now() - 3600000,
        canvasConfig: { backgroundColor: '#0f0f0f' },
        nodes: []
      }
    ]
  },
  {
    id: 'project-3',
    name: 'Personal Wireframe',
    category: 'Website Wireframes',
    updatedAt: Date.now() - 86400000,
    files: []
  }
];

export function DiagramProvider({ children }: { children: ReactNode }) {
  const { isGuest, isAuthenticated, isLoading } = useAuth();
  const [projects, setProjects] = useState<WorkspaceProject[]>(isGuest ? initialProjects : []);
  const [activeProjectId, setActiveProjectId] = useState<string>(isGuest ? 'project-1' : '');
  const [activeFileId, setActiveFileId] = useState<string>(isGuest ? 'file-1' : '');
  const [nodes, setNodesState] = useState<DiagramNode[]>(isGuest ? initialProjects[0].files[0].nodes : []);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  useEffect(() => {
    console.log('nodes state updated to:', nodes);
  }, [nodes]);
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [activeSnapLines, setActiveSnapLines] = useState<SnapLine[]>([]);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [selectToolMode, setSelectToolMode] = useState<'move' | 'scale'>('move');
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  
  const { connectToFile, broadcast, incomingActions, clearIncomingActions } = useCollaboration();

  // Connect to WebSocket room for this file
  useEffect(() => {
    connectToFile(activeFileId);
  }, [activeFileId, connectToFile]);

  // Process incoming WebSocket actions
  useEffect(() => {
    if (incomingActions.length > 0) {
      setNodesState(prev => {
        let next = [...prev];
        incomingActions.forEach(action => {
          if (action.type === 'NODE_MOVED') {
            next = next.map(node => node.id === action.payload.id ? { ...node, position: action.payload.position, startPoint: action.payload.startPoint, endPoint: action.payload.endPoint } : node);
          } else if (action.type === 'NODE_ADDED') {
            next.push(action.payload);
          } else if (action.type === 'NODE_UPDATED') {
            next = next.map(node => node.id === action.payload.id ? { ...node, ...action.payload } : node);
          } else if (action.type === 'NODES_DELETED') {
            const idsToDelete = action.payload.ids as string[];
            next = next.filter(node => !idsToDelete.includes(node.id));
          }
        });
        return next;
      });
      clearIncomingActions();
    }
  }, [incomingActions, clearIncomingActions]);

  // Fetch projects from backend
  useEffect(() => {
    if (isLoading) return; // Wait for Auth context to resolve

    if (isGuest) {
      setProjects(initialProjects);
      setActiveProjectId('project-1');
      setActiveFileId('file-1');
      setNodesState(initialProjects[0].files[0].nodes);
      setIsLoadingProjects(false);
      return;
    }
    
    if (isAuthenticated) {
      const fetchProjects = async () => {
        setIsLoadingProjects(true);
        try {
          const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
          const response = await fetch(`${arcApiUrl}/api/projects`, { credentials: 'include' });
          
          if (response.ok) {
            const data = await response.json();
            const mappedProjects: WorkspaceProject[] = data.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.category || 'Arc Diagrams',
              updatedAt: p.updatedAt,
              files: p.files.map((f: any) => ({
                id: f.id,
                name: f.name,
                updatedAt: f.updatedAt,
                canvasConfig: { backgroundColor: f.canvasBgColor || '#0f0f0f' },
                nodes: []
              }))
            }));
            
            setProjects(mappedProjects);
            
            if (mappedProjects.length > 0) {
              setActiveProjectId(mappedProjects[0].id);
              if (mappedProjects[0].files.length > 0) {
                setActiveFileId(mappedProjects[0].files[0].id);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch projects', error);
        } finally {
          setIsLoadingProjects(false);
        }
      };
      
      fetchProjects();
    }
  }, [isGuest, isAuthenticated, isLoading]);
  
  // History stack states
  const [past, setPast] = useState<DiagramNode[][]>([]);
  const [future, setFuture] = useState<DiagramNode[][]>([]);
  
  // Clipboard state
  const [clipboard, setClipboard] = useState<DiagramNode[]>([]);

  // Sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  // AI Chat open/close state
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const toggleAiChat = () => setIsAiChatOpen(prev => !prev);

  // Version History state
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<{ id: string; createdAt: number }[]>([]);

  const toggleVersionHistory = () => {
    setIsVersionHistoryOpen(prev => {
      const next = !prev;
      if (next) {
        fetchVersions();
      }
      return next;
    });
  };

  const fetchVersions = async (fileId: string = activeFileId) => {
    if (isGuest || !fileId) return;
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/files/${fileId}/versions`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    }
  };

  const restoreVersion = async (versionId: string) => {
    if (isGuest || !activeFileId) return;
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/files/${activeFileId}/versions/${versionId}/restore`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.nodes) {
          setNodesState(data.nodes);
          saveHistoryState(data.nodes);
          fetchVersions();
        }
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
    }
  };

  // Design Panel open/close state
  const [isDesignPanelOpen, setIsDesignPanelOpen] = useState(false);
  const toggleDesignPanel = () => setIsDesignPanelOpen(prev => !prev);

  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      setIsDesignPanelOpen(true);
    } else {
      setIsDesignPanelOpen(false);
    }
  }, [selectedNodeIds]);

  // Theme state initialization with persistence and system preference
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('arc-theme') as 'light' | 'dark';
    if (savedTheme) return savedTheme;
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('arc-theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      return nextTheme;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('arc-theme', theme);
  }, [theme]);

  // Synced setNodes state wrapper
  const setNodes = (newNodes: DiagramNode[] | ((prev: DiagramNode[]) => DiagramNode[])) => {
    console.log('setNodes called with:', newNodes);
    setNodesState(newNodes);
  };

  // Sync nodes state to projects array whenever nodes change
  useEffect(() => {
    setProjects(prevProjects => 
      prevProjects.map(p => {
        if (p.id === activeProjectId) {
          const updatedFiles = p.files.map(f => 
            f.id === activeFileId ? { ...f, nodes, updatedAt: Date.now() } : f
          );
          return { ...p, files: updatedFiles, updatedAt: Date.now() };
        }
        return p;
      })
    );
  }, [nodes, activeProjectId, activeFileId]);

  // Auto-save mechanism with 1000ms debounce
  const debouncedNodes = useDebounce(nodes, 1000);
  const isInitialMount = useRef(true);

  const lastSavedNodesStr = useRef<string>('');

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!activeFileId || isGuest || isFileLoading) return;

    const autoSave = async () => {
      try {
        const targetFile = projects.find(p => p.id === activeProjectId)?.files.find(f => f.id === activeFileId);
        if (!targetFile) return;

        const currentNodesStr = JSON.stringify(debouncedNodes);
        
        // Ensure debouncedNodes has caught up to nodes
        // This prevents saving stale state from a previous file immediately after switching
        if (JSON.stringify(nodes) !== currentNodesStr) {
          setSaveStatus('unsaved');
          return;
        }

        if (currentNodesStr === lastSavedNodesStr.current) {
          // No changes since last save/load, skip saving
          setSaveStatus('saved');
          return;
        }

        setSaveStatus('saving');
        const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
        const response = await fetch(`${arcApiUrl}/api/files/${activeFileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            name: targetFile.name,
            canvasBgColor: targetFile.canvasConfig.backgroundColor,
            nodes: debouncedNodes 
          })
        });
        
        if (!response.ok) {
          console.error('Auto-save failed:', response.statusText);
          setSaveStatus('error');
        } else {
          lastSavedNodesStr.current = currentNodesStr;
          setSaveStatus('saved');
          fetchVersions();
        }
      } catch (error) {
        console.error('Failed to auto-save to backend:', error);
        setSaveStatus('error');
      }
    };

    autoSave();
  }, [debouncedNodes, nodes, activeFileId, isGuest, isFileLoading, activeProjectId, projects]);

  // Save specific nodes list to history
  const saveHistoryState = useCallback((customNodes: DiagramNode[]) => {
    setPast(prev => [...prev, [...customNodes]]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture(prev => [[...nodes], ...prev]);
    setNodesState([...previous]);
    setPast(newPast);
  }, [past, nodes, activeProjectId]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, [...nodes]]);
    setNodesState([...next]);
    setFuture(newFuture);
  }, [future, nodes, activeProjectId]);

  const copySelected = () => {
    if (selectedNodeIds.length === 0) return;
    const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
    setClipboard(selectedNodes);
  };

  const cutSelected = () => {
    if (selectedNodeIds.length === 0) return;
    saveHistoryState(nodes);
    const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
    setClipboard(selectedNodes);
    setNodes(prev => prev.filter(node => !selectedNodeIds.includes(node.id)));
    setSelectedNodeIds([]);
  };

  const deleteSelected = () => {
    if (selectedNodeIds.length === 0) return;
    saveHistoryState(nodes);
    setNodes(prev => prev.filter(node => !selectedNodeIds.includes(node.id)));
    broadcast('NODES_DELETED', { ids: selectedNodeIds });
    setSelectedNodeIds([]);
  };

  const pasteSelected = () => {
    if (clipboard.length === 0) return;
    saveHistoryState(nodes);
    
    const newNodes = clipboard.map(node => {
      const newId = Math.random().toString(36).substring(2, 10);
      const offsetPos = {
        x: node.position.x + 20,
        y: node.position.y + 20
      };
      
      const extra: Partial<DiagramNode> = {};
      if (node.startPoint && node.endPoint) {
        extra.startPoint = {
          x: node.startPoint.x + 20,
          y: node.startPoint.y + 20
        };
        extra.endPoint = {
          x: node.endPoint.x + 20,
          y: node.endPoint.y + 20
        };
      }
      
      return {
        ...node,
        id: newId,
        position: offsetPos,
        ...extra
      };
    });
    
    setNodes(prev => [...prev, ...newNodes]);
    setSelectedNodeIds(newNodes.map(n => n.id));
    setClipboard(newNodes);
  };

  const addBox = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 150;
    const height = 100;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'box',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 50, y: 50 },
      dimensions: { width, height },
      content: 'New Box',
      style: {
        backgroundColor: '#2c2c2c',
        borderColor: '#555555',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
    broadcast('NODE_ADDED', newNode);
  };

  const addDiamond = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 120;
    const height = 120;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'diamond',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 80, y: 80 },
      dimensions: { width, height },
      content: 'New Diamond',
      style: {
        backgroundColor: '#2e2c24',
        borderColor: '#c69c3a',
        color: '#e3e3e3',
        borderRadius: '2px'
      }
    };
    setNodes((prev) => [...prev, newNode]);
    broadcast('NODE_ADDED', newNode);
  };

  const addCircle = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 100;
    const height = 100;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'circle',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 100, y: 100 },
      dimensions: { width, height },
      content: 'New Circle',
      style: {
        backgroundColor: '#2c2c2c',
        borderColor: '#555555',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
    broadcast('NODE_ADDED', newNode);
  };

  const addTriangle = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 120;
    const height = 100;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'triangle',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 120, y: 120 },
      dimensions: { width, height },
      content: 'New Triangle',
      style: {
        backgroundColor: '#1c2e24',
        borderColor: '#2b8a4e',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addStar = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 110;
    const height = 110;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'star',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 150, y: 150 },
      dimensions: { width, height },
      content: 'New Star',
      style: {
        backgroundColor: '#38301b',
        borderColor: '#9e7c1d',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addPill = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 150;
    const height = 60;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'pill',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 50, y: 250 },
      dimensions: { width, height },
      content: 'New Pill',
      style: {
        backgroundColor: '#2c2c2c',
        borderColor: '#555555',
        color: '#e3e3e3',
        borderRadius: '30px'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addHexagon = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 120;
    const height = 100;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'hexagon',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 150, y: 250 },
      dimensions: { width, height },
      content: 'New Hexagon',
      style: {
        backgroundColor: '#2e2438',
        borderColor: '#824ea0',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addParallelogram = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 150;
    const height = 100;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'parallelogram',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 250, y: 250 },
      dimensions: { width, height },
      content: 'New Parallelogram',
      style: {
        backgroundColor: '#242e38',
        borderColor: '#4e82a0',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addDatabase = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 100;
    const height = 120;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'database',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 350, y: 250 },
      dimensions: { width, height },
      content: 'New DB',
      style: {
        backgroundColor: '#382424',
        borderColor: '#a04e4e',
        color: '#e3e3e3'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addNote = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 140;
    const height = 140;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'note',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 450, y: 250 },
      dimensions: { width, height },
      content: 'New Note',
      style: {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        color: '#92400e',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addLine = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 200;
    const height = 20;
    const startX = position ? position.x - width / 2 : 150;
    const startY = position ? position.y - height / 2 : 150;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'line',
      position: { x: startX, y: startY },
      dimensions: { width, height },
      content: '',
      style: {
        borderColor: '#888888',
      },
      startPoint: { x: startX, y: startY + 10 },
      endPoint: { x: startX + width, y: startY + 10 }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addArrow = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 200;
    const height = 20;
    const startX = position ? position.x - width / 2 : 150;
    const startY = position ? position.y - height / 2 : 200;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'arrow',
      position: { x: startX, y: startY },
      dimensions: { width, height },
      content: '',
      style: {
        borderColor: '#0c8ce9',
      },
      startPoint: { x: startX, y: startY + 10 },
      endPoint: { x: startX + width, y: startY + 10 }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addCustomBlock = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 160;
    const height = 120;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'custom-block',
      position: position ? { x: position.x - width / 2, y: position.y - height / 2 } : { x: 100, y: 100 },
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
    setNodes((prev) => [...prev, newNode]);
  };

  const addCustomConnector = (position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const width = 200;
    const height = 20;
    const startX = position ? position.x - width / 2 : 150;
    const startY = position ? position.y - height / 2 : 200;
    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: 'custom-connector',
      position: { x: startX, y: startY },
      dimensions: { width, height },
      content: '',
      style: {
        borderColor: '#e74c3c',
        borderStyle: 'dashed',
        borderWidth: '2px',
        opacity: '0.8'
      },
      startPoint: { x: startX, y: startY + 10 },
      endPoint: { x: startX + width, y: startY + 10 },
      customConnectorStyle: {
        borderBottomColor: '#e74c3c',
        borderWidth: '12px'
      }
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const addShape = (type: string, position?: { x: number; y: number }) => {
    saveHistoryState(nodes);
    const isEdge = type === 'line' || type === 'arrow';
    const isDiamond = type === 'diamond' || type === 'decision-merge';
    const isUML = type.startsWith('uml-') || type === 'actor' || type === 'use-case' || type === 'component';
    const isCircle = type === 'circle' || type === 'use-case';
    const isTerminator = type === 'terminator';
    
    const width = isDiamond || isCircle ? 130 : isTerminator ? 160 : isUML ? 220 : 160;
    const height = isDiamond || isCircle ? 130 : isTerminator ? 60 : isUML ? 120 : 90;

    const cx = position ? position.x : 200;
    const cy = position ? position.y : 200;

    if (isEdge) {
      const startX = cx - 80;
      const startY = cy;
      const newNode: DiagramNode = {
        id: Math.random().toString(36).substring(2, 10),
        type: type as any,
        position: { x: startX, y: startY - 10 },
        dimensions: { width: 160, height: 20 },
        content: '',
        style: { borderColor: type === 'arrow' ? '#0c8ce9' : '#888888' },
        startPoint: { x: startX, y: startY },
        endPoint: { x: startX + 160, y: startY },
      };
      setNodes((prev) => [...prev, newNode]);
      return;
    }

    const newNode: DiagramNode = {
      id: Math.random().toString(36).substring(2, 10),
      type: type as any,
      position: { x: cx - width / 2, y: cy - height / 2 },
      dimensions: { width, height },
      content: type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' '),
      style: {
        backgroundColor: '#2c2c2c',
        borderColor: '#555555',
        color: '#e3e3e3',
      },
      ...(isUML && {
        sections: [
          { title: 'Attributes', items: ['+ field: Type'] },
          { title: 'Methods', items: ['+ method(): void'] },
        ]
      })
    };
    setNodes((prev) => [...prev, newNode]);
    broadcast('NODE_ADDED', newNode);
  };

  const splitElbowLine = (id: string) => {
    setNodes(prev => {
      const node = prev.find(n => n.id === id);
      if (!node || node.routing !== 'elbow' || !node.startPoint || !node.endPoint) return prev;
      
      const isVerticalElbow = node.startConnection?.anchor === 'bottom' || node.startConnection?.anchor === 'top' || !node.startConnection?.anchor;
      
      const points = isVerticalElbow ? [
        { x: node.startPoint.x, y: node.startPoint.y },
        { x: node.startPoint.x, y: node.startPoint.y + (node.endPoint.y - node.startPoint.y) / 2 },
        { x: node.endPoint.x, y: node.startPoint.y + (node.endPoint.y - node.startPoint.y) / 2 },
        { x: node.endPoint.x, y: node.endPoint.y }
      ] : [
        { x: node.startPoint.x, y: node.startPoint.y },
        { x: node.startPoint.x + (node.endPoint.x - node.startPoint.x) / 2, y: node.startPoint.y },
        { x: node.startPoint.x + (node.endPoint.x - node.startPoint.x) / 2, y: node.endPoint.y },
        { x: node.endPoint.x, y: node.endPoint.y }
      ];

      const validPoints = [points[0]];
      for (let i = 1; i < points.length; i++) {
        const p1 = validPoints[validPoints.length - 1];
        const p2 = points[i];
        if (Math.abs(p1.x - p2.x) > 1 || Math.abs(p1.y - p2.y) > 1) {
          validPoints.push(p2);
        }
      }

      if (validPoints.length < 2) return prev;

      const newLines: DiagramNode[] = [];
      for (let i = 0; i < validPoints.length - 1; i++) {
        const newId = `line-${Math.random().toString(36).substring(2, 8)}`;
        const p1 = validPoints[i];
        const p2 = validPoints[i+1];
        const isFirst = i === 0;
        const isLast = i === validPoints.length - 2;
        
        const newLine: DiagramNode = {
          ...node,
          id: newId,
          routing: 'straight',
          startPoint: { ...p1 },
          endPoint: { ...p2 },
          position: { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          dimensions: { width: Math.max(15, Math.abs(p2.x - p1.x)), height: Math.max(15, Math.abs(p2.y - p1.y)) },
          startConnection: isFirst ? node.startConnection : { nodeId: newLines[i-1].id, anchor: 'closest' },
          endConnection: isLast ? node.endConnection : undefined,
          arrowType: isLast ? (node.arrowType || (node.type === 'arrow' ? 'single' : 'none')) : 'none',
        };
        
        newLine.waypoints = undefined;
        newLines.push(newLine);
      }

      saveHistoryState(prev);
      return [...prev.filter(n => n.id !== node.id), ...newLines];
    });
    setSelectedNodeIds([]);
  };

  const updateLinePoints = (id: string, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) => {

    setNodes((prev) => prev.map(node => {
      if (node.id === id) {
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.max(15, Math.abs(endPoint.x - startPoint.x));
        const height = Math.max(15, Math.abs(endPoint.y - startPoint.y));
        
        return {
          ...node,
          startPoint,
          endPoint,
          position: { x, y },
          dimensions: { width, height }
        };
      }
      return node;
    }));
  };

  const updateWaypoint = (id: string, index: number, pos: { x: number; y: number }) => {
    setNodes((prev) => prev.map(node => {
      if (node.id === id && node.waypoints) {
        const newWaypoints = [...node.waypoints];
        if (index >= 0 && index < newWaypoints.length) {
          newWaypoints[index] = pos;
          return {
            ...node,
            waypoints: newWaypoints
          };
        }
      }
      return node;
    }));
  };

  const updateNode = (updatedNode: DiagramNode, saveHistory: boolean = true) => {
    if (saveHistory) {
      saveHistoryState(nodes);
    }
    setNodes((prev) => {
      const nextNodes = prev.map(node => node.id === updatedNode.id ? updatedNode : node);
      let finalNodes = [...nextNodes];
      let didCascade = false;
      for (let i = 0; i < finalNodes.length; i++) {
        const node = finalNodes[i];
        if ((node.type === 'line' || node.type === 'arrow') && (node.startConnection?.nodeId === updatedNode.id || node.endConnection?.nodeId === updatedNode.id)) {
          const newNode = { ...node };
          if (node.startConnection?.nodeId === updatedNode.id) {
            newNode.startPoint = getAnchorPoint(updatedNode, node.startConnection.anchor, node.endPoint);
          }
          if (node.endConnection?.nodeId === updatedNode.id) {
            newNode.endPoint = getAnchorPoint(updatedNode, node.endConnection.anchor, node.startPoint);
          }
          const minX = Math.min(newNode.startPoint!.x, newNode.endPoint!.x);
          const minY = Math.min(newNode.startPoint!.y, newNode.endPoint!.y);
          newNode.position = { x: minX, y: minY };
          newNode.dimensions = { 
            width: Math.max(15, Math.abs(newNode.endPoint!.x - newNode.startPoint!.x)),
            height: Math.max(15, Math.abs(newNode.endPoint!.y - newNode.startPoint!.y))
          };
          newNode.waypoints = undefined;
          finalNodes[i] = newNode;
          didCascade = true;
        }
      }
      return didCascade ? finalNodes : nextNodes;
    });
    broadcast('NODE_UPDATED', updatedNode);
  };

  const updateMultipleNodes = (ids: string[], updates: Partial<DiagramNode>) => {
    saveHistoryState(nodes);
    setNodes((prev) => prev.map(node => {
      if (ids.includes(node.id)) {
        const newStyle = updates.style 
          ? { ...node.style, ...updates.style } 
          : node.style;
        return {
          ...node,
          ...updates,
          style: newStyle
        } as DiagramNode;
      }
      return node;
    }));
  };

  const moveNode = (id: string, position: { x: number; y: number }) => {
    saveHistoryState(nodes);
    setNodes((prev) => {
      const updatedNodes = prev.map(node => {
        if (node.id === id) {
          if (node.startPoint && node.endPoint) {
            const dx = position.x - node.position.x;
            const dy = position.y - node.position.y;
            return {
              ...node,
              position,
              startPoint: { x: node.startPoint.x + dx, y: node.startPoint.y + dy },
              endPoint: { x: node.endPoint.x + dx, y: node.endPoint.y + dy }
            };
          }
          return { ...node, position };
        }
        return node;
      });

      // Update any lines/arrows connected to this node
      return updatedNodes.map(node => {
        if ((node.type === 'line' || node.type === 'arrow') && (node.startConnection?.nodeId === id || node.endConnection?.nodeId === id)) {
          const newNode = { ...node };
          const movedNode = updatedNodes.find(n => n.id === id)!;

          if (node.startConnection?.nodeId === id) {
            newNode.startPoint = getAnchorPoint(movedNode, node.startConnection.anchor, node.endPoint);
          }
          if (node.endConnection?.nodeId === id) {
            newNode.endPoint = getAnchorPoint(movedNode, node.endConnection.anchor, node.startPoint);
          }

          // Recalculate bounding box for the line
          const minX = Math.min(newNode.startPoint!.x, newNode.endPoint!.x);
          const minY = Math.min(newNode.startPoint!.y, newNode.endPoint!.y);
          const width = Math.max(15, Math.abs(newNode.endPoint!.x - newNode.startPoint!.x));
          const height = Math.max(15, Math.abs(newNode.endPoint!.y - newNode.startPoint!.y));
          
          newNode.position = { x: minX, y: minY };
          newNode.dimensions = { width, height };
          newNode.waypoints = undefined; // Reset custom path on node drag
          broadcast('NODE_UPDATED', newNode);
          return newNode;
        }
        return node;
      });
    });
    
    // Broadcast the main node move
    const finalNodes = nodes;
    const nodeToBroadcast = finalNodes.find(n => n.id === id);
    if (nodeToBroadcast) {
        broadcast('NODE_MOVED', { 
            id, 
            position, 
            startPoint: nodeToBroadcast.startPoint, 
            endPoint: nodeToBroadcast.endPoint 
        });
    }
  };

  const getAnchorPoint = (node: DiagramNode, anchor: 'top' | 'bottom' | 'left' | 'right' | 'closest' | 'start' | 'end', currentPoint?: { x: number; y: number }) => {
    if (node.type === 'line' || node.type === 'arrow') {
      if (anchor === 'start' && node.startPoint) return { ...node.startPoint };
      if (anchor === 'end' && node.endPoint) return { ...node.endPoint };
      if (anchor === 'closest' && currentPoint) return getClosestPointOnLineNode(currentPoint, node);
    }
    const { x, y } = node.position;
    const { width, height } = node.dimensions;
    switch (anchor) {
      case 'top': return { x: x + width / 2, y };
      case 'bottom': return { x: x + width / 2, y: y + height };
      case 'left': return { x, y: y + height / 2 };
      case 'right': return { x: x + width, y: y + height / 2 };
      case 'start': return { x: x + width / 2, y: y + height / 2 };
      case 'end': return { x: x + width / 2, y: y + height / 2 };
      case 'closest': {
        if (!currentPoint) return { x: x + width / 2, y: y + height / 2 };
        const cx = x + width / 2;
        const cy = y + height / 2;
        const anchors = [
          { point: { x: cx, y }, name: 'top' as const },
          { point: { x: cx, y: y + height }, name: 'bottom' as const },
          { point: { x, y: cy }, name: 'left' as const },
          { point: { x: x + width, y: cy }, name: 'right' as const },
        ];
        let best = anchors[0];
        let bestDist = Infinity;
        for (const a of anchors) {
          const dx = a.point.x - currentPoint.x;
          const dy = a.point.y - currentPoint.y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = a;
          }
        }
        return best.point;
      }
    }
  };

  const moveSelectedNodes = (draggedNodeId: string, position: { x: number; y: number }) => {
    saveHistoryState(nodes);
    setNodes((prev) => {
      const draggedNode = prev.find(n => n.id === draggedNodeId);
      if (!draggedNode) return prev;

      const dx = position.x - draggedNode.position.x;
      const dy = position.y - draggedNode.position.y;

      if (dx === 0 && dy === 0) return prev;

      const movedIds = selectedNodeIds;
      const updatedNodes = prev.map(node => {
        if (movedIds.includes(node.id)) {
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

      // Update lines connected to moved nodes (if the line itself isn't being moved)
      return updatedNodes.map(node => {
        const isLine = node.type === 'line' || node.type === 'arrow';
        if (isLine && !movedIds.includes(node.id)) {
          let needsUpdate = false;
          const newNode = { ...node };

          if (node.startConnection && movedIds.includes(node.startConnection.nodeId)) {
            const connectedNode = updatedNodes.find(n => n.id === node.startConnection!.nodeId)!;
            newNode.startPoint = getAnchorPoint(connectedNode, node.startConnection.anchor, node.endPoint);
            needsUpdate = true;
          }
          if (node.endConnection && movedIds.includes(node.endConnection.nodeId)) {
            const connectedNode = updatedNodes.find(n => n.id === node.endConnection!.nodeId)!;
            newNode.endPoint = getAnchorPoint(connectedNode, node.endConnection.anchor, node.startPoint);
            needsUpdate = true;
          }

          if (needsUpdate) {
            const minX = Math.min(newNode.startPoint!.x, newNode.endPoint!.x);
            const minY = Math.min(newNode.startPoint!.y, newNode.endPoint!.y);
            newNode.position = { x: minX, y: minY };
            newNode.dimensions = { 
              width: Math.max(15, Math.abs(newNode.endPoint!.x - newNode.startPoint!.x)), 
              height: Math.max(15, Math.abs(newNode.endPoint!.y - newNode.startPoint!.y)) 
            };
            newNode.waypoints = undefined; // Reset custom path on node drag
            return newNode;
          }
        }
        return node;
      });
    });
  };

  const resizeNode = (
    id: string, 
    dimensions: { width: number; height: number }, 
    position: { x: number; y: number }
  ) => {
    saveHistoryState(nodes);
    setNodes((prev) => prev.map(node => 
      node.id === id ? { ...node, dimensions, position } : node
    ));
  };

  const selectNode = (id: string | null, multi: boolean = false) => {
    if (id === null) {
      setSelectedNodeIds([]);
      return;
    }
    
    // Find the node to check if it's in a group
    const targetNode = nodes.find(n => n.id === id);
    const groupId = targetNode?.groupId;
    
    let idsToSelect = [id];
    
    // If it has a groupId, select all nodes in that group
    if (groupId) {
      idsToSelect = nodes.filter(n => n.groupId === groupId).map(n => n.id);
    }
    
    setSelectedNodeIds(prev => {
      if (multi) {
        // Toggle selection for all idsToSelect
        const allSelected = idsToSelect.every(item => prev.includes(item));
        if (allSelected) {
          return prev.filter(p => !idsToSelect.includes(p));
        } else {
          return [...new Set([...prev, ...idsToSelect])];
        }
      }
      return idsToSelect;
    });
  };

  const groupSelected = () => {
    if (selectedNodeIds.length < 2) return;
    const newGroupId = `group-${Math.random().toString(36).substring(2, 10)}`;
    saveHistoryState(nodes);
    setNodes(prev => prev.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        return { ...node, groupId: newGroupId };
      }
      return node;
    }));
  };

  const ungroupSelected = () => {
    if (selectedNodeIds.length === 0) return;
    saveHistoryState(nodes);
    setNodes(prev => prev.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        const { groupId, ...rest } = node;
        return rest as DiagramNode;
      }
      return node;
    }));
  };

  const bringToFront = (ids: string[]) => {
    saveHistoryState(nodes);
    setNodes((prev) => {
      const selected = prev.filter((node) => ids.includes(node.id));
      const unselected = prev.filter((node) => !ids.includes(node.id));
      return [...unselected, ...selected];
    });
  };

  const sendToBack = (ids: string[]) => {
    saveHistoryState(nodes);
    setNodes((prev) => {
      const selected = prev.filter((node) => ids.includes(node.id));
      const unselected = prev.filter((node) => !ids.includes(node.id));
      return [...selected, ...unselected];
    });
  };

  const bringForward = (ids: string[]) => {
    saveHistoryState(nodes);
    setNodes((prev) => {
      const result = [...prev];
      // We want to move selected items one position up, 
      // but if multiple are selected, we should preserve their relative order
      // and move the group up past the first non-selected element after them.
      for (let i = result.length - 2; i >= 0; i--) {
        if (ids.includes(result[i].id) && !ids.includes(result[i + 1].id)) {
          // Swap with the element above
          const temp = result[i];
          result[i] = result[i + 1];
          result[i + 1] = temp;
        }
      }
      return result;
    });
  };

  const sendBackward = (ids: string[]) => {
    saveHistoryState(nodes);
    setNodes((prev) => {
      const result = [...prev];
      for (let i = 1; i < result.length; i++) {
        if (ids.includes(result[i].id) && !ids.includes(result[i - 1].id)) {
          // Swap with the element below
          const temp = result[i];
          result[i] = result[i - 1];
          result[i - 1] = temp;
        }
      }
      return result;
    });
  };

  const alignSelected = (alignmentType: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedNodeIds.length === 0) return;

    saveHistoryState(nodes);
    setNodes((prev) => {
      const selectedNodes = prev.filter(n => selectedNodeIds.includes(n.id) && n.type !== 'line' && n.type !== 'arrow');
      if (selectedNodes.length === 0) return prev;

      if (selectedNodes.length === 1) {
        const node = selectedNodes[0];
        const canvasWidth = 1000;
        const canvasHeight = 800;
        let newX = node.position.x;
        let newY = node.position.y;

        switch (alignmentType) {
          case 'left':
            newX = 0;
            break;
          case 'right':
            newX = canvasWidth - node.dimensions.width;
            break;
          case 'center':
            newX = (canvasWidth - node.dimensions.width) / 2;
            break;
          case 'top':
            newY = 0;
            break;
          case 'bottom':
            newY = canvasHeight - node.dimensions.height;
            break;
          case 'middle':
            newY = (canvasHeight - node.dimensions.height) / 2;
            break;
        }

        return prev.map(n => n.id === node.id ? { ...n, position: { x: newX, y: newY } } : n);
      }

      const lefts = selectedNodes.map(n => n.position.x);
      const rights = selectedNodes.map(n => n.position.x + n.dimensions.width);
      const tops = selectedNodes.map(n => n.position.y);
      const bottoms = selectedNodes.map(n => n.position.y + n.dimensions.height);

      const minX = Math.min(...lefts);
      const maxX = Math.max(...rights);
      const minY = Math.min(...tops);
      const maxY = Math.max(...bottoms);

      const targetCenterX = minX + (maxX - minX) / 2;
      const targetCenterY = minY + (maxY - minY) / 2;

      return prev.map(node => {
        if (!selectedNodeIds.includes(node.id) || node.type === 'line' || node.type === 'arrow') return node;

        let newX = node.position.x;
        let newY = node.position.y;

        switch (alignmentType) {
          case 'left':
            newX = minX;
            break;
          case 'right':
            newX = maxX - node.dimensions.width;
            break;
          case 'center':
            newX = targetCenterX - node.dimensions.width / 2;
            break;
          case 'top':
            newY = minY;
            break;
          case 'bottom':
            newY = maxY - node.dimensions.height;
            break;
          case 'middle':
            newY = targetCenterY - node.dimensions.height / 2;
            break;
        }

        return {
          ...node,
          position: { x: newX, y: newY }
        };
      });
    });
  };

  const switchProject = async (targetId: string, targetFileId?: string) => {
    const target = projects.find(p => p.id === targetId);
    if (!target) return;
    
    let targetFile = null;
    if (targetFileId) {
      targetFile = target.files.find(f => f.id === targetFileId) || null;
    }
    if (!targetFile && target.files.length > 0) {
      targetFile = target.files[0];
    }
    
    if (!targetFile && isGuest) {
      const newFileId = Math.random().toString(36).substring(2, 10);
      targetFile = {
        id: newFileId, name: 'Untitled', updatedAt: Date.now(),
        canvasConfig: { backgroundColor: '#0f0f0f' }, nodes: []
      };
      setProjects(prev => prev.map(p => p.id === targetId ? { ...p, files: [targetFile!] } : p));
    }
    
    if (targetFile) {
      await switchFile(targetFile.id, targetId);
    }
  };

  const addProject = async (name: string, category: string = 'Arc Diagrams', backgroundColor: string = '#0f0f0f') => {
    if (isGuest) {
      const newId = Math.random().toString(36).substring(2, 10);
      const newFileId = Math.random().toString(36).substring(2, 10);
      const newProj: WorkspaceProject = {
        id: newId, name, category, updatedAt: Date.now(),
        files: [{ id: newFileId, name: 'Untitled', updatedAt: Date.now(), canvasConfig: { backgroundColor }, nodes: [] }]
      };
      setProjects(prev => [...prev, newProj]);
      setNodesState([]);
      setSelectedNodeIds([]);
      setActiveProjectId(newId);
      setActiveFileId(newFileId);
      setPast([]);
      setFuture([]);
      return newProj;
    }

    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, category })
      });
      
      if (response.ok) {
        const data = await response.json();
        const newProj: WorkspaceProject = {
          id: data.id, name: data.name, category: data.category, updatedAt: data.updatedAt,
          files: data.files?.map((f: any) => ({
            id: f.id, name: f.name, updatedAt: f.updatedAt,
            canvasConfig: { backgroundColor: f.canvasBgColor || '#0f0f0f' },
            nodes: []
          })) || []
        };
        
        setProjects(prev => [...prev, newProj]);
        setActiveProjectId(newProj.id);
        
        if (newProj.files.length === 0) {
           await addFile(newProj.id, 'Untitled', backgroundColor);
        } else {
           await switchFile(newProj.files[0].id, newProj.id);
        }
        return newProj;
      }
    } catch (error) {
      console.error('Failed to create project', error);
    }
    return null;
  };

  const switchFile = async (fileId: string, projectId: string = activeProjectId) => {
    const targetProj = projects.find(p => p.id === projectId);
    if (!targetProj) return;
    const targetFile = targetProj.files.find(f => f.id === fileId);
    if (!targetFile) return;

    setActiveProjectId(projectId);
    setActiveFileId(fileId);
    setSelectedNodeIds([]);
    setPast([]);
    setFuture([]);

    if (isGuest) {
      setNodesState(targetFile.nodes);
      return;
    }

    setIsFileLoading(true);
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/files/${fileId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        let loadedNodes: DiagramNode[] = [];
        if (data.nodes) {
           try {
             const parsed = typeof data.nodes === 'string' ? JSON.parse(data.nodes) : data.nodes;
             loadedNodes = Array.isArray(parsed) ? parsed : [];
           } catch (e) {
             console.error('Failed to parse nodes:', e);
             loadedNodes = [];
           }
        }
        
        lastSavedNodesStr.current = JSON.stringify(loadedNodes);
        setNodesState(loadedNodes);
        fetchVersions(fileId);
        
        setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              files: p.files.map(f => f.id === fileId ? { ...f, nodes: loadedNodes } : f)
            };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Failed to load file details:', error);
      setNodesState([]);
    } finally {
      setIsFileLoading(false);
    }
  };

  const addFile = async (projectId: string, name: string, backgroundColor: string = '#0f0f0f'): Promise<string | undefined> => {
    if (isGuest) {
      const newFileId = Math.random().toString(36).substring(2, 10);
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            files: [...p.files, { id: newFileId, name, updatedAt: Date.now(), canvasConfig: { backgroundColor }, nodes: [] }]
          };
        }
        return p;
      }));
      if (projectId === activeProjectId) {
        switchFile(newFileId);
      }
      return newFileId;
    }

    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, backgroundColor })
      });
      
      if (response.ok) {
        const data = await response.json();
        const newFile = {
          id: data.id, name: data.name, updatedAt: data.updatedAt,
          canvasConfig: { backgroundColor: data.canvasBgColor || backgroundColor },
          nodes: []
        };
        
        setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
             return { ...p, files: [...p.files, newFile] };
          }
          return p;
        }));
        
        if (projectId === activeProjectId) {
          await switchFile(newFile.id, projectId);
        }
        return newFile.id;
      } else if (response.status === 409) {
        throw new Error('Name is already exist');
      } else {
        throw new Error('Failed to create file');
      }
    } catch (error) {
      console.error('Failed to create file', error);
      throw error;
    }
  };

  const updateProject = async (id: string, name: string) => {
    if (isGuest) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      return;
    }
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      if (response.ok) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const deleteProject = async (id: string) => {
    if (isGuest) {
      setProjects(prev => prev.filter(p => p.id !== id));
      return;
    }
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const updateFile = async (id: string, name: string) => {
    if (isGuest) {
      setProjects(prev => prev.map(p => ({
        ...p,
        files: p.files.map(f => f.id === id ? { ...f, name } : f)
      })));
      return;
    }
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/files/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      if (response.ok) {
        setProjects(prev => prev.map(p => ({
          ...p,
          files: p.files.map(f => f.id === id ? { ...f, name } : f)
        })));
      }
    } catch (error) {
      console.error('Failed to update file:', error);
    }
  };

  const deleteFile = async (id: string) => {
    if (isGuest) {
      setProjects(prev => prev.map(p => ({
        ...p,
        files: p.files.filter(f => f.id !== id)
      })));
      return;
    }
    try {
      const arcApiUrl = (import.meta.env.VITE_ARC_API_URL || 'http://localhost:8081').replace(/\/$/, '');
      const response = await fetch(`${arcApiUrl}/api/files/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        setProjects(prev => prev.map(p => ({
          ...p,
          files: p.files.filter(f => f.id !== id)
        })));
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const updateCanvasConfig = (fileId: string, config: Partial<CanvasConfig>) => {
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          files: p.files.map(f => f.id === fileId ? { ...f, canvasConfig: { ...f.canvasConfig, ...config } } : f)
        };
      }
      return p;
    }));
  };

  return (
    <DiagramContext.Provider value={{ 
      nodes, 
      selectedNodeIds, 
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
      addShape,
      updateLinePoints,
      updateWaypoint, 
      updateNode, 
      updateMultipleNodes,
      moveNode, 
      moveSelectedNodes,
      splitElbowLine,
      resizeNode, 
      selectNode, 
      setSelectedNodeIds,
      setNodes,
      groupSelected,
      ungroupSelected,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      activeSnapLines,
      setActiveSnapLines,
      alignSelected,
      zoom,
      setZoom,
      panOffset,
      setPanOffset,
      activeTool,
      setActiveTool,
      selectToolMode,
      setSelectToolMode,
      projects,
      activeProjectId,
      activeFileId,
      switchProject,
      addProject,
      switchFile,
      addFile,
      updateProject,
      deleteProject,
      updateFile,
      deleteFile,
      updateCanvasConfig,
      isLoadingProjects,
      isFileLoading,
      
      // Sidebar
      isSidebarOpen,
      toggleSidebar,
      
      // AI Chat
      isAiChatOpen,
      toggleAiChat,

      // Version History
      isVersionHistoryOpen,
      toggleVersionHistory,
      versions,
      fetchVersions,
      restoreVersion,

      // Design Panel
      isDesignPanelOpen,
      toggleDesignPanel,
      
      // History
      undo,
      redo,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      saveHistoryState,
      
      // Clipboard
      copySelected,
      pasteSelected,
      cutSelected,
      deleteSelected,

      // Theme
      theme,
      toggleTheme,

      // Save status
      saveStatus
    }}>
      {children}
    </DiagramContext.Provider>
  );
}

export function useDiagram() {
  const context = useContext(DiagramContext);
  if (!context) {
    throw new Error('useDiagram must be used within a DiagramProvider');
  }
  return context;
}
