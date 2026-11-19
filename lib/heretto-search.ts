// FR-072 / ADR-013 amendment (2026-11-18) — Heretto's search API.
//
// `POST /ezdnxtgen/api/search`, documented in the CCMS API v1 guide rev. I
// (pp. 45–51) and reached through the `/heretto-search` proxy prefix (Swift
// and Vite inject the same Basic auth as `/heretto-api`). What the guide and
// the 2026-11-18 probe fix here:
//  - exactly one folder per request, as a database URI:
//    `/db/organizations/{org}/repositories/` + the folder's `xmldb-uri`; the
//    REST API never returns {org}, and the guide defines it as the subdomain
//    used to reach Heretto;
//  - keywords are prefix-matched, no Lucene syntax;
//  - drilldowns: values of one field OR-ed, fields AND-ed;
//  - date filters on `last_modified` / `created` only, epoch milliseconds;
//  - past row 1,000, offsets must be multiples of the page size, so one page
//    size is used for every page.

export const SEARCH_PAGE_SIZE = 25;

export const SEARCH_SORTS = [
  'RELEVANCE', 'FILENAME_ASC', 'FILENAME_DESC', 'LAST_MODIFIED_ASC', 'LAST_MODIFIED_DESC',
  'TITLE_ASC', 'TITLE_DESC', 'CREATED_ASC', 'CREATED_DESC', 'CONTENT_TYPE_ASC',
  'CONTENT_TYPE_DESC', 'STATUS_ASC', 'STATUS_DESC',
] as const;
export type SearchSort = typeof SEARCH_SORTS[number];

/** The metadata fields the filter popovers offer, as Heretto names them. */
export const FACET_FIELDS = ['status', 'content-type', 'Product'] as const;
export type FacetField = typeof FACET_FIELDS[number];

export interface SearchFilters {
  status: string[];
  contentType: string[];
  product: string[];
  /** YYYY-MM-DD from a date input: on or after the start of that local day. */
  modifiedAfter?: string;
  /** YYYY-MM-DD from a date input: before the start of that local day. */
  modifiedBefore?: string;
}

export const emptyFilters = (): SearchFilters => ({ status: [], contentType: [], product: [] });

export interface SearchRequest {
  text: string;
  /** From `folderSearchUri`. */
  folderUri: string;
  subfolders: boolean;
  filters: SearchFilters;
  sort: SearchSort;
}

export interface SearchBody {
  foldersToSearch: Record<string, boolean>;
  startOffset: number;
  endOffset: number;
  searchResultType: 'FILES_ONLY';
  sort: SearchSort;
  queryString?: string;
  drilldowns?: [string, string][][];
  queryFilters?: string[];
  facetRequests?: string[][];
}

export interface SearchHit {
  uuid: string;
  name: string;
  title: string;
  status: string;
  contentType: string;
  /** Relative to the search scope's root (or the repository's documents folder when outside it). */
  path: string;
  folderPath: string;
  folderUuid: string;
  lastModified: number | null;
}

export type FacetValues = Record<FacetField, { value: string; count: number }[]>;

/** The guide's organizationId: the first label of the host, lower-cased. */
export const organizationFromHost = (host: string): string | null => {
  const h = host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  const org = h.split('.')[0];
  return org ? org : null;
};

export const folderSearchUri = (org: string, xmldbUri: string): string =>
  `/db/organizations/${org}/repositories/${xmldbUri.replace(/^\/+|\/+$/g, '')}/`;

/**
 * The search URI of a folder, or null when the UUID is not a folder, has no
 * xmldb-uri, or cannot be read. A 401/403 throws the credentials SearchError, so
 * the first search of a session reports a bad token in the same words as the
 * search itself (adversarial review, finding 1).
 */
export const fetchFolderSearchUri = async (folderUuid: string, host: string): Promise<string | null> => {
  const org = organizationFromHost(host);
  if (!org || !folderUuid) return null;
  let res: Response;
  try {
    res = await fetch(`/heretto-api/all-files/${folderUuid}`);
  } catch {
    return null;
  }
  if (res.status === 401 || res.status === 403) {
    throw new SearchError('auth', 'Heretto did not accept your credentials. Nothing was searched.', res.status);
  }
  try {
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root.tagName !== 'folder') return null;
    const uri = root.querySelector(':scope > xmldb-uri')?.textContent?.trim();
    return uri ? folderSearchUri(org, uri) : null;
  } catch {
    return null;
  }
};

