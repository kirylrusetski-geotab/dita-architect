// @vitest-environment jsdom
//
// ADR-013 amendment (2026-11-18), FR-071 — the registry records the map tree it
// already walks. M1 against the real scrubbed maps in tests/fixtures/maps/
// (counts taken from the files: the User Guide root has 33 top-level topicrefs,
// 94 in all, one submap — the Glossary, 17 glossrefs — of which one top-level
// entry, the VARS keydef, is resource-only and not navigation); `keys` unchanged from
// ADR-013's I1 (18 for the User Guide root). Written before the loader change.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { clearHerettoPathCache } from '../lib/heretto-path';
import { loadKeyRegistry, extractMapEntries, labelForHref, countNodes, type MapNode } from '../lib/heretto-map-loader';
import { herettoFolderCache } from '../constants/heretto';
import { serveHeretto, herettoRequests, type FakeTenant } from './helpers/fakeHeretto';

const MAPS = join(__dirname, 'fixtures', 'maps');
const realMap = (name: string) => readFileSync(join(MAPS, name), 'utf-8');

const altitude = (): FakeTenant => ({
  folders: {
    root: { name: 'master', parent: null },
    alt: { name: 'Altitude', parent: 'root' },
    wh: { name: 'Altitude_Variable_Warehouses', parent: 'alt' },
  },
  files: {
    ug: { name: 'Altitude_User_Guide.ditamap', folder: 'alt', content: realMap('Altitude_User_Guide.ditamap') },
    glos: { name: 'Glossary_Altitude.ditamap', folder: 'alt', content: realMap('Glossary_Altitude.ditamap') },
    vars: { name: 'Altitude_variables.ditamap', folder: 'wh', content: realMap('Altitude_variables.ditamap') },
    vwv: { name: 'Altitude_variables_within_variables.ditamap', folder: 'wh', content: realMap('Altitude_variables_within_variables.ditamap') },
  },
});

