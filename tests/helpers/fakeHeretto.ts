// A fake Heretto tenant for tests that walk the folder tree (ADR-013). It
// answers the REST shapes Heretto returns: a folder's XML carries
// `parent-folder-id` and a `<children>` listing, a resource's XML its
// `folder-uuid` and `<name>`, `/content` the file itself.
import { vi } from 'vitest';

export interface FakeFolder { name: string; parent: string | null }
export interface FakeFile { name: string; folder: string; content: string }
export interface FakeTenant { folders: Record<string, FakeFolder>; files: Record<string, FakeFile> }

/** Every URL the stub was asked for, in order (reset by each `serveHeretto`). */
export const herettoRequests: string[] = [];

/** Stub global fetch with `t`. `fail` forces an outcome for a URL: a thrown network error or an HTTP status. */
export function serveHeretto(t: FakeTenant, fail: Record<string, 'network' | number> = {}): void {
  herettoRequests.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input);
    herettoRequests.push(url);
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
