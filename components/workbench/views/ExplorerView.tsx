import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Search, ChevronRight, ChevronDown, Folder, File, X, Loader2, AlertTriangle, FilePlus, FolderOpen, CloudUpload, Save, Upload, Printer, RefreshCw, Network, Keyboard } from 'lucide-react';
import { ViewHeader } from '../SidePanel';
import { Popover, MenuItem, MenuDivider } from '../Popover';
import { useFolderTree, type FolderTreeRow } from '../../../hooks/useFolderTree';
import type { HerettoSearchResult, HerettoSearchStatus } from '../../../types/heretto';

export interface ExplorerTab {
  id: string;
  name: string;
  dirty: boolean;
  pendingReview: boolean;
  /** The Heretto file's UUID when the tab is Heretto-backed; the tree highlights it. */
  herettoUuid: string | null;
}

/** ADR-017 decision 4: every command the retired header dropdowns offered, reachable without a menu bar (browser mode). */
export interface ExplorerCommands {
  onNewTopic: () => void;
  onOpenLocalFile: () => void;
  onOpenFromHeretto: () => void;
  onSaveToHeretto: () => void;
  /** The old File Options → Save: download the topic as a local .dita file. */
  onSaveLocalCopy: () => void;
  onReplace: () => void;
  onExportPdf: () => void;
  onConvertTopicType: () => void;
  onConnectMap: () => void;
  /** Present while a map is connected (ADR-013); the rows appear only then, as the retired dropdown's did. */
  connectedMapName: string | null;
  onReloadMap: () => void;
  onDisconnectMap: () => void;
  onKeyboardShortcuts: () => void;
}

/** The filename walk (ADR-013 amendment, v1.2.0: moved here from the browser dialog). */
export interface FilenameSearch {
  run: (query: string, folderUuid: string, signal: AbortSignal) => void;
  results: HerettoSearchResult[];
  status: HerettoSearchStatus;
  abortRef: React.MutableRefObject<AbortController | null>;
}

/** The folder a filename search starts from: the last folder the writer expanded, else the root. */
interface ScopeFolder { uuid: string; name: string; ancestorUuids: string[]; ancestorNames: string[] }

const FILENAME_DEBOUNCE_MS = 350;

interface ExplorerViewProps {
  tabs: ExplorerTab[];
  activeTabId: string;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  herettoConnected: boolean;
  rootUuid: string;
  host: string;
  /** Opens a topic exactly as the browser modal does (import verification, then a new tab). */
  onOpenTopic: (item: HerettoSearchResult) => void;
  filenameSearch: FilenameSearch;
  commands: ExplorerCommands;
}

/**
 * ADR-017 decision 5: FR-054's tree, built in the side panel. Open Editors on
 * top (dirty dot, review badge, close on hover), the lazy Heretto tree below,
 * and the `…` menu with every document command for the run mode without a
 * menu bar.
 */
