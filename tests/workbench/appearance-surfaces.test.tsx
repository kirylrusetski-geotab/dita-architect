// @vitest-environment jsdom
//
// ADR-018 — what moved and what went: the Toolbar has no theme control and the
// Heretto Status modal is gone (one home: Settings and Appearance); decision 10's
// "open the XML split when a topic opens" lives in the main component and never
// in a loader; `/api/status` reports the active profile (A5); and the settings
// store is the only code that touches preference keys in localStorage (ST1).
import React from 'react';
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { Toolbar } from '../../components/Toolbar';
import { EDITOR_NODES } from '../../constants/editor-nodes';
import { addedIds } from '../../lib/workbench-layout';
import { registerNativeApiBridge } from '../../lib/native-api-bridge';
import { createTab } from '../../types/tab';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf-8');

describe('one home for the look', () => {
  it('the editor toolbar has no theme control; its label is a plain "Visual"', () => {
    render(
      <LexicalComposer initialConfig={{ namespace: 't', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <Toolbar />
      </LexicalComposer>,
    );
    expect(screen.queryByRole('button', { name: /Select theme/ })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('Visual').tagName).toBe('SPAN');
  });

  it('the Heretto Status modal is retired; its form is hosted by Settings ▸ Heretto', () => {
    expect(existsSync(join(root, 'components', 'HerettoStatusModal.tsx'))).toBe(false);
    expect(read('components/SettingsModal.tsx')).toMatch(/<HerettoCredentialsForm /);
  });

  it('data-theme is set on <html> by the appearance hook, not on the app\'s root div', () => {
    const app = read('dita-architect.tsx');
    expect(app).not.toMatch(/data-theme=\{/);
    expect(app).toMatch(/const appearance = useAppearance\(\);/);
    expect(read('index.tsx')).toMatch(/applyProfile\(document\.documentElement, resolveActiveProfile\(loadSettings\(\)\.appearance\)\);/);
  });
});

describe('decision 10 — open the XML split when a topic opens', () => {
  it('addedIds names the ids that were not there before, in order', () => {
    expect(addedIds(new Set(['a', 'b']), ['a', 'b'])).toEqual([]);
    expect(addedIds(new Set(['a']), ['a', 'c', 'b'])).toEqual(['c', 'b']);
    expect(addedIds(new Set(['a', 'b']), ['b'])).toEqual([]);
  });

  it('the main component opens the split only when the setting is on and a tab appeared, and skips the first render', () => {
    const app = read('dita-architect.tsx');
    expect(app).toMatch(/if \(prev !== null && editorSettings\.openXmlTrayOnLoad && addedIds\(prev, ids\)\.length > 0\) openPanel\('xml'\);/);
  });

  it('no loader reads the setting (W2 still holds: loaders never learn about the layout or the settings)', () => {
    for (const f of ['hooks/useHerettoCms.ts', 'hooks/useLocalFile.ts', 'hooks/useExternalLoad.ts', 'hooks/useTabManager.ts', 'lib/native-api-bridge.ts']) {
      const src = read(f);
      expect(src, f).not.toMatch(/openXmlTrayOnLoad|lib\/settings|useWorkbenchLayout/);
    }
  });
});

describe('A5 — /api/status reports the active profile', () => {
  it('theme is the profile\'s base; appearanceProfile is its id and name', () => {
    Object.defineProperty(window, 'location', { value: { protocol: 'dita:' }, configurable: true });
    const tab = createTab('<concept id="c"><title>T</title><conbody/></concept>');
    registerNativeApiBridge({
      getTabs: () => [tab], getActiveTabId: () => tab.id, getHerettoConnected: () => true,
      getAppearance: () => ({ id: 'migrated-nord-dracula', name: 'Nord, Dracula XML', base: 'nord' }),
      updateTab: () => {}, handleHerettoSave: async () => {}, setTabs: () => {}, setActiveTabId: () => {},
    });
    const status = JSON.parse((window as unknown as { __ditaApi: { getStatus: () => string } }).__ditaApi.getStatus());
    expect(status.theme).toBe('nord');
    expect(status.appearanceProfile).toEqual({ id: 'migrated-nord-dracula', name: 'Nord, Dracula XML' });
  });
});

describe('ST1 — one persisted object for preferences', () => {
  it('only lib/settings.ts reads or writes preference keys; useKeyRegistry keeps its connected map (session state)', () => {
    const files = ['dita-architect.tsx', 'index.tsx', 'App.tsx',
      ...['hooks', 'components', 'components/workbench', 'components/workbench/views', 'lib'].flatMap(d =>
        require('fs').readdirSync(join(root, d)).filter((f: string) => /\.tsx?$/.test(f)).map((f: string) => `${d}/${f}`))];
    const offenders = files.filter(f => f !== 'lib/settings.ts' && f !== 'hooks/useKeyRegistry.ts' && /localStorage/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
