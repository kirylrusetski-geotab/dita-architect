import { herettoFolderCache } from '../constants/heretto';
import { parseHerettoFolder } from './heretto-utils';
import type { HerettoItem } from '../types/heretto';

// Permanent cache for resolved URLs (image UUIDs never change)
const resolvedUrlCache = new Map<string, string>();

/**
 * Validates that a string looks like a UUID (basic alphanumeric + hyphen check)
 */
function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(uuid);
}

/**
 * Clear the resolved URL cache (e.g., when credentials change)
 */
export function clearResolvedUrlCache(): void {
  resolvedUrlCache.clear();
}

/**
 * Resolves a relative DITA image href to a Heretto content URL.
 *
 * @param relativeHref - Path like "../Altitude_FAQ_Images/image1.png"
 * @param parentFolderUuid - UUID of the containing folder
 * @param ancestorUuids - Array of ancestor UUIDs [root, ..., grandparent, parent]
 * @returns Promise resolving to content URL or null if not found/failed
 */
export async function resolveHerettoImageHref(
  relativeHref: string,
  parentFolderUuid?: string,
  ancestorUuids?: string[]
): Promise<string | null> {
  if (!relativeHref || !parentFolderUuid || !ancestorUuids) return null;

  // Check permanent cache first
  const cacheKey = `${parentFolderUuid}:${relativeHref}`;
  const cached = resolvedUrlCache.get(cacheKey);
  if (cached) return cached;

  try {
    if (relativeHref.startsWith('/')) return null;

    const segments = relativeHref.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    if (segments[0] === '.') segments.shift();

    let currentFolderUuid = parentFolderUuid;
    let segmentIndex = 0;

    // Traverse up via ".." segments
    while (segmentIndex < segments.length && segments[segmentIndex] === '..') {
      const parentIndex = ancestorUuids.indexOf(currentFolderUuid);
      if (parentIndex <= 0) return null;
      currentFolderUuid = ancestorUuids[parentIndex - 1];
      segmentIndex++;
    }

    // Traverse forward through named folder segments
    while (segmentIndex < segments.length - 1) {
      const folderName = segments[segmentIndex];
      const folderItems = await fetchFolderItems(currentFolderUuid);
      if (!folderItems) return null;
      const folder = folderItems.find(item => item.type === 'folder' && item.name === folderName);
      if (!folder) return null;
      currentFolderUuid = folder.uuid;
      segmentIndex++;
    }

    // Find the final image file
    const fileName = segments[segmentIndex];
    const folderItems = await fetchFolderItems(currentFolderUuid);
    if (!folderItems) return null;

    const imageFile = folderItems.find(item => item.type === 'file' && item.name === fileName);
    if (!imageFile) return null;

    if (!isValidUuid(imageFile.uuid)) {
      console.warn('[HerettoImageResolver] Invalid UUID for image file:', imageFile.uuid);
      return null;
    }

    const contentUrl = `/heretto-api/all-files/${imageFile.uuid}/content`;
    resolvedUrlCache.set(cacheKey, contentUrl);
    return contentUrl;
  } catch (error) {
    console.warn('[HerettoImageResolver] Failed to resolve href:', relativeHref, error);
    return null;
  }
}

/**
 * Fetches folder items from Heretto API with caching
 */
async function fetchFolderItems(folderUuid: string): Promise<HerettoItem[] | null> {
  const cached = herettoFolderCache.get(folderUuid);
  if (cached) return cached;

  try {
    const response = await fetch(`/heretto-api/all-files/${folderUuid}`);
    if (!response.ok) return null;
    const xml = await response.text();
    const items = parseHerettoFolder(xml);
    herettoFolderCache.set(folderUuid, items);
    return items;
  } catch (error) {
    console.warn('[HerettoImageResolver] Failed to fetch folder items:', folderUuid, error);
    return null;
  }
}
