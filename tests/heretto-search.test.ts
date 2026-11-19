// ADR-013 amendment (2026-11-18), FR-072 — the Heretto search API, pure parts
// and the request wrapper. S1: a results request carries the user's filters and
// nothing else, with one page size for every page; a 401/403 is reported in the
// connection popover's words. S2: hits parse to title, filename, status, path
// and the right UUID. Response shapes are the ones probed live on 2026-11-18
// (and documented in the CCMS API v1 guide rev. I, pp. 45–51), with fake data.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  organizationFromHost,
  folderSearchUri,
  buildSearchBody,
  buildFacetBody,
  parseSearchResponse,
  parseFacets,
  groupHitsByFolder,
  runSearch,
  fetchFolderSearchUri,
  SearchError,
  SEARCH_PAGE_SIZE,
  SEARCH_SORTS,
  FACET_FIELDS,
  emptyFilters,
  type SearchRequest,
} from '../lib/heretto-search';

const ROOT_URI = '/db/organizations/example/repositories/master/content/documents/';

const req = (over: Partial<SearchRequest> = {}): SearchRequest => ({
  text: 'auxiliary rules',
  folderUri: ROOT_URI,
  subfolders: true,
  filters: emptyFilters(),
  sort: 'RELEVANCE',
  ...over,
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('the folder URI the API needs', () => {
  it('the organization is the host\'s subdomain (the guide\'s organizationId)', () => {
    expect(organizationFromHost('example.heretto.com')).toBe('example');
    expect(organizationFromHost('https://Example.heretto.com/')).toBe('example');
    expect(organizationFromHost('')).toBeNull();
    expect(organizationFromHost('   ')).toBeNull();
  });

  it('joins the organization and the folder\'s xmldb-uri with exactly one slash each side', () => {
    expect(folderSearchUri('example', 'master/content/documents')).toBe(ROOT_URI);
    expect(folderSearchUri('example', '/master/content/documents/')).toBe(ROOT_URI);
    expect(folderSearchUri('example', 'master/content/documents/MyGeotab/Rules')).toBe(`${ROOT_URI}MyGeotab/Rules/`);
  });

  it('reads xmldb-uri from the folder\'s REST XML', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toBe('/heretto-api/all-files/f1');
      return new Response('<?xml version="1.0"?><folder id="f1" parent-folder-id="p"><name>Rules</name><xmldb-uri>master/content/documents/Rules</xmldb-uri><children/></folder>', { status: 200 });
    }));
    await expect(fetchFolderSearchUri('f1', 'example.heretto.com')).resolves.toBe(`${ROOT_URI}Rules/`);
  });

  it('a file UUID, a folder without xmldb-uri, or a failed fetch is null, not a guess', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<resource id="x" folder-uuid="f"><name>a.dita</name></resource>', { status: 200 })));
    await expect(fetchFolderSearchUri('x', 'example.heretto.com')).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<folder id="x"><name>n</name></folder>', { status: 200 })));
    await expect(fetchFolderSearchUri('x', 'example.heretto.com')).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchFolderSearchUri('x', 'example.heretto.com')).resolves.toBeNull();
    await expect(fetchFolderSearchUri('x', '')).resolves.toBeNull();
  });

  it.each([401, 403])('a %i on the folder lookup is the credentials error, not "scope could not be read" (review finding 1)', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Error</html>', { status })));
    const err = await fetchFolderSearchUri('root', 'example.heretto.com').then((): never => { throw new Error('expected a SearchError'); }, (e: unknown) => e as SearchError);
    expect(err.kind).toBe('auth');
    expect(err.message).toMatch(/Heretto did not accept your credentials/);
  });
});

