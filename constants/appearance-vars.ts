/**
 * ADR-018 decision 2 — the appearance variable registry.
 *
 * Every CSS custom property an appearance profile can override: its label in
 * the Appearance drawer, its group, and its kind. This list is the contract
 * between `index.css` and the profile model: `tests/appearance-registry.test.ts`
 * asserts it equals the `:root` block and every `[data-theme]` block exactly, so
 * a variable added to one and not the other fails the build's tests.
 */

export const APPEARANCE_GROUPS = [
  'App chrome',
  'Editor canvas',
  'Body element bars',
  'Toolbar and status bar',
  'Notes',
  'Topic badges',
  'Validation',
  'Scrollbars',
] as const;

export type AppearanceGroup = typeof APPEARANCE_GROUPS[number];

/** `color`: a colour picker plus a text field. `shadow` / `border`: a CSS value typed as text. */
export type AppearanceVarKind = 'color' | 'shadow' | 'border';

export interface AppearanceVarDef {
  name: string;
  label: string;
  group: AppearanceGroup;
  kind: AppearanceVarKind;
}

export const APPEARANCE_VARS = [
  // App chrome
  { name: '--app-bg', label: 'Window background', group: 'App chrome', kind: 'color' },
  { name: '--app-surface', label: 'Panels and title row', group: 'App chrome', kind: 'color' },
  { name: '--app-surface-raised', label: 'Raised surfaces (menus, inputs)', group: 'App chrome', kind: 'color' },
  { name: '--app-border', label: 'Borders', group: 'App chrome', kind: 'color' },
  { name: '--app-border-subtle', label: 'Subtle borders', group: 'App chrome', kind: 'color' },
  { name: '--app-text-primary', label: 'Primary text', group: 'App chrome', kind: 'color' },
  { name: '--app-text-secondary', label: 'Secondary text', group: 'App chrome', kind: 'color' },
  { name: '--app-text-muted', label: 'Muted text', group: 'App chrome', kind: 'color' },
  { name: '--app-hover', label: 'Hover', group: 'App chrome', kind: 'color' },
  { name: '--app-btn-bg', label: 'Button background', group: 'App chrome', kind: 'color' },
  { name: '--app-btn-hover', label: 'Button hover', group: 'App chrome', kind: 'color' },
  { name: '--app-btn-text', label: 'Button text', group: 'App chrome', kind: 'color' },
  { name: '--app-btn-border', label: 'Button border', group: 'App chrome', kind: 'color' },
  // Editor canvas
  { name: '--editor-canvas-bg', label: 'Canvas behind the page', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-page-bg', label: 'Page', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-page-shadow', label: 'Page shadow', group: 'Editor canvas', kind: 'shadow' },
  { name: '--editor-page-border', label: 'Page border', group: 'Editor canvas', kind: 'border' },
  { name: '--editor-bg', label: 'Editor background', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-text', label: 'Body text', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-h1', label: 'Title', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-h2', label: 'Section heading', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-list-text', label: 'List text', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-accent', label: 'Accent (links, active tab)', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-code-bg', label: 'Code background', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-code-text', label: 'Code text', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-quote-border', label: 'Quote bar', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-quote-bg', label: 'Quote background', group: 'Editor canvas', kind: 'color' },
  { name: '--editor-quote-text', label: 'Quote text', group: 'Editor canvas', kind: 'color' },
  // Body element bars
  { name: '--editor-prereq-bar', label: 'Before you begin', group: 'Body element bars', kind: 'color' },
  { name: '--editor-context-bar', label: 'About this task', group: 'Body element bars', kind: 'color' },
  { name: '--editor-result-bar', label: 'Result', group: 'Body element bars', kind: 'color' },
  { name: '--editor-postreq-bar', label: 'After you finish', group: 'Body element bars', kind: 'color' },
  { name: '--editor-section-bar', label: 'Section', group: 'Body element bars', kind: 'color' },
  // Toolbar and status bar
  { name: '--editor-toolbar-bg', label: 'Toolbar background', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-toolbar-border', label: 'Toolbar border', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-toolbar-text', label: 'Toolbar label', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-toolbar-text-strong', label: 'Toolbar icons', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-toolbar-hover', label: 'Toolbar hover', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-toolbar-divider', label: 'Toolbar divider', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-bottom-bg', label: 'Status bar background', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-bottom-border', label: 'Status bar border', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-bottom-text', label: 'Status bar text', group: 'Toolbar and status bar', kind: 'color' },
  { name: '--editor-bottom-text-strong', label: 'Status bar values', group: 'Toolbar and status bar', kind: 'color' },
  // Notes
  { name: '--editor-note-note', label: 'Note', group: 'Notes', kind: 'color' },
  { name: '--editor-note-tip', label: 'Tip', group: 'Notes', kind: 'color' },
  { name: '--editor-note-warning', label: 'Warning', group: 'Notes', kind: 'color' },
  { name: '--editor-note-caution', label: 'Caution', group: 'Notes', kind: 'color' },
  { name: '--editor-note-danger', label: 'Danger', group: 'Notes', kind: 'color' },
  // Topic badges
  { name: '--badge-task-bg', label: 'Task background', group: 'Topic badges', kind: 'color' },
  { name: '--badge-task-border', label: 'Task border', group: 'Topic badges', kind: 'color' },
  { name: '--badge-task-text', label: 'Task text', group: 'Topic badges', kind: 'color' },
  { name: '--badge-concept-bg', label: 'Concept background', group: 'Topic badges', kind: 'color' },
  { name: '--badge-concept-border', label: 'Concept border', group: 'Topic badges', kind: 'color' },
  { name: '--badge-concept-text', label: 'Concept text', group: 'Topic badges', kind: 'color' },
  { name: '--badge-reference-bg', label: 'Reference background', group: 'Topic badges', kind: 'color' },
  { name: '--badge-reference-border', label: 'Reference border', group: 'Topic badges', kind: 'color' },
  { name: '--badge-reference-text', label: 'Reference text', group: 'Topic badges', kind: 'color' },
  // Validation
  { name: '--validation-broken-xref', label: 'Broken link underline', group: 'Validation', kind: 'color' },
  { name: '--validation-unresolved-keyref', label: 'Undefined key border', group: 'Validation', kind: 'color' },
  { name: '--validation-unresolved-keyref-bg', label: 'Undefined key background', group: 'Validation', kind: 'color' },
  // Scrollbars
  { name: '--editor-scrollbar-track', label: 'Track', group: 'Scrollbars', kind: 'color' },
  { name: '--editor-scrollbar-thumb', label: 'Thumb', group: 'Scrollbars', kind: 'color' },
  { name: '--editor-scrollbar-thumb-hover', label: 'Thumb hover', group: 'Scrollbars', kind: 'color' },
] as const satisfies readonly AppearanceVarDef[];

export type AppearanceVar = typeof APPEARANCE_VARS[number]['name'];

export const APPEARANCE_VAR_NAMES: readonly AppearanceVar[] = APPEARANCE_VARS.map(v => v.name);

const NAME_SET: ReadonlySet<string> = new Set(APPEARANCE_VAR_NAMES);

export function isAppearanceVar(name: unknown): name is AppearanceVar {
  return typeof name === 'string' && NAME_SET.has(name);
}

export function appearanceVarDef(name: AppearanceVar): AppearanceVarDef {
  return APPEARANCE_VARS.find(v => v.name === name)!;
}
