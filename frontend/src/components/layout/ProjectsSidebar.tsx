import { useState, useEffect } from 'react';
import { useDiagram } from '@/context/DiagramContext';
import { useAuth } from '@/context/AuthContext';
import { Folder, Plus, X, FolderKanban, LogIn, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { CreateEntityModal } from '@/components/layout/CreateEntityModal';
import { useNavigate } from 'react-router-dom';
import styles from './ProjectsSidebar.module.css';
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

export function ProjectsSidebar() {
  const { projects, activeProjectId, activeFileId, addFile, updateFile, deleteFile, isSidebarOpen, toggleSidebar } = useDiagram();
  const { isGuest, user, login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [isCreating, setIsCreating] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  const handleRename = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const newName = prompt('Enter new file name:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      updateFile(id, newName.trim());
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
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

  const handleConfirmCreate = async (name: string, bgColor: string) => {
    if (name.trim()) {
      await addFile(activeProjectId, name.trim(), bgColor);
      setIsCreating(false);
    }
  };

  // Collapsed Sidebar view (simple icons)
  if (!isSidebarOpen) {
    return (
      <div className={`${styles.sidebar} ${styles.collapsed}`}>
        {/* Top Logo - Clickable to open */}
        <div 
          className={styles.logoContainerCollapsed} 
          onClick={toggleSidebar} 
          title="Expand sidebar"
        >
          <Logo className={styles.logo} />
        </div>

        <div className={styles.divider} />

        {/* Single Projects Folder Icon */}
        <div className={styles.projectListCollapsed}>
          <button 
            className={styles.projectIconBtn} 
            onClick={toggleSidebar}
            title="Projects"
          >
            <FolderKanban size={20} />
          </button>
        </div>

        {/* Footer with Plus icon and Profile */}
        <div className={styles.footerCollapsed}>
          <button
            className={styles.addBtnCollapsed}
            onClick={() => {
              toggleSidebar();
              setIsCreating(true);
            }}
            title="New File"
          >
            <Plus size={20} />
          </button>

          <div 
            onClick={isGuest ? login : toggleSidebar}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: isGuest ? '#f59e0b20' : 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: isGuest ? '1px solid #f59e0b' : '1px solid var(--border-default)',
              overflow: 'hidden',
              marginTop: '8px'
            }}
            title={isGuest ? "Sign in to save" : "View Profile"}
          >
            {isGuest ? (
              <LogIn size={14} color="#f59e0b" />
            ) : user?.picture ? (
              <img src={user.picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <LogIn size={14} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      {/* Top Logo - Clickable to collapse sidebar */}
      <div 
        className={styles.logoContainer} 
        onClick={toggleSidebar} 
        title="Collapse sidebar"
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.logoWrapper}>
          <Logo className={styles.logo} />
          <span className={styles.logoText}>Arqulat Arc</span>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Files List */}
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
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  zIndex: 50,
                  minWidth: '120px',
                  overflow: 'hidden'
                }}>
                  <button 
                    onClick={(e) => handleRename(e, file.id, file.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Edit size={12} /> Rename
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, file.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ef444420'}
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

      {/* Footer / Add Project Button + Profile */}
      <div className={styles.footer}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          {!isCreating ? (
            <button
              className={styles.addBtn}
              onClick={() => setIsCreating(true)}
              title="New File"
            >
              <Plus size={14} />
              <span>New File</span>
            </button>
          ) : (
            <CreateEntityModal 
              isOpen={isCreating}
              onClose={() => setIsCreating(false)}
              onConfirm={handleConfirmCreate}
              title="Create New File"
              defaultName={getNewFileName(projects, activeProjectId)}
            />
          )}

          {/* User Profile Info - acts as Sign In CTA for guests */}
          <div style={{ 
            padding: '12px 8px', 
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '4px'
          }}>
            <div 
              onClick={isGuest ? login : undefined}
              style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                backgroundColor: isGuest ? '#f59e0b20' : 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: isGuest ? '1px solid #f59e0b' : '1px solid var(--border-default)',
                overflow: 'hidden',
                cursor: isGuest ? 'pointer' : 'default'
              }}
            >
              {isGuest ? (
                <LogIn size={12} color="#f59e0b" />
              ) : user?.picture ? (
                <img src={user.picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <LogIn size={12} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                {isGuest ? 'Guest User' : user?.name || 'User'}
              </span>
              {isGuest ? (
                <button 
                  onClick={login}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '9px', color: '#f59e0b', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
                >
                  Sign in to save
                </button>
              ) : (
                <button 
                  onClick={() => navigate('/dashboard')}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '9px', color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                >
                  Dashboard
                </button>
              )}
            </div>
            {isAuthenticated && (
              <button 
                onClick={logout} 
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Logout"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
