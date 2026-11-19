import React, { useEffect, useRef, useState } from 'react';
import { X, Lock, Check, Copy, Upload, Download, Trash2, RotateCcw, ChevronDown, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import {
  APPEARANCE_GROUPS, APPEARANCE_VARS, type AppearanceGroup, type AppearanceVar,
} from '../constants/appearance-vars';
import {
  THEME_OPTIONS, SYNTAX_THEME_OPTIONS, THEME_VALUES, syntaxModeMismatch, syntaxThemeLabel, themeLabel,
  parseColour, withAlpha, isValidValue, BUILT_IN_PROFILES, builtInDescription, builtInId,
  type AppearanceProfile, type ThemeName, type SyntaxThemeName,
} from '../lib/appearance';
import type { AppearanceApi } from '../hooks/useAppearance';
import { saveTextFile, safeFileName } from '../lib/native-file';
import { SYNTAX_RULES, MONACO_BG } from '../lib/monaco-themes';

interface AppearanceDrawerProps {
  appearance: AppearanceApi;
  onClose: () => void;
}

type Notice = { kind: 'error' | 'ok'; title: string; detail?: string[] } | null;

const valueOf = (p: AppearanceProfile, v: AppearanceVar): string => p.overrides[v] ?? THEME_VALUES[p.base][v];

const btn = 'h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover-btn disabled:opacity-45 disabled:pointer-events-none';
const btnStyle: React.CSSProperties = { backgroundColor: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', color: 'var(--app-btn-text)' };
const primaryStyle: React.CSSProperties = { backgroundColor: '#0284c7', border: '1px solid #0284c7', color: '#fff' };
const inputStyle: React.CSSProperties = { backgroundColor: 'var(--app-surface-raised)', border: '1px solid var(--app-border-subtle)', color: 'var(--app-text-primary)' };

/** Three swatches that stand for a profile in the list: chrome, page, accent. */
const Dots = ({ p }: { p: AppearanceProfile }) => (
  <span className="flex shrink-0" aria-hidden="true">
    {(['--app-surface', '--editor-page-bg', '--editor-accent'] as const).map((v, i) => (
      <i key={v} className="block w-[9px] h-4" style={{ background: valueOf(p, v), borderRadius: i === 0 ? '3px 0 0 3px' : i === 2 ? '0 3px 3px 0' : undefined }} />
    ))}
  </span>
);

/**
 * One variable: a colour picker (keeping any alpha) plus a text field, or a
 * text field alone for the page shadow and border. The text field shows the
 * effective value; a value that fails the check is marked and not applied.
 */
const VarRow = ({ p, name, label, kind, readOnly, onSet }: {
  p: AppearanceProfile; name: AppearanceVar; label: string; kind: 'color' | 'shadow' | 'border'; readOnly: boolean;
  onSet: (value: string | null) => boolean;
}) => {
  const value = valueOf(p, name);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const bad = draft !== null && !isValidValue(name, draft);
  const changed = p.overrides[name] !== undefined;
  const colour = kind === 'color' ? parseColour(value) : null;
  const commit = (text: string) => {
    if (onSet(text)) setDraft(null);
  };
  return (
    <div className="grid items-center gap-2 px-2.5 py-[5px]" style={{ gridTemplateColumns: '26px 1fr 132px 22px', borderTop: '1px solid var(--app-border)' }} data-var={name}>
      {kind === 'color' ? (
        <span className="relative w-6 h-6 rounded-[5px] overflow-hidden" style={{ border: '1px solid var(--app-border-subtle)', backgroundImage: 'linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%),linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px' }}>
          <i className="absolute inset-0" style={{ background: value }} />
          {colour && (
            <input
              type="color"
              aria-label={`${label} colour`}
              disabled={readOnly}
              value={colour.hex}
              onChange={e => { setDraft(null); onSet(withAlpha(e.target.value, colour.alpha)); }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
            />
          )}
        </span>
      ) : (
        <span className="w-6 h-6 rounded-[5px] grid place-items-center text-[10px]" title="Not a colour: type a CSS value" style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)', color: 'var(--app-text-muted)' }}>Aa</span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium truncate" style={{ color: 'var(--app-text-secondary)' }}>
          <span className="truncate">{label}</span>
          {changed && <i className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--editor-accent)' }} aria-label="changed" />}
        </span>
        <span className="block text-[9.5px] font-mono truncate" style={{ color: 'var(--app-text-muted)' }}>{name}</span>
      </span>
      <input
        aria-label={`${label} value`}
        aria-invalid={bad || undefined}
        readOnly={readOnly}
        value={shown}
        spellCheck={false}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== null) commit(draft); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); if (draft !== null) commit(draft); }
          if (e.key === 'Escape' && draft !== null) { e.stopPropagation(); setDraft(null); }
        }}
        title={bad ? 'Not a valid value for this setting. Nothing was changed.' : undefined}
        className="h-6 px-1.5 rounded text-[10.5px] font-mono outline-none w-full"
        style={{ ...inputStyle, borderColor: bad ? '#ef4444' : inputStyle.border as string }}
      />
      <button
        aria-label={`Reset ${label}`}
        title={`Reset to ${themeLabel(p.base)}'s value: ${THEME_VALUES[p.base][name]}`}
        onClick={() => { setDraft(null); onSet(null); }}
        className="w-[22px] h-[22px] grid place-items-center rounded hover-app"
        style={{ color: 'var(--app-text-muted)', visibility: changed && !readOnly ? 'visible' : 'hidden' }}
      >
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  );
};

