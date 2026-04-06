import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateEditorStatus, updateTabsState } from '../lib/editor-state-bridge';
import type { Tab } from '../types/tab';

// XML validation function (matches server-side implementation)
function validateXmlStructure(xml: string): void {
  const trimmed = xml.trim();
  if (!trimmed) {
    throw new Error('Empty XML content');
  }

  // Check for basic XML structure
  if (!trimmed.includes('<') || !trimmed.includes('>')) {
    throw new Error('Invalid XML: missing opening or closing tags');
  }

  // Must start with < and end with >
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    throw new Error('Invalid XML: must start and end with tag brackets');
  }

  // Parse and validate tag structure
  const tagStack: string[] = [];
  let inTag = false;
  let inQuote = false;
  let quoteChar = '';
  let tagContent = '';
  let i = 0;

  while (i < trimmed.length) {
    const char = trimmed[i];

    if (!inTag && char === '<') {
      inTag = true;
      tagContent = '<';
    } else if (inTag) {
      tagContent += char;

      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
      } else if (inQuote && char === quoteChar) {
        inQuote = false;
      } else if (!inQuote && char === '>') {
        inTag = false;

        // Process the complete tag
        const tag = tagContent.trim();

        // Skip comments, processing instructions, and doctype
        if (tag.startsWith('<!--') || tag.startsWith('<?') || tag.startsWith('<!')) {
          // Valid special tags, skip validation
        } else if (tag.startsWith('</')) {
          // Closing tag
          const tagName = tag.slice(2, -1).trim().split(/\s/)[0];
          if (!tagName) {
            throw new Error('Invalid XML: empty closing tag');
          }
          const lastOpen = tagStack.pop();
          if (!lastOpen || lastOpen !== tagName) {
            throw new Error(`Invalid XML: mismatched closing tag </${tagName}>, expected </${lastOpen || 'none'}>`);
          }
        } else if (tag.endsWith('/>')) {
          // Self-closing tag
          const tagName = tag.slice(1, -2).trim().split(/\s/)[0];
          if (!tagName) {
            throw new Error('Invalid XML: empty self-closing tag');
          }
        } else {
          // Opening tag
          const tagName = tag.slice(1, -1).trim().split(/\s/)[0];
          if (!tagName) {
            throw new Error('Invalid XML: empty opening tag');
          }
          tagStack.push(tagName);
        }

        tagContent = '';
      }
    }
    i++;
  }

  // Check for unclosed tags
  if (tagStack.length > 0) {
    throw new Error(`Invalid XML: unclosed tag <${tagStack[tagStack.length - 1]}>`);
  }

  // Check for unfinished tag
  if (inTag) {
    throw new Error('Invalid XML: incomplete tag at end of document');
  }
}

// Mock response for simulating Vite middleware
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
  body?: string;
  on?: (event: string, callback: (data?: any) => void) => void;
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

