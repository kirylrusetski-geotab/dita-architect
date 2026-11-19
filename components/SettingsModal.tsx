import React, { useState } from 'react';
import { SlidersHorizontal, Palette, KeyRound, Keyboard, Info, X, RefreshCw, Loader2, Gift } from 'lucide-react';
import { Modal } from './Modal';
import { HerettoCredentialsForm, type HerettoCredentials } from './HerettoCredentialsForm';
import { ShortcutList } from './ShortcutList';
import { SETTINGS_PAGES, type EditorSettings, type SettingsPage } from '../lib/settings';
import { syntaxThemeLabel, themeLabel, type AppearanceProfile } from '../lib/appearance';

const PAGE_ICONS: Record<SettingsPage, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  general: SlidersHorizontal, appearance: Palette, heretto: KeyRound, shortcuts: Keyboard, about: Info,
};

interface SettingsModalProps {
  page: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
  onClose: () => void;
  editor: EditorSettings;
  onEditorChange: (patch: Partial<EditorSettings>) => void;
  /** Resets the editor options and the layout; profiles and credentials are kept. */
  onRestoreDefaults: () => void;
  profile: AppearanceProfile;
  onOpenAppearance: () => void;
  heretto: {
    connected: boolean;
    checking: boolean;
    credentials: HerettoCredentials;
    setCredentials: React.Dispatch<React.SetStateAction<HerettoCredentials>>;
    onTest: () => void;
    onSave: () => void;
  };
  version: string;
  onOpenReleaseNotes: () => void;
}

const Switch = ({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="relative w-[34px] h-5 shrink-0 rounded-full mt-0.5 transition-colors"
    style={{ backgroundColor: checked ? '#0284c7' : 'var(--app-border-subtle)' }}
  >
    <span
      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
      style={{ transform: checked ? 'translateX(14px)' : 'none' }}
    />
  </button>
);

const Row = ({ title, help, children }: { title: string; help: React.ReactNode; children?: React.ReactNode }) => (
  <div className="flex items-start gap-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
    <div className="flex-1">
      <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--app-text-primary)' }}>{title}</div>
      <div className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{help}</div>
    </div>
    {children}
  </div>
);

const GroupTitle = ({ children }: { children: React.ReactNode }) => (
  <h5 className="text-[11px] font-bold uppercase tracking-wider mb-1 mt-0" style={{ color: 'var(--app-text-muted)' }}>{children}</h5>
);

