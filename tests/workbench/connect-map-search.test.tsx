// @vitest-environment jsdom
//
// v1.2.0 (Kiryl, 2026-11-19): Connect a Map searches maps by name and text when
// the input is not a UUID. The request is the shared search with one filter,
// content-type Map (Heretto's SiteMap is not a DITA map and cannot connect);
// a pasted UUID or link connects directly, as before, with no search request.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectMapModal } from '../../components/ConnectMapModal';
import type { SearchBody } from '../../lib/heretto-search';

const ROOT_URI = '/db/organizations/example/repositories/master/content/documents/';

const mapHit = (id: string, title: string, folder: string) => ({
  fileEntity: { ID: id, name: `${title.replace(/ /g, '_')}.ditamap`, URI: `${ROOT_URI}${folder}/${title.replace(/ /g, '_')}.ditamap`, parentId: `f-${folder}`, lastModified: 1, contentTypeName: 'Map', metadata: { data: { title, status: 'draft', 'content-type': 'Map' } } },
});

function serve(hits: unknown[]) {
  const bodies: SearchBody[] = [];
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    urls.push(url);
    if (url === '/heretto-api/all-files/root') return new Response('<folder id="root"><name>documents</name><xmldb-uri>master/content/documents</xmldb-uri><children/></folder>', { status: 200 });
    if (url === '/heretto-search') { bodies.push(JSON.parse(init!.body as string)); return new Response(JSON.stringify({ totalResults: hits.length, hits }), { status: 200 }); }
    return new Response('nope', { status: 404 });
  }));
  return { bodies, urls };
}

afterEach(() => { vi.unstubAllGlobals(); });

function renderModal(over: Partial<React.ComponentProps<typeof ConnectMapModal>> = {}) {
  const props: React.ComponentProps<typeof ConnectMapModal> = {
    connectedMapName: null, host: 'example.heretto.com', rootUuid: 'root', herettoConnected: true, loading: false, error: null,
    onConnect: vi.fn(async () => true), onClearError: vi.fn(), onClose: vi.fn(), ...over,
  };
  return { ...render(<ConnectMapModal {...props} />), props };
}

const box = () => screen.getByRole('textbox');

describe('Connect a Map: search maps by name', () => {
  it('typing a name sends one maps-only search and lists the maps; a click connects that one', async () => {
    const served = serve([mapHit('m-1', 'Altitude User Guide', 'Altitude/User_Guide'), mapHit('m-2', 'Altitude User Guide Overview', 'Altitude/User_Guide')]);
    const { props } = renderModal();
    fireEvent.change(box(), { target: { value: 'altitude user guide' } });
    await screen.findByTestId('connect-map-hit-m-1');
    expect(served.bodies.length).toBe(1);
    expect(served.bodies[0]).toMatchObject({ queryString: 'altitude user guide', drilldowns: [[['content-type', 'Map']]], foldersToSearch: { [ROOT_URI]: true } });
    expect(screen.getByText('2 maps')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('connect-map-hit-m-2'));
    await waitFor(() => expect(props.onConnect).toHaveBeenCalledWith('m-2'));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('Connect is disabled until there is exactly one match; Enter then connects it', async () => {
    serve([mapHit('m-1', 'Glossary Altitude', 'Altitude')]);
    const { props } = renderModal();
    fireEvent.change(box(), { target: { value: 'glossary' } });
    await screen.findByTestId('connect-map-hit-m-1');
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(props.onConnect).toHaveBeenCalledWith('m-1'));
  });

  it('several matches: Connect stays disabled and asks for a pick', async () => {
    serve([mapHit('a', 'A map', 'X'), mapHit('b', 'B map', 'X')]);
    renderModal();
    fireEvent.change(box(), { target: { value: 'map' } });
    await screen.findByTestId('connect-map-hit-a');
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('a pasted UUID or Heretto link connects directly, with no search request', async () => {
    const served = serve([]);
    const { props } = renderModal();
    fireEvent.change(box(), { target: { value: 'https://example.heretto.com/#map-editor;id=0f0f0f0f-1111-2222-3333-444444444444' } });
    await new Promise(r => setTimeout(r, 450));
    expect(served.urls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(props.onConnect).toHaveBeenCalledWith('https://example.heretto.com/#map-editor;id=0f0f0f0f-1111-2222-3333-444444444444'));
  });

  it('no matches says so; without a Heretto connection the box takes a UUID only', async () => {
    serve([]);
    const { unmount } = renderModal();
    fireEvent.change(box(), { target: { value: 'nothing like this' } });
    await screen.findByText('No maps match.');
    unmount();
    const served = serve([]);
    renderModal({ herettoConnected: false });
    expect(screen.getByText('Map UUID or Heretto link')).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: 'altitude' } });
    await new Promise(r => setTimeout(r, 450));
    expect(served.urls).toEqual([]);
  });
});
