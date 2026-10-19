import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

const HerettoLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" opacity="0.15" />
    <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontWeight="800" fontSize="16" fontFamily="Inter, sans-serif">H</text>
  </svg>
);

interface HerettoStatusModalProps {
  herettoConnected: boolean;
  herettoStatusChecking: boolean;
  herettoCredentials: { host: string; email: string; token: string };
  setHerettoCredentials: React.Dispatch<React.SetStateAction<{ host: string; email: string; token: string }>>;
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
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <div
      role="dialog"
      aria-modal="true"
      className="rounded-xl p-6 w-[420px] shadow-2xl"
      style={{
        backgroundColor: 'var(--app-surface)',
        border: '1px solid var(--app-border-subtle)',
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <HerettoLogo className="w-5 h-5" style={{ color: '#14b8a6' }} />
        <h3 className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>Heretto Status</h3>
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

      {/* Host */}
      <label htmlFor="heretto-host-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
        Heretto host
      </label>
      <input
        id="heretto-host-input"
        autoFocus
        type="text"
        value={herettoCredentials.host}
        onChange={e => setHerettoCredentials(prev => ({ ...prev, host: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none mb-4"
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
        placeholder="yourcompany.heretto.com"
        spellCheck={false}
      />

      {/* Email */}
      <label htmlFor="heretto-email-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
        Email
      </label>
      <input
        id="heretto-email-input"
        type="text"
        value={herettoCredentials.email}
        onChange={e => setHerettoCredentials(prev => ({ ...prev, email: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none mb-4"
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
        placeholder="your.name@company.com"
      />

      {/* Token */}
      <label htmlFor="heretto-token-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
        API Token
      </label>
      <input
        id="heretto-token-input"
        type="password"
        value={herettoCredentials.token}
        onChange={e => setHerettoCredentials(prev => ({ ...prev, token: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none mb-1"
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
        placeholder="Your Heretto API token"
      />
      <p className="text-[10px] mb-5" style={{ color: 'var(--app-text-muted)' }}>
        Stored locally in ~/heretto.json. Never sent to the browser.
      </p>

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
    </div>
  </div>
);
