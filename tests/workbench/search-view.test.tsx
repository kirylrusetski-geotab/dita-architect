// @vitest-environment jsdom
//
// FR-072 — the Search view at the component level. S1: typing sends the facet
// request then one results request with the user's filters and nothing else;
// a filter reruns the results only; Load more keeps the page size; a 401 shows
// the credentials notice. S2: rows show title, filename, status and open the
// right UUID. The endpoint is stubbed with the probed response shapes.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SearchView } from '../../components/workbench/views/SearchView';
import { SEARCH_PAGE_SIZE, type SearchBody } from '../../lib/heretto-search';

const ROOT_URI = '/db/organizations/example/repositories/master/content/documents/';
const SEP = 'ezd_facet_path_separator';

const entity = (i: number, folder: string, status = 'published') => ({
  fileEntity: {
    ID: `u-${i}`, name: `topic_${i}.dita`, URI: `${ROOT_URI}${folder}/topic_${i}.dita`, parentId: `f-${folder}`,
    lastModified: Date.UTC(2026, 9, 1), contentTypeName: 'Task',
    metadata: { data: { title: `Auxiliary topic ${i}`, status, 'content-type': 'Task' } },
  },
});

interface Served { bodies: SearchBody[]; urls: string[] }

function serve(opts: { total?: number; status?: number; folderStatus?: number; facetStatus?: number; facetDelayMs?: number } = {}): Served {
  const served: Served = { bodies: [], urls: [] };
  const total = opts.total ?? 3;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    served.urls.push(url);
    if (url === '/heretto-api/all-files/root') {
      if (opts.folderStatus) return new Response('<html>Error</html>', { status: opts.folderStatus });
      return new Response('<folder id="root"><name>documents</name><xmldb-uri>master/content/documents</xmldb-uri><children/></folder>', { status: 200 });
    }
    if (url === '/heretto-search') {
      const body = JSON.parse(init!.body as string) as SearchBody;
      served.bodies.push(body);
      if (opts.status) return new Response('<html>Error 401</html>', { status: opts.status });
      if (body.endOffset === 0) {
        if (opts.facetDelayMs) await new Promise(r => setTimeout(r, opts.facetDelayMs));
        if (opts.facetStatus) return new Response('boom', { status: opts.facetStatus });
        const label = body.queryString ?? '';
        if (label === 'beta') return new Response(JSON.stringify({ totalResults: total, hits: [], facetResults: { [`status${SEP}beta-only`]: 4 } }), { status: 200 });
        return new Response(JSON.stringify({ totalResults: total, hits: [], facetResults: { [`status${SEP}published`]: 2, [`status${SEP}draft`]: 1, [`content-type${SEP}Task`]: 3 } }), { status: 200 });
      }
      const hits = [];
      for (let i = body.startOffset; i < Math.min(body.endOffset, total); i++) hits.push(entity(i, i % 2 ? 'B' : 'A', i === 1 ? 'draft' : 'published'));
      return new Response(JSON.stringify({ totalResults: total, hits }), { status: 200 });
    }
    return new Response('nope', { status: 404 });
  }));
  return served;
}

afterEach(() => { vi.unstubAllGlobals(); });

function renderView(over: Partial<React.ComponentProps<typeof SearchView>> = {}) {
  const props: React.ComponentProps<typeof SearchView> = {
    herettoConnected: true, host: 'example.heretto.com', rootUuid: 'root', currentFolder: null, focusRequest: 0,
    onOpenHit: vi.fn(), onOpenCredentials: vi.fn(), onTestConnection: vi.fn(), ...over,
  };
  return { ...render(<SearchView {...props} />), props };
}

const type = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Search Heretto' }), { target: { value: text } });

