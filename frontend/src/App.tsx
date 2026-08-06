import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { DiagramProvider, useDiagram } from '@/context/DiagramContext';
import { Layers, Square, LayoutTemplate, FolderKanban, Plus, LogIn, LogOut, LayoutDashboard, User, Settings } from 'lucide-react';
import { AuthProvider } from '@/context/AuthContext';
import { CollaborationProvider } from '@/context/CollaborationContext';
import { Header } from '@/components/layout/Header';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { SidePanel } from '@/components/layout/SidePanel';
import { AIChatSidebar } from '@/components/layout/AIChatSidebar';
import { VersionHistorySidebar } from '@/components/layout/VersionHistorySidebar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Canvas } from '@/features/diagram/components/Canvas';
import { LandingPage } from '@/features/landing/LandingPage';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { useAuth } from '@/context/AuthContext';
import { Loader } from '@/components/ui/Loader';
import { Logo } from '@/components/ui/Logo';
import { CreateEntityModal } from '@/components/layout/CreateEntityModal';
import type { WorkspaceProject as Project } from '@/context/DiagramContext';

function getNewFileName(projects: Project[], activeProjectId: string | null) {
  const activeProj = projects.find(p => p.id === activeProjectId);
  if (!activeProj || !activeProj.files || activeProj.files.length === 0) return 'Untitled 1';
  
  let max = 0;
  for (const f of activeProj.files) {
    const match = f.name.match(/^Untitled (\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `Untitled ${max + 1}`;
}

function WorkspaceRoute() {
  const { projectId, fileId } = useParams();
  const navigate = useNavigate();
  const { 
    switchProject, 
    activeProjectId, 
    activeFileId, 
    isAiChatOpen, 
    isDesignPanelOpen, 
    isVersionHistoryOpen,
    projects,
    addFile
  } = useDiagram();
  const { isGuest, user, login, logout, isAuthenticated } = useAuth();
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(340);
  const [isLeftSidebarPinned, setIsLeftSidebarPinned] = useState(false); // Collapsed by default
  const [isLeftSidebarHovered, setIsLeftSidebarHovered] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<'files' | 'layers' | 'shapes' | 'templates' | 'settings'>('files');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (tab: 'files' | 'layers' | 'shapes' | 'templates' | 'settings') => {
    if (activeLeftTab === tab && isLeftSidebarPinned) {
      setIsLeftSidebarPinned(false);
      setIsLeftSidebarHovered(false);
    } else {
      setIsLeftSidebarPinned(true);
      setIsLeftSidebarHovered(true);
      setActiveLeftTab(tab);
    }
  };

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isProfileMenuOpen]);

  // Responsive layout: collapse panel pinning on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsLeftSidebarPinned(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // trigger initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global keyboard listener for Command Palette shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      // Toggle Command Palette on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, []);

  useEffect(() => {
    if (projectId && fileId && (projectId !== activeProjectId || fileId !== activeFileId)) {
      switchProject(projectId, fileId);
    }
  }, [projectId, fileId, switchProject, activeProjectId, activeFileId]);

  const startLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(400, startWidth + (moveEvent.clientX - startX)));
      setLeftWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startRightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, startWidth - (moveEvent.clientX - startX)));
      setRightWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--bg-canvas)] overflow-hidden relative">
      <Header />

      <div className="flex flex-1 relative overflow-hidden">
        {/* Unified Left Activity Bar (60px) */}
        <div
          onMouseEnter={() => setIsLeftSidebarHovered(true)}
          onMouseLeave={() => setIsLeftSidebarHovered(false)}
          style={{
            width: '60px',
            minWidth: '60px',
            height: '100%',
            backgroundColor: 'var(--bg-panel-solid)',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            paddingTop: '16px',
            paddingLeft: '14px',
            paddingBottom: '16px',
            gap: '20px',
            zIndex: 45, // Elevated above the sliding drawer panel!
            position: 'relative',
            flexShrink: 0
          }}
        >
          {/* Top Logo */}
          <div 
            onClick={() => navigate('/dashboard')}
            style={{ 
              cursor: 'pointer',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              color: 'var(--text-primary)',
              width: '32px',
              height: '32px'
            }}
            title="Go to Dashboard"
          >
            <Logo size={32} />
          </div>

          {/* Tab Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'flex-start', flex: 1 }}>
            {/* Files Tab Button */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              {activeLeftTab === 'files' && (isLeftSidebarPinned || isLeftSidebarHovered) && (
                <div style={{
                  position: 'absolute',
                  left: '-14px',
                  top: '25%',
                  height: '50%',
                  width: '3px',
                  backgroundColor: '#0c8ce9',
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 10px #0c8ce9'
                }} />
              )}
              <button 
                onMouseEnter={() => {
                  setIsLeftSidebarHovered(true);
                  setActiveLeftTab('files');
                }}
                onClick={() => handleTabClick('files')}
                style={{
                  color: (activeLeftTab === 'files' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '#0c8ce9' : 'var(--text-secondary)',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (activeLeftTab === 'files' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'var(--accent-blue-subtle)' : 'transparent',
                  transform: (activeLeftTab === 'files' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'scale(1.15) translateZ(0)' : 'scale(1) translateZ(0)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (activeLeftTab === 'files' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '0 0 12px rgba(12, 140, 233, 0.15)' : 'none',
                  border: 'none',
                  outline: 'none'
                }}
                title="Files Explorer (Hover to open)"
              >
                <FolderKanban size={16} />
              </button>
            </div>

            {/* Layers Tab Button */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              {activeLeftTab === 'layers' && (isLeftSidebarPinned || isLeftSidebarHovered) && (
                <div style={{
                  position: 'absolute',
                  left: '-14px',
                  top: '25%',
                  height: '50%',
                  width: '3px',
                  backgroundColor: '#0c8ce9',
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 10px #0c8ce9'
                }} />
              )}
              <button 
                onMouseEnter={() => {
                  setIsLeftSidebarHovered(true);
                  setActiveLeftTab('layers');
                }}
                onClick={() => handleTabClick('layers')}
                style={{
                  color: (activeLeftTab === 'layers' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '#0c8ce9' : 'var(--text-secondary)',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (activeLeftTab === 'layers' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'var(--accent-blue-subtle)' : 'transparent',
                  transform: (activeLeftTab === 'layers' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'scale(1.15) translateZ(0)' : 'scale(1) translateZ(0)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (activeLeftTab === 'layers' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '0 0 12px rgba(12, 140, 233, 0.15)' : 'none',
                  border: 'none',
                  outline: 'none'
                }}
                title="Layers List (Hover to open)"
              >
                <Layers size={16} />
              </button>
            </div>

            {/* Shapes Tab Button */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              {activeLeftTab === 'shapes' && (isLeftSidebarPinned || isLeftSidebarHovered) && (
                <div style={{
                  position: 'absolute',
                  left: '-14px',
                  top: '25%',
                  height: '50%',
                  width: '3px',
                  backgroundColor: '#0c8ce9',
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 10px #0c8ce9'
                }} />
              )}
              <button 
                onMouseEnter={() => {
                  setIsLeftSidebarHovered(true);
                  setActiveLeftTab('shapes');
                }}
                onClick={() => handleTabClick('shapes')}
                style={{
                  color: (activeLeftTab === 'shapes' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '#0c8ce9' : 'var(--text-secondary)',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (activeLeftTab === 'shapes' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'var(--accent-blue-subtle)' : 'transparent',
                  transform: (activeLeftTab === 'shapes' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'scale(1.15) translateZ(0)' : 'scale(1) translateZ(0)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (activeLeftTab === 'shapes' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '0 0 12px rgba(12, 140, 233, 0.15)' : 'none',
                  border: 'none',
                  outline: 'none'
                }}
                title="Shapes Palette (Hover to open)"
              >
                <Square size={16} />
              </button>
            </div>

            {/* Templates Tab Button */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              {activeLeftTab === 'templates' && (isLeftSidebarPinned || isLeftSidebarHovered) && (
                <div style={{
                  position: 'absolute',
                  left: '-14px',
                  top: '25%',
                  height: '50%',
                  width: '3px',
                  backgroundColor: '#0c8ce9',
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 10px #0c8ce9'
                }} />
              )}
              <button 
                onMouseEnter={() => {
                  setIsLeftSidebarHovered(true);
                  setActiveLeftTab('templates');
                }}
                onClick={() => handleTabClick('templates')}
                style={{
                  color: (activeLeftTab === 'templates' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '#0c8ce9' : 'var(--text-secondary)',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (activeLeftTab === 'templates' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'var(--accent-blue-subtle)' : 'transparent',
                  transform: (activeLeftTab === 'templates' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'scale(1.15) translateZ(0)' : 'scale(1) translateZ(0)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (activeLeftTab === 'templates' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '0 0 12px rgba(12, 140, 233, 0.15)' : 'none',
                  border: 'none',
                  outline: 'none'
                }}
                title="Templates Presets (Hover to open)"
              >
                <LayoutTemplate size={16} />
              </button>
            </div>

            {/* Settings Tab Button */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              {activeLeftTab === 'settings' && (isLeftSidebarPinned || isLeftSidebarHovered) && (
                <div style={{
                  position: 'absolute',
                  left: '-14px',
                  top: '25%',
                  height: '50%',
                  width: '3px',
                  backgroundColor: '#0c8ce9',
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 10px #0c8ce9'
                }} />
              )}
              <button 
                onMouseEnter={() => {
                  setIsLeftSidebarHovered(true);
                  setActiveLeftTab('settings');
                }}
                onClick={() => handleTabClick('settings')}
                style={{
                  color: (activeLeftTab === 'settings' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '#0c8ce9' : 'var(--text-secondary)',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (activeLeftTab === 'settings' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'var(--accent-blue-subtle)' : 'transparent',
                  transform: (activeLeftTab === 'settings' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? 'scale(1.15) translateZ(0)' : 'scale(1) translateZ(0)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (activeLeftTab === 'settings' && (isLeftSidebarPinned || isLeftSidebarHovered)) ? '0 0 12px rgba(12, 140, 233, 0.15)' : 'none',
                  border: 'none',
                  outline: 'none'
                }}
                title="Canvas Settings (Hover to open)"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
            {/* File Creation Button */}
            <button
              onClick={() => setIsCreatingFile(true)}
              style={{
                color: 'var(--text-secondary)',
                padding: '8px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: '1px dashed var(--border-default)',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              title="Create New File"
            >
              <Plus size={16} />
            </button>

            {/* Profile Avatar / LogIn Button with Popover Dropdown */}
            <div 
              onClick={() => setIsProfileMenuOpen(prev => !prev)}
              style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                backgroundColor: isGuest ? '#f59e0b20' : 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: isGuest ? '1px solid #f59e0b' : '1px solid var(--border-default)',
                overflow: 'hidden',
                transition: 'transform 0.2s',
                position: 'relative'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Account Settings"
            >
              {isGuest ? (
                <User size={14} color="#f59e0b" />
              ) : user?.picture ? (
                <img src={user.picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={14} />
              )}
            </div>

            {/* Floating Profile Popover Menu */}
            {isProfileMenuOpen && (
              <div 
                ref={profileMenuRef}
                style={{
                  position: 'absolute',
                  left: '68px',
                  bottom: '16px',
                  backgroundColor: 'var(--bg-panel-solid)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                  padding: '16px',
                  minWidth: '220px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Profile Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: isGuest ? '#f59e0b20' : 'var(--bg-secondary)',
                    border: isGuest ? '1px solid #f59e0b' : '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {isGuest ? (
                      <User size={16} color="#f59e0b" />
                    ) : user?.picture ? (
                      <img src={user.picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isGuest ? 'Guest User' : user?.name || 'User'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isGuest ? 'Local mode' : user?.email || 'Cloud Account'}
                    </span>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />

                {/* Menu Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/dashboard');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LayoutDashboard size={14} />
                    <span>Dashboard & Projects</span>
                  </button>

                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        login();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#f59e0b',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <LogIn size={14} />
                      <span>Sign In to Save</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Collapsible LeftSidebar Drawer (when unpinned) */}
        {!isLeftSidebarPinned && (
          <div 
            onMouseEnter={() => setIsLeftSidebarHovered(true)}
            onMouseLeave={() => setIsLeftSidebarHovered(false)}
            style={{
              position: 'absolute',
              left: '60px',
              top: 0,
              bottom: 0,
              width: `${leftWidth}px`,
              zIndex: 40,
              transform: isLeftSidebarHovered ? 'translateX(0)' : 'translateX(-105%)',
              transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isLeftSidebarHovered ? '12px 0 35px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            <LeftSidebar 
              isPinned={false} 
              onPinToggle={() => setIsLeftSidebarPinned(true)} 
              activeTab={activeLeftTab}
              onTabChange={setActiveLeftTab}
            />
          </div>
        )}

        {/* Main Workspace (Canvas, AIChat, SidePanel) */}
        <div style={{ display: 'flex', flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* Static Pinned LeftSidebar */}
          {isLeftSidebarPinned && (
            <div style={{ width: `${leftWidth}px`, minWidth: `${leftWidth}px`, height: '100%', position: 'relative', zIndex: 40 }}>
              <LeftSidebar 
                isPinned={true} 
                onPinToggle={() => setIsLeftSidebarPinned(false)} 
                activeTab={activeLeftTab}
                onTabChange={setActiveLeftTab}
              />
            </div>
          )}

          {/* Resizer handle (only when pinned) */}
          {isLeftSidebarPinned && (
            <div
              onMouseDown={startLeftResize}
              style={{
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center',
                height: '100%',
                flexShrink: 0
              }}
              className="group"
            >
              <div style={{ width: '1px', backgroundColor: 'var(--border-default)', height: '100%', transition: 'background-color 0.15s' }} className="group-hover:bg-[#0c8ce9]" />
            </div>
          )}

          <div className="flex-1 h-full relative overflow-hidden">
            <Canvas />
          </div>

          {isAiChatOpen && (
            <div style={{ width: '320px', minWidth: '320px', height: '100%', position: 'relative' }}>
              <AIChatSidebar />
            </div>
          )}

          {isVersionHistoryOpen && (
            <div style={{ width: '320px', minWidth: '320px', height: '100%', position: 'relative' }}>
              <VersionHistorySidebar />
            </div>
          )}

          {isDesignPanelOpen && (
            <div
              onMouseDown={startRightResize}
              style={{
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center',
                height: '100%',
                flexShrink: 0
              }}
              className="group"
            >
              <div style={{ width: '1px', backgroundColor: 'var(--border-default)', height: '100%', transition: 'background-color 0.15s' }} className="group-hover:bg-[#0c8ce9]" />
            </div>
          )}

          {isDesignPanelOpen && (
            <div style={{ width: `${rightWidth}px`, minWidth: `${rightWidth}px`, height: '100%', position: 'relative' }}>
              <SidePanel />
            </div>
          )}
        </div>
      </div>

      <CreateEntityModal 
        isOpen={isCreatingFile}
        onClose={() => setIsCreatingFile(false)}
        onConfirm={async (name, bgColor) => {
          if (name.trim()) {
            const newFile = await addFile(activeProjectId, name.trim(), bgColor);
            if (newFile) {
              navigate(`/project/${activeProjectId}/file/${newFile}`);
            }
            setIsCreatingFile(false);
          }
        }}
        title="Create New File"
        defaultName={getNewFileName(projects, activeProjectId)}
      />

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setIsLeftSidebarPinned={setIsLeftSidebarPinned}
        setActiveLeftTab={setActiveLeftTab}
      />
    </div>
  );
}

function MainAppContent() {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#08090d]">
        <Loader size="lg" text="Authenticating..." />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated || isGuest ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/dashboard" element={isAuthenticated || isGuest ? <Dashboard /> : <Navigate to="/" />} />
      <Route path="/project/:projectId/file/:fileId" element={isAuthenticated || isGuest ? <WorkspaceRoute /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CollaborationProvider>
          <DiagramProvider>
            <MainAppContent />
          </DiagramProvider>
        </CollaborationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
