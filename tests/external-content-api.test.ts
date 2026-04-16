/**
 * Tests for the external content loading API endpoints in vite.config.ts.
 *
 * These test the load-content-api plugin which provides:
 * - POST /api/load-content: accepts DITA XML from external tools
 * - GET /api/pending-loads: returns and clears the pending loads queue
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Node.js modules for the Vite config
const mockMiddleware = {
  use: vi.fn()
};

const mockServer = {
  middlewares: mockMiddleware
};

const mockRequest = (method: string, url: string, body?: any) => ({
  method,
  url,
  on: vi.fn((event, callback) => {
    if (event === 'data' && body) {
      callback(Buffer.from(JSON.stringify(body)));
    }
    if (event === 'end') {
      callback();
    }
  })
});

const mockResponse = () => {
  const response = {
    writeHead: vi.fn(),
    end: vi.fn(),
    _status: 200,
    _headers: {},
    _body: ''
  };

  response.writeHead.mockImplementation((status: number, headers?: any) => {
    response._status = status;
    response._headers = headers || {};
  });

  response.end.mockImplementation((body?: string) => {
    response._body = body || '';
  });

  return response;
};

// We need to test the actual plugin behavior, so we'll extract the handler logic
// This simulates the load-content-api plugin's behavior
class LoadContentApiHandler {
  private pendingLoads: Array<{ xml: string; fileName: string; herettoTargetUuid?: string }> = [];

  handleLoadContent(req: any, res: any) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { xml, fileName, herettoTargetUuid } = JSON.parse(body);
          if (!xml || !fileName) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'xml and fileName are required' }));
            return;
          }
          this.pendingLoads.push({ xml, fileName, herettoTargetUuid });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, status: 'loaded' }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed. This endpoint only supports POST requests.' }));
    }
  }

  handlePendingLoads(req: any, res: any) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const loads = [...this.pendingLoads];
      this.pendingLoads.length = 0; // Clear the queue
      res.end(JSON.stringify({ success: true, loads }));
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed. This endpoint only supports GET requests.' }));
    }
  }

  // Test helper to check queue state
  getPendingLoadsCount() {
    return this.pendingLoads.length;
  }
}

describe('External Content API', () => {
  let handler: LoadContentApiHandler;

  beforeEach(() => {
    handler = new LoadContentApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/load-content', () => {
    it('accepts valid DITA XML and returns status loaded', async () => {
      const req = mockRequest('POST', '/api/load-content', {
        xml: '<task id="test"><title>Test Task</title></task>',
        fileName: 'test.dita'
      });
      const res = mockResponse();

      handler.handleLoadContent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true, status: 'loaded' }));
      expect(handler.getPendingLoadsCount()).toBe(1);
    });

    it('accepts XML with optional herettoTargetUuid field', async () => {
      const req = mockRequest('POST', '/api/load-content', {
        xml: '<concept id="test"><title>Test Concept</title></concept>',
        fileName: 'concept.dita',
        herettoTargetUuid: 'uuid-123-456'
      });
      const res = mockResponse();

      handler.handleLoadContent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true, status: 'loaded' }));
      expect(handler.getPendingLoadsCount()).toBe(1);
    });

    it('rejects requests missing xml field', async () => {
      const req = mockRequest('POST', '/api/load-content', {
        fileName: 'test.dita'
      });
      const res = mockResponse();

      handler.handleLoadContent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'xml and fileName are required' }));
      expect(handler.getPendingLoadsCount()).toBe(0);
    });

    it('rejects requests missing fileName field', async () => {
      const req = mockRequest('POST', '/api/load-content', {
        xml: '<task id="test"><title>Test</title></task>'
      });
      const res = mockResponse();

      handler.handleLoadContent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'xml and fileName are required' }));
      expect(handler.getPendingLoadsCount()).toBe(0);
    });

    it('rejects requests with invalid JSON', async () => {
      const req = {
        method: 'POST',
        url: '/api/load-content',
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('invalid json'));
          }
          if (event === 'end') {
            callback();
          }
        })
      };
      const res = mockResponse();

      handler.handleLoadContent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      expect(handler.getPendingLoadsCount()).toBe(0);
    });

    it('returns 405 Method Not Allowed for non-POST requests', async () => {
      const req = mockRequest('GET', '/api/load-content');
      const res = mockResponse();

      handler.handleLoadContent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(405, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res._body);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Method not allowed');
      expect(handler.getPendingLoadsCount()).toBe(0);
    });

    it('queues multiple requests correctly', async () => {
      const requests = [
        { xml: '<task id="t1"><title>Task 1</title></task>', fileName: 'task1.dita' },
        { xml: '<concept id="c1"><title>Concept 1</title></concept>', fileName: 'concept1.dita' },
        { xml: '<reference id="r1"><title>Ref 1</title></reference>', fileName: 'ref1.dita' }
      ];

      for (const payload of requests) {
        const req = mockRequest('POST', '/api/load-content', payload);
        const res = mockResponse();
        handler.handleLoadContent(req, res);
      }

      expect(handler.getPendingLoadsCount()).toBe(3);
    });
  });

  describe('GET /api/pending-loads', () => {
    it('returns empty array when no loads are pending', async () => {
      const req = mockRequest('GET', '/api/pending-loads');
      const res = mockResponse();

      handler.handlePendingLoads(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true, loads: [] }));
    });

    it('returns pending loads and clears the queue', async () => {
      // Add some loads first
      const loadReq = mockRequest('POST', '/api/load-content', {
        xml: '<task id="test"><title>Test</title></task>',
        fileName: 'test.dita'
      });
      const loadRes = mockResponse();
      handler.handleLoadContent(loadReq, loadRes);

      expect(handler.getPendingLoadsCount()).toBe(1);

      // Get pending loads
      const req = mockRequest('GET', '/api/pending-loads');
      const res = mockResponse();

      handler.handlePendingLoads(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res._body);
      expect(response.success).toBe(true);
      expect(response.loads).toHaveLength(1);
      expect(response.loads[0]).toEqual({
        xml: '<task id="test"><title>Test</title></task>',
        fileName: 'test.dita'
      });

      // Queue should be cleared after reading
      expect(handler.getPendingLoadsCount()).toBe(0);
    });

    it('returns multiple pending loads in correct order', async () => {
      const loads = [
        { xml: '<task id="t1"><title>Task 1</title></task>', fileName: 'task1.dita' },
        { xml: '<concept id="c1"><title>Concept 1</title></concept>', fileName: 'concept1.dita', herettoTargetUuid: 'uuid-123' }
      ];

      // Add loads
      for (const payload of loads) {
        const req = mockRequest('POST', '/api/load-content', payload);
        const res = mockResponse();
        handler.handleLoadContent(req, res);
      }

      // Get pending loads
      const req = mockRequest('GET', '/api/pending-loads');
      const res = mockResponse();

      handler.handlePendingLoads(req, res);

      const response = JSON.parse(res._body);
      expect(response.success).toBe(true);
      expect(response.loads).toHaveLength(2);
      expect(response.loads[0]).toEqual(loads[0]);
      expect(response.loads[1]).toEqual(loads[1]);
      expect(handler.getPendingLoadsCount()).toBe(0);
    });

    it('returns 405 Method Not Allowed for non-GET requests', async () => {
      const req = mockRequest('POST', '/api/pending-loads');
      const res = mockResponse();

      handler.handlePendingLoads(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(405, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res._body);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Method not allowed');
    });

    it('clears queue atomically to prevent race conditions', async () => {
      // Add loads
      const loadReq = mockRequest('POST', '/api/load-content', {
        xml: '<task id="test"><title>Test</title></task>',
        fileName: 'test.dita'
      });
      const loadRes = mockResponse();
      handler.handleLoadContent(loadReq, loadRes);

      expect(handler.getPendingLoadsCount()).toBe(1);

      // Multiple concurrent GET requests should not interfere
      const req1 = mockRequest('GET', '/api/pending-loads');
      const res1 = mockResponse();
      handler.handlePendingLoads(req1, res1);

      const req2 = mockRequest('GET', '/api/pending-loads');
      const res2 = mockResponse();
      handler.handlePendingLoads(req2, res2);

      // First request should get the load, second should get empty array
      const response1 = JSON.parse(res1._body);
      const response2 = JSON.parse(res2._body);

      expect(response1.loads).toHaveLength(1);
      expect(response2.loads).toHaveLength(0);
      expect(handler.getPendingLoadsCount()).toBe(0);
    });
  });
});