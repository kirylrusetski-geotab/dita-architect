// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveHerettoImageHref, clearResolvedUrlCache } from '../lib/heretto-image-resolver';
import { herettoFolderCache } from '../constants/heretto';

// ─── setup and teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  clearResolvedUrlCache();
  herettoFolderCache.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── mock heretto folder API responses ───────────────────────────────────────

// Valid UUIDs for testing
const VALID_UUIDS = {
  img1: '550e8400-e29b-41d4-a716-446655440000',
  img2: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  doc1: '12345678-1234-1234-1234-123456789abc',
  'sibling-uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'current-uuid': 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  'assets-uuid': 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa',
  'images-uuid': 'dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb',
  'icon-uuid': 'eeeeeeee-ffff-aaaa-bbbb-cccccccccccc',
  'other-folder': 'ffffffff-aaaa-bbbb-cccc-dddddddddddd',
  folder1: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
  file1: 'bbbbcccc-dddd-eeee-ffff-aaaaddddcccc',
  'deep-uuid': 'ccccdddd-eeee-ffff-aaaa-bbbbffffdddd',
  'nested-uuid': 'ddddeeee-ffff-aaaa-bbbb-ccccaaaaeeee',
  'path-uuid': 'eeeeaaaa-bbbb-cccc-dddd-ffffbbbbffff',
  'img-uuid': 'ffffaaaa-bbbb-cccc-dddd-eeeebbbaaaaa',
};

const mockFolderXml = (items: Array<{ uuid: string; name: string; type: 'folder' | 'file' }>) => {
  const itemsXml = items.map(item =>
    item.type === 'folder'
      ? `<folder id="${item.uuid}" name="${item.name}"/>`
      : `<resource id="${item.uuid}" name="${item.name}"/>`
  ).join('\n');
  return `<folder><children>${itemsXml}</children></folder>`;
};

// ─── resolveHerettoImageHref ──────────────────────────────────────────────────

