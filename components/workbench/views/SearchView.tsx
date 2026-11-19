import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown, ChevronRight, Folder, Tag, Calendar, Loader2, AlertTriangle } from 'lucide-react';
import { ViewHeader } from '../SidePanel';
import { Popover, MenuItem } from '../Popover';
import {
  buildFacetBody, buildSearchBody, emptyFilters, fetchFolderSearchUri, groupHitsByFolder, parseFacets,
  parseSearchResponse, runSearch, SearchError, SEARCH_PAGE_SIZE,
  type FacetValues, type SearchFilters, type SearchHit, type SearchRequest, type SearchSort,
} from '../../../lib/heretto-search';

export interface SearchScope { uuid: string; name: string }

interface SearchViewProps {
  herettoConnected: boolean;
  host: string;
  rootUuid: string;
  /** The active tab's Heretto folder, offered as a narrower scope. */
  currentFolder: SearchScope | null;
  /** Bumped by Open from Heretto (File menu, rail popover): focus the query box. */
  focusRequest: number;
  /** `scopeIsRoot`: the hit's path is relative to the content root (else to the narrower scope). */
  onOpenHit: (hit: SearchHit, scopeIsRoot: boolean) => void;
  onOpenCredentials: () => void;
  onTestConnection: () => void;
}

const DEBOUNCE_MS = 350;

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'RELEVANCE', label: 'Relevance' },
  { value: 'TITLE_ASC', label: 'Title A–Z' },
  { value: 'FILENAME_ASC', label: 'File name A–Z' },
  { value: 'LAST_MODIFIED_DESC', label: 'Recently modified' },
  { value: 'LAST_MODIFIED_ASC', label: 'Oldest modified' },
  { value: 'STATUS_ASC', label: 'Status' },
  { value: 'CONTENT_TYPE_ASC', label: 'Content type' },
];

type FacetKey = 'status' | 'contentType' | 'product';
const FACET_OF: Record<FacetKey, keyof FacetValues> = { status: 'status', contentType: 'content-type', product: 'Product' };
const FACET_LABEL: Record<FacetKey, string> = { status: 'Status', contentType: 'Type', product: 'Product' };

const STATUS_COLOR: Record<string, string> = { published: '#22c55e', draft: '#f59e0b', in_progress: '#60a5fa', 'in-progress': '#60a5fa', 'in-review': '#60a5fa', in_review: '#60a5fa', review: '#60a5fa', archived: '#9ca3af' };

