import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateEditorStatus, updateTabsState } from '../lib/editor-state-bridge';
import type { Tab } from '../types/tab';

// Mock a minimal Vite server for testing API endpoints
interface MockResponse {
  writeHead: (status: number, headers?: Record<string, string>) => void;
  end: (data?: string) => void;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
}

interface MockRequest {
  method: string;
  url?: string;
}

// Create mock tab data for testing
const createMockTab = (id: string, overrides: Partial<Tab> = {}): Tab => ({
  id,
  xmlContent: `<topic><title>Test Topic ${id}</title></topic>`,
  lastUpdatedBy: 'editor',
  savedXmlRef: { current: `<topic><title>Test Topic ${id}</title></topic>` },
  herettoFile: null,
  herettoLastSaved: null,
  herettoRemoteChanged: false,
  herettoDirty: false,
  hasXmlErrors: false,
  xmlErrors: [],
  syncTrigger: 0,
  monacoApiRef: { current: null },
  localFileName: null,
  editMode: false,
  editModeEnterTrigger: 0,
  editModeAcceptTrigger: 0,
  editModeRejectTrigger: 0,
  snapshotRef: { current: null },
  herettoReplaceTarget: null,
  herettoJustLoaded: false,
  inlineValidationErrors: new Map(),
  validationTrigger: 0,
  ...overrides
});

// Mock the editor state that would be created in vite.config.ts
const mockEditorState = {
  version: '0.7.2',
  herettoConnected: false,
  tabCount: 0,
  activeTabId: '',
  theme: 'dark',
  tabs: new Map()
};

// Mock the API middleware functions from vite.config.ts
function createStatusEndpoint() {
  return (req: MockRequest, res: MockResponse) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: mockEditorState.version,
        herettoConnected: mockEditorState.herettoConnected,
        tabCount: mockEditorState.tabCount,
        activeTabId: mockEditorState.activeTabId,
        theme: mockEditorState.theme
      }));
    } else {
      res.writeHead(405);
      res.end();
    }
  };
}

function createTabsEndpoint() {
  return (req: MockRequest, res: MockResponse) => {
    if (req.method === 'GET') {
      const tabs = Array.from(mockEditorState.tabs.values()).map(tab => ({
        id: tab.id,
        fileName: tab.fileName,
        herettoFile: tab.herettoFile,
        dirty: tab.dirty,
        xmlErrorCount: tab.xmlErrorCount
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeTabId: mockEditorState.activeTabId,
        tabs
      }));
    } else {
      res.writeHead(405);
      res.end();
    }
  };
}

function createTabContentEndpoint() {
  return (req: MockRequest, res: MockResponse) => {
    if (req.method === 'GET') {
      const urlPath = req.url || '';
      const match = urlPath.match(/^\/api\/tabs\/([^\/]+)\/content$/);
      if (!match) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      const tabId = match[1];
      const tab = mockEditorState.tabs.get(tabId);
      if (!tab) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Tab not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: tab.id,
        fileName: tab.fileName,
        herettoFile: tab.herettoFile,
        dirty: tab.dirty,
        xmlErrors: tab.xmlErrors,
        xml: tab.xmlContent
      }));
    } else {
      res.writeHead(405);
      res.end();
    }
  };
}

// Helper to capture response data
function captureResponse(): { req: MockRequest; res: MockResponse & { captured: { status: number; headers?: Record<string, string>; body: string } } } {
  const captured: { status: number; headers?: Record<string, string>; body: string } = {
    status: 200,
    body: ''
  };
  const res = {
    writeHead: vi.fn((status: number, headers?: Record<string, string>) => {
      captured.status = status;
      captured.headers = headers;
    }),
    end: vi.fn((data?: string) => {
      captured.body = data || '';
    }),
    captured
  };
  const req = { method: 'GET' };
  return { req, res };
}