/** The XML split as this profile will colour it: Monaco's own tables (lib/monaco-themes.ts), not a copy. */
const XmlPreview = ({ p }: { p: AppearanceProfile }) => {
  const syn = SYNTAX_RULES[p.syntaxTheme];
  const tok = (t: string) => `#${syn.rules.find(r => r.token === t)?.foreground ?? syn.foreground}`;
  const c = { fg: `#${syn.foreground}`, tag: tok('tag'), an: tok('attribute.name'), av: tok('attribute.value'), cm: tok('comment'), dl: tok('delimiter') };
  const D = ({ children }: { children: React.ReactNode }) => <span style={{ color: c.dl }}>{children}</span>;
  const T = ({ children }: { children: React.ReactNode }) => <span style={{ color: c.tag }}>{children}</span>;
  return (
    <div aria-label={`XML preview in ${syntaxThemeLabel(p.syntaxTheme)}`} className="rounded-md px-2.5 py-2 font-mono text-[11px] leading-[1.55] mb-3.5 whitespace-pre overflow-hidden" style={{ backgroundColor: MONACO_BG[p.base].bg, color: c.fg, border: '1px solid var(--app-border-subtle)' }}>
      <span style={{ color: c.cm, fontStyle: 'italic' }}>{'<!-- XML split preview -->'}</span>{'\n'}
      <D>{'<'}</D><T>task</T> <span style={{ color: c.an }}>id</span><D>=</D><span style={{ color: c.av }}>"managing_zone_types"</span><D>{'>'}</D>{'\n'}
      {'  '}<D>{'<'}</D><T>title</T><D>{'>'}</D>Managing zone types<D>{'</'}</D><T>title</T><D>{'>'}</D>{'\n'}
      {'  '}<D>{'<'}</D><T>cmd</T><D>{'>'}</D>Select <D>{'<'}</D><T>uicontrol</T><D>{'>'}</D>Add<D>{'</'}</D><T>uicontrol</T><D>{'></'}</D><T>cmd</T><D>{'>'}</D>{'\n'}
      <D>{'</'}</D><T>task</T><D>{'>'}</D>
    </div>
  );
};

/**
 * ADR-018 decision 9 / FR-073 — the Appearance drawer. Modal for focus and
 * Escape, but not dimmed: it docks on the right under the title row so the app
 * itself is the live preview. Clicking a profile switches to it; every edit
 * applies at once through `useAppearance`.
 */
