// @vitest-environment jsdom
//
// ADR-013 decisions 5 and 7 (P2-27): the app-wide key registry and the three
// keyref chip states. Written before the hook, the context, and the chip change.
//  I2 — connecting, reloading, or failing changes no byte of any open topic:
//       chip state is read from React context at render, never written into
//       the editor.
//  I3 — exactly three chip states, each with its own class and tooltip.
//  I5 — a persisted map restores silently; a failed restore shows nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, renderHook, waitFor } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $isElementNode, type LexicalEditor, type LexicalNode } from 'lexical';
import { EDITOR_NODES } from '../constants/editor-nodes';
import { parseXmlToLexical } from '../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../sync/nodeOriginMap';
import { $isDitaPhRefNode } from '../components/DitaPhRefNode';
import { KeyRegistryContext } from '../components/KeyRegistryContext';
import { chipKeyState, CHIP_STATE_CLASS, CHIP_TOOLTIP } from '../lib/key-chip-state';
import type { KeyRegistry, KeyDefinition } from '../lib/heretto-map-loader';

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), info: vi.fn(), warning: vi.fn() }) }));

const loadKeyRegistry = vi.fn();
vi.mock('../lib/heretto-map-loader', async (orig) => ({
  ...(await orig<typeof import('../lib/heretto-map-loader')>()),
  loadKeyRegistry: (...a: unknown[]) => loadKeyRegistry(...a),
}));

const { useKeyRegistry, CONNECTED_MAP_STORAGE_KEY, extractUuid } = await import('../hooks/useKeyRegistry');
const { MapLoadError } = await import('../lib/heretto-map-loader');

const MAP_UUID = '0f0f0f0f-1111-2222-3333-444444444444';
const def = (mapName: string): KeyDefinition => ({ href: 'w.dita', mapName, mapUuid: 'u', mapFolderUuid: 'f' });
const registry = (keys: Record<string, string>, name = 'Root.ditamap'): KeyRegistry => ({
  map: { uuid: MAP_UUID, name },
  keys: new Map(Object.entries(keys).map(([k, mapName]) => [k, def(mapName)])),
  mapsRead: 2, mapsSkipped: 0, capped: false, duplicates: 0,
});

// ─── I3: the state function ──────────────────────────────────────────────────

describe('I3: chipKeyState', () => {
  const reg = registry({ varsAltitude: 'Altitude_variables.ditamap', 'GLOS-Trip': 'Glossary_Altitude.ditamap' });

  it('no map → no-map, with the P2-27 tooltip', () => {
    expect(chipKeyState('conkeyref', 'varsAltitude/ProdNameShort', null)).toEqual({ state: 'no-map', tooltip: 'Load a ditamap to verify this key resolves' });
  });

  it('a conkeyref resolves by the part before the slash; the tooltip names the defining map', () => {
    expect(chipKeyState('conkeyref', 'varsAltitude/ProdNameShort', reg)).toEqual({ state: 'resolved', tooltip: 'Key found in Altitude_variables.ditamap' });
  });

  it('a keyref resolves by its whole value (or the part before a slash)', () => {
    expect(chipKeyState('keyref', 'GLOS-Trip', reg)?.state).toBe('resolved');
    expect(chipKeyState('keyref', 'GLOS-Trip/sub', reg)?.state).toBe('resolved');
  });

  it('a key the map does not define → unresolved', () => {
    expect(chipKeyState('conkeyref', 'varsMyGUI/x', reg)).toEqual({ state: 'unresolved', tooltip: 'Key not found in the loaded map' });
  });

  it('conref and image chips have no key state', () => {
    expect(chipKeyState('conref', 'w.dita#t/x', reg)).toBeNull();
    expect(chipKeyState('image', 'a.png', reg)).toBeNull();
    expect(chipKeyState('conref', 'w.dita#t/x', null)).toBeNull();
  });

  it('the three states have three different classes and three different tooltips', () => {
    expect(new Set(Object.values(CHIP_STATE_CLASS)).size).toBe(3);
    expect(new Set([CHIP_TOOLTIP['no-map'], CHIP_TOOLTIP.unresolved, 'Key found in X.ditamap']).size).toBe(3);
  });
});

// ─── I3 + I2 through the real editor ─────────────────────────────────────────

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;
const XML = DOC('<p>Use <ph conkeyref="varsAltitude/ProdNameShort"/> and <keyword conkeyref="varsProductnames/MyG"/> and <ph conref="w.dita#t/x"/>.</p>');

