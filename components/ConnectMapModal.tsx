import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import type { MapLoadErrorKind } from '../lib/heretto-map-loader';

// P2-27 / ADR-013 decision 5: Connect a Map, and the failure modal (not a
// toast) with its own language for each failure kind. A failure leaves the
// previously connected map in force, so the copy says so.

const FAILURE_TITLE: Record<MapLoadErrorKind, string> = {
  network: 'Heretto could not be reached',
  'not-found': 'No map with that UUID',
  'not-a-map': 'That file is not a map',
  malformed: 'The map could not be read',
};

const FAILURE_HINT: Record<MapLoadErrorKind, string> = {
  network: 'Check the connection under Heretto ▸ Status, then try again.',
  'not-found': 'Copy the UUID from the map in Heretto (or paste a Heretto link to it) and try again.',
  'not-a-map': 'Connect a .ditamap or bookmap, not a topic or folder.',
  malformed: 'The map\'s XML is not well-formed. Fix it in Heretto, then try again.',
};

interface ConnectMapModalProps {
  connectedMapName: string | null;
  loading: boolean;
  error: { kind: MapLoadErrorKind; message: string } | null;
  onConnect: (input: string) => Promise<boolean>;
  onClearError: () => void;
  onClose: () => void;
}

export const ConnectMapModal = ({ connectedMapName, loading, error, onConnect, onClearError, onClose }: ConnectMapModalProps) => {
  const [input, setInput] = useState('');

  const submit = async () => {
    if (!input.trim() || loading) return;
    onClearError();
    if (await onConnect(input)) onClose();
  };

  const close = () => { onClearError(); onClose(); };

  return (
    <Modal onClose={close} labelId="connect-map-title" className="rounded-xl p-6 w-[28rem] shadow-2xl">
      <h3 id="connect-map-title" className="text-lg font-bold mb-1" style={{ color: 'var(--app-text-primary)' }}>Connect a Map</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--app-text-muted)' }}>
        Variable and key references are checked against the keys this map and every map it references define.
        {connectedMapName ? <> Connected now: <span className="font-mono">{connectedMapName}</span>.</> : null}
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-lg px-3 py-2.5 mb-4 text-sm"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--validation-broken-xref) 10%, var(--app-surface))',
            border: '1px solid color-mix(in srgb, var(--validation-broken-xref) 40%, var(--app-border-subtle))',
            color: 'var(--app-text-primary)',
          }}
        >
          <div className="font-semibold mb-0.5">{FAILURE_TITLE[error.kind]}</div>
          <div style={{ color: 'var(--app-text-secondary)' }}>{error.message} {FAILURE_HINT[error.kind]}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--app-text-muted)' }}>
            {connectedMapName ? `${connectedMapName} is still connected.` : 'No map is connected.'}
          </div>
        </div>
      )}

      <label htmlFor="connect-map-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--app-text-secondary)' }}>
        Map UUID or Heretto link
      </label>
      <input
        id="connect-map-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
        autoFocus
        placeholder="00000000-0000-0000-0000-000000000000"
        className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none mb-5"
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
      />

      <div className="flex gap-2">
        <button
          onClick={close}
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
          onClick={() => void submit()}
          disabled={!input.trim() || loading}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Reading maps…' : 'Connect'}
        </button>
      </div>
    </Modal>
  );
};
