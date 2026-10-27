// Relative-path resolution against Heretto's folder tree (ADR-013 decision 1).
//
// Every reference in a real map or topic is a relative path (`../Data_Dictionary/
// Platform/x.dita#id`), and Heretto's REST API has no path lookup. It does give,
// for every folder, its `parent-folder-id` and a `<children>` listing (name →
// UUID), so a path resolves one folder at a time: `..` steps to the parent,
// a named segment to the child folder of that name, the last segment to the
// file. Unlike the image resolver's breadcrumb walk, `..` can climb above the
// folder the walk started from — map hrefs do that constantly.
import { herettoFolderCache, TtlCache } from '../constants/heretto';
import { parseHerettoFolder } from './heretto-utils';
import type { HerettoItem } from '../types/heretto';

export interface HerettoFolderListing {
  uuid: string;
  /** null for the repository's root folder. */
  parentUuid: string | null;
  items: HerettoItem[];
}

export interface HerettoPathTarget {
  uuid: string;
  name: string;
  folderUuid: string;
}

// Same lifetime as herettoFolderCache (5 minutes); this one also keeps the parent.
const listingCache = new TtlCache<string, HerettoFolderListing>(5 * 60_000, 500);

// A map's submaps resolve in parallel, mostly through the same few folders:
// share the request in flight instead of fetching one folder once per reference.
const inFlight = new Map<string, Promise<HerettoFolderListing | null>>();

export const clearHerettoPathCache = (): void => { listingCache.clear(); inFlight.clear(); };

/** A folder's listing and parent, fetched once per cache lifetime. Null on any failure. */
export const fetchFolderListing = (uuid: string): Promise<HerettoFolderListing | null> => {
  const cached = listingCache.get(uuid);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(uuid);
  if (pending) return pending;
  const request = requestFolderListing(uuid).finally(() => inFlight.delete(uuid));
  inFlight.set(uuid, request);
  return request;
};

const requestFolderListing = async (uuid: string): Promise<HerettoFolderListing | null> => {
  try {
    const res = await fetch(`/heretto-api/all-files/${uuid}`);
    if (!res.ok) return null;
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const folder = doc.documentElement;
    if (doc.querySelector('parsererror') || folder.tagName !== 'folder') return null;
    const listing: HerettoFolderListing = {
      uuid,
      parentUuid: folder.getAttribute('parent-folder-id') || null,
      items: parseHerettoFolder(xml),
    };
    listingCache.set(uuid, listing);
    // The image resolver and the browser read the same listings.
    herettoFolderCache.set(uuid, listing.items);
    return listing;
  } catch {
    return null;
  }
};

/**
 * Resolve `href` (relative, as DITA writes it) from the folder `folderUuid`.
 * The fragment is ignored. Returns null for anything that does not resolve to
 * a file: a missing segment or file, `..` above the root, an absolute path, a
 * URL, or a failed fetch along the way.
 */
export const resolveHerettoPath = async (href: string, folderUuid: string): Promise<HerettoPathTarget | null> => {
  const path = href.split('#')[0];
  if (!path || path.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  let segments: string[];
  try {
    segments = path.split('/').filter(s => s && s !== '.').map(decodeURIComponent);
  } catch {
    return null; // malformed percent-encoding
  }
  if (segments.length === 0) return null;

  let current = folderUuid;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const listing = await fetchFolderListing(current);
    if (!listing) return null;
    if (segment === '..') {
      if (!listing.parentUuid) return null;
      current = listing.parentUuid;
      continue;
    }
    const folder = listing.items.find(item => item.type === 'folder' && item.name === segment);
    if (!folder) return null;
    current = folder.uuid;
  }

  const fileName = segments[segments.length - 1];
  if (fileName === '..') return null;
  const listing = await fetchFolderListing(current);
  const file = listing?.items.find(item => item.type === 'file' && item.name === fileName);
  return file ? { uuid: file.uuid, name: file.name, folderUuid: current } : null;
};
