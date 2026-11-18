import React from 'react';
import { BookOpen, FilePlus, X } from 'lucide-react';

export interface TitleBarTab {
  id: string;
  name: string;
  dirty: boolean;
  /** W3: an amber badge while an API proposal awaits review in this tab. */
  pendingReview: boolean;
}

interface TitleBarProps {
  version: string;
  tabs: TitleBarTab[];
  activeTabId: string;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onOpenReleaseNotes: () => void;
}

/**
 * ADR-017 decision 1: the 34 px title row — brand, version pill, and the tab
 * strip that used to be a second bar under a 64 px header. The two header
 * dropdowns are gone (decision 4); their commands live in the menu bar, the
 * rail popovers and the Explorer `…` menu.
 */
export const TitleBar = ({ version, tabs, activeTabId, onActivateTab, onCloseTab, onNewTab, onOpenReleaseNotes }: TitleBarProps) => (
  <div
    className="h-[34px] flex items-stretch shrink-0 relative"
    style={{ backgroundColor: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)', zIndex: 30 }}
    data-testid="title-bar"
  >
    <div className="flex items-center gap-2 pl-3.5 pr-3 shrink-0" style={{ borderRight: '1px solid var(--app-border-subtle)' }}>
      <div className="w-[18px] h-[18px] rounded-[5px] bg-gradient-to-br from-dita-500 to-dita-600 flex items-center justify-center">
        <BookOpen className="text-white w-3 h-3" />
      </div>
      <h1 className="text-[13px] font-bold tracking-tight whitespace-nowrap m-0" style={{ color: 'var(--app-text-primary)' }}>
        DITA <span className="text-dita-500">Architect</span>
      </h1>
      <button
        onClick={onOpenReleaseNotes}
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors cursor-pointer hover-app"
        style={{ color: 'var(--app-text-muted)', backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)' }}
        aria-label="View release notes"
      >
        v{version}
      </button>
    </div>

    <div className="flex items-end flex-1 min-w-0 overflow-x-auto tab-bar-no-scrollbar" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Open documents">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className="flex items-center gap-1.5 pl-3 pr-1 h-[32px] text-xs font-medium cursor-pointer select-none shrink-0 max-w-[180px] group/tab"
            style={{
              backgroundColor: isActive ? 'var(--editor-canvas-bg)' : 'transparent',
              borderTop: isActive ? '2px solid var(--editor-accent)' : '2px solid transparent',
              borderRight: '1px solid var(--app-border-subtle)',
              color: isActive ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
              marginBottom: isActive ? '-1px' : '0',
            }}
            onClick={() => onActivateTab(tab.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivateTab(tab.id); } }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--app-hover)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {tab.pendingReview ? (
              <span
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 0 2px var(--app-surface)' }}
                title="A proposed change awaits review"
                data-testid="tab-review-badge"
              />
            ) : tab.dirty ? (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--editor-accent)' }} title="Unsaved changes" />
            ) : null}
            <span className="truncate">{tab.name}</span>
            <button
              className="p-0.5 rounded opacity-0 group-hover/tab:opacity-100 focus:opacity-100 transition-opacity ml-auto shrink-0 hover-text"
              style={{ color: 'var(--app-text-muted)' }}
              onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
              title="Close tab"
              aria-label={`Close ${tab.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      <button
        className="flex items-center justify-center w-[34px] h-[32px] shrink-0 transition-colors hover-app-text"
        style={{ color: 'var(--app-text-muted)' }}
        onClick={onNewTab}
        title="New tab"
        aria-label="New tab"
      >
        <FilePlus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);
