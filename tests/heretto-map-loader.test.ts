// @vitest-environment jsdom
//
// ADR-013 — the connected map's key registry (P2-27 / FR-035). Written before
// the loader. The four real maps under tests/fixtures/maps/ are verbatim copies
// of the live tenant's (read 2026-10-27; no emails, hosts, or URLs in them);
// the folder tree around them is a fake tenant that answers the REST shapes
// Heretto returns: a folder's XML carries `parent-folder-id` and a `<children>`
// listing, a resource's XML its `folder-uuid` and `<name>`, `/content` the file.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveHerettoPath, clearHerettoPathCache } from '../lib/heretto-path';
import { loadKeyRegistry, MapLoadError, MAX_MAP_LEVELS, MAX_MAPS } from '../lib/heretto-map-loader';
import { herettoFolderCache } from '../constants/heretto';

const MAPS = join(__dirname, 'fixtures', 'maps');
const realMap = (name: string) => readFileSync(join(MAPS, name), 'utf-8');

interface FakeFolder { name: string; parent: string | null }
interface FakeFile { name: string; folder: string; content: string }
interface FakeTenant { folders: Record<string, FakeFolder>; files: Record<string, FakeFile> }

let requests: string[] = [];

/** Install a fetch stub serving `t`. `fail` maps a URL path to a forced outcome. */
function serve(t: FakeTenant, fail: Record<string, 'network' | number> = {}) {
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input);
    requests.push(url);
    const forced = fail[url];
    if (forced === 'network') throw new TypeError('Failed to fetch');
    if (typeof forced === 'number') return new Response('nope', { status: forced });
    const m = url.match(/^\/heretto-api\/all-files\/([^/]+)(\/content)?$/);
    if (!m) return new Response('not found', { status: 404 });
    const [, uuid, content] = m;
    const folder = t.folders[uuid];
    if (folder && !content) {
      const kids = [
        ...Object.entries(t.folders).filter(([, f]) => f.parent === uuid).map(([id, f]) => `<folder name="${f.name}" id="${id}"/>`),
        ...Object.entries(t.files).filter(([, f]) => f.folder === uuid).map(([id, f]) => `<resource name="${f.name}" type="Map" id="${id}" mime-type="application/xml" xmldb-type="XMLResource" />`),
      ].join('');
      const parentAttr = folder.parent ? ` parent-folder-id="${folder.parent}"` : '';
      return new Response(`<?xml version="1.0" ?><folder id="${uuid}"${parentAttr}><name>${folder.name}</name><children>${kids}</children></folder>`, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    const file = t.files[uuid];
    if (file && !content) {
      return new Response(`<?xml version="1.0" ?><resource id="${uuid}" folder-uuid="${file.folder}"><name>${file.name}</name><mime-type>application/xml</mime-type></resource>`, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    if (file && content) return new Response(file.content, { status: 200, headers: { 'content-type': 'application/xml' } });
    return new Response('not found', { status: 404 });
  }));
}

const MAP = (inner: string, title = 'M') =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">\n<map id="m" class="- map/map "><title class="- topic/title ">${title}</title>${inner}</map>`;
const KEYDEF = (keys: string, href: string) => `<keydef keys="${keys}" processing-role="resource-only" href="${href}" class="+ map/topicref mapgroup-d/keydef "/>`;
const MAPREF = (href: string) => `<mapref format="ditamap" processing-role="resource-only" href="${href}" class="+ map/topicref mapgroup-d/mapref "/>`;