export const AppearanceDrawer = ({ appearance, onClose }: AppearanceDrawerProps) => {
  const { active: p, state } = appearance;
  const [filter, setFilter] = useState('');
  const [onlyChangedSetting, setOnlyChanged] = useState(false);
  const [open, setOpen] = useState<Record<AppearanceGroup, boolean>>(() => Object.fromEntries(APPEARANCE_GROUPS.map((g, i) => [g, i === 0])) as Record<AppearanceGroup, boolean>);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const ro = p.builtIn;
  // Review finding: on a built-in (no overrides, the box disabled) "Changed only" would hide every row.
  const onlyChanged = onlyChangedSetting && !ro;
  // The name field is a draft committed on Enter, blur, or closing the drawer (review: Escape
  // unmounts the input without a blur), and it follows the stored name, which a rename that
  // collides changes ("Light" → "Light 2").
  const [nameDraft, setNameDraft] = useState(p.name);
  useEffect(() => { setNameDraft(p.name); }, [p.id, p.name]);
  const commitName = () => {
    if (ro) return;
    if (nameDraft.trim() && nameDraft !== p.name) appearance.update(p.id, { name: nameDraft });
    else setNameDraft(p.name);
  };
  const close = () => { commitName(); onClose(); };
  const changedCount = Object.keys(p.overrides).length;

  const select = (id: string) => { setNotice(null); setConfirmDelete(false); appearance.selectProfile(id); };
  const duplicate = () => {
    setNotice(null);
    if (appearance.duplicate(p.id)) setTimeout(() => { nameRef.current?.focus(); nameRef.current?.select(); }, 0);
  };
  const doExport = () => {
    const text = appearance.exportText(p.id);
    if (!text) return;
    const how = saveTextFile(safeFileName(p.name, '.json'), text);
    setNotice({ kind: 'ok', title: how === 'native' ? `Choose where to save ${p.name}.` : `Exported ${p.name}.` });
  };
  const doImport = async (file: File) => {
    const res = appearance.importText(await file.text());
    setNotice(res.ok
      ? { kind: 'ok', title: `Imported ${res.profile.name} from ${file.name} and switched to it.` }
      : { kind: 'error', title: `Couldn't import ${file.name}. Nothing was imported.`, detail: res.errors });
  };
  const doDelete = () => {
    const name = p.name;
    appearance.remove(p.id);
    setConfirmDelete(false);
    const fallback = BUILT_IN_PROFILES.find(b => b.id === builtInId(p.base))!;
    setNotice({ kind: 'ok', title: `Deleted ${name}. You're on ${fallback.name}.` });
  };

  const q = filter.trim().toLowerCase();
  const rowsFor = (g: AppearanceGroup) => APPEARANCE_VARS.filter(v => v.group === g
    && (!onlyChanged || p.overrides[v.name] !== undefined)
    && (!q || `${v.label} ${v.name}`.toLowerCase().includes(q)));
  const mine = state.profiles;

  const row = (x: AppearanceProfile) => {
    const isActive = x.id === p.id;
    return (
      <button
        key={x.id}
        role="option"
        aria-selected={isActive}
        onClick={() => select(x.id)}
        title={builtInDescription(x) ?? undefined}
        className="w-full h-[30px] px-2 rounded-md flex items-center gap-2 text-xs font-medium text-left hover-app"
        style={{ color: isActive ? 'var(--app-text-primary)' : 'var(--app-text-secondary)', backgroundColor: isActive ? 'color-mix(in srgb, var(--editor-accent) 16%, transparent)' : undefined }}
      >
        <Dots p={x} />
        <span className="flex-1 truncate">{x.name}</span>
        {isActive ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--editor-accent)' }} /> : x.builtIn ? <Lock className="w-3 h-3" style={{ color: 'var(--app-text-muted)' }} /> : null}
      </button>
    );
  };

  return (
    <Modal
      onClose={close}
      labelId="appearance-title"
      overlayClassName="fixed inset-0 z-50"
      className="absolute top-[34px] right-0 bottom-0 flex flex-col"
      style={{ width: 600, maxWidth: '100vw', borderTop: 0, borderRight: 0, borderBottom: 0, boxShadow: '-18px 0 40px rgba(0,0,0,0.28)' }}
    >
      <header className="h-[50px] shrink-0 flex items-center gap-2.5 pl-[18px] pr-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
        <h4 id="appearance-title" className="text-sm font-bold m-0" style={{ color: 'var(--app-text-primary)' }}>Appearance</h4>
        <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Changes show in the app as you make them.</span>
        <button onClick={close} aria-label="Close appearance" className="ml-auto w-7 h-7 rounded-md grid place-items-center hover-app" style={{ color: 'var(--app-text-muted)' }}>
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-[178px] shrink-0 flex flex-col" style={{ backgroundColor: 'var(--app-bg)', borderRight: '1px solid var(--app-border)' }}>
          <div className="flex-1 overflow-y-auto px-1.5 py-2.5" role="listbox" aria-label="Profiles">
            <h6 className="text-[10px] font-bold uppercase tracking-wider mx-2 mt-2 mb-1.5" style={{ color: 'var(--app-text-muted)' }}>Defaults</h6>
            {BUILT_IN_PROFILES.map(row)}
            <h6 className="text-[10px] font-bold uppercase tracking-wider mx-2 mt-3.5 mb-1.5" style={{ color: 'var(--app-text-muted)' }}>Mine</h6>
            {mine.length ? mine.map(row) : <p className="mx-2 my-1 text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>None yet. Duplicate a profile to start one.</p>}
          </div>
          <div className="shrink-0 flex flex-col gap-1.5 p-2.5" style={{ borderTop: '1px solid var(--app-border)' }}>
            <button className={btn} style={btnStyle} onClick={duplicate}><Copy className="w-3.5 h-3.5" />Duplicate</button>
            <button className={btn} style={btnStyle} onClick={() => fileRef.current?.click()}><Upload className="w-3.5 h-3.5" />Import…</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="appearance-import-input"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void doImport(f); }}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-[18px] py-4">
            {notice && (
              <div role={notice.kind === 'error' ? 'alert' : 'status'} className="flex gap-2.5 px-3 py-2.5 rounded-lg text-[11.5px] leading-normal mb-3" style={{ border: `1px solid ${notice.kind === 'error' ? 'rgba(239,68,68,.35)' : 'rgba(16,185,129,.35)'}`, backgroundColor: notice.kind === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', color: 'var(--app-text-primary)' }}>
                {notice.kind === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-px" style={{ color: '#ef4444' }} /> : <CheckCircle className="w-4 h-4 shrink-0 mt-px" style={{ color: '#10b981' }} />}
                <div>
                  <div className="font-semibold">{notice.title}</div>
                  {notice.detail && <ul className="m-0 mt-1 pl-4">{notice.detail.map((d, i) => <li key={i}>{d.charAt(0).toUpperCase() + d.slice(1)}.</li>)}</ul>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3.5">
              <h5 className="text-[15px] font-bold m-0 truncate" style={{ color: 'var(--app-text-primary)' }}>{p.name}</h5>
              <span className="text-[10px] font-semibold px-2 py-px rounded-full inline-flex items-center gap-1" style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)', color: 'var(--app-text-muted)' }}>
                {ro && <Lock className="w-2.5 h-2.5" />}{ro ? 'Built-in' : 'My profile'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-px rounded-full" style={{ border: '1px solid var(--app-border-subtle)', color: 'var(--editor-accent)' }}>In use</span>
            </div>

            {ro && (
              <div className="flex gap-2.5 px-3 py-2.5 rounded-lg text-[11.5px] leading-normal mb-3.5" style={{ border: '1px solid var(--app-border-subtle)', backgroundColor: 'var(--app-surface-raised)' }}>
                <Info className="w-4 h-4 shrink-0 mt-px" style={{ color: 'var(--editor-accent)' }} />
                <div>{builtInDescription(p)}. Built-in profiles can't be changed, so an update to the app can improve them without overwriting your work. <b>Duplicate</b> this one to make your own copy, then change anything.</div>
              </div>
            )}

            {!ro && (
              <div className="flex flex-col gap-1.5 mb-3">
                <label htmlFor="appearance-name" className="text-[11px] font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Name</label>
                <input
                  ref={nameRef}
                  id="appearance-name"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={e => { if (e.key === 'Enter') commitName(); }}
                  className="h-[30px] px-2.5 rounded-md text-xs outline-none"
                  style={inputStyle}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5 mb-3">
                <label htmlFor="appearance-base" className="text-[11px] font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Start from</label>
                <select id="appearance-base" disabled={ro} value={p.base} onChange={e => appearance.update(p.id, { base: e.target.value as ThemeName })} className="h-[30px] px-2 rounded-md text-xs" style={inputStyle}>
                  {THEME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                <label htmlFor="appearance-syntax" className="text-[11px] font-semibold" style={{ color: 'var(--app-text-secondary)' }}>XML syntax theme</label>
                <select id="appearance-syntax" disabled={ro} value={p.syntaxTheme} onChange={e => appearance.update(p.id, { syntaxTheme: e.target.value as SyntaxThemeName })} className="h-[30px] px-2 rounded-md text-xs" style={inputStyle}>
                  {SYNTAX_THEME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}{o.mode === 'light' ? ' (light)' : ''}</option>)}
                </select>
              </div>
            </div>
            {syntaxModeMismatch(p.base, p.syntaxTheme) && (
              <p className="flex gap-2 items-start text-[11px] leading-snug -mt-1 mb-3" style={{ color: '#f59e0b' }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                {p.base === 'light'
                  ? `${syntaxThemeLabel(p.syntaxTheme)} is a dark syntax theme on the Light base: the XML split will be dark while the page is light.`
                  : `${syntaxThemeLabel(p.syntaxTheme)} is a light syntax theme on a dark base: the XML split will be light while the page is dark.`}
              </p>
            )}
            <XmlPreview p={p} />

            <div className="flex gap-2 items-center mt-1 mb-2">
              <input aria-label="Filter colours" placeholder="Filter colours" value={filter} onChange={e => setFilter(e.target.value)} className="flex-1 h-7 px-2.5 rounded-md text-xs outline-none" style={inputStyle} />
              <label className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap" style={{ color: 'var(--app-text-muted)' }}>
                <input type="checkbox" checked={onlyChanged} disabled={ro} onChange={e => setOnlyChanged(e.target.checked)} />Changed only
              </label>
            </div>

            {APPEARANCE_GROUPS.map(g => {
              const rows = rowsFor(g);
              if (!rows.length) return null;
              const total = APPEARANCE_VARS.filter(v => v.group === g).length;
              const changed = APPEARANCE_VARS.filter(v => v.group === g && p.overrides[v.name] !== undefined).length;
              const isOpen = q !== '' || onlyChanged || open[g];
              return (
                <div key={g} className="rounded-lg mb-2 overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                  <button
                    aria-expanded={isOpen}
                    onClick={() => setOpen(o => ({ ...o, [g]: !o[g] }))}
                    className="w-full h-8 px-2.5 flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: 'var(--app-text-primary)', backgroundColor: 'var(--app-surface-raised)' }}
                  >
                    <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: 'var(--app-text-muted)', transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
                    {g}
                    <span className="ml-auto text-[10px] font-semibold" style={{ color: changed ? 'var(--editor-accent)' : 'var(--app-text-muted)' }}>{changed ? `${changed} changed · ` : ''}{total}</span>
                  </button>
                  {isOpen && rows.map(v => (
                    <VarRow key={`${p.id}:${v.name}`} p={p} name={v.name} label={v.label} kind={v.kind} readOnly={ro} onSet={value => appearance.setOverride(p.id, v.name, value)} />
                  ))}
                </div>
              );
            })}
          </div>

          {confirmDelete && (
            <div className="flex items-center gap-2 px-3 py-2 text-[11.5px]" role="alertdialog" aria-label={`Delete ${p.name}`} style={{ borderTop: '1px solid var(--app-border)', backgroundColor: 'rgba(239,68,68,.06)', color: 'var(--app-text-primary)' }}>
              <Trash2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#ef4444' }} />
              <span className="flex-1">Delete <b>{p.name}</b>? This can't be undone. Export it first to keep a copy.</span>
              <button className={btn} style={btnStyle} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className={btn} style={{ ...btnStyle, color: '#ef4444' }} onClick={doDelete} autoFocus>Delete</button>
            </div>
          )}

          <footer className="shrink-0 flex flex-wrap items-center gap-2 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--app-border)' }}>
            {ro ? (
              <>
                <button className={btn} style={btnStyle} onClick={doExport}><Download className="w-3.5 h-3.5" />Export…</button>
                <span className="flex-1" />
                <button className={btn} style={primaryStyle} onClick={duplicate}><Copy className="w-3.5 h-3.5" />Duplicate to edit</button>
              </>
            ) : (
              <>
                <button className={btn} style={btnStyle} disabled={changedCount === 0} onClick={() => appearance.resetOverrides(p.id)}>
                  <RotateCcw className="w-3.5 h-3.5" />Reset to {themeLabel(p.base)}{changedCount ? ` (${changedCount})` : ''}
                </button>
                <button className={btn} style={btnStyle} onClick={doExport}><Download className="w-3.5 h-3.5" />Export…</button>
                <button className={btn} style={{ ...btnStyle, color: '#ef4444' }} onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" />Delete</button>
                <span className="flex-1" />
                <button className={btn} style={primaryStyle} onClick={close}>Done</button>
              </>
            )}
          </footer>
        </div>
      </div>
    </Modal>
  );
};
