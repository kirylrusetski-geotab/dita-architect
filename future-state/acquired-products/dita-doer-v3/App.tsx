import React, { useState, useRef } from 'react';
import { Editor, EditorHandle } from './components/Editor';
import { ChatSidebar } from './components/ChatSidebar';
import { BookOpen, HelpCircle } from 'lucide-react';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const editorRef = useRef<EditorHandle>(null);

  const getEditorContext = () => {
    return editorRef.current?.getContent() || '';
  };

  const handleProposeChanges = (xml: string) => {
    editorRef.current?.proposeChanges(xml);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">
      {/* App Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
             <BookOpen className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
            DITA Doer
          </h1>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-100">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <div className="hidden md:flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Gemini 3 Flash Connected
          </div>
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="flex-grow flex flex-col md:flex-row overflow-hidden relative">
        {/* Left: Editor Area */}
        <div className={`flex-grow h-full p-4 md:p-6 overflow-hidden flex flex-col transition-all duration-300 ${isSidebarOpen ? 'md:mr-0' : 'md:mr-0'}`}>
          <div className="flex-grow h-full shadow-lg rounded-lg overflow-hidden">
             <Editor 
                ref={editorRef}
                initialContent="<h1>Welcome to the DITA Migration Tool</h1><p>Type your content here, or paste unstructured notes. When you are ready, click the <strong>Migrate to DITA</strong> button in the toolbar to automatically convert this text into a valid DITA XML topic using Gemini AI.</p><h2>Getting Started</h2><p>To create a new project, go to <b>File</b> &gt; <i>New Project</i>. Click the <span style='font-family: monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px;'>Save</span> button when finished.</p><p>For detailed specifications, visit the <a href='https://www.oxygenxml.com/dita/1.3/specs/'>DITA 1.3 Specification</a>.</p>" 
             />
          </div>
        </div>

        {/* Right: AI Sidebar */}
        {/* The sidebar component handles its own width transition, but we keep it in the flex container */}
        <div className={`h-full z-10 flex-shrink-0 shadow-2xl transition-all duration-300`}>
          <ChatSidebar 
            isOpen={isSidebarOpen} 
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            getEditorContext={getEditorContext}
            onProposeChanges={handleProposeChanges}
          />
        </div>
      </main>
    </div>
  );
};

export default App;