describe('resolveHerettoImageHref', () => {
  // ── invalid input validation ─────────────────────────────────────────────

  it('returns null when relativeHref is empty', async () => {
    const result = await resolveHerettoImageHref('', 'parent-uuid', ['root', 'parent-uuid']);
    expect(result).toBe(null);
  });

  it('returns null when parentFolderUuid is undefined', async () => {
    const result = await resolveHerettoImageHref('../image.png', undefined, ['root']);
    expect(result).toBe(null);
  });

  it('returns null when ancestorUuids is undefined', async () => {
    const result = await resolveHerettoImageHref('../image.png', 'parent-uuid', undefined);
    expect(result).toBe(null);
  });

  it('returns null for absolute paths starting with slash', async () => {
    const result = await resolveHerettoImageHref('/absolute/path.png', 'parent-uuid', ['root', 'parent-uuid']);
    expect(result).toBe(null);
  });

  it('returns null when no segments remain after parsing', async () => {
    const result = await resolveHerettoImageHref('/', 'parent-uuid', ['root', 'parent-uuid']);
    expect(result).toBe(null);
  });

  // ── direct parent folder resolution ──────────────────────────────────────

  it('resolves image file in the parent folder', async () => {
    const validUuid1 = '550e8400-e29b-41d4-a716-446655440000';
    const validUuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: validUuid1, name: 'logo.png', type: 'file' },
        { uuid: validUuid2, name: 'banner.jpg', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      'logo.png',
      'parent-folder',
      ['root-uuid', 'parent-folder']
    );

    expect(fetchSpy).toHaveBeenCalledWith('/heretto-api/all-files/parent-folder');
    expect(result).toBe(`/heretto-api/all-files/${validUuid1}/content`);
  });

  it('resolves image file with ./ prefix in parent folder', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.img1, name: 'icon.svg', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      './icon.svg',
      'parent-folder',
      ['root-uuid', 'parent-folder']
    );

    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
  });

  it('returns null when image file not found in parent folder', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.doc1, name: 'readme.txt', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      'missing.png',
      'parent-folder',
      ['root-uuid', 'parent-folder']
    );

    expect(result).toBe(null);
  });

  // ── parent traversal with .. segments ────────────────────────────────────

  it('resolves image file in grandparent folder using ../..', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.img1, name: 'header.png', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      '../../header.png',
      'child-folder',
      ['root-uuid', 'parent-folder', 'child-folder']
    );

    expect(fetchSpy).toHaveBeenCalledWith('/heretto-api/all-files/root-uuid');
    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
  });

  it('resolves image file in sibling folder using ../sibling/image', async () => {
    // First API call: get items in parent folder (find sibling folder)
    const parentFolderResponse = mockFolderXml([
      { uuid: VALID_UUIDS['sibling-uuid'], name: 'Images', type: 'folder' },
      { uuid: VALID_UUIDS['current-uuid'], name: 'Documents', type: 'folder' }
    ]);

    // Second API call: get items in sibling folder (find image)
    const siblingFolderResponse = mockFolderXml([
      { uuid: VALID_UUIDS.img1, name: 'diagram.png', type: 'file' },
      { uuid: VALID_UUIDS.img2, name: 'chart.svg', type: 'file' }
    ]);

    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(parentFolderResponse)
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(siblingFolderResponse)
      } as Response);

    const result = await resolveHerettoImageHref(
      '../Images/diagram.png',
      VALID_UUIDS['current-uuid'],
      ['root-uuid', 'parent-uuid', VALID_UUIDS['current-uuid']]
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/heretto-api/all-files/parent-uuid');
    expect(fetchSpy).toHaveBeenNthCalledWith(2, `/heretto-api/all-files/${VALID_UUIDS['sibling-uuid']}`);
    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
  });

  it('returns null when trying to traverse above root folder', async () => {
    const result = await resolveHerettoImageHref(
      '../../../image.png',
      'parent-folder',
      ['root-uuid', 'parent-folder'] // Only 2 levels deep, can't go up 3 levels
    );

    expect(result).toBe(null);
  });

  it('returns null when parent folder not found in ancestor chain', async () => {
    // Current folder UUID not in ancestor chain (data corruption scenario)
    const result = await resolveHerettoImageHref(
      '../image.png',
      'orphaned-folder',
      ['root-uuid', 'parent-folder'] // orphaned-folder not in chain
    );

    expect(result).toBe(null);
  });

  // ── multi-level folder traversal ─────────────────────────────────────────

  it('resolves image through nested folder structure', async () => {
    // First call: parent folder contains Assets folder
    const parentResponse = mockFolderXml([
      { uuid: VALID_UUIDS['assets-uuid'], name: 'Assets', type: 'folder' }
    ]);

    // Second call: Assets folder contains Images folder
    const assetsResponse = mockFolderXml([
      { uuid: VALID_UUIDS['images-uuid'], name: 'Images', type: 'folder' }
    ]);

    // Third call: Images folder contains the target image
    const imagesResponse = mockFolderXml([
      { uuid: VALID_UUIDS['icon-uuid'], name: 'app-icon.png', type: 'file' }
    ]);

    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(parentResponse) } as Response)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(assetsResponse) } as Response)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(imagesResponse) } as Response);

    const result = await resolveHerettoImageHref(
      '../Assets/Images/app-icon.png',
      'current-folder',
      ['root', 'parent-folder', 'current-folder']
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS['icon-uuid']}/content`);
  });

  it('returns null when intermediate folder not found', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS['other-folder'], name: 'OtherFolder', type: 'folder' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      '../MissingFolder/image.png',
      'current-folder',
      ['root', 'parent-folder', 'current-folder']
    );

    expect(result).toBe(null);
  });

  // ── API error handling ───────────────────────────────────────────────────

  it('returns null when API request fails with non-ok status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    const result = await resolveHerettoImageHref(
      'image.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(null);
  });

  it('returns null when API request throws network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const result = await resolveHerettoImageHref(
      'image.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(null);
  });

  it('returns null when API returns malformed XML', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('<invalid xml structure')
    } as Response);

    const result = await resolveHerettoImageHref(
      'image.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(null);
  });

  // ── caching behavior ─────────────────────────────────────────────────────

  it('caches resolved URLs and returns cached result on second call', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.img1, name: 'cached.png', type: 'file' }
      ]))
    } as Response);

    // First call
    const result1 = await resolveHerettoImageHref(
      'cached.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    // Second call with same parameters
    const result2 = await resolveHerettoImageHref(
      'cached.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only one API call
    expect(result1).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
    expect(result2).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
  });

  it('uses different cache keys for different folder contexts', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.img1, name: 'test.png', type: 'file' }
        ]))
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS.img2, name: 'test.png', type: 'file' }
        ]))
      } as Response);

    // Same image name in different folders should result in different API calls
    const result1 = await resolveHerettoImageHref('test.png', VALID_UUIDS.folder1, ['root', VALID_UUIDS.folder1]);
    const result2 = await resolveHerettoImageHref('test.png', 'folder2', ['root', 'folder2']);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result1).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
    expect(result2).toBe(`/heretto-api/all-files/${VALID_UUIDS.img2}/content`);
  });

  // ── UUID validation (Elena's security fix) ───────────────────────────────

  it('returns null when image UUID format is invalid', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: 'not-a-real-uuid', name: 'suspicious.png', type: 'file' }
      ]))
    } as Response);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await resolveHerettoImageHref(
      'suspicious.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith('[HerettoImageResolver] Invalid UUID format for image file:', 'not-a-real-uuid');

    consoleSpy.mockRestore();
  });

  it('accepts properly formatted UUIDs', async () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: validUuid, name: 'secure.png', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      'secure.png',
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(`/heretto-api/all-files/${validUuid}/content`);
  });

  // ── edge cases ───────────────────────────────────────────────────────────

  it('handles case-sensitive filename matching', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.img1, name: 'Image.PNG', type: 'file' },
        { uuid: VALID_UUIDS.img2, name: 'image.png', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      'Image.PNG', // Exact case match
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);
  });

  it('prioritizes files over folders when names conflict', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.folder1, name: 'conflicted', type: 'folder' },
        { uuid: VALID_UUIDS.file1, name: 'conflicted', type: 'file' }
      ]))
    } as Response);

    const result = await resolveHerettoImageHref(
      'conflicted', // Should match the file, not the folder
      'folder-uuid',
      ['root', 'folder-uuid']
    );

    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS.file1}/content`);
  });

  it('handles very long nested paths without performance issues', async () => {
    // Simulate deep nesting: ../../../../../../../deep/nested/path/image.png
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS['deep-uuid'], name: 'deep', type: 'folder' }
        ]))
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS['nested-uuid'], name: 'nested', type: 'folder' }
        ]))
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS['path-uuid'], name: 'path', type: 'folder' }
        ]))
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockFolderXml([
          { uuid: VALID_UUIDS['img-uuid'], name: 'image.png', type: 'file' }
        ]))
      } as Response);

    const ancestorChain = ['root', 'a', 'b', 'c', 'd', 'e', 'f', 'current'];
    const result = await resolveHerettoImageHref(
      '../../../../../deep/nested/path/image.png',
      'current',
      ancestorChain
    );

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(result).toBe(`/heretto-api/all-files/${VALID_UUIDS['img-uuid']}/content`);
  });
});

