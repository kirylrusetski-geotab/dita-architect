import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, File, Network, RefreshCw, Unplug, AlertCircle, Loader2, ChevronsDownUp, FolderTree, ExternalLink } from 'lucide-react';
import { ViewHeader } from '../SidePanel';
import { resolveHerettoPathResult, type HerettoPathResult } from '../../../lib/heretto-path';
import { countNodes, type KeyRegistry, type MapNode } from '../../../lib/heretto-map-loader';

export interface MapViewProps {
  registry: KeyRegistry | null;
  connectedMap: { uuid: string; name: string } | null;
  loading: boolean;
  herettoConnected: boolean;
  /** UUIDs of the files open in tabs (an open topicref gets a dot). */
  openFileUuids: Set<string>;
  onConnect: () => void;
  onReload: () => void;
  onDisconnect: () => void;
  onOpenTopic: (file: { uuid: string; name: string; folderUuid: string }) => void;
}

/** Keys listed before the filter has to narrow them (a large tree defines over a thousand). */
const KEYS_SHOWN = 200;

type Resolution = HerettoPathResult | { status: 'pending' };

interface Row { id: string; node: MapNode; depth: number; mapUuid: string; folderUuid: string }

const resolutionKey = (folderUuid: string, href: string) => `${folderUuid}\u0000${href.split('#')[0]}`;

/**
 * What a topic row resolves: its own href from its map's folder, or (a keyref
 * topicref, review finding 6) the key's href from the folder of the map that
 * defines the key. `undefined-key` is a keyref the registry does not define.
 */
const targetOf = (row: Row, registry: KeyRegistry): { href: string; folderUuid: string } | 'undefined-key' | null => {
  const { node } = row;
  if (node.kind !== 'topic') return null;
  if (node.href) return { href: node.href, folderUuid: row.folderUuid };
  if (!node.keyref) return null;
  const def = registry.keys.get(node.keyref.split('/')[0]);
  return def?.href ? { href: def.href, folderUuid: def.mapFolderUuid } : 'undefined-key';
};


/**
 * FR-071 / ADR-013 amendment: the connected map's navigation tree, submaps
 * expanded in place on demand, each topicref's href resolved when it becomes
 * visible (missing: struck and not clickable; could not check: retried on
 * click), and the registry's keys. Reads the registry; writes nothing to any
 * tab (M2): opening a topic goes through the same import flow as everywhere else.
 */
