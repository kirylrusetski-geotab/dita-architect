// ADR-013 amendment (2026-11-18): the folder chain of a file opened from the
// Search or Map view, which know a file's folder UUID but not the folders above
// it. A tab's `herettoFile.ancestorUuids` (root first) and its path (folder
// names below the root) are what the Explorer and the browser modal already
// provide, so the import flow, the Heretto bar and relative-href resolution all
// behave the same however a topic was found.
import { fetchFolderListing } from './heretto-path';
import type { HerettoSearchResult } from '../types/heretto';

/** Deep enough for any real tree (the deepest seen is 9 levels); stops a broken parent chain. */
const MAX_DEPTH = 40;

export interface FolderAncestry {
  /** Root first, the folder itself last. */
  ancestorUuids: string[];
  /** The names of the folders below the root, root excluded, the folder itself included. */
  folderNames: string[];
}

/**
 * Walk `parent-folder-id` from `folderUuid` up to `rootUuid` through the shared
 * listing cache. Null when the folder is not under the root, a listing cannot be
 * read, or the chain is implausibly deep.
 */
export const resolveAncestry = async (folderUuid: string, rootUuid: string): Promise<FolderAncestry | null> => {
  if (!folderUuid || !rootUuid) return null;
  const chain = [folderUuid];
  let current = folderUuid;
  while (current !== rootUuid) {
    if (chain.length > MAX_DEPTH) return null;
    const listing = await fetchFolderListing(current);
    if (!listing?.parentUuid) return null;
    current = listing.parentUuid;
    if (chain.includes(current)) return null; // a cycle: never loop
    chain.unshift(current);
  }
  const folderNames: string[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const listing = await fetchFolderListing(chain[i]);
    const child = listing?.items.find(item => item.uuid === chain[i + 1]);
    if (!child) return null;
    folderNames.push(child.name);
  }
  return { ancestorUuids: chain, folderNames };
};

/**
 * The item `handleHerettoOpen` takes for a file in `folderUuid`. When the
 * ancestry cannot be read the file still opens, with its own folder as the only
 * ancestor and `fallbackPath` (or its name) as the path.
 */
export const openableItem = async (
  file: { uuid: string; name: string; folderUuid: string },
  rootUuid: string,
  fallbackPath?: string,
): Promise<HerettoSearchResult> => {
  const ancestry = await resolveAncestry(file.folderUuid, rootUuid);
  if (ancestry) {
    return { uuid: file.uuid, name: file.name, type: 'file', path: [...ancestry.folderNames, file.name].join('/'), ancestorUuids: ancestry.ancestorUuids };
  }
  return { uuid: file.uuid, name: file.name, type: 'file', path: fallbackPath || file.name, ancestorUuids: file.folderUuid ? [file.folderUuid] : [] };
};
