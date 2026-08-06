import { useState } from 'react';
import { Button } from './button';
import { useDiagram } from '@/context/DiagramContext';
import { toPng } from 'html-to-image';
import { X, Image as ImageIcon, Code, FileJson, Download, Check, Copy } from 'lucide-react';
import { generateSvgExport } from '@/utils/svgExportEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlCode: string;
}

export function ExportModal({ isOpen, onClose, htmlCode }: ExportModalProps) {
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'html' | 'json'>('image');
  const { nodes, theme } = useDiagram();

  if (!isOpen) return null;

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(htmlCode);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(nodes, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSaveDiagram = () => {
    const jsonStr = JSON.stringify(nodes, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arc-diagram.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportImage = async (format: 'png' | 'svg') => {
    try {
      setIsExporting(true);
      const element = document.getElementById('arc-export-area');
      if (!element) throw new Error('Export area not found');

      if (nodes.length === 0) {
        alert("Canvas is empty!");
        setIsExporting(false);
        return;
      }

      // Calculate exact bounding box of the diagram
      const padding = 40;
      const minX = Math.min(...nodes.map(n => n.position.x)) - padding;
      const minY = Math.min(...nodes.map(n => n.position.y)) - padding;
      const maxX = Math.max(...nodes.map(n => n.position.x + n.dimensions.width)) + padding;
      const maxY = Math.max(...nodes.map(n => n.position.y + n.dimensions.height)) + padding;
      
      const width = maxX - minX;
      const height = maxY - minY;

      const filter = () => {
        return true;
      };

      const options = {
        filter,
        width,
        height,
        style: {
          transform: `translate(${-minX}px, ${-minY}px) scale(1)`,
          transformOrigin: 'top left',
          width: `${width}px`,
          height: `${height}px`,
        },
        backgroundColor: theme === 'dark' ? '#121212' : '#f8f9fa',
        pixelRatio: format === 'png' ? 2 : 1, // 2x scale for crisp PNGs
      };

      let dataUrl = '';
      if (format === 'png') {
        dataUrl = await toPng(element, options);
      } else {
        const svgString = generateSvgExport(nodes, theme === 'dark' ? '#121212' : '#f8f9fa');
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        dataUrl = URL.createObjectURL(blob);
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `arc-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      if (format === 'svg') {
        URL.revokeObjectURL(dataUrl);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export image. See console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <h2 className="text-[var(--text-primary)] font-semibold text-lg flex items-center gap-2">
            <Download size={18} /> Export Diagram
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex px-4 pt-4 pb-2 border-b border-[var(--border-default)] gap-2">
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'image' ? 'bg-[var(--bg-active)] text-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            onClick={() => setActiveTab('image')}
          >
            <ImageIcon size={16} /> Image (PNG/SVG)
          </button>
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'html' ? 'bg-[var(--bg-active)] text-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            onClick={() => setActiveTab('html')}
          >
            <Code size={16} /> HTML / CSS
          </button>
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'json' ? 'bg-[var(--bg-active)] text-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            onClick={() => setActiveTab('json')}
          >
            <FileJson size={16} /> JSON Data
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'image' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-[var(--bg-hover)] rounded-full flex items-center justify-center mb-6 text-[var(--accent-blue)]">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-[var(--text-primary)] font-medium text-lg mb-2">Export as High-Quality Image</h3>
              <p className="text-[var(--text-secondary)] text-center text-sm max-w-md mb-8">
                Download your canvas as a perfectly cropped, scalable image for sharing or embedding in your projects.
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => handleExportImage('svg')} 
                  disabled={isExporting}
                  className="flex items-center gap-2"
                >
                  <Download size={16} /> {isExporting ? 'Exporting...' : 'Download SVG'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleExportImage('png')} 
                  disabled={isExporting}
                  className="flex items-center gap-2"
                >
                  <Download size={16} /> {isExporting ? 'Exporting...' : 'Download PNG (@2x)'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'html' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[var(--text-primary)] font-medium">HTML with Inline CSS</h3>
                <Button variant="outline" size="sm" onClick={handleCopyHtml} className="flex items-center gap-2">
                  {copiedHtml ? <Check size={14} /> : <Copy size={14} />}
                  {copiedHtml ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="bg-[#1e293b] p-4 rounded-lg overflow-x-auto">
                <pre className="text-[#f8fafc] text-sm font-mono leading-relaxed">
                  <code>{htmlCode}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[var(--text-primary)] font-medium">JSON AST (Arc Script)</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyJson} className="flex items-center gap-2">
                    {copiedJson ? <Check size={14} /> : <Copy size={14} />}
                    {copiedJson ? 'Copied!' : 'Copy JSON'}
                  </Button>
                  <Button size="sm" onClick={handleSaveDiagram} className="flex items-center gap-2">
                    <Download size={14} /> Save File
                  </Button>
                </div>
              </div>
              <div className="bg-[#1e293b] p-4 rounded-lg overflow-x-auto">
                <pre className="text-[#f8fafc] text-sm font-mono leading-relaxed">
                  <code>{JSON.stringify(nodes, null, 2)}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
