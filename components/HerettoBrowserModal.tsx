import React, { useState, useEffect } from 'react';
import { Loader2, FileText, Folder, ChevronDown, Network, MapIcon, Search, XCircle } from 'lucide-react';
import type { HerettoItem, HerettoSearchResult, HerettoSearchStatus } from '../types/heretto';
import { HERETTO_ROOT_UUID } from '../constants/heretto';
import { Modal } from './Modal';

const HerettoLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" opacity="0.15" />
    <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontWeight="800" fontSize="16" fontFamily="Inter, sans-serif">H</text>
  </svg>
);

interface HerettoBrowserModalProps {
  mode: 'open' | 'save' | 'replace';
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  breadcrumbs: { uuid: string; name: string }[];
  setBreadcrumbs: React.Dispatch<React.SetStateAction<{ uuid: string; name: string }[]>>;
  searchAbortRef: React.MutableRefObject<AbortController | null>;
  search: (query: string, rootUuid: string, signal: AbortSignal) => void;
  searchStatus: HerettoSearchStatus;
  setSearchStatus: React.Dispatch<React.SetStateAction<HerettoSearchStatus>>;
  searchResults: HerettoSearchResult[];
  selected: (HerettoItem | HerettoSearchResult) | null;
  setSelected: React.Dispatch<React.SetStateAction<(HerettoItem | HerettoSearchResult) | null>>;
  browsing: boolean;
  items: HerettoItem[];
  navigate: (uuid: string, name: string, replace?: boolean) => Promise<void>;
  onOpen: (item: HerettoItem | HerettoSearchResult) => void;
  saveFileName: string;
  setSaveFileName: (name: string) => void;
  saving: boolean;
  onSaveNew: (folderUuid: string) => void;
  onCreateNew?: () => void;
  onClose: () => void;
  isLastSavedLocation?: boolean;
  onBrowseFromRoot?: () => void;
}

