/**
 * ADR-018 — appearance profiles as data.
 *
 * A profile is one look: an app theme to start from (`base`, one of the six
 * `[data-theme]` blocks in index.css), the colours changed on top of it
 * (`overrides`, keyed by the registry in constants/appearance-vars.ts), and the
 * XML split's syntax theme. The six themes are read-only built-in profiles;
 * custom profiles are made by Duplicate or Import and live in the settings
 * store (lib/settings.ts). Everything here is pure except `applyProfile`, which
 * writes `data-theme` and the overrides onto an element (the app passes
 * `<html>`, so portals and `body` get the theme too).
 */
import cssText from '../index.css?raw';
import {
  APPEARANCE_VAR_NAMES,
  appearanceVarDef,
  isAppearanceVar,
  type AppearanceVar,
} from '../constants/appearance-vars';

// ---------------------------------------------------------------------------
// The theme and syntax-theme names (their one home since v1.3.0; the Toolbar
// and Monaco import them from here).
// ---------------------------------------------------------------------------

export const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'claude', label: 'Claude' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'navy', label: 'Navy' },
] as const;

export type ThemeName = typeof THEME_OPTIONS[number]['value'];

export const THEME_DESCRIPTIONS: Record<ThemeName, string> = {
  dark: 'High contrast for low-light work',
  light: 'Comfortable for extended daytime use',
  claude: 'Familiar Claude.ai colors',
  nord: 'Muted arctic palette for focus',
  solarized: 'Reduced eye strain color science',
  navy: 'Deep blue-navy palette for low-light work',
};

export const SYNTAX_THEME_OPTIONS = [
  { value: 'material',   label: 'Material',   mode: 'dark'  },
  { value: 'github',     label: 'GitHub',     mode: 'dark'  },
  { value: 'monokai',    label: 'Monokai',    mode: 'dark'  },
  { value: 'dracula',    label: 'Dracula',    mode: 'dark'  },
  { value: 'one-dark',   label: 'One Dark',   mode: 'dark'  },
  { value: 'catppuccin', label: 'Catppuccin', mode: 'dark'  },
  { value: 'daylight',   label: 'Daylight',   mode: 'light' },
] as const;

export type SyntaxThemeName = typeof SYNTAX_THEME_OPTIONS[number]['value'];

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === 'string' && THEME_OPTIONS.some(o => o.value === v);
}

export function isSyntaxThemeName(v: unknown): v is SyntaxThemeName {
  return typeof v === 'string' && SYNTAX_THEME_OPTIONS.some(o => o.value === v);
}

export const themeLabel = (t: ThemeName): string => THEME_OPTIONS.find(o => o.value === t)!.label;
export const syntaxThemeLabel = (t: SyntaxThemeName): string => SYNTAX_THEME_OPTIONS.find(o => o.value === t)!.label;

/**
 * FR-061: map a stored theme preference to a valid ThemeName. The "geotab"
 * theme was renamed "navy" in v0.9.7; a stored `geotab` resolves to `navy` so
 * existing users keep their palette. Anything unrecognised falls back to dark.
 */
export function resolveStoredTheme(stored: string | null): ThemeName {
  if (stored === 'geotab') return 'navy';
  return isThemeName(stored) ? stored : 'dark';
}

/**
 * A light syntax theme on a dark base, or a dark one on the Light base: the
 * XML split then contrasts with the page. Allowed, but the drawer says so.
 */
export function syntaxModeMismatch(base: ThemeName, syntax: SyntaxThemeName): boolean {
  const light = SYNTAX_THEME_OPTIONS.find(o => o.value === syntax)!.mode === 'light';
  return light !== (base === 'light');
}

// ---------------------------------------------------------------------------
// The base values: read from index.css itself (decision 3), never copied.
// ---------------------------------------------------------------------------

export type ThemeValues = Record<AppearanceVar, string>;

/** The six theme blocks of a stylesheet's text: `:root` is Dark, `[data-theme="x"]` is x. */
export function parseThemeBlocks(css: string): Record<ThemeName, ThemeValues> {
  const out = {} as Record<ThemeName, ThemeValues>;
  for (const m of css.matchAll(/(:root|\[data-theme="(\w+)"\])\s*\{([^}]*)\}/g)) {
    const name = m[2] ?? 'dark';
    if (!isThemeName(name)) continue;
    const vars = {} as ThemeValues;
    for (const d of m[3].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      if (isAppearanceVar(d[1])) vars[d[1]] = d[2].trim();
    }
    out[name] = vars;
  }
  return out;
}

