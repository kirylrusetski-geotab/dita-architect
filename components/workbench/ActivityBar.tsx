import React, { useRef, useState } from 'react';
import { SquareTerminal, Settings, RefreshCw, Loader2, FolderOpen, CloudUpload, Upload, X, Keyboard, Gift, Palette, SlidersHorizontal } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { Popover, MenuItem, MenuDivider, MenuHeading } from './Popover';
import { VIEW_META } from './panel-registry';
import { VIEW_IDS, type ViewId } from '../../lib/workbench-layout';

export interface HerettoRailProps {
  connected: boolean;
  checking: boolean;
  host: string;
  email: string;
  rootUuid: string;
  onTest: () => void;
  onOpenCredentials: () => void;
  onOpenFromHeretto: () => void;
  onSave: () => void;
  onReplace: () => void;
  /** Disconnect the active tab from its Heretto file; absent when the tab has none. */
  onDisconnect: (() => void) | null;
}

/** ADR-018 decision 9: the gear menu is Settings… · Appearance… · Keyboard Shortcuts · What's New. */
export interface SettingsRailProps {
  version: string;
  onOpenSettings: () => void;
  onOpenAppearance: () => void;
  /** The active appearance profile's name, shown beside Appearance…. */
  profileName: string;
  onKeyboardShortcuts: () => void;
  onReleaseNotes: () => void;
}

interface ActivityBarProps {
  activeView: ViewId;
  sidePanelOpen: boolean;
  onFocusView: (view: ViewId) => void;
  heretto: HerettoRailProps;
  settings: SettingsRailProps;
}

const shortId = (uuid: string): string => (uuid.length > 14 ? `${uuid.slice(0, 8)}…${uuid.slice(-4)}` : uuid);

/**
 * ADR-017 decisions 1 and 6: the 48 px activity bar. Views on top (click the
 * active one and the side panel collapses, VS Code style); at the bottom the
 * Sessions slot (a traced terminal until FR-078 fills it), the Heretto
 * connection (grey H disconnected, green circle + white H connected) and the
 * Settings gear. Each bottom item opens a `Popover`.
 */
