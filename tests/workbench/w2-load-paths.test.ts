// ADR-017 W2 — no load path can open a panel.
//
// The layout is reachable only through `useWorkbenchLayout`'s actions, and the
// only code that opens the XML split on its own is the hook's W3 effect (a
// pending review on the active tab), plus, since ADR-018 decision 10, the main
// component when the writer has turned "Open the XML split when a topic opens"
// on (off by default). This pins that by construction: none of
// the modules that load content — the tab API bridge (`loadContent`,
// `insertSection`, `updateTabContent`), the dev-server queue, the Heretto hook
// (open, refresh, Save As), the local-file hook, the tab manager (templates) —
// imports the layout model or the hook, so none of them can touch a panel.
// The behavioural half is in use-workbench-layout.test.tsx (the hook never
// opens anything except on the W3 rising edge).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const LOAD_PATHS = [
  'lib/native-api-bridge.ts',
  'hooks/useExternalLoad.ts',
  'hooks/useHerettoCms.ts',
  'hooks/useLocalFile.ts',
  'hooks/useTabManager.ts',
  'lib/xml-insert.ts',
];

describe('W2 — load paths cannot reach the layout', () => {
  it.each(LOAD_PATHS)('%s imports neither the layout model nor the hook', (file) => {
    const src = readFileSync(join(__dirname, '..', '..', file), 'utf-8');
    expect(src).not.toMatch(/workbench-layout/);
    expect(src).not.toMatch(/useWorkbenchLayout/);
    expect(src).not.toMatch(/togglePanel|openPanel|codeEditorCollapsed/);
  });

  it('the programmatic opens of the XML split are the hook\'s W3 effect and, since ADR-018, the opt-in "open on load" setting', () => {
    const hook = readFileSync(join(__dirname, '..', '..', 'hooks/useWorkbenchLayout.ts'), 'utf-8');
    const opens = hook.match(/openPanel\('xml'\)/g) ?? [];
    expect(opens.length).toBe(1);
    const app = readFileSync(join(__dirname, '..', '..', 'dita-architect.tsx'), 'utf-8');
    // The app wires the user's gestures (rail, menu, close control). Its one programmatic open is
    // ADR-018 decision 10, and only behind Settings ▸ General ▸ "Open the XML split when a topic opens"
    // (off by default), so with the default settings no load path opens anything.
    const appOpens = [...app.matchAll(/openPanel\(/g)];
    expect(appOpens.length).toBe(1);
    const line = app.slice(app.lastIndexOf('\n', appOpens[0].index!), app.indexOf('\n', appOpens[0].index!));
    expect(line).toMatch(/editorSettings\.openXmlTrayOnLoad && addedIds\(prev, ids\)\.length > 0\) openPanel\('xml'\)/);
    expect(app).not.toMatch(/togglePanel\('xml', true\)/);
  });
});
