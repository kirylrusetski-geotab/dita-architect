// @vitest-environment jsdom
//
// ADR-013 amendment (2026-11-18) — a file opened from the Search or Map view gets
// the same `ancestorUuids` (root first) and path (folder names below the root)
// the Explorer gives it, so the import flow treats it identically.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveAncestry, openableItem } from '../lib/heretto-ancestry';
import { clearHerettoPathCache } from '../lib/heretto-path';
import { herettoFolderCache } from '../constants/heretto';
import { serveHeretto, herettoRequests, type FakeTenant } from './helpers/fakeHeretto';

const tenant = (): FakeTenant => ({
  folders: {
    master: { name: 'master', parent: null },
    root: { name: 'documents', parent: 'master' },
    mg: { name: 'MyGeotab', parent: 'root' },
    rules: { name: 'Rules', parent: 'mg' },
    aux: { name: 'Auxiliary_rules', parent: 'rules' },
    elsewhere: { name: 'Elsewhere', parent: 'master' },
  },
  files: { f: { name: 'Auxiliary_rules.dita', folder: 'aux', content: '<concept id="c"/>' } },
});

beforeEach(() => { clearHerettoPathCache(); herettoFolderCache.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('resolveAncestry', () => {
  it('walks up to the content root: uuids root first, names below the root', async () => {
    serveHeretto(tenant());
    await expect(resolveAncestry('aux', 'root')).resolves.toEqual({
      ancestorUuids: ['root', 'mg', 'rules', 'aux'],
      folderNames: ['MyGeotab', 'Rules', 'Auxiliary_rules'],
    });
  });

  it('the root itself has no names below it', async () => {
    serveHeretto(tenant());
    await expect(resolveAncestry('root', 'root')).resolves.toEqual({ ancestorUuids: ['root'], folderNames: [] });
  });

  it('a folder outside the root, or a failed listing, is null', async () => {
    serveHeretto(tenant());
    await expect(resolveAncestry('elsewhere', 'root')).resolves.toBeNull();
    clearHerettoPathCache();
    serveHeretto(tenant(), { '/heretto-api/all-files/rules': 500 });
    await expect(resolveAncestry('aux', 'root')).resolves.toBeNull();
  });

  it('each folder is listed once (the walk up and the names share the cache)', async () => {
    serveHeretto(tenant());
    await resolveAncestry('aux', 'root');
    expect([...herettoRequests].sort()).toEqual(['/heretto-api/all-files/aux', '/heretto-api/all-files/mg', '/heretto-api/all-files/root', '/heretto-api/all-files/rules']);
  });
});

describe('openableItem', () => {
  it('the search-result shape handleHerettoOpen takes', async () => {
    serveHeretto(tenant());
    await expect(openableItem({ uuid: 'f', name: 'Auxiliary_rules.dita', folderUuid: 'aux' }, 'root')).resolves.toEqual({
      uuid: 'f', name: 'Auxiliary_rules.dita', type: 'file',
      path: 'MyGeotab/Rules/Auxiliary_rules/Auxiliary_rules.dita',
      ancestorUuids: ['root', 'mg', 'rules', 'aux'],
    });
  });

  it('opens anyway when the ancestry cannot be read: its folder as the only ancestor, the fallback path', async () => {
    serveHeretto(tenant(), { '/heretto-api/all-files/aux': 'network' });
    await expect(openableItem({ uuid: 'f', name: 'x.dita', folderUuid: 'aux' }, 'root', 'A/B/x.dita')).resolves.toEqual({
      uuid: 'f', name: 'x.dita', type: 'file', path: 'A/B/x.dita', ancestorUuids: ['aux'],
    });
  });
});
