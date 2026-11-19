// @vitest-environment jsdom
//
// FR-071 — the Map view over a registry built from the real fixture maps.
// M1 through the panel: the User Guide's 33 top-level topicrefs, the Glossary
// submap expanding in place to its 17 glossrefs, the 18 keys. M2: the view has
// no path to any tab's content (by construction: it takes no tab state and its
// source writes none) and connecting/expanding sends only reads. M3: an href
// that does not resolve shows "missing" and is not clickable; a failed listing
// shows "could not check", never "missing", and a click checks again.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MapView } from '../../components/workbench/views/MapView';
import { loadKeyRegistry, type KeyRegistry } from '../../lib/heretto-map-loader';
import { clearHerettoPathCache } from '../../lib/heretto-path';
import { herettoFolderCache } from '../../constants/heretto';
import { serveHeretto, herettoRequests, type FakeTenant } from '../helpers/fakeHeretto';

const MAPS = join(__dirname, '..', 'fixtures', 'maps');
const realMap = (name: string) => readFileSync(join(MAPS, name), 'utf-8');

const MAP = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<map id="m" class="- map/map "><title class="- topic/title ">M</title>${inner}</map>`;

const altitude = (): FakeTenant => ({
  folders: { root: { name: 'master', parent: null }, alt: { name: 'Altitude', parent: 'root' }, wh: { name: 'Altitude_Variable_Warehouses', parent: 'alt' } },
  files: {
    ug: { name: 'Altitude_User_Guide.ditamap', folder: 'alt', content: realMap('Altitude_User_Guide.ditamap') },
    glos: { name: 'Glossary_Altitude.ditamap', folder: 'alt', content: realMap('Glossary_Altitude.ditamap') },
  },
});

/** A tiny map in `docs/`: one topic that exists, one that does not, one in a folder whose listing fails. */
const small = (): FakeTenant => ({
  folders: { root: { name: 'master', parent: null }, docs: { name: 'docs', parent: 'root' }, flaky: { name: 'flaky', parent: 'docs' } },
  files: {
    m: { name: 'small.ditamap', folder: 'docs', content: MAP(
      '<topicref href="here.dita" keys="k-here" class="- map/topicref "/>' +
      '<topicref href="gone.dita" class="- map/topicref "/>' +
      '<topicref href="flaky/x.dita" class="- map/topicref "/>') },
    here: { name: 'here.dita', folder: 'docs', content: '<concept id="h"/>' },
    x: { name: 'x.dita', folder: 'flaky', content: '<concept id="x"/>' },
  },
});

beforeEach(() => { clearHerettoPathCache(); herettoFolderCache.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

function renderMap(registry: KeyRegistry | null, over: Partial<React.ComponentProps<typeof MapView>> = {}) {
  const props: React.ComponentProps<typeof MapView> = {
    registry, connectedMap: registry ? { uuid: registry.map.uuid, name: registry.map.name } : null, loading: false, herettoConnected: true,
    openFileUuids: new Set(), onConnect: vi.fn(), onReload: vi.fn(), onDisconnect: vi.fn(), onOpenTopic: vi.fn(), ...over,
  };
  return { ...render(<MapView {...props} />), props };
}

const topLevel = () => within(screen.getByTestId('map-tree')).getAllByRole('treeitem').filter(r => r.getAttribute('aria-level') === '1');

describe('M1 through the panel — the real User Guide map', () => {
  it('32 top-level rows (the resource-only VARS keydef is in Keys, not the tree), the Glossary submap expands in place to 17 keyed rows; 18 keys listed', async () => {
    serveHeretto(altitude());
    const reg = await loadKeyRegistry('ug');
    renderMap(reg);
    expect(topLevel().length).toBe(32);
    expect(topLevel()[0]).toHaveTextContent('Introduction to Altitude');
    expect(screen.getByTestId('map-card')).toHaveTextContent('18 keys · 2 maps read');
    const glos = topLevel().find(r => r.textContent?.includes('Glossary Altitude'))!;
    expect(glos).toHaveAttribute('data-state', 'map');
    expect(glos).toHaveTextContent('17 keys');
    fireEvent.click(glos);
    const nested = within(screen.getByTestId('map-tree')).getAllByRole('treeitem').filter(r => r.getAttribute('aria-level') === '2');
    expect(nested.length).toBe(17);
    expect(nested.every(r => /1 key/.test(r.textContent ?? ''))).toBe(true);
    expect(within(screen.getByTestId('map-keys')).getAllByTestId('map-key').length).toBe(18);
  });

  it('the key filter narrows the list', async () => {
    serveHeretto(altitude());
    renderMap(await loadKeyRegistry('ug'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter keys' }), { target: { value: 'GLOS-Trip' } });
    expect(within(screen.getByTestId('map-keys')).getAllByTestId('map-key').map(k => k.textContent?.split('…')[0])).toEqual([
      expect.stringContaining('GLOS-Trip'), expect.stringContaining('GLOS-TripChain'),
    ]);
  });
});

describe('M3 — resolution states', () => {
  it('found: clickable, opens the target; missing: struck, not clickable; error: "could not check", never "missing"', async () => {
    serveHeretto(small());
    const reg = await loadKeyRegistry('m');
    clearHerettoPathCache(); herettoFolderCache.clear();
    serveHeretto(small(), { '/heretto-api/all-files/flaky': 500 });
    const { props } = renderMap(reg);
    const [here, gone, flaky] = topLevel();
    await waitFor(() => expect(here).toHaveAttribute('data-state', 'found'));
    await waitFor(() => expect(gone).toHaveAttribute('data-state', 'missing'));
    await waitFor(() => expect(flaky).toHaveAttribute('data-state', 'error'));
    expect(gone).toHaveTextContent('missing');
    expect(gone).toHaveAttribute('aria-disabled', 'true');
    expect(flaky).toHaveTextContent('could not check');
    expect(flaky).not.toHaveTextContent('missing');

    fireEvent.click(gone);
    expect(props.onOpenTopic).not.toHaveBeenCalled();
    fireEvent.click(here);
    expect(props.onOpenTopic).toHaveBeenCalledWith({ uuid: 'here', name: 'here.dita', folderUuid: 'docs' });

    // The listing recovers; a click on "could not check" checks again.
    clearHerettoPathCache(); herettoFolderCache.clear();
    serveHeretto(small());
    fireEvent.click(flaky);
    await waitFor(() => expect(topLevel()[2]).toHaveAttribute('data-state', 'found'));
  });

  it('a topic open in a tab carries the dot', async () => {
    serveHeretto(small());
    const reg = await loadKeyRegistry('m');
    renderMap(reg, { openFileUuids: new Set(['here']) });
    await waitFor(() => expect(within(topLevel()[0]).getByTestId('map-row-open')).toBeInTheDocument());
    expect(within(topLevel()[1]).queryByTestId('map-row-open')).toBeNull();
  });
});

describe('M2 — the panel changes nothing in any tab', () => {
  it('expanding and resolving only read: every request is a GET of a listing', async () => {
    serveHeretto(altitude());
    const reg = await loadKeyRegistry('ug');
    clearHerettoPathCache(); herettoFolderCache.clear();       // make the panel fetch for itself
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    herettoRequests.length = 0;
    renderMap(reg);
    fireEvent.click(topLevel()[0]);
    await waitFor(() => expect(herettoRequests.length).toBeGreaterThan(0));
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.method ?? 'GET').toBe('GET');
    }
    expect(herettoRequests.every(u => /^\/heretto-api\/all-files\/[^/]+$/.test(u))).toBe(true);
  });

  it('by construction: the view takes no tab state and its source writes none', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'components', 'workbench', 'views', 'MapView.tsx'), 'utf-8');
    expect(src).not.toMatch(/setTabs|updateTab|xmlContent|savedXmlRef/);
    const block = src.slice(src.indexOf('export interface MapViewProps'));
    const props = [...block.slice(0, block.indexOf('\n}')).matchAll(/^ {2}(\w+)\??:/gm)].map(m => m[1]);
    expect(props).toEqual(['registry', 'connectedMap', 'loading', 'herettoConnected', 'openFileUuids', 'onConnect', 'onReload', 'onDisconnect', 'onOpenTopic']);
  });

  it('Reload, Change and Disconnect call their handlers; no map shows Connect', async () => {
    serveHeretto(small());
    const reg = await loadKeyRegistry('m');
    const { props, unmount } = renderMap(reg);
    fireEvent.click(screen.getByRole('button', { name: /Reload/ }));
    fireEvent.click(screen.getByRole('button', { name: /Change/ }));
    fireEvent.click(screen.getByRole('button', { name: /Disconnect/ }));
    expect(props.onReload).toHaveBeenCalled();
    expect(props.onConnect).toHaveBeenCalled();
    expect(props.onDisconnect).toHaveBeenCalled();
    unmount();
    const none = renderMap(null);
    fireEvent.click(screen.getByRole('button', { name: /Connect a Map/ }));
    expect(none.props.onConnect).toHaveBeenCalled();
  });
});

describe('the adversarial review\'s map findings, pinned', () => {
  const edges = (): FakeTenant => ({
    folders: { root: { name: 'master', parent: null }, docs: { name: 'docs', parent: 'root' } },
    files: {
      m: { name: 'edges.ditamap', folder: 'docs', content: MAP(
        '<keydef keys="k-real" href="real.dita" processing-role="resource-only" class="+ map/topicref mapgroup-d/keydef "/>' +
        '<topicref href="https://example.com/page" scope="external" format="html" class="- map/topicref "/>' +
        '<topicref keyref="k-real" class="- map/topicref "/>' +
        '<topicref keyref="k-nowhere" class="- map/topicref "/>' +
        '<topicref href="real.dita" class="- map/topicref "/>') },
      real: { name: 'real.dita', folder: 'docs', content: '<concept id="r"/>' },
    },
  });

  it('finding 5: an external link is shown as external, never "missing", and opens nothing', async () => {
    serveHeretto(edges());
    const { props } = renderMap(await loadKeyRegistry('m'));
    const ext = topLevel()[0];
    expect(ext).toHaveAttribute('data-state', 'external');
    expect(ext).toHaveTextContent('external');
    expect(ext).not.toHaveTextContent('missing');
    fireEvent.click(ext);
    expect(props.onOpenTopic).not.toHaveBeenCalled();
  });

  it('finding 6: a keyref topicref resolves through the key; an undefined key says so and is not clickable', async () => {
    serveHeretto(edges());
    const { props } = renderMap(await loadKeyRegistry('m'));
    const [, viaKey, noKey] = topLevel();
    await waitFor(() => expect(viaKey).toHaveAttribute('data-state', 'found'));
    expect(noKey).toHaveAttribute('data-state', 'missing');
    expect(noKey).toHaveTextContent('key not defined');
    fireEvent.click(noKey);
    expect(props.onOpenTopic).not.toHaveBeenCalled();
    fireEvent.click(viaKey);
    expect(props.onOpenTopic).toHaveBeenCalledWith({ uuid: 'real', name: 'real.dita', folderUuid: 'docs' });
    expect(topLevel().length).toBe(4);                     // the resource-only keydef is not a row
  });

  it('finding 11: the tree is one tab stop; arrow keys, Home and End move focus', async () => {
    serveHeretto(altitude());
    renderMap(await loadKeyRegistry('ug'));
    const rows = topLevel();
    expect(rows.filter(r => r.getAttribute('tabindex') === '0').length).toBe(1);
    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(topLevel()[1]);
    fireEvent.keyDown(topLevel()[1], { key: 'End' });
    expect(document.activeElement).toBe(topLevel().at(-1));
    fireEvent.keyDown(topLevel().at(-1)!, { key: 'Home' });
    expect(document.activeElement).toBe(topLevel()[0]);
    expect(topLevel().filter(r => r.getAttribute('tabindex') === '0')).toEqual([topLevel()[0]]);
  });
});
