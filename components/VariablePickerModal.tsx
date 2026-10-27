import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import type { KeyRegistry } from '../lib/heretto-map-loader';
import { loadKeyVariables, type VariableEntry, type VariableLoadResult } from '../lib/variable-catalog';

// FR-066: pick a variable from the connected map. Left, the map's keys that
// point at a topic; right, the variables of the selected key (fetched when it
// is selected). One search box filters both lists.

interface VariablePickerModalProps {
  registry: KeyRegistry;
  onInsert: (entry: VariableEntry) => void;
  onClose: () => void;
}

const isTopicHref = (href: string | null): boolean => !!href && /\.(dita|xml)$/i.test(href.split('#')[0]);

export const VariablePickerModal = ({ registry, onInsert, onClose }: VariablePickerModalProps) => {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [result, setResult] = useState<VariableLoadResult | 'loading' | null>(null);
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const keys = useMemo(
    () => [...registry.keys.entries()].filter(([, def]) => isTopicHref(def.href)).map(([key]) => key).sort((a, b) => a.localeCompare(b)),
    [registry],
  );
  const visibleKeys = useMemo(() => {
    const matching = keys.filter(k => k.toLowerCase().includes(q));
    // Keep the selected key listed while its variables are being searched.
    return matching.length > 0 || !selectedKey ? matching : [selectedKey];
  }, [keys, q, selectedKey]);

  // Select the first key on open.
  useEffect(() => { if (!selectedKey && keys.length > 0) setSelectedKey(keys[0]); }, [keys, selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    const def = registry.keys.get(selectedKey);
    if (!def) return;
    let live = true;
    setResult('loading');
    setActive(0);
    void loadKeyVariables(selectedKey, def).then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, [registry, selectedKey]);

  const variables = result && result !== 'loading' && result.status === 'ok' ? result.variables : [];
  const keyMatchesQuery = !!selectedKey && selectedKey.toLowerCase().includes(q);
  const visibleVariables = keyMatchesQuery ? variables : variables.filter(v => v.id.toLowerCase().includes(q) || v.text.toLowerCase().includes(q));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, visibleVariables.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && visibleVariables[active]) { e.preventDefault(); onInsert(visibleVariables[active]); }
  };

  const listStyle: React.CSSProperties = { backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)' };

  return (
    <Modal onClose={onClose} labelId="variable-picker-title" className="rounded-xl p-5 w-[44rem] max-w-[95vw] shadow-2xl">
      <h3 id="variable-picker-title" className="text-lg font-bold mb-1" style={{ color: 'var(--app-text-primary)' }}>Insert Variable</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--app-text-muted)' }}>
        From <span className="font-mono">{registry.map.name}</span>. The reference is written as the variable's own element, as DITA requires.
      </p>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        autoFocus
        aria-label="Search variables"
        placeholder="Search keys, ids, or text"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
        style={{ ...listStyle, color: 'var(--app-text-primary)' }}
      />
      <div className="flex gap-3 h-72">
        <ul role="listbox" aria-label="Keys" className="w-56 shrink-0 overflow-y-auto rounded-lg py-1 custom-scrollbar" style={listStyle}>
          {visibleKeys.length === 0 && <li className="px-3 py-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>No keys point at a topic.</li>}
          {visibleKeys.map(key => (
            <li key={key} role="option" aria-selected={key === selectedKey}>
              <button
                onClick={() => setSelectedKey(key)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono truncate hover-app"
                style={{
                  color: key === selectedKey ? 'var(--app-text-primary)' : 'var(--app-text-secondary)',
                  backgroundColor: key === selectedKey ? 'color-mix(in srgb, var(--editor-accent) 15%, transparent)' : undefined,
                }}
                title={key}
              >
                {key}
              </button>
            </li>
          ))}
        </ul>
        <ul role="listbox" aria-label="Variables" className="flex-1 overflow-y-auto rounded-lg py-1 custom-scrollbar" style={listStyle}>
          {result === 'loading' && (
            <li className="px-3 py-2 text-xs flex items-center gap-2" style={{ color: 'var(--app-text-muted)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading {selectedKey}…
            </li>
          )}
          {result && result !== 'loading' && result.status === 'missing' && (
            <li className="px-3 py-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>This key's topic was not found in Heretto.</li>
          )}
          {result && result !== 'loading' && result.status === 'error' && (
            <li className="px-3 py-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>Heretto could not be reached. Select the key again to retry.</li>
          )}
          {result && result !== 'loading' && result.status === 'ok' && visibleVariables.length === 0 && (
            <li className="px-3 py-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
              {variables.length === 0 ? 'This topic defines no inline variables.' : 'No variable matches.'}
            </li>
          )}
          {visibleVariables.map((v, i) => (
            <li key={v.id} role="option" aria-selected={i === active}>
              <button
                onClick={() => onInsert(v)}
                onMouseEnter={() => setActive(i)}
                className="w-full text-left px-3 py-1.5 text-xs flex items-baseline gap-2"
                style={{ backgroundColor: i === active ? 'color-mix(in srgb, var(--editor-accent) 15%, transparent)' : undefined }}
              >
                <span className="font-mono shrink-0" style={{ color: 'var(--app-text-primary)' }}>{v.id}</span>
                <span className="truncate flex-1" style={{ color: 'var(--app-text-secondary)' }}>{v.text}</span>
                <code className="shrink-0" style={{ color: 'var(--app-text-muted)' }}>{`<${v.tag}>`}</code>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};
