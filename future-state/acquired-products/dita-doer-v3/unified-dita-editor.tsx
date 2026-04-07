import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, FileText, GitCompare, AlertCircle, CheckCircle, Download, 
  ArrowUp, ArrowDown, X, Search, Save, Scissors, Copy, Clipboard, 
  Trash2, Info, AlertTriangle, Lightbulb, Check 
} from 'lucide-react';

// Custom Undo/Redo icons since they're not available in our lucide-react version
const UndoIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 7v6h6"/>
    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
  </svg>
);

const RedoIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 7v6h-6"/>
    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
  </svg>
);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type EditorMode = 'visual' | 'code' | 'review';

type Block = {
  type: 'title' | 'shortdesc' | 'paragraph' | 'note' | 'ordered-list' | 'unordered-list' | 'codeblock';
  content?: string;
  noteType?: string;
  items?: string[];
};

type AppState = {
  xmlContent: string;
  blocks: Block[];
  proposedXml: string | null;
  proposedBlocks: Block[] | null;
  currentMode: EditorMode;
  syncStatus: 'synced' | 'modified';
  lastEditedIn: 'visual' | 'code' | 'ai';
  validationStatus: string;
  validatedTopicType: string | null;
  isProcessing: boolean;
};

type ValidationResult = {
  isValid: boolean;
  topicType: 'concept' | 'reference' | 'task' | 'unknown' | 'error';
  errorDescription?: string;
  suggestedFix?: string;
};

// ============================================================================
// AI INTEGRATION - ANTHROPIC API
// ============================================================================

async function callClaudeAPI(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          { role: "user", content: prompt }
        ],
        system: systemPrompt || "You are an expert in DITA XML authoring and technical writing."
      })
    });

    const data = await response.json();
    
    if (data.content && data.content[0] && data.content[0].text) {
      return data.content[0].text;
    }
    
    throw new Error("Invalid response from API");
  } catch (error) {
    console.error("AI API Error:", error);
    throw error;
  }
}