export const ActivityBar = ({ activeView, sidePanelOpen, onFocusView, heretto, settings }: ActivityBarProps) => {
  const [openPop, setOpenPop] = useState<'sessions' | 'heretto' | 'settings' | null>(null);
  const sessionsRef = useRef<HTMLButtonElement>(null);
  const herettoRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);

  const toggle = (which: 'sessions' | 'heretto' | 'settings') => {
    setOpenPop(prev => (prev === which ? null : which));
  };
  const close = () => { setOpenPop(null); };
  const run = (fn: () => void) => () => { close(); fn(); };

  return (
    <nav
      className="w-12 shrink-0 flex flex-col"
      style={{ backgroundColor: 'var(--app-surface)', borderRight: '1px solid var(--app-border)' }}
      aria-label="Views"
      data-testid="activity-bar"
    >
      <div role="tablist" aria-orientation="vertical" aria-label="Views">
        {VIEW_IDS.map(id => {
          const meta = VIEW_META[id];
          const Icon = meta.icon;
          const active = id === activeView && sidePanelOpen;
          return (
            <Tooltip key={id} content={`${meta.title} (${meta.shortcut})`} placement="right">
              <button
                role="tab"
                aria-selected={active}
                aria-controls={`view-${id}`}
                data-testid={`activity-${id}`}
                onClick={() => onFocusView(id)}
                className="w-12 h-12 flex items-center justify-center transition-colors hover-text"
                style={{
                  color: active ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                  borderLeft: `2px solid ${active ? 'var(--editor-accent)' : 'transparent'}`,
                  borderRight: '2px solid transparent',
                }}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={1.6} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col">
        {/* Sessions (FR-078 placeholder) */}
        <Tooltip content="Sessions: none connected" placement="right">
          <button
            ref={sessionsRef}
            onClick={() => toggle('sessions')}
            aria-haspopup="dialog"
            aria-expanded={openPop === 'sessions'}
            aria-label="Sessions: none connected"
            data-testid="activity-sessions"
            className="w-12 h-12 flex items-center justify-center hover-text"
            style={{ color: 'var(--app-text-muted)', opacity: 0.75 }}
          >
            <SquareTerminal className="w-[22px] h-[22px]" strokeWidth={1.6} strokeDasharray="3 2.2" />
          </button>
        </Tooltip>

        {/* Heretto connection */}
        <Tooltip content={heretto.connected ? 'Heretto: connected' : 'Heretto: not connected'} placement="right">
          <button
            ref={herettoRef}
            onClick={() => toggle('heretto')}
            aria-haspopup="dialog"
            aria-expanded={openPop === 'heretto'}
            aria-label={heretto.connected ? 'Heretto: connected' : 'Heretto: not connected'}
            data-testid="activity-heretto"
            data-connected={heretto.connected}
            className="w-12 h-12 flex items-center justify-center"
          >
            <span
              className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-extrabold text-[15px] transition-colors"
              style={heretto.connected
                ? { backgroundColor: '#10b981', color: '#ffffff', border: '1px solid #10b981' }
                : { backgroundColor: 'var(--app-hover)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border-subtle)' }}
            >
              H
            </span>
          </button>
        </Tooltip>

        {/* Settings */}
        <Tooltip content="Settings" placement="right">
          <button
            ref={settingsRef}
            onClick={() => toggle('settings')}
            aria-haspopup="menu"
            aria-expanded={openPop === 'settings'}
            aria-label="Settings"
            data-testid="activity-settings"
            className="w-12 h-12 flex items-center justify-center hover-text"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <Settings className="w-[22px] h-[22px]" strokeWidth={1.6} />
          </button>
        </Tooltip>
      </div>

      <Popover open={openPop === 'sessions'} onClose={close} anchorRef={sessionsRef} placement="right-end" role="dialog" ariaLabel="Sessions" width={260}>
        <MenuHeading>Sessions</MenuHeading>
        <div className="px-3 py-1.5 font-medium" style={{ color: 'var(--app-text-secondary)' }}>No sessions connected</div>
        <p className="px-3 pb-2 m-0 text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
          A terminal (Claude Code, GIA) can join as a named member in v1.6.0. Its suggestions appear in the visual editor as tracked changes, marked <code>ai-authored</code>.
        </p>
      </Popover>

      <Popover open={openPop === 'heretto'} onClose={close} anchorRef={herettoRef} placement="right-end" role="dialog" ariaLabel="Heretto connection" width={280}>
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 font-semibold" style={{ color: 'var(--app-text-primary)' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: heretto.connected ? '#10b981' : '#ef4444' }} />
          {heretto.connected ? 'Connected' : 'Not connected'}
        </div>
        <dl className="grid gap-x-3 gap-y-1 px-3 pb-2 m-0" style={{ gridTemplateColumns: '64px 1fr' }}>
          <dt style={{ color: 'var(--app-text-muted)' }}>Host</dt>
          <dd className="m-0 font-medium truncate" style={{ color: 'var(--app-text-primary)' }}>{heretto.host || '—'}</dd>
          <dt style={{ color: 'var(--app-text-muted)' }}>Account</dt>
          <dd className="m-0 font-medium truncate" style={{ color: 'var(--app-text-primary)' }}>{heretto.email || '—'}</dd>
          <dt style={{ color: 'var(--app-text-muted)' }}>Root</dt>
          <dd className="m-0 font-mono text-[11px] truncate" style={{ color: 'var(--app-text-primary)' }} title={heretto.rootUuid}>{heretto.rootUuid ? shortId(heretto.rootUuid) : '—'}</dd>
        </dl>
        <div className="flex gap-1.5 px-3 pb-2">
          <button
            onClick={heretto.onTest}
            disabled={heretto.checking}
            className="h-[26px] px-2.5 rounded text-xs font-medium flex items-center gap-1.5 hover-btn disabled:opacity-50"
            style={{ backgroundColor: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', color: 'var(--app-btn-text)' }}
          >
            {heretto.checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Test connection
          </button>
          <button
            onClick={run(heretto.onOpenCredentials)}
            className="h-[26px] px-2.5 rounded text-xs font-medium hover-btn"
            style={{ backgroundColor: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', color: 'var(--app-btn-text)' }}
          >
            Credentials…
          </button>
        </div>
        <MenuDivider />
        <MenuItem icon={<FolderOpen />} label="Open from Heretto…" disabled={!heretto.connected} onSelect={run(heretto.onOpenFromHeretto)} />
        <MenuItem icon={<CloudUpload />} label="Save to Heretto" shortcut="⌘S" disabled={!heretto.connected} onSelect={run(heretto.onSave)} />
        <MenuItem icon={<Upload />} label="Replace existing…" disabled={!heretto.connected} onSelect={run(heretto.onReplace)} />
        {heretto.onDisconnect && (
          <>
            <MenuDivider />
            <MenuItem icon={<X />} label="Disconnect this tab from Heretto" onSelect={run(heretto.onDisconnect)} />
          </>
        )}
      </Popover>

      <Popover open={openPop === 'settings'} onClose={close} anchorRef={settingsRef} placement="right-end" role="menu" ariaLabel="Settings" width={250}>
        <MenuItem icon={<SlidersHorizontal />} label="Settings…" shortcut="⌘," onSelect={run(settings.onOpenSettings)} />
        <MenuItem
          icon={<Palette />}
          label="Appearance…"
          trailing={<span className="text-[11px] truncate max-w-[90px]" style={{ color: 'var(--app-text-muted)' }}>{settings.profileName}</span>}
          onSelect={run(settings.onOpenAppearance)}
        />
        <MenuDivider />
        <MenuItem icon={<Keyboard />} label="Keyboard Shortcuts" shortcut="⌘/" onSelect={run(settings.onKeyboardShortcuts)} />
        <MenuItem icon={<Gift />} label={`What's New in v${settings.version}`} onSelect={run(settings.onReleaseNotes)} />
      </Popover>
    </nav>
  );
};