export const THEME_VALUES: Record<ThemeName, ThemeValues> = parseThemeBlocks(cssText);

// ---------------------------------------------------------------------------
// The value check (decision 4).
// ---------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUM = String.raw`\s*-?\d*\.?\d+%?\s*`;
const RGB = new RegExp(String.raw`^rgba?\((?:${NUM},){2}${NUM}(?:,${NUM})?\)$`, 'i');
const HSL = new RegExp(String.raw`^hsla?\((?:${NUM},){2}${NUM}(?:,${NUM})?\)$`, 'i');
/** The characters a box-shadow or border shorthand needs (lengths, colours, `var(--x)`, keywords). */
const SHORTHAND = /^[\w\s#().,%-]+$/;
const FORBIDDEN = /url\(|expression\(|[;{}<>\\]|\/\*/i;

export function isValidValue(name: AppearanceVar, value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 300 || FORBIDDEN.test(v)) return false;
  if (appearanceVarDef(name).kind === 'color') return HEX.test(v) || RGB.test(v) || HSL.test(v) || v === 'transparent';
  return SHORTHAND.test(v);
}

/** A colour as the native picker needs it (`#rrggbb`) plus any alpha to keep; null when the picker cannot show it. */
export function parseColour(value: string): { hex: string; alpha: string | null } | null {
  const s = value.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return { hex: '#' + m[1].split('').map(c => c + c).join('').toLowerCase(), alpha: null };
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return { hex: s.toLowerCase(), alpha: null };
  // #rrggbbaa (the value check accepts it): the picker shows the colour, the alpha is kept.
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (m) return { hex: `#${m[1].toLowerCase()}`, alpha: String(Math.round((Number.parseInt(m[2], 16) / 255) * 100) / 100) };
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    const hex = '#' + [m[1], m[2], m[3]].map(n => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
    return { hex, alpha: m[4] ?? null };
  }
  return null;
}

/** The picker's `#rrggbb` written back, keeping the alpha the value had. */
export function withAlpha(hex: string, alpha: string | null): string {
  if (alpha === null) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Profiles.
// ---------------------------------------------------------------------------

export type Overrides = Partial<Record<AppearanceVar, string>>;

export interface AppearanceProfile {
  id: string;
  name: string;
  base: ThemeName;
  syntaxTheme: SyntaxThemeName;
  overrides: Overrides;
  builtIn: boolean;
}

/** The persisted half: which profile is active, and the custom profiles (built-ins are never stored). */
export interface AppearanceState {
  activeProfileId: string;
  profiles: AppearanceProfile[];
}

/** Light pairs with Daylight (the one light syntax theme); the other five with Material (Kiryl, 2026-11-19). */
export const BUILT_IN_SYNTAX: Record<ThemeName, SyntaxThemeName> = {
  dark: 'material', light: 'daylight', claude: 'material', nord: 'material', solarized: 'material', navy: 'material',
};

export const builtInId = (base: ThemeName): string => `builtin:${base}`;

/** One read-only built-in per app theme: the theme as it is in index.css, no overrides. */
const THEME_BUILT_INS: AppearanceProfile[] = THEME_OPTIONS.map(o => ({
  id: builtInId(o.value), name: o.label, base: o.value, syntaxTheme: BUILT_IN_SYNTAX[o.value], overrides: {}, builtIn: true,
}));

/**
 * Built-in palettes that are a theme plus overrides, not a CSS block of their own
 * (v1.3.0: Kiryl asked for the mock's "Warm paper" to ship). A palette like this
 * is exactly what a writer's own profile is, so adding one needs no CSS and no
 * code beyond this table.
 */
const PALETTE_BUILT_INS: AppearanceProfile[] = [
  {
    id: 'builtin:warm-paper', name: 'Warm paper', base: 'light', syntaxTheme: 'daylight', builtIn: true,
    overrides: { '--editor-canvas-bg': '#efe6d6', '--editor-page-bg': '#fffaf0', '--editor-h1': '#3b2a1a', '--editor-accent': '#b45309' },
  },
];

const BUILT_IN_DESCRIPTIONS: Record<string, string> = {
  ...Object.fromEntries(THEME_OPTIONS.map(o => [builtInId(o.value), THEME_DESCRIPTIONS[o.value]])),
  'builtin:warm-paper': 'Light, on a warm paper page with a brown accent',
};

export const BUILT_IN_PROFILES: readonly AppearanceProfile[] = [...THEME_BUILT_INS, ...PALETTE_BUILT_INS].map(p =>
  Object.freeze({ ...p, overrides: Object.freeze({ ...p.overrides }) as Overrides }));

/** The one-line description of a built-in (its theme's, or the palette's own); null for a custom profile. */
export function builtInDescription(p: AppearanceProfile): string | null {
  return p.builtIn ? BUILT_IN_DESCRIPTIONS[p.id] ?? THEME_DESCRIPTIONS[p.base] : null;
}

export const DEFAULT_APPEARANCE: AppearanceState = Object.freeze({ activeProfileId: builtInId('dark'), profiles: [] }) as AppearanceState;

export function allProfiles(s: AppearanceState): AppearanceProfile[] {
  return [...BUILT_IN_PROFILES, ...s.profiles];
}

export function findProfile(s: AppearanceState, id: string): AppearanceProfile | undefined {
  return allProfiles(s).find(p => p.id === id);
}

/** Decision 6: an id that names nothing resolves to Dark. */
export function resolveActiveProfile(s: AppearanceState): AppearanceProfile {
  return findProfile(s, s.activeProfileId) ?? BUILT_IN_PROFILES[0];
}

/** Decision 3: `data-theme` = base, every registry variable cleared from the inline style, then the overrides. */
export function applyProfile(root: HTMLElement, profile: AppearanceProfile): void {
  root.setAttribute('data-theme', profile.base);
  for (const name of APPEARANCE_VAR_NAMES) root.style.removeProperty(name);
  for (const name of APPEARANCE_VAR_NAMES) {
    const v = profile.overrides[name];
    if (v !== undefined) root.style.setProperty(name, v);
  }
}

/** `name`, or `name 2`, `name 3`, … — the first one no other profile (built-in or custom) uses. */
export function uniqueProfileName(s: AppearanceState, name: string, exceptId?: string): string {
  const taken = new Set(allProfiles(s).filter(p => p.id !== exceptId).map(p => p.name));
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
}

const custom = (s: AppearanceState, id: string): AppearanceProfile | undefined => s.profiles.find(p => p.id === id);
const replace = (s: AppearanceState, p: AppearanceProfile): AppearanceState => ({ ...s, profiles: s.profiles.map(x => (x.id === p.id ? p : x)) });

export function setActiveProfile(s: AppearanceState, id: string): AppearanceState {
  if (!findProfile(s, id) || s.activeProfileId === id) return s;
  return { ...s, activeProfileId: id };
}

/** Duplicate any profile (the only way to make one besides Import); the copy becomes active. */
export function duplicateProfile(s: AppearanceState, sourceId: string, newId: string): AppearanceState {
  const src = findProfile(s, sourceId);
  if (!src || findProfile(s, newId)) return s;
  const copy: AppearanceProfile = {
    id: newId, name: uniqueProfileName(s, `${src.name} copy`), base: src.base, syntaxTheme: src.syntaxTheme,
    overrides: { ...src.overrides }, builtIn: false,
  };
  return { activeProfileId: newId, profiles: [...s.profiles, copy] };
}

export function updateProfile(s: AppearanceState, id: string, patch: { name?: string; base?: ThemeName; syntaxTheme?: SyntaxThemeName }): AppearanceState {
  const p = custom(s, id);
  if (!p) return s;
  const next = { ...p };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return s;
    next.name = uniqueProfileName(s, name, id);
  }
  // A base change keeps every override as it is (review finding: dropping the ones that
  // equal the new base lost them when the writer switched back). Export writes them all.
  if (patch.base !== undefined && isThemeName(patch.base)) next.base = patch.base;
  if (patch.syntaxTheme !== undefined && isSyntaxThemeName(patch.syntaxTheme)) next.syntaxTheme = patch.syntaxTheme;
  return replace(s, next);
}

/** Set one override (null = reset to the base). A value equal to the base's is not stored; an invalid one changes nothing. */
export function setOverride(s: AppearanceState, id: string, name: AppearanceVar, value: string | null): AppearanceState {
  const p = custom(s, id);
  if (!p || !isAppearanceVar(name)) return s;
  const overrides: Overrides = { ...p.overrides };
  if (value === null || value.trim() === THEME_VALUES[p.base][name]) {
    if (!(name in overrides)) return s;
    delete overrides[name];
  } else {
    const v = value.trim();
    if (!isValidValue(name, v)) return s;
    if (overrides[name] === v) return s;
    overrides[name] = v;
  }
  return replace(s, { ...p, overrides });
}

export function resetOverrides(s: AppearanceState, id: string): AppearanceState {
  const p = custom(s, id);
  if (!p || Object.keys(p.overrides).length === 0) return s;
  return replace(s, { ...p, overrides: {} });
}

/** Decision 6: deleting the active profile falls back to its base's built-in. */
export function deleteProfile(s: AppearanceState, id: string): AppearanceState {
  const p = custom(s, id);
  if (!p) return s;
  return {
    activeProfileId: s.activeProfileId === id ? builtInId(p.base) : s.activeProfileId,
    profiles: s.profiles.filter(x => x.id !== id),
  };
}

// ---------------------------------------------------------------------------
// Export / import (decision 5).
// ---------------------------------------------------------------------------

export const PROFILE_FORMAT = 'dita-architect-appearance';
export const PROFILE_FORMAT_VERSION = 1;

/** The fixed shape, keys in this order, overrides in registry order, two-space indent, trailing newline. */
export function exportProfile(p: AppearanceProfile): string {
  const overrides: Record<string, string> = {};
  for (const name of APPEARANCE_VAR_NAMES) {
    const v = p.overrides[name];
    if (v !== undefined) overrides[name] = v;
  }
  return JSON.stringify({
    format: PROFILE_FORMAT, version: PROFILE_FORMAT_VERSION, name: p.name, base: p.base, syntaxTheme: p.syntaxTheme, overrides,
  }, null, 2) + '\n';
}

export type ImportResult =
  | { ok: true; state: AppearanceState; profile: AppearanceProfile }
  | { ok: false; errors: string[] };

/** Never a silent drop: every problem is named and nothing is imported unless there are none. */
export function importProfile(s: AppearanceState, text: string, newId: string): ImportResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`it is not JSON (${e instanceof Error ? e.message : String(e)})`] };
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc) || (doc as Record<string, unknown>).format !== PROFILE_FORMAT) {
    return { ok: false, errors: [`it is not a DITA Architect appearance profile (no "format": "${PROFILE_FORMAT}")`] };
  }
  const o = doc as Record<string, unknown>;
  const errors: string[] = [];
  if (o.version !== PROFILE_FORMAT_VERSION) errors.push(`its version is ${JSON.stringify(o.version)}; this app reads version ${PROFILE_FORMAT_VERSION}`);
  if (typeof o.name !== 'string' || !o.name.trim()) errors.push('its name is missing or is not text');
  if (!isThemeName(o.base)) errors.push(`its base ${JSON.stringify(o.base)} is not one of ${THEME_OPTIONS.map(t => t.value).join(', ')}`);
  if (!isSyntaxThemeName(o.syntaxTheme)) errors.push(`its syntax theme ${JSON.stringify(o.syntaxTheme)} is not one of ${SYNTAX_THEME_OPTIONS.map(t => t.value).join(', ')}`);
  const overrides: Overrides = {};
  if (typeof o.overrides !== 'object' || o.overrides === null || Array.isArray(o.overrides)) {
    errors.push('its overrides are not an object of variable names and values');
  } else {
    const entries = Object.entries(o.overrides as Record<string, unknown>);
    const unknown = entries.map(([k]) => k).filter(k => !isAppearanceVar(k));
    if (unknown.length) errors.push(`it names ${unknown.length === 1 ? 'a variable' : `${unknown.length} variables`} this version does not have: ${unknown.join(', ')}`);
    const bad = entries.filter(([k, v]) => isAppearanceVar(k) && (typeof v !== 'string' || !isValidValue(k, v)));
    if (bad.length) errors.push(`these values are not valid: ${bad.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}`);
    for (const [k, v] of entries) if (isAppearanceVar(k) && typeof v === 'string' && isValidValue(k, v)) overrides[k] = v.trim();
  }
  if (errors.length) return { ok: false, errors };
  const base = o.base as ThemeName;
  for (const name of Object.keys(overrides) as AppearanceVar[]) if (THEME_VALUES[base][name] === overrides[name]) delete overrides[name];
  const profile: AppearanceProfile = {
    id: newId, name: uniqueProfileName(s, (o.name as string).trim()), base, syntaxTheme: o.syntaxTheme as SyntaxThemeName, overrides, builtIn: false,
  };
  return { ok: true, profile, state: { activeProfileId: newId, profiles: [...s.profiles, profile] } };
}