function extractXMLFromResponse(response: string): string | null {
  // Try to extract XML from code block
  const codeBlockRegex = /```xml\n([\s\S]*?)\n```/;
  const match = response.match(codeBlockRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // If no code block, check if response starts with XML
  if (response.trim().startsWith('<?xml') || response.trim().startsWith('<')) {
    return response.trim();
  }
  
  return null;
}

const initialXML = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="getting_started">
  <title>Getting Started with Unified DITA Editor</title>
  <shortdesc>Learn how to use the three-mode editing system for DITA content creation.</shortdesc>
  <conbody>
    <p>This editor combines visual editing, code editing, and AI-powered review capabilities in one unified interface.</p>
    <note type="tip">Switch between Visual, Code, and Review modes using the mode selector in the toolbar.</note>
    <p>Key features include:</p>
    <ol>
      <li>Visual block-based editing for intuitive content creation</li>
      <li>Monaco-powered code editor for direct XML manipulation</li>
      <li>AI-assisted review system for intelligent suggestions</li>
    </ol>
    <codeblock><concept id="example">
  <title>Example</title>
</concept></codeblock>
    <p>Start by exploring each mode to find your preferred workflow.</p>
  </conbody>
</concept>`;

// ============================================================================
// XML PARSER & SERIALIZER
// ============================================================================

function parseXMLToBlocks(xmlString: string): Block[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return [];
    }
    
    const blocks: Block[] = [];
    
    const title = doc.querySelector('title');
    if (title?.textContent) {
      blocks.push({ type: 'title', content: title.textContent.trim() });
    }
    
    const shortdesc = doc.querySelector('shortdesc');
    if (shortdesc?.textContent) {
      blocks.push({ type: 'shortdesc', content: shortdesc.textContent.trim() });
    }
    
    const body = doc.querySelector('conbody, taskbody, refbody');
    if (body) {
      Array.from(body.children).forEach(child => {
        const textContent = child.textContent?.trim() || '';
        
        switch(child.nodeName.toLowerCase()) {
          case 'p':
            blocks.push({ type: 'paragraph', content: textContent });
            break;
          case 'note':
            blocks.push({ 
              type: 'note', 
              noteType: child.getAttribute('type') || 'note',
              content: textContent 
            });
            break;
          case 'ol':
          case 'ul':
            const items = Array.from(child.querySelectorAll('li')).map(li => {
              // Handle nested content in list items
              return li.textContent?.trim() || '';
            });
            blocks.push({ 
              type: child.nodeName.toLowerCase() === 'ol' ? 'ordered-list' : 'unordered-list',
              items 
            });
            break;
          case 'codeblock':
            blocks.push({ type: 'codeblock', content: textContent });
            break;
          case 'steps':
            // Handle task steps
            const steps = Array.from(child.querySelectorAll('step')).map(step => {
              const cmd = step.querySelector('cmd');
              return cmd?.textContent?.trim() || step.textContent?.trim() || '';
            });
            if (steps.length > 0) {
              blocks.push({ type: 'ordered-list', items: steps });
            }
            break;
        }
      });
    }
    
    return blocks;
  } catch (error) {
    console.error('Error parsing XML:', error);
    return [];
  }
}

function serializeBlocksToXML(blocks: Block[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<concept id="document">\n`;
  
  let hasBody = false;
  
  blocks.forEach(block => {
    switch(block.type) {
      case 'title':
        xml += `  <title>${escapeXml(block.content || '')}</title>\n`;
        break;
      case 'shortdesc':
        xml += `  <shortdesc>${escapeXml(block.content || '')}</shortdesc>\n`;
        break;
      case 'paragraph':
        if (!hasBody) {
          xml += `  <conbody>\n`;
          hasBody = true;
        }
        xml += `    <p>${escapeXml(block.content || '')}</p>\n`;
        break;
      case 'note':
        if (!hasBody) {
          xml += `  <conbody>\n`;
          hasBody = true;
        }
        xml += `    <note type="${block.noteType || 'note'}">${escapeXml(block.content || '')}</note>\n`;
        break;
      case 'ordered-list':
        if (!hasBody) {
          xml += `  <conbody>\n`;
          hasBody = true;
        }
        xml += `    <ol>\n`;
        (block.items || []).forEach(item => {
          xml += `      <li>${escapeXml(item)}</li>\n`;
        });
        xml += `    </ol>\n`;
        break;
      case 'unordered-list':
        if (!hasBody) {
          xml += `  <conbody>\n`;
          hasBody = true;
        }
        xml += `    <ul>\n`;
        (block.items || []).forEach(item => {
          xml += `      <li>${escapeXml(item)}</li>\n`;
        });
        xml += `    </ul>\n`;
        break;
      case 'codeblock':
        if (!hasBody) {
          xml += `  <conbody>\n`;
          hasBody = true;
        }
        xml += `    <codeblock>${escapeXml(block.content || '')}</codeblock>\n`;
        break;
    }
  });
  
  if (hasBody) {
    xml += `  </conbody>\n`;
  }
  xml += `</concept>`;
  
  return xml;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// VISUAL EDITOR COMPONENTS
// ============================================================================

interface BlockInsertMenuProps {
  onInsert: (type: Block['type']) => void;
  onClose: () => void;
}

const BlockInsertMenu: React.FC<BlockInsertMenuProps> = ({ onInsert, onClose }) => {
  const blockTypes: { type: Block['type']; label: string; icon: string }[] = [
    { type: 'paragraph', label: 'Paragraph', icon: '¶' },
    { type: 'note', label: 'Note', icon: '!' },
    { type: 'ordered-list', label: 'Numbered List', icon: '1.' },
    { type: 'unordered-list', label: 'Bullet List', icon: '•' },
    { type: 'codeblock', label: 'Code Block', icon: '</>' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Insert Block</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {blockTypes.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => {
                onInsert(type);
                onClose();
              }}
              className="flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-sm text-white font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface BlockEditorProps {
  block: Block;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (index: number, updatedBlock: Block) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  index,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleContentChange = (e: React.FormEvent<HTMLElement>) => {
    onUpdate(index, { ...block, content: (e.target as HTMLElement).textContent || '' });
  };
  
  const handleItemChange = (itemIndex: number, newValue: string) => {
    const newItems = [...(block.items || [])];
    newItems[itemIndex] = newValue;
    onUpdate(index, { ...block, items: newItems });
  };
  
  const handleCopyCode = () => {
    if (block.content) {
      navigator.clipboard.writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getElementLabel = (type: string) => {
    const labels: Record<string, string> = {
      'title': 'Title',
      'shortdesc': 'Short Description',
      'paragraph': 'Paragraph',
      'note': 'Note',
      'ordered-list': 'Ordered List',
      'unordered-list': 'Unordered List',
      'codeblock': 'Code Block'
    };
    return labels[type] || type;
  };

  const getNoteConfig = (type: string = 'note') => {
    switch (type) {
      case 'tip':
        return {
          style: 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100',
          icon: Lightbulb,
          iconColor: 'text-emerald-400',
          label: 'Tip'
        };
      case 'warning':
        return {
          style: 'bg-amber-950/40 border-amber-500/50 text-amber-100',
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
          label: 'Warning'
        };
      case 'caution':
        return {
          style: 'bg-red-950/40 border-red-500/50 text-red-100',
          icon: AlertCircle,
          iconColor: 'text-red-400',
          label: 'Caution'
        };
      case 'note':
      default:
        return {
          style: 'bg-blue-950/40 border-blue-500/50 text-blue-100',
          icon: Info,
          iconColor: 'text-blue-400',
          label: 'Note'
        };
    }
  };

  const noteConfig = block.type === 'note' ? getNoteConfig(block.noteType) : null;
  const NoteIcon = noteConfig?.icon;
  
  return (
    <div 
      className="relative group transition-all duration-200 rounded-lg -mx-4 px-4 py-2 hover:bg-gray-800/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div className="absolute right-full top-0 mr-3 flex items-center gap-2 bg-gray-900/90 border border-gray-700 rounded px-2 py-1 shadow-lg backdrop-blur-sm z-20 whitespace-nowrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 border-r border-gray-700 pr-2 mr-1">
            {getElementLabel(block.type)}
          </span>
          
          <button 
            onClick={() => onMoveUp(index)} 
            disabled={isFirst}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move Up"
          >
            <ArrowUp size={14} />
          </button>
          
          <button 
            onClick={() => onMoveDown(index)} 
            disabled={isLast}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move Down"
          >
            <ArrowDown size={14} />
          </button>
          
          <div className="w-px h-3 bg-gray-700 mx-1"></div>
          
          <button 
            onClick={() => onDelete(index)} 
            className="text-red-400 hover:text-red-300 transition-colors"
            title="Delete"
          >
            <X size={14} />
          </button>
        </div>
      )}
      
      {block.type === 'title' && (
        <h1
          contentEditable
          suppressContentEditableWarning
          onBlur={handleContentChange}
          className="text-3xl font-bold text-white mb-2 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
        >
          {block.content}
        </h1>
      )}
      
      {block.type === 'shortdesc' && (
        <p
          contentEditable
          suppressContentEditableWarning
          onBlur={handleContentChange}
          className="text-gray-300 italic mb-4 outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
        >
          {block.content}
        </p>
      )}
      
      {block.type === 'paragraph' && (
        <p
          contentEditable
          suppressContentEditableWarning
          onBlur={handleContentChange}
          className="text-gray-200 mb-2 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2"
        >
          {block.content}
        </p>
      )}
      
      {block.type === 'note' && noteConfig && NoteIcon && (
        <div className={`border-l-4 p-4 mb-4 rounded-r-lg ${noteConfig.style} relative group/note`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${noteConfig.iconColor}`}>
               <NoteIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
               <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${noteConfig.iconColor} opacity-80 select-none`}>
                  {noteConfig.label}
               </div>
               <p
                contentEditable
                suppressContentEditableWarning
                onBlur={handleContentChange}
                className="outline-none focus:bg-black/10 rounded px-1 min-h-[1.5rem]"
              >
                {block.content}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {(block.type === 'ordered-list' || block.type === 'unordered-list') && (
        <div className="mb-2">
          {block.type === 'ordered-list' ? (
            <ol className="list-decimal list-inside space-y-2">
              {(block.items || []).map((item, idx) => (
                <li key={idx} className="text-gray-200">
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleItemChange(idx, e.currentTarget.textContent || '')}
                    className="outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="list-disc list-inside space-y-2">
              {(block.items || []).map((item, idx) => (
                <li key={idx} className="text-gray-200">
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleItemChange(idx, e.currentTarget.textContent || '')}
                    className="outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {block.type === 'codeblock' && (
        <div className="rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] mb-6 shadow-md ring-1 ring-white/5">
          <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-700">
             <div className="flex items-center gap-2">
                <Code size={14} className="text-blue-400"/>
                <span className="text-xs font-mono text-gray-400">XML</span>
             </div>
             <button
               onClick={handleCopyCode}
               className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded"
             >
               {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
               {copied ? <span className="text-green-400 font-medium">Copied</span> : 'Copy'}
             </button>
          </div>
          <div className="p-4 overflow-x-auto">
             <pre className="font-mono text-sm">
              <code
                contentEditable
                suppressContentEditableWarning
                onBlur={handleContentChange}
                className="text-gray-300 outline-none focus:ring-0 block min-h-[2rem]"
                spellCheck={false}
              >
                {block.content}
              </code>
             </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CODE EDITOR COMPONENT (Monaco Editor)
// ============================================================================

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initMonaco = () => {
      if (!editorRef.current) return;

      // Load Monaco from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js';
      script.async = true;
      
      script.onload = () => {
        if (!isMounted) return;
        
        (window as any).require.config({
          paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
        });

        (window as any).require(['vs/editor/editor.main'], () => {
          if (!isMounted || !editorRef.current) return;

          const editor = (window as any).monaco.editor.create(editorRef.current, {
            value: value,
            language: 'xml',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: true },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'all',
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            }
          });

          editor.onDidChangeModelContent(() => {
            onChange(editor.getValue());
          });

          setEditorInstance(editor);
          setIsLoading(false);
        });
      };

      document.head.appendChild(script);
    };

    // Check if Monaco is already loaded
    if ((window as any).monaco) {
      if (editorRef.current) {
        const editor = (window as any).monaco.editor.create(editorRef.current, {
          value: value,
          language: 'xml',
          theme: 'vs-dark',
          automaticLayout: true,
          fontSize: 14,
          minimap: { enabled: true },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        });

        editor.onDidChangeModelContent(() => {
          onChange(editor.getValue());
        });

        setEditorInstance(editor);
        setIsLoading(false);
      }
    } else {
      initMonaco();
    }

    return () => {
      isMounted = false;
      if (editorInstance) {
        editorInstance.dispose();
      }
    };
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (editorInstance && editorInstance.getValue() !== value) {
      const position = editorInstance.getPosition();
      editorInstance.setValue(value);
      if (position) {
        editorInstance.setPosition(position);
      }
    }
  }, [value, editorInstance]);

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg border border-gray-700 relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm">Loading Monaco Editor...</p>
          </div>
        </div>
      )}
      <div ref={editorRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// VALIDATION ERROR MODAL
// ============================================================================

interface ValidationErrorModalProps {
  error: ValidationResult;
  onClose: () => void;
  onApplyFix: (fix: string) => void;
}

const ValidationErrorModal: React.FC<ValidationErrorModalProps> = ({ error, onClose, onApplyFix }) => {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-red-500/50">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Validation Error
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 text-gray-300">
          <h3 className="font-semibold text-lg text-white mb-2">Description:</h3>
          <p className="bg-gray-900 p-3 rounded mb-4">{error.errorDescription || 'An unknown validation error occurred.'}</p>

          {error.suggestedFix && (
            <>
              <h3 className="font-semibold text-lg text-white mb-2">Suggested Fix:</h3>
              <div className="bg-gray-900 p-3 rounded max-h-60 overflow-y-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap"><code>{error.suggestedFix}</code></pre>
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end space-x-4">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
          {error.suggestedFix && (
            <button
              onClick={() => onApplyFix(error.suggestedFix!)}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors font-semibold"
            >
              Apply Fix
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PREVIEW MODAL
// ============================================================================

interface PreviewModalProps {
  htmlContent: string;
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ htmlContent, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-4/5 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
          <h2 className="text-xl font-bold text-gray-800">Content Preview</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 flex-grow overflow-y-auto bg-white">
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReviewModeProps {
  originalXml: string;
  proposedXml: string;
  originalBlocks: Block[];
  proposedBlocks: Block[];
  viewMode: 'code' | 'visual';
  onViewModeChange: (mode: 'code' | 'visual') => void;
  onAccept: () => void;
  onReject: () => void;
  onModify: () => void;
}

const ReviewMode: React.FC<ReviewModeProps> = ({
  originalXml,
  proposedXml,
  originalBlocks,
  proposedBlocks,
  viewMode,
  onViewModeChange,
  onAccept,
  onReject,
  onModify
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
       {/* Toolbar for Review */}
       <div className="bg-gray-800 border-b border-gray-700 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-300 pl-2">Diff View:</span>
            <div className="flex bg-gray-700 rounded p-1">
              <button
                onClick={() => onViewModeChange('code')}
                className={`px-3 py-1 text-xs rounded transition-colors ${viewMode === 'code' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Code
              </button>
              <button
                onClick={() => onViewModeChange('visual')}
                className={`px-3 py-1 text-xs rounded transition-colors ${viewMode === 'visual' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Visual
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-2">
             <span className="text-xs text-gray-400 mr-2">Review Pending Changes</span>
             <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition-colors">
               <CheckCircle size={14}/> Accept
             </button>
             <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors">
               <X size={14}/> Reject
             </button>
             <button onClick={onModify} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors">
               Modify
             </button>
          </div>
       </div>

       {/* Diff Content */}
       <div className="flex-1 overflow-hidden relative">
          {viewMode === 'code' ? (
             <div className="flex h-full">
               <div className="flex-1 border-r border-gray-700 flex flex-col">
                  <div className="bg-gray-800/50 px-4 py-2 text-xs font-mono text-red-400 border-b border-gray-700">ORIGINAL</div>
                  <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-gray-400 whitespace-pre bg-gray-900/50">
                    {originalXml}
                  </pre>
               </div>
               <div className="flex-1 flex flex-col">
                  <div className="bg-gray-800/50 px-4 py-2 text-xs font-mono text-green-400 border-b border-gray-700">PROPOSED</div>
                  <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-gray-300 whitespace-pre bg-gray-900/50">
                    {proposedXml}
                  </pre>
               </div>
             </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
               <GitCompare className="w-16 h-16 mb-4 opacity-20" />
               <p className="text-lg font-medium">Visual Diff Preview</p>
               <p className="text-sm opacity-60">Visual block comparison is currently in development.</p>
               <button onClick={() => onViewModeChange('code')} className="mt-4 text-blue-400 hover:text-blue-300 text-sm underline">Switch to Code View</button>
            </div>
          )}
       </div>
    </div>
  );
};

// ============================================================================
// TOOLBAR COMPONENT
// ============================================================================

interface ToolbarProps {
  currentMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  syncStatus: 'synced' | 'modified';
  onFileAction: (action: 'cut' | 'copy' | 'paste' | 'clear') => void;
  onQuickAction: (action: 'find' | 'undo' | 'redo') => void;
  onFormat: (type: 'concept' | 'reference' | 'task') => void;
  onValidate: () => void;
  onPreview: () => void;
  onDownload: () => void;
  isProcessing: boolean;
  validationStatus: string;
  validatedTopicType: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentMode,
  onModeChange,
  syncStatus,
  onFileAction,
  onQuickAction,
  onFormat,
  onValidate,
  onPreview,
  onDownload,
  isProcessing,
  validationStatus,
  validatedTopicType
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mode Selector */}
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => onModeChange('visual')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                currentMode === 'visual' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="font-medium">Visual</span>
            </button>
            <button
              onClick={() => onModeChange('code')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                currentMode === 'code' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Code className="w-4 h-4" />
              <span className="font-medium">Code</span>
            </button>
            <button
              onClick={() => onModeChange('review')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                currentMode === 'review' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <GitCompare className="w-4 h-4" />
              <span className="font-medium">Review</span>
            </button>
          </div>
          
          {/* Sync Status */}
          <div className="flex items-center gap-2 text-sm">
            {syncStatus === 'synced' ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Synced</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400">Modified</span>
              </>
            )}
          </div>
        </div>
        
        {/* Center: Status Message */}
        {validationStatus && (
          <div className="flex-shrink-0 text-sm text-cyan-400">
            {validationStatus}
          </div>
        )}
        
        {/* Center: Action Menus */}
        <div className="flex items-center gap-2">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => setFileMenuOpen(!fileMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>File</span>
            </button>
            
            {fileMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-20">
                <button
                  onClick={() => {
                    onFileAction('cut');
                    setFileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Scissors className="w-4 h-4" />
                  <span>Cut</span>
                </button>
                <button
                  onClick={() => {
                    onFileAction('copy');
                    setFileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => {
                    onFileAction('paste');
                    setFileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Clipboard className="w-4 h-4" />
                  <span>Paste</span>
                </button>
                <div className="h-px bg-gray-700 my-1" />
                <button
                  onClick={() => {
                    onFileAction('clear');
                    setFileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Quick Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors"
            >
              <span>Quick Actions</span>
            </button>
            
            {quickMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-20">
                <button
                  onClick={() => {
                    onQuickAction('find');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Search className="w-4 h-4" />
                  <span>Find</span>
                </button>
                <div className="h-px bg-gray-700 my-1" />
                <button
                  onClick={() => {
                    onQuickAction('undo');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <UndoIcon className="w-4 h-4" />
                  <span>Undo</span>
                </button>
                <button
                  onClick={() => {
                    onQuickAction('redo');
                    setQuickMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <RedoIcon className="w-4 h-4" />
                  <span>Redo</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Download */}
        <button
          onClick={onDownload}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function UnifiedDitaEditor() {
  const [state, setState] = useState<AppState>({
    xmlContent: initialXML,
    blocks: [],
    proposedXml: null,
    proposedBlocks: null,
    currentMode: 'visual',
    syncStatus: 'synced',
    lastEditedIn: 'visual',
    validationStatus: '',
    validatedTopicType: null,
    isProcessing: false
  });
  
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [reviewViewMode, setReviewViewMode] = useState<'code' | 'visual'>('code');
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  
  // Initialize blocks from XML
  useEffect(() => {
    const parsedBlocks = parseXMLToBlocks(state.xmlContent);
    setState(prev => ({ ...prev, blocks: parsedBlocks }));
  }, []);
  
  // Handle mode switching with sync
  const handleModeChange = (newMode: EditorMode) => {
    if (newMode === state.currentMode) return;
    
    // Sync before switching
    if (state.currentMode === 'visual' && state.syncStatus === 'modified') {
      // Sync Visual → Code
      const newXml = serializeBlocksToXML(state.blocks);
      setState(prev => ({
        ...prev,
        xmlContent: newXml,
        currentMode: newMode,
        syncStatus: 'synced'
      }));
    } else if (state.currentMode === 'code' && state.syncStatus === 'modified') {
      // Sync Code → Visual
      const newBlocks = parseXMLToBlocks(state.xmlContent);
      setState(prev => ({
        ...prev,
        blocks: newBlocks,
        currentMode: newMode,
        syncStatus: 'synced'
      }));
    } else {
      // No sync needed
      setState(prev => ({ ...prev, currentMode: newMode }));
    }
  };
  
  // Handle visual editor updates
  const handleBlockUpdate = (index: number, updatedBlock: Block) => {
    const newBlocks = [...state.blocks];
    newBlocks[index] = updatedBlock;
    setState(prev => ({
      ...prev,
      blocks: newBlocks,
      syncStatus: 'modified',
      lastEditedIn: 'visual'
    }));
  };
  
  const handleBlockDelete = (index: number) => {
    const newBlocks = state.blocks.filter((_, i) => i !== index);
    setState(prev => ({
      ...prev,
      blocks: newBlocks,
      syncStatus: 'modified',
      lastEditedIn: 'visual'
    }));
  };
  
  const handleBlockMoveUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...state.blocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    setState(prev => ({
      ...prev,
      blocks: newBlocks,
      syncStatus: 'modified',
      lastEditedIn: 'visual'
    }));
  };
  
  const handleBlockMoveDown = (index: number) => {
    if (index === state.blocks.length - 1) return;
    const newBlocks = [...state.blocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    setState(prev => ({
      ...prev,
      blocks: newBlocks,
      syncStatus: 'modified',
      lastEditedIn: 'visual'
    }));
  };
  
  const handleBlockInsert = (type: Block['type']) => {
    let newBlock: Block;
    
    switch(type) {
      case 'paragraph':
        newBlock = { type: 'paragraph', content: 'New paragraph. Click to edit.' };
        break;
      case 'note':
        newBlock = { type: 'note', noteType: 'note', content: 'Note content here.' };
        break;
      case 'ordered-list':
        newBlock = { type: 'ordered-list', items: ['First item', 'Second item'] };
        break;
      case 'unordered-list':
        newBlock = { type: 'unordered-list', items: ['First item', 'Second item'] };
        break;
      case 'codeblock':
        newBlock = { type: 'codeblock', content: '// Your code here' };
        break;
      default:
        newBlock = { type: 'paragraph', content: 'New content' };
    }
    
    setState(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
      syncStatus: 'modified',
      lastEditedIn: 'visual'
    }));
  };
  
  // Handle code editor updates
  const handleCodeChange = (newCode: string) => {
    setState(prev => ({
      ...prev,
      xmlContent: newCode,
      syncStatus: 'modified',
      lastEditedIn: 'code'
    }));
  };
  
  // File actions
  const handleFileAction = (action: 'cut' | 'copy' | 'paste' | 'clear') => {
    switch (action) {
      case 'cut':
      case 'copy':
        navigator.clipboard.writeText(state.xmlContent);
        if (action === 'cut') {
          setState(prev => ({
            ...prev,
            xmlContent: '',
            blocks: [],
            syncStatus: 'modified'
          }));
        }
        break;
      case 'paste':
        navigator.clipboard.readText().then(text => {
          setState(prev => ({
            ...prev,
            xmlContent: text,
            blocks: parseXMLToBlocks(text),
            syncStatus: 'modified'
          }));
        });
        break;
      case 'clear':
        setState(prev => ({
          ...prev,
          xmlContent: '',
          blocks: [],
          syncStatus: 'modified'
        }));
        break;
    }
  };
  
  // Quick actions (placeholder for now)
  const handleQuickAction = (action: 'find' | 'undo' | 'redo') => {
    console.log(`Quick action: ${action}`);
  };
  
  // AI Format Handler
  const handleFormat = async (formatType: 'concept' | 'reference' | 'task') => {
    setState(prev => ({ ...prev, isProcessing: true, validationStatus: `Formatting as ${formatType}...` }));
    
    try {
      const currentContent = state.currentMode === 'visual' 
        ? serializeBlocksToXML(state.blocks)
        : state.xmlContent;
      
      const prompt = `Reformat the following DITA content into a valid DITA ${formatType} topic.

Requirements:
1. Use the correct root element: <${formatType}> with a valid ID attribute
2. Include a <title> element
3. Use the correct body element (conbody for concept, refbody for reference, taskbody for task)
4. Maintain all original information but structure it according to ${formatType} standards
5. For tasks, use <steps> with <step> elements containing <cmd> tags
6. Respond ONLY with the complete, valid XML wrapped in \`\`\`xml code blocks

Current content:
${currentContent}`;

      const response = await callClaudeAPI(prompt);
      const extractedXML = extractXMLFromResponse(response);
      
      if (extractedXML) {
        const proposedBlocks = parseXMLToBlocks(extractedXML);
        setState(prev => ({
          ...prev,
          proposedXml: extractedXML,
          proposedBlocks,
          isProcessing: false,
          validationStatus: `Formatted as ${formatType}. Switch to Review mode to see changes.`,
          validatedTopicType: null
        }));
      } else {
        throw new Error('Could not extract valid XML from AI response');
      }
    } catch (error) {
      console.error('Format error:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        validationStatus: 'Format failed. Please try again.'
      }));
    }
  };
  
  // AI Validation Handler
  const handleValidate = async () => {
    setState(prev => ({ ...prev, isProcessing: true, validationStatus: 'Validating...' }));
    
    try {
      const currentContent = state.currentMode === 'visual'
        ? serializeBlocksToXML(state.blocks)
        : state.xmlContent;
      
      const prompt = `Validate the following DITA XML content and determine if it is a valid Concept, Reference, or Task topic.

Respond with a JSON object in this exact format:
{
  "isValid": true or false,
  "topicType": "concept" or "reference" or "task" or "unknown" or "error",
  "errorDescription": "description of errors if isValid is false, otherwise null",
  "suggestedFix": "corrected XML if isValid is false, otherwise null"
}

Content to validate:
${currentContent}`;

      const response = await callClaudeAPI(prompt, "You are a DITA XML validation expert. Respond only with valid JSON.");
      
      // Try to extract JSON from response
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response');
      }
      
      const validation: ValidationResult = JSON.parse(jsonMatch[0]);
      
      if (validation.isValid) {
        const topicType = validation.topicType.charAt(0).toUpperCase() + validation.topicType.slice(1);
        setState(prev => ({
          ...prev,
          isProcessing: false,
          validationStatus: `Valid ${topicType} topic`,
          validatedTopicType: topicType
        }));
      } else {
        setValidationError(validation);
        setShowValidationModal(true);
        setState(prev => ({
          ...prev,
          isProcessing: false,
          validationStatus: 'Validation failed',
          validatedTopicType: null
        }));
      }
    } catch (error) {
      console.error('Validation error:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        validationStatus: 'Validation failed. Please try again.',
        validatedTopicType: null
      }));
    }
  };
  
  // AI Preview Handler
  const handlePreview = async () => {
    setState(prev => ({ ...prev, isProcessing: true, validationStatus: 'Generating preview...' }));
    
    try {
      const currentContent = state.currentMode === 'visual'
        ? serializeBlocksToXML(state.blocks)
        : state.xmlContent;
      
      const prompt = `Convert the following DITA XML into clean, readable HTML for preview.

Requirements:
- Do NOT include DOCTYPE, <html>, <head>, or <body> tags
- Only output content elements (headings, paragraphs, lists, etc.)
- Use semantic HTML5 elements
- Make it visually clear and readable
- Respond ONLY with the HTML, no explanations

DITA content:
${currentContent}`;

      const htmlResponse = await callClaudeAPI(prompt);
      
      // Clean up any markdown code blocks if present
      let cleanHtml = htmlResponse.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      
      setPreviewHtml(cleanHtml);
      setShowPreviewModal(true);
      setState(prev => ({ ...prev, isProcessing: false, validationStatus: '' }));
    } catch (error) {
      console.error('Preview error:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        validationStatus: 'Preview generation failed.'
      }));
    }
  };
  
  // Apply validation fix
  const handleApplyFix = (fix: string) => {
    const proposedBlocks = parseXMLToBlocks(fix);
    setState(prev => ({
      ...prev,
      proposedXml: fix,
      proposedBlocks,
      validationStatus: 'Fix applied. Switch to Review mode to see changes.'
    }));
    setShowValidationModal(false);
    setValidationError(null);
  };
  
  // Review mode actions
  const handleAcceptChanges = () => {
    if (state.proposedXml && state.proposedBlocks) {
      setState(prev => ({
        ...prev,
        xmlContent: prev.proposedXml!,
        blocks: prev.proposedBlocks!,
        proposedXml: null,
        proposedBlocks: null,
        currentMode: 'visual',
        syncStatus: 'synced',
        lastEditedIn: 'ai',
        validationStatus: 'Changes accepted and applied.',
        validatedTopicType: null
      }));
    }
  };
  
  const handleRejectChanges = () => {
    setState(prev => ({
      ...prev,
      proposedXml: null,
      proposedBlocks: null,
      currentMode: 'visual',
      validationStatus: 'Changes rejected.',
      validatedTopicType: null
    }));
  };
  
  const handleModifyChanges = () => {
    // Switch to code mode with proposed XML for manual editing
    if (state.proposedXml) {
      setState(prev => ({
        ...prev,
        xmlContent: prev.proposedXml!,
        blocks: prev.proposedBlocks!,
        proposedXml: null,
        proposedBlocks: null,
        currentMode: 'code',
        syncStatus: 'modified',
        lastEditedIn: 'ai',
        validationStatus: 'Editing AI suggestions. Make changes and validate.'
      }));
    }
  };
  
  // Download
  const handleDownload = () => {
    const content = state.currentMode === 'visual' 
      ? serializeBlocksToXML(state.blocks)
      : state.xmlContent;
    
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.dita';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Unified DITA Editor</h1>
            <p className="text-sm text-gray-400">Phase 1: Foundation - Three-Mode Support</p>
          </div>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="flex-shrink-0">
        <Toolbar
          currentMode={state.currentMode}
          onModeChange={handleModeChange}
          syncStatus={state.syncStatus}
          onFileAction={handleFileAction}
          onQuickAction={handleQuickAction}
          onFormat={handleFormat}
          onValidate={handleValidate}
          onPreview={handlePreview}
          onDownload={handleDownload}
          isProcessing={state.isProcessing}
          validationStatus={state.validationStatus}
          validatedTopicType={state.validatedTopicType}
        />
      </div>
      
      {/* AI Action Panel */}
      <div className="flex-shrink-0 bg-gray-750 border-b border-gray-700 px-4 py-2" style={{backgroundColor: '#374151'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-cyan-400">AI Tools:</span>
            {state.proposedXml && (
              <span className="text-xs text-yellow-400 animate-pulse">● Changes pending review</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!state.proposedXml ? (
              <>
                <button onClick={() => handleFormat('concept')} disabled={state.isProcessing} className="px-3 py-1 text-xs text-white bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50">
                  Format as Concept
                </button>
                <button onClick={() => handleFormat('reference')} disabled={state.isProcessing} className="px-3 py-1 text-xs text-white bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50">
                  Format as Reference
                </button>
                <button onClick={() => handleFormat('task')} disabled={state.isProcessing} className="px-3 py-1 text-xs text-white bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50">
                  Format as Task
                </button>
                <div className="w-px h-4 bg-gray-600" />
                <button onClick={handleValidate} disabled={state.isProcessing} className={`px-3 py-1 text-xs text-white rounded ${state.validatedTopicType ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'} disabled:opacity-50`}>
                  {state.validatedTopicType ? `✓ ${state.validatedTopicType}` : 'Validate DITA'}
                </button>
                <button onClick={handlePreview} disabled={state.isProcessing} className="px-3 py-1 text-xs text-white bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50">
                  Preview HTML
                </button>
              </>
            ) : (
              <>
                <button onClick={handleAcceptChanges} className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded font-bold">
                  ✓ Accept
                </button>
                <button onClick={handleRejectChanges} className="px-3 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded font-bold">
                  ✗ Reject
                </button>
                <button onClick={handleModifyChanges} className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded">
                  Edit & Modify
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Editor Area - TAKES REMAINING SPACE */}
      <div className="flex-1 overflow-hidden" style={{minHeight: 0}}>
        {state.currentMode === 'visual' && (
          <div className="bg-gray-800 p-8 shadow-xl h-full overflow-y-auto">
            <div className="prose prose-invert max-w-none pl-16">
              {state.blocks.map((block, index) => (
                <BlockEditor
                  key={index}
                  block={block}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === state.blocks.length - 1}
                  onUpdate={handleBlockUpdate}
                  onDelete={handleBlockDelete}
                  onMoveUp={handleBlockMoveUp}
                  onMoveDown={handleBlockMoveDown}
                />
              ))}
              
              {state.blocks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No content yet. Click the button below to add blocks.</p>
                </div>
              )}
              
              {/* Add Block Button */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <button
                  onClick={() => setShowInsertMenu(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
                >
                  <span className="text-xl">+</span>
                  <span>Add Block</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {state.currentMode === 'code' && (
          <div className="h-full w-full">
            <CodeEditor
              value={state.xmlContent}
              onChange={handleCodeChange}
            />
          </div>
        )}
          
        {state.currentMode === 'review' && (
          <div className="h-full w-full">
            {state.proposedXml && state.proposedBlocks ? (
              <ReviewMode
                originalXml={state.xmlContent}
                proposedXml={state.proposedXml}
                originalBlocks={state.blocks}
                proposedBlocks={state.proposedBlocks}
                viewMode={reviewViewMode}
                onViewModeChange={setReviewViewMode}
                onAccept={handleAcceptChanges}
                onReject={handleRejectChanges}
                onModify={handleModifyChanges}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <GitCompare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-gray-400 mb-2">Review Mode</h2>
                  <p className="text-gray-500">No changes to review</p>
                  <p className="text-gray-400 text-sm mt-2">Use AI Tools to generate changes, then switch to Review mode</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="flex-shrink-0 bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>Mode: <span className="font-bold text-blue-400">{state.currentMode.charAt(0).toUpperCase() + state.currentMode.slice(1)}</span></span>
            <span>Blocks: <span className="font-bold">{state.blocks.length}</span></span>
            <span>Last Edited: <span className="font-bold">{state.lastEditedIn.charAt(0).toUpperCase() + state.lastEditedIn.slice(1)}</span></span>
            {state.validationStatus && (
              <span className="text-cyan-400">{state.validationStatus}</span>
            )}
            {state.proposedXml && (
              <span className="text-yellow-400 font-bold">⚠ Pending Changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Phase 4: Enhancements Complete ✓</span>
            {state.currentMode === 'visual' && (
              <button
                onClick={() => setShowInsertMenu(true)}
                className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                title="Add Block"
              >
                + Add
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {showInsertMenu && (
        <BlockInsertMenu
          onInsert={handleBlockInsert}
          onClose={() => setShowInsertMenu(false)}
        />
      )}
      
      {showValidationModal && validationError && (
        <ValidationErrorModal
          error={validationError}
          onClose={() => {
            setShowValidationModal(false);
            setValidationError(null);
          }}
          onApplyFix={handleApplyFix}
        />
      )}
      
      {showPreviewModal && (
        <PreviewModal
          htmlContent={previewHtml}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewHtml('');
          }}
        />
      )}
    </div>
  );
}