describe('S1 — the results request is the user\'s filters and nothing else', () => {
  it('no filters: folder, offsets, result type, sort, query', () => {
    expect(buildSearchBody(req(), 0)).toEqual({
      foldersToSearch: { [ROOT_URI]: true },
      startOffset: 0,
      endOffset: SEARCH_PAGE_SIZE,
      searchResultType: 'FILES_ONLY',
      sort: 'RELEVANCE',
      queryString: 'auxiliary rules',
    });
  });

  it('an empty query sends no queryString (the API lists every file in scope)', () => {
    expect(buildSearchBody(req({ text: '   ' }), 0)).not.toHaveProperty('queryString');
  });

  it('subfolders off is false in foldersToSearch', () => {
    expect(buildSearchBody(req({ subfolders: false }), 0).foldersToSearch).toEqual({ [ROOT_URI]: false });
  });

  it('values of one field are OR-ed, fields are AND-ed (the guide\'s drilldowns shape)', () => {
    const body = buildSearchBody(req({ filters: { ...emptyFilters(), status: ['published', 'draft'], contentType: ['Task'], product: ['MyGeotab'] } }), 0);
    expect(body.drilldowns).toEqual([
      [['status', 'published'], ['status', 'draft']],
      [['content-type', 'Task']],
      [['Product', 'MyGeotab']],
    ]);
    expect(body).not.toHaveProperty('facetRequests');
  });

  it('modified after / before become last_modified filters at the start of the local day (before is exclusive)', () => {
    const body = buildSearchBody(req({ filters: { ...emptyFilters(), modifiedAfter: '2026-01-01', modifiedBefore: '2026-02-01' } }), 0);
    expect(body.queryFilters).toEqual([`last_modified>=${new Date(2026, 0, 1).getTime()}`, `last_modified<${new Date(2026, 1, 1).getTime()}`]);
  });

  it('an unparseable date is dropped rather than sent', () => {
    const body = buildSearchBody(req({ filters: { ...emptyFilters(), modifiedAfter: 'yesterday' } }), 0);
    expect(body).not.toHaveProperty('queryFilters');
  });

  it('paging never changes the page size, and every offset is a multiple of it (valid past row 1,000)', () => {
    for (const page of [0, 1, 2, 39, 40, 41, 100]) {
      const body = buildSearchBody(req(), page);
      expect(body.endOffset - body.startOffset).toBe(SEARCH_PAGE_SIZE);
      expect(body.startOffset % SEARCH_PAGE_SIZE).toBe(0);
      expect(body.startOffset).toBe(page * SEARCH_PAGE_SIZE);
    }
    expect(1000 % SEARCH_PAGE_SIZE).toBe(0);
  });

  it('the sort is always set and is one of the thirteen the guide lists', () => {
    expect(SEARCH_SORTS.length).toBe(13);
    for (const sort of SEARCH_SORTS) expect(buildSearchBody(req({ sort }), 0).sort).toBe(sort);
  });

  it('the facet request asks for counts only: zero rows, the three filter fields, no drilldowns', () => {
    const body = buildFacetBody(req({ filters: { ...emptyFilters(), status: ['draft'] } }));
    expect(body.startOffset).toBe(0);
    expect(body.endOffset).toBe(0);
    expect(body.facetRequests).toEqual(FACET_FIELDS.map(f => [f]));
    expect(body).not.toHaveProperty('drilldowns');
    expect(body.queryString).toBe('auxiliary rules');
  });
});