export const ExplorerView = ({ tabs, activeTabId, onActivateTab, onCloseTab, herettoConnected, rootUuid, host, onOpenTopic, filenameSearch, commands }: ExplorerViewProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openEditorsCollapsed, setOpenEditorsCollapsed] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const tree = useFolderTree(herettoConnected ? rootUuid : '', host || 'Heretto');
  const run = (fn: () => void) => () => { setMenuOpen(false); fn(); };
  const activeHerettoUuid = tabs.find(t => t.id === activeTabId)?.herettoUuid ?? null;

  // "Search filenames in this folder": the walk the browser dialog used to run.
  const [fnOpen, setFnOpen] = useState(false);
  const [fnQuery, setFnQuery] = useState('');
  const [scopeFolder, setScopeFolder] = useState<ScopeFolder | null>(null);
  const fnInputRef = useRef<HTMLInputElement>(null);
  const fnScope: ScopeFolder = scopeFolder ?? { uuid: rootUuid, name: host || 'Heretto', ancestorUuids: [], ancestorNames: [] };
  const { run: runFilenameSearch, abortRef: fnAbortRef } = filenameSearch;
  useEffect(() => {
    if (!fnOpen || !fnQuery.trim() || !herettoConnected || !fnScope.uuid) { fnAbortRef.current?.abort(); return; }
    const t = setTimeout(() => {
      fnAbortRef.current?.abort();
      const ac = new AbortController();
      fnAbortRef.current = ac;
      setRanFor({ scope: fnScope, query: fnQuery.trim() });
      runFilenameSearch(fnQuery.trim(), fnScope.uuid, ac.signal);
    }, FILENAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // fnScope is rebuilt each render; its uuid is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnOpen, fnQuery, fnScope.uuid, herettoConnected, runFilenameSearch, fnAbortRef]);
  useEffect(() => () => fnAbortRef.current?.abort(), [fnAbortRef]);
  // The scope and query the hook's current results belong to (review finding 14): a result is shown and
  // opened only with the scope that produced it, never with a scope chosen since.
  const [ranFor, setRanFor] = useState<{ scope: ScopeFolder; query: string } | null>(null);
  const fnActive = fnOpen && fnQuery.trim().length > 0;
  const resultsCurrent = !!ranFor && ranFor.query === fnQuery.trim() && ranFor.scope.uuid === fnScope.uuid;

  /** A walk result is relative to the scope folder; give it the path and ancestors from the content root. */
  const openFilenameResult = (r: HerettoSearchResult) => {
    if (!ranFor) return;
    const scope = ranFor.scope;
    const isRoot = scope.uuid === rootUuid;
    onOpenTopic({
      ...r,
      path: isRoot ? r.path : [...scope.ancestorNames, scope.name, r.path].join('/'),
      ancestorUuids: isRoot ? r.ancestorUuids : [...scope.ancestorUuids, ...r.ancestorUuids],
    });
  };

  const openRow = (row: FolderTreeRow) => {
    if (row.item.type === 'folder') {
      if (!row.expanded) {
        setScopeFolder(row.depth === 0 ? null : { uuid: row.item.uuid, name: row.item.name, ancestorUuids: row.ancestorUuids, ancestorNames: row.ancestorNames });
      }
      tree.toggle(row.item.uuid);
      return;
    }
    onOpenTopic({
      ...row.item,
      path: [...row.ancestorNames, row.item.name].join('/'),
      ancestorUuids: row.ancestorUuids,
    });
  };

  const onRowKey = (e: React.KeyboardEvent, row: FolderTreeRow) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(row); }
    else if (e.key === 'ArrowRight' && row.item.type === 'folder' && !row.expanded) { e.preventDefault(); tree.toggle(row.item.uuid); }
    else if (e.key === 'ArrowLeft' && row.item.type === 'folder' && row.expanded) { e.preventDefault(); tree.toggle(row.item.uuid); }
  };

  return (
    <section id="view-explorer" className="flex-1 flex flex-col min-h-0" aria-label="Explorer view" data-testid="view-explorer">
      <ViewHeader
        title="Explorer"
        actions={
          <>
            <button
              ref={menuRef}
              onClick={() => setMenuOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              data-testid="explorer-menu-button"
              className="w-[22px] h-[22px] rounded flex items-center justify-center hover-app-text"
              style={{ color: 'var(--app-text-muted)' }}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuRef} placement="bottom-end" role="menu" ariaLabel="Explorer actions" width={240}>
              <MenuItem icon={<FilePlus />} label="New Topic…" shortcut="⌘N" onSelect={run(commands.onNewTopic)} />
              <MenuItem icon={<FolderOpen />} label="Open Local File…" shortcut="⌘O" onSelect={run(commands.onOpenLocalFile)} />
              <MenuItem icon={<FolderOpen />} label="Open from Heretto…" disabled={!herettoConnected} onSelect={run(commands.onOpenFromHeretto)} />
              <MenuDivider />
              <MenuItem icon={<CloudUpload />} label="Save to Heretto" shortcut="⌘S" disabled={!herettoConnected} onSelect={run(commands.onSaveToHeretto)} />
              <MenuItem icon={<Save />} label="Save Local Copy…" onSelect={run(commands.onSaveLocalCopy)} />
              <MenuItem icon={<Upload />} label="Replace in Heretto…" disabled={!herettoConnected} onSelect={run(commands.onReplace)} />
              <MenuDivider />
              <MenuItem icon={<Printer />} label="Export as PDF…" onSelect={run(commands.onExportPdf)} />
              <MenuItem icon={<RefreshCw />} label="Convert Topic Type…" onSelect={run(commands.onConvertTopicType)} />
              <MenuDivider />
              <MenuItem icon={<Network />} label={commands.connectedMapName ? 'Connect a different map…' : 'Connect a Map…'} disabled={!herettoConnected} onSelect={run(commands.onConnectMap)} />
              {commands.connectedMapName && (
                <>
                  <MenuItem icon={<RefreshCw />} label="Reload Map" onSelect={run(commands.onReloadMap)} />
                  <MenuItem icon={<X />} label={`Disconnect ${commands.connectedMapName}`} onSelect={run(commands.onDisconnectMap)} />
                </>
              )}
              <MenuItem icon={<Keyboard />} label="Keyboard Shortcuts" shortcut="⌘/" onSelect={run(commands.onKeyboardShortcuts)} />
            </Popover>
          </>
        }
      />

      {/* Open Editors */}
      <div className="shrink-0" data-testid="open-editors">
        <SectionHeader label="Open editors" count={tabs.length} collapsed={openEditorsCollapsed} onToggle={() => setOpenEditorsCollapsed(c => !c)} />
        {!openEditorsCollapsed && tabs.map(tab => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => onActivateTab(tab.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivateTab(tab.id); } }}
              className="h-[22px] flex items-center gap-1.5 pl-6 pr-1.5 text-xs cursor-pointer whitespace-nowrap group/row hover-app"
              style={active
                ? { backgroundColor: 'color-mix(in srgb, var(--editor-accent) 18%, transparent)', color: 'var(--app-text-primary)' }
                : { color: 'var(--app-text-secondary)' }}
              data-testid={`open-editor-${tab.id}`}
              aria-current={active ? 'true' : undefined}
            >
              <File className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
              <span className="truncate">{tab.name}</span>
              {tab.pendingReview && (
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} title="A proposed change awaits review" data-testid="open-editor-review-badge" />
              )}
              {!tab.pendingReview && tab.dirty && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--editor-accent)' }} title="Unsaved changes" />
              )}
              <button
                onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
                className="ml-auto w-[18px] h-[18px] rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover-text"
                style={{ color: 'var(--app-text-muted)' }}
                aria-label={`Close ${tab.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Heretto tree */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center">
          <div className="flex-1 min-w-0">
            <SectionHeader label="Heretto" hint={herettoConnected ? host : 'not connected'} collapsed={treeCollapsed} onToggle={() => setTreeCollapsed(c => !c)} />
          </div>
          {herettoConnected && (
            <button
              onClick={() => { setFnOpen(o => !o); if (fnOpen) setFnQuery(''); else setTimeout(() => fnInputRef.current?.focus(), 0); }}
              aria-pressed={fnOpen}
              aria-label="Search filenames in this folder"
              title="Search filenames in this folder"
              data-testid="explorer-filename-search"
              className="w-[22px] h-[22px] mr-1 rounded flex items-center justify-center shrink-0 hover-app-text"
              style={{ color: fnOpen ? 'var(--editor-accent)' : 'var(--app-text-muted)' }}
            >
              <Search className="w-3 h-3" />
            </button>
          )}
        </div>
        {fnOpen && !treeCollapsed && (
          <div className="px-2 pl-6 pb-1">
            <input
              ref={fnInputRef}
              value={fnQuery}
              onChange={e => setFnQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setFnOpen(false); setFnQuery(''); } }}
              placeholder={`Filename in ${fnScope.name}…`}
              aria-label={`Search filenames in ${fnScope.name}`}
              className="w-full h-[22px] rounded px-1.5 text-[11px] outline-none"
              style={{ backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--editor-accent)', color: 'var(--app-text-primary)' }}
            />
          </div>
        )}
        {fnActive && !treeCollapsed && (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar" data-testid="filename-results" aria-live="polite">
            <div className="px-4 py-1 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
              {!resultsCurrent
                ? 'Searching…'
                : filenameSearch.status.phase === 'searching'
                ? `Scanning folders… ${filenameSearch.status.foldersVisited} / ${filenameSearch.status.foldersTotal}`
                : `${filenameSearch.results.length} file${filenameSearch.results.length === 1 ? '' : 's'}`}
              {(filenameSearch.status.phase === 'searching' || filenameSearch.status.phase === 'done') && filenameSearch.status.foldersFailed > 0 && ` (${filenameSearch.status.foldersFailed} folder${filenameSearch.status.foldersFailed === 1 ? '' : 's'} could not be read)`}
            </div>
            {resultsCurrent && filenameSearch.results.map(r => (
              <button
                key={r.uuid}
                onClick={() => openFilenameResult(r)}
                className="w-full text-left pl-6 pr-2 py-0.5 hover-app"
                title={r.path}
                data-testid={`filename-result-${r.uuid}`}
              >
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--app-text-secondary)' }}><File className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} /><span className="truncate">{r.name}</span></div>
                <div className="pl-5 text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>{r.path}</div>
              </button>
            ))}
          </div>
        )}
        {!treeCollapsed && !fnActive && (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar" role="tree" aria-label="Heretto folders" data-testid="folder-tree">
            {!herettoConnected && (
              <p className="px-4 py-2 m-0 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                Connect to Heretto to browse its folders here.
              </p>
            )}
            {herettoConnected && tree.rows.map(row => {
              const isFolder = row.item.type === 'folder';
              const selected = !isFolder && row.item.uuid === activeHerettoUuid;
              return (
                <div
                  key={row.item.uuid}
                  role="treeitem"
                  aria-expanded={isFolder ? row.expanded : undefined}
                  aria-level={row.depth + 1}
                  aria-selected={selected || undefined}
                  tabIndex={0}
                  onClick={() => openRow(row)}
                  onKeyDown={e => onRowKey(e, row)}
                  className="h-[22px] flex items-center gap-1.5 pr-1.5 text-xs cursor-pointer whitespace-nowrap hover-app"
                  style={{
                    paddingLeft: 8 + row.depth * 12,
                    ...(selected
                      ? { backgroundColor: 'color-mix(in srgb, var(--editor-accent) 18%, transparent)', color: 'var(--app-text-primary)' }
                      : { color: 'var(--app-text-secondary)' }),
                  }}
                  data-testid={`tree-${row.item.uuid}`}
                >
                  <span className="w-4 flex items-center justify-center shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                    {isFolder && (row.children?.status === 'loading'
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : row.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
                  </span>
                  {isFolder ? <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} /> : <File className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />}
                  <span className="truncate">{row.item.name}</span>
                  {isFolder && row.expanded && row.children?.status === 'error' && (
                    <button
                      onClick={e => { e.stopPropagation(); tree.retry(row.item.uuid); }}
                      className="ml-auto flex items-center gap-1 text-[10px] hover-text"
                      style={{ color: '#f87171' }}
                      aria-label={`Retry listing ${row.item.name}`}
                    >
                      <AlertTriangle className="w-3 h-3" /> retry
                    </button>
                  )}
                  {isFolder && row.expanded && row.children?.status === 'ready' && row.children.items.length === 0 && (
                    <span className="ml-auto text-[10px]" style={{ color: 'var(--app-text-muted)' }}>empty</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

const SectionHeader = ({ label, count, hint, collapsed, onToggle }: { label: string; count?: number; hint?: string; collapsed: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    aria-expanded={!collapsed}
    className="w-full h-[22px] flex items-center gap-0.5 px-1 text-[11px] font-bold uppercase tracking-wide select-none hover-app"
    style={{ color: 'var(--app-text-secondary)' }}
  >
    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    <span>{label}</span>
    {count !== undefined && <span className="ml-auto pr-1.5 font-medium normal-case tracking-normal text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{count}</span>}
    {hint && <span className="ml-auto pr-1.5 font-medium normal-case tracking-normal text-[10px] truncate max-w-[55%]" style={{ color: 'var(--app-text-muted)' }}>{hint}</span>}
  </button>
);
