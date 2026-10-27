// @vitest-environment jsdom
//
// FR-066 / ADR-013 decision 9: Insert Variable. Written before the code.
//  - The catalog lists a key's variables from its target topic: every inline
//    @id element (FR-066 observed facts: <ph> mostly, also <uicontrol>,
//    <wintitle>, <keyword>), never a block (<note>) or the topic itself.
//  - I4: inserting emits exactly <tag conkeyref="key/id"/> at the caret — the
//    target's element, so DITA's conref rule holds — and nothing else changes.
//  - Undo and redo serialize to the matching state; Suggesting mode blocks it.
//  - The toolbar button is disabled until a map is connected.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import {
  $getRoot, $isElementNode, $isTextNode, $createRangeSelection, $setSelection,
  UNDO_COMMAND, REDO_COMMAND, type LexicalEditor, type LexicalNode, type TextNode,
} from 'lexical';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { SyncManager } from '../components/SyncManager';
import { SuggestionPlugin } from '../components/SuggestionPlugin';
import { InsertVariablePlugin, INSERT_VARIABLE_COMMAND } from '../components/InsertVariablePlugin';
import { Toolbar } from '../components/Toolbar';
import { KeyRegistryContext } from '../components/KeyRegistryContext';
import { loadKeyVariables, clearVariableCache } from '../lib/variable-catalog';
import { clearHerettoPathCache } from '../lib/heretto-path';
import { herettoFolderCache } from '../constants/heretto';
import { serveHeretto, herettoRequests, type FakeTenant } from './helpers/fakeHeretto';
import type { DocumentMode } from '../types/tab';
import type { KeyRegistry } from '../lib/heretto-map-loader';