const btn = 'h-7 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap hover-btn disabled:opacity-50';
const btnStyle: React.CSSProperties = { backgroundColor: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', color: 'var(--app-btn-text)' };

/**
 * ADR-018 decision 9 / FR-074 — the Settings modal: General, Appearance (a
 * summary and the door to the drawer), Heretto (the credentials form, moved
 * here from the retired HerettoStatusModal), Keyboard Shortcuts, About. Editor
 * options apply as they change; credentials are written on Save credentials.
 */
export const SettingsModal = ({
  page, onPageChange, onClose, editor, onEditorChange, onRestoreDefaults, profile, onOpenAppearance, heretto, version, onOpenReleaseNotes,
}: SettingsModalProps) => {
  const [confirmRestore, setConfirmRestore] = useState(false);
  const current = SETTINGS_PAGES.find(p => p.id === page)!;
  const overrideCount = Object.keys(profile.overrides).length;

  return (
    <Modal onClose={onClose} labelId="settings-title" className="rounded-xl shadow-2xl flex overflow-hidden" style={{ width: 760, height: 540, maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 32px)' }}>
      <nav className="w-[190px] shrink-0 flex flex-col gap-0.5 px-2 py-3.5" style={{ backgroundColor: 'var(--app-bg)', borderRight: '1px solid var(--app-border)' }} aria-label="Settings sections">
        <h3 id="settings-title" className="text-[13px] font-bold mx-2 mb-2.5" style={{ color: 'var(--app-text-primary)' }}>Settings</h3>
        <div role="tablist" aria-orientation="vertical" aria-label="Settings sections" className="flex flex-col gap-0.5">
          {SETTINGS_PAGES.map(p => {
            const Icon = PAGE_ICONS[p.id];
            const selected = p.id === page;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={selected}
                aria-controls="settings-page"
                onClick={() => onPageChange(p.id)}
                className="h-[30px] px-2.5 rounded-md text-xs font-medium flex items-center gap-2 text-left hover-app"
                style={{
                  color: selected ? 'var(--app-text-primary)' : 'var(--app-text-secondary)',
                  backgroundColor: selected ? 'color-mix(in srgb, var(--editor-accent) 16%, transparent)' : undefined,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: selected ? 'var(--editor-accent)' : 'var(--app-text-muted)' }} />
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <p className="text-[10px] leading-relaxed px-2.5 m-0" style={{ color: 'var(--app-text-muted)' }}>
          Options apply as you change them. Heretto credentials are saved when you select Save credentials.
        </p>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[50px] shrink-0 flex items-center justify-between pl-[22px] pr-[18px]" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <h4 className="text-sm font-bold m-0" style={{ color: 'var(--app-text-primary)' }}>{current.label}</h4>
          <button onClick={onClose} aria-label="Close settings" className="w-7 h-7 rounded-md flex items-center justify-center hover-app" style={{ color: 'var(--app-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div id="settings-page" role="tabpanel" aria-label={current.label} className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          {page === 'general' && (
            <>
              <GroupTitle>Editor</GroupTitle>
              <Row title="Open the XML split when a topic opens" help="Off: topics open with the XML closed, and you open it with ⌘\ or the XML icon on the right rail. On: every topic you open shows its XML beside the page.">
                <Switch checked={editor.openXmlTrayOnLoad} label="Open the XML split when a topic opens" onChange={v => onEditorChange({ openXmlTrayOnLoad: v })} />
              </Row>
              <Row title="Wrap long lines in the XML" help="The same setting as the wrap button in the XML split's toolbar.">
                <Switch checked={editor.wordWrap} label="Wrap long lines in the XML" onChange={v => onEditorChange({ wordWrap: v })} />
              </Row>
              <Row title="Show the sync hint" help="The one-time tip that explains how the page and the XML stay in sync. Turn it on to see it again.">
                <Switch checked={editor.showSyncHint} label="Show the sync hint" onChange={v => onEditorChange({ showSyncHint: v })} />
              </Row>
              <div className="mt-5" />
              <GroupTitle>Reset</GroupTitle>
              <Row title="Restore default settings" help="Resets the editor options and the layout (panels, widths, the active view). Your appearance profiles and Heretto credentials are kept.">
                {confirmRestore ? (
                  <div className="flex gap-1.5">
                    <button className={btn} style={btnStyle} onClick={() => setConfirmRestore(false)}>Cancel</button>
                    <button className={btn} style={{ ...btnStyle, color: '#ef4444' }} onClick={() => { setConfirmRestore(false); onRestoreDefaults(); }}>Restore</button>
                  </div>
                ) : (
                  <button className={btn} style={btnStyle} onClick={() => setConfirmRestore(true)}>Restore defaults…</button>
                )}
              </Row>
            </>
          )}

          {page === 'appearance' && (
            <>
              <div className="flex items-center gap-3.5 p-3.5 rounded-[10px] mb-3" style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)' }}>
                <div className="flex shrink-0" aria-hidden="true">
                  {(['--app-bg', '--editor-page-bg', '--editor-accent'] as const).map((v, i) => (
                    <i key={v} className="block w-[18px] h-[34px]" style={{ background: `var(${v})`, borderRadius: i === 0 ? '6px 0 0 6px' : i === 2 ? '0 6px 6px 0' : undefined }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--app-text-primary)' }}>{profile.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    {profile.builtIn ? 'Built-in' : 'My profile'} · {themeLabel(profile.base)} base · {syntaxThemeLabel(profile.syntaxTheme)} syntax
                    {overrideCount > 0 && ` · ${overrideCount} changed`}
                  </div>
                </div>
                <button className={btn} style={{ backgroundColor: '#0284c7', border: '1px solid #0284c7', color: '#fff' }} onClick={onOpenAppearance}>Edit appearance…</button>
              </div>
              <Row title="Profiles" help="A profile is one look: an app theme to start from, the colours you changed, and the XML syntax theme. The six built-in profiles can't be changed; duplicate one to make your own. Export a profile to back it up or share it as a JSON file." />
            </>
          )}

          {page === 'heretto' && (
            <>
              <div
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold mb-4"
                role="status"
                style={{
                  backgroundColor: heretto.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${heretto.connected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: heretto.connected ? '#10b981' : '#ef4444',
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: heretto.connected ? '#10b981' : '#ef4444' }} />
                <span className="flex-1">{heretto.connected ? `Connected${heretto.credentials.host ? ` to ${heretto.credentials.host}` : ''}` : 'Not connected'}</span>
                <button className={btn} style={btnStyle} onClick={heretto.onTest} disabled={heretto.checking}>
                  {heretto.checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Test
                </button>
              </div>
              <HerettoCredentialsForm credentials={heretto.credentials} setCredentials={heretto.setCredentials} autoFocus={false} />
              <div className="flex justify-end">
                <button
                  onClick={heretto.onSave}
                  disabled={heretto.checking}
                  className="h-8 px-4 rounded-lg text-xs font-medium bg-dita-600 hover:bg-dita-500 text-white transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {heretto.checking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save credentials
                </button>
              </div>
            </>
          )}

          {page === 'shortcuts' && (
            <>
              <ShortcutList />
              <p className="text-[11px] mt-3.5 mb-0" style={{ color: 'var(--app-text-muted)' }}>The same list ⌘/ opens. Shortcuts can't be changed yet.</p>
            </>
          )}

          {page === 'about' && (
            <>
              <Row title={`DITA Architect ${version}`} help="A DITA editor for Heretto CMS. Built by Kiryl Rusetski. All rights reserved.">
                <button className={btn} style={btnStyle} onClick={onOpenReleaseNotes}><Gift className="w-3.5 h-3.5" />What's New</button>
              </Row>
              <Row title="Where your settings live" help="In this app's storage on this computer: one settings object, version 1. The native app and the browser version keep separate settings; export an appearance profile to move it between them." />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