describe('S1 — what typing sends', () => {
  it('nothing until there is a query; then one facet request and one results request', async () => {
    const served = serve();
    renderView();
    expect(served.bodies).toEqual([]);
    type('auxiliary rules');
    await screen.findByTestId('search-hit-u-0');
    const results = served.bodies.filter(b => b.endOffset > 0);
    const facets = served.bodies.filter(b => b.endOffset === 0);
    expect(facets.length).toBe(1);
    expect(results.length).toBe(1);
    expect(results[0]).toEqual({ foldersToSearch: { [ROOT_URI]: true }, startOffset: 0, endOffset: SEARCH_PAGE_SIZE, searchResultType: 'FILES_ONLY', sort: 'RELEVANCE', queryString: 'auxiliary rules' });
    expect(served.urls.filter(u => u === '/heretto-api/all-files/root').length).toBe(1);
  });

  it('a filter reruns only the results request, with the drilldown, and keeps the facet values', async () => {
    const served = serve();
    renderView();
    type('auxiliary');
    await screen.findByTestId('search-hit-u-0');
    const before = served.bodies.length;
    fireEvent.click(screen.getByTestId('search-filter-status'));
    const pop = await screen.findByRole('dialog', { name: 'Status filter' });
    expect(within(pop).getByText('published')).toBeInTheDocument();
    expect(within(pop).getByText('2')).toBeInTheDocument();
    fireEvent.click(within(pop).getByRole('checkbox', { name: /draft/ }));
    await waitFor(() => expect(served.bodies.length).toBe(before + 1));
    const last = served.bodies.at(-1)!;
    expect(last.endOffset).toBe(SEARCH_PAGE_SIZE);
    expect(last.drilldowns).toEqual([[['status', 'draft']]]);
    expect(screen.getByTestId('search-filter-status')).toHaveTextContent('Status: draft');
  });

  it('Load more asks for the next page at the same size and appends', async () => {
    const served = serve({ total: 30 });
    renderView();
    type('auxiliary');
    await screen.findByTestId('search-hit-u-0');
    expect(screen.getByTestId('search-total')).toHaveTextContent('30 results');
    fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
    await screen.findByTestId('search-hit-u-29');
    const pages = served.bodies.filter(b => b.endOffset > 0);
    expect(pages.map(b => [b.startOffset, b.endOffset])).toEqual([[0, 25], [25, 50]]);
    expect(screen.getByTestId('search-hit-u-0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
  });

  it('a 401 shows the credentials notice in plain words, never the error page', async () => {
    serve({ status: 401 });
    const { props } = renderView();
    type('auxiliary');
    const notice = await screen.findByTestId('search-error');
    expect(notice).toHaveTextContent('Heretto did not accept your credentials');
    expect(notice).not.toHaveTextContent('<html>');
    fireEvent.click(within(notice).getByRole('button', { name: 'Credentials…' }));
    expect(props.onOpenCredentials).toHaveBeenCalled();
  });

  it('disconnected: no request and a message instead of the box', () => {
    const served = serve();
    renderView({ herettoConnected: false });
    expect(screen.queryByRole('textbox', { name: 'Search Heretto' })).toBeNull();
    expect(screen.getByText(/Connect to Heretto to search/)).toBeInTheDocument();
    expect(served.urls).toEqual([]);
  });
});

describe('S2 — rows', () => {
  it('grouped by folder; title, status, filename, type; a click opens that hit', async () => {
    serve();
    const { props } = renderView();
    type('auxiliary');
    const row = await screen.findByTestId('search-hit-u-1');
    expect(screen.getAllByRole('group').map(g => g.getAttribute('aria-label'))).toEqual(['A', 'B']);
    expect(row).toHaveTextContent('Auxiliary topic 1');
    expect(row).toHaveTextContent('draft');
    expect(row).toHaveTextContent('topic_1.dita');
    expect(row).toHaveTextContent('Task');
    expect(within(row).getByText('Auxiliary').tagName).toBe('MARK');
    fireEvent.click(row);
    expect(props.onOpenHit).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'u-1', name: 'topic_1.dita', folderUuid: 'f-B', path: 'B/topic_1.dita' }), true);
  });

  it('the scope menu offers the active topic\'s folder', async () => {
    const served = serve();
    renderView({ currentFolder: { uuid: 'rules', name: 'Rules' } });
    fireEvent.click(screen.getByTestId('search-scope'));
    const menu = await screen.findByRole('menu', { name: 'Search scope' });
    expect(within(menu).getByRole('menuitem', { name: "This topic's folder (Rules)" })).toBeInTheDocument();
    expect(served.urls).toEqual([]);
  });

  it('a focus request puts the caret in the query box (Open from Heretto)', () => {
    serve();
    const { rerender, props } = renderView();
    rerender(<SearchView {...props} focusRequest={1} />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search Heretto' }));
  });
});

describe('the adversarial review\'s findings, pinned', () => {
  it('finding 1: a 401 on the scope folder lookup (the first search of a session) is the credentials notice', async () => {
    serve({ folderStatus: 401 });
    renderView();
    type('auxiliary');
    const notice = await screen.findByTestId('search-error');
    expect(notice).toHaveTextContent('Heretto did not accept your credentials');
    expect(within(notice).getByRole('button', { name: 'Credentials…' })).toBeInTheDocument();
  });

  it('finding 4: a failed facet request never blocks the results', async () => {
    const served = serve({ facetStatus: 500 });
    renderView();
    type('auxiliary');
    await screen.findByTestId('search-hit-u-0');
    expect(screen.queryByTestId('search-error')).toBeNull();
    expect(served.bodies.filter(b => b.endOffset > 0).length).toBe(1);
  });

  it('finding 3: a sort change while the new query\'s facets are in flight does not cancel them', async () => {
    serve({ facetDelayMs: 300 });
    renderView();
    type('beta');
    await screen.findByTestId('search-hit-u-0');                 // results arrive before the slow facets
    fireEvent.click(screen.getByRole('button', { name: /Relevance/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Title A–Z' }));
    fireEvent.click(screen.getByTestId('search-filter-status'));
    const pop = await screen.findByRole('dialog', { name: 'Status filter' });
    await waitFor(() => expect(within(pop).getByText('beta-only')).toBeInTheDocument(), { timeout: 2000 });
  });

  it('finding 8: Enter runs the search once, not twice', async () => {
    const served = serve();
    renderView();
    type('rules');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search Heretto' }), { key: 'Enter' });
    await screen.findByTestId('search-hit-u-0');
    await new Promise(r => setTimeout(r, 500));                   // past the debounce window
    expect(served.bodies.filter(b => b.endOffset > 0).length).toBe(1);
    expect(served.bodies.filter(b => b.endOffset === 0).length).toBe(1);
  });

  it('finding 9: a new query clears the old results at once, so nothing can be appended to them', async () => {
    serve({ total: 30 });
    renderView();
    type('alpha');
    await screen.findByTestId('search-hit-u-0');
    type('beta');
    expect(screen.queryByTestId('search-hit-u-0')).toBeNull();
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
    expect(screen.getByTestId('search-total')).toHaveTextContent('Searching');
  });
});
