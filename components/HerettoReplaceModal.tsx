import React, { useState, useEffect } from 'react';
import { Loader2, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { toast } from 'sonner';

const HerettoLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" opacity="0.15" />
    <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontWeight="800" fontSize="16" fontFamily="Inter, sans-serif">H</text>
  </svg>
);

type ReplaceStep = 'confirm' | 'preview' | 'execute';

interface ReplaceTarget {
  uuid: string;
  name: string;
  path: string;
}

interface HerettoReplaceModalProps {
  isOpen: boolean;
  target: ReplaceTarget | null;
  editorContent: string;
  onReplace: (target: ReplaceTarget) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export const HerettoReplaceModal = ({
  isOpen,
  target,
  editorContent,
  onReplace,
  onClose,
}: HerettoReplaceModalProps) => {
  const [step, setStep] = useState<ReplaceStep>('confirm');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingCurrent, setFetchingCurrent] = useState(false);
  const [replaceStatus, setReplaceStatus] = useState<{
    uploading: boolean;
    verifying: boolean;
    success: boolean | null;
    error?: string;
  }>({
    uploading: false,
    verifying: false,
    success: null,
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setCurrentContent('');
      setLoading(false);
      setFetchingCurrent(false);
      setReplaceStatus({
        uploading: false,
        verifying: false,
        success: null,
      });
    }
  }, [isOpen]);

  const fetchCurrentContent = async () => {
    if (!target) return;

    setFetchingCurrent(true);
    try {
      const response = await fetch(`/heretto-api/all-files/${target.uuid}/content`);
      if (!response.ok) {
        throw new Error(`Failed to fetch current content: ${response.status}`);
      }
      const content = await response.text();
      setCurrentContent(content);
      setStep('preview');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load current content: ${errorMessage}`);
    } finally {
      setFetchingCurrent(false);
    }
  };

  const handleReplace = async () => {
    if (!target) return;

    setStep('execute');
    setReplaceStatus({
      uploading: true,
      verifying: false,
      success: null,
    });

    try {
      // Call the replace function from useHerettoCms
      const result = await onReplace(target);

      if (result.success) {
        setReplaceStatus({
          uploading: false,
          verifying: false,
          success: true,
        });
      } else {
        setReplaceStatus({
          uploading: false,
          verifying: false,
          success: false,
          error: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setReplaceStatus({
        uploading: false,
        verifying: false,
        success: false,
        error: errorMessage,
      });
    }
  };

  const handleRetry = () => {
    setStep('confirm');
    setReplaceStatus({
      uploading: false,
      verifying: false,
      success: null,
    });
  };

  if (!isOpen || !target) return null;

  const modalId = 'heretto-replace-modal-title';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalId}
        className="rounded-xl p-6 w-[900px] max-w-[90vw] max-h-[90vh] flex flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--app-surface)',
          border: '1px solid var(--app-border-subtle)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <HerettoLogo className="w-5 h-5" style={{ color: '#14b8a6' }} />
          <h3 id={modalId} className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
            Replace in Heretto
            {step === 'preview' && ' — Preview'}
          </h3>
        </div>

        {/* Step 1: Confirm Target */}
        {step === 'confirm' && (
          <div className="flex-1 flex flex-col">
            <p className="text-sm mb-4" style={{ color: 'var(--app-text-primary)' }}>
              You are about to replace:
            </p>

            <div className="flex items-center gap-3 p-4 mb-4 rounded-lg" style={{
              backgroundColor: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border-subtle)',
            }}>
              <FileText className="w-5 h-5 shrink-0" style={{ color: 'var(--app-text-secondary)' }} />
              <div>
                <div className="font-medium text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  {target.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                  {target.path}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 mb-6 rounded-lg" style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-primary)' }}>
                  This will overwrite the existing file in Heretto CMS.
                </p>
                <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                  This action cannot be undone from DITA Architect. To recover, use Heretto's version history (topic → History tab).
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors hover-btn"
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  border: '1px solid var(--app-border-subtle)',
                  color: 'var(--app-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={fetchCurrentContent}
                disabled={fetchingCurrent}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {fetchingCurrent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Preview Changes
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview Changes */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col">
            <DiffViewer
              originalContent={currentContent}
              modifiedContent={editorContent}
              originalLabel="Current in Heretto"
              modifiedLabel="Your editor"
              grow
              className="mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover-btn"
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  border: '1px solid var(--app-border-subtle)',
                  color: 'var(--app-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover-btn"
                style={{
                  backgroundColor: 'var(--app-surface-raised)',
                  border: '1px solid var(--app-border-subtle)',
                  color: 'var(--app-text-secondary)',
                }}
              >
                Back
              </button>
              <button
                autoFocus
                onClick={handleReplace}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
              >
                Replace Now
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Execute and Results */}
        {step === 'execute' && (
          <div className="flex-1 flex flex-col">
            <div className="space-y-4 mb-6">
              {/* Uploading */}
              <div className="flex items-center gap-3">
                {replaceStatus.uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--app-text-secondary)' }} />
                ) : replaceStatus.success !== null ? (
                  <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                ) : (
                  <div className="w-4 h-4" />
                )}
                <span className="text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  Uploading content...
                </span>
                {!replaceStatus.uploading && replaceStatus.success !== null && (
                  <span className="text-xs ml-auto" style={{ color: '#22c55e' }}>done</span>
                )}
              </div>

              {/* Verifying */}
              <div className="flex items-center gap-3">
                {replaceStatus.verifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--app-text-secondary)' }} />
                ) : replaceStatus.success === true ? (
                  <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
                ) : replaceStatus.success === false ? (
                  <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                ) : (
                  <div className="w-4 h-4" />
                )}
                <span className="text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  Verifying integrity...
                </span>
                {!replaceStatus.verifying && replaceStatus.success === true && (
                  <span className="text-xs ml-auto" style={{ color: '#22c55e' }}>done</span>
                )}
              </div>
            </div>

            {/* Results */}
            {replaceStatus.success === true && (
              <div className="flex-1 flex flex-col items-center justify-center text-center mb-6">
                <CheckCircle className="w-12 h-12 mb-3" style={{ color: '#22c55e' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-primary)' }}>
                  Successfully replaced
                </p>
                <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                  {target.name} in Heretto.
                </p>
              </div>
            )}

            {replaceStatus.success === false && (
              <div className="flex-1 flex flex-col items-center justify-center text-center mb-6">
                <XCircle className="w-12 h-12 mb-3" style={{ color: '#ef4444' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-primary)' }}>
                  Replace failed
                </p>
                <p className="text-xs px-4 py-2 rounded" style={{
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}>
                  {replaceStatus.error}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {replaceStatus.success === true ? (
                <button
                  autoFocus
                  onClick={onClose}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
                >
                  Done
                </button>
              ) : replaceStatus.success === false ? (
                <button
                  autoFocus
                  onClick={onClose}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
                >
                  Done
                </button>
              ) : (
                <div className="flex-1" /> // Placeholder while loading
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};