export const HerettoBrowserModal = ({
  mode,
  searchQuery,
  setSearchQuery,
  breadcrumbs,
  setBreadcrumbs,
  searchAbortRef,
  search,
  searchStatus,
  setSearchStatus,
  searchResults,
  selected,
  setSelected,
  browsing,
  items,
  navigate,
  onOpen,
  saveFileName,
  setSaveFileName,
  saving,
  onSaveNew,
  onCreateNew,
  onClose,
  isLastSavedLocation,
  onBrowseFromRoot,
}: HerettoBrowserModalProps) => {
  const [showBrowseRetry, setShowBrowseRetry] = useState(false);

  useEffect(() => {
    if (!browsing) { setShowBrowseRetry(false); return; }
    const timer = setTimeout(() => setShowBrowseRetry(true), 3000);
    return () => clearTimeout(timer);
  }, [browsing]);

  const currentFolderUuid = breadcrumbs[breadcrumbs.length - 1]?.uuid ?? HERETTO_ROOT_UUID;
  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name ?? 'Heretto';

  return (
  <Modal onClose={onClose} labelId="heretto-browser-title" className="rounded-xl p-6 w-[520px] max-h-[80vh] flex flex-col shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 id="heretto-browser-title" className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--app-text-primary)' }}>
          <HerettoLogo className="w-5 h-5" style={{ color: '#14b8a6' }} />
          {mode === 'open' ? 'Open from Heretto' : mode === 'save' ? 'Save to Heretto' : 'Replace in Heretto'}
        </h3>
      </div>

      {/* Search input */}
      {(mode === 'open' || mode === 'replace') && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              breadcrumbs.length > 1
                ? `Search in ${breadcrumbs[breadcrumbs.length - 1].name}…`
                : 'Search all files…'
            }
            aria-label={mode === 'replace' ? 'Search files to replace' : 'Search files to open'}
            className="w-full pl-9 pr-9 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border-subtle)',
              color: 'var(--app-text-primary)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover-text"
              style={{ color: 'var(--app-text-muted)' }}
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Scope indicator — when searching from a subfolder */}
      {searchQuery.trim() && breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--app-text-muted)' }}>
          <span>Searching in {breadcrumbs.slice(1).map(b => b.name).join('/')}</span>
          <span>&middot;</span>
          <button
            onClick={() => {
              searchAbortRef.current?.abort();
              const abort = new AbortController();
              searchAbortRef.current = abort;
              setSearchQuery(searchQuery); // keep the query
              search(searchQuery.trim(), HERETTO_ROOT_UUID, abort.signal);
            }}
            className="hover:underline transition-colors"
            style={{ color: 'var(--editor-accent)' }}
          >
            Search all
          </button>
        </div>
      )}

      {/* Search progress bar */}
      {searchStatus.phase === 'searching' && (
        <div className="mb-3" aria-live="polite">
          <div className="w-full h-1.5 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: 'var(--app-surface-raised)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(5, Math.round((searchStatus.foldersVisited / Math.max(1, searchStatus.foldersTotal)) * 100))}%`,
                backgroundColor: 'var(--editor-accent)',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--app-text-muted)' }}>
            <span>Scanning folders… {searchStatus.foldersVisited} / {searchStatus.foldersTotal}{searchStatus.foldersFailed > 0 ? ` (${searchStatus.foldersFailed} failed)` : ''}</span>
            <button
              onClick={() => {
                searchAbortRef.current?.abort();
                setSearchStatus({ phase: 'cancelled', foldersVisited: searchStatus.foldersVisited });
              }}
              className="hover:underline transition-colors"
              style={{ color: 'var(--editor-accent)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumbs — hide when searching */}
      {!searchQuery.trim() && (
        <div className="flex items-center gap-1 text-xs mb-3 flex-wrap" style={{ color: 'var(--app-text-muted)' }}>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.uuid}>
              {idx > 0 && <span>/</span>}
              <button
                onClick={() => {
                  setBreadcrumbs(prev => prev.slice(0, idx + 1));
                  navigate(crumb.uuid, crumb.name, true).then(() => {
                    setBreadcrumbs(prev => prev.slice(0, idx + 1));
                  });
                }}
                className="hover:underline transition-colors px-1 py-0.5 rounded hover-app"
                style={{ color: idx === breadcrumbs.length - 1 ? 'var(--app-text-primary)' : 'var(--app-text-muted)' }}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* P2-25: Last save location indicator */}
      {mode === 'save' && isLastSavedLocation && !searchQuery.trim() && (
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--app-text-muted)' }}>
          <span>Last save location</span>
          <span>&middot;</span>
          <button
            onClick={onBrowseFromRoot}
            className="hover:underline transition-colors"
            style={{ color: 'var(--editor-accent)' }}
          >
            Browse from root
          </button>
        </div>
      )}

      {/* File list / Search results */}
      <div
        className="flex-1 overflow-y-auto rounded-lg border min-h-[200px] max-h-[400px]"
        style={{
          backgroundColor: 'var(--app-surface-raised)',
          borderColor: 'var(--app-border-subtle)',
        }}
      >
        {searchQuery.trim() ? (
          // Search results mode
          <>
            {searchResults.length === 0 && searchStatus.phase === 'done' && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                <span>No results found</span>
                {searchStatus.foldersFailed > 0 && (
                  <span className="mt-1 text-xs" style={{ color: 'var(--app-text-error, #ef4444)' }}>
                    {searchStatus.foldersFailed} folder{searchStatus.foldersFailed !== 1 ? 's' : ''} could not be searched
                  </span>
                )}
              </div>
            )}
            {searchResults.length === 0 && searchStatus.phase === 'cancelled' && (
              <div className="flex items-center justify-center h-full py-12 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                Search cancelled — 0 results
              </div>
            )}
            {searchResults.length === 0 && (searchStatus.phase === 'searching' || searchStatus.phase === 'idle') && (
              <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--editor-accent)' }} />
                <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  {searchStatus.phase === 'searching' && searchStatus.foldersTotal > 0
                    ? `Searching… ${searchStatus.foldersVisited} / ${searchStatus.foldersTotal} folders`
                    : 'Searching your Heretto files…'}
                </span>
              </div>
            )}
            {searchResults.map(item => (
              <button
                key={item.uuid}
                onClick={() => setSelected(prev => prev?.uuid === item.uuid ? null : item)}
                onDoubleClick={() => onOpen(item)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors heretto-item"
                style={{
                  borderBottom: '1px solid var(--app-border-subtle)',
                  color: 'var(--app-text-secondary)',
                  backgroundColor: selected?.uuid === item.uuid ? 'var(--app-hover)' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (selected?.uuid !== item.uuid) e.currentTarget.style.backgroundColor = 'var(--app-hover)';
                }}
                onMouseLeave={e => {
                  if (selected?.uuid !== item.uuid) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {item.name.endsWith('.sitemap') ? (
                  <Network className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
                ) : item.name.endsWith('.ditamap') ? (
                  <MapIcon className="w-4 h-4 shrink-0" style={{ color: '#8b5cf6' }} />
                ) : (
                  <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.name}</div>
                  <div className="truncate text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>{item.path}</div>
                </div>
              </button>
            ))}
            {searchResults.length > 0 && searchStatus.phase === 'cancelled' && (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                Search cancelled — {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} so far
              </div>
            )}
            {searchResults.length > 0 && searchStatus.phase === 'done' && (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                {searchStatus.foldersFailed > 0 && (
                  <span style={{ color: 'var(--app-text-error, #ef4444)' }}>
                    {' '}({searchStatus.foldersFailed} folder{searchStatus.foldersFailed !== 1 ? 's' : ''} failed)
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          // Normal browse mode
          <>
            {browsing ? (
              <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--editor-accent)' }} />
                <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Loading your Heretto folders…</span>
                {showBrowseRetry && (
                  <button
                    onClick={() => navigate(currentFolderUuid, currentFolderName, true)}
                    className="text-xs underline"
                    style={{ color: 'var(--editor-accent)' }}
                  >
                    Taking too long? Retry
                  </button>
                )}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                <div className="mb-4">No topics in this folder</div>
                {onCreateNew && (
                  <button
                    onClick={onCreateNew}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors"
                  >
                    Create new topic
                  </button>
                )}
              </div>
            ) : (
              items.map(item => (
                <button
                  key={item.uuid}
                  onClick={() => {
                    if (item.type === 'folder') {
                      navigate(item.uuid, item.name);
                    } else {
                      setSelected(prev => prev?.uuid === item.uuid ? null : item);
                    }
                  }}
                  onDoubleClick={() => {
                    if (item.type === 'folder') return;
                    if (mode === 'open') onOpen(item);
                  }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors heretto-item"
                  style={{
                    borderBottom: '1px solid var(--app-border-subtle)',
                    color: 'var(--app-text-secondary)',
                    backgroundColor: selected?.uuid === item.uuid ? 'var(--app-hover)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (selected?.uuid !== item.uuid) e.currentTarget.style.backgroundColor = 'var(--app-hover)';
                  }}
                  onMouseLeave={e => {
                    if (selected?.uuid !== item.uuid) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {item.type === 'folder' ? (
                    <Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--editor-accent)' }} />
                  ) : item.name.endsWith('.sitemap') ? (
                    <Network className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
                  ) : item.name.endsWith('.ditamap') ? (
                    <MapIcon className="w-4 h-4 shrink-0" style={{ color: '#8b5cf6' }} />
                  ) : (
                    <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                  )}
                  <span className="truncate">{item.name}</span>
                  {item.type === 'folder' && (
                    <ChevronDown className="w-3 h-3 -rotate-90 ml-auto shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                  )}
                </button>
              ))
            )}
          </>
        )}
      </div>

      {/* Save mode: filename input */}
      {mode === 'save' && (
        <div className="mt-3">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-secondary)' }}>
            File name
          </label>
          <input
            type="text"
            value={saveFileName}
            onChange={e => setSaveFileName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
            style={{
              backgroundColor: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border-subtle)',
              color: 'var(--app-text-primary)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--editor-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--app-border-subtle)')}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
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
        {mode === 'open' ? (
          <button
            onClick={() => { if (selected && selected.type === 'file') onOpen(selected as HerettoItem | HerettoSearchResult); }}
            disabled={!selected || selected.type === 'folder'}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Open
          </button>
        ) : mode === 'replace' ? (
          <button
            onClick={() => { if (selected && selected.type === 'file') onOpen(selected as HerettoItem | HerettoSearchResult); }}
            disabled={!selected || selected.type === 'folder'}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Select Target
          </button>
        ) : (
          <button
            onClick={() => {
              const currentFolder = breadcrumbs[breadcrumbs.length - 1];
              if (currentFolder) onSaveNew(currentFolder.uuid);
            }}
            disabled={saving || !saveFileName.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save here
          </button>
        )}
      </div>
  </Modal>
  );
};
