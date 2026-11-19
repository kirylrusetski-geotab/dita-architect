/**
 * The XML split's colours (Monaco), as data: one token palette per syntax
 * theme and one background set per app theme. An appearance profile picks a
 * base and a syntax theme; the editor's theme is the pair (ADR-018 decision 3:
 * overrides do not reach Monaco). Shared by MonacoDitaEditor and the
 * Appearance drawer's preview, so the preview cannot drift from the editor.
 */
import type { SyntaxThemeName, ThemeName } from './appearance';


export const SYNTAX_RULES: Record<SyntaxThemeName, { base: 'vs' | 'vs-dark'; foreground: string; rules: Array<{ token: string; foreground: string; fontStyle?: string }> }> = {
  material: {
    base: 'vs-dark',
    foreground: 'EEFFFF',
    rules: [
      { token: 'tag', foreground: '80CBC4' },
      { token: 'attribute.name', foreground: 'FFCB6B' },
      { token: 'attribute.value', foreground: 'C3E88D' },
      { token: 'comment', foreground: '546E7A', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '89DDFF' },
    ],
  },
  github: {
    base: 'vs-dark',
    foreground: 'E6EDF3',
    rules: [
      { token: 'tag', foreground: '7EE787' },
      { token: 'attribute.name', foreground: '79C0FF' },
      { token: 'attribute.value', foreground: 'A5D6FF' },
      { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'D2A8FF' },
    ],
  },
  monokai: {
    base: 'vs-dark',
    foreground: 'F8F8F2',
    rules: [
      { token: 'tag', foreground: 'F92672' },
      { token: 'attribute.name', foreground: 'A6E22E' },
      { token: 'attribute.value', foreground: 'E6DB74' },
      { token: 'comment', foreground: '75715E', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'F8F8F2' },
    ],
  },
  dracula: {
    base: 'vs-dark',
    foreground: 'F8F8F2',
    rules: [
      { token: 'tag', foreground: 'FF79C6' },
      { token: 'attribute.name', foreground: '50FA7B' },
      { token: 'attribute.value', foreground: 'F1FA8C' },
      { token: 'comment', foreground: '6272A4', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'BD93F9' },
    ],
  },
  'one-dark': {
    base: 'vs-dark',
    foreground: 'ABB2BF',
    rules: [
      { token: 'tag', foreground: 'E06C75' },
      { token: 'attribute.name', foreground: 'D19A66' },
      { token: 'attribute.value', foreground: '98C379' },
      { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '56B6C2' },
    ],
  },
  catppuccin: {
    base: 'vs-dark',
    foreground: 'CDD6F4',
    rules: [
      { token: 'tag', foreground: 'CBA6F7' },
      { token: 'attribute.name', foreground: 'F9E2AF' },
      { token: 'attribute.value', foreground: 'A6E3A1' },
      { token: 'comment', foreground: '6C7086', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'F5C2E7' },
    ],
  },
  daylight: {
    base: 'vs',
    foreground: '24292F',
    rules: [
      { token: 'tag', foreground: '0550AE' },
      { token: 'attribute.name', foreground: '953800' },
      { token: 'attribute.value', foreground: '116329' },
      { token: 'comment', foreground: '6E7781', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '0550AE' },
    ],
  },
};

// ── Background Colors Per App Theme ─────────────────────────────────────────

export const MONACO_BG: Record<ThemeName, { bg: string; lineHighlight: string; lineNumber: string }> = {
  dark:      { bg: '#111111', lineHighlight: '#1e1e1e', lineNumber: '#555555' },
  light:     { bg: '#f1f5f9', lineHighlight: '#e2e8f0', lineNumber: '#94a3b8' },
  claude:    { bg: '#1f150f', lineHighlight: '#3d2e24', lineNumber: '#8a7568' },
  nord:      { bg: '#242933', lineHighlight: '#3b4252', lineNumber: '#616e88' },
  solarized: { bg: '#001e28', lineHighlight: '#073642', lineNumber: '#586e75' },
  navy:      { bg: '#1e2332', lineHighlight: '#25477b', lineNumber: '#8a9ba8' },
};

export function buildThemeName(appTheme: ThemeName, syntax: SyntaxThemeName): string {
  return `combo-${appTheme}-${syntax}`;
}

/** The argument to `monaco.editor.defineTheme` for one base + syntax pair. */
export function monacoThemeData(app: ThemeName, syntax: SyntaxThemeName) {
  const bg = MONACO_BG[app];
  const syn = SYNTAX_RULES[syntax];
  return {
    base: app === 'light' ? 'vs' as const : syn.base,
    inherit: true,
    rules: syn.rules,
    colors: {
      'editor.background': bg.bg,
      'editor.foreground': `#${syn.foreground}`,
      'editor.lineHighlightBackground': bg.lineHighlight,
      'editorLineNumber.foreground': bg.lineNumber,
    },
  };
}