describe('I3/I2: chips in a mounted editor', () => {
  let editorRef: LexicalEditor | null = null;
  const Capture = () => { const [e] = useLexicalComposerContext(); editorRef = e; return null; };
  const originMap = createNodeOriginMap();

  const Harness = ({ reg }: { reg: KeyRegistry | null }) => (
    <KeyRegistryContext.Provider value={reg}>
      <LexicalComposer initialConfig={{ namespace: 'adr013', nodes: EDITOR_NODES, onError: (e: Error) => { throw e; }, theme: {} }}>
        <RichTextPlugin contentEditable={<ContentEditable />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
        <Capture />
      </LexicalComposer>
    </KeyRegistryContext.Provider>
  );

  /** [refValue, className, title] of every chip's rendered element. */
  const chipDom = (editor: LexicalEditor) => editor.getEditorState().read(() => {
    const out: [string, string, string][] = [];
    const visit = (n: LexicalNode) => {
      if ($isDitaPhRefNode(n)) {
        const el = editor.getElementByKey(n.getKey())!.querySelector('code')!;
        out.push([n.getRefValue(), el.className, el.title]);
      } else if ($isElementNode(n)) n.getChildren().forEach(visit);
    };
    $getRoot().getChildren().forEach(visit);
    return out;
  });

  beforeEach(() => { editorRef = null; });

  it('renders no-map, then resolved/unresolved, then no-map again — with no editor update and no byte changed', async () => {
    const { rerender } = render(<Harness reg={null} />);
    const editor = editorRef!;
    await act(async () => {
      parseXmlToLexical(XML, editor, originMap, true);
      await new Promise(r => setTimeout(r, 50));
    });
    const before = serializeLexicalToXml(editor.getEditorState(), XML, originMap, createXmlMetaCache());
    expect(before).toBe(XML);

    let updates = 0;
    const off = editor.registerUpdateListener(() => { updates++; });

    expect(chipDom(editor)).toEqual([
      ['varsAltitude/ProdNameShort', expect.stringContaining(CHIP_STATE_CLASS['no-map']), CHIP_TOOLTIP['no-map']],
      ['varsProductnames/MyG', expect.stringContaining(CHIP_STATE_CLASS['no-map']), CHIP_TOOLTIP['no-map']],
      ['w.dita#t/x', expect.not.stringMatching(/dita-chip--/), ''],
    ]);

    await act(async () => { rerender(<Harness reg={registry({ varsAltitude: 'Altitude_variables.ditamap' })} />); });
    expect(chipDom(editor)).toEqual([
      ['varsAltitude/ProdNameShort', expect.stringContaining(CHIP_STATE_CLASS.resolved), 'Key found in Altitude_variables.ditamap'],
      ['varsProductnames/MyG', expect.stringContaining(CHIP_STATE_CLASS.unresolved), CHIP_TOOLTIP.unresolved],
      ['w.dita#t/x', expect.not.stringMatching(/dita-chip--/), ''],
    ]);

    await act(async () => { rerender(<Harness reg={null} />); });
    expect(chipDom(editor)[0][1]).toContain(CHIP_STATE_CLASS['no-map']);

    off();
    expect(updates).toBe(0);
    expect(serializeLexicalToXml(editor.getEditorState(), XML, originMap, createXmlMetaCache())).toBe(before);
  });
});

// ─── The hook: connect, reload, disconnect, restore (I5) ─────────────────────

describe('useKeyRegistry', () => {
  // tests/setup.ts stubs localStorage as a no-op; persistence needs a real store.
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => store.clear(),
      },
      writable: true,
      configurable: true,
    });
    localStorage.clear();
    loadKeyRegistry.mockReset();
    toastSuccess.mockReset();
  });
  afterEach(() => { localStorage.clear(); });

  it('extractUuid accepts a bare UUID or any text holding one, and nothing else', () => {
    expect(extractUuid('ec7bfbcf-5d1f-44f1-ae7e-7c1bd5cb2c92')).toBe('ec7bfbcf-5d1f-44f1-ae7e-7c1bd5cb2c92');
    expect(extractUuid('  https://x.example.com/#/content/EC7BFBCF-5D1F-44F1-AE7E-7C1BD5CB2C92?v=1 ')).toBe('ec7bfbcf-5d1f-44f1-ae7e-7c1bd5cb2c92');
    expect(extractUuid('Altitude_variables.ditamap')).toBeNull();
    expect(extractUuid('')).toBeNull();
  });

  it('connect: success sets the registry, persists only {uuid, name}, and toasts the count', async () => {
    loadKeyRegistry.mockResolvedValue(registry({ a: 'R.ditamap', b: 'R.ditamap' }, 'Root.ditamap'));
    const { result } = renderHook(() => useKeyRegistry());
    let ok = false;
    await act(async () => { ok = await result.current.connect(MAP_UUID); });
    expect(ok).toBe(true);
    expect(loadKeyRegistry).toHaveBeenCalledWith(MAP_UUID);
    expect(result.current.registry?.keys.size).toBe(2);
    expect(result.current.connectedMap).toEqual({ uuid: MAP_UUID, name: 'Root.ditamap' });
    expect(JSON.parse(localStorage.getItem(CONNECTED_MAP_STORAGE_KEY)!)).toEqual({ uuid: MAP_UUID, name: 'Root.ditamap' });
    expect(toastSuccess).toHaveBeenCalledWith('Connected Root.ditamap — 2 key definitions loaded');
  });

  it('connect: the toast names skipped submaps and a reached safety cap', async () => {
    loadKeyRegistry.mockResolvedValue({ ...registry({ a: 'R.ditamap' }), mapsSkipped: 3, capped: true });
    const { result } = renderHook(() => useKeyRegistry());
    await act(async () => { await result.current.connect(MAP_UUID); });
    expect(toastSuccess).toHaveBeenCalledWith('Connected Root.ditamap — 1 key definition loaded, 3 submaps could not be read; stopped at the safety limit, so deeper maps were not read');
  });

  it('connect: a failure sets the error for the modal, keeps the previous registry, and does not toast', async () => {
    loadKeyRegistry.mockResolvedValueOnce(registry({ a: 'R.ditamap' }));
    const { result } = renderHook(() => useKeyRegistry());
    await act(async () => { await result.current.connect(MAP_UUID); });
    toastSuccess.mockReset();
    loadKeyRegistry.mockRejectedValueOnce(new MapLoadError('not-found', 'No file with that UUID exists in Heretto.'));
    let ok = true;
    await act(async () => { ok = await result.current.connect('11111111-2222-3333-4444-555555555555'); });
    expect(ok).toBe(false);
    expect(result.current.error).toEqual({ kind: 'not-found', message: 'No file with that UUID exists in Heretto.' });
    expect(result.current.registry?.keys.has('a')).toBe(true);
    expect(result.current.connectedMap?.uuid).toBe(MAP_UUID);
    expect(JSON.parse(localStorage.getItem(CONNECTED_MAP_STORAGE_KEY)!).uuid).toBe(MAP_UUID);
    expect(toastSuccess).not.toHaveBeenCalled();
    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  it('connect: input with no UUID is a not-found error without a fetch', async () => {
    const { result } = renderHook(() => useKeyRegistry());
    await act(async () => { await result.current.connect('not a uuid'); });
    expect(loadKeyRegistry).not.toHaveBeenCalled();
    expect(result.current.error?.kind).toBe('not-found');
  });

  it('reload re-reads the connected map', async () => {
    loadKeyRegistry.mockResolvedValueOnce(registry({ a: 'R.ditamap' }));
    const { result } = renderHook(() => useKeyRegistry());
    await act(async () => { await result.current.connect(MAP_UUID); });
    loadKeyRegistry.mockResolvedValueOnce(registry({ a: 'R.ditamap', b: 'R.ditamap' }));
    await act(async () => { await result.current.reload(); });
    expect(loadKeyRegistry).toHaveBeenLastCalledWith(MAP_UUID);
    expect(result.current.registry?.keys.size).toBe(2);
  });

  it('disconnect clears the registry and the stored map', async () => {
    loadKeyRegistry.mockResolvedValueOnce(registry({ a: 'R.ditamap' }));
    const { result } = renderHook(() => useKeyRegistry());
    await act(async () => { await result.current.connect(MAP_UUID); });
    act(() => { result.current.disconnect(); });
    expect(result.current.registry).toBeNull();
    expect(result.current.connectedMap).toBeNull();
    expect(localStorage.getItem(CONNECTED_MAP_STORAGE_KEY)).toBeNull();
  });

  it('I5: a persisted map restores silently on mount', async () => {
    localStorage.setItem(CONNECTED_MAP_STORAGE_KEY, JSON.stringify({ uuid: MAP_UUID, name: 'Root.ditamap' }));
    loadKeyRegistry.mockResolvedValue(registry({ a: 'R.ditamap' }));
    const { result } = renderHook(() => useKeyRegistry());
    await waitFor(() => expect(result.current.registry).not.toBeNull());
    expect(loadKeyRegistry).toHaveBeenCalledWith(MAP_UUID);
    expect(result.current.connectedMap).toEqual({ uuid: MAP_UUID, name: 'Root.ditamap' });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('I5: a failed restore leaves no registry, no error, no toast — and keeps the stored map for next launch', async () => {
    localStorage.setItem(CONNECTED_MAP_STORAGE_KEY, JSON.stringify({ uuid: MAP_UUID, name: 'Root.ditamap' }));
    loadKeyRegistry.mockRejectedValue(new MapLoadError('network', 'Heretto could not be reached.'));
    const { result } = renderHook(() => useKeyRegistry());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadKeyRegistry).toHaveBeenCalledTimes(1);
    expect(result.current.registry).toBeNull();
    expect(result.current.error).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(CONNECTED_MAP_STORAGE_KEY)).not.toBeNull();
  });

  it('I5: corrupt stored data is ignored', async () => {
    localStorage.setItem(CONNECTED_MAP_STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useKeyRegistry());
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(loadKeyRegistry).not.toHaveBeenCalled();
    expect(result.current.registry).toBeNull();
  });
});
