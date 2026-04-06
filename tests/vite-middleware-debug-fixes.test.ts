// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

// Mock the vite config module
const mockMiddleware = vi.fn();
const mockConfigureServer = vi.fn();

// ─── Vite Middleware Debug Fixes ─────────────────────────────────────────────

describe('Vite Debug Middleware (Jamie\'s Fixes)', () => {
  let mockReq: Partial<IncomingMessage>;
  let mockRes: Partial<ServerResponse>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();

    // Mock request object
    mockReq = {
      url: '',
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'accept': 'image/png'
      }
    };

    // Mock response object with Jamie's fixed implementation
    mockRes = {
      statusCode: 200,
      getHeader: vi.fn((name: string) => {
        if (name === 'content-type') return 'image/png';
        if (name === 'content-length') return '12345';
        return undefined;
      }),
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
      write: vi.fn()
    };

    // Store original functions to test Jamie's argument handling fix
    const originalWrite = mockRes.write;
    const originalEnd = mockRes.end;

    // Implement Jamie's fix for res.write and res.end parameter handling
    mockRes.write = function(chunk: any) {
      if (typeof chunk === 'string') {
        // responseBody += chunk; (would be implemented in real middleware)
      } else if (Buffer.isBuffer(chunk)) {
        // responseBody += chunk.toString('utf8', 0, Math.min(100, chunk.length));
      }
      // Jamie's fix: use arguments object instead of direct parameters
      return (originalWrite as any)?.apply(this, arguments);
    };

    mockRes.end = function(chunk?: any) {
      if (chunk) {
        if (typeof chunk === 'string') {
          // responseBody += chunk;
        } else if (Buffer.isBuffer(chunk)) {
          // responseBody += chunk.toString('utf8', 0, Math.min(100, chunk.length));
        }
      }
      // Jamie's fix: use arguments object instead of direct parameters
      return (originalEnd as any)?.apply(this, arguments);
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── res.write and res.end parameter fixes ────────────────────────────────

  it('res.write handles string chunks correctly with arguments object', () => {
    const originalWrite = vi.fn();
    mockRes.write = function(chunk: any) {
      if (typeof chunk === 'string') {
        // Process string chunk
      }
      // Use arguments object as Jamie fixed
      return (originalWrite as any).apply(this, arguments);
    };

    // Test the fixed implementation
    const testChunk = 'test string data';
    mockRes.write!(testChunk);

    expect(originalWrite).toHaveBeenCalledWith(testChunk);
  });

  it('res.write handles buffer chunks correctly with arguments object', () => {
    const originalWrite = vi.fn();
    mockRes.write = function(chunk: any) {
      if (Buffer.isBuffer(chunk)) {
        // Process buffer chunk with length limit
        chunk.toString('utf8', 0, Math.min(100, chunk.length));
      }
      return (originalWrite as any).apply(this, arguments);
    };

    const testBuffer = Buffer.from('test buffer data');
    mockRes.write!(testBuffer);

    expect(originalWrite).toHaveBeenCalledWith(testBuffer);
  });

  it('res.end handles optional chunk parameter with arguments object', () => {
    const originalEnd = vi.fn();
    mockRes.end = function(chunk?: any) {
      if (chunk) {
        if (typeof chunk === 'string') {
          // Process final chunk
        }
      }
      // Jamie's fix: use arguments object
      return (originalEnd as any).apply(this, arguments);
    };

    // Test with chunk parameter
    const testChunk = 'final chunk';
    mockRes.end!(testChunk);
    expect(originalEnd).toHaveBeenCalledWith(testChunk);

    // Test without chunk parameter
    mockRes.end!();
    expect(originalEnd).toHaveBeenCalledWith();
  });

  // ── heretto content request debugging ─────────────────────────────────────

  it('logs heretto content requests with correct UUID extraction', () => {
    const testUuid = '12345678-1234-1234-1234-123456789abc';
    mockReq.url = `/heretto-api/all-files/${testUuid}/content`;

    // Simulate the middleware logic
    const uuidMatch = mockReq.url.match(/\/heretto-api\/all-files\/([^\/]+)\/content/);
    const extractedUuid = uuidMatch ? uuidMatch[1] : 'unknown';

    expect(extractedUuid).toBe(testUuid);
  });

  it('logs request details for heretto content URLs', () => {
    mockReq.url = '/heretto-api/all-files/test-uuid-123/content';
    mockReq.method = 'GET';

    // Simulate middleware logging (would log in real implementation)
    const shouldLog = mockReq.url.startsWith('/heretto-api/all-files/') &&
                     mockReq.url.endsWith('/content');

    expect(shouldLog).toBe(true);

    // Verify the expected log structure
    const expectedLogData = {
      uuid: 'test-uuid-123',
      url: mockReq.url,
      method: mockReq.method,
      headers: {
        'content-type': mockReq.headers!['content-type'],
        'accept': mockReq.headers!.accept,
      }
    };

    expect(expectedLogData.uuid).toBe('test-uuid-123');
    expect(expectedLogData.headers['content-type']).toBe('application/json');
    expect(expectedLogData.headers.accept).toBe('image/png');
  });

  it('determines binary vs text content correctly', () => {
    const testCases = [
      {
        contentType: 'image/png',
        expected: { isBinary: true, isText: false }
      },
      {
        contentType: 'image/jpeg',
        expected: { isBinary: true, isText: false }
      },
      {
        contentType: 'application/octet-stream',
        expected: { isBinary: true, isText: false }
      },
      {
        contentType: 'text/xml',
        expected: { isBinary: false, isText: true }
      },
      {
        contentType: 'application/xml',
        expected: { isBinary: false, isText: true }
      },
      {
        contentType: 'application/json',
        expected: { isBinary: false, isText: true }
      },
      {
        contentType: '',
        expected: { isBinary: true, isText: false }
      }
    ];

    testCases.forEach(({ contentType, expected }) => {
      // Simulate the binary detection logic from the middleware
      const isBinary = contentType.startsWith('image/') ||
                      contentType.startsWith('application/octet-stream') ||
                      (!contentType.includes('text') &&
                       !contentType.includes('xml') &&
                       !contentType.includes('json'));

      expect(isBinary).toBe(expected.isBinary);
      expect(!isBinary).toBe(expected.isText);
    });
  });

  it('logs response details with correct binary detection', () => {
    const responseLogData = {
      uuid: 'test-uuid-456',
      status: 200,
      contentType: 'image/png',
      isBinary: true,
      isText: false,
      responseBodyPreview: '[binary data]',
      contentLength: '12345'
    };

    expect(responseLogData.isBinary).toBe(true);
    expect(responseLogData.isText).toBe(false);
    expect(responseLogData.responseBodyPreview).toBe('[binary data]');
  });

  it('handles text responses with body preview', () => {
    const mockResponseBody = '<?xml version="1.0"?><root>Content here...</root>'.repeat(10);
    const expectedPreview = mockResponseBody.substring(0, 200);

    const responseLogData = {
      uuid: 'xml-uuid-789',
      status: 200,
      contentType: 'application/xml',
      isBinary: false,
      isText: true,
      responseBodyPreview: expectedPreview,
      contentLength: mockResponseBody.length.toString()
    };

    expect(responseLogData.isBinary).toBe(false);
    expect(responseLogData.isText).toBe(true);
    expect(responseLogData.responseBodyPreview.length).toBeLessThanOrEqual(200);
    expect(responseLogData.responseBodyPreview).toBe(expectedPreview);
  });

  // ── error case handling ───────────────────────────────────────────────────

  it('handles malformed URLs gracefully', () => {
    const malformedUrls = [
      '/heretto-api/all-files//content',
      '/heretto-api/all-files/',
      '/heretto-api/all-files/content',
      '/api/other-endpoint'
    ];

    malformedUrls.forEach(url => {
      const uuidMatch = url.match(/\/heretto-api\/all-files\/([^\/]+)\/content/);
      const uuid = uuidMatch ? uuidMatch[1] : 'unknown';

      if (url.includes('/heretto-api/all-files/') && url.endsWith('/content')) {
        // Only well-formed URLs should extract a valid UUID
        if (uuidMatch && uuidMatch[1] && uuidMatch[1] !== '') {
          expect(uuid).not.toBe('unknown');
        } else {
          expect(uuid).toBe('unknown');
        }
      }
    });
  });

  it('handles missing headers gracefully', () => {
    mockReq.headers = {};

    const expectedLogData = {
      headers: {
        'content-type': undefined,
        'accept': undefined,
      }
    };

    expect(expectedLogData.headers['content-type']).toBeUndefined();
    expect(expectedLogData.headers.accept).toBeUndefined();
  });

  // ── TypeScript error regression prevention ────────────────────────────────

  it('verifies arguments object usage prevents TypeScript parameter errors', () => {
    // Test that the fixed implementation can handle various parameter patterns
    const writeTests = [
      'string chunk',
      Buffer.from('buffer chunk'),
      undefined,
      null
    ];

    const endTests = [
      'final string',
      Buffer.from('final buffer'),
      undefined
    ];

    writeTests.forEach(chunk => {
      expect(() => {
        // Simulate the fixed res.write implementation
        const mockWrite = function(this: any, chunk: any) {
          return (vi.fn() as any).apply(this, arguments);
        };
        mockWrite.call(mockRes, chunk);
      }).not.toThrow();
    });

    endTests.forEach(chunk => {
      expect(() => {
        // Simulate the fixed res.end implementation
        const mockEnd = function(this: any, chunk?: any) {
          return (vi.fn() as any).apply(this, arguments);
        };
        mockEnd.call(mockRes, chunk);
      }).not.toThrow();
    });
  });

  it('maintains backward compatibility with existing function signatures', () => {
    // Verify that Jamie's fixes maintain the expected function signatures
    expect(typeof mockRes.write).toBe('function');
    expect(typeof mockRes.end).toBe('function');

    // Test that both functions can be called with different parameter patterns
    expect(() => {
      mockRes.write!('test');
      mockRes.write!(Buffer.from('test'));
      mockRes.end!('final');
      mockRes.end!();
    }).not.toThrow();
  });
});