// ─── clearResolvedUrlCache ────────────────────────────────────────────────────

describe('clearResolvedUrlCache', () => {
  it('clears the resolved URL cache when credentials change', async () => {
    // Set up mock to return same response for multiple calls
    const fetchSpy = vi.spyOn(global, 'fetch');

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.img1, name: 'test.png', type: 'file' }
      ]))
    } as Response;

    fetchSpy
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse);

    // Populate caches
    const result1 = await resolveHerettoImageHref('test.png', VALID_UUIDS.folder1, ['root', VALID_UUIDS.folder1]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result1).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);

    // Clear resolved URL cache (but not folder cache)
    clearResolvedUrlCache();

    // Second call should use cached folder data but still resolve the image UUID again
    // Since the folder cache is intact, no new API calls should be made
    const result2 = await resolveHerettoImageHref('test.png', VALID_UUIDS.folder1, ['root', VALID_UUIDS.folder1]);
    expect(result2).toBe(`/heretto-api/all-files/${VALID_UUIDS.img1}/content`);

    // Still only 1 fetch call because folder data is cached
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not affect herettoFolderCache TTL behavior', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockFolderXml([
        { uuid: VALID_UUIDS.img1, name: 'test.png', type: 'file' }
      ]))
    } as Response);

    // Make first call (populates both caches)
    await resolveHerettoImageHref('test.png', VALID_UUIDS.folder1, ['root', VALID_UUIDS.folder1]);

    // Clear only resolved URL cache, not folder cache
    clearResolvedUrlCache();

    // Make same call again - folder cache should still work
    await resolveHerettoImageHref('test.png', VALID_UUIDS.folder1, ['root', VALID_UUIDS.folder1]);

    // Should only call API once because folder cache is still populated
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});