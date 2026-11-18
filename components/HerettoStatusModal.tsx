import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { HerettoCredentialsForm } from './HerettoCredentialsForm';

const HerettoLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" opacity="0.15" />
    <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontWeight="800" fontSize="16" fontFamily="Inter, sans-serif">H</text>
  </svg>
);

interface HerettoStatusModalProps {
  herettoConnected: boolean;
  herettoStatusChecking: boolean;
  herettoCredentials: { host: string; rootUuid: string; email: string; token: string };
  setHerettoCredentials: React.Dispatch<React.SetStateAction<{ host: string; rootUuid: string; email: string; token: string }>>;
  testHerettoConnection: () => void;
  saveHerettoCredentials: () => void;
  onClose: () => void;
}

export const HerettoStatusModal = ({
  herettoConnected,
  herettoStatusChecking,
  herettoCredentials,
  setHerettoCredentials,
  testHerettoConnection,
  saveHerettoCredentials,
  onClose,
}: HerettoStatusModalProps) => (
  <Modal onClose={onClose} labelId="heretto-status-title" className="rounded-xl p-6 w-[420px] shadow-2xl">
      <div className="flex items-center gap-2 mb-5">
        <HerettoLogo className="w-5 h-5" style={{ color: '#14b8a6' }} />
        <h3 id="heretto-status-title" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>Heretto Status</h3>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-5">
        <div
          className="flex-1 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
          style={{
            backgroundColor: herettoConnected
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${herettoConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: herettoConnected ? '#10b981' : '#ef4444',
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: herettoConnected ? '#10b981' : '#ef4444' }}
          />
          {herettoConnected ? 'Connected' : 'Not connected'}
        </div>
        <button
          onClick={testHerettoConnection}
          disabled={herettoStatusChecking}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shrink-0 hover-btn"
          style={{
            backgroundColor: 'var(--app-surface-raised)',
            border: '1px solid var(--app-border-subtle)',
            color: 'var(--app-text-secondary)',
          }}
        >
          {herettoStatusChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Test
        </button>
      </div>

      <HerettoCredentialsForm credentials={herettoCredentials} setCredentials={setHerettoCredentials} />

      {/* Actions */}
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
          Close
        </button>
        <button
          onClick={saveHerettoCredentials}
          disabled={herettoStatusChecking}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {herettoStatusChecking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
      </div>
  </Modal>
);
