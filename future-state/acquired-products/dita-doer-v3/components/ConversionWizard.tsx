import React, { useState, useEffect } from 'react';
import { 
  BookOpen, ListChecks, FileText, Check, ArrowRight, ArrowLeft, 
  Sparkles, X, BrainCircuit, Activity
} from 'lucide-react';
import { Spinner } from './Spinner';
import { extractDitaMetadata } from '../services/geminiService';
import { calculateFleschReadingEase } from '../utils/textAnalysis';

interface ConversionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ConversionOptions) => void;
  initialText: string;
}

export interface ConversionOptions {
  topicType: 'concept' | 'task' | 'reference';
  title: string;
  shortDesc: string;
  additionalInstructions: string;
}

const STEPS = [
  { id: 1, title: 'Choose Topic Type', icon: BookOpen },
  { id: 2, title: 'AI Instructions', icon: BrainCircuit },
  { id: 3, title: 'Validate & Review', icon: ListChecks },
];

export const ConversionWizard: React.FC<ConversionWizardProps> = ({ 
  isOpen, onClose, onConfirm, initialText 
}) => {
  const [step, setStep] = useState(1);
  const [topicType, setTopicType] = useState<'concept' | 'task' | 'reference' | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [autoShortDesc, setAutoShortDesc] = useState(true);
  
  // Step 3 Data
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [fleschData, setFleschData] = useState({ score: 0, label: '', color: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTopicType(null);
      setAdditionalInstructions('');
      setAutoShortDesc(true);
      setTitle('');
      setShortDesc('');
    }
  }, [isOpen]);

  // Run analysis when entering Step 3
  useEffect(() => {
    if (step === 3 && isOpen) {
      const runAnalysis = async () => {
        setIsAnalyzing(true);
        // 1. Calculate Flesch Score locally
        const fScore = calculateFleschReadingEase(initialText);
        setFleschData(fScore);

        // 2. AI Metadata Extraction
        const metadata = await extractDitaMetadata(initialText);
        setTitle(metadata.title);
        if (autoShortDesc && metadata.shortDesc) {
          setShortDesc(metadata.shortDesc);
        }
        setIsAnalyzing(false);
      };
      runAnalysis();
    }
  }, [step, isOpen, initialText, autoShortDesc]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1 && !topicType) return;
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleFinish = () => {
    if (!topicType) return;
    onConfirm({
      topicType,
      title,
      shortDesc,
      additionalInstructions
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Convert to DITA</h2>
            <p className="text-sm text-slate-500">Transform your content in 3 simple steps</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-8 pt-6 pb-2">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded-full transition-all duration-300`} style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
            
            {STEPS.map((s) => {
              const isActive = step >= s.id;
              const isCurrent = step === s.id;
              return (
                <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                    ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-400'}
                  `}>
                    <s.icon size={18} />
                  </div>
                  <span className={`text-xs font-medium ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}>{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 overflow-y-auto flex-grow">
          
          {/* STEP 1: Topic Type */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-700 mb-4">Select the best DITA topic type:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={() => setTopicType('concept')}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${topicType === 'concept' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-3">
                    <BookOpen size={20} />
                  </div>
                  <h4 className="font-bold text-slate-800">Concept</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Explanatory content. "What is X?" or "How does Y work?". Background information and definitions.
                  </p>
                </button>

                <button 
                  onClick={() => setTopicType('task')}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${topicType === 'task' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-3">
                    <ListChecks size={20} />
                  </div>
                  <h4 className="font-bold text-slate-800">Task</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Step-by-step instructions. "How to do X". Numbered steps, prerequisites, and results.
                  </p>
                </button>

                <button 
                  onClick={() => setTopicType('reference')}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${topicType === 'reference' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3">
                    <FileText size={20} />
                  </div>
                  <h4 className="font-bold text-slate-800">Reference</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Facts and data. Tables, API specs, commands, or settings lists. Lookup information.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Instructions */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="text-indigo-600 shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-indigo-900 text-sm">AI Assistance</h4>
                  <p className="text-xs text-indigo-700 mt-1">Configure how Gemini handles your content conversion.</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={autoShortDesc} 
                    onChange={(e) => setAutoShortDesc(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                  />
                  <div>
                    <span className="block font-medium text-slate-700">Auto-generate Short Description</span>
                    <span className="text-xs text-slate-500">Gemini will write a concise summary for the &lt;shortdesc&gt; tag.</span>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Additional Instructions (Optional)</label>
                  <textarea 
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="e.g., 'Make the tone more formal', 'Ensure all lists are unordered', 'Highlight warnings about voltage'."
                    className="w-full h-32 p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              {isAnalyzing ? (
                 <div className="flex flex-col items-center justify-center py-12 space-y-4 text-slate-500">
                    <Spinner size="lg" color="border-blue-500" />
                    <p className="animate-pulse">Analyzing content structure & readability...</p>
                 </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-1">DITA Title</label>
                      <input 
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                       <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Analysis Score</label>
                       <div className={`p-2 rounded-lg border border-transparent flex items-center justify-between ${fleschData.color}`}>
                          <div className="flex items-center gap-2">
                             <Activity size={16} />
                             <span className="font-semibold text-sm">Flesch Reading Ease</span>
                          </div>
                          <span className="font-bold text-lg">{fleschData.score} <span className="text-xs font-normal opacity-75">({fleschData.label})</span></span>
                       </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Short Description</label>
                    <textarea 
                      value={shortDesc}
                      onChange={(e) => setShortDesc(e.target.value)}
                      className="w-full h-24 p-3 text-sm border border-slate-300 rounded-lg focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <h5 className="font-bold mb-3 uppercase tracking-wide text-slate-500">Proposed Configuration</h5>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <div className="mt-0.5 min-w-[16px]"><Check size={14} className="text-green-500" /></div>
                        <div>
                          <span className="text-slate-500">Topic Type:</span>
                          <span className="ml-1 font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">{topicType}</span>
                        </div>
                      </li>
                      
                      <li className="flex items-start gap-2">
                        <div className="mt-0.5 min-w-[16px]"><Check size={14} className="text-green-500" /></div>
                        <div>
                          <span className="text-slate-500">Short Description:</span>
                          <span className="ml-1 font-medium text-slate-800">{autoShortDesc ? "Auto-generate using AI" : "Manual entry only"}</span>
                        </div>
                      </li>

                      {additionalInstructions && (
                        <li className="flex items-start gap-2">
                          <div className="mt-0.5 min-w-[16px]"><Check size={14} className="text-green-500" /></div>
                          <div>
                            <span className="text-slate-500">Custom Instructions:</span>
                            <span className="ml-1 font-medium text-slate-800">"{additionalInstructions}"</span>
                          </div>
                        </li>
                      )}

                      {!additionalInstructions && (
                         <li className="flex items-start gap-2">
                          <div className="mt-0.5 min-w-[16px]"><Check size={14} className="text-green-500" /></div>
                          <span className="text-slate-500 italic">Standard DITA formatting rules apply</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
          {step > 1 ? (
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors font-medium text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
             <div></div> 
          )}

          <button 
            onClick={step === 3 ? handleFinish : handleNext}
            disabled={step === 1 && !topicType || (step === 3 && isAnalyzing)}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all shadow-md
              ${(step === 1 && !topicType) || (step === 3 && isAnalyzing) ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}
            `}
          >
            {step === 3 ? (
              <>Convert to DITA <Check size={18} /></>
            ) : (
              <>Next Step <ArrowRight size={18} /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};