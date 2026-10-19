import type { HerettoItem } from '../types/heretto';

// FR-062: the content-root folder UUID is no longer a constant. It is read from
// `~/heretto.json` (`rootUuid`) via `/heretto-credentials` and held in
// `useHerettoCms` state (`herettoRootUuid`), so DITA Architect can point at any
// Heretto instance.

/**
 * TTL-aware cache for Heretto folder listings.
 * Entries expire after 5 minutes and the cache caps at 500 entries (LRU eviction).
 */
class TtlCache<K, V> {
  private map = new Map<K, { value: V; expiry: number }>();
  constructor(private ttlMs: number, private maxSize: number) {}

  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiry) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      // Evict oldest (first key in insertion order)
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.map.clear();
  }
}

export const herettoFolderCache = new TtlCache<string, HerettoItem[]>(5 * 60_000, 500);

export const RECOGNIZED_ELEMENTS = new Set([
  'title', 'shortdesc', 'prereq', 'context', 'result', 'postreq', 'p', 'cmd',
  'note', 'steps', 'ol', 'ul', 'step', 'li', 'table', 'simpletable', 'section',
  'xref', 'b', 'strong', 'i', 'em', 'ph', 'codeph', 'codeblock', 'fig', 'image',
  'term', 'uicontrol', 'wintitle', 'option', 'alt',
]);

export const STRUCTURAL_CONTAINERS = new Set([
  'task', 'concept', 'reference', 'topic', 'taskbody', 'conbody', 'refbody',
  'body', 'tgroup', 'thead', 'tbody', 'row', 'entry', 'sthead', 'strow',
  'stentry',
]);