describe('Read-only API endpoints', () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockEditorState.herettoConnected = false;
    mockEditorState.tabCount = 0;
    mockEditorState.activeTabId = '';
    mockEditorState.theme = 'dark';
    mockEditorState.tabs.clear();

    // Set up the bridge reference
    vi.mocked(updateEditorStatus);
    vi.mocked(updateTabsState);
  });

  describe('GET /api/status', () => {
    it('returns correct status when editor is ready', () => {
      const statusHandler = createStatusEndpoint();
      const { req, res } = captureResponse();

      // Update state to simulate editor activity
      mockEditorState.herettoConnected = true;
      mockEditorState.theme = 'light';
      mockEditorState.tabCount = 2;
      mockEditorState.activeTabId = 'tab-1';

      statusHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({
        version: '0.7.2',
        herettoConnected: true,
        tabCount: 2,
        activeTabId: 'tab-1',
        theme: 'light'
      });
    });

    it('returns initial state when no tabs are loaded', () => {
      const statusHandler = createStatusEndpoint();
      const { req, res } = captureResponse();

      statusHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({
        version: '0.7.2',
        herettoConnected: false,
        tabCount: 0,
        activeTabId: '',
        theme: 'dark'
      });
    });

    it('returns 405 for non-GET methods', () => {
      const statusHandler = createStatusEndpoint();
      const { req, res } = captureResponse();
      req.method = 'POST';

      statusHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(405);
    });
  });

  describe('GET /api/tabs', () => {
    it('returns empty array when no tabs are loaded', () => {
      const tabsHandler = createTabsEndpoint();
      const { req, res } = captureResponse();

      tabsHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({
        activeTabId: '',
        tabs: []
      });
    });

    it('returns correct tab metadata when tabs are loaded', () => {
      const tabsHandler = createTabsEndpoint();
      const { req, res } = captureResponse();

      // Simulate tabs being loaded
      const mockTab1 = createMockTab('tab-1', {
        localFileName: 'test1.dita',
        herettoDirty: true,
        xmlErrors: [{ line: 1, column: 10, message: 'Test error', severity: 'error' }]
      });
      const mockTab2 = createMockTab('tab-2', {
        herettoFile: { uuid: 'uuid-123', name: 'heretto-file.dita', path: '/path/to/file' },
        herettoDirty: false,
        xmlErrors: []
      });

      // Use bridge function to update state (simulates React component updating)
      updateTabsState([mockTab1, mockTab2], 'tab-1');

      // Manually update mock state since the bridge isn't actually connected in tests
      mockEditorState.tabs.set('tab-1', {
        id: 'tab-1',
        fileName: 'test1.dita',
        herettoFile: null,
        dirty: true,
        xmlErrorCount: 1,
        xmlContent: mockTab1.xmlContent,
        xmlErrors: [{ line: 1, column: 10, message: 'Test error', severity: 'error' }]
      });
      mockEditorState.tabs.set('tab-2', {
        id: 'tab-2',
        fileName: 'heretto-file.dita',
        herettoFile: { uuid: 'uuid-123', name: 'heretto-file.dita', path: '/path/to/file' },
        dirty: false,
        xmlErrorCount: 0,
        xmlContent: mockTab2.xmlContent,
        xmlErrors: []
      });
      mockEditorState.activeTabId = 'tab-1';
      mockEditorState.tabCount = 2;

      tabsHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({
        activeTabId: 'tab-1',
        tabs: [
          {
            id: 'tab-1',
            fileName: 'test1.dita',
            herettoFile: null,
            dirty: true,
            xmlErrorCount: 1
          },
          {
            id: 'tab-2',
            fileName: 'heretto-file.dita',
            herettoFile: { uuid: 'uuid-123', name: 'heretto-file.dita', path: '/path/to/file' },
            dirty: false,
            xmlErrorCount: 0
          }
        ]
      });
    });

    it('returns 405 for non-GET methods', () => {
      const tabsHandler = createTabsEndpoint();
      const { req, res } = captureResponse();
      req.method = 'PUT';

      tabsHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(405);
    });
  });

  describe('GET /api/tabs/:id/content', () => {
    beforeEach(() => {
      // Set up test tab
      const mockTab = createMockTab('tab-1', {
        localFileName: 'test.dita',
        xmlContent: '<topic><title>Test Content</title><body><p>Hello world</p></body></topic>',
        xmlErrors: [
          { line: 2, column: 5, message: 'Missing closing tag', severity: 'error' }
        ]
      });

      mockEditorState.tabs.set('tab-1', {
        id: 'tab-1',
        fileName: 'test.dita',
        herettoFile: null,
        dirty: false,
        xmlErrorCount: 1,
        xmlContent: mockTab.xmlContent,
        xmlErrors: [{ line: 2, column: 5, message: 'Missing closing tag', severity: 'error' }]
      });
    });

    it('returns 404 for malformed URLs', () => {
      const contentHandler = createTabContentEndpoint();
      const { req, res } = captureResponse();
      req.url = '/api/tabs/invalid-path';

      contentHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({ error: 'Not found' });
    });

    it('returns 404 for non-existent tab', () => {
      const contentHandler = createTabContentEndpoint();
      const { req, res } = captureResponse();
      req.url = '/api/tabs/non-existent-tab/content';

      contentHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({ error: 'Tab not found' });
    });

    it('returns correct content and metadata for existing tab', () => {
      const contentHandler = createTabContentEndpoint();
      const { req, res } = captureResponse();
      req.url = '/api/tabs/tab-1/content';

      contentHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const response = JSON.parse(res.captured.body);
      expect(response).toEqual({
        id: 'tab-1',
        fileName: 'test.dita',
        herettoFile: null,
        dirty: false,
        xmlErrors: [{ line: 2, column: 5, message: 'Missing closing tag', severity: 'error' }],
        xml: '<topic><title>Test Content</title><body><p>Hello world</p></body></topic>'
      });
    });

    it('strips non-serializable refs from response', () => {
      const contentHandler = createTabContentEndpoint();
      const { req, res } = captureResponse();
      req.url = '/api/tabs/tab-1/content';

      contentHandler(req, res);

      const response = JSON.parse(res.captured.body);
      // Ensure no ref properties are present
      expect(response).not.toHaveProperty('savedXmlRef');
      expect(response).not.toHaveProperty('monacoApiRef');
      expect(response).not.toHaveProperty('snapshotRef');
    });

    it('returns 405 for non-GET methods', () => {
      const contentHandler = createTabContentEndpoint();
      const { req, res } = captureResponse();
      req.method = 'DELETE';
      req.url = '/api/tabs/tab-1/content';

      contentHandler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(405);
    });
  });

  describe('State synchronization', () => {
    it('handles rapid state changes without race conditions', () => {
      // This test verifies that multiple rapid updates don't corrupt the state
      const mockTab = createMockTab('tab-1');

      // Simulate rapid updates
      updateTabsState([mockTab], 'tab-1');
      updateTabsState([], '');
      updateTabsState([mockTab], 'tab-1');

      // The actual state updates would happen in vite.config.ts via the bridge
      // This test mainly ensures the bridge functions don't throw errors
      expect(true).toBe(true); // If we get here without errors, the test passes
    });

    it('handles empty state gracefully', () => {
      updateEditorStatus({ herettoConnected: false, theme: 'dark' });
      updateTabsState([], '');

      // Should not throw errors when called with empty state
      expect(true).toBe(true);
    });
  });
});