const hit = (over: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => ({
  fileEntity: {
    ID: 'u-1', name: 'Auxiliary_rules.dita', URI: `${ROOT_URI}MyGeotab/Rules/Auxiliary_rules/Auxiliary_rules.dita`,
    parentId: 'folder-aux', lastModified: 1793801159832, contentTypeName: 'Concept',
    metadata: { data: { title: 'Auxiliary rules', status: 'published', 'content-type': 'Concept', ...data } },
    ...over,
  },
  isDependencyOfProvidedSet: false,
  numIncomingLinks: 0,
});

describe('S2 — hits parse to what a row shows', () => {
  it('title, filename, status, type, path relative to the scope root, folder, modified, uuid', () => {
    const r = parseSearchResponse({ totalResults: 6, hits: [hit()] }, ROOT_URI);
    expect(r.total).toBe(6);
    expect(r.hits).toEqual([{
      uuid: 'u-1',
      name: 'Auxiliary_rules.dita',
      title: 'Auxiliary rules',
      status: 'published',
      contentType: 'Concept',
      path: 'MyGeotab/Rules/Auxiliary_rules/Auxiliary_rules.dita',
      folderPath: 'MyGeotab/Rules/Auxiliary_rules',
      folderUuid: 'folder-aux',
      lastModified: 1793801159832,
    }]);
  });

  it('missing metadata falls back: title to the filename, type to contentTypeName, status to empty', () => {
    const r = parseSearchResponse({ totalResults: 1, hits: [hit({ metadata: undefined })] }, ROOT_URI);
    expect(r.hits[0]).toMatchObject({ title: 'Auxiliary_rules.dita', contentType: 'Concept', status: '' });
  });

  it('a hit outside the scope root keeps its full path minus the repository prefix', () => {
    const r = parseSearchResponse({ totalResults: 1, hits: [hit({ URI: '/db/organizations/example/repositories/master/content/documents/Other/x.dita' })] }, `${ROOT_URI}MyGeotab/`);
    expect(r.hits[0].path).toBe('Other/x.dita');
  });

  it('a hit with no ID is dropped (nothing to open); a response without hits is zero hits', () => {
    expect(parseSearchResponse({ totalResults: 1, hits: [hit({ ID: '' })] }, ROOT_URI).hits).toEqual([]);
    expect(parseSearchResponse({}, ROOT_URI)).toEqual({ total: 0, hits: [] });
    expect(parseSearchResponse(null, ROOT_URI)).toEqual({ total: 0, hits: [] });
  });

  it('groups hits by folder in first-seen order', () => {
    const a = parseSearchResponse({ totalResults: 3, hits: [
      hit({ ID: '1', URI: `${ROOT_URI}A/one.dita` }),
      hit({ ID: '2', URI: `${ROOT_URI}B/two.dita` }),
      hit({ ID: '3', URI: `${ROOT_URI}A/three.dita` }),
    ] }, ROOT_URI).hits;
    expect(groupHitsByFolder(a).map(g => [g.folderPath, g.hits.map(h => h.uuid)])).toEqual([['A', ['1', '3']], ['B', ['2']]]);
  });
});

describe('facets', () => {
  const SEP = 'ezd_facet_path_separator';
  it('keeps the three filter fields, splits Heretto\'s joined keys, sorts by count then value', () => {
    const f = parseFacets({ facetResults: {
      [`status${SEP}published`]: 3, [`status${SEP}draft`]: 9, [`status${SEP}archived`]: 3,
      [`content-type${SEP}Task`]: 2, [`Product${SEP}MyGeotab`]: 5,
      [`__last_modified_by${SEP}someone@example.com`]: 4, [`needs_attention${SEP}not_valid`]: 0,
    } });
    expect(f).toEqual({
      status: [{ value: 'draft', count: 9 }, { value: 'archived', count: 3 }, { value: 'published', count: 3 }],
      'content-type': [{ value: 'Task', count: 2 }],
      Product: [{ value: 'MyGeotab', count: 5 }],
    });
  });

  it('a value with zero hits is not offered', () => {
    expect(parseFacets({ facetResults: { [`status${SEP}x`]: 0 } }).status).toEqual([]);
  });

  it('no facetResults is three empty lists', () => {
    expect(parseFacets({})).toEqual({ status: [], 'content-type': [], Product: [] });
  });
});

describe('S1 — the request and its failures', () => {
  it('one POST to the proxy with the JSON body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ totalResults: 0, hits: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const body = buildSearchBody(req(), 0);
    await expect(runSearch(body)).resolves.toEqual({ totalResults: 0, hits: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/heretto-search');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it.each([401, 403])('HTTP %i is an auth error in the connection popover\'s words', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><title>Error 401 Not authenticated</title></html>', { status, headers: { 'content-type': 'text/html' } })));
    const err = await runSearch(buildSearchBody(req(), 0)).then((): never => { throw new Error('expected a SearchError'); }, (e: unknown) => e as SearchError);
    expect(err).toBeInstanceOf(SearchError);
    expect(err.kind).toBe('auth');
    expect(err.message).toMatch(/Heretto did not accept your credentials/);
    expect(err.message).not.toMatch(/<html/);
  });

  it('a network failure, a 5xx, a non-JSON body and an abort are told apart', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect((await runSearch(buildSearchBody(req(), 0)).then((): never => { throw new Error('expected a SearchError'); }, (e: unknown) => e as SearchError)).kind).toBe('network');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"boom"}', { status: 500 })));
    const e500 = await runSearch(buildSearchBody(req(), 0)).then((): never => { throw new Error('expected a SearchError'); }, (e: unknown) => e as SearchError);
    expect(e500.kind).toBe('http');
    expect(e500.status).toBe(500);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })));
    expect((await runSearch(buildSearchBody(req(), 0)).then((): never => { throw new Error('expected a SearchError'); }, (e: unknown) => e as SearchError)).kind).toBe('bad-response');
    const ac = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => { ac.abort(); throw new DOMException('aborted', 'AbortError'); }));
    expect((await runSearch(buildSearchBody(req(), 0), ac.signal).then((): never => { throw new Error('expected a SearchError'); }, (e: unknown) => e as SearchError)).kind).toBe('aborted');
  });
});
