import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Network, Search } from 'lucide-react';
import { Modal } from './Modal';
import type { MapLoadErrorKind } from '../lib/heretto-map-loader';
import { extractUuid } from '../hooks/useKeyRegistry';
import {
  buildSearchBody, emptyFilters, fetchFolderSearchUri, parseSearchResponse, runSearch, SearchError,
  type SearchHit,
} from '../lib/heretto-search';

/** v1.2.0 (Kiryl, 2026-11-19): typed text that is not a UUID searches maps by name and text. */
const MAP_SEARCH_DEBOUNCE_MS = 350;
/** Heretto's content type for a DITA map; its `SiteMap` type is not a DITA map and cannot be connected. */
const MAP_CONTENT_TYPES = ['Map'];

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
  /** For the map search; without them the dialog takes a UUID or link only. */
  host?: string;
  rootUuid?: string;
  herettoConnected?: boolean;
  loading: boolean;
  error: { kind: MapLoadErrorKind; message: string } | null;
  onConnect: (input: string) => Promise<boolean>;
  onClearError: () => void;
  onClose: () => void;
}

export const ConnectMapModal = ({ connectedMapName, host = '', rootUuid = '', herettoConnected = false, loading, error, onConnect, onClearError, onClose }: ConnectMapModalProps) => {
  const [input, setInput] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const query = input.trim();
  const looksLikeUuid = !!extractUuid(query);
  const canSearch = herettoConnected && !!rootUuid && !!host;
  const searchActive = canSearch && !looksLikeUuid && query.length >= 2;

  // Search maps as the writer types (anything that is not a UUID or a link holding one).
  useEffect(() => {
    abortRef.current?.abort();
    setHits([]); setTotal(0); setSearchError(null);
    if (!searchActive) { setSearching(false); return; }
    setSearching(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const uri = await fetchFolderSearchUri(rootUuid, host);
        if (ac.signal.aborted) return;
        if (!uri) { setSearchError('The content root could not be read from Heretto.'); setSearching(false); return; }
        const body = buildSearchBody({ text: query, folderUri: uri, subfolders: true, filters: { ...emptyFilters(), contentType: MAP_CONTENT_TYPES }, sort: 'RELEVANCE' }, 0);
        const parsed = parseSearchResponse(await runSearch(body, ac.signal), uri);
        if (ac.signal.aborted) return;
        setHits(parsed.hits); setTotal(parsed.total); setSearching(false);
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof SearchError && e.kind === 'aborted') return;
        setSearchError(e instanceof SearchError ? e.message : 'The map search failed.');
        setSearching(false);
      }
    }, MAP_SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query, searchActive, rootUuid, host]);

  const connectTo = async (value: string) => {
    if (!value || loading) return;
    onClearError();
    if (await onConnect(value)) onClose();
  };

  const submit = async () => {
    if (!query || loading) return;
    if (looksLikeUuid || !canSearch) { await connectTo(input); return; }
    if (hits.length === 1) await connectTo(hits[0].uuid);   // Enter with one match connects it
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
        {canSearch ? 'Map name, UUID, or Heretto link' : 'Map UUID or Heretto link'}
      </label>
      <input
        id="connect-map-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
        autoFocus
        placeholder={canSearch ? 'Search maps, or paste a UUID' : '00000000-0000-0000-0000-000000000000'}
        aria-describedby={searchActive ? 'connect-map-results-status' : undefined}
        className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${looksLikeUuid || !canSearch ? 'font-mono' : ''} ${searchActive ? 'mb-2' : 'mb-5'}`}
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          border: '1px solid var(--app-border-subtle)',
          color: 'var(--app-text-primary)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
      />

      {searchActive && (
        <div className="mb-4">
          <div id="connect-map-results-status" aria-live="polite" className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--app-text-muted)' }}>
            {searching ? <><Loader2 className="w-3 h-3 animate-spin" />Searching maps…</>
              : searchError ? <span style={{ color: '#f87171' }}>{searchError}</span>
              : <><Search className="w-3 h-3" />{total === 0 ? 'No maps match.' : `${total} map${total === 1 ? '' : 's'}${total > hits.length ? `, showing ${hits.length}` : ''}`}</>}
          </div>
          {hits.length > 0 && (
            <div role="listbox" aria-label="Matching maps" className="max-h-64 overflow-y-auto rounded-lg custom-scrollbar" style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)' }} data-testid="connect-map-results">
              {hits.map(h => (
                <button
                  key={h.uuid}
                  role="option"
                  aria-selected={false}
                  onClick={() => void connectTo(h.uuid)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2 hover-app disabled:opacity-50"
                  style={{ borderBottom: '1px solid var(--app-border-subtle)' }}
                  title={h.path}
                  data-testid={`connect-map-hit-${h.uuid}`}
                >
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--app-text-primary)' }}>
                    <Network className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--editor-accent)' }} />
                    <span className="truncate font-medium">{h.title}</span>
                    {h.status && <span className="ml-auto shrink-0 text-[10px] lowercase" style={{ color: 'var(--app-text-muted)' }}>{h.status}</span>}
                  </div>
                  <div className="pl-[22px] text-[11px] truncate" style={{ color: 'var(--app-text-muted)', direction: 'rtl', textAlign: 'left' }}>{h.path}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
          disabled={!query || loading || (searchActive && hits.length !== 1)}
          title={searchActive && hits.length !== 1 ? 'Pick a map from the list, or paste its UUID' : undefined}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Reading maps…' : 'Connect'}
        </button>
      </div>
    </Modal>
  );
};
