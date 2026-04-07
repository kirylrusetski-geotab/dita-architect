import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Quill from 'quill';
import { 
  FileCode, UploadCloud, Type, List, ListOrdered, Bold, Italic, 
  ArrowLeft, AlertCircle, Info, CheckCircle, Terminal, Check, X, Save,
  Download, RefreshCw, FileText, Undo, Redo, AlertTriangle, Lightbulb,
  ArrowUp, ArrowDown, FolderOpen, FolderPlus, FolderCheck, Trash2,
  ListStart, CheckSquare, Bookmark, ExternalLink
} from 'lucide-react';
import { migrateToDita } from '../services/geminiService';
import { parseDitaXml, generateDitaXml, extractTextFromBlocks } from '../utils/ditaUtils';
import { calculateFleschReadingEase } from '../utils/textAnalysis';
import { DitaBlock, Project, DitaFile } from '../types';
import { Spinner } from './Spinner';
import { ConversionWizard, ConversionOptions } from './ConversionWizard';
import { ProjectManager } from './ProjectManager';

interface EditorProps {
  initialContent?: string;
}

export interface EditorHandle {
  getContent: () => string;
  proposeChanges: (xml: string) => void;
}

// Helper to render inline content including xrefs, uicontrols, bold, italic
const renderInlineContent = (text: string) => {
  if (!text) return null;
  
  try {
    // Use DOMParser to handle nested or sequential tags robustly
    // We wrap text in a root element to ensure valid XML parsing of fragments
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<root>${text}</root>`, 'text/xml');
    
    // Check for parser errors (e.g. malformed tags in input)
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn("Inline XML parse warning:", parserError.textContent);
      return text; // Fallback to raw text
    }

    const renderNode = (node: Node, key: number): React.ReactNode => {
      if (node.nodeType === 3) { // Text node
        return node.textContent;
      }
      
      if (node.nodeType === 1) { // Element node
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        const children = Array.from(el.childNodes).map((child, i) => renderNode(child, i));

        switch (tagName) {
          case 'uicontrol':
            return (
              <span key={key} className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 shadow-sm font-mono tracking-tight select-none align-baseline">
                {children}
              </span>
            );
          case 'b':
            return <strong key={key} className="font-bold text-slate-900">{children}</strong>;
          case 'i':
            return <em key={key} className="italic text-slate-800">{children}</em>;
          case 'xref':
             const href = el.getAttribute('href') || '#';
             return (
                <a 
                  key={key} 
                  href={href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 underline decoration-blue-300 hover:text-blue-800 hover:decoration-blue-500 underline-offset-2 inline-flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {children}
                  <ExternalLink size={10} className="opacity-50" />
                </a>
             );
          default:
            // Render children of unknown tags without formatting
            return <span key={key}>{children}</span>;
        }
      }
      return null;
    };

    return Array.from(doc.documentElement.childNodes).map((node, i) => renderNode(node, i));

  } catch (e) {
    console.error("Inline render error", e);
    return text;
  }
};

export const Editor = forwardRef<EditorHandle, EditorProps>(({ initialContent = '' }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<Quill | null>(null);
  
  // State
  const [mode, setMode] = useState<'edit' | 'visual_dita'>('edit');
  const [isMigrating, setIsMigrating] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isBackConfirmationOpen, setIsBackConfirmationOpen] = useState(false);
  const [ditaBlocks, setDitaBlocks] = useState<DitaBlock[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [rawXml, setRawXml] = useState<string>('');
  
  // Readability State
  const [readability, setReadability] = useState<{ score: number; label: string; color: string } | null>(null);
  
  // Persistence & UI State
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showLoadEmptyToast, setShowLoadEmptyToast] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedDataToLoad, setSavedDataToLoad] = useState<any>(null);
  
  // Download State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('');

  // Project Manager State
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [activeProjectInfo, setActiveProjectInfo] = useState<{name: string, file: string} | null>(null);

  // Review State
  const [proposedXml, setProposedXml] = useState<string | null>(null);
  const [proposedBlocks, setProposedBlocks] = useState<DitaBlock[] | null>(null);

  useImperativeHandle(ref, () => ({
    getContent: () => {
      // Return XML if available, otherwise rich text
      if (mode === 'visual_dita' || rawXml) {
        return rawXml;
      }
      return quillInstance.current?.getText() || '';
    },
    proposeChanges: (xml: string) => {
      try {
        const blocks = parseDitaXml(xml);
        setProposedXml(xml);
        setProposedBlocks(blocks);
        setMode('visual_dita'); // Force switch to visual mode to see changes
      } catch (e) {
        console.error("Failed to parse proposed XML", e);
        alert("The AI suggested changes but they couldn't be rendered.");
      }
    }
  }));

  // Initialize Quill and Load State
  useEffect(() => {
    if (editorRef.current && !quillInstance.current) {
      quillInstance.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: '#custom-toolbar',
          history: {
            delay: 1000,
            maxStack: 100,
            userOnly: true
          }
        },
        placeholder: 'Start writing your technical content here...',
      });

      // Load from Local Storage or use Initial Content
      const savedState = localStorage.getItem('dita-doer-state');
      let contentLoaded = false;

      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.richText) {
            quillInstance.current.root.innerHTML = parsed.richText;
            contentLoaded = true;
          }
        } catch (e) {
          console.error("Failed to load rich text from storage", e);
        }
      }

      if (!contentLoaded && initialContent) {
        quillInstance.current.root.innerHTML = initialContent;
      }
    }
  }, [initialContent]);

  // Restore Mode and DITA Content
  useEffect(() => {
    const savedState = localStorage.getItem('dita-doer-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.timestamp) {
          setLastSaved(new Date(parsed.timestamp));
        }

        if (parsed.mode === 'visual_dita' && parsed.rawXml) {
          setRawXml(parsed.rawXml);
          setDitaBlocks(parseDitaXml(parsed.rawXml));
          setMode('visual_dita');
        }
      } catch (e) {
        console.error("Failed to load DITA state from storage", e);
      }
    }
  }, []);

  // Calculate Readability when in Visual DITA mode
  useEffect(() => {
    if (mode === 'visual_dita') {
      const blocksToAnalyze = proposedBlocks || ditaBlocks;
      const text = extractTextFromBlocks(blocksToAnalyze);
      setReadability(calculateFleschReadingEase(text));
    } else {
      setReadability(null);
    }
  }, [mode, ditaBlocks, proposedBlocks]);

  const handleSave = () => {
    const currentState = {
      mode,
      rawXml,
      richText: quillInstance.current?.root.innerHTML || '',
      timestamp: new Date().toISOString()
    };
    try {
      localStorage.setItem('dita-doer-state', JSON.stringify(currentState));
      setLastSaved(new Date());
      
      // Show confirmation toast
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) {
      console.error("Failed to save to local storage", e);
      alert("Failed to save. Storage might be full.");
    }
  };

  const handleLoadClick = () => {
    const saved = localStorage.getItem('dita-doer-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedDataToLoad(parsed);
        setShowLoadModal(true);
      } catch (e) {
        console.error("Error parsing saved state", e);
        alert("Saved file is corrupted.");
      }
    } else {
      setShowLoadEmptyToast(true);
      setTimeout(() => setShowLoadEmptyToast(false), 3000);
    }
  };

  const confirmLoad = () => {
    if (savedDataToLoad) {
      if (quillInstance.current && savedDataToLoad.richText) {
        quillInstance.current.root.innerHTML = savedDataToLoad.richText;
      }
      
      if (savedDataToLoad.mode === 'visual_dita' && savedDataToLoad.rawXml) {
        setRawXml(savedDataToLoad.rawXml);
        setDitaBlocks(parseDitaXml(savedDataToLoad.rawXml));
        setMode('visual_dita');
      } else {
        setMode('edit');
        setRawXml('');
        setDitaBlocks([]);
      }
      
      if (savedDataToLoad.timestamp) {
        setLastSaved(new Date(savedDataToLoad.timestamp));
      }
      
      setShowLoadModal(false);
      setSavedDataToLoad(null);
      setActiveProjectInfo(null); // Reset project link on local load
    }
  };

  const handleLoadFileFromProject = (file: DitaFile, project: Project) => {
    // Determine if we should be in visual mode
    try {
        const blocks = parseDitaXml(file.content);
        if (blocks && blocks.length > 0 && blocks[0].type !== 'unknown') {
            setRawXml(file.content);
            setDitaBlocks(blocks);
            setMode('visual_dita');
            setLastSaved(new Date());
            setActiveProjectInfo({ name: project.name, file: file.fileName });
        } else {
            // Fallback to text or codeblock if parser fails
            setRawXml(file.content);
            setDitaBlocks([{ type: 'codeblock', content: file.content }]);
            setMode('visual_dita');
            setActiveProjectInfo({ name: project.name, file: file.fileName });
        }
    } catch (e) {
        console.error("Error loading project file", e);
    }
  };

  const handleProjectSaveSuccess = (file: DitaFile, project: Project) => {
    setActiveProjectInfo({ name: project.name, file: file.fileName });
    setIsProjectManagerOpen(false);
  };

  const handleDownloadClick = () => {
    // Generate default filename
    let defaultName = 'document';
    
    if (mode === 'visual_dita' || (rawXml && rawXml.trim().length > 0)) {
       // Try to extract title for filename in DITA mode
       const titleMatch = rawXml.match(/<title>(.*?)<\/title>/);
       if (titleMatch && titleMatch[1]) {
         defaultName = titleMatch[1].replace(/[^a-z0-9]/gi, '_').toLowerCase();
       }
    }
    
    setDownloadFileName(defaultName);
    setShowDownloadModal(true);
  };

  const performDownload = () => {
    let content = '';
    let mimeType = '';
    let extension = '';

    if (mode === 'visual_dita' || (rawXml && rawXml.trim().length > 0)) {
       content = rawXml;
       if(!content) content = "<!-- No XML content generated -->";
       mimeType = 'application/xml';
       extension = 'dita';
    } else {
       // Rich Text Mode -> RTF
       const text = quillInstance.current?.getText() || '';
       
       // Basic RTF escaping
       const escapedText = text
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\n/g, '\\par\n');
            
       // Construct a simple RTF document
       // Header includes fonts and basic setup
       content = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}\n{\\*\\generator DITA Doer 3.0;}\\viewkind4\\uc1 \n\\pard\\sa200\\sl276\\slmult1\\f0\\fs22\\lang9 ${escapedText}\\par\n}`;
       
       mimeType = 'application/rtf';
       extension = 'rtf';
    }

    // Append extension if user didn't type it
    const finalFilename = downloadFileName.toLowerCase().endsWith(`.${extension}`) 
        ? downloadFileName 
        : `${downloadFileName}.${extension}`;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowDownloadModal(false);
  };

  const handleStartMigration = () => {
    if (!quillInstance.current) return;
    const textContent = quillInstance.current.getText();
    if (!textContent.trim()) {
      alert("Please enter some text to migrate.");
      return;
    }
    setIsWizardOpen(true);
  };

  const handleConfirmMigration = async (options: ConversionOptions) => {
    setIsWizardOpen(false);
    setIsMigrating(true);
    
    try {
      if (!quillInstance.current) return;
      const htmlContent = quillInstance.current.root.innerHTML;

      const ditaXml = await migrateToDita(htmlContent, {
        topicType: options.topicType,
        title: options.title,
        shortDesc: options.shortDesc,
        additionalInstructions: options.additionalInstructions,
      });

      const blocks = parseDitaXml(ditaXml);
      
      setRawXml(ditaXml);
      setDitaBlocks(blocks);
      setLastSaved(new Date());
      setMode('visual_dita');
      setActiveProjectInfo(null); // Reset project info as this is a new migration
    } catch (error) {
      console.error(error);
      alert("Migration failed. Please try again.");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAcceptProposal = () => {
    if (proposedXml && proposedBlocks) {
      setRawXml(proposedXml);
      setDitaBlocks(proposedBlocks);
      setProposedXml(null);
      setProposedBlocks(null);
      setLastSaved(new Date());
    }
  };

  const handleRejectProposal = () => {
    setProposedXml(null);
    setProposedBlocks(null);
  };

  const handleBackClick = () => {
    setIsBackConfirmationOpen(true);
  };

  const handleConfirmBack = () => {
    setMode('edit');
    setRawXml('');
    setDitaBlocks([]);
    setActiveProjectInfo(null);
    setIsBackConfirmationOpen(false);
  };

  const handleUndo = () => {
    if (quillInstance.current) {
      const history = quillInstance.current.getModule('history') as any;
      if (history && typeof history.undo === 'function') {
        history.undo();
      }
    }
  };

  const handleRedo = () => {
    if (quillInstance.current) {
      const history = quillInstance.current.getModule('history') as any;
      if (history && typeof history.redo === 'function') {
        history.redo();
      }
    }
  };

  const handleClear = () => {
    if (quillInstance.current) {
      if (confirm('Are you sure you want to clear the editor?')) {
        quillInstance.current.setText('');
      }
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const isReviewing = !!proposedBlocks;
    const currentBlocks = isReviewing ? proposedBlocks : ditaBlocks;
    
    if (!currentBlocks) return;

    const newBlocks = [...currentBlocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Safety checks
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    
    // Prevent moving above title/shortdesc
    const targetBlock = newBlocks[targetIndex];
    if (targetBlock.type === 'title' || targetBlock.type === 'shortdesc') return;

    // Swap
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];

    // Regenerate XML
    // Use rawXml to detect root type
    const sourceXml = isReviewing ? proposedXml : rawXml;
    const newXml = generateDitaXml(newBlocks, sourceXml || undefined);

    if (isReviewing) {
        setProposedBlocks(newBlocks);
        setProposedXml(newXml);
    } else {
        setDitaBlocks(newBlocks);
        setRawXml(newXml);
        setLastSaved(new Date());
    }
  };

  const canMoveUp = (index: number) => {
    const blocks = proposedBlocks || ditaBlocks;
    if (index <= 0) return false;
    // Cannot move up if the previous block is title or shortdesc
    const prevBlock = blocks[index - 1];
    return prevBlock.type !== 'title' && prevBlock.type !== 'shortdesc';
  };

  const canMoveDown = (index: number) => {
    const blocks = proposedBlocks || ditaBlocks;
    if (index >= blocks.length - 1) return false;
    return true;
  };

  const renderDitaBlock = (block: DitaBlock, index: number) => {
    let blockContent;

    switch (block.type) {
      case 'title':
        blockContent = (
          <h1 className="text-3xl font-bold text-slate-800 mb-2 pb-2 border-b border-slate-200">
            {renderInlineContent(block.content || '')}
          </h1>
        );
        break;
      case 'shortdesc':
        blockContent = (
          <p className="text-lg text-slate-600 italic mb-4">
            {renderInlineContent(block.content || '')}
          </p>
        );
        break;
      case 'section-title':
        blockContent = (
          <h3 className="text-xl font-bold text-slate-700 mt-6 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block"></span>
            {renderInlineContent(block.content || '')}
          </h3>
        );
        break;
      case 'context':
        blockContent = (
          <div className="border border-slate-200 rounded-md p-4 mb-4 bg-slate-50/50">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 select-none">
              Context
            </div>
            <p className="text-slate-700">{renderInlineContent(block.content || '')}</p>
          </div>
        );
        break;
      case 'prereq':
        blockContent = (
          <div className="border border-indigo-200 rounded-md p-4 mb-4 bg-indigo-50/30">
             <div className="flex items-center gap-2 text-indigo-500 font-bold uppercase text-xs mb-2">
               <ListStart size={14} /> Prerequisites
             </div>
             <p className="text-slate-700">{renderInlineContent(block.content || '')}</p>
          </div>
        );
        break;
      case 'result':
        blockContent = (
          <div className="border border-slate-200 rounded-md p-4 mb-4 bg-slate-50/50">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 select-none">
               Result
             </div>
             <p className="text-slate-700">{renderInlineContent(block.content || '')}</p>
          </div>
        );
        break;
      case 'paragraph':
        blockContent = (
          <p className="mb-2 text-slate-700 leading-relaxed text-base">
            {renderInlineContent(block.content || '')}
          </p>
        );
        break;
      case 'note':
        const noteStyles = {
          tip: { 
            style: 'bg-emerald-50 border-emerald-500 text-emerald-900', 
            icon: Lightbulb, 
            label: 'Tip' 
          },
          warning: { 
            style: 'bg-amber-50 border-amber-500 text-amber-900', 
            icon: AlertTriangle, 
            label: 'Warning' 
          },
          caution: { 
            style: 'bg-red-50 border-red-500 text-red-900', 
            icon: AlertCircle, 
            label: 'Caution' 
          },
          note: { 
            style: 'bg-blue-50 border-blue-500 text-blue-900', 
            icon: Info, 
            label: 'Note' 
          },
        };
        const type = (block.noteType || 'note') as keyof typeof noteStyles;
        const config = noteStyles[type] || noteStyles.note;
        const Icon = config.icon;
        
        blockContent = (
          <div className={`border-l-4 p-4 mb-2 rounded-r-md flex items-start gap-3 ${config.style}`}>
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70">{config.label}</div>
              <div className="text-sm font-medium">{renderInlineContent(block.content || '')}</div>
            </div>
          </div>
        );
        break;
      case 'ordered-list':
        blockContent = (
          <ol className="list-decimal list-outside ml-6 mb-2 space-y-2 text-slate-700">
            {block.items?.map((item, i) => <li key={i}>{renderInlineContent(item)}</li>)}
          </ol>
        );
        break;
      case 'unordered-list':
        blockContent = (
          <ul className="list-disc list-outside ml-6 mb-2 space-y-2 text-slate-700">
            {block.items?.map((item, i) => <li key={i}>{renderInlineContent(item)}</li>)}
          </ul>
        );
        break;
      case 'steps':
        blockContent = (
          <div className="space-y-4 mb-4">
             {block.steps?.map((step, i) => (
                <div key={i} className="flex gap-4">
                   <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center mt-0.5 border border-slate-200">
                      {i + 1}
                   </div>
                   <div className="flex-1">
                      <div className="font-medium text-slate-800">{renderInlineContent(step.cmd)}</div>
                      {step.info && (
                        <div className="mt-1 text-slate-600 text-sm italic border-l-2 border-slate-200 pl-3 py-1">
                          {renderInlineContent(step.info)}
                        </div>
                      )}
                      {step.substeps && step.substeps.length > 0 && (
                        <ol className="mt-2 list-[lower-alpha] list-outside ml-4 space-y-1 text-sm text-slate-700">
                          {step.substeps.map((sub, j) => (
                            <li key={j}>{renderInlineContent(sub)}</li>
                          ))}
                        </ol>
                      )}
                   </div>
                </div>
             ))}
          </div>
        );
        break;
      case 'codeblock':
        blockContent = (
          <div className="mb-2 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
             <div className="bg-slate-900 px-3 py-1 border-b border-slate-700 flex items-center gap-2">
                <Terminal size={12} className="text-slate-500"/>
                <span className="text-xs text-slate-500 font-mono">CODE</span>
             </div>
             <pre className="p-4 overflow-x-auto">
              <code className="text-green-400 font-mono text-sm whitespace-pre">{block.content}</code>
             </pre>
          </div>
        );
        break;
      default:
        blockContent = (
          <div className="text-slate-400 italic">Unknown block</div>
        );
    }

    return (
      <div 
        key={index} 
        className="group relative transition-all duration-200 rounded-lg -mx-4 px-4 py-2 hover:bg-slate-50 hover:ring-1 hover:ring-blue-200"
      >
        <div className="absolute right-2 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-auto">
          <div className="flex h-7 bg-white rounded-md border border-blue-200 shadow-sm overflow-hidden">
            <div className="px-2.5 flex items-center bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wide select-none">
              {block.type}
            </div>
            
            {(block.type !== 'title' && block.type !== 'shortdesc') && (
              <div className="flex flex-col w-5 border-l border-blue-200">
                  <button 
                     onClick={(e) => { e.stopPropagation(); handleMoveBlock(index, 'up'); }}
                     disabled={!canMoveUp(index)}
                     className="flex-1 flex items-center justify-center hover:bg-blue-100 text-blue-600 disabled:text-blue-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                     title="Move Up"
                  >
                     <ArrowUp size={8} strokeWidth={3} />
                  </button>
                  <div className="h-px bg-blue-200"></div>
                  <button 
                     onClick={(e) => { e.stopPropagation(); handleMoveBlock(index, 'down'); }}
                     disabled={!canMoveDown(index)}
                     className="flex-1 flex items-center justify-center hover:bg-blue-100 text-blue-600 disabled:text-blue-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                     title="Move Down"
                  >
                     <ArrowDown size={8} strokeWidth={3} />
                  </button>
              </div>
            )}
          </div>
        </div>
        {blockContent}
      </div>
    );
  };

  const activeBlocks = proposedBlocks || ditaBlocks;
  const isReviewing = !!proposedBlocks;

  return (
    <>
      <div className={`flex flex-col h-full bg-white shadow-sm rounded-lg overflow-hidden border ${isReviewing ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'} transition-all relative`}>
        
        {/* Save Confirmation Toast */}
        {showSaveToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
              <CheckCircle size={16} className="text-green-400" />
              Saved to local storage
            </div>
          </div>
        )}

        {/* Load Empty Toast */}
        {showLoadEmptyToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="bg-amber-800 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={16} className="text-amber-200" />
              No files found in local storage
            </div>
          </div>
        )}

        {/* Header / Action Bar */}
        <div className={`border-b px-4 py-3 flex items-center justify-between z-10 shrink-0 h-14 ${isReviewing ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            {mode === 'edit' ? (
              <>
                <FileCode size={16} className="text-slate-400" />
                Drafting Canvas
              </>
            ) : (
              <>
                <CheckCircle size={16} className={isReviewing ? "text-amber-500" : "text-green-500"} />
                {isReviewing ? 'AI Suggestion Review' : 'DITA Visual Preview'}
              </>
            )}
          </h2>

          <div className="flex items-center gap-2">
            
            {/* Readability Score */}
            {mode === 'visual_dita' && readability && (
              <div 
                className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm border mr-2 cursor-help shadow-sm ${readability.color}`}
                title={`Readability: ${readability.label} (${readability.score})`}
              >
                {readability.score}
              </div>
            )}
            
            {/* Persistence Controls */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 mr-2">
                <button 
                  onClick={() => setIsProjectManagerOpen(true)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all"
                  title="Open Project Manager"
                >
                  <FolderOpen size={16} />
                  <span className="hidden sm:inline">Projects</span>
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button 
                  onClick={handleLoadClick}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all"
                  title="Load saved document (Draft)"
                >
                  <RefreshCw size={16} />
                  <span className="hidden sm:inline">Load Draft</span>
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all"
                  title="Save current work to local storage"
                >
                  <Save size={16} />
                  <span className="hidden sm:inline">Save Draft</span>
                </button>
            </div>

            {/* Visual Mode Specific Buttons */}
            {mode === 'visual_dita' && !isReviewing && (
                <button 
                    onClick={() => setIsProjectManagerOpen(true)}
                    className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-md text-xs font-bold transition-colors mr-2 border border-amber-200"
                    title="Save to Project"
                >
                    <FolderPlus size={16} />
                    <span className="hidden md:inline">Save to Project</span>
                </button>
            )}

            {/* Download Button */}
            <button 
              onClick={handleDownloadClick}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600 border border-transparent hover:border-slate-200 transition-colors mr-2"
              title={mode === 'visual_dita' ? "Download DITA XML" : "Download Rich Text Format"}
            >
              <Download size={18} />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1"></div>

            {isReviewing ? (
              <div className="flex gap-2">
                <button 
                  onClick={handleRejectProposal}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <X size={14} /> Reject
                </button>
                <button 
                  onClick={handleAcceptProposal}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-colors"
                >
                  <Check size={14} /> Accept Changes
                </button>
              </div>
            ) : (
              mode === 'edit' ? (
                <button 
                  onClick={handleStartMigration}
                  disabled={isMigrating}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm ${
                    isMigrating 
                      ? 'bg-blue-100 text-blue-400 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isMigrating ? <Spinner size="sm" color="border-current" /> : <UploadCloud size={16} />}
                  {isMigrating ? 'Converting...' : 'Convert to DITA'}
                </button>
              ) : (
                <button 
                  onClick={handleBackClick}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-300 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Editor
                </button>
              )
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-grow flex flex-col relative overflow-hidden">
          
          {/* MODE: EDIT (Quill) */}
          <div className={`flex-col h-full ${mode === 'edit' ? 'flex' : 'hidden'}`}>
            {/* Custom Toolbar */}
            <div id="custom-toolbar" className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-2 flex-wrap shrink-0">
              <span className="ql-formats flex gap-1 border-r border-slate-300 pr-2 mr-2">
                <button type="button" className="p-1.5 hover:bg-slate-200 rounded text-slate-700" onClick={handleUndo} title="Undo">
                  <Undo size={18} />
                </button>
                <button type="button" className="p-1.5 hover:bg-slate-200 rounded text-slate-700" onClick={handleRedo} title="Redo">
                  <Redo size={18} />
                </button>
                <button 
                  type="button" 
                  className="group relative p-1.5 hover:bg-red-100 text-slate-700 hover:text-red-600 rounded" 
                  onClick={handleClear}
                >
                  <Trash2 size={18} />
                  <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-sm">
                    Clear all Content
                  </span>
                </button>
              </span>

              <span className="ql-formats flex gap-1 border-r border-slate-300 pr-2 mr-2">
                <button className="ql-header p-1.5 hover:bg-slate-200 rounded" value="1" title="Heading 1"><Type size={18} /></button>
                <button className="ql-header p-1.5 hover:bg-slate-200 rounded" value="2" title="Heading 2"><Type size={14} /></button>
              </span>
              
              <span className="ql-formats flex gap-1 border-r border-slate-300 pr-2 mr-2">
                <button className="ql-bold p-1.5 hover:bg-slate-200 rounded" title="Bold"><Bold size={18} /></button>
                <button className="ql-italic p-1.5 hover:bg-slate-200 rounded" title="Italic"><Italic size={18} /></button>
              </span>

              <span className="ql-formats flex gap-1 border-r border-slate-300 pr-2 mr-2">
                <button className="ql-list p-1.5 hover:bg-slate-200 rounded" value="ordered" title="Ordered List"><ListOrdered size={18} /></button>
                <button className="ql-list p-1.5 hover:bg-slate-200 rounded" value="bullet" title="Bullet List"><List size={18} /></button>
              </span>
            </div>

            <div className="flex-grow bg-white relative">
              <div ref={editorRef} className="h-full font-serif text-lg text-slate-800" />
            </div>
          </div>

          {/* MODE: VISUAL DITA (View & Review) */}
          {mode === 'visual_dita' && (
            <div className={`flex-grow overflow-y-auto p-8 transition-colors ${isReviewing ? 'bg-amber-50/30' : 'bg-slate-50/50'}`}>
              
              {/* Active Project Confirmation Box */}
              {activeProjectInfo && (
                  <div className="max-w-3xl mx-auto mb-6 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 text-green-700">
                      <div className="bg-green-100 p-1.5 rounded-full">
                         <FolderCheck size={18} className="text-green-600" />
                      </div>
                      <span className="text-sm">
                        Saved to Project: <span className="font-bold">{activeProjectInfo.name}</span> <span className="text-green-400 mx-1">/</span> {activeProjectInfo.file}
                      </span>
                    </div>
                    <button 
                       onClick={() => setActiveProjectInfo(null)} 
                       className="p-1 hover:bg-green-100 rounded-full text-green-500 hover:text-green-700 transition-colors"
                       title="Dismiss"
                    >
                      <X size={16} />
                    </button>
                  </div>
              )}

              <div className="max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-xl p-8 min-h-[500px]">
                {activeBlocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <AlertCircle size={48} className="mb-4 opacity-50"/>
                      <p>No valid DITA content found.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex justify-start">
                      <span className={`text-[10px] font-mono px-2 py-1 rounded ${isReviewing ? 'bg-amber-100 text-amber-600' : 'text-slate-400 bg-slate-100'}`}>
                          {isReviewing ? 'PROPOSED CHANGES' : 'DITA TOPIC PREVIEW'}
                      </span>
                    </div>
                    {activeBlocks.map((block, index) => renderDitaBlock(block, index))}
                  </>
                )}
              </div>

              {/* Raw XML Toggle */}
              <div className="max-w-3xl mx-auto mt-8">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {isReviewing ? 'Generated XML Source (Proposed)' : 'Generated XML Source'}
                </h3>
                <pre className="bg-slate-800 text-slate-300 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-700 shadow-inner">
                  {isReviewing ? proposedXml : rawXml}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Status */}
        <div className={`text-xs px-4 py-2 border-t flex justify-between shrink-0 ${isReviewing ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
          <span className="font-medium">
            {mode === 'edit' ? 'Rich Text Mode' : isReviewing ? 'Review Mode' : 'DITA Visual Mode'}
          </span>
          <span>{lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Ready'}</span>
        </div>
      </div>

      {/* Migration Wizard Modal */}
      <ConversionWizard 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onConfirm={handleConfirmMigration}
        initialText={quillInstance.current?.getText() || ''}
      />

      {/* Project Manager Modal */}
      <ProjectManager
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        currentXml={mode === 'visual_dita' ? rawXml : undefined}
        onLoadFile={handleLoadFileFromProject}
        onSaveSuccess={handleProjectSaveSuccess}
      />

      {/* Back Confirmation Modal */}
      {isBackConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 text-amber-600 mb-4">
                <div className="p-2 bg-amber-100 rounded-full">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Discard Generated Content?</h3>
              </div>
              <p className="text-slate-600 mb-6 leading-relaxed">
                Going back to the editor will discard the converted DITA content. You will lose the current conversion results and have to generate them again.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setIsBackConfirmationOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmBack}
                  className="px-4 py-2 bg-amber-600 text-white font-medium hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
                >
                  Discard & Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Download size={18} className="text-blue-500"/> 
                   Download File
                </h3>
                <button onClick={() => setShowDownloadModal(false)} className="text-slate-400 hover:text-slate-600">
                   <X size={18}/>
                </button>
             </div>
             <div className="p-6">
                <div className="mb-4">
                   <label className="block text-xs font-bold uppercase text-slate-500 mb-2">File Name</label>
                   <div className="flex items-center">
                      <input 
                        type="text" 
                        value={downloadFileName}
                        onChange={(e) => setDownloadFileName(e.target.value)}
                        className="flex-grow p-2 border border-slate-300 rounded-l-md focus:border-blue-500 outline-none text-slate-800"
                        autoFocus
                      />
                      <div className="bg-slate-100 border border-l-0 border-slate-300 p-2 rounded-r-md text-slate-500 text-sm font-mono select-none">
                         {mode === 'visual_dita' || (rawXml && rawXml.trim().length > 0) ? '.dita' : '.rtf'}
                      </div>
                   </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                   <button 
                      onClick={() => setShowDownloadModal(false)}
                      className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                   >
                      Cancel
                   </button>
                   <button 
                      onClick={performDownload}
                      className="flex-1 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                   >
                      <Download size={16} /> Download
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Load Document Modal */}
      {showLoadModal && savedDataToLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <FileText size={18} className="text-blue-500"/> 
                   Load Saved Draft
                </h3>
                <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-slate-600">
                   <X size={18}/>
                </button>
             </div>
             <div className="p-6">
                <div className="mb-4">
                   <span className="text-xs font-bold text-slate-400 uppercase">Save Date</span>
                   <p className="text-slate-800 font-medium">
                      {savedDataToLoad.timestamp ? new Date(savedDataToLoad.timestamp).toLocaleString() : 'Unknown Date'}
                   </p>
                </div>
                <div className="mb-6">
                   <span className="text-xs font-bold text-slate-400 uppercase">Content Preview</span>
                   <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-32 overflow-hidden relative">
                      <p className="text-sm text-slate-600 font-serif">
                         {savedDataToLoad.mode === 'visual_dita' 
                            ? (savedDataToLoad.rawXml ? savedDataToLoad.rawXml.substring(0, 150) + '...' : 'XML Content') 
                            : (savedDataToLoad.richText ? savedDataToLoad.richText.replace(/<[^>]*>/g, ' ').substring(0, 150) + '...' : 'Empty Draft')
                         }
                      </p>
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent"></div>
                   </div>
                   <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      {savedDataToLoad.mode === 'visual_dita' ? <FileCode size={12}/> : <Type size={12}/>}
                      <span>Type: {savedDataToLoad.mode === 'visual_dita' ? 'DITA XML Topic' : 'Rich Text Draft'}</span>
                   </div>
                </div>
                
                <div className="flex gap-3">
                   <button 
                      onClick={() => setShowLoadModal(false)}
                      className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                   >
                      Cancel
                   </button>
                   <button 
                      onClick={confirmLoad}
                      className="flex-1 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                   >
                      Load Document
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </>
  );
});
Editor.displayName = 'Editor';