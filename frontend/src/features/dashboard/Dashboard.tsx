import { useState, useEffect } from 'react';
import { useDiagram } from '@/context/DiagramContext';
import { useAuth } from '@/context/AuthContext';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  Clock, 
  MoreVertical,
  Layers,
  Sparkles,
  Home,
  Star,
  Users,
  Settings,
  Grid3X3,
  Sun,
  Moon,
  LogOut,
  Edit,
  Trash2,
  Box
} from 'lucide-react';
import { CreateEntityModal } from '@/components/layout/CreateEntityModal';
import { DashboardSettingsModal } from '@/components/layout/DashboardSettingsModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const { projects, addProject, isLoadingProjects, theme, toggleTheme } = useDiagram();
  const { user, logout, isGuest } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState('recent');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { updateProject, deleteProject } = useDiagram();

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  const handleRename = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const newName = prompt('Enter new project name:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      updateProject(id, newName.trim());
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(id);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateNew = () => {
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreate = async (name: string, bgColor: string) => {
    const newProj = await addProject(name, 'Arc Diagrams', bgColor);
    if (newProj && newProj.files.length > 0) {
      navigate(`/project/${newProj.id}/file/${newProj.files[0].id}`);
    }
  };

  const handleProjectClick = (id: string) => {
    const proj = projects.find(p => p.id === id);
    if (proj && proj.files.length > 0) {
      navigate(`/project/${id}/file/${proj.files[0].id}`);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric' 
    }).format(date);
  };

  return (
    <div className={styles.container}>
      {/* Dashboard Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon} style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <img src="/favicon.svg" alt="Arqulat Arc" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span className={styles.logoText}>Arc Dashboard</span>
        </div>

        <nav className={styles.navSection}>
          <div className={styles.navLabel}>Personal</div>
          <div 
            className={`${styles.navLink} ${activeNav === 'recent' ? styles.activeNavLink : ''}`}
            onClick={() => setActiveNav('recent')}
          >
            <Home size={16} />
            <span>Recent Projects</span>
          </div>
          <div 
            className={styles.navLink}
            style={{ opacity: 0.4, cursor: 'not-allowed' }}
          >
            <Star size={16} />
            <span>Starred</span>
          </div>
        </nav>

        <nav className={styles.navSection}>
          <div className={styles.navLabel}>Organization</div>
          <div className={styles.navLink} style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            <Users size={16} />
            <span>Team Workspace</span>
          </div>
          <div className={styles.navLink} style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            <Grid3X3 size={16} />
            <span>Templates</span>
          </div>
        </nav>

        <nav className={styles.navSection} style={{ marginTop: 'auto' }}>
          <div 
            className={styles.navLink} 
            onClick={() => setIsSettingsModalOpen(true)}
          >
            <Settings size={16} />
            <span>Settings</span>
          </div>
          
          <div style={{ margin: '16px 12px', padding: '12px', background: '#0a0f16', borderRadius: '12px', border: '1px solid #21262d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(47, 129, 247, 0.1)', border: '1px solid rgba(47, 129, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {user?.picture ? <img src={user.picture} style={{ width: '100%' }} /> : <Users size={16} color="#2f81f7" />}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.name || 'Explorer'}</div>
                <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px', fontFamily: '"JetBrains Mono", monospace' }}>{isGuest ? 'GUEST' : 'PRO'}</div>
              </div>
              <button 
                onClick={toggleTheme}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(47, 129, 247, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#8b949e'; }}
              >
                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </div>
            
            <button 
              onClick={logout}
              style={{ width: '100%', background: '#010409', border: '1px solid #21262d', color: '#8b949e', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#010409'; e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.borderColor = '#21262d'; }}
            >
              <LogOut size={12} /> LOGOUT
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1>Workspace</h1>
            <p>Select a structural node to begin weaving.</p>
          </div>
          
          <div className={styles.actions}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
              <input 
                type="text" 
                placeholder="Find node..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <button className={styles.newProjectBtn} onClick={handleCreateNew}>
              <Plus size={16} />
              <span>Create Project</span>
            </button>
          </div>
        </header>

        {/* Main Grid */}
        {isLoadingProjects ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.card} style={{ pointerEvents: 'none', border: '1px solid #21262d', background: '#0d1117' }}>
                <Skeleton height="140px" borderRadius="16px 16px 0 0" />
                <div style={{ padding: '20px' }}>
                  <Skeleton height="20px" width="70%" className="mb-3" />
                  <Skeleton height="14px" width="40%" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className={styles.grid}>
            {filteredProjects.sort((a, b) => b.updatedAt - a.updatedAt).map((project, idx) => (
              <div 
                key={project.id} 
                className={styles.card}
                onClick={() => handleProjectClick(project.id)}
              >
                <div className={styles.topBar} />
                <div className={styles.preview}>
                  <div className={styles.previewGradient} />
                  <div className={styles.ghostIndex}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className={styles.cardIcon}>
                    <Box size={48} strokeWidth={1} />
                  </div>
                  {project.files.length > 0 && (
                    <div style={{ position: 'absolute', bottom: '16px', right: '16px', background: 'rgba(47, 129, 247, 0.1)', padding: '6px', borderRadius: '50%', border: '1px solid rgba(47, 129, 247, 0.2)' }}>
                      <Sparkles size={12} color="#2f81f7" />
                    </div>
                  )}
                </div>
                
                <div className={styles.info}>
                  <div className={styles.projectHeader}>
                    <span className={styles.projectName}>{project.name}</span>
                    <div style={{ position: 'relative' }}>
                      <button 
                        style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px' }} 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === project.id ? null : project.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeMenuId === project.id && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: '0',
                          backgroundColor: '#010409',
                          border: '1px solid #30363d',
                          borderRadius: '8px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                          zIndex: 50,
                          minWidth: '140px',
                          overflow: 'hidden',
                          fontFamily: '"JetBrains Mono", monospace'
                        }}>
                          <button 
                            onClick={(e) => handleRename(e, project.id, project.name)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderBottom: '1px solid #21262d', color: '#e6edf3', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0d1117'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Edit size={12} /> Rename
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, project.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.projectMeta}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} color="#8b949e" />
                      <span>{formatDate(project.updatedAt)}</span>
                    </div>
                    <div className={styles.nodeCount}>
                      <Layers size={10} />
                      <span>{project.files.length} FILE{project.files.length !== 1 ? 'S' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div style={{ backgroundColor: '#010409', padding: '32px', borderRadius: '50%', color: '#2f81f7', border: '1px solid #21262d' }}>
              <LayoutGrid size={48} strokeWidth={1} />
            </div>
            <h2>Architecture Dormant</h2>
            <p>Ready to crystallize your thoughts? Initialize a structural node to begin.</p>
            <button className={styles.newProjectBtn} onClick={handleCreateNew} style={{ marginTop: '12px' }}>
              Create First Project
            </button>
          </div>
        )}
      </main>

      <CreateEntityModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleConfirmCreate}
        title="Create Project"
        defaultName={`Project_${projects.length + 1}`}
      />

      <DashboardSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}
