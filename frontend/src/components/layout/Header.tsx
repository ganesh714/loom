import { useState, useEffect } from 'react';
import { useDiagram } from '@/context/DiagramContext';
import { useAuth } from '@/context/AuthContext';
import { useCollaboration } from '@/context/CollaborationContext';
import { generateExportCode } from '@/utils/exportEngine';
import { ExportModal } from '@/components/ui/ExportModal';
import { ImportModal } from '@/components/ui/ImportModal';
import { ShortcutsModal } from '@/components/layout/ShortcutsModal';
import { useNavigate } from 'react-router-dom';

import styles from './Header.module.css';
import { FolderInput, Download, Sun, Moon, LogIn, Palette, Bot, Keyboard, History } from 'lucide-react';

export function Header() {
  const { 
    nodes, 
    theme, 
    toggleTheme, 
    toggleAiChat, 
    toggleVersionHistory, 
    toggleDesignPanel, 
    saveStatus,
    projects,
    activeProjectId,
    activeFileId,
    updateFile
  } = useDiagram();
  const { user, isAuthenticated, isGuest, login, logout } = useAuth();
  const { remoteCursors } = useCollaboration();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [exportData, setExportData] = useState('');

  const navigate = useNavigate();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeFile = activeProject?.files.find(f => f.id === activeFileId);

  const [isEditingName, setIsEditingName] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');

  useEffect(() => {
    if (activeFile) {
      setFileNameInput(activeFile.name);
    }
  }, [activeFile]);

  const handleRename = () => {
    if (fileNameInput.trim() && activeFile && fileNameInput !== activeFile.name) {
      updateFile(activeFile.id, fileNameInput.trim());
    }
    setIsEditingName(false);
  };


  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getColorForUser = (name: string) => {
    const colors = ['#0c8ce9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#38bdf8', '#a78bfa', '#34d399'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleExport = () => {
    const html = generateExportCode(nodes);
    setExportData(html);
    setIsModalOpen(true);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', fontSize: '13px', fontWeight: 500 }}>
            <span 
              onClick={() => navigate('/dashboard')} 
              style={{ color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }} 
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'} 
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Go to Dashboard"
            >
              {activeProject ? activeProject.name : 'Drafts'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            {isEditingName ? (
              <input
                value={fileNameInput}
                onChange={(e) => setFileNameInput(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setFileNameInput(activeFile?.name || '');
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '2px 6px',
                  outline: 'none',
                  width: '180px'
                }}
              />
            ) : (
              <span 
                onClick={() => {
                  setFileNameInput(activeFile?.name || '');
                  setIsEditingName(true);
                }}
                style={{ color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Click to rename"
              >
                {activeFile ? activeFile.name : (isGuest ? 'New Project' : 'Interactive Diagram')}
              </span>
            )}
          </div>
          <div className={styles.statusIndicator}>
            {isGuest ? (
              <>
                <span className={styles.statusDot} style={{ backgroundColor: '#f59e0b' }}></span>
                <span>Guest (Local)</span>
              </>
            ) : (
              <>
                <span className={styles.statusDot} style={{ 
                  backgroundColor: 
                    saveStatus === 'saved' ? '#10b981' : 
                    saveStatus === 'error' ? '#ef4444' : 
                    saveStatus === 'saving' ? '#3b82f6' : 
                    '#f59e0b' 
                }}></span>
                <span>
                  {saveStatus === 'saved' ? 'Saved to Cloud' : 
                   saveStatus === 'saving' ? 'Saving...' : 
                   saveStatus === 'unsaved' ? 'Unsaved' : 
                   'Offline'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {/* Presence Avatars list */}
          <div className={styles.avatarGroup}>
            {/* Active remote peers */}
            {Object.keys(remoteCursors).map((peerId) => {
              const peer = remoteCursors[peerId];
              const initials = getInitials(peer.name);
              const color = getColorForUser(peer.name);
              return (
                <div 
                  key={peerId} 
                  className={styles.avatar} 
                  style={{ backgroundColor: color }}
                >
                  {initials}
                  <span className={styles.avatarTooltip}>{peer.name} (Active)</span>
                </div>
              );
            })}


          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-default)', margin: '0 4px' }} />

          <button 
            className={styles.btn} 
            onClick={toggleAiChat} 
            title="AI Chat Assistant"
            style={{
              padding: '6px 8px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={14} style={{ color: '#0c8ce9' }} />
          </button>
          <button 
            className={styles.btn} 
            onClick={toggleVersionHistory} 
            title="Version History"
            style={{
              padding: '6px 8px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History size={14} style={{ color: '#38bdf8' }} />
          </button>
          <button 
            className={styles.btn} 
            onClick={toggleDesignPanel} 
            title="Toggle Design Panel"
            style={{
              padding: '6px 8px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Palette size={14} />
          </button>
          <button 
            className={styles.btn} 
            onClick={() => setIsShortcutsOpen(true)} 
            title="Keyboard Shortcuts"
            style={{
              padding: '6px 8px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Keyboard size={14} />
          </button>

          <button 
            className={styles.btn} 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            style={{
              padding: '6px 8px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button className={styles.btn} onClick={() => setIsImportOpen(true)}>
            <FolderInput size={14} />
            <span>Import JSON</span>
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleExport}>
            <Download size={14} />
            <span>Export Diagram</span>
          </button>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-default)', margin: '0 8px' }} />

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src={user?.picture} 
                alt={user?.name} 
                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--border-default)' }} 
              />
              <button className={styles.btn} onClick={logout} style={{ padding: '4px 8px', fontSize: '11px' }}>
                Logout
              </button>
            </div>
          ) : isGuest ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={login} style={{ backgroundColor: '#4285F4' }}>
                <LogIn size={14} />
                <span>Save Progress</span>
              </button>
              <button className={styles.btn} onClick={logout} style={{ padding: '4px 8px', fontSize: '11px' }}>
                Exit
              </button>
            </div>
          ) : (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={login} style={{ backgroundColor: '#4285F4' }}>
              <LogIn size={14} />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </header>
      <ExportModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        htmlCode={exportData}
      />
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      <ShortcutsModal 
        isOpen={isShortcutsOpen} 
        onClose={() => setIsShortcutsOpen(false)} 
      />
    </>
  );
}
