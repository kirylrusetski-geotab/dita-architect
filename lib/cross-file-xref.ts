// Cross-file xref validation (ADR-013 decision 8; P2-27 item 7). An xref to
// another file — `other.dita`, `../B/far.dita#topic/element` — is resolved from
// the open topic's Heretto folder, the target fetched once, and the fragment
// checked the DITA way: `#topicid` must name a topic in the file, and
// `#topicid/elementid` an @id inside that topic. Only an answer from Heretto
// can make a link broken; a failed fetch is `unknown` and marks nothing.
import { resolveHerettoPathResult } from './heretto-path';
import { TtlCache } from '../constants/heretto';

export type CrossFileResult =
  | { status: 'ok' }
  | { status: 'broken'; message: string }
  | { status: 'unknown' };

/**
 * True when `href` points at another file this check can look up: a relative
 * path, not `#…`, not a URL, and not marked external/peer, HTML, or key-based
 * (a key resolves the link at publish time; the href is only a fallback).
 */
export const isCrossFileHref = (href: string, attrs?: Record<string, string> | null): boolean => {
  if (!href || href.startsWith('#') || href.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return false;
  if (attrs) {
    if (attrs.scope === 'external' || attrs.scope === 'peer') return false;
    if (attrs.format === 'html') return false;
    if ('keyref' in attrs || 'conkeyref' in attrs) return false;
  }
  return true;
};

// A target's parsed document, per file UUID. Unknown outcomes are not cached.
type Target = { status: 'ok'; doc: Document } | { status: 'unknown' };
const targetCache = new TtlCache<string, Promise<Target>>(5 * 60_000, 200);

export const clearCrossFileCache = (): void => targetCache.clear();

const fetchTarget = (uuid: string): Promise<Target> => {
  const cached = targetCache.get(uuid);
  if (cached) return cached;
  const request = (async (): Promise<Target> => {
    try {
      const res = await fetch(`/heretto-api/all-files/${uuid}/content`);
      if (!res.ok) return { status: 'unknown' };
      const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
      return doc.querySelector('parsererror') ? { status: 'unknown' } : { status: 'ok', doc };
    } catch {
      return { status: 'unknown' };
    }
  })();
  targetCache.set(uuid, request);
  // Share the request while it is in flight, but do not remember a failure:
  // the next check should ask Heretto again.
  void request.then(t => { if (t.status === 'unknown' && targetCache.get(uuid) === request) targetCache.delete(uuid); });
  return request;
};

const isTopic = (el: Element): boolean => ` ${el.getAttribute('class') ?? ''} `.includes(' topic/topic ');

/** Check one cross-file href from the folder `folderUuid`. */
export const checkCrossFileHref = async (href: string, folderUuid: string): Promise<CrossFileResult> => {
  const hash = href.indexOf('#');
  const fragment = hash >= 0 ? href.slice(hash + 1) : '';
  const resolved = await resolveHerettoPathResult(href, folderUuid);
  if (resolved.status === 'error') return { status: 'unknown' };
  const fileName = decodeURIComponent((hash >= 0 ? href.slice(0, hash) : href).split('/').pop() ?? '');
  if (resolved.status === 'missing') return { status: 'broken', message: `File '${fileName}' not found in Heretto` };
  if (!fragment) return { status: 'ok' };

  const target = await fetchTarget(resolved.target.uuid);
  if (target.status === 'unknown') return { status: 'unknown' };

  const [topicId, elementId] = fragment.split('/');
  const topics = Array.from(target.doc.getElementsByTagName('*')).filter(el => el.getAttribute('id') === topicId && (isTopic(el) || el === target.doc.documentElement));
  if (topics.length === 0) return { status: 'broken', message: `Topic '${topicId}' not found in ${resolved.target.name}` };
  if (elementId === undefined) return { status: 'ok' };
  const found = topics.some(topic => Array.from(topic.getElementsByTagName('*')).some(el => el.getAttribute('id') === elementId));
  return found ? { status: 'ok' } : { status: 'broken', message: `Target '${fragment}' not found in ${resolved.target.name}` };
};
