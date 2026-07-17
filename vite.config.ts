import path from 'path';
import fs from 'fs';
import os from 'os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Read Heretto credentials (server-side only, never exposed to browser).
// Wrapped in an object so the proxy closure always reads the latest value
// after credential updates via the PUT endpoint.
const herettoState: { auth: string | null } = { auth: null };
try {
  const configPath = path.join(os.homedir(), 'heretto.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (raw.email && raw.token) {
    herettoState.auth = 'Basic ' + Buffer.from(`${raw.email}:${raw.token}`).toString('base64');
  }
} catch {
  console.warn('[DITA Architect] ~/heretto.json not found or invalid — Heretto proxy disabled');
}

const herettoConfigPath = path.join(os.homedir(), 'heretto.json');

// XML validation function for server-side use
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

// Module-level queue for pending external content loads
interface PendingLoad {
  xml: string;
  fileName: string;
  herettoTargetUuid?: string;
}
const pendingLoads: PendingLoad[] = [];

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// Module-level state for read-only API endpoints
interface EditorState {
  version: string;
  herettoConnected: boolean;
  tabCount: number;
  activeTabId: string;
  theme: string;
  tabs: Map<string, {
    id: string;
    fileName: string | null;
    herettoFile: { uuid: string; name: string; path: string } | null;
    dirty: boolean;
    xmlErrorCount: number;
    xmlContent: string;
    xmlErrors: Array<{ line: number; column: number; message: string; severity: 'error' | 'warning' }>;
  }>;
}

const editorState: EditorState = {
  version: pkg.version,
  herettoConnected: false,
  tabCount: 0,
  activeTabId: '',
  theme: 'dark',
  tabs: new Map()
};

// Set up reference for the bridge to update this state
import('./lib/editor-state-bridge').then(bridge => {
  bridge.setEditorStateReference(editorState);
});

