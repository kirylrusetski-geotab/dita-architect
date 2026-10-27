// The connected map's key registry (ADR-013 decisions 2–4; P2-27 / FR-035).
//
// Reads a ditamap from Heretto and every map it references, and records each
// key's effective definition. What the real maps do (all 449 in the tenant were
// read 2026-10-27) decides the rules here:
//  - keys live on any element with @keys — 91% on a plain <topicref>, not a
//    <keydef>/<glossref> — and one @keys may name several keys;
//  - submaps are <mapref> or any element with format="ditamap", always by a
//    relative path, resolved against the folder of the map that holds it;
//  - trees reach 5 levels (the production Help Center), so there is no fixed
//    three-level cap: a visited set stops cycles and a safety cap stops
//    runaway structure, reported as `capped`;
//  - DITA 1.3 precedence: the first definition in a breadth-first walk wins —
//    the shallowest map, then document order within it.
import { resolveHerettoPath } from './heretto-path';

/** Safety caps (ADR-013): twice the largest real tree (164 maps, 5 levels). */
export const MAX_MAP_LEVELS = 10;
export const MAX_MAPS = 300;

export type MapLoadErrorKind = 'network' | 'not-found' | 'not-a-map' | 'malformed';

/** Why the connected map itself could not be read. Submap failures never throw. */
export class MapLoadError extends Error {
  constructor(public kind: MapLoadErrorKind, message: string) {
    super(message);
    this.name = 'MapLoadError';
  }
}

export interface KeyDefinition {
  /** The href exactly as the map writes it (fragment included), or null. */
  href: string | null;
  mapName: string;
  mapUuid: string;
  /** The folder of the map that defines the key: `href` is relative to it. */
  mapFolderUuid: string;
  /** Set when the key was defined inside a @keyscope (the scope's name). */
  scope?: string;
}

export interface KeyRegistry {
  map: { uuid: string; name: string };
  keys: Map<string, KeyDefinition>;
  /** Maps read, the connected one included. */
  mapsRead: number;
  /** Submaps that were referenced but could not be resolved, fetched, or parsed. */
  mapsSkipped: number;
  /** True when a safety cap stopped the walk before the tree ended. */
  capped: boolean;
  /** Later definitions of an already-defined key (ignored, per precedence). */
  duplicates: number;
}

interface MapFile { uuid: string; name: string; folderUuid: string }

interface MapEntries {
  /** In document order. `scope` is the dotted keyscope chain, if any. */
  keys: { name: string; href: string | null; scope?: string }[];
  submaps: string[];
}

const isMapRoot = (el: Element): boolean =>
  el.tagName === 'map' || ` ${el.getAttribute('class') ?? ''} `.includes(' map/map ');

/** Parse map XML. Throws MapLoadError('malformed' | 'not-a-map'). */
export const extractMapEntries = (xml: string): MapEntries => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new MapLoadError('malformed', 'The map is not well-formed XML.');
  const root = doc.documentElement;
  if (!isMapRoot(root)) throw new MapLoadError('not-a-map', `This file is a <${root.tagName}>, not a map.`);

  const entries: MapEntries = { keys: [], submaps: [] };
  const walk = (el: Element, scope: string | undefined) => {
    // A @keyscope element's own keys and everything inside it are in its scope.
    const scopeName = el.getAttribute('keyscope')?.trim().split(/\s+/)[0];
    const here = scopeName ? (scope ? `${scope}.${scopeName}` : scopeName) : scope;
    const href = el.getAttribute('href');
    const keys = el.getAttribute('keys');
    if (keys) {
      for (const name of keys.trim().split(/\s+/)) entries.keys.push({ name, href: href || null, ...(here ? { scope: here } : null) });
    }
    if (href && (el.tagName === 'mapref' || el.getAttribute('format') === 'ditamap')) entries.submaps.push(href);
    for (const child of Array.from(el.children)) walk(child, here);
  };
  walk(root, undefined);
  return entries;
};