beforeEach(() => {
  clearHerettoPathCache();
  herettoFolderCache.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── The real Altitude maps (I1) ─────────────────────────────────────────────

/** The real layout: Altitude/{Altitude_User_Guide, Glossary_Altitude}.ditamap,
 *  Altitude/Altitude_Variable_Warehouses/{Altitude_variables, …within_variables}.ditamap. */
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

const GLOS_KEYS = [
  'GLOS-Destination', 'GLOS-Connector', 'GLOS-Expansion', 'GLOS-Origin', 'GLOS-TAZ', 'GLOS-Radius',
  'GLOS-Zones', 'GLOS-Dwell', 'GLOS-Industry', 'GLOS-JourneyCount', 'GLOS-JourneyDuration', 'GLOS-TimeAt',
  'GLOS-Trip', 'GLOS-TripChain', 'GLOS-Vocation', 'GLOS-Overlap', 'GLOS-Stop',
];
const WAREHOUSE_KEYS = ['varsAltitude', 'varsAltitudeUI', 'varsAltitudeNotes', 'varsAltitudeNav', 'varsAltitudeXREF'];

describe('I1: the real Altitude maps', () => {
  it('the User Guide root resolves exactly its 18 keys (VARS + 17 GLOS-*, 2 of them on plain <topicref>)', async () => {
    serve(altitude());
    const reg = await loadKeyRegistry('ug');
    expect([...reg.keys.keys()].sort()).toEqual(['VARS', ...GLOS_KEYS].sort());
    expect(reg.map).toEqual({ uuid: 'ug', name: 'Altitude_User_Guide.ditamap' });
    expect(reg.mapsRead).toBe(2);
    expect(reg.mapsSkipped).toBe(0);
    expect(reg.capped).toBe(false);
    expect(reg.keys.get('VARS')).toMatchObject({ href: 'Altitude_Library/Altitude_Variables.dita', mapName: 'Altitude_User_Guide.ditamap', mapUuid: 'ug', mapFolderUuid: 'alt' });
    // A key from the submap names the submap it came from.
    expect(reg.keys.get('GLOS-Stop')).toMatchObject({ href: 'Altitude_Library/Glossary/Stop.dita', mapName: 'Glossary_Altitude.ditamap', mapUuid: 'glos' });
  });

  it('the warehouse map resolves its 15 keys, the five warehouse keys among them', async () => {
    serve(altitude());
    const reg = await loadKeyRegistry('vars');
    expect(reg.keys.size).toBe(15);
    for (const k of WAREHOUSE_KEYS) expect(reg.keys.has(k)).toBe(true);
    expect(reg.keys.get('varsAltitudeUI')?.href).toBe('Altitude_UI_Warehouse.dita');
    // A fragment is kept as written.
    expect(reg.keys.get('vehicle-types')?.href).toBe('../Data_Dictionary/Platform/Vehicle_filters/Vehicle_types.dita#reference-4029');
  });

  it('variables-within-variables reaches the warehouse keys through its <mapref> (level 1)', async () => {
    serve(altitude());
    const reg = await loadKeyRegistry('vwv');
    expect(reg.keys.size).toBe(15);
    expect(reg.mapsRead).toBe(2);
    expect(reg.keys.get('varsAltitude')).toMatchObject({ mapName: 'Altitude_variables.ditamap', mapUuid: 'vars' });
  });
});

// ─── Precedence, depth, cycles, missing submaps (I1b) ───────────────────────

describe('I1b: DITA 1.3 precedence and the tree walk', () => {
  it('the shallowest definition wins even when a deeper map comes first in document order', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: {
        root: { name: 'root.ditamap', folder: 'f', content: MAP(MAPREF('a.ditamap') + MAPREF('b.ditamap')) },
        // a.ditamap (first in document order) only reaches the key one level deeper.
        a: { name: 'a.ditamap', folder: 'f', content: MAP(MAPREF('deep.ditamap')) },
        deep: { name: 'deep.ditamap', folder: 'f', content: MAP(KEYDEF('k', 'from-level-2.dita')) },
        b: { name: 'b.ditamap', folder: 'f', content: MAP(KEYDEF('k', 'from-level-1.dita')) },
      },
    });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.get('k')?.href).toBe('from-level-1.dita');
    expect(reg.duplicates).toBe(1);
  });

  it('within one map the first definition in document order wins; a referencing map beats its submap', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: {
        root: { name: 'root.ditamap', folder: 'f', content: MAP(MAPREF('sub.ditamap') + KEYDEF('k', 'first.dita') + KEYDEF('k', 'second.dita')) },
        sub: { name: 'sub.ditamap', folder: 'f', content: MAP(KEYDEF('k', 'sub.dita')) },
      },
    });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.get('k')?.href).toBe('first.dita');
    expect(reg.duplicates).toBe(2);
  });

  it('a five-level chain resolves its deepest key (no three-level cap)', async () => {
    const files: Record<string, FakeFile> = {};
    for (let i = 0; i <= 5; i++) {
      files[`m${i}`] = { name: `m${i}.ditamap`, folder: 'f', content: MAP(i < 5 ? MAPREF(`m${i + 1}.ditamap`) : KEYDEF('deepest', 'd.dita')) };
    }
    serve({ folders: { f: { name: 'F', parent: null } }, files });
    const reg = await loadKeyRegistry('m0');
    expect(reg.keys.get('deepest')?.mapName).toBe('m5.ditamap');
    expect(reg.mapsRead).toBe(6);
    expect(reg.capped).toBe(false);
  });

  it(`stops at ${MAX_MAP_LEVELS} levels and says so`, async () => {
    const files: Record<string, FakeFile> = {};
    const n = MAX_MAP_LEVELS + 3;
    for (let i = 0; i <= n; i++) {
      files[`m${i}`] = { name: `m${i}.ditamap`, folder: 'f', content: MAP((i < n ? MAPREF(`m${i + 1}.ditamap`) : '') + KEYDEF(`k${i}`, 'x.dita')) };
    }
    serve({ folders: { f: { name: 'F', parent: null } }, files });
    const reg = await loadKeyRegistry('m0');
    expect(reg.capped).toBe(true);
    expect(reg.keys.has(`k${MAX_MAP_LEVELS}`)).toBe(true);
    expect(reg.keys.has(`k${MAX_MAP_LEVELS + 1}`)).toBe(false);
  });

  it(`stops at ${MAX_MAPS} maps and says so`, async () => {
    const files: Record<string, FakeFile> = {};
    const fan = MAX_MAPS + 20;
    files.root = { name: 'root.ditamap', folder: 'f', content: MAP(Array.from({ length: fan }, (_, i) => MAPREF(`s${i}.ditamap`)).join('')) };
    for (let i = 0; i < fan; i++) files[`s${i}`] = { name: `s${i}.ditamap`, folder: 'f', content: MAP(KEYDEF(`k${i}`, 'x.dita')) };
    serve({ folders: { f: { name: 'F', parent: null } }, files });
    const reg = await loadKeyRegistry('root');
    expect(reg.capped).toBe(true);
    expect(reg.mapsRead).toBe(MAX_MAPS);
  });

  it('a cycle terminates and every map is read once', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: {
        a: { name: 'a.ditamap', folder: 'f', content: MAP(MAPREF('b.ditamap') + KEYDEF('ka', 'a.dita')) },
        b: { name: 'b.ditamap', folder: 'f', content: MAP(MAPREF('a.ditamap') + KEYDEF('kb', 'b.dita')) },
      },
    });
    const reg = await loadKeyRegistry('a');
    expect([...reg.keys.keys()].sort()).toEqual(['ka', 'kb']);
    expect(reg.mapsRead).toBe(2);
    expect(requests.filter(r => r === '/heretto-api/all-files/a/content')).toHaveLength(1);
  });

  it('a missing submap is skipped and counted; the connect still succeeds', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: { root: { name: 'root.ditamap', folder: 'f', content: MAP(MAPREF('gone.ditamap') + KEYDEF('k', 'k.dita')) } },
    });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.has('k')).toBe(true);
    expect(reg.mapsSkipped).toBe(1);
  });

  it('a submap whose fetch fails is skipped and counted', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: {
        root: { name: 'root.ditamap', folder: 'f', content: MAP(MAPREF('sub.ditamap') + KEYDEF('k', 'k.dita')) },
        sub: { name: 'sub.ditamap', folder: 'f', content: MAP(KEYDEF('s', 's.dita')) },
      },
    }, { '/heretto-api/all-files/sub/content': 500 });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.has('k')).toBe(true);
    expect(reg.keys.has('s')).toBe(false);
    expect(reg.mapsSkipped).toBe(1);
  });

  it('submap paths resolve against the submap\'s own folder, climbing with ..', async () => {
    serve({
      folders: {
        root: { name: 'master', parent: null },
        a: { name: 'A', parent: 'root' },
        b: { name: 'B', parent: 'root' },
        bc: { name: 'C', parent: 'b' },
      },
      files: {
        top: { name: 'top.ditamap', folder: 'a', content: MAP(MAPREF('../B/C/mid.ditamap')) },
        // mid lives in B/C; its own relative ref climbs from there.
        mid: { name: 'mid.ditamap', folder: 'bc', content: MAP(MAPREF('../../A/leaf.ditamap')) },
        leaf: { name: 'leaf.ditamap', folder: 'a', content: MAP(KEYDEF('leafKey', 'l.dita')) },
      },
    });
    const reg = await loadKeyRegistry('top');
    expect(reg.keys.get('leafKey')).toMatchObject({ mapUuid: 'leaf', mapFolderUuid: 'a' });
    expect(reg.mapsSkipped).toBe(0);
  });
});

