import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveHerettoImageHref, clearResolvedUrlCache } from '../lib/heretto-image-resolver';
import { herettoFolderCache } from '../constants/heretto';
import type { HerettoItem } from '../types/heretto';

// Mock the heretto folder cache
vi.mock('../constants/heretto', () => ({
  herettoFolderCache: new Map(),
}));

// Mock the parseHerettoFolder utility
vi.mock('../lib/heretto-utils', () => ({
  parseHerettoFolder: vi.fn(),
}));

describe('Heretto Image Resolution Debug Tests', () => {
  const mockParentFolderUuid = '12345678-1234-1234-1234-123456789abc';
  const mockAncestorUuids = [
    'abcdefab-1234-1234-1234-abcdefabcdef',
    '87654321-1234-1234-1234-876543210987',
    '12345678-1234-1234-1234-123456789abc'
  ];

  beforeEach(() => {
    // Clear caches before each test
    clearResolvedUrlCache();
    herettoFolderCache.clear();
    vi.clearAllMocks();

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic relative path resolution', () => {
    it('should resolve simple relative path', async () => {
      const mockFolderItems: HerettoItem[] = [
        {
          uuid: '11111111-2222-3333-4444-555555555555',
          name: 'image1.png',
          type: 'file',
        }
      ];

      // Mock parseHerettoFolder
      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder).mockReturnValue(mockFolderItems);

      // Mock fetch response
      vi.mocked(global.fetch).mockResolvedValue(new Response('<xml>mock folder xml</xml>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
      }));

      const result = await resolveHerettoImageHref(
        'image1.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe('/heretto-api/all-files/11111111-2222-3333-4444-555555555555/content');
      expect(global.fetch).toHaveBeenCalledWith(`/heretto-api/all-files/${mockParentFolderUuid}`);
    });

    it('should resolve parent traversal path', async () => {
      const mockGrandparentItems: HerettoItem[] = [
        {
          uuid: '22222222-3333-4444-5555-666666666666',
          name: 'Images',
          type: 'folder',
        }
      ];

      const mockTargetFolderItems: HerettoItem[] = [
        {
          uuid: '33333333-4444-5555-6666-777777777777',
          name: 'banner.jpg',
          type: 'file',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder)
        .mockReturnValueOnce(mockGrandparentItems)  // First call for grandparent folder
        .mockReturnValueOnce(mockTargetFolderItems); // Second call for target folder

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response('<xml>grandparent xml</xml>', {
          status: 200,
          headers: { 'Content-Type': 'application/xml' },
        }))
        .mockResolvedValueOnce(new Response('<xml>target folder xml</xml>', {
          status: 200,
          headers: { 'Content-Type': 'application/xml' },
        }));

      const result = await resolveHerettoImageHref(
        '../Images/banner.jpg',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe('/heretto-api/all-files/33333333-4444-5555-6666-777777777777/content');

      // Should fetch grandparent folder first, then the Images folder
      expect(global.fetch).toHaveBeenCalledWith('/heretto-api/all-files/87654321-1234-1234-1234-876543210987');
      expect(global.fetch).toHaveBeenCalledWith('/heretto-api/all-files/22222222-3333-4444-5555-666666666666');
    });

    it('should resolve complex nested path', async () => {
      const mockGrandparentItems: HerettoItem[] = [
        {
          uuid: '44444444-5555-6666-7777-888888888888',
          name: 'Shared',
          type: 'folder',
        }
      ];

      const mockSharedFolderItems: HerettoItem[] = [
        {
          uuid: '55555555-6666-7777-8888-999999999999',
          name: 'Assets',
          type: 'folder',
        }
      ];

      const mockAssetsFolderItems: HerettoItem[] = [
        {
          uuid: '66666666-7777-8888-9999-aaaaaaaaaaaa',
          name: 'logo.svg',
          type: 'file',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder)
        .mockReturnValueOnce(mockGrandparentItems)
        .mockReturnValueOnce(mockSharedFolderItems)
        .mockReturnValueOnce(mockAssetsFolderItems);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response('<xml>grandparent xml</xml>', { status: 200 }))
        .mockResolvedValueOnce(new Response('<xml>shared folder xml</xml>', { status: 200 }))
        .mockResolvedValueOnce(new Response('<xml>assets folder xml</xml>', { status: 200 }));

      const result = await resolveHerettoImageHref(
        '../Shared/Assets/logo.svg',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe('/heretto-api/all-files/66666666-7777-8888-9999-aaaaaaaaaaaa/content');
    });
  });

  describe('Current directory paths', () => {
    it('should resolve current directory path', async () => {
      const mockFolderItems: HerettoItem[] = [
        {
          uuid: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
          name: 'icon.png',
          type: 'file',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder).mockReturnValue(mockFolderItems);

      vi.mocked(global.fetch).mockResolvedValue(new Response('<xml>mock xml</xml>', { status: 200 }));

      const result = await resolveHerettoImageHref(
        './icon.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe('/heretto-api/all-files/77777777-8888-9999-aaaa-bbbbbbbbbbbb/content');
    });
  });

  describe('Error cases', () => {
    it('should return null for missing parameters', async () => {
      const result = await resolveHerettoImageHref('image.png', undefined, undefined);
      expect(result).toBe(null);
    });

    it('should return null for absolute paths', async () => {
      const result = await resolveHerettoImageHref(
        '/absolute/path/image.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );
      expect(result).toBe(null);
    });

    it('should return null when folder not found', async () => {
      const mockFolderItems: HerettoItem[] = [
        {
          uuid: '88888888-9999-aaaa-bbbb-cccccccccccc',
          name: 'OtherFolder',
          type: 'folder',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder).mockReturnValue(mockFolderItems);

      vi.mocked(global.fetch).mockResolvedValue(new Response('<xml>mock xml</xml>', { status: 200 }));

      const result = await resolveHerettoImageHref(
        '../MissingFolder/image.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe(null);
    });

    it('should return null when image file not found', async () => {
      const mockFolderItems: HerettoItem[] = [
        {
          uuid: '99999999-aaaa-bbbb-cccc-dddddddddddd',
          name: 'other-file.txt',
          type: 'file',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder).mockReturnValue(mockFolderItems);

      vi.mocked(global.fetch).mockResolvedValue(new Response('<xml>mock xml</xml>', { status: 200 }));

      const result = await resolveHerettoImageHref(
        'missing-image.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe(null);
    });

    it('should return null when API request fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response('', {
        status: 404,
        statusText: 'Not Found'
      }));

      const result = await resolveHerettoImageHref(
        'image.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe(null);
    });

    it('should return null for invalid UUID', async () => {
      const mockFolderItems: HerettoItem[] = [
        {
          uuid: 'invalid-uuid-format',
          name: 'image.png',
          type: 'file',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder).mockReturnValue(mockFolderItems);

      vi.mocked(global.fetch).mockResolvedValue(new Response('<xml>mock xml</xml>', { status: 200 }));

      const result = await resolveHerettoImageHref(
        'image.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result).toBe(null);
    });
  });

  describe('Cache behavior', () => {
    it('should cache successful resolutions', async () => {
      const mockFolderItems: HerettoItem[] = [
        {
          uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          name: 'cached.png',
          type: 'file',
        }
      ];

      const { parseHerettoFolder } = await import('../lib/heretto-utils');
      vi.mocked(parseHerettoFolder).mockReturnValue(mockFolderItems);

      vi.mocked(global.fetch).mockResolvedValue(new Response('<xml>mock xml</xml>', { status: 200 }));

      // First call should hit the API
      const result1 = await resolveHerettoImageHref(
        'cached.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      // Second call should use cache
      const result2 = await resolveHerettoImageHref(
        'cached.png',
        mockParentFolderUuid,
        mockAncestorUuids
      );

      expect(result1).toBe('/heretto-api/all-files/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/content');
      expect(result2).toBe('/heretto-api/all-files/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/content');

      // Should only call fetch once (second call uses cache)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});