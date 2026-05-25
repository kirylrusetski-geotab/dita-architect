# DITA Architect — macOS App

A native macOS wrapper for the DITA Architect web app. It hosts the Vite-built frontend inside a `WKWebView`, adds a local HTTP API on port 3001 for external tool access (Claude Code skills, curl), and proxies Heretto CMS requests natively so no browser CORS restrictions apply.

## Requirements

- macOS 13 (Ventura) or later
- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 18 or later (for the Vite build step)

## Building

Run the build script from the repo root:

```bash
bash macos/build.sh
```

This does three things in sequence:

1. **Builds the web app** — runs `npm run build`, which produces `dist/` via Vite.
2. **Compiles the Swift shell** — invokes `swiftc` targeting `arm64-apple-macosx13.0`.
3. **Assembles the `.app` bundle** — creates `DITA Architect.app` at the repo root with the correct `Contents/` layout.

The resulting `DITA Architect.app` is a self-contained bundle. Double-click it to launch — no Node.js required at runtime.

## Architecture

```
AppDelegate
 └─ starts HttpServer (port 3001)
 └─ creates WKWebView via WebViewController
     └─ registers DITASchemeHandler for the dita:// URL scheme
     └─ loads dita://localhost/

DITASchemeHandler          — serves all requests the web app makes
 ├─ /                      → dist/index.html  (static files from bundle)
 ├─ /heretto-api/*         → proxied to https://geotab.heretto.com/rest/*
 │                           with Basic auth injected from ~/heretto.json
 ├─ /heretto-credentials   → reads/writes ~/heretto.json
 └─ /api/*                 → 404 (handled by HttpServer instead)

HttpServer (localhost:3001) — external HTTP API for tools and automation
 ├─ GET  /api/status
 ├─ GET  /api/tabs
 ├─ GET  /api/tabs/:id/content
 ├─ PUT  /api/tabs/:id/content   { "xml": "..." }
 ├─ POST /api/tabs/:id/save
 └─ POST /api/load-content       { "xml": "...", "fileName": "..." }

JSBridge — dispatches JS calls from Swift to the WKWebView on the main thread
 └─ uses callAsyncJavaScript, which awaits Promises automatically
```

### Custom URL scheme

The web app loads under the `dita://` scheme rather than `file://` or `http://`. This gives the `WKWebView` a stable, predictable origin that avoids `file://` same-origin restrictions while keeping everything local. `DITASchemeHandler` intercepts every request and either serves a file from `dist/`, proxies it to Heretto, or handles it as a credential read/write.

### Heretto proxy

All requests the web app makes to `/heretto-api/*` are transparently forwarded to `https://geotab.heretto.com/rest/*` with Basic auth injected from `~/heretto.json`. Credentials are reloaded from disk on every request, so changes made through the in-app Settings panel take effect immediately without a restart.

### External HTTP API

The `HttpServer` on port 3001 exposes the editor's state to external tools. Calls are bridged to JavaScript via `JSBridge` — the same `window.__ditaApi` object the web app exposes internally. All endpoints respond with JSON.

Example — read the XML from the active tab:

```bash
curl http://localhost:3001/api/tabs
# → [{"id":"tab-1","title":"my-topic.dita","dirty":false}, ...]

curl http://localhost:3001/api/tabs/tab-1/content
# → {"xml":"<?xml version=\"1.0\"..."}
```

Example — push new XML into a tab and save to Heretto:

```bash
curl -X PUT http://localhost:3001/api/tabs/tab-1/content \
  -H 'Content-Type: application/json' \
  -d '{"xml":"<?xml version=\"1.0\"?><task>...</task>"}'

curl -X POST http://localhost:3001/api/tabs/tab-1/save
```

The API is localhost-only and has no authentication. It is intended for use by automation running on the same machine (Claude Code skills, shell scripts).

## Source Files

| File | Purpose |
|------|---------|
| `main.swift` | Entry point — creates `NSApplication` and sets the delegate |
| `AppDelegate.swift` | App lifecycle, menu bar setup, window creation, server startup |
| `WebViewController.swift` | Creates the `WKWebView` with the `dita://` scheme handler registered |
| `DITASchemeHandler.swift` | Serves static files, proxies Heretto, handles credential reads/writes |
| `JSBridge.swift` | Thread-safe bridge from Swift to JavaScript inside the `WKWebView` |
| `HttpServer.swift` | Minimal HTTP/1.1 server (NWListener) exposing the editor API on port 3001 |
| `Info.plist` | Bundle metadata (identifier, version, icon filename) |
| `build.sh` | One-command build script (web + Swift + bundle assembly) |

## Rebuilding After Web App Changes

The app bundle embeds a snapshot of `dist/`. After changing the web app source, rebuild the whole bundle:

```bash
bash macos/build.sh
```

Or rebuild just the web layer and copy it in:

```bash
npm run build:app
```

`build:app` (defined in `package.json`) runs `vite build`, removes the old `dist/` from the existing bundle, and copies the new one in — without recompiling the Swift binary.

## Heretto Credentials

Credentials are read from `~/heretto.json`:

```json
{
  "email": "your.name@geotab.com",
  "token": "your-heretto-api-token"
}
```

The file is created automatically when you enter credentials through the app's Settings panel. You can also create or edit it manually. Credentials are reloaded on every Heretto request — no restart needed after updating the file.