const relativeDay = (ms: number | null): string => {
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

/** The keywords' matches in `text`, as the API matches them: each keyword as a word prefix, case-insensitive. */
const highlight = (text: string, query: string): React.ReactNode => {
  const words = query.trim().split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return text;
  const re = new RegExp(`\\b(${words.join('|')})[\\w'-]*`, 'gi');
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(<mark key={m.index} className="rounded-sm px-px" style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 30%, transparent)', color: 'inherit' }}>{m[0]}</mark>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; error: SearchError };

/**
 * FR-072 / ADR-013 amendment: keyword search over topic text and titles with
 * Heretto's search API. Results grouped by folder; one page size for every page;
 * the filter values and counts come from a zero-row facet request sent only
 * when the query or scope changes.
 */
export const SearchView = ({ herettoConnected, host, rootUuid, currentFolder, focusRequest, onOpenHit, onOpenCredentials, onTestConnection }: SearchViewProps) => {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<SearchScope | null>(null); // null = the content root
  const [subfolders, setSubfolders] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [sort, setSort] = useState<SearchSort>('RELEVANCE');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [facets, setFacets] = useState<FacetValues>({ status: [], 'content-type': [], Product: [] });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openPop, setOpenPop] = useState<null | FacetKey | 'date' | 'scope' | 'sort'>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const anchors = { status: useRef<HTMLButtonElement>(null), contentType: useRef<HTMLButtonElement>(null), product: useRef<HTMLButtonElement>(null), date: useRef<HTMLButtonElement>(null), scope: useRef<HTMLButtonElement>(null), sort: useRef<HTMLButtonElement>(null) };
  // Keyed by host and folder: a new ~/heretto.json host means a new organization (review finding 13).
  // The lookup itself is shared while in flight: the facet and results requests start together.
  const uriCache = useRef(new Map<string, Promise<string | null>>());
  // Separate controllers: the facet request can neither cancel nor block the results (review findings 3, 4).
  const resultsAbort = useRef<AbortController | null>(null);
  const facetsAbort = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus only on a request made while mounted, never on a remount (review finding 7).
  const lastFocus = useRef(focusRequest);
  useEffect(() => {
    if (focusRequest !== lastFocus.current) { lastFocus.current = focusRequest; inputRef.current?.focus(); }
  }, [focusRequest]);

  const scopeUuid = scope?.uuid ?? rootUuid;
  const scopeName = scope?.name ?? 'Content root';
  const hasFilters = filters.status.length + filters.contentType.length + filters.product.length > 0 || !!filters.modifiedAfter || !!filters.modifiedBefore;
  const active = herettoConnected && !!rootUuid && (text.trim().length > 0 || hasFilters);

  const folderUri = useCallback(async (uuid: string): Promise<string | null> => {
    const key = `${host}\u0000${uuid}`;
    const cached = uriCache.current.get(key);
    if (cached) return cached;
    const pending = fetchFolderSearchUri(uuid, host); // rejects with the credentials error on 401/403
    uriCache.current.set(key, pending);
    // Only a successful lookup is kept; a failure or a null is tried again next time.
    pending.then(uri => { if (!uri) uriCache.current.delete(key); }, () => uriCache.current.delete(key));
    return pending;
  }, [host]);

  /** The request for the current inputs, or null (and the error shown) when the scope cannot be read. */
  const requestFor = useCallback(async (signal: AbortSignal): Promise<SearchRequest | null> => {
    const uri = await folderUri(scopeUuid);
    if (signal.aborted) return null;
    if (!uri) {
      setPhase({ kind: 'error', error: new SearchError('http', `The search scope "${scopeName}" could not be read from Heretto.`) });
      return null;
    }
    return { text, folderUri: uri, subfolders, filters, sort };
  }, [folderUri, scopeUuid, scopeName, text, subfolders, filters, sort]);

  /** Page `p` of the results (0 replaces the list, later pages append). */
  const runResults = useCallback(async (p: number) => {
    resultsAbort.current?.abort();
    const ac = new AbortController();
    resultsAbort.current = ac;
    setPhase({ kind: 'loading' });
    try {
      const request = await requestFor(ac.signal);
      if (!request || ac.signal.aborted) return;
      const json = await runSearch(buildSearchBody(request, p), ac.signal);
      if (ac.signal.aborted) return;
      const parsed = parseSearchResponse(json, request.folderUri);
      setTotal(parsed.total);
      setHits(prev => (p === 0 ? parsed.hits : [...prev, ...parsed.hits]));
      setPage(p);
      setPhase({ kind: 'ready' });
    } catch (e) {
      if (ac.signal.aborted) return;
      const err = e instanceof SearchError ? e : new SearchError('network', 'The search failed.');
      if (err.kind !== 'aborted') setPhase({ kind: 'error', error: err });
    }
  }, [requestFor]);

  /** The filter popovers' values for the query and scope. A failure keeps the last values; it never blocks results. */
  const runFacets = useCallback(async () => {
    facetsAbort.current?.abort();
    const ac = new AbortController();
    facetsAbort.current = ac;
    try {
      const request = await requestFor(ac.signal);
      if (!request || ac.signal.aborted) return;
      const json = await runSearch(buildFacetBody(request), ac.signal);
      if (!ac.signal.aborted) setFacets(parseFacets(json));
    } catch {
      // Counts are a convenience; the results request reports any real failure.
    }
  }, [requestFor]);

  const runQuery = useCallback(() => { void runFacets(); void runResults(0); }, [runFacets, runResults]);
  const queryRef = useRef(runQuery);
  queryRef.current = runQuery;
  const resultsRef = useRef(runResults);
  resultsRef.current = runResults;

  // The query or scope changed: clear what no longer matches at once (review finding 9),
  // then new facets and the first page, debounced.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    resultsAbort.current?.abort();
    facetsAbort.current?.abort();
    setHits([]); setTotal(0); setPage(0);
    if (!active) { debounceRef.current = null; setPhase({ kind: 'idle' }); return; }
    setPhase({ kind: 'loading' });
    debounceRef.current = setTimeout(() => { debounceRef.current = null; queryRef.current(); }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // The triggers are listed on purpose (the refs read the latest values); filters and sort rerun below, without facets.
  }, [active, text, scopeUuid, subfolders, herettoConnected, rootUuid, host]);

  // A filter or the sort changed: the first page again, facets kept. A pending debounced run already covers it.
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) { firstFilterRun.current = false; return; }
    if (active && !debounceRef.current) void resultsRef.current(0);
  }, [filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps -- `active` is read, not a trigger

  /** Enter: run now, and cancel the pending debounced run so it does not run twice (review finding 8). */
  const runNow = () => {
    if (!active) return;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    runQuery();
  };

  useEffect(() => () => { resultsAbort.current?.abort(); facetsAbort.current?.abort(); }, []);

  const groups = useMemo(() => groupHitsByFolder(hits), [hits]);

  const toggleValue = (key: FacetKey, value: string) => {
    setFilters(f => {
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });
  };

  const chip = (key: FacetKey) => {
    const on = filters[key];
    return (
      <button
        key={key}
        ref={anchors[key]}
        onClick={() => setOpenPop(p => (p === key ? null : key))}
        aria-haspopup="dialog"
        aria-expanded={openPop === key}
        data-testid={`search-filter-${key}`}
        className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] hover-app"
        style={on.length
          ? { border: '1px solid color-mix(in srgb, var(--editor-accent) 60%, transparent)', backgroundColor: 'color-mix(in srgb, var(--editor-accent) 14%, transparent)', color: 'var(--app-text-primary)' }
          : { border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)', color: 'var(--app-text-secondary)' }}
      >
        {key === 'status' && <Tag className="w-3 h-3" />}
        {FACET_LABEL[key]}{on.length ? `: ${on.join(', ')}` : ''}
      </button>
    );
  };

  const facetPop = (key: FacetKey) => {
    const values = facets[FACET_OF[key]];
    const selectedValues = filters[key];
    const shown = [...values.map(v => v.value), ...selectedValues.filter(v => !values.some(x => x.value === v))];
    return (
      <Popover key={key} open={openPop === key} onClose={() => setOpenPop(null)} anchorRef={anchors[key]} placement="bottom-start" role="dialog" ariaLabel={`${FACET_LABEL[key]} filter`} width={220}>
        <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{FACET_LABEL[key]}</div>
        {shown.length === 0 && <p className="px-3 pb-2 m-0 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>No values in this scope for this query.</p>}
        {shown.map(value => (
          <label key={value} className="flex items-center gap-2 px-3 py-1 cursor-pointer hover-app" style={{ color: 'var(--app-text-secondary)' }}>
            <input type="checkbox" checked={selectedValues.includes(value)} onChange={() => toggleValue(key, value)} />
            <span className="flex-1 truncate">{value}</span>
            <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{values.find(v => v.value === value)?.count ?? ''}</span>
          </label>
        ))}
        <p className="px-3 pt-1 pb-2 m-0 text-[10px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>Counts are for this query and scope. Values of one filter are OR-ed; different filters are AND-ed.</p>
      </Popover>
    );
  };

  const errorNotice = phase.kind === 'error' ? phase.error : null;

  return (
    <section id="view-search" className="flex-1 flex flex-col min-h-0" aria-label="Search view" data-testid="view-search">
      <ViewHeader title="Search" />

      {!herettoConnected ? (
        <p className="px-4 py-2 m-0 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>Connect to Heretto to search topic text and titles.</p>
      ) : (
        <>
          <div className="px-3 pb-2 flex flex-col gap-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-[7px] w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runNow(); } }}
                placeholder="Search topic text and titles"
                aria-label="Search Heretto"
                className="w-full h-7 pl-7 pr-7 rounded text-xs outline-none"
                style={{ backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-primary)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
              />
              {text && (
                <button onClick={() => { setText(''); inputRef.current?.focus(); }} aria-label="Clear search" className="absolute right-1.5 top-1.5 w-4 h-4 rounded flex items-center justify-center hover-app-text" style={{ color: 'var(--app-text-muted)' }}>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              In
              <button ref={anchors.scope} onClick={() => setOpenPop(p => (p === 'scope' ? null : 'scope'))} aria-haspopup="menu" aria-expanded={openPop === 'scope'} data-testid="search-scope" className="truncate max-w-[60%]" style={{ color: 'var(--app-text-secondary)', borderBottom: '1px dotted var(--app-text-muted)' }}>{scopeName}</button>
              <label className="ml-auto inline-flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={subfolders} onChange={e => setSubfolders(e.target.checked)} /> Subfolders
              </label>
            </div>
            <Popover open={openPop === 'scope'} onClose={() => setOpenPop(null)} anchorRef={anchors.scope} placement="bottom-start" role="menu" ariaLabel="Search scope" width={240}>
              <MenuItem label="Content root" active={!scope} onSelect={() => { setScope(null); setOpenPop(null); }} />
              {currentFolder && currentFolder.uuid !== rootUuid && (
                <MenuItem label={`This topic's folder (${currentFolder.name})`} active={scope?.uuid === currentFolder.uuid} onSelect={() => { setScope(currentFolder); setOpenPop(null); }} />
              )}
            </Popover>
            <div className="flex flex-wrap gap-1">
              {chip('status')}{chip('contentType')}
              <button
                ref={anchors.date}
                onClick={() => setOpenPop(p => (p === 'date' ? null : 'date'))}
                aria-haspopup="dialog"
                aria-expanded={openPop === 'date'}
                data-testid="search-filter-date"
                className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] hover-app"
                style={filters.modifiedAfter || filters.modifiedBefore
                  ? { border: '1px solid color-mix(in srgb, var(--editor-accent) 60%, transparent)', backgroundColor: 'color-mix(in srgb, var(--editor-accent) 14%, transparent)', color: 'var(--app-text-primary)' }
                  : { border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)', color: 'var(--app-text-secondary)' }}
              >
                <Calendar className="w-3 h-3" />Modified{filters.modifiedAfter ? ` after ${filters.modifiedAfter}` : ''}{filters.modifiedBefore ? ` before ${filters.modifiedBefore}` : ''}
              </button>
              {chip('product')}
            </div>
            {facetPop('status')}{facetPop('contentType')}{facetPop('product')}
            <Popover open={openPop === 'date'} onClose={() => setOpenPop(null)} anchorRef={anchors.date} placement="bottom-start" role="dialog" ariaLabel="Modified filter" width={230}>
              <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Modified</div>
              {(['modifiedAfter', 'modifiedBefore'] as const).map(k => (
                <label key={k} className="grid items-center gap-2 px-3 py-1 text-[11px]" style={{ gridTemplateColumns: '48px 1fr', color: 'var(--app-text-muted)' }}>
                  {k === 'modifiedAfter' ? 'After' : 'Before'}
                  <input type="date" value={filters[k] ?? ''} onChange={e => setFilters(f => ({ ...f, [k]: e.target.value || undefined }))} aria-label={k === 'modifiedAfter' ? 'Modified after' : 'Modified before'} className="h-6 rounded px-1.5 text-xs" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-primary)' }} />
                </label>
              ))}
              <p className="px-3 pt-1 pb-2 m-0 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>Heretto filters on modified and created dates only.</p>
            </Popover>
          </div>

          {errorNotice ? (
            <div role="alert" className="mx-3 my-2 p-2.5 rounded-md text-[11.5px] leading-relaxed" style={{ border: '1px solid color-mix(in srgb, #ef4444 40%, var(--app-border))', backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--app-surface))', color: 'var(--app-text-secondary)' }} data-testid="search-error">
              <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--app-text-primary)' }}><AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f87171' }} />{errorNotice.message}</div>
              {errorNotice.kind === 'auth' && (
                <div className="flex gap-1.5 mt-1.5">
                  <button onClick={onOpenCredentials} className="h-[22px] px-2 rounded text-[11px] hover-btn" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>Credentials…</button>
                  <button onClick={onTestConnection} className="h-[22px] px-2 rounded text-[11px] hover-btn" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>Test connection</button>
                </div>
              )}
              {errorNotice.kind !== 'auth' && (
                <button onClick={runNow} className="mt-1.5 h-[22px] px-2 rounded text-[11px] hover-btn" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>Try again</button>
              )}
            </div>
          ) : !active ? (
            <p className="px-4 py-2 m-0 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>Type a few words to search topic text and titles. Each word matches the start of a word, so <i>config</i> finds <i>configuration</i>.</p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 pt-1.5 pb-1 text-[11px]" style={{ color: 'var(--app-text-muted)', borderTop: '1px solid var(--app-border-subtle)' }} aria-live="polite">
                <span data-testid="search-total">{phase.kind === 'loading' && hits.length === 0 ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}</span>
                <button ref={anchors.sort} onClick={() => setOpenPop(p => (p === 'sort' ? null : 'sort'))} aria-haspopup="menu" aria-expanded={openPop === 'sort'} className="inline-flex items-center gap-0.5" style={{ color: 'var(--app-text-secondary)' }}>
                  {SORTS.find(s => s.value === sort)?.label}<ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <Popover open={openPop === 'sort'} onClose={() => setOpenPop(null)} anchorRef={anchors.sort} placement="bottom-end" role="menu" ariaLabel="Sort results" width={180}>
                {SORTS.map(s => <MenuItem key={s.value} label={s.label} active={s.value === sort} onSelect={() => { setSort(s.value); setOpenPop(null); }} />)}
              </Popover>
              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar pb-2" data-testid="search-results">
                {groups.map(g => {
                  const isCollapsed = collapsed.has(g.folderPath);
                  return (
                    <div key={g.folderPath} role="group" aria-label={g.folderPath || 'Content root'}>
                      <button
                        onClick={() => setCollapsed(c => { const n = new Set(c); if (n.has(g.folderPath)) n.delete(g.folderPath); else n.add(g.folderPath); return n; })}
                        aria-expanded={!isCollapsed}
                        className="w-full h-[22px] flex items-center gap-1 px-2 text-[11px] whitespace-nowrap overflow-hidden hover-app"
                        style={{ color: 'var(--app-text-muted)' }}
                        title={g.folderPath}
                      >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                        <Folder className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate" style={{ direction: 'rtl', textAlign: 'left' }}>{g.folderPath || 'Content root'}</span>
                        <span className="ml-auto text-[10px] px-1.5 rounded-full" style={{ backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)' }}>{g.hits.length}</span>
                      </button>
                      {!isCollapsed && g.hits.map(h => (
                        <button
                          key={h.uuid}
                          onClick={() => { setSelected(h.uuid); onOpenHit(h, !scope); }}
                          data-testid={`search-hit-${h.uuid}`}
                          title={`Open ${h.name}`}
                          className="w-full text-left pl-[26px] pr-2.5 py-1 hover-app"
                          style={selected === h.uuid
                            ? { backgroundColor: 'color-mix(in srgb, var(--editor-accent) 16%, transparent)', borderLeft: '2px solid var(--editor-accent)' }
                            : { borderLeft: '2px solid transparent' }}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--app-text-primary)' }}>
                            <span className="truncate">{highlight(h.title, text)}</span>
                            {h.status && (
                              <span className="shrink-0 text-[9.5px] font-semibold px-1.5 rounded-full lowercase" style={{ lineHeight: '15px', color: STATUS_COLOR[h.status] ?? 'var(--app-text-muted)', border: `1px solid color-mix(in srgb, ${STATUS_COLOR[h.status] ?? '#9ca3af'} 40%, transparent)`, backgroundColor: `color-mix(in srgb, ${STATUS_COLOR[h.status] ?? '#9ca3af'} 10%, transparent)` }}>{h.status}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] whitespace-nowrap overflow-hidden" style={{ color: 'var(--app-text-muted)' }}>
                            <span className="truncate font-mono text-[10px]">{h.name}</span>
                            {h.contentType && <><span>·</span><span className="shrink-0">{h.contentType}</span></>}
                            {h.lastModified && <><span>·</span><span className="shrink-0">{relativeDay(h.lastModified)}</span></>}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {phase.kind === 'loading' && hits.length > 0 && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--app-text-muted)' }} /></div>}
                {phase.kind === 'ready' && hits.length < total && (
                  <button onClick={() => void runResults(page + 1)} className="mx-3 mt-1.5 h-6 w-[calc(100%-24px)] rounded text-[11px] hover-app" style={{ border: '1px dashed var(--app-border-subtle)', color: 'var(--app-text-secondary)' }}>
                    Load {Math.min(SEARCH_PAGE_SIZE, total - hits.length)} more
                  </button>
                )}
                {phase.kind === 'ready' && total === 0 && (
                  <p className="px-4 py-2 m-0 text-xs" style={{ color: 'var(--app-text-muted)' }}>No topics match{hasFilters ? ' these filters' : ''} in {scopeName}.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
};