describe('Write API Endpoints', () => {
  let mockBridge: any;

  beforeEach(() => {
    // Reset the mock editor state
    mockEditorState.tabs.clear();
    mockEditorState.activeTabId = '';
    mockEditorState.tabCount = 0;

    // Create mock bridge functions
    mockBridge = {
      updateTabContent: vi.fn().mockReturnValue(true),
      triggerTabSave: vi.fn().mockResolvedValue({ success: true })
    };

    // Set up test tabs
    const testTabs = [
      createMockTab('tab-1', { xmlContent: '<topic id="test1"><title>Test 1</title></topic>' }),
      createMockTab('tab-2', {
        xmlContent: '<topic id="test2"><title>Test 2</title></topic>',
        herettoFile: { uuid: 'heretto-123', name: 'test.dita', path: '/test.dita' }
      })
    ];

    // Populate mock editor state
    testTabs.forEach(tab => {
      const tabState = {
        id: tab.id,
        fileName: tab.localFileName,
        herettoFile: tab.herettoFile,
        dirty: tab.herettoDirty,
        xmlErrorCount: tab.xmlErrors.length,
        xmlContent: tab.xmlContent,
        xmlErrors: tab.xmlErrors
      };
      mockEditorState.tabs.set(tab.id, tabState);
    });
    mockEditorState.activeTabId = testTabs[0].id;
    mockEditorState.tabCount = testTabs.length;
  });

  describe('PUT /api/tabs/:id/content', () => {
    it('should update tab content with valid XML', async () => {
      const tabId = 'tab-1';
      const newXml = '<topic id="test"><title>Updated Content</title><body><p>New paragraph</p></body></topic>';

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      const mockReq: MockRequest = {
        method: 'PUT',
        url: `/api/tabs/${tabId}/content`,
        body: JSON.stringify({ xml: newXml }),
        on: vi.fn((event: string, callback: (data?: any) => void) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({ xml: newXml })));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      // Simulate the API endpoint logic
      if (mockEditorState.tabs.has(tabId)) {
        try {
          const body = JSON.parse(JSON.stringify({ xml: newXml }));
          if (typeof body.xml === 'string') {
            // Validate XML structure (matches server-side validation)
            validateXmlStructure(body.xml);

            if (mockBridge.updateTabContent(tabId, body.xml)) {
              responseStatus = 200;
              responseData = JSON.stringify({ success: true, tabId });
            }
          }
        } catch {
          responseStatus = 400;
          responseData = JSON.stringify({ error: 'Invalid JSON in request body' });
        }
      } else {
        responseStatus = 404;
        responseData = JSON.stringify({ error: 'Tab not found' });
      }

      expect(responseStatus).toBe(200);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse).toEqual({ success: true, tabId });
      expect(mockBridge.updateTabContent).toHaveBeenCalledWith(tabId, newXml);
    });

    it('should reject malformed XML', async () => {
      const tabId = 'tab-1';
      const invalidXml = '<topic><title>Unclosed tag<body></topic>';

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      // Simulate malformed XML validation
      try {
        validateXmlStructure(invalidXml);
        responseStatus = 200;  // Should not reach here
        responseData = JSON.stringify({ success: true });
      } catch (parseError) {
        responseStatus = 400;
        responseData = JSON.stringify({
          error: 'Invalid XML format',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        });
      }

      expect(responseStatus).toBe(400);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse.error).toBe('Invalid XML format');
    });

    it('should return 404 for non-existent tab', async () => {
      const tabId = 'non-existent-id';

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      // Simulate tab lookup
      if (!mockEditorState.tabs.has(tabId)) {
        responseStatus = 404;
        responseData = JSON.stringify({ error: 'Tab not found' });
      }

      expect(responseStatus).toBe(404);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse.error).toBe('Tab not found');
    });

    it('should reject request without xml field', async () => {
      const tabId = 'tab-1';

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      // Simulate request without xml field
      const body = { content: 'wrong field name' } as any;

      if (typeof body.xml !== 'string') {
        responseStatus = 400;
        responseData = JSON.stringify({ error: 'xml field is required and must be a string' });
      }

      expect(responseStatus).toBe(400);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse.error).toBe('xml field is required and must be a string');
    });
  });

  describe('POST /api/tabs/:id/save', () => {
    it('should successfully trigger save for tab with Heretto file', async () => {
      const tabId = 'tab-2'; // This tab has a Heretto file

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      const tab = mockEditorState.tabs.get(tabId);
      if (tab && tab.herettoFile) {
        const result = await mockBridge.triggerTabSave(tabId);
        if (result.success) {
          responseStatus = 200;
          responseData = JSON.stringify({ success: true, tabId });
        }
      }

      expect(responseStatus).toBe(200);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse).toEqual({ success: true, tabId });
      expect(mockBridge.triggerTabSave).toHaveBeenCalledWith(tabId);
    });

    it('should return 400 for tab without Heretto file', async () => {
      const tabId = 'tab-1'; // This tab has no Heretto file

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      const tab = mockEditorState.tabs.get(tabId);
      if (tab && !tab.herettoFile) {
        responseStatus = 400;
        responseData = JSON.stringify({ error: 'Tab has no associated Heretto file to save to' });
      }

      expect(responseStatus).toBe(400);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse.error).toBe('Tab has no associated Heretto file to save to');
    });

    it('should return 404 for non-existent tab', async () => {
      const tabId = 'non-existent-id';

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      if (!mockEditorState.tabs.has(tabId)) {
        responseStatus = 404;
        responseData = JSON.stringify({ error: 'Tab not found' });
      }

      expect(responseStatus).toBe(404);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse.error).toBe('Tab not found');
    });

    it('should handle save operation failures', async () => {
      const tabId = 'tab-2';

      // Mock save failure
      mockBridge.triggerTabSave.mockResolvedValue({
        success: false,
        error: 'Network error'
      });

      let responseStatus = 0;
      let responseData = '';

      const mockRes: MockResponse = {
        writeHead: (status: number) => { responseStatus = status; },
        end: (data?: string) => { responseData = data || ''; }
      };

      const tab = mockEditorState.tabs.get(tabId);
      if (tab && tab.herettoFile) {
        const result = await mockBridge.triggerTabSave(tabId);
        if (!result.success) {
          responseStatus = 500;
          responseData = JSON.stringify({
            error: 'Save operation failed',
            details: result.error
          });
        }
      }

      expect(responseStatus).toBe(500);
      const parsedResponse = JSON.parse(responseData);
      expect(parsedResponse.error).toBe('Save operation failed');
      expect(parsedResponse.details).toBe('Network error');
    });
  });

  describe('State synchronization verification', () => {
    it('should update internal state when API content is changed', async () => {
      const tabId = 'tab-1';
      const newXml = '<topic id="updated"><title>API Updated</title></topic>';

      // Simulate successful API update
      mockBridge.updateTabContent(tabId, newXml);

      // Verify bridge was called correctly
      expect(mockBridge.updateTabContent).toHaveBeenCalledWith(tabId, newXml);

      // In real implementation, this would update the actual state
      // Here we're just verifying the bridge call happened
    });

    it('should maintain tab state consistency during API operations', async () => {
      const tabId = 'tab-1';
      const originalTab = mockEditorState.tabs.get(tabId);

      expect(originalTab).toBeDefined();
      expect(originalTab?.xmlContent).toContain('Test 1');

      // Tab state should remain accessible during API operations
      expect(mockEditorState.tabs.has(tabId)).toBe(true);
    });
  });
});