const MAP = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<map id="m" class="- map/map "><title class="- topic/title ">M</title>${inner}</map>`;

beforeEach(() => { clearHerettoPathCache(); herettoFolderCache.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

const flat = (nodes: MapNode[]): MapNode[] => nodes.flatMap(n => [n, ...flat(n.children)]);

describe('labels', () => {
  it('navtitle attribute, then <navtitle>, then <topicmeta><navtitle>, then the file name read as words', () => {
    const { nodes } = extractMapEntries(MAP(
      '<topicref navtitle="From the attribute" href="a.dita" class="- map/topicref "/>' +
      '<topicref href="b.dita" class="- map/topicref "><navtitle class="- topic/navtitle ">From the element</navtitle></topicref>' +
      '<topicref href="c.dita" class="- map/topicref "><topicmeta class="- map/topicmeta "><navtitle class="- topic/navtitle "> From  topicmeta </navtitle></topicmeta></topicref>' +
      '<topicref href="User_Guide/Zones/Zone_types.dita#zt" class="- map/topicref "/>'));
    expect(nodes.map(n => n.label)).toEqual(['From the attribute', 'From the element', 'From topicmeta', 'Zone types']);
  });

  it('labelForHref: the file name without extension, underscores and percent-escapes read as spaces and characters', () => {
    expect(labelForHref('User_Guide/Zones/Managing_zone_types.dita')).toBe('Managing zone types');
    expect(labelForHref('Glossary_Altitude.ditamap')).toBe('Glossary Altitude');
    expect(labelForHref('a/Altitude%27s_modules.dita#x')).toBe("Altitude's modules");
    expect(labelForHref(null)).toBe('(untitled)');
  });
});

describe('the tree a map records', () => {
  it('nesting follows the topicrefs, in document order; a submap is a map node; keys ride on their node', () => {
    const { nodes } = extractMapEntries(MAP(
      '<topicref href="p.dita" class="- map/topicref "><topicref href="c1.dita" keys="k1 k2" class="- map/topicref "/><topicref href="c2.dita" class="- map/topicref "/></topicref>' +
      '<mapref href="sub.ditamap" format="ditamap" class="+ map/topicref mapgroup-d/mapref "/>' +
      '<topicref href="other.ditamap" format="ditamap" class="- map/topicref "/>' +
      '<topichead navtitle="A heading" class="+ map/topicref mapgroup-d/topichead "><topicref href="h.dita" class="- map/topicref "/></topichead>'));
    expect(nodes.map(n => [n.kind, n.href])).toEqual([
      ['topic', 'p.dita'], ['map', 'sub.ditamap'], ['map', 'other.ditamap'], ['group', null],
    ]);
    expect(nodes[0].children.map(n => n.href)).toEqual(['c1.dita', 'c2.dita']);
    expect(nodes[0].children[0].keys).toEqual(['k1', 'k2']);
    expect(nodes[3].label).toBe('A heading');
    expect(nodes[3].children.map(n => n.href)).toEqual(['h.dita']);
  });

  it('a relationship table is not navigation and adds no node', () => {
    const { nodes } = extractMapEntries(MAP(
      '<topicref href="a.dita" class="- map/topicref "/>' +
      '<reltable class="- map/reltable "><relrow class="- map/relrow "><relcell class="- map/relcell "><topicref href="r.dita" class="- map/topicref "/></relcell></relrow></reltable>'));
    expect(flat(nodes).map(n => n.href)).toEqual(['a.dita']);
  });

  it('review finding 5/6: an external link is its own kind; a keyref topicref is a topic; resource-only keydefs and ditavalrefs are not navigation', () => {
    const { nodes } = extractMapEntries(MAP(
      '<topicref href="https://example.com/page" scope="external" format="html" class="- map/topicref "/>' +
      '<topicref keyref="k-target" class="- map/topicref "/>' +
      '<keydef keys="k1" processing-role="resource-only" href="w.dita" class="+ map/topicref mapgroup-d/keydef "/>' +
      '<mapref href="vars.ditamap" processing-role="resource-only" class="+ map/topicref mapgroup-d/mapref "/>' +
      '<ditavalref href="f.ditaval" class="+ map/topicref ditavalref-d/ditavalref "/>'));
    expect(nodes.map(n => [n.kind, n.href, n.keyref ?? null, n.label])).toEqual([
      ['external', 'https://example.com/page', null, 'page'],
      ['topic', null, 'k-target', 'k-target'],
      ['map', 'vars.ditamap', null, 'vars'],
    ]);
  });

  it('an href-less element with no children and no label is dropped (nothing to show or open)', () => {
    const { nodes } = extractMapEntries(MAP('<topicref class="- map/topicref "/><topicref href="a.dita" class="- map/topicref "/>'));
    expect(nodes.map(n => n.href)).toEqual(['a.dita']);
  });

  it('the key extraction it shares a walk with is unchanged', () => {
    const xml = MAP('<topicref href="a.dita" keys="k1" class="- map/topicref "><keydef keys="k2" href="b.dita" class="+ map/topicref mapgroup-d/keydef "/></topicref><mapref href="s.ditamap" class="+ map/topicref mapgroup-d/mapref "/>');
    const e = extractMapEntries(xml);
    expect(e.keys.map(k => k.name)).toEqual(['k1', 'k2']);
    expect(e.submaps).toEqual(['s.ditamap']);
  });
});

describe('M1 — the real Altitude maps', () => {
  it('the User Guide root: 32 navigation topicrefs at the top (33 less the resource-only VARS keydef), 93 in all, one submap', async () => {
    serveHeretto(altitude());
    const reg = await loadKeyRegistry('ug');
    const root = reg.maps.get('ug')!;
    expect(root.name).toBe('Altitude_User_Guide.ditamap');
    expect(root.nodes.length).toBe(32);
    expect(countNodes(root.nodes)).toBe(93);
    const mapNodes = flat(root.nodes).filter(n => n.kind === 'map');
    expect(mapNodes.map(n => [n.href, n.mapUuid])).toEqual([['Glossary_Altitude.ditamap', 'glos']]);
    expect(root.nodes[0].label).toBe('Introduction to Altitude');
    expect(root.nodes[0].children.map(n => n.label).slice(0, 2)).toEqual(['Altitudes modules', 'Altitude data']);
  });

  it('the Glossary submap is recorded once with its 17 glossrefs, each carrying its key', async () => {
    serveHeretto(altitude());
    const reg = await loadKeyRegistry('ug');
    const glos = reg.maps.get('glos')!;
    expect(glos.folderUuid).toBe('alt');
    expect(glos.nodes.length).toBe(17);
    expect(glos.nodes.every(n => n.kind === 'topic' && n.keys.length === 1 && n.keys[0].startsWith('GLOS-'))).toBe(true);
    expect(reg.maps.size).toBe(reg.mapsRead);
  });

  it('keys are unchanged from ADR-013 I1: the User Guide root resolves exactly its 18 keys', async () => {
    serveHeretto(altitude());
    const reg = await loadKeyRegistry('ug');
    expect(reg.keys.size).toBe(18);
    expect(reg.keys.has('VARS')).toBe(true);
  });

  it('the warehouse map: its submap (already read elsewhere in the tree or not) points at one entry', async () => {
    serveHeretto(altitude());
    const reg = await loadKeyRegistry('vwv');
    const root = reg.maps.get('vwv')!;
    expect(root.nodes.length).toBe(7);
    const sub = root.nodes.find(n => n.kind === 'map')!;
    expect(sub.mapUuid).toBe('vars');
    // The warehouse map is all resource-only keydefs: no navigation entries, but its 15 keys are registered.
    expect(reg.maps.get('vars')!.nodes.length).toBe(0);
    expect([...reg.keys.values()].filter(d => d.mapUuid === 'vars').length).toBe(15);
  });

  it('recording the tree costs no extra request', async () => {
    serveHeretto(altitude());
    await loadKeyRegistry('ug');
    const contentReads = herettoRequests.filter(u => u.endsWith('/content'));
    expect(new Set(contentReads).size).toBe(contentReads.length);   // each map's content read once
    expect(contentReads.sort()).toEqual(['/heretto-api/all-files/glos/content', '/heretto-api/all-files/ug/content']);
  });
});

describe('submaps that cannot be followed', () => {
  it('an unresolvable submap href leaves mapUuid null; a cycle points back at the map already read', async () => {
    serveHeretto({
      folders: { root: { name: 'master', parent: null } },
      files: {
        a: { name: 'a.ditamap', folder: 'root', content: MAP('<mapref href="b.ditamap" class="+ map/topicref mapgroup-d/mapref "/><mapref href="gone.ditamap" class="+ map/topicref mapgroup-d/mapref "/>') },
        b: { name: 'b.ditamap', folder: 'root', content: MAP('<mapref href="a.ditamap" class="+ map/topicref mapgroup-d/mapref "/>') },
      },
    });
    const reg = await loadKeyRegistry('a');
    const [toB, gone] = reg.maps.get('a')!.nodes;
    expect(toB.mapUuid).toBe('b');
    expect(gone.mapUuid).toBeNull();
    expect(reg.maps.get('b')!.nodes[0].mapUuid).toBe('a');
    expect(reg.mapsSkipped).toBe(1);
  });

  it('a submap whose content fails to load is null too (the view says it could not be read)', async () => {
    serveHeretto({
      folders: { root: { name: 'master', parent: null } },
      files: {
        a: { name: 'a.ditamap', folder: 'root', content: MAP('<mapref href="b.ditamap" class="+ map/topicref mapgroup-d/mapref "/>') },
        b: { name: 'b.ditamap', folder: 'root', content: 'not xml <' },
      },
    });
    const reg = await loadKeyRegistry('a');
    expect(reg.maps.get('a')!.nodes[0].mapUuid).toBeNull();
    expect(reg.maps.has('b')).toBe(false);
  });
});
