import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { chatWithDitaBot } from '../services/geminiService';
import { calculateFleschReadingEase } from '../utils/textAnalysis';
import { parseDitaXml, extractTextFromBlocks } from '../utils/ditaUtils';
import { Message } from '../types';
import { Spinner } from './Spinner';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  getEditorContext?: () => string;
  onProposeChanges?: (xml: string) => void;
}

// Simple Markdown Parser Component
const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split by newlines to handle paragraphs and lists
  const lines = text.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIndex} className="h-1" />;

        // Handle Bullet Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
           const content = trimmed.substring(2);
           return (
             <div key={lineIndex} className="flex gap-2 ml-1">
               <span className="text-current opacity-70">•</span>
               <span>{parseInline(content)}</span>
             </div>
           );
        }
        
        // Handle Numbered Lists
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
            return (
                <div key={lineIndex} className="flex gap-2 ml-1">
                    <span className="font-mono text-xs pt-1 opacity-70">{numMatch[1]}.</span>
                    <span>{parseInline(numMatch[2])}</span>
                </div>
            );
        }

        return <p key={lineIndex} className="leading-relaxed">{parseInline(line)}</p>;
      })}
    </div>
  );
};

// Helper to parse inline styles: **bold**, `code`
const parseInline = (text: string): React.ReactNode[] => {
  // Regex to match **bold** OR `code`
  // Capturing groups allow us to split the string and keep the delimiters to identify parts
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="bg-slate-200/50 border border-slate-300/50 px-1 py-0.5 rounded text-xs font-mono text-pink-600">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onToggle, getEditorContext, onProposeChanges }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am **DITA-Bot**. I can help you migrate content, validate XML, or answer questions. If you want me to edit your content, just ask!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleClearHistory = () => {
    setMessages([{ role: 'model', text: 'History cleared. How can I help you with your DITA content?' }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const currentContent = getEditorContext ? getEditorContext() : undefined;
      
      // Calculate readability metrics to pass to the bot, ensuring consistency
      let readabilityData = undefined;
      if (currentContent) {
        // To ensure the score is identical to the editor's, we use the same parsing logic
        const blocks = parseDitaXml(currentContent);
        const textToAnalyze = extractTextFromBlocks(blocks);
        const analysis = calculateFleschReadingEase(textToAnalyze);
        readabilityData = { score: analysis.score, label: analysis.label };
      }

      const responseText = await chatWithDitaBot(messages, input, currentContent, readabilityData);
      
      // Detect if the model generated XML code block which might be a proposed edit
      const xmlMatch = responseText.match(/```xml([\s\S]*?)```/);
      let displayText = responseText;
      let hasProposedChanges = false;

      if (xmlMatch && xmlMatch[1]) {
        // If XML found, assume it's an edit proposal
        if (onProposeChanges && currentContent && currentContent.length > 0) {
           const proposedXml = xmlMatch[1].trim();
           onProposeChanges(proposedXml);
           hasProposedChanges = true;
        }
        
        // Strip the XML from the display text to keep it conversational
        displayText = responseText.replace(/```xml[\s\S]*?```/, '').trim();
        
        // Cleanup trailing backticks if any remained (sometimes match doesn't catch all edge cases)
        displayText = displayText.replace(/```$/, '').trim();

        if (!displayText) {
            displayText = "I've updated the content based on your request.";
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: displayText }]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`relative h-full transition-all duration-300 ease-in-out ${isOpen ? 'w-full md:w-[350px]' : 'w-0'}`}>
      
      {/* Toggle Tab (Bottom Left) */}
      <button 
        onClick={onToggle}
        className={`absolute -left-10 bottom-24 w-10 h-24 bg-white border border-r-0 border-slate-300 rounded-l-lg shadow-md flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 z-50 transition-all ${!isOpen ? 'border-r' : ''}`}
        title={isOpen ? "Collapse Sidebar" : "Open Assistant"}
      >
        {isOpen ? <ChevronRight size={20} /> : <span className="font-bold text-lg">AI</span>}
      </button>

      <div className={`flex flex-col h-full bg-white border-l border-slate-200 shadow-xl overflow-hidden ${isOpen ? 'opacity-100' : 'opacity-0 invisible'}`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 font-semibold">
            <Bot size={20} />
            <span className="whitespace-nowrap">DITA AI Assistant</span>
          </div>
          <button 
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Clear History"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-600'}
              `}>
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>
              
              <div className={`
                max-w-[85%] p-3 rounded-2xl text-sm
                ${msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'}
                ${msg.isError ? 'border-red-300 bg-red-50 text-red-600' : ''}
              `}>
                <MarkdownText text={msg.text} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                <Spinner size="sm" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask DITA-Bot to edit..."
              className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none outline-none text-sm min-h-[50px] max-h-[120px]"
              rows={1}
              style={{ minHeight: '50px' }}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2.5 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};