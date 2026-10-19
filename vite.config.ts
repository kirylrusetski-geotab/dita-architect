import path from 'path';
import fs from 'fs';
import os from 'os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Read Heretto credentials (server-side only, never exposed to browser).
// Wrapped in an object so the proxy closure always reads the latest value
// after credential updates via the PUT endpoint.
//
// `host` is the Heretto instance hostname (e.g. "yourcompany.heretto.com").
// DITA Architect works with any Heretto CMS instance; nothing is hardcoded.
// Note: Vite fixes the proxy target at startup, so a host change via the
// Settings panel takes effect after the dev server is restarted.
const herettoState: { auth: string | null; host: string | null } = { auth: null, host: null };

/** Strip scheme and trailing slashes so "https://x.heretto.com/" → "x.heretto.com". */
const normalizeHerettoHost = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const host = value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return host.length > 0 ? host : null;
};

try {
  const configPath = path.join(os.homedir(), 'heretto.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  herettoState.host = normalizeHerettoHost(raw.host);
  if (raw.email && raw.token) {
    herettoState.auth = 'Basic ' + Buffer.from(`${raw.email}:${raw.token}`).toString('base64');
  }
  if (!herettoState.host) {
    console.warn('[DITA Architect] ~/heretto.json has no "host" — Heretto proxy disabled until one is set');
  }
} catch {
  console.warn('[DITA Architect] ~/heretto.json not found or invalid — Heretto proxy disabled');
}

const herettoConfigPath = path.join(os.homedir(), 'heretto.json');

// Module-level queue for pending external content loads
interface PendingLoad {
  xml: string;
  fileName: string;
  herettoTargetUuid?: string;
}
const pendingLoads: PendingLoad[] = [];

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      port: 3000,
      host: 'localhost',
      proxy: herettoState.auth && herettoState.host
        ? {
            '/heretto-api': {
              target: `https://${herettoState.host}`,
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
                // Return host + email + presence flag only; never expose the token over HTTP.
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  host: normalizeHerettoHost(raw.host) ?? '',
                  rootUuid: typeof raw.rootUuid === 'string' ? raw.rootUuid.trim() : '',
                  email: raw.email || '',
                  hasCredentials: !!(raw.email && raw.token),
                }));
              } catch {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ host: '', rootUuid: '', email: '', hasCredentials: false }));
              }
            } else if (req.method === 'PUT') {
              let body = '';
              req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const { host, rootUuid, email, token } = JSON.parse(body);
                  // A PUT without a host / rootUuid keeps whatever is already on disk,
                  // so older callers that send only { email, token } don't wipe them.
                  let existingHost: string | null = null;
                  let existingRoot = '';
                  try {
                    const existing = JSON.parse(fs.readFileSync(herettoConfigPath, 'utf-8'));
                    existingHost = normalizeHerettoHost(existing.host);
                    existingRoot = typeof existing.rootUuid === 'string' ? existing.rootUuid.trim() : '';
                  } catch { /* no existing file */ }
                  const nextHost = normalizeHerettoHost(host) ?? existingHost;
                  const nextRoot = (typeof rootUuid === 'string' && rootUuid.trim()) ? rootUuid.trim() : existingRoot;
                  fs.writeFileSync(herettoConfigPath, JSON.stringify({ host: nextHost ?? '', rootUuid: nextRoot, email, token }, null, 2));
                  // Update the in-memory auth header (mutates object property
                  // so the proxy closure picks up the new value immediately)
                  if (email && token) {
                    herettoState.auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
                  }
                  if (nextHost !== herettoState.host) {
                    console.warn(`[DITA Architect] Heretto host changed to "${nextHost ?? ''}" — restart the dev server for the proxy to use it`);
                    herettoState.host = nextHost;
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
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});