/** The start of the local day a date input names (the writer's calendar, not UTC's; review finding 12). */
const dayToEpochMs = (day: string | undefined): number | null => {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const baseBody = (r: SearchRequest, start: number, end: number): SearchBody => {
  const body: SearchBody = {
    foldersToSearch: { [r.folderUri]: r.subfolders },
    startOffset: start,
    endOffset: end,
    searchResultType: 'FILES_ONLY',
    sort: r.sort,
  };
  const q = r.text.trim();
  if (q) body.queryString = q;
  return body;
};

/** S1: one page of results with the user's filters, and nothing else. */
export const buildSearchBody = (r: SearchRequest, page: number): SearchBody => {
  const start = Math.max(0, Math.trunc(page)) * SEARCH_PAGE_SIZE;
  const body = baseBody(r, start, start + SEARCH_PAGE_SIZE);
  const groups: [string, string][][] = [];
  const add = (field: FacetField, values: string[]) => { if (values.length) groups.push(values.map(v => [field, v])); };
  add('status', r.filters.status);
  add('content-type', r.filters.contentType);
  add('Product', r.filters.product);
  if (groups.length) body.drilldowns = groups;
  const filters: string[] = [];
  const after = dayToEpochMs(r.filters.modifiedAfter);
  const before = dayToEpochMs(r.filters.modifiedBefore);
  if (after !== null) filters.push(`last_modified>=${after}`);
  if (before !== null) filters.push(`last_modified<${before}`);
  if (filters.length) body.queryFilters = filters;
  return body;
};

/** The filter popovers' values: counts only (zero rows), for the query and scope, unfiltered. */
export const buildFacetBody = (r: SearchRequest): SearchBody => ({
  ...baseBody(r, 0, 0),
  facetRequests: FACET_FIELDS.map(f => [f]),
});

const REPO_PREFIX = /^\/?db\/organizations\/[^/]+\/repositories\/[^/]+\/content\/documents\//;

const relativePath = (uri: string, scopeUri: string): string => {
  if (uri.startsWith(scopeUri)) return uri.slice(scopeUri.length);
  return uri.replace(REPO_PREFIX, '');
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const parseSearchResponse = (json: unknown, scopeUri: string): { total: number; hits: SearchHit[] } => {
  if (!json || typeof json !== 'object') return { total: 0, hits: [] };
  const o = json as { totalResults?: unknown; hits?: unknown };
  const raw = Array.isArray(o.hits) ? o.hits : [];
  const hits: SearchHit[] = [];
  for (const h of raw) {
    const e = (h && typeof h === 'object' ? (h as { fileEntity?: unknown }).fileEntity : null) as Record<string, unknown> | null;
    if (!e) continue;
    const uuid = str(e.ID);
    if (!uuid) continue;
    const data = ((e.metadata as { data?: Record<string, unknown> } | undefined)?.data) ?? {};
    const name = str(e.name);
    const path = relativePath(str(e.URI), scopeUri) || name;
    const slash = path.lastIndexOf('/');
    hits.push({
      uuid,
      name,
      title: str(data.title) || name,
      status: str(data.status),
      contentType: str(data['content-type']) || str(e.contentTypeName),
      path,
      folderPath: slash >= 0 ? path.slice(0, slash) : '',
      folderUuid: str(e.parentId),
      lastModified: typeof e.lastModified === 'number' ? e.lastModified : null,
    });
  }
  const total = typeof o.totalResults === 'number' ? o.totalResults : hits.length;
  return { total, hits };
};

const FACET_SEP = 'ezd_facet_path_separator';

export const parseFacets = (json: unknown): FacetValues => {
  const out = { status: [], 'content-type': [], Product: [] } as FacetValues;
  const fr = json && typeof json === 'object' ? (json as { facetResults?: unknown }).facetResults : null;
  if (!fr || typeof fr !== 'object') return out;
  for (const [key, count] of Object.entries(fr as Record<string, unknown>)) {
    const at = key.indexOf(FACET_SEP);
    if (at < 0 || typeof count !== 'number' || count <= 0) continue;
    const field = key.slice(0, at);
    if (!(FACET_FIELDS as readonly string[]).includes(field)) continue;
    out[field as FacetField].push({ value: key.slice(at + FACET_SEP.length), count });
  }
  for (const f of FACET_FIELDS) out[f].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return out;
};

export const groupHitsByFolder = (hits: SearchHit[]): { folderPath: string; hits: SearchHit[] }[] => {
  const groups = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const g = groups.get(h.folderPath);
    if (g) g.push(h); else groups.set(h.folderPath, [h]);
  }
  return [...groups].map(([folderPath, hs]) => ({ folderPath, hits: hs }));
};

export type SearchErrorKind = 'auth' | 'network' | 'http' | 'bad-response' | 'aborted';

export class SearchError extends Error {
  constructor(public kind: SearchErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'SearchError';
  }
}

/** One POST to the proxy. Throws SearchError; the body of an error page is never shown. */
export const runSearch = async (body: SearchBody, signal?: AbortSignal): Promise<unknown> => {
  let res: Response;
  try {
    res = await fetch('/heretto-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw new SearchError('aborted', 'Search cancelled.');
    throw new SearchError('network', 'Heretto could not be reached. Check your network connection.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new SearchError('auth', 'Heretto did not accept your credentials. Nothing was searched.', res.status);
  }
  if (!res.ok) throw new SearchError('http', `Heretto's search answered HTTP ${res.status}.`, res.status);
  try {
    return JSON.parse(await res.text());
  } catch {
    throw new SearchError('bad-response', 'Heretto\'s search did not return JSON.');
  }
};
