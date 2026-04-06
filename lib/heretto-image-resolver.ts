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
  console.log('[HerettoImageResolver] Resolver entry:', {
    relativeHref,
    parentFolderUuid,
    ancestorUuidsCount: ancestorUuids?.length || 0,
    ancestorUuids,
  });

  if (!relativeHref || !parentFolderUuid || !ancestorUuids) {
    console.warn('[HerettoImageResolver] Missing required parameters:', {
      hasRelativeHref: !!relativeHref,
      hasParentFolderUuid: !!parentFolderUuid,
      hasAncestorUuids: !!ancestorUuids,
    });
    return null;
  }

  // Check permanent cache first
  const cacheKey = `${parentFolderUuid}:${relativeHref}`;
  const cached = resolvedUrlCache.get(cacheKey);
  if (cached) {
    console.log('[HerettoImageResolver] Cache hit:', { cacheKey, cached });
    return cached;
  }
  console.log('[HerettoImageResolver] Cache miss:', { cacheKey });

  try {
    // Reject absolute paths (not supported)
    if (relativeHref.startsWith('/')) {
      console.warn('[HerettoImageResolver] Absolute paths not supported:', relativeHref);
      return null;
    }

    // Parse the path into segments
    const segments = relativeHref.split('/').filter(Boolean);
    console.log('[HerettoImageResolver] Path segments:', { relativeHref, segments });

    if (segments.length === 0) {
      console.warn('[HerettoImageResolver] No path segments found');
      return null;
    }

    // Handle paths starting with "./" by removing the "./"
    if (segments[0] === '.') {
      segments.shift();
      console.log('[HerettoImageResolver] Removed current directory prefix, segments:', segments);
    }

    // Start from the parent folder
    let currentFolderUuid = parentFolderUuid;
    let segmentIndex = 0;
    console.log('[HerettoImageResolver] Starting traversal from parent folder:', currentFolderUuid);

    // Process ".." segments to traverse up the folder hierarchy
    while (segmentIndex < segments.length && segments[segmentIndex] === '..') {
      const parentIndex = ancestorUuids.indexOf(currentFolderUuid);
      console.log('[HerettoImageResolver] Traversing up:', {
        currentSegment: segments[segmentIndex],
        segmentIndex,
        currentFolderUuid,
        parentIndex,
      });

      if (parentIndex < 0) {
        console.warn('[HerettoImageResolver] Cannot traverse up further:', {
          currentFolderUuid,
          parentIndex,
          ancestorUuids,
        });
        return null;
      }

      // Add bounds check to prevent accessing negative array indices
      if (parentIndex > 0) {
        currentFolderUuid = ancestorUuids[parentIndex - 1];
        console.log('[HerettoImageResolver] Moved up to folder:', currentFolderUuid);
      } else {
        console.warn('[HerettoImageResolver] Already at root folder, cannot traverse up further');
        return null;
      }
      segmentIndex++;
    }

    // Process forward segments
    while (segmentIndex < segments.length - 1) {
      const folderName = segments[segmentIndex];
      console.log('[HerettoImageResolver] Traversing forward to folder:', {
        segmentIndex,
        folderName,
        currentFolderUuid,
      });

      const folderItems = await fetchFolderItems(currentFolderUuid);

      if (!folderItems) {
        console.warn('[HerettoImageResolver] Failed to fetch folder items:', currentFolderUuid);
        return null;
      }

      console.log('[HerettoImageResolver] Folder items:', {
        folderUuid: currentFolderUuid,
        itemCount: folderItems.length,
        folders: folderItems.filter(item => item.type === 'folder').map(item => item.name),
        files: folderItems.filter(item => item.type === 'file').map(item => item.name),
      });

      const folder = folderItems.find(
        item => item.type === 'folder' && item.name === folderName
      );

      if (!folder) {
        console.warn('[HerettoImageResolver] Folder not found:', {
          folderName,
          availableFolders: folderItems.filter(item => item.type === 'folder').map(item => item.name),
        });
        return null;
      }

      console.log('[HerettoImageResolver] Found folder:', {
        folderName,
        folderUuid: folder.uuid,
      });

      currentFolderUuid = folder.uuid;
      segmentIndex++;
    }

    // Find the final image file
    const fileName = segments[segmentIndex];
    console.log('[HerettoImageResolver] Looking for final image file:', {
      fileName,
      currentFolderUuid,
      segmentIndex,
    });

    const folderItems = await fetchFolderItems(currentFolderUuid);

    if (!folderItems) {
      console.warn('[HerettoImageResolver] Failed to fetch final folder items:', currentFolderUuid);
      return null;
    }

    console.log('[HerettoImageResolver] Final folder contents:', {
      folderUuid: currentFolderUuid,
      itemCount: folderItems.length,
      files: folderItems.filter(item => item.type === 'file').map(item => item.name),
    });

    const imageFile = folderItems.find(
      item => item.type === 'file' && item.name === fileName
    );

    if (!imageFile) {
      console.warn('[HerettoImageResolver] Image file not found:', {
        fileName,
        availableFiles: folderItems.filter(item => item.type === 'file').map(item => item.name),
      });
      return null;
    }

    console.log('[HerettoImageResolver] Found image file:', {
      fileName,
      imageUuid: imageFile.uuid,
    });

    // Validate UUID before constructing URL (defense-in-depth)
    if (!isValidUuid(imageFile.uuid)) {
      console.warn('[HerettoImageResolver] Invalid UUID format for image file:', imageFile.uuid);
      return null;
    }

    // Build the content URL
    const contentUrl = `/heretto-api/all-files/${imageFile.uuid}/content`;
    console.log('[HerettoImageResolver] Constructed content URL:', {
      imageUuid: imageFile.uuid,
      contentUrl,
    });

    // Cache the result permanently
    resolvedUrlCache.set(cacheKey, contentUrl);
    console.log('[HerettoImageResolver] Cached result:', { cacheKey, contentUrl });

    return contentUrl;
  } catch (error) {
    console.warn('Failed to resolve Heretto image href:', relativeHref, error);
    return null;
  }
}

/**
 * Fetches folder items from Heretto API with caching
 */
async function fetchFolderItems(folderUuid: string): Promise<HerettoItem[] | null> {
  console.log('[HerettoImageResolver] Fetching folder items:', folderUuid);

  // Check TTL cache first
  const cached = herettoFolderCache.get(folderUuid);
  if (cached) {
    console.log('[HerettoImageResolver] Folder cache hit:', {
      folderUuid,
      itemCount: cached.length,
    });
    return cached;
  }

  console.log('[HerettoImageResolver] Folder cache miss, fetching from API:', folderUuid);

  try {
    const response = await fetch(`/heretto-api/all-files/${folderUuid}`);
    console.log('[HerettoImageResolver] Folder fetch response:', {
      folderUuid,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const items = parseHerettoFolder(xml);
    console.log('[HerettoImageResolver] Parsed folder items:', {
      folderUuid,
      itemCount: items.length,
      folders: items.filter(item => item.type === 'folder').length,
      files: items.filter(item => item.type === 'file').length,
    });

    // Cache with 5-minute TTL
    herettoFolderCache.set(folderUuid, items);

    return items;
  } catch (error) {
    console.warn('[HerettoImageResolver] Failed to fetch folder items:', folderUuid, error);
    return null;
  }
}