export const MapView = ({ registry, connectedMap, loading, herettoConnected, openFileUuids, onConnect, onReload, onDisconnect, onOpenTopic }: MapViewProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resolutions, setResolutions] = useState<Map<string, Resolution>>(new Map());
  const [keysCollapsed, setKeysCollapsed] = useState(false);
  const [topicsCollapsed, setTopicsCollapsed] = useState(false);
  const [keyFilter, setKeyFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const resolving = useRef(new Set<string>());
  // Bumped with every registry: a resolution started for an older one never lands (review finding 10).
  const generation = useRef(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // A new registry (connect, reload, change of map) starts collapsed and unresolved.
  useEffect(() => { generation.current++; setExpanded(new Set()); setResolutions(new Map()); resolving.current.clear(); setFocusedId(null); }, [registry]);

  // Keys each map defines, from the registry (a keydef-only map has keys and no navigation entries).
  const keysByMap = useMemo(() => {
    const counts = new Map<string, number>();
    if (registry) for (const def of registry.keys.values()) counts.set(def.mapUuid, (counts.get(def.mapUuid) ?? 0) + 1);
    return counts;
  }, [registry]);

  const rows = useMemo<Row[]>(() => {
    if (!registry) return [];
    const out: Row[] = [];
    const rootRec = registry.maps.get(registry.map.uuid);
    if (!rootRec) return out;
    const walk = (nodes: MapNode[], depth: number, mapUuid: string, folderUuid: string, prefix: string, trail: string[]) => {
      nodes.forEach((node, i) => {
        const id = `${prefix}/${i}`;
        out.push({ id, node, depth, mapUuid, folderUuid });
        if (!expanded.has(id)) return;
        if (node.kind === 'map') {
          const sub = node.mapUuid ? registry.maps.get(node.mapUuid) : undefined;
          // A submap already open above this row (a cycle) is shown but not expanded again.
          if (sub && node.mapUuid && !trail.includes(node.mapUuid)) walk(sub.nodes, depth + 1, node.mapUuid, sub.folderUuid, id, [...trail, node.mapUuid]);
        } else {
          walk(node.children, depth + 1, mapUuid, folderUuid, id, trail);
        }
      });
    };
    walk(rootRec.nodes, 0, registry.map.uuid, rootRec.folderUuid, registry.map.uuid, [registry.map.uuid]);
    return out;
  }, [registry, expanded]);

  // Resolve the targets of visible topic rows, once each (the listing cache is shared).
  useEffect(() => {
    if (!registry) return;
    const gen = generation.current;
    for (const row of rows) {
      const t = targetOf(row, registry);
      if (!t || t === 'undefined-key') continue;
      const key = resolutionKey(t.folderUuid, t.href);
      if (resolutions.has(key) || resolving.current.has(key)) continue;
      resolving.current.add(key);
      void resolveHerettoPathResult(t.href, t.folderUuid).then(result => {
        if (gen !== generation.current) return;
        resolving.current.delete(key);
        setResolutions(prev => new Map(prev).set(key, result));
      });
    }
  }, [rows, resolutions, registry]);

  /** A row's resolution: found / missing / error / pending, or null for rows that do not resolve. */
  const resolutionOf = (row: Row): Resolution | null => {
    if (!registry) return null;
    const t = targetOf(row, registry);
    if (!t) return null;
    if (t === 'undefined-key') return { status: 'missing' };
    return resolutions.get(resolutionKey(t.folderUuid, t.href)) ?? { status: 'pending' };
  };

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const openRow = (row: Row) => {
    const { node } = row;
    setFocusedId(row.id);
    if (node.kind === 'external') return;          // outside Heretto: shown, never resolved or opened
    if (!registry) return;
    const t = targetOf(row, registry);
    if (!t) { toggle(row.id); return; }
    if (t === 'undefined-key') return;             // M3: not clickable
    const key = resolutionKey(t.folderUuid, t.href);
    const r = resolutions.get(key);
    if (!r || r.status === 'pending') return;
    if (r.status === 'missing') return;            // M3: not clickable
    if (r.status === 'error') {                    // could not check: try again
      setResolutions(prev => { const n = new Map(prev); n.delete(key); return n; });
      return;
    }
    setSelected(row.id);
    onOpenTopic(r.target);
  };

  /** Review finding 11: one tab stop for the tree (roving tabindex); arrows move, Home/End jump. */
  const moveFocus = (fromId: string, delta: number | 'home' | 'end') => {
    const i = rows.findIndex(r => r.id === fromId);
    const next = delta === 'home' ? 0 : delta === 'end' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + delta));
    const id = rows[next]?.id;
    if (!id) return;
    setFocusedId(id);
    treeRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();
  };
  const tabStop = focusedId && rows.some(r => r.id === focusedId) ? focusedId : rows[0]?.id;

  const keyRows = useMemo(() => {
    if (!registry) return [];
    const f = keyFilter.trim().toLowerCase();
    return [...registry.keys].filter(([name, def]) => !f || name.toLowerCase().includes(f) || (def.href ?? '').toLowerCase().includes(f));
  }, [registry, keyFilter]);

  if (!connectedMap) {
    return (
      <section id="view-map" className="flex-1 flex flex-col min-h-0" aria-label="Map view" data-testid="view-map">
        <ViewHeader title="Map" />
        <div className="px-4 py-3 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
          <p className="m-0 mb-3">No map connected. Connect one to see its topic tree and keys here, and to resolve variables and cross-file links in every open topic.</p>
          <button onClick={onConnect} disabled={!herettoConnected} className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded text-xs font-medium hover-btn disabled:opacity-50" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>
            <Network className="w-3.5 h-3.5" />Connect a Map…
          </button>
        </div>
      </section>
    );
  }

  const rootRec = registry?.maps.get(registry.map.uuid);

  return (
    <section id="view-map" className="flex-1 flex flex-col min-h-0" aria-label="Map view" data-testid="view-map">
      <ViewHeader
        title="Map"
        actions={registry ? (
          <button onClick={() => setExpanded(new Set())} aria-label="Collapse all" title="Collapse all" className="w-[22px] h-[22px] rounded flex items-center justify-center hover-app-text" style={{ color: 'var(--app-text-muted)' }}>
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
        ) : undefined}
      />

      <div className="mx-3 mb-1.5 px-2.5 py-2 rounded-md" style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)' }} data-testid="map-card">
        <div className="flex items-center gap-1.5 text-xs font-semibold truncate" style={{ color: 'var(--app-text-primary)' }} title={connectedMap.name}>
          <Network className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--editor-accent)' }} />
          <span className="truncate">{connectedMap.name}</span>
        </div>
        <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
          {loading && !registry ? 'Loading the map…' : registry ? (
            <>
              {registry.keys.size} key{registry.keys.size === 1 ? '' : 's'} · {registry.mapsRead} map{registry.mapsRead === 1 ? '' : 's'} read
              {registry.mapsSkipped > 0 && <span style={{ color: '#f59e0b' }}> · {registry.mapsSkipped} submap{registry.mapsSkipped === 1 ? '' : 's'} skipped</span>}
              {registry.capped && <span style={{ color: '#f59e0b' }}> · stopped at the safety limit</span>}
            </>
          ) : 'Not loaded'}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <button onClick={onReload} disabled={loading} className="inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] hover-btn disabled:opacity-50" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Reload
          </button>
          <button onClick={onConnect} className="inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] hover-btn" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>
            <Network className="w-3 h-3" />Change…
          </button>
          <button onClick={onDisconnect} title="Keys stop resolving; nothing in any open topic changes" className="inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] hover-btn" style={{ border: '1px solid var(--app-btn-border)', backgroundColor: 'var(--app-btn-bg)', color: 'var(--app-btn-text)' }}>
            <Unplug className="w-3 h-3" />Disconnect
          </button>
        </div>
      </div>

      {registry && rootRec && (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar pb-2">
          <button onClick={() => setTopicsCollapsed(c => !c)} aria-expanded={!topicsCollapsed} className="w-full h-[22px] flex items-center gap-0.5 px-1 text-[11px] font-bold uppercase tracking-wide hover-app" style={{ color: 'var(--app-text-secondary)' }}>
            {topicsCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}Topics
            <span className="ml-auto pr-1.5 font-medium normal-case tracking-normal text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{countNodes(rootRec.nodes)} topicrefs</span>
          </button>
          {!topicsCollapsed && (
            <div role="tree" aria-label="Map topics" data-testid="map-tree" ref={treeRef}>
              {rootRec.nodes.length === 0 && <p className="px-4 py-1 m-0 text-xs" style={{ color: 'var(--app-text-muted)' }}>This map has no topicrefs.</p>}
              {rows.map(row => {
                const { node } = row;
                const isMap = node.kind === 'map';
                const sub = isMap && node.mapUuid ? registry.maps.get(node.mapUuid) : undefined;
                const expandable = isMap ? !!sub : node.children.length > 0;
                const r = resolutionOf(row);
                const external = node.kind === 'external';
                const missing = r?.status === 'missing';
                const unknown = r?.status === 'error';
                const open = r?.status === 'found' && openFileUuids.has(r.target.uuid);
                const keyCount = isMap && node.mapUuid ? (keysByMap.get(node.mapUuid) ?? 0) : node.keys.length;
                const tip = external ? `External link: ${node.href}` : missing ? (node.href ? `Not found in Heretto: ${node.href}` : `The key "${node.keyref}" is not defined in this map`) : unknown ? 'Heretto could not be reached to check this; click to try again' : isMap && !sub ? `This submap could not be read: ${node.href}` : node.href ?? node.label;
                return (
                  <div
                    key={row.id}
                    role="treeitem"
                    aria-level={row.depth + 1}
                    aria-expanded={expandable ? expanded.has(row.id) : undefined}
                    aria-disabled={missing || undefined}
                    aria-selected={selected === row.id || undefined}
                    tabIndex={row.id === tabStop ? 0 : -1}
                    title={tip}
                    data-testid={`map-row-${row.id}`}
                    data-row-id={row.id}
                    data-state={r?.status ?? node.kind}
                    onClick={() => openRow(row)}
                    onFocus={() => setFocusedId(row.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(row); }
                      else if (e.key === 'ArrowRight' && expandable && !expanded.has(row.id)) { e.preventDefault(); toggle(row.id); }
                      else if (e.key === 'ArrowLeft' && expanded.has(row.id)) { e.preventDefault(); toggle(row.id); }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(row.id, 1); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(row.id, -1); }
                      else if (e.key === 'Home') { e.preventDefault(); moveFocus(row.id, 'home'); }
                      else if (e.key === 'End') { e.preventDefault(); moveFocus(row.id, 'end'); }
                    }}
                    className={`h-[22px] flex items-center gap-1.5 pr-2 text-xs whitespace-nowrap ${missing ? 'cursor-default' : 'cursor-pointer hover-app'}`}
                    style={{
                      paddingLeft: 8 + row.depth * 12,
                      ...(selected === row.id ? { backgroundColor: 'color-mix(in srgb, var(--editor-accent) 18%, transparent)', color: 'var(--app-text-primary)' } : { color: 'var(--app-text-secondary)' }),
                    }}
                  >
                    <span
                      className="w-4 flex items-center justify-center shrink-0"
                      style={{ color: 'var(--app-text-muted)' }}
                      onClick={e => { if (expandable) { e.stopPropagation(); toggle(row.id); } }}
                    >
                      {expandable && (expanded.has(row.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
                    </span>
                    {isMap ? <Network className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--editor-accent)' }} />
                      : external ? <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                      : node.kind === 'group' ? <FolderTree className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                      : missing ? <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#ef4444' }} />
                      : <File className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />}
                    <span
                      className="truncate"
                      style={missing ? { color: 'var(--app-text-muted)', textDecoration: 'line-through', textDecorationColor: '#ef4444' } : isMap ? { color: 'var(--app-text-primary)', fontWeight: 500 } : undefined}
                    >
                      {node.label}
                    </span>
                    {open && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--editor-accent)' }} title="Open in a tab" data-testid="map-row-open" />}
                    {external && <span className="ml-auto shrink-0 text-[9.5px]" style={{ color: 'var(--app-text-muted)' }}>external</span>}
                    {missing && <span className="ml-auto shrink-0 text-[9.5px]" style={{ color: '#ef4444' }}>{node.href ? 'missing' : 'key not defined'}</span>}
                    {unknown && <span className="ml-auto shrink-0 text-[9.5px]" style={{ color: '#f59e0b' }}>could not check</span>}
                    {isMap && !sub && <span className="ml-auto shrink-0 text-[9.5px]" style={{ color: '#f59e0b' }}>not read</span>}
                    {!missing && !unknown && !(isMap && !sub) && keyCount > 0 && (
                      <span className="ml-auto shrink-0 text-[9.5px] px-1.5 rounded-full" style={{ lineHeight: '14px', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-muted)' }}>{keyCount} key{keyCount === 1 ? '' : 's'}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => setKeysCollapsed(c => !c)} aria-expanded={!keysCollapsed} className="w-full h-[22px] mt-1.5 flex items-center gap-0.5 px-1 text-[11px] font-bold uppercase tracking-wide hover-app" style={{ color: 'var(--app-text-secondary)' }}>
            {keysCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}Keys
            <span className="ml-auto pr-1.5 font-medium normal-case tracking-normal text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{registry.keys.size}</span>
          </button>
          {!keysCollapsed && (
            <div data-testid="map-keys">
              <div className="mx-3 ml-[26px] my-1">
                <input value={keyFilter} onChange={e => setKeyFilter(e.target.value)} placeholder="Filter keys" aria-label="Filter keys" className="w-full h-[22px] rounded px-1.5 text-[11px] outline-none" style={{ backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-primary)' }} />
              </div>
              {keyRows.slice(0, KEYS_SHOWN).map(([name, def]) => (
                <div key={name} className="grid gap-x-2 px-3 pl-[26px] py-1 text-[11px] hover-app" style={{ gridTemplateColumns: 'minmax(80px, 1fr) minmax(70px, 1.2fr)' }} data-testid="map-key" title={`${name} → ${def.href ?? '(no href)'}`}>
                  <span className="font-mono truncate" style={{ color: 'var(--app-text-primary)' }}>{name}</span>
                  <span className="truncate" style={{ color: 'var(--app-text-muted)', direction: 'rtl', textAlign: 'left' }}>{def.href ?? '(no href)'}</span>
                  <span className="col-span-2 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>defined in {def.mapName}{def.scope ? ` (scope ${def.scope})` : ''}</span>
                </div>
              ))}
              {keyRows.length > KEYS_SHOWN && (
                <p className="px-3 pl-[26px] py-1 m-0 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>{keyRows.length - KEYS_SHOWN} more: type in the filter to narrow the list.</p>
              )}
              {keyRows.length === 0 && <p className="px-3 pl-[26px] py-1 m-0 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>No keys match.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