// ─── What counts as a key and a submap ──────────────────────────────────────

describe('key and submap extraction', () => {
  it('@keys on any element defines each whitespace-separated name', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: {
        root: { name: 'root.ditamap', folder: 'f', content: MAP(
          '<topicref keys="a  b" href="ab.dita" class="- map/topicref "/>' +
          '<glossref keys="g" href="g.dita" class="+ map/topicref glossref-d/glossref "/>' +
          '<topicsetref keys="ts" href="ts.ditamap" class="+ map/topicref mapgroup-d/topicsetref "/>' +
          '<topichead navtitle="h" class="+ map/topicref mapgroup-d/topichead "><topicref keys="nested" href="n.dita" class="- map/topicref "/></topichead>',
        ) },
      },
    });
    const reg = await loadKeyRegistry('root');
    expect([...reg.keys.keys()].sort()).toEqual(['a', 'b', 'g', 'nested', 'ts']);
    expect(reg.keys.get('b')?.href).toBe('ab.dita');
  });

  it('a key with no href is a valid key definition (href null)', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: { root: { name: 'root.ditamap', folder: 'f', content: MAP('<keydef keys="textKey" class="+ map/topicref mapgroup-d/keydef "><topicmeta class="- map/topicmeta "><keywords class="- topic/keywords "><keyword class="- topic/keyword ">Text</keyword></keywords></topicmeta></keydef>') } },
    });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.get('textKey')?.href).toBeNull();
  });

  it('<topicref format="ditamap"> is a submap like <mapref>', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: {
        root: { name: 'root.ditamap', folder: 'f', content: MAP('<topicref format="ditamap" href="sub.ditamap" class="- map/topicref "/>') },
        sub: { name: 'sub.ditamap', folder: 'f', content: MAP(KEYDEF('s', 's.dita')) },
      },
    });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.has('s')).toBe(true);
  });

  it('keys inside a @keyscope register as scope.key, and bare only when no unscoped definition exists', async () => {
    serve({
      folders: { f: { name: 'F', parent: null } },
      files: { root: { name: 'root.ditamap', folder: 'f', content: MAP(
        '<topicref keyscope="s1" class="- map/topicref ">' + KEYDEF('shared', 's1.dita') + KEYDEF('only', 'only-s1.dita') + '</topicref>' +
        '<topicref keyscope="s2" class="- map/topicref ">' + KEYDEF('shared', 's2.dita') + '</topicref>' +
        KEYDEF('shared', 'unscoped.dita'),
      ) } },
    });
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.get('s1.shared')).toMatchObject({ href: 's1.dita', scope: 's1' });
    expect(reg.keys.get('s2.shared')).toMatchObject({ href: 's2.dita', scope: 's2' });
    expect(reg.keys.get('shared')).toMatchObject({ href: 'unscoped.dita' });
    expect(reg.keys.get('shared')?.scope).toBeUndefined();
    expect(reg.keys.get('only')).toMatchObject({ href: 'only-s1.dita', scope: 's1' });
  });
});

