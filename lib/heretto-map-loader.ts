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

/**
 * ADR-013 amendment (2026-11-18): one navigation node of a map, as the Map view
 * shows it. `map` is a submap (`<mapref>` or `format="ditamap"`); `group` an
 * href-less topichead/topicgroup that only holds children; `external` a link out
 * of the repository (`scope="external"` or a URL), never resolved in Heretto.
 * Resource-only entries that are not submaps (keydefs) and `<ditavalref>` are not
 * navigation and are left out; their keys are in the registry's Keys list.
 */
export interface MapNode {
  kind: 'topic' | 'map' | 'group' | 'external';
  /** As the map writes it (fragment included); relative to the map's folder. */
  href: string | null;
  /** A topicref that points by key instead of href: resolved through the registry. */
  keyref?: string;
  label: string;
  /** Keys defined on this element (its @keys, split). */
  keys: string[];
  children: MapNode[];
  /** `map` nodes only: the submap's UUID when it was read (an entry in `KeyRegistry.maps`), else null. */
  mapUuid?: string | null;
}

/** A map the walk read: where it lives and its navigation tree. */
export interface MapRecord {
  name: string;
  folderUuid: string;
  nodes: MapNode[];
}

export interface KeyRegistry {
  map: { uuid: string; name: string };
  keys: Map<string, KeyDefinition>;
  /** Every map read, the connected one included, by UUID (ADR-013 amendment). */
  maps: Map<string, MapRecord>;
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
  /** The navigation tree (ADR-013 amendment). */
  nodes: MapNode[];
}

const isTopicrefClass = (el: Element): boolean =>
  ` ${el.getAttribute('class') ?? ''} `.includes(' map/topicref ') ||
  ['topicref', 'mapref', 'keydef', 'topichead', 'topicgroup', 'glossref', 'chapter', 'appendix', 'part', 'frontmatter', 'backmatter'].includes(el.tagName);

const isSubmapRef = (el: Element): boolean => el.tagName === 'mapref' || el.getAttribute('format') === 'ditamap';

/** The label a topicref shows when it has no navtitle: its file name, read as words. */
export const labelForHref = (href: string | null): string => {
  if (!href) return '(untitled)';
  const file = href.split('#')[0].split('/').pop() ?? '';
  let stem = file.replace(/\.[^.]+$/, '');
  try { stem = decodeURIComponent(stem); } catch { /* keep the raw spelling */ }
  const words = stem.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return words || '(untitled)';
};

const navtitleOf = (el: Element): string | null => {
  const attr = el.getAttribute('navtitle')?.trim();
  if (attr) return attr;
  for (const child of Array.from(el.children)) {
    if (child.tagName === 'navtitle') return child.textContent?.replace(/\s+/g, ' ').trim() || null;
    if (child.tagName === 'topicmeta') {
      const nav = Array.from(child.children).find(c => c.tagName === 'navtitle');
      if (nav) return nav.textContent?.replace(/\s+/g, ' ').trim() || null;
    }
  }
  return null;
};

/** The navigation nodes under `el`, skipping relationship tables and non-topicref wrappers. */
const collectNodes = (el: Element): MapNode[] => {
  const out: MapNode[] = [];
  for (const child of Array.from(el.children)) {
    if (child.tagName === 'reltable' || ` ${child.getAttribute('class') ?? ''} `.includes(' map/reltable ')) continue;
    if (!isTopicrefClass(child)) { out.push(...collectNodes(child)); continue; }
    if (child.tagName === 'ditavalref' || ` ${child.getAttribute('class') ?? ''} `.includes(' ditavalref-d/ditavalref ')) continue;
    const href = child.getAttribute('href') || null;
    const submap = !!href && isSubmapRef(child);
    if (child.getAttribute('processing-role') === 'resource-only' && !submap) continue;
    const children = collectNodes(child);
    const nav = navtitleOf(child);
    const keyref = child.getAttribute('keyref')?.trim() || undefined;
    if (!href && !keyref && children.length === 0 && !nav) continue;
    const keys = child.getAttribute('keys')?.trim().split(/\s+/).filter(Boolean) ?? [];
    const external = !!href && (child.getAttribute('scope') === 'external' || /^[a-z][a-z0-9+.-]*:/i.test(href));
    const kind: MapNode['kind'] = submap ? 'map' : external ? 'external' : href || keyref ? 'topic' : 'group';
    const label = nav ?? (href ? labelForHref(href) : keyref ?? '(untitled)');
    out.push({ kind, href, label, keys, children, ...(keyref && !href ? { keyref } : null), ...(kind === 'map' ? { mapUuid: null } : null) });
  }
  return out;
};

/** How many nodes a tree holds, nested ones included. */
export const countNodes = (nodes: MapNode[]): number => nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);

const isMapRoot = (el: Element): boolean =>
  el.tagName === 'map' || ` ${el.getAttribute('class') ?? ''} `.includes(' map/map ');

/** Parse map XML. Throws MapLoadError('malformed' | 'not-a-map'). */
export const extractMapEntries = (xml: string): MapEntries => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new MapLoadError('malformed', 'The map is not well-formed XML.');
  const root = doc.documentElement;
  if (!isMapRoot(root)) throw new MapLoadError('not-a-map', `This file is a <${root.tagName}>, not a map.`);

  const entries: MapEntries = { keys: [], submaps: [], nodes: collectNodes(root) };
  const walk = (el: Element, scope: string | undefined) => {
    // A @keyscope element's own keys and everything inside it are in its scope.
    const scopeName = el.getAttribute('keyscope')?.trim().split(/\s+/)[0];
    const here = scopeName ? (scope ? `${scope}.${scopeName}` : scopeName) : scope;
    const href = el.getAttribute('href');
    const keys = el.getAttribute('keys');
    if (keys) {
      for (const name of keys.trim().split(/\s+/)) entries.keys.push({ name, href: href || null, ...(here ? { scope: here } : null) });
    }
    if (href && isSubmapRef(el)) entries.submaps.push(href);
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
    maps: new Map([[root.file.uuid, { name: root.file.name, folderUuid: root.file.folderUuid, nodes: rootEntries.nodes }]]),
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

  // Where each (map, submap href) pair led: the submap's UUID, or null (ADR-013 amendment).
  const resolved = new Map<string, string | null>();
  const refKey = (fromUuid: string, href: string) => `${fromUuid}\u0000${href}`;
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
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      resolved.set(refKey(refs[i].from.uuid, refs[i].href), target ? target.uuid : null);
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
      registry.maps.set(m.file.uuid, { name: m.file.name, folderUuid: m.file.folderUuid, nodes: m.entries.nodes });
      record(m.file, m.entries);
      level.push(m);
    }
    if (registry.capped) break;
  }

  for (const [name, def] of scopedBare) {
    if (!registry.keys.has(name)) registry.keys.set(name, def);
  }

  // Point every submap node at the map it led to, when that map was read.
  const link = (fromUuid: string, nodes: MapNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'map' && node.href) {
        const uuid = resolved.get(refKey(fromUuid, node.href)) ?? null;
        node.mapUuid = uuid && registry.maps.has(uuid) ? uuid : null;
      }
      link(fromUuid, node.children);
    }
  };
  for (const [uuid, rec] of registry.maps) link(uuid, rec.nodes);
  return registry;
};
