import { useState, useEffect } from 'react';
import styles from './LandingPage.module.css';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Code,
  Globe,
  Sparkles,
  Shield,
  Layers,
  Cpu,
  MessageSquare,
  Database,
  Server
} from 'lucide-react';

interface CodeToken {
  text: string;
  type: 'kw' | 'str' | 'var' | 'com' | 'typ' | 'plain';
}

interface CodeFile {
  name: string;
  tokens: CodeToken[];
}

const FILES_TEMPLATES: CodeFile[] = [
  {
    name: 'AuthGateway.tsx',
    tokens: [
      { text: '// Arc Route Component\n', type: 'com' },
      { text: 'import ', type: 'kw' },
      { text: 'React ', type: 'var' },
      { text: 'from ', type: 'kw' },
      { text: "'react'", type: 'str' },
      { text: ';\nimport { ', type: 'plain' },
      { text: 'useAuth ', type: 'var' },
      { text: '} from ', type: 'kw' },
      { text: "'./AuthContext'", type: 'str' },
      { text: ';\n\nexport const ', type: 'kw' },
      { text: 'AuthNode ', type: 'typ' },
      { text: '= () => {\n  const { ', type: 'plain' },
      { text: 'login ', type: 'var' },
      { text: '} = ', type: 'plain' },
      { text: 'useAuth', type: 'typ' },
      { text: '();\n  return (\n    <', type: 'plain' },
      { text: 'div ', type: 'kw' },
      { text: 'className=', type: 'plain' },
      { text: '"border border-blue-500 bg-gray-900"', type: 'str' },
      { text: '>\n      <', type: 'plain' },
      { text: 'h3', type: 'kw' },
      { text: '>OAuth Node</', type: 'plain' },
      { text: 'h3', type: 'kw' },
      { text: '>\n      <', type: 'plain' },
      { text: 'button ', type: 'kw' },
      { text: 'onClick={', type: 'plain' },
      { text: 'login', type: 'var' },
      { text: '}>Trigger OAuth</', type: 'plain' },
      { text: 'button', type: 'kw' },
      { text: '>\n    </', type: 'plain' },
      { text: 'div', type: 'kw' },
      { text: '>\n  );\n};', type: 'plain' }
    ]
  },
  {
    name: 'schema.sql',
    tokens: [
      { text: '-- Arc Entity Models\n', type: 'com' },
      { text: 'CREATE TABLE ', type: 'kw' },
      { text: 'projects ', type: 'typ' },
      { text: '(\n  id ', type: 'plain' },
      { text: 'UUID ', type: 'kw' },
      { text: 'PRIMARY KEY DEFAULT ', type: 'kw' },
      { text: 'gen_random_uuid()', type: 'var' },
      { text: ',\n  name ', type: 'plain' },
      { text: 'VARCHAR(255) ', type: 'kw' },
      { text: 'NOT NULL', type: 'kw' },
      { text: ',\n  user_id ', type: 'plain' },
      { text: 'UUID ', type: 'kw' },
      { text: 'NOT NULL', type: 'kw' },
      { text: ',\n  created_at ', type: 'plain' },
      { text: 'TIMESTAMP DEFAULT ', type: 'kw' },
      { text: 'CURRENT_TIMESTAMP\n', type: 'var' },
      { text: ');\n\nCREATE TABLE ', type: 'kw' },
      { text: 'files ', type: 'typ' },
      { text: '(\n  id ', type: 'plain' },
      { text: 'UUID ', type: 'kw' },
      { text: 'PRIMARY KEY DEFAULT ', type: 'kw' },
      { text: 'gen_random_uuid()', type: 'var' },
      { text: ',\n  project_id ', type: 'plain' },
      { text: 'UUID REFERENCES ', type: 'kw' },
      { text: 'projects(id) ', type: 'var' },
      { text: 'ON DELETE CASCADE', type: 'kw' },
      { text: ',\n  name ', type: 'plain' },
      { text: 'VARCHAR(255) ', type: 'kw' },
      { text: 'NOT NULL\n', type: 'kw' },
      { text: ');', type: 'plain' }
    ]
  },
  {
    name: 'api.ts',
    tokens: [
      { text: '// Arc Compilation Handler\n', type: 'com' },
      { text: 'import ', type: 'kw' },
      { text: '{ NextResponse } ', type: 'plain' },
      { text: 'from ', type: 'kw' },
      { text: "'next/server'", type: 'str' },
      { text: ';\n\nexport async function ', type: 'kw' },
      { text: 'POST', type: 'typ' },
      { text: '(req: ', type: 'plain' },
      { text: 'Request', type: 'typ' },
      { text: ') {\n  const ', type: 'plain' },
      { text: 'payload ', type: 'var' },
      { text: '= await ', type: 'plain' },
      { text: 'req.json', type: 'var' },
      { text: '();\n  \n  ', type: 'plain' },
      { text: '// Sync visual state\n  ', type: 'com' },
      { text: 'const ', type: 'kw' },
      { text: 'dbResult ', type: 'var' },
      { text: '= await ', type: 'plain' },
      { text: 'db.save', type: 'var' },
      { text: '(payload);\n  return ', type: 'plain' },
      { text: 'NextResponse.json', type: 'typ' },
      { text: '({ status: ', type: 'plain' },
      { text: "'compiled'", type: 'str' },
      { text: ', dbResult });\n}', type: 'plain' }
    ]
  }
];