const toastFn = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: Object.assign(toastFn, { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// ─── The catalog ─────────────────────────────────────────────────────────────

/** Shaped like the real Altitude UI and Notes warehouses (read 2026-10-27). */
const WAREHOUSE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="topic-9022" class="- topic/topic "><title class="- topic/title ">UI warehouse</title><body class="- topic/body "><p class="- topic/p ">
<uicontrol id="OptionsMenu" class="+ topic/ph ui-d/uicontrol ">options menu (⋮)</uicontrol>
<ph id="Datasetspage" class="- topic/ph "><wintitle class="+ topic/keyword ui-d/wintitle ">Datasets</wintitle></ph>
<keyword id="ProdName" class="- topic/keyword ">Altitude</keyword>
<ph id="Nested" class="- topic/ph ">Outer <ph id="Inner" class="- topic/ph ">inner</ph></ph>
</p><note id="noteExpansion" class="- topic/note "><p class="- topic/p ">Only in the USA.</p></note><section id="sec" class="- topic/section "><p class="- topic/p ">x</p></section></body></topic>`;

const tenant = (): FakeTenant => ({
  folders: { root: { name: 'master', parent: null }, wh: { name: 'Warehouses', parent: 'root' } },
  files: { ui: { name: 'UI_Warehouse.dita', folder: 'wh', content: WAREHOUSE } },
});

const registry = (): KeyRegistry => ({
  map: { uuid: 'm', name: 'variables.ditamap' },
  keys: new Map([
    ['varsUI', { href: 'UI_Warehouse.dita', mapName: 'variables.ditamap', mapUuid: 'm', mapFolderUuid: 'wh' }],
    ['ghost', { href: 'Missing.dita', mapName: 'variables.ditamap', mapUuid: 'm', mapFolderUuid: 'wh' }],
    ['textKey', { href: null, mapName: 'variables.ditamap', mapUuid: 'm', mapFolderUuid: 'wh' }],
  ]),
  mapsRead: 1, mapsSkipped: 0, capped: false, duplicates: 0,
});

describe('loadKeyVariables', () => {
  beforeEach(() => { clearVariableCache(); clearHerettoPathCache(); herettoFolderCache.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lists every inline @id element of the key\'s target topic, with its tag and text', async () => {
    serveHeretto(tenant());
    const result = await loadKeyVariables('varsUI', registry().keys.get('varsUI')!);
    expect(result).toEqual({
      status: 'ok',
      variables: [
        { key: 'varsUI', id: 'OptionsMenu', tag: 'uicontrol', text: 'options menu (⋮)' },
        { key: 'varsUI', id: 'Datasetspage', tag: 'ph', text: 'Datasets' },
        { key: 'varsUI', id: 'ProdName', tag: 'keyword', text: 'Altitude' },
        { key: 'varsUI', id: 'Nested', tag: 'ph', text: 'Outer inner' },
        { key: 'varsUI', id: 'Inner', tag: 'ph', text: 'inner' },
      ],
    });
  });

  it('a target that cannot be found is reported, not thrown', async () => {
    serveHeretto(tenant());
    expect(await loadKeyVariables('ghost', registry().keys.get('ghost')!)).toEqual({ status: 'missing' });
  });

  it('a key with no href has no variables', async () => {
    serveHeretto(tenant());
    expect(await loadKeyVariables('textKey', registry().keys.get('textKey')!)).toEqual({ status: 'ok', variables: [] });
  });

  it('a network failure is an error the picker can show, and is retried next time', async () => {
    serveHeretto(tenant(), { '/heretto-api/all-files/ui/content': 'network' });
    expect((await loadKeyVariables('varsUI', registry().keys.get('varsUI')!)).status).toBe('error');
    serveHeretto(tenant());
    expect((await loadKeyVariables('varsUI', registry().keys.get('varsUI')!)).status).toBe('ok');
  });

  it('a key\'s variables are fetched once', async () => {
    serveHeretto(tenant());
    await loadKeyVariables('varsUI', registry().keys.get('varsUI')!);
    await loadKeyVariables('varsUI', registry().keys.get('varsUI')!);
    expect(herettoRequests.filter(r => r === '/heretto-api/all-files/ui/content')).toHaveLength(1);
  });
});

// ─── The command through the real tree (I4, undo/redo, suggesting) ──────────

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="p"><title>T</title><conbody><p>Open the menu now.</p><p>Second <ph conkeyref="varsUI/ProdName"/> stays.</p></conbody></concept>`;

function findText(node: LexicalNode, needle: string): TextNode | null {
  if ($isTextNode(node) && node.getTextContent().includes(needle)) return node;
  if ($isElementNode(node)) for (const c of node.getChildren()) { const r = findText(c, needle); if (r) return r; }
  return null;
}
/** Caret right after `needle`. */
function $caretAfter(needle: string) {
  const t = findText($getRoot(), needle);
  if (!t) throw new Error(`no "${needle}"`);
  const at = t.getTextContent().indexOf(needle) + needle.length;
  const sel = $createRangeSelection();
  sel.anchor.set(t.getKey(), at, 'text');
  sel.focus.set(t.getKey(), at, 'text');
  $setSelection(sel);
}

let editorRef: LexicalEditor | null = null;
const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };

async function mount(documentMode: DocumentMode = 'editing') {
  const onLexicalChange = vi.fn();
  render(
    <LexicalComposer initialConfig={{ namespace: 'var', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
      <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
      <HistoryPlugin />
      <Capture />
      <SyncManager xmlContent={XML} onLexicalChange={onLexicalChange} lastUpdatedBy="code" suspendSync={documentMode === 'suggesting'}>
        <InsertVariablePlugin />
        <SuggestionPlugin
          tabId="t" documentMode={documentMode} masterXml={XML}
          acceptAllTrigger={0} rejectAllTrigger={0}
          onAcceptAll={vi.fn()} onRejectAll={vi.fn()} onChangeCountChanged={vi.fn()}
        />
      </SyncManager>
    </LexicalComposer>,
  );
  await act(async () => { await new Promise(r => setTimeout(r, 250)); });
  return { onLexicalChange, editor: editorRef! };
}

const lastXml = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0] as string | undefined;
const run = async (editor: LexicalEditor, fn: () => void) => {
  await act(async () => { editor.update(fn, { discrete: true }); await new Promise(r => setTimeout(r, 50)); });
};

describe('I4: INSERT_VARIABLE_COMMAND through the real tree', () => {
  beforeEach(() => { toastFn.mockClear(); editorRef = null; });

  for (const tag of ['uicontrol', 'ph', 'keyword', 'wintitle']) {
    it(`inserts <${tag} conkeyref/> at the caret and changes nothing else`, async () => {
      const { editor, onLexicalChange } = await mount();
      await run(editor, () => { $caretAfter('Open the '); editor.dispatchCommand(INSERT_VARIABLE_COMMAND, { key: 'varsUI', id: 'OptionsMenu', tag }); });
      expect(lastXml(onLexicalChange)).toBe(XML.replace('Open the menu', `Open the <${tag} conkeyref="varsUI/OptionsMenu"/>menu`));
    });
  }

  it('undo removes the insertion and redo restores it', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => { $caretAfter('Open the '); editor.dispatchCommand(INSERT_VARIABLE_COMMAND, { key: 'varsUI', id: 'OptionsMenu', tag: 'uicontrol' }); });
    const inserted = XML.replace('Open the menu', 'Open the <uicontrol conkeyref="varsUI/OptionsMenu"/>menu');
    expect(lastXml(onLexicalChange)).toBe(inserted);
    await act(async () => { editor.dispatchCommand(UNDO_COMMAND, undefined); await new Promise(r => setTimeout(r, 50)); });
    expect(lastXml(onLexicalChange)).toBe(XML);
    await act(async () => { editor.dispatchCommand(REDO_COMMAND, undefined); await new Promise(r => setTimeout(r, 50)); });
    expect(lastXml(onLexicalChange)).toBe(inserted);
  });

  it('with a range selected, the variable replaces the selected text', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => {
      const t = findText($getRoot(), 'Open the menu')!;
      const s = t.getTextContent().indexOf('menu');
      const sel = $createRangeSelection();
      sel.anchor.set(t.getKey(), s, 'text');
      sel.focus.set(t.getKey(), s + 'menu'.length, 'text');
      $setSelection(sel);
      editor.dispatchCommand(INSERT_VARIABLE_COMMAND, { key: 'varsUI', id: 'OptionsMenu', tag: 'uicontrol' });
    });
    expect(lastXml(onLexicalChange)).toBe(XML.replace('Open the menu now.', 'Open the <uicontrol conkeyref="varsUI/OptionsMenu"/> now.'));
  });

  it('with no selection in the editor it does nothing and says why', async () => {
    const { editor, onLexicalChange } = await mount();
    await run(editor, () => { $setSelection(null); editor.dispatchCommand(INSERT_VARIABLE_COMMAND, { key: 'varsUI', id: 'OptionsMenu', tag: 'uicontrol' }); });
    expect(lastXml(onLexicalChange) ?? XML).toBe(XML);
    expect(toastFn).toHaveBeenCalledWith('Place the cursor in the text where the variable should go');
  });

  it('Suggesting mode blocks it with the inline-element toast', async () => {
    const realNow = Date.now.bind(Date);
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 60_000);
    const { editor } = await mount('suggesting');
    toastFn.mockClear();
    const before = editor.getEditorState().read(() => $getRoot().getTextContent());
    await run(editor, () => { $caretAfter('Open the '); editor.dispatchCommand(INSERT_VARIABLE_COMMAND, { key: 'varsUI', id: 'OptionsMenu', tag: 'uicontrol' }); });
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe(before);
      let chips = 0;
      const walk = (n: LexicalNode) => { if (n.getType() === 'ditaphref') chips++; if ($isElementNode(n)) n.getChildren().forEach(walk); };
      walk($getRoot());
      expect(chips).toBe(1); // only the existing <ph conkeyref>
    });
    expect(toastFn).toHaveBeenCalledWith("Inline elements aren't tracked yet — switch to Editing mode");
    nowSpy.mockRestore();
  });
});

// ─── The toolbar button ──────────────────────────────────────────────────────

describe('FR-066 AC1: the Insert Variable button needs a connected map', () => {
  const renderToolbar = (reg: KeyRegistry | null) => render(
    <KeyRegistryContext.Provider value={reg}>
      <LexicalComposer initialConfig={{ namespace: 'tb', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <Toolbar currentTheme="dark" onThemeChange={vi.fn()} />
      </LexicalComposer>
    </KeyRegistryContext.Provider>,
  );

  it('is disabled, pointing at Connect a Map, when no map is connected', () => {
    renderToolbar(null);
    const button = screen.getByRole('button', { name: 'Insert variable' });
    expect(button).toBeDisabled();
    // Tooltip renders its text beside the button it wraps.
    expect(button.parentElement?.textContent).toContain('Connect a map (Heretto ▸ Connect a Map…) to insert variables');
  });

  it('is enabled when a map is connected', () => {
    renderToolbar(registry());
    expect(screen.getByRole('button', { name: 'Insert variable' })).not.toBeDisabled();
  });
});
