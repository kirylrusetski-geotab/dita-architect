// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveHerettoImageHref, clearResolvedUrlCache } from '../lib/heretto-image-resolver';
import { herettoFolderCache } from '../constants/heretto';

// ─── P2-23 Heretto Image Resolution Fix Tests ───────────────────────────────

describe('P2-23 Heretto image resolution fix validation', () => {
  beforeEach(() => {
    clearResolvedUrlCache();
    herettoFolderCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const VALID_UUIDS = {
    root: '00000000-0000-0000-0000-000000000000',
    folder1: '11111111-1111-1111-1111-111111111111',
    folder2: '22222222-2222-2222-2222-222222222222',
    subfolder: '33333333-3333-3333-3333-333333333333',
    image1: '44444444-4444-4444-4444-444444444444',
    image2: '55555555-5555-5555-5555-555555555555',
  };

  const mockFolderXml = (items: Array<{ uuid: string; name: string; type: 'folder' | 'file' }>) => {
    const itemsXml = items.map(item =>
      item.type === 'folder'
        ? `<folder id="${item.uuid}" name="${item.name}"/>`
        : `<resource id="${item.uuid}" name="${item.name}"/>`
    ).join('\n');
    return `<folder><children>${itemsXml}</children></folder>`;
  };

  // ── Core fix: files opened via search work correctly ─────────────────────

  describe('files opened via search - core P2-23 fix', () => {
    it('resolves images for files in subfolder accessing sibling folder (core P2-23 scenario)', async () => {
      // This is the actual P2-23 scenario: file opened via search has complete ancestorUuids
      // The old condition `if (parentIndex <= 0)` would prevent traversal when parentIndex is 0
      // But the fix allows going from any folder back to root (parentIndex = 0)
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.folder1, name: 'documents', type: 'folder' },
          { uuid: VALID_UUIDS.folder2, name: 'images', type: 'folder' }
        ]))
      } as Response).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.image1, name: 'diagram.png', type: 'file' }
        ]))
      } as Response);

      // File opened via search is in documents folder, wants to access ../images/diagram.png
      const result = await resolveHerettoImageHref(
        '../images/diagram.png',
        VALID_UUIDS.folder1, // File is in documents folder
        [VALID_UUIDS.root, VALID_UUIDS.folder1] // root at index 0, documents at index 1
      );

      // Anna's fix: changed condition from `if (parentIndex <= 0)` to `if (parentIndex < 0)`
      // This allows traversal when parentIndex is 0 (accessing root folder)
      expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.image1}/content`);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('resolves images for files one level deep accessing sibling folders', async () => {
      // Another common scenario from search results
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.folder1, name: 'documents', type: 'folder' },
            { uuid: VALID_UUIDS.folder2, name: 'media', type: 'folder' }
          ]))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.image1, name: 'screenshot.png', type: 'file' }
          ]))
        } as Response);

      const result = await resolveHerettoImageHref(
        '../media/screenshot.png',
        VALID_UUIDS.folder1, // File is in documents folder
        [VALID_UUIDS.root, VALID_UUIDS.folder1] // root -> documents
      );

      expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.image1}/content`);
      expect(fetchSpy).toHaveBeenNthCalledWith(1, `/heretto-api/all-files/${VALID_UUIDS.root}`);
      expect(fetchSpy).toHaveBeenNthCalledWith(2, `/heretto-api/all-files/${VALID_UUIDS.folder2}`);
    });

    it('resolves images for deeply nested files accessing parent directories', async () => {
      // Test multiple levels of ".." traversal
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.image2, name: 'shared-asset.svg', type: 'file' }
        ]))
      } as Response);

      const deepAncestorChain = [
        VALID_UUIDS.root,         // index 0
        VALID_UUIDS.folder1,      // index 1
        VALID_UUIDS.folder2,      // index 2
        VALID_UUIDS.subfolder     // index 3 (current folder)
      ];

      const result = await resolveHerettoImageHref(
        '../../../shared-asset.svg', // Go up 3 levels from subfolder (index 3) to root (index 0)
        VALID_UUIDS.subfolder,
        deepAncestorChain
      );

      expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.image2}/content`);
      // Should fetch from root (3 levels up: subfolder -> folder2 -> folder1 -> root)
      expect(fetchSpy).toHaveBeenCalledWith(`/heretto-api/all-files/${VALID_UUIDS.root}`);
    });

    it('correctly prevents traversal above root level (bounds checking works)', async () => {
      // Should fail when trying to go above root - this validates Elena's bounds checking
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await resolveHerettoImageHref(
        '../image.png', // Try to go up from root
        VALID_UUIDS.root,
        [VALID_UUIDS.root] // Only root exists, can't go higher
      );

      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[HerettoImageResolver] Already at root folder, cannot traverse up further'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ── Elena's feedback: bounds checking regression tests ───────────────────

  describe('Elena feedback regression tests - bounds checking', () => {
    it('prevents undefined array access when parentIndex is 0', async () => {
      // Elena's specific concern: when parentIndex is 0, accessing ancestorUuids[parentIndex - 1]
      // would access index -1, returning undefined

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // This should trigger the bounds check without causing undefined access
      const result = await resolveHerettoImageHref(
        '../../image.png', // Try to go up 2 levels
        VALID_UUIDS.root,   // From root folder (parentIndex = 0)
        [VALID_UUIDS.root]  // Only root in chain
      );

      expect(result).toBe(null);

      // Should warn about already being at root, not about undefined access
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[HerettoImageResolver] Already at root folder, cannot traverse up further'
      );

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('handles edge case where parentIndex > 0 correctly', async () => {
      // Verify the bounds check allows normal traversal when parentIndex > 0
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.image1, name: 'test.png', type: 'file' }
        ]))
      } as Response);

      const result = await resolveHerettoImageHref(
        '../test.png',
        VALID_UUIDS.folder1,                           // Current folder (parentIndex = 1)
        [VALID_UUIDS.root, VALID_UUIDS.folder1]        // Root at index 0, folder1 at index 1
      );

      // Should successfully traverse to root (index 0)
      expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.image1}/content`);
      expect(fetchSpy).toHaveBeenCalledWith(`/heretto-api/all-files/${VALID_UUIDS.root}`);
    });

    it('handles malformed ancestorUuids gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Empty ancestorUuids should be handled
      const result1 = await resolveHerettoImageHref(
        '../image.png',
        VALID_UUIDS.folder1,
        []
      );
      expect(result1).toBe(null);

      // Missing current folder in ancestorUuids
      const result2 = await resolveHerettoImageHref(
        '../image.png',
        'missing-folder-uuid',
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );
      expect(result2).toBe(null);

      consoleWarnSpy.mockRestore();
    });
  });

  // ── Enhanced logging and debugging ───────────────────────────────────────

  describe('enhanced logging for P2-23 debugging', () => {
    it('logs detailed traversal information for debugging file-opened-via-search issues', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.image1, name: 'test.png', type: 'file' }
        ]))
      } as Response);

      await resolveHerettoImageHref(
        '../test.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      // Check that comprehensive logging is present
      expect(consoleSpy).toHaveBeenCalledWith('[HerettoImageResolver] Resolver entry:', expect.objectContaining({
        relativeHref: '../test.png',
        parentFolderUuid: VALID_UUIDS.folder1,
        ancestorUuidsCount: 2
      }));

      expect(consoleSpy).toHaveBeenCalledWith('[HerettoImageResolver] Traversing up:', expect.objectContaining({
        currentSegment: '..',
        currentFolderUuid: VALID_UUIDS.folder1,
        parentIndex: 1
      }));

      consoleSpy.mockRestore();
    });

    it('logs bounds checking decisions for transparency', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.image1, name: 'test.png', type: 'file' }
        ]))
      } as Response);

      await resolveHerettoImageHref(
        '../test.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      // Should log the successful traversal up
      expect(consoleSpy).toHaveBeenCalledWith('[HerettoImageResolver] Moved up to folder:', VALID_UUIDS.root);

      consoleSpy.mockRestore();
    });

    it('provides actionable error messages when traversal fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await resolveHerettoImageHref(
        '../image.png',
        'orphaned-folder',
        [VALID_UUIDS.root, VALID_UUIDS.folder1] // orphaned-folder not in chain
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith('[HerettoImageResolver] Cannot traverse up further:', expect.objectContaining({
        currentFolderUuid: 'orphaned-folder',
        parentIndex: -1,
        ancestorUuids: [VALID_UUIDS.root, VALID_UUIDS.folder1]
      }));

      consoleWarnSpy.mockRestore();
    });
  });

  // ── Integration scenarios ────────────────────────────────────────────────

  describe('integration scenarios for search-opened files', () => {
    it('handles typical Heretto search result structure', async () => {
      // Simulate a typical file opened via Heretto search with realistic folder structure
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.folder1, name: 'Documentation', type: 'folder' },
            { uuid: VALID_UUIDS.folder2, name: 'Assets', type: 'folder' }
          ]))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.subfolder, name: 'Images', type: 'folder' }
          ]))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.image1, name: 'workflow.png', type: 'file' }
          ]))
        } as Response);

      const result = await resolveHerettoImageHref(
        '../Assets/Images/workflow.png',
        VALID_UUIDS.folder1, // File opened from Documentation folder
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.image1}/content`);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('processes mixed relative paths correctly', async () => {
      // Test combination of ".." and forward navigation
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.folder2, name: 'media', type: 'folder' }
          ]))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.subfolder, name: 'icons', type: 'folder' }
          ]))
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockFolderXml([
            { uuid: VALID_UUIDS.image2, name: 'icon.svg', type: 'file' }
          ]))
        } as Response);

      const result = await resolveHerettoImageHref(
        '../../media/icons/icon.svg', // Go up 2 levels, then down into media/icons
        VALID_UUIDS.subfolder,
        [VALID_UUIDS.root, VALID_UUIDS.folder1, VALID_UUIDS.subfolder]
      );

      expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.image2}/content`);
    });

    it('maintains performance with caching across multiple resolutions', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.image1, name: 'logo.png', type: 'file' }
        ]))
      } as Response);

      // First resolution
      const result1 = await resolveHerettoImageHref(
        'logo.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      // Second resolution with same parameters
      const result2 = await resolveHerettoImageHref(
        'logo.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      expect(result1).toBe(`/heretto-api/all-files/${VALID_UUIDS.image1}/content`);
      expect(result2).toBe(`/heretto-api/all-files/${VALID_UUIDS.image1}/content`);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Only one API call due to caching
    });
  });

  // ── Error recovery and robustness ────────────────────────────────────────

  describe('error recovery for search-opened files', () => {
    it('handles API failures gracefully for search scenarios', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network timeout'));

      const result = await resolveHerettoImageHref(
        '../image.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      expect(result).toBe(null);
    });

    it('recovers from malformed folder responses', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<invalid>malformed xml</invalid>')
      } as Response);

      const result = await resolveHerettoImageHref(
        'image.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      expect(result).toBe(null);
    });

    it('validates UUIDs to prevent security issues', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: 'invalid-uuid-format', name: 'suspicious.png', type: 'file' }
        ]))
      } as Response);

      const result = await resolveHerettoImageHref(
        'suspicious.png',
        VALID_UUIDS.folder1,
        [VALID_UUIDS.root, VALID_UUIDS.folder1]
      );

      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[HerettoImageResolver] Invalid UUID format for image file:',
        'invalid-uuid-format'
      );

      consoleWarnSpy.mockRestore();
    });
  });
});