export function LandingPage() {
  const { login, enterGuestMode } = useAuth();

  // Code Editor typing states
  const [activeTab, setActiveTab] = useState(0);
  const [typedCharsCount, setTypedCharsCount] = useState(0);


  // Multiplayer Live Simulation State Machine
  const [simStep, setSimStep] = useState(0);
  const [simCursors, setSimCursors] = useState({
    sarah: { x: 50, y: 150 },
    ganesh: { x: 300, y: 100 }
  });
  const [simNodes, setSimNodes] = useState({
    client: false,
    database: false,
    clientActive: false,
    databaseActive: false
  });
  const [simLineVisible, setSimLineVisible] = useState(false);
  const [simPulseVisible, setSimPulseVisible] = useState(false);

  // Intersection Observer for scroll reveal
  useEffect(() => {
    const revealElements = document.querySelectorAll(`.${styles.reveal}`);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealVisible);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Code Typing Simulation Character Counter Loop
  useEffect(() => {
    const totalChars = FILES_TEMPLATES[activeTab].tokens.reduce((acc, t) => acc + t.text.length, 0);
    if (typedCharsCount < totalChars) {
      const timeout = setTimeout(() => {
        setTypedCharsCount(prev => prev + 1);
      }, 15);
      return () => clearTimeout(timeout);
    } else {
      const timer = setTimeout(() => {
        const nextIndex = (activeTab + 1) % FILES_TEMPLATES.length;
        setActiveTab(nextIndex);
        setTypedCharsCount(0);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [typedCharsCount, activeTab]);

  const selectTab = (index: number) => {
    setActiveTab(index);
    setTypedCharsCount(0);
  };

  // Helper to render typed tokens with syntax highlighting
  const renderTypedTokens = () => {
    const tokens = FILES_TEMPLATES[activeTab].tokens;
    let charAccumulator = 0;
    const renderedSpans = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (charAccumulator >= typedCharsCount) break;

      const remainingChars = typedCharsCount - charAccumulator;
      if (remainingChars >= t.text.length) {
        renderedSpans.push(
          <span key={i} className={styles[t.type] || ''}>
            {t.text}
          </span>
        );
        charAccumulator += t.text.length;
      } else {
        renderedSpans.push(
          <span key={i} className={styles[t.type] || ''}>
            {t.text.substring(0, remainingChars)}
          </span>
        );
        charAccumulator += remainingChars;
        break;
      }
    }

    return renderedSpans;
  };


  // Multiplayer Diagram Workspace Simulation State Machine Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSimStep(prev => (prev + 1) % 8);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    switch (simStep) {
      case 0:
        setSimCursors({ sarah: { x: 30, y: 160 }, ganesh: { x: 260, y: 180 } });
        setSimNodes({ client: false, database: false, clientActive: false, databaseActive: false });
        setSimLineVisible(false);
        setSimPulseVisible(false);
        break;
      case 1:
        setSimCursors(prev => ({ ...prev, sarah: { x: 60, y: 60 } }));
        break;
      case 2:
        setSimNodes(prev => ({ ...prev, client: true, clientActive: true }));
        setSimCursors(prev => ({ ...prev, sarah: { x: 180, y: 80 } }));
        break;
      case 3:
        setSimCursors(prev => ({ ...prev, ganesh: { x: 230, y: 150 } }));
        break;
      case 4:
        setSimNodes(prev => ({ ...prev, database: true, databaseActive: true }));
        setSimCursors(prev => ({ ...prev, ganesh: { x: 280, y: 80 } }));
        break;
      case 5:
        setSimLineVisible(true);
        break;
      case 6:
        setSimPulseVisible(true);
        break;
      case 7:
        break;
    }
  }, [simStep]);


  return (
    <div className={styles.container}>
      {/* Background */}
      <div className={styles.background}></div>
      <div className={styles.glow}></div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoIcon} style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <img src="/favicon.svg" alt="Arqulat Arc" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span>Arqulat Arc</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#code-generation">Compiler</a>
          <a href="#collaboration">Multiplayer</a>
          <button className={styles.loginBtn} onClick={login}>Sign in to Cloud</button>
          <button className={styles.getStartedBtn} onClick={enterGuestMode}>Start Local Workspace</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.badge}>
          <Sparkles size={14} />
          <span>Architecture Reimagined</span>
        </div>
        <h1 className={styles.heroTitle}>
          Crystallize thought into <span className={styles.gradientText}>architecture.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Weave complex visual blueprints directly into React & SQL. A seamless bridge between human intuition and machine execution.
        </p>
        <div className={styles.heroActions}>
          <button className={styles.primaryBtn} onClick={enterGuestMode}>
            Start Local Workspace (No Login) <ArrowRight size={18} />
          </button>
          <button className={styles.secondaryBtn} onClick={login}>
            Sign in to Cloud (Save & Sync)
          </button>
        </div>
      </section>

      {/* Tech Logo Marquee */}
      <section className={styles.logosSection}>
        <div className={styles.logosTitle}>Supported Tech Ecosystem</div>
        <div className={styles.marqueeWrapper}>
          <div className={styles.marquee}>
            <div className={styles.marqueeItem}><Cpu size={18} /> React Framework</div>
            <div className={styles.marqueeItem}><Layers size={18} /> Next.js App Router</div>
            <div className={styles.marqueeItem}><Code size={18} /> TypeScript</div>
            <div className={styles.marqueeItem}><Globe size={18} /> Spring Boot API</div>
            <div className={styles.marqueeItem}><Database size={18} /> PostgreSQL</div>
            <div className={styles.marqueeItem}><Shield size={18} /> OAuth 2.0</div>
            {/* Duplicate for infinite loop effect */}
            <div className={styles.marqueeItem}><Cpu size={18} /> React Framework</div>
            <div className={styles.marqueeItem}><Layers size={18} /> Next.js App Router</div>
            <div className={styles.marqueeItem}><Code size={18} /> TypeScript</div>
            <div className={styles.marqueeItem}><Globe size={18} /> Spring Boot API</div>
            <div className={styles.marqueeItem}><Database size={18} /> PostgreSQL</div>
            <div className={styles.marqueeItem}><Shield size={18} /> OAuth 2.0</div>
          </div>
        </div>
      </section>

      {/* Storyline Timeline: Section 1 - AI Code Generation */}
      <div id="code-generation" className={`${styles.timelineSection} ${styles.reveal}`}>
        <div className={styles.timelineConnector}>
          <div className={styles.timelineDot}>
            <div className={styles.timelineDotInner}></div>
          </div>
          <div className={styles.timelineLine}></div>
        </div>
        <div className={styles.timelineContent}>
          <div className={styles.splitGrid}>
            <div>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>[ 01. Visual Compiler ]</span>
                <h2 className={styles.sectionTitle}>Blueprint to logic.</h2>
                <p className={styles.sectionSubtitle}>
                  Watch as your structural nodes are autonomously translated into production-ready syntax. From architecture diagram straight to deployment.
                </p>
              </div>

              {/* High Fidelity SVG Diagram showing compiler flow */}
              <div className={styles.svgVisualContainer}>
                <svg className={styles.svgDiagram} viewBox="0 0 400 250">
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#2f81f7" />
                      <stop offset="100%" stopColor="#0d1117" />
                    </linearGradient>
                  </defs>

                  {/* Flow Lines */}
                  <path d="M 60,120 L 170,120" stroke="#30363d" strokeWidth="2" strokeDasharray="5 5" />
                  <path d="M 230,120 L 320,120" stroke="#2f81f7" strokeWidth="2" />

                  {/* Glowing pulses */}
                  <circle cx="115" cy="120" r="4" className={styles.pulsePoint}>
                    <animate attributeName="cx" values="60;170" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="275" cy="120" r="4" className={styles.pulsePoint} style={{ fill: '#79c0ff' }}>
                    <animate attributeName="cx" values="230;320" dur="1.5s" repeatCount="indefinite" />
                  </circle>

                  {/* Flow Nodes */}
                  <rect x="20" y="95" width="50" height="50" rx="12" fill="#010409" stroke="#30363d" />
                  <Cpu x="33" y="108" size="24" color="#8b949e" />

                  {/* Compiler Engine Node */}
                  <circle cx="200" cy="120" r="30" fill="url(#blueGrad)" className={styles.glowRect} />
                  <Sparkles x="188" y="108" size="24" color="#fff" />

                  {/* Output Node */}
                  <rect x="320" y="95" width="50" height="50" rx="12" fill="#010409" stroke="#30363d" />
                  <Code x="333" y="108" size="24" color="#3fb950" />
                </svg>
              </div>
            </div>
            {/* Live Typing Code Box mockup with Tab Files */}
            <div className={styles.editorMockup}>
              <div className={styles.editorHeader}>
                <div className={styles.editorTabs}>
                  {FILES_TEMPLATES.map((file, idx) => (
                    <button
                      key={idx}
                      className={`${styles.tab} ${activeTab === idx ? styles.tabActive : ''}`}
                      onClick={() => selectTab(idx)}
                    >
                      <Code size={10} />
                      {file.name}
                    </button>
                  ))}
                </div>
              </div>
              <pre className={styles.editorBody}>
                <code>{renderTypedTokens()}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Storyline Timeline: Section 2 - Collaborative Multiplayer */}
      <div id="collaboration" className={`${styles.timelineSection} ${styles.reveal}`}>
        <div className={styles.timelineConnector}>
          <div className={styles.timelineDot}>
            <div className={styles.timelineDotInner}></div>
          </div>
          <div className={styles.timelineLine} style={{ background: 'transparent' }}></div>
        </div>
        <div className={styles.timelineContent}>
          <div className={`${styles.splitGrid} ${styles.reverseSplit}`}>
            {/* Live Multiplayer Construct Visual */}
            <div className={styles.collabCard}>
              <div className={styles.multiplayerDemo}>
                {/* SVG link line drawn dynamically */}
                <svg className={styles.svgLayer}>
                  {simLineVisible && (
                    <>
                      <path
                        d="M 130,70 L 220,130"
                        fill="none"
                        stroke="rgba(47, 129, 247, 0.4)"
                        strokeWidth="2"
                      />
                      <path
                        d="M 130,70 L 220,130"
                        fill="none"
                        stroke="#2f81f7"
                        strokeWidth="2"
                      />
                    </>
                  )}
                  {simPulseVisible && (
                    <circle cx="175" cy="100" r="5" fill="#2f81f7" style={{ filter: 'drop-shadow(0 0 8px #2f81f7)' }}>
                      <animateMotion dur="1.2s" repeatCount="indefinite" path="M 130,70 L 220,130" />
                    </circle>
                  )}
                </svg>

                {/* Simulated Cursors */}
                <div
                  className={`${styles.cursor} ${styles.cursor1}`}
                  style={{ left: `${simCursors.sarah.x}px`, top: `${simCursors.sarah.y}px` }}
                >
                  <MessageSquare size={12} /> Sarah
                </div>
                <div
                  className={`${styles.cursor} ${styles.cursor2}`}
                  style={{ left: `${simCursors.ganesh.x}px`, top: `${simCursors.ganesh.y}px` }}
                >
                  <Code size={12} /> Ganesh
                </div>

                {/* Client Node */}
                <div
                  className={`${styles.simNode} ${simNodes.client ? styles.simNodeActive : ''} ${simNodes.clientActive ? styles.simNodeHighlight : ''}`}
                  style={{ left: '30px', top: '40px' }}
                >
                  <Server size={12} color="#2f81f7" /> Client.ts
                </div>

                {/* DB Node */}
                <div
                  className={`${styles.simNode} ${simNodes.database ? styles.simNodeActive : ''} ${simNodes.databaseActive ? styles.simNodeHighlight : ''}`}
                  style={{ left: '210px', top: '120px' }}
                >
                  <Database size={12} color="#3fb950" /> Database.sql
                </div>
              </div>
            </div>

            {/* Content on the Right */}
            <div>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>[ 02. Synchronization (In Development) ]</span>
                <h2 className={styles.sectionTitle}>Shared cognition.</h2>
                <p className={styles.sectionSubtitle}>
                  We are building real-time multiplayer synchronization for the future. Witness cursors weave structures synchronously across global nodes without friction or delay.
                </p>
              </div>

              {/* High Fidelity SVG Diagram showing websocket client synchronization */}
              <div className={styles.svgVisualContainer}>
                <svg className={styles.svgDiagram} viewBox="0 0 400 250">
                  {/* Central WS Sync Gateway */}
                  <circle cx="200" cy="120" r="35" fill="none" stroke="#30363d" strokeWidth="2" className={styles.glowRect} />
                  <Globe x="186" y="106" size="28" color="#8b949e" />

                  {/* Left Client */}
                  <rect x="30" y="90" width="70" height="60" rx="12" fill="#010409" stroke="#30363d" />
                  <Cpu x="53" y="105" size="24" color="#8b949e" />
                  <text x="65" y="142" fill="#8b949e" fontSize="10" fontFamily="monospace" textAnchor="middle">Node A</text>

                  {/* Right Client */}
                  <rect x="300" y="90" width="70" height="60" rx="12" fill="#010409" stroke="#30363d" />
                  <Cpu x="323" y="105" size="24" color="#8b949e" />
                  <text x="335" y="142" fill="#8b949e" fontSize="10" fontFamily="monospace" textAnchor="middle">Node B</text>

                  {/* Sync Arrows */}
                  <path d="M 100,120 L 165,120" stroke="#2f81f7" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d="M 235,120 L 300,120" stroke="#2f81f7" strokeWidth="1.5" strokeDasharray="4 4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Storyline Timeline: Section 3 - Mermaid Integration */}
      <div id="mermaid-integration" className={`${styles.timelineSection} ${styles.reveal}`}>
        <div className={styles.timelineConnector}>
          <div className={styles.timelineDot}>
            <div className={styles.timelineDotInner}></div>
          </div>
          <div className={styles.timelineLine} style={{ background: 'transparent' }}></div>
        </div>
        <div className={styles.timelineContent}>
          <div className={styles.splitGrid}>
            <div>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>[ 03. Mermaid Integration (Planning) ]</span>
                <h2 className={styles.sectionTitle}>Text to architecture.</h2>
                <p className={styles.sectionSubtitle}>
                  We are planning a revolutionary pipeline. Paste raw Mermaid code, and watch as it instantly compiles into fully interactive, drag-and-drop structural nodes on your canvas.
                </p>
              </div>
            </div>

            {/* Mermaid Visual Simulation */}
            <div className={styles.svgVisualContainer}>
              <svg className={styles.svgDiagram} viewBox="0 0 400 250">
                <rect x="20" y="40" width="140" height="160" rx="8" fill="#010409" stroke="#30363d" />
                <text x="35" y="70" fill="#2f81f7" fontSize="12" fontFamily="monospace">graph TD</text>
                <text x="35" y="90" fill="#e6edf3" fontSize="12" fontFamily="monospace">  A[Client]</text>
                <text x="35" y="110" fill="#e6edf3" fontSize="12" fontFamily="monospace">  B(API)</text>
                <text x="35" y="130" fill="#e6edf3" fontSize="12" fontFamily="monospace">  A --&gt; B</text>

                <path d="M 175,120 L 225,120" stroke="#2f81f7" strokeWidth="2" strokeDasharray="4 4">
                  <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1s" repeatCount="indefinite" />
                </path>

                <rect x="240" y="60" width="120" height="40" rx="8" fill="#0d1117" stroke="#30363d" className={styles.glowRect} />
                <text x="300" y="84" fill="#e6edf3" fontSize="12" fontFamily="monospace" textAnchor="middle">Client Node</text>

                <rect x="240" y="140" width="120" height="40" rx="8" fill="#0d1117" stroke="#3fb950" />
                <text x="300" y="164" fill="#3fb950" fontSize="12" fontFamily="monospace" textAnchor="middle">API Node</text>

                <path d="M 300,100 L 300,140" stroke="#30363d" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>
      </div>


      {/* CTA Card Section */}
      <section className={`${styles.ctaSection} ${styles.reveal}`}>
        <div className={styles.ctaCard}>
          <div className={styles.logoIcon} style={{ width: '56px', height: '56px', background: 'transparent', border: 'none', boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/favicon.svg" alt="Arqulat Arc" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2>Initialize Canvas.</h2>
          <p>
            The architecture awaits your command. Weave node models to code. Free Guest Mode.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={enterGuestMode}>
              Start Local Workspace (No Login) <ArrowRight size={18} />
            </button>
            <button className={styles.secondaryBtn} onClick={login}>
              Sign in to Cloud (Save & Sync)
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2026 Arqulat Arc. Engineered for the next generation of architects.</p>
      </footer>
    </div>
  );
}