export default defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      port: 3000,
      host: 'localhost',
      proxy: herettoState.auth
        ? {
            '/heretto-api': {
              target: 'https://geotab.heretto.com',
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/heretto-api/, '/rest'),
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  if (herettoState.auth) {
                    proxyReq.setHeader('Authorization', herettoState.auth);
                  }
                });
              },
            },
          }
        : undefined,
    },
    plugins: [
      tailwindcss(),
      react(),
      {
        name: 'heretto-debug-middleware',
        configureServer(server) {
          // Debug middleware to log Heretto content requests
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';

            // Log all content requests to /heretto-api/all-files/*/content
            if (url.startsWith('/heretto-api/all-files/') && url.endsWith('/content')) {
              const uuidMatch = url.match(/\/heretto-api\/all-files\/([^\/]+)\/content/);
              const uuid = uuidMatch ? uuidMatch[1] : 'unknown';

              console.log('[DITA Architect] Heretto content request:', {
                uuid,
                url,
                method: req.method,
                headers: {
                  'content-type': req.headers['content-type'],
                  'accept': req.headers.accept,
                },
              });

              // Hook into response to log response details
              const originalEnd = res.end;
              const originalWrite = res.write;
              let responseBody = '';

              res.write = function(chunk: any) {
                if (typeof chunk === 'string') {
                  responseBody += chunk;
                } else if (Buffer.isBuffer(chunk)) {
                  responseBody += chunk.toString('utf8', 0, Math.min(100, chunk.length));
                }
                return (originalWrite as any).apply(this, arguments);
              };

              res.end = function(chunk?: any) {
                if (chunk) {
                  if (typeof chunk === 'string') {
                    responseBody += chunk;
                  } else if (Buffer.isBuffer(chunk)) {
                    responseBody += chunk.toString('utf8', 0, Math.min(100, chunk.length));
                  }
                }

                const contentType = res.getHeader('content-type') as string || '';
                const isBinary = contentType.startsWith('image/') ||
                               contentType.startsWith('application/octet-stream') ||
                               (!contentType.includes('text') && !contentType.includes('xml') && !contentType.includes('json'));

                console.log('[DITA Architect] Heretto content response:', {
                  uuid,
                  status: res.statusCode,
                  contentType,
                  isBinary,
                  isText: !isBinary,
                  responseBodyPreview: isBinary ? '[binary data]' : responseBody.substring(0, 200),
                  contentLength: res.getHeader('content-length'),
                });

                return (originalEnd as any).apply(this, arguments);
              };
            }

            next();
          });
        },
      },
      {
        name: 'heretto-credentials-api',
        configureServer(server) {
          server.middlewares.use('/heretto-credentials', (req, res) => {
            // Only serve to the local dev app; reject requests from other origins.
            const host = req.headers['host'] ?? '';
            if (!host.startsWith('localhost:') && !host.startsWith('127.0.0.1:')) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }
            if (req.method === 'GET') {
              try {
                const raw = JSON.parse(fs.readFileSync(herettoConfigPath, 'utf-8'));
                // Return email + presence flag only; never expose the token over HTTP.
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ email: raw.email || '', hasCredentials: !!(raw.email && raw.token) }));
              } catch {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ email: '', hasCredentials: false }));
              }
            } else if (req.method === 'PUT') {
              let body = '';
              req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const { email, token } = JSON.parse(body);
                  fs.writeFileSync(herettoConfigPath, JSON.stringify({ email, token }, null, 2));
                  // Update the in-memory auth header (mutates object property
                  // so the proxy closure picks up the new value immediately)
                  if (email && token) {
                    herettoState.auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ ok: true }));
                } catch {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
              });
            } else {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Method not allowed. This endpoint only supports GET and PUT requests.' }));
            }
          });
        },
      },
      {
        name: 'load-content-api',
        configureServer(server) {
          server.middlewares.use('/api/load-content', (req, res) => {
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
                  pendingLoads.push({ xml, fileName, herettoTargetUuid });
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
          });

          server.middlewares.use('/api/pending-loads', (req, res) => {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              const loads = [...pendingLoads];
              pendingLoads.length = 0; // Clear the queue
              res.end(JSON.stringify({ success: true, loads }));
            } else {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Method not allowed. This endpoint only supports GET requests.' }));
            }
          });
        },
      },
      {
        name: 'read-only-api',
        configureServer(server) {
          // GET /api/status
          server.middlewares.use('/api/status', (req, res) => {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                version: editorState.version,
                herettoConnected: editorState.herettoConnected,
                tabCount: editorState.tabCount,
                activeTabId: editorState.activeTabId,
                theme: editorState.theme
              }));
            } else {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Method not allowed. This endpoint only supports GET requests.' }));
            }
          });

          // GET /api/tabs/:id/content (more specific route must come first)
          server.middlewares.use((req, res, next) => {
            if (req.method === 'GET' && req.url?.startsWith('/api/tabs/') && req.url.endsWith('/content')) {
              const urlPath = req.url || '';
              const match = urlPath.match(/^\/api\/tabs\/([^\/]+)\/content$/);
              if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid API endpoint format. Expected: /api/tabs/{id}/content' }));
                return;
              }

              const tabId = match[1];
              const tab = editorState.tabs.get(tabId);
              if (!tab) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `Tab with ID "${tabId}" not found` }));
                return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                id: tab.id,
                fileName: tab.fileName,
                herettoFile: tab.herettoFile,
                dirty: tab.dirty,
                xmlErrors: tab.xmlErrors,
                xml: tab.xmlContent
              }));
            } else {
              next();
            }
          });

          // GET /api/tabs (general route comes after specific route)
          server.middlewares.use('/api/tabs', (req, res) => {
            if (req.method === 'GET') {
              const tabs = Array.from(editorState.tabs.values()).map(tab => ({
                id: tab.id,
                fileName: tab.fileName,
                herettoFile: tab.herettoFile,
                dirty: tab.dirty,
                xmlErrorCount: tab.xmlErrorCount
              }));
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                activeTabId: editorState.activeTabId,
                tabs
              }));
            } else {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Method not allowed. This endpoint only supports GET requests.' }));
            }
          });
        },
      },
      {
        name: 'write-api',
        configureServer(server) {
          // PUT /api/tabs/:id/content - Update tab content
          server.middlewares.use((req, res, next) => {
            if (req.method === 'PUT' && req.url?.startsWith('/api/tabs/') && req.url.endsWith('/content')) {
              const urlPath = req.url || '';
              const match = urlPath.match(/^\/api\/tabs\/([^\/]+)\/content$/);
              if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid API endpoint format. Expected: /api/tabs/{id}/content' }));
                return;
              }

              const tabId = match[1];
              const tab = editorState.tabs.get(tabId);
              if (!tab) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `Tab with ID "${tabId}" not found` }));
                return;
              }

              let body = '';
              req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
              req.on('end', async () => {
                try {
                  const { xml } = JSON.parse(body);
                  if (typeof xml !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'xml field is required and must be a string' }));
                    return;
                  }

                  // XML validation (server-side)
                  try {
                    validateXmlStructure(xml);
                  } catch (parseError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      error: 'Invalid XML format',
                      details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
                    }));
                    return;
                  }

                  // Import and call the bridge function
                  const bridge = await import('./lib/editor-state-bridge');
                  const success = bridge.updateTabContent(tabId, xml);

                  if (!success) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update tab content' }));
                    return;
                  }

                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, tabId }));
                } catch (parseError) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
                }
              });
            } else {
              next();
            }
          });

          // POST /api/tabs/:id/save - Trigger tab save to Heretto
          server.middlewares.use((req, res, next) => {
            if (req.method === 'POST' && req.url?.startsWith('/api/tabs/') && req.url.endsWith('/save')) {
              const urlPath = req.url || '';
              const match = urlPath.match(/^\/api\/tabs\/([^\/]+)\/save$/);
              if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid API endpoint format. Expected: /api/tabs/{id}/save' }));
                return;
              }

              const tabId = match[1];
              const tab = editorState.tabs.get(tabId);
              if (!tab) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: `Tab with ID "${tabId}" not found` }));
                return;
              }

              if (!tab.herettoFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Tab has no associated Heretto file to save to' }));
                return;
              }

              // Trigger the save operation
              import('./lib/editor-state-bridge').then(async bridge => {
                try {
                  const result = await bridge.triggerTabSave(tabId);
                  if (result.success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, tabId }));
                  } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      error: 'Save operation failed',
                      details: result.error || 'Unknown error'
                    }));
                  }
                } catch (error) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: 'Internal server error during save',
                    details: error instanceof Error ? error.message : 'Unknown error'
                  }));
                }
              }).catch(error => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: 'Failed to load save handler',
                  details: error instanceof Error ? error.message : 'Unknown error'
                }));
              });
            } else {
              next();
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});
