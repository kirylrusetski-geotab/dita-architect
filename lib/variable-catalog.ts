// The variables a connected map's key reaches (FR-066, ADR-013 decision 9).
//
// A variable warehouse is a topic whose variables are @id-carrying elements
// (read from the live tenant 2026-10-27: <ph> mostly, also <uicontrol>,
// <wintitle>, <keyword>, and block <note>s). A conkeyref names one as
// `key/id`, and DITA's conref rule makes the referencing element match the
// target's, so each entry carries its tag. Only inline (phrase-level) elements
// are offered: a <note> cannot go where the caret is.
import { INLINE_PHRASE } from '../constants/dita-content-model';
import { resolveHerettoPathResult } from './heretto-path';
import type { KeyDefinition } from './heretto-map-loader';

export interface VariableEntry {
  key: string;
  id: string;
  /** The target's element, lower-cased: the reference is written as this element. */
  tag: string;
  /** The target's text, whitespace collapsed, as a preview. */
  text: string;
}

export type VariableLoadResult =
  | { status: 'ok'; variables: VariableEntry[] }
  | { status: 'missing' }
  | { status: 'error' };

// An <image> chip is not a ref chip (BUG-46), so an image variable could not
// round-trip as one; it is left out with the other non-text phrase.
const INSERTABLE = new Set(INLINE_PHRASE.filter(tag => tag !== 'image'));

const cache = new Map<string, Promise<VariableLoadResult>>();

export const clearVariableCache = (): void => cache.clear();

const collect = (key: string, doc: Document): VariableEntry[] =>
  Array.from(doc.getElementsByTagName('*'))
    .filter(el => el !== doc.documentElement && el.hasAttribute('id') && INSERTABLE.has(el.tagName.toLowerCase()))
    .map(el => ({
      key,
      id: el.getAttribute('id')!,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }));

const load = async (key: string, def: KeyDefinition): Promise<VariableLoadResult> => {
  if (!def.href) return { status: 'ok', variables: [] };
  const resolved = await resolveHerettoPathResult(def.href, def.mapFolderUuid);
  if (resolved.status !== 'found') return { status: resolved.status };
  try {
    const res = await fetch(`/heretto-api/all-files/${resolved.target.uuid}/content`);
    if (!res.ok) return { status: 'error' };
    const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    if (doc.querySelector('parsererror')) return { status: 'error' };
    return { status: 'ok', variables: collect(key, doc) };
  } catch {
    return { status: 'error' };
  }
};

/** The variables `key` reaches, fetched once per session; a failure is retried next call. */
export const loadKeyVariables = (key: string, def: KeyDefinition): Promise<VariableLoadResult> => {
  const cacheKey = `${def.mapUuid}|${key}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const request = load(key, def);
  cache.set(cacheKey, request);
  void request.then(r => { if (r.status !== 'ok' && cache.get(cacheKey) === request) cache.delete(cacheKey); });
  return request;
};