/** Metadata + content of one map. Throws MapLoadError for the connected map's failure modes. */
const fetchMap = async (uuid: string): Promise<{ file: MapFile; xml: string }> => {
  let meta: Response;
  try {
    meta = await fetch(`/heretto-api/all-files/${uuid}`);
  } catch {
    throw new MapLoadError('network', 'Heretto could not be reached.');
  }
  if (meta.status === 400 || meta.status === 404) throw new MapLoadError('not-found', 'No file with that UUID exists in Heretto.');
  if (!meta.ok) throw new MapLoadError('network', `Heretto answered HTTP ${meta.status}.`);
  const metaDoc = new DOMParser().parseFromString(await meta.text(), 'text/xml');
  const resource = metaDoc.documentElement;
  if (metaDoc.querySelector('parsererror') || resource.tagName !== 'resource') {
    throw new MapLoadError('not-a-map', 'That UUID is a folder or something other than a file.');
  }
  const file: MapFile = {
    uuid,
    name: resource.querySelector('name')?.textContent?.trim() || uuid,
    folderUuid: resource.getAttribute('folder-uuid') || '',
  };

  let content: Response;
  try {
    content = await fetch(`/heretto-api/all-files/${uuid}/content`);
  } catch {
    throw new MapLoadError('network', 'Heretto could not be reached.');
  }
  if (!content.ok) throw new MapLoadError('network', `Heretto answered HTTP ${content.status} for the map's content.`);
  return { file, xml: await content.text() };
};

/**
 * Build the key registry for the map `mapUuid`. Throws MapLoadError only when
 * the connected map itself cannot be read; a submap that fails is skipped and
 * counted in `mapsSkipped`.
 */
export const loadKeyRegistry = async (mapUuid: string): Promise<KeyRegistry> => {
  const root = await fetchMap(mapUuid);
  const rootEntries = extractMapEntries(root.xml);

  const registry: KeyRegistry = {
    map: { uuid: root.file.uuid, name: root.file.name },
    keys: new Map(),
    mapsRead: 1,
    mapsSkipped: 0,
    capped: false,
    duplicates: 0,
  };
  // Bare names of scoped keys, kept apart so they never shadow an unscoped
  // definition anywhere in the tree; merged at the end (ADR-013 decision 3).
  const scopedBare = new Map<string, KeyDefinition>();

  const record = (file: MapFile, entries: MapEntries) => {
    for (const k of entries.keys) {
      const def: KeyDefinition = { href: k.href, mapName: file.name, mapUuid: file.uuid, mapFolderUuid: file.folderUuid, ...(k.scope ? { scope: k.scope } : null) };
      const name = k.scope ? `${k.scope}.${k.name}` : k.name;
      if (registry.keys.has(name)) registry.duplicates++;
      else registry.keys.set(name, def);
      if (k.scope && !scopedBare.has(k.name)) scopedBare.set(k.name, def);
    }
  };

  const visited = new Set<string>([root.file.uuid]);
  record(root.file, rootEntries);
  let level: { file: MapFile; entries: MapEntries }[] = [{ file: root.file, entries: rootEntries }];

  for (let depth = 1; level.length > 0; depth++) {
    const refs = level.flatMap(m => m.entries.submaps.map(href => ({ href, from: m.file })));
    if (refs.length === 0) break;
    if (depth > MAX_MAP_LEVELS) { registry.capped = true; break; }

    // Resolve this level's references in parallel; keep document order for precedence.
    const targets = await Promise.all(refs.map(r => resolveHerettoPath(r.href, r.from.folderUuid)));
    const next: MapFile[] = [];
    for (const target of targets) {
      if (!target) { registry.mapsSkipped++; continue; }
      if (visited.has(target.uuid)) continue;
      if (registry.mapsRead + next.length >= MAX_MAPS) { registry.capped = true; break; }
      visited.add(target.uuid);
      next.push(target);
    }

    const loaded = await Promise.all(next.map(async file => {
      try {
        const res = await fetch(`/heretto-api/all-files/${file.uuid}/content`);
        if (!res.ok) return null;
        return { file, entries: extractMapEntries(await res.text()) };
      } catch {
        return null; // network failure, malformed XML, or not a map: skip it
      }
    }));
    level = [];
    for (const m of loaded) {
      if (!m) { registry.mapsSkipped++; continue; }
      registry.mapsRead++;
      record(m.file, m.entries);
      level.push(m);
    }
    if (registry.capped) break;
  }

  for (const [name, def] of scopedBare) {
    if (!registry.keys.has(name)) registry.keys.set(name, def);
  }
  return registry;
};
