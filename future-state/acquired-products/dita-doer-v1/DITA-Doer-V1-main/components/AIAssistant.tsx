
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface AIAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
  editorContent: string;
  onEditorContentChange: (newContent: string) => void;
  isReviewing: boolean;
  onAccept: () => void;
  onReject: () => void;
  onModify: () => void;
}

type Message = {
  sender: 'user' | 'ai';
  text: string;
  code?: string;
};

const initialMessages: Message[] = [
  { sender: 'ai', text: 'Hello! How can I help you with your DITA file today?' }
];

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
    </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const AIAssistant: React.FC<AIAssistantProps> = ({ 
  isOpen, 
  onToggle, 
  editorContent, 
  onEditorContentChange,
  isReviewing,
  onAccept,
  onReject,
  onModify
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleClearChat = () => {
    setMessages(initialMessages);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading || isReviewing) return;

    const newMessages: Message[] = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    const sentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const systemInstruction = `You are an expert assistant for DITA XML. When responding:
1. Provide a brief conversational overview.
2. If suggesting changes, use a bulleted list to explicitly state modifications (e.g., "- Updated the root element to <concept>").
3. Ensure descriptions are unique and NOT repeated. Be concise.
4. At the end of EACH bullet point, estimate the character difference in exactly this format: (+added, -removed). Example: "Updated title (+10, -2)".
5. Use markdown for emphasis (e.g., **Changes made:**).
6. Include the full, updated XML code ONLY at the very end inside a markdown code block tagged with 'xml'.
7. Do NOT include any other code snippets in your response.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `User prompt: "${sentInput}"\n\nCurrent DITA content:\n\`\`\`xml\n${editorContent}\n\`\`\`\n`,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      
      const aiText = response.text;
      const codeBlockRegex = /```xml\n([\s\S]*?)\n```/;
      const codeMatch = aiText.match(codeBlockRegex);
      
      const cleanAiText = aiText.replace(codeBlockRegex, '').trim();
      const aiMessage: Message = { sender: 'ai', text: cleanAiText || "I've suggested some improvements." };
      
      if (codeMatch && codeMatch[1]) {
        aiMessage.code = codeMatch[1];
        onEditorContentChange(codeMatch[1]);
      }
      
      setMessages([...newMessages, aiMessage]);

    } catch (error) {
      console.error("Error calling Gemini API:", error);
      setMessages([...newMessages, { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleModify = () => {
    const lastUserMsgIndex = [...messages].reverse().findIndex(m => m.sender === 'user');
    if (lastUserMsgIndex !== -1) {
      const actualIndex = messages.length - 1 - lastUserMsgIndex;
      const lastUserText = messages[actualIndex].text;
      const newMessages = messages.slice(0, actualIndex);
      setMessages(newMessages);
      setUserInput(lastUserText);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    onModify();
  };

  // Basic markdown-like renderer for the chat bubbles
  const renderTextWithFormatting = (text: string) => {
    return text.split('\n').map((line, i) => {
      let content = line.trim();
      // Detect list items (starting with - or *)
      const isListItem = content.startsWith('- ') || content.startsWith('* ');

      if (isListItem) {
        // Remove the leading marker and any redundant dashes/spaces
        content = content.replace(/^[\-\*]+\s+/, '');
      }

      // Handle bold formatting: **text**
      const parts = content.split(/(\*\*.*?\*\*)/g);
      
      const formattedLine = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={`bold-${index}`} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        
        // Parse Diff Counters: (+N, -M)
        const diffSplit = part.split(/(\(\+\d+,\s*-\d+\))/g);
        return diffSplit.map((subPart, subIndex) => {
            const diffMatch = subPart.match(/\(\+(\d+),\s*-(\d+)\)/);
            if (diffMatch) {
                const [_, added, removed] = diffMatch;
                return (
                    <span key={`diff-${index}-${subIndex}`} className="ml-1.5 font-mono text-xs inline-flex items-center space-x-0.5 opacity-90">
                        <span className="text-green-400">+{added}</span>
                        <span className="text-gray-400">,</span>
                        <span className="text-red-400">-{removed}</span>
                    </span>
                );
            }
            return subPart;
        });
      });

      if (isListItem) {
        return (
          <li key={i} className="ml-5 list-disc mb-1 text-gray-200 pl-1">
            {formattedLine}
          </li>
        );
      }
      
      return (
        <p key={i} className={i > 0 ? 'mt-3' : ''}>
          {formattedLine}
        </p>
      );
    });
  };

  const renderActionButtons = (index: number) => {
    const isLatestAiMessage = index === messages.length - 1 && messages[index].sender === 'ai';
    if (!isLatestAiMessage || !messages[index].code || !isReviewing) return null;

    return (
      <div className="mt-5 flex flex-col space-y-2 border-t border-gray-600/50 pt-4">
        <div className="flex space-x-2">
          <button 
            onClick={onAccept}
            className="flex-grow px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-bold shadow-lg"
          >
            Accept Changes
          </button>
          <button 
            onClick={onReject}
            className="flex-grow px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-bold shadow-lg"
          >
            Reject
          </button>
        </div>
        <button 
          onClick={handleModify}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-all text-sm font-bold shadow-md border border-gray-500"
        >
          Modify Request
        </button>
      </div>
    );
  };

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-full md:w-2/5 lg:w-1/3 z-20 transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <button
        onClick={onToggle}
        className="absolute bottom-8 left-0 -translate-x-full w-10 h-24 bg-gradient-to-b from-cyan-600 to-cyan-900 hover:from-cyan-500 hover:to-cyan-800 rounded-l-3xl flex flex-col items-center justify-center text-white shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-all duration-300 group"
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      >
        {isOpen ? (
          <ChevronRightIcon className="w-7 h-7" />
        ) : (
          <>
            <span className="font-black text-xs mb-1 group-hover:scale-110 transition-transform">AI</span>
            <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>
          </>
        )}
      </button>

      <div className={`h-full w-full bg-gray-900 shadow-2xl flex flex-col border-l border-gray-700`}>
        <header className="p-5 border-b border-gray-700 flex items-center justify-between flex-shrink-0 bg-gray-900/90 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white tracking-tight">VibeEtto AI</h2>
            {isReviewing && (
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Reviewing Proposal</span>
              </div>
            )}
          </div>
          <button 
            onClick={handleClearChat}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all duration-200"
            title="Clear Chat"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-grow p-5 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-gray-700">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl max-w-[92%] shadow-xl transition-all ${
                msg.sender === 'user' 
                  ? 'bg-cyan-700 text-white rounded-tr-none border border-cyan-600/50' 
                  : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700'
              }`}>
                <div className="text-sm leading-relaxed">
                  {renderTextWithFormatting(msg.text)}
                </div>
                {renderActionButtons(index)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="p-4 rounded-2xl rounded-tl-none bg-gray-800 border border-gray-700">
                <div className="flex items-center space-x-2 px-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-5 border-t border-gray-700 flex-shrink-0 bg-gray-900/95 backdrop-blur-md">
          <div className="flex items-end space-x-3 bg-gray-800 p-2 rounded-2xl border border-gray-700 focus-within:border-cyan-500/50 transition-colors">
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isReviewing ? "Complete review..." : "Ask VibeEtto to edit..."}
              className={`flex-grow bg-transparent text-white p-2 rounded-xl focus:outline-none resize-none transition-opacity scrollbar-none ${isReviewing ? 'opacity-40 cursor-not-allowed' : ''}`}
              rows={2}
              disabled={isLoading || isReviewing}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !userInput.trim() || isReviewing}
              className="bg-cyan-600 text-white p-3 rounded-xl disabled:bg-gray-700 hover:bg-cyan-500 hover:scale-105 active:scale-95 focus:outline-none transition-all shadow-lg flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          {isReviewing && (
            <p className="mt-3 text-[10px] text-cyan-400 text-center font-bold tracking-widest uppercase opacity-80">
              Review session active
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
