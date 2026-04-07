import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Header from './components/Header';
import Editor from './components/Editor';
import AIAssistant from './components/AIAssistant';
import Toolbar from './components/Toolbar';
import ValidationErrorModal from './components/ValidationErrorModal';
import PreviewModal from './components/PreviewModal';
import SaveModal from './components/SaveModal';
import DownloadWarningModal from './components/DownloadWarningModal';
import './types'; // Ensures window.monaco is typed

type ValidationResult = {
  isValid: boolean;
  topicType: 'concept' | 'reference' | 'task' | 'unknown' | 'error';
  errorDescription?: string;
  suggestedFix?: string;
}

const App: React.FC = () => {
  const initialXmlContent = `<!-- Welcome to the DITA Editor! -->
<topic id="hello_world">
  <title>Hello, World!</title>
  <body>
    <p>This is a sample DITA topic. Use the toolbar above to format, validate, and preview your content.</p>
    <p>Try using Format -> Format as Concept to see the AI in action.</p>
    <note>You can also use the AI Assistant in the bottom right for more conversational help.</note>
  </body>
</topic>
`;

  const [xmlContent, setXmlContent] = useState<string>(initialXmlContent);
  const [proposedXml, setProposedXml] = useState<string | null>(null);
  
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [isManualEditing, setIsManualEditing] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const editorRef = useRef<any>(null);

  // State for toolbar features
  const [validationStatus, setValidationStatus] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validatedTopicType, setValidatedTopicType] = useState<string | null>(null);
  
  const [showValidationErrorModal, setShowValidationErrorModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // State for Downloading
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveFileType, setSaveFileType] = useState<'dita' | 'xml' | 'txt'>('dita');
  const [showDownloadWarningModal, setShowDownloadWarningModal] = useState<boolean>(false);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleContentChange = (newContent: string) => {
    setXmlContent(newContent);
    // Reset validation state when content changes
    if (validatedTopicType) {
        setValidatedTopicType(null);
        setValidationStatus('');
    }
  };

  const handleFileAction = (action: 'cut' | 'copy' | 'paste' | 'paste-overwrite' | 'clear') => {
    if (!editorRef.current || isReviewing) return;
    const editor = editorRef.current;
    
    editor.focus();
    
    switch (action) {
      case 'cut': {
        const model = editor.getModel();
        if (model) {
            const fullRange = model.getFullModelRange();
            editor.setSelection(fullRange);
            editor.trigger('toolbar', 'editor.action.clipboardCutAction', null);
        }
        break;
      }
      case 'copy': {
        const model = editor.getModel();
        if (model) {
            const originalSelection = editor.getSelection();
            const fullRange = model.getFullModelRange();
            editor.setSelection(fullRange);
            editor.trigger('toolbar', 'editor.action.clipboardCopyAction', null);
            if (originalSelection) {
                setTimeout(() => editor.setSelection(originalSelection), 100);
            }
        }
        break;
      }
      case 'paste':
        editor.trigger('toolbar', 'editor.action.clipboardPasteAction', null);
        break;
      case 'paste-overwrite': {
        const model = editor.getModel();
        if (model) {
            const fullRange = model.getFullModelRange();
            editor.setSelection(fullRange);
            editor.trigger('toolbar', 'editor.action.clipboardPasteAction', null);
        }
        break;
      }
      case 'clear':
        const model = editor.getModel();
        if (model) {
          editor.executeEdits('toolbar', [{
            range: model.getFullModelRange(),
            text: ''
          }]);
        } else {
            handleContentChange('');
        }
        break;
    }
  };


  const handleQuickAction = (action: 'find' | 'undo' | 'redo') => {
    if (!editorRef.current || isReviewing) return;
    
    const editor = editorRef.current;
    // Explicitly focus the editor to ensure actions occur in the correct context
    editor.focus();

    switch (action) {
      case 'find':
        // Trigger the built-in Monaco Find widget
        editor.trigger('toolbar', 'actions.find', null);
        break;
      case 'undo':
        editor.trigger('toolbar', 'undo', null);
        break;
      case 'redo':
        editor.trigger('toolbar', 'redo', null);
        break;
    }
  };

  const handleDownloadRequest = (fileType: 'dita' | 'xml' | 'txt') => {
    setSaveFileType(fileType);
    if (fileType === 'dita' && !validatedTopicType) {
        setShowDownloadWarningModal(true);
    } else {
        setShowSaveModal(true);
    }
  };

  const executeDownload = (filename: string) => {
    const blob = new Blob([xmlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Ensure correct extension
    const extension = `.${saveFileType}`;
    const finalFilename = filename.endsWith(extension) ? filename : `${filename}${extension}`;
    
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const performDownload = (filename: string) => {
    // We can directly download here because the warning (if needed) has already been handled
    executeDownload(filename);
  };

  const handleWarningContinue = () => {
    setShowDownloadWarningModal(false);
    setShowSaveModal(true);
  };

  const handleWarningCancel = () => {
    setShowDownloadWarningModal(false);
  };
  
  const runGemini = async (prompt: string, responseSchema?: any) => {
    setIsProcessing(true);
    setValidationStatus('');
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        console.error("API Key not found in process.env.API_KEY");
        setValidationStatus('API Configuration Error');
        return null;
      }

      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: responseSchema ? 'application/json' : undefined,
          responseSchema: responseSchema,
        }
      });
      return response.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      setValidationStatus('Error communicating with AI.');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  const handleFormat = async (formatType: 'Concept' | 'Reference' | 'Task') => {
    const prompt = `Reformat the following content into a valid DITA ${formatType} topic. 
    1. Ensure it has a proper <${formatType.toLowerCase()}> root element.
    2. Include a valid ID attribute.
    3. Include a <title> element.
    4. Use the correct body element (e.g., <conbody>, <refbody>, <taskbody>).
    5. Maintain all original information but structure it correctly.
    6. Respond ONLY with the complete, updated XML code block, wrapped in \`\`\`xml ... \`\`\`.
    
    Content to format:
    \n\n${xmlContent}`;
    
    const result = await runGemini(prompt);
    if (result) {
        const codeBlockRegex = /```xml\n([\s\S]*?)\n```/;
        const match = result.match(codeBlockRegex);
        // If regex fails, fallback to result if it looks like XML, otherwise don't apply
        let finalCode = match ? match[1] : null;
        if (!finalCode && result.trim().startsWith('<')) {
            finalCode = result;
        }

        if (finalCode) {
            setProposedXml(finalCode);
            setIsReviewing(true);
            setIsManualEditing(false);
            setValidationStatus(`Suggested format as ${formatType}`);
        } else {
            setValidationStatus('Could not extract valid XML from AI response.');
        }
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationStatus('Validating...');
    
    const prompt = `Validate the following DITA XML content. 
    Determine if it is a valid Concept, Reference, or Task topic. 
    Respond ONLY with a JSON object.
    
    Content:
    \n\n${xmlContent}`;

    // Defined locally to avoid import issues with Schema/Type
    const schema = {
        type: Type.OBJECT,
        properties: {
            isValid: { type: Type.BOOLEAN },
            topicType: { 
                type: Type.STRING, 
                enum: ['concept', 'reference', 'task', 'unknown', 'error'] 
            },
            errorDescription: { type: Type.STRING, nullable: true },
            suggestedFix: { type: Type.STRING, nullable: true },
        },
        required: ['isValid', 'topicType']
    };

    const result = await runGemini(prompt, schema);
    
    if (result) {
      try {
        const validation = JSON.parse(result) as ValidationResult;
        
        if (validation.isValid) {
          // Capitalize first letter for display safely
          const topicTypeStr = validation.topicType || 'Unknown';
          const type = topicTypeStr.charAt(0).toUpperCase() + topicTypeStr.slice(1);
          setValidationStatus(`Valid ${type} topic.`);
          setValidatedTopicType(type);
        } else {
          setValidationStatus('Issues found.');
          setValidationError(validation);
          setShowValidationErrorModal(true);
          setValidatedTopicType(null);
        }
      } catch (e) {
        console.error("Failed to parse validation JSON:", e);
        setValidationStatus("Validation failed (Parse Error).");
        setValidatedTopicType(null);
      }
    } else {
        setValidationStatus("Validation failed (Network).");
    }
    setIsValidating(false);
  };
  
  const handleApplyFix = (fix: string) => {
    setProposedXml(fix);
    setIsReviewing(true);
    setIsManualEditing(false);
    setShowValidationErrorModal(false);
    setValidationError(null);
    setValidationStatus('Reviewing suggested fix...');
  };
  
  const handlePreview = async () => {
    const prompt = `Convert the following DITA XML into simple, clean, and readable HTML suitable for a preview. 
    - Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags.
    - Only output the content elements (headings, paragraphs, lists, tables).
    - Use tailwind-friendly structure if possible, but standard semantic HTML is preferred.
    - Respond ONLY with the raw HTML string.
    
    Content:
    \n\n${xmlContent}`;
    
    const result = await runGemini(prompt);
    if(result) {
        // Strip out any potential markdown code blocks if the model adds them
        let cleanHtml = result.replace(/```html/g, '').replace(/```/g, '');
        setPreviewHtml(cleanHtml);
        setShowPreviewModal(true);
    }
  };

  const handleAcceptChanges = () => {
    if (proposedXml) {
      handleContentChange(proposedXml);
    }
    setProposedXml(null);
    setIsReviewing(false);
    setIsManualEditing(false);
    setValidationStatus('Changes accepted.');
  };

  const handleRejectChanges = () => {
    setProposedXml(null);
    setIsReviewing(false);
    setIsManualEditing(false);
    setValidationStatus('Changes rejected.');
  };

  const handleModifyChanges = () => {
    setProposedXml(null);
    setIsReviewing(false);
    setIsManualEditing(false);
    setValidationStatus('Modifying request...');
  };

  const handleManualModify = () => {
    setIsManualEditing(true);
    setValidationStatus('Editing enabled for proposed changes.');
  };

  const handleAISuggestion = (newCode: string) => {
    setProposedXml(newCode);
    setIsReviewing(true);
    setIsManualEditing(false);
  };
  
  const handleProposedChange = (newCode: string) => {
      setProposedXml(newCode);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-800 font-sans">
      <Header />
      <Toolbar 
        onFileAction={handleFileAction}
        onFormat={handleFormat}
        onQuickAction={handleQuickAction}
        onDownload={handleDownloadRequest}
        onValidate={handleValidate}
        onPreview={handlePreview}
        
        onAccept={handleAcceptChanges}
        onReject={handleRejectChanges}
        onManualModify={handleManualModify}
        isReviewing={isReviewing}
        isManualEditing={isManualEditing}

        validationStatus={validationStatus}
        isValidating={isValidating}
        validatedTopicType={validatedTopicType}
        isProcessing={isProcessing}
        disabled={isReviewing}
      />
      <main className="flex-grow flex relative overflow-hidden">
        <div className="flex-grow h-full relative">
          <Editor 
            value={xmlContent} 
            proposedValue={proposedXml || undefined}
            isReviewMode={isReviewing}
            isDiffReadOnly={!isManualEditing}
            onChange={handleContentChange}
            onProposedChange={handleProposedChange}
            onMount={handleEditorDidMount}
          />
        </div>
        <AIAssistant 
          isOpen={isAssistantOpen} 
          onToggle={() => setIsAssistantOpen(!isAssistantOpen)}
          editorContent={xmlContent}
          onEditorContentChange={handleAISuggestion}
          isReviewing={isReviewing}
          onAccept={handleAcceptChanges}
          onReject={handleRejectChanges}
          onModify={handleModifyChanges}
        />
      </main>
      
      {showValidationErrorModal && validationError && (
        <ValidationErrorModal
          error={validationError}
          onClose={() => setShowValidationErrorModal(false)}
          onApplyFix={handleApplyFix}
        />
      )}
      
      {showPreviewModal && (
        <PreviewModal
            htmlContent={previewHtml}
            onClose={() => setShowPreviewModal(false)}
        />
      )}

      {showSaveModal && (
        <SaveModal 
            isOpen={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            onSave={performDownload}
            fileType={saveFileType}
        />
      )}
      
      {showDownloadWarningModal && (
        <DownloadWarningModal
            onCancel={handleWarningCancel}
            onContinue={handleWarningContinue}
        />
      )}
    </div>
  );
};

export default App;