// ---------------------------------------------------------------------------
// The store's view (lib/settings.ts calls these).
// ---------------------------------------------------------------------------

/** Tolerant read of the stored slice: broken profiles are dropped, never thrown on. */
export function parseStoredAppearance(value: unknown): AppearanceState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return DEFAULT_APPEARANCE;
  const o = value as Record<string, unknown>;
  const profiles: AppearanceProfile[] = [];
  const ids = new Set(BUILT_IN_PROFILES.map(p => p.id));
  if (Array.isArray(o.profiles)) {
    for (const raw of o.profiles) {
      if (typeof raw !== 'object' || raw === null) continue;
      const p = raw as Record<string, unknown>;
      if (typeof p.id !== 'string' || !p.id || ids.has(p.id)) continue;
      if (typeof p.name !== 'string' || !p.name.trim() || !isThemeName(p.base) || !isSyntaxThemeName(p.syntaxTheme)) continue;
      const overrides: Overrides = {};
      if (typeof p.overrides === 'object' && p.overrides !== null && !Array.isArray(p.overrides)) {
        for (const [k, v] of Object.entries(p.overrides as Record<string, unknown>)) {
          if (isAppearanceVar(k) && typeof v === 'string' && isValidValue(k, v)) overrides[k] = v.trim();
        }
      }
      ids.add(p.id);
      profiles.push({ id: p.id, name: p.name, base: p.base, syntaxTheme: p.syntaxTheme, overrides, builtIn: false });
    }
  }
  const state: AppearanceState = { activeProfileId: typeof o.activeProfileId === 'string' ? o.activeProfileId : DEFAULT_APPEARANCE.activeProfileId, profiles };
  if (!findProfile(state, state.activeProfileId)) state.activeProfileId = DEFAULT_APPEARANCE.activeProfileId;
  return profiles.length === 0 && state.activeProfileId === DEFAULT_APPEARANCE.activeProfileId ? DEFAULT_APPEARANCE : state;
}

/**
 * ADR-018 decision 8 / A2: the two v1.2.0 keys become a profile. The pair lands
 * on the built-in that matches it, or on a custom profile of exactly that pair,
 * so nothing a writer sees changes. A theme with no syntax theme stored takes
 * its built-in pairing.
 */
export function migrateThemePair(themeRaw: string | null, syntaxRaw: string | null): AppearanceState {
  const base = resolveStoredTheme(themeRaw);
  // v1.2.0 showed Material for any stored value it did not recognise, so an unknown one
  // migrates to Material (nothing visible changes); only a missing one takes the pairing.
  const syntax: SyntaxThemeName = isSyntaxThemeName(syntaxRaw) ? syntaxRaw : syntaxRaw === null ? BUILT_IN_SYNTAX[base] : 'material';
  if (syntax === BUILT_IN_SYNTAX[base]) return base === 'dark' ? DEFAULT_APPEARANCE : { activeProfileId: builtInId(base), profiles: [] };
  const id = `migrated-${base}-${syntax}`;
  const profile: AppearanceProfile = { id, name: `${themeLabel(base)}, ${syntaxThemeLabel(syntax)} XML`, base, syntaxTheme: syntax, overrides: {}, builtIn: false };
  return { activeProfileId: id, profiles: [profile] };
}