// ─── Failures of the connected map itself ────────────────────────────────────

describe('connect failures (each a distinct kind, for the modal)', () => {
  const one = (content: string): FakeTenant => ({ folders: { f: { name: 'F', parent: null } }, files: { root: { name: 'root.ditamap', folder: 'f', content } } });

  it('network failure', async () => {
    serve(one(MAP('')), { '/heretto-api/all-files/root': 'network' });
    await expect(loadKeyRegistry('root')).rejects.toMatchObject({ kind: 'network' });
  });

  it('not found / bad UUID', async () => {
    serve(one(MAP('')));
    const err = await loadKeyRegistry('no-such-uuid').catch(e => e);
    expect(err).toBeInstanceOf(MapLoadError);
    expect(err.kind).toBe('not-found');
  });

  it('a topic, not a map', async () => {
    serve(one('<?xml version="1.0"?><concept id="c" class="- topic/topic concept/concept "><title>T</title></concept>'));
    await expect(loadKeyRegistry('root')).rejects.toMatchObject({ kind: 'not-a-map' });
  });

  it('malformed XML', async () => {
    serve(one('<map><title>broken</map'));
    await expect(loadKeyRegistry('root')).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('a bookmap is a map', async () => {
    serve(one('<?xml version="1.0"?><bookmap id="b" class="- map/map bookmap/bookmap "><chapter keys="ch" href="c.dita" class="- map/topicref bookmap/chapter "/></bookmap>'));
    const reg = await loadKeyRegistry('root');
    expect(reg.keys.has('ch')).toBe(true);
  });
});

// ─── Path resolution (lib/heretto-path.ts) ───────────────────────────────────

describe('resolveHerettoPath', () => {
  const tree = (): FakeTenant => ({
    folders: {
      root: { name: 'master', parent: null },
      a: { name: 'A', parent: 'root' },
      ab: { name: 'B', parent: 'a' },
      // Same filename in two folders: resolution is by path, never by name alone.
      c: { name: 'C', parent: 'root' },
    },
    files: {
      t1: { name: 'topic.dita', folder: 'ab', content: '<topic id="t"/>' },
      t2: { name: 'topic.dita', folder: 'c', content: '<topic id="t"/>' },
      t3: { name: 'here.dita', folder: 'a', content: '<topic id="h"/>' },
    },
  });

  it('resolves a plain name in the same folder', async () => {
    serve(tree());
    expect(await resolveHerettoPath('here.dita', 'a')).toEqual({ uuid: 't3', name: 'here.dita', folderUuid: 'a' });
  });

  it('resolves named segments and ignores the fragment', async () => {
    serve(tree());
    expect(await resolveHerettoPath('B/topic.dita#t/x', 'a')).toEqual({ uuid: 't1', name: 'topic.dita', folderUuid: 'ab' });
  });

  it('climbs with .. through parent-folder-id, including above where the walk started', async () => {
    serve(tree());
    expect(await resolveHerettoPath('../../C/topic.dita', 'ab')).toEqual({ uuid: 't2', name: 'topic.dita', folderUuid: 'c' });
    expect(await resolveHerettoPath('./B/../here.dita', 'a')).toEqual({ uuid: 't3', name: 'here.dita', folderUuid: 'a' });
  });

  it('returns null for a missing segment, a missing file, .. above the root, or an absolute/scheme href', async () => {
    serve(tree());
    expect(await resolveHerettoPath('Nope/topic.dita', 'a')).toBeNull();
    expect(await resolveHerettoPath('missing.dita', 'a')).toBeNull();
    expect(await resolveHerettoPath('../../../x.dita', 'a')).toBeNull();
    expect(await resolveHerettoPath('/abs/x.dita', 'a')).toBeNull();
    expect(await resolveHerettoPath('https://example.com/x.dita', 'a')).toBeNull();
    expect(await resolveHerettoPath('', 'a')).toBeNull();
  });

  it('decodes percent-encoded segments', async () => {
    serve({ folders: { f: { name: 'My Folder', parent: null }, g: { name: 'Sub Dir', parent: 'f' } }, files: { x: { name: 'a b.dita', folder: 'g', content: '<topic id="a"/>' } } });
    expect(await resolveHerettoPath('Sub%20Dir/a%20b.dita', 'f')).toEqual({ uuid: 'x', name: 'a b.dita', folderUuid: 'g' });
  });

  it('fetches each folder listing once (cached) and shares the listing with herettoFolderCache', async () => {
    serve(tree());
    await resolveHerettoPath('B/topic.dita', 'a');
    await resolveHerettoPath('B/topic.dita', 'a');
    expect(requests.filter(r => r === '/heretto-api/all-files/a')).toHaveLength(1);
    expect(herettoFolderCache.get('a')?.map(i => i.name).sort()).toEqual(['B', 'here.dita']);
  });
});
