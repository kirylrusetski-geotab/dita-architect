import React, { useState, useEffect } from 'react';
import { Loader2, FileText, Folder, ChevronDown, Network, MapIcon } from 'lucide-react';
import type { HerettoItem } from '../types/heretto';
import { Modal } from './Modal';

const HerettoLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" opacity="0.15" />
    <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontWeight="800" fontSize="16" fontFamily="Inter, sans-serif">H</text>
  </svg>
);

/**
 * ADR-013 amendment (2026-11-18, v1.2.0): the browser is a picker. Finding a
 * topic is the Explorer's and the Search view's job; this dialog picks where to
 * save a new file (`save`) or which file to replace (`replace`), one folder at a
 * time through the breadcrumb.
 */
export type HerettoPickerMode = 'save' | 'replace';

interface HerettoBrowserModalProps {
  mode: HerettoPickerMode;
  /** FR-062: the configured content-root folder UUID (from ~/heretto.json). */
  rootUuid: string;
  breadcrumbs: { uuid: string; name: string }[];
  setBreadcrumbs: React.Dispatch<React.SetStateAction<{ uuid: string; name: string }[]>>;
  selected: HerettoItem | null;
  setSelected: React.Dispatch<React.SetStateAction<HerettoItem | null>>;
  browsing: boolean;
  items: HerettoItem[];
  navigate: (uuid: string, name: string, replace?: boolean) => Promise<void>;
  /** Replace mode: the file chosen as the target. */
  onPick: (item: HerettoItem) => void;
  saveFileName: string;
  setSaveFileName: (name: string) => void;
  saving: boolean;
  onSaveNew: (folderUuid: string) => void;
  onClose: () => void;
  isLastSavedLocation?: boolean;
  onBrowseFromRoot?: () => void;
}

const fileIcon = (name: string) =>
  name.endsWith('.sitemap') ? <Network className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
    : name.endsWith('.ditamap') ? <MapIcon className="w-4 h-4 shrink-0" style={{ color: '#8b5cf6' }} />
    : <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--app-text-muted)' }} />;

export const HerettoBrowserModal = ({
  mode,
  rootUuid,
  breadcrumbs,
  setBreadcrumbs,
  selected,
  setSelected,
  browsing,
  items,
  navigate,
  onPick,
  saveFileName,
  setSaveFileName,
  saving,
  onSaveNew,
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

  const currentFolderUuid = breadcrumbs[breadcrumbs.length - 1]?.uuid ?? rootUuid;
  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name ?? 'Heretto';

  return (
  <Modal onClose={onClose} labelId="heretto-browser-title" className="rounded-xl p-6 w-[520px] max-h-[80vh] flex flex-col shadow-2xl">
      <div className="mb-1">
        <h3 id="heretto-browser-title" className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--app-text-primary)' }}>
          <HerettoLogo className="w-5 h-5" style={{ color: '#14b8a6' }} />
          {mode === 'save' ? 'Save to Heretto' : 'Replace in Heretto'}
        </h3>
      </div>
      <p className="text-xs mb-3 mt-0" style={{ color: 'var(--app-text-muted)' }}>
        {mode === 'save'
          ? 'Choose a folder and a file name.'
          : 'Choose the file this topic replaces.'}{' '}
        To find a topic by its text, use Search in the side panel.
      </p>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs mb-3 flex-wrap" style={{ color: 'var(--app-text-muted)' }} aria-label="Folder path">
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

      {/* P2-25: Last save location indicator */}
      {mode === 'save' && isLastSavedLocation && (
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--app-text-muted)' }}>
          <span>Last save location</span>
          <span>&middot;</span>
          <button onClick={onBrowseFromRoot} className="hover:underline transition-colors" style={{ color: 'var(--editor-accent)' }}>
            Browse from root
          </button>
        </div>
      )}

      {/* Folder listing */}
      <div
        className="flex-1 overflow-y-auto rounded-lg border min-h-[200px] max-h-[400px]"
        style={{ backgroundColor: 'var(--app-surface-raised)', borderColor: 'var(--app-border-subtle)' }}
        data-testid="picker-listing"
      >
        {browsing ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--editor-accent)' }} />
            <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Loading your Heretto folders…</span>
            {showBrowseRetry && (
              <button onClick={() => navigate(currentFolderUuid, currentFolderName, true)} className="text-xs underline" style={{ color: 'var(--editor-accent)' }}>
                Taking too long? Retry
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12 text-sm" style={{ color: 'var(--app-text-muted)' }}>
            This folder is empty
          </div>
        ) : (
          items.map(item => {
            const isFolder = item.type === 'folder';
            // Save mode lists files for orientation only; Replace picks one.
            const pickable = !isFolder && mode === 'replace';
            return (
              <button
                key={item.uuid}
                onClick={() => {
                  if (isFolder) navigate(item.uuid, item.name);
                  else if (pickable) setSelected(prev => (prev?.uuid === item.uuid ? null : item));
                }}
                onDoubleClick={() => { if (pickable) onPick(item); }}
                disabled={!isFolder && !pickable}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors heretto-item disabled:cursor-default"
                style={{
                  borderBottom: '1px solid var(--app-border-subtle)',
                  color: !isFolder && !pickable ? 'var(--app-text-muted)' : 'var(--app-text-secondary)',
                  backgroundColor: selected?.uuid === item.uuid ? 'var(--app-hover)' : 'transparent',
                }}
                onMouseEnter={e => { if (selected?.uuid !== item.uuid && (isFolder || pickable)) e.currentTarget.style.backgroundColor = 'var(--app-hover)'; }}
                onMouseLeave={e => { if (selected?.uuid !== item.uuid) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {isFolder ? <Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--editor-accent)' }} /> : fileIcon(item.name)}
                <span className="truncate">{item.name}</span>
                {isFolder && <ChevronDown className="w-3 h-3 -rotate-90 ml-auto shrink-0" style={{ color: 'var(--app-text-muted)' }} />}
              </button>
            );
          })
        )}
      </div>

      {/* Save mode: filename input */}
      {mode === 'save' && (
        <div className="mt-3">
          <label htmlFor="heretto-save-name" className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-secondary)' }}>
            File name
          </label>
          <input
            id="heretto-save-name"
            autoFocus
            type="text"
            value={saveFileName}
            onChange={e => setSaveFileName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
            style={{ backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-primary)' }}
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
          style={{ backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-secondary)' }}
        >
          Cancel
        </button>
        {mode === 'replace' ? (
          <button
            onClick={() => { if (selected && selected.type === 'file') onPick(selected); }}
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
