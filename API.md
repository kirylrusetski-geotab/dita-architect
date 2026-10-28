# DITA Architect API

DITA Architect exposes an HTTP API that lets external tools — including Claude Code skills — read editor state, push content into open tabs, trigger saves to Heretto, and load new topics into the editor.

All endpoints return JSON. No authentication is required.

## Ports

| Mode | Port | Notes |
|---|---|---|
| **Native app** (`DITA Architect.app`) | `3001` | Built-in HTTP server; no terminal needed |
| **Vite dev server** (`npm run dev`) | `3000` | Vite middleware; requires a running terminal |

**The tab API is native-only (port 3001).** `GET /api/status`, `GET /api/tabs`, `GET`/`PUT /api/tabs/:id/content`, `POST /api/tabs/:id/save`, and `POST /api/tabs/:id/insert-section` require the native app — they read and write the live editor state through the Swift↔JS bridge. The dev server (port 3000) cannot reach editor state (the browser and the Vite Node process are separate realms with no transport between them — see ADR-007), so it exposes **only** the external-load endpoints:

| Endpoint | Port 3001 (native) | Port 3000 (dev server) |
|---|---|---|
| `GET /api/status`, `GET /api/tabs`, `.../content`, `.../save`, `.../insert-section` | ✅ | ❌ not served |
| `POST /api/load-content`, `GET /api/pending-loads` | ✅ | ✅ |

`POST /api/load-content` behaves differently per mode: in the native app it opens tabs immediately via the JS bridge; in the dev server it queues the content for the editor to pick up on its next poll cycle. `GET /api/pending-loads` exists on both ports but always returns an empty queue on port 3001 — the native app never uses the queue mechanism.

---

## Quick check: Is the editor running?

```bash
# Native app (full API)
curl -s http://localhost:3001/api/status
```

If you get a JSON response, the editor is up. If the connection is refused, it's not running. (The dev server on port 3000 does not serve `/api/status` — check it with `GET /api/pending-loads` instead.)

---

## Endpoints

### GET /api/status

**Native app only (port 3001).** Returns the editor's current state at a glance — what version it's running, whether Heretto CMS is connected, how many tabs are open, and which theme is active.

**Request:**
```bash
curl -s http://localhost:3001/api/status | jq
```

**Response:**
```json
{
  "version": "0.8.1",
  "herettoConnected": true,
  "tabCount": 2,
  "activeTabId": "tab-1710612345678",
  "theme": "dark"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | DITA Architect version (from package.json) |
| `herettoConnected` | boolean | Whether the editor has valid Heretto CMS credentials configured |
| `tabCount` | number | How many tabs are currently open |
| `activeTabId` | string | The ID of the tab the author is currently looking at |
| `theme` | string | The active app theme (`dark`, `light`, `claude`, `nord`, `solarized`, `navy`). `navy` was called `geotab` before v0.9.7. |

**When to use this:** Before doing anything else — confirm the editor is alive and check if Heretto is connected.

---

### GET /api/tabs

**Native app only (port 3001).** Lists all open tabs with summary metadata. Does not include the actual XML content (use `/api/tabs/:id/content` for that).

**Request:**
```bash
curl -s http://localhost:3001/api/tabs | jq
```

**Response:**
```json
{
  "activeTabId": "tab-1710612345678",
  "tabs": [
    {
      "id": "tab-1710612345678",
      "fileName": "Setting_up_a_Traffic_Analysis.dita",
      "herettoFile": {
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "Setting_up_a_Traffic_Analysis.dita",
        "path": "Altitude_Copy/User_Guide/Traffic_Analytics"
      },
      "dirty": false,
      "xmlErrorCount": 0
    },
    {
      "id": "tab-1710612399999",
      "fileName": "Untitled.dita",
      "herettoFile": null,
      "dirty": true,
      "xmlErrorCount": 2
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `activeTabId` | string | Which tab is currently in focus |
| `tabs[].id` | string | Unique tab identifier — use this with `/api/tabs/:id/content` |
| `tabs[].fileName` | string or null | The file name (from Heretto or local file system) |
| `tabs[].herettoFile` | object or null | If the topic was opened from Heretto, includes `uuid`, `name`, and `path`. Null for local files or new topics. |
| `tabs[].dirty` | boolean | Whether the tab has unsaved changes |
| `tabs[].xmlErrorCount` | number | Number of XML validation errors in this tab |

**When to use this:** To find out what the author has open, pick a tab to read, or check if there are unsaved changes before triggering an action.

---

### GET /api/tabs/:id/content

**Native app only (port 3001).** Returns the full DITA XML content of a specific tab, along with any validation errors.

**Request:**
```bash
# Get the tab ID from /api/tabs first, then:
curl -s http://localhost:3001/api/tabs/tab-1710612345678/content | jq
```

**Response:**
```json
{
  "id": "tab-1710612345678",
  "fileName": "Setting_up_a_Traffic_Analysis.dita",
  "herettoFile": {
    "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Setting_up_a_Traffic_Analysis.dita",
    "path": "Altitude_Copy/User_Guide/Traffic_Analytics"
  },
  "dirty": false,
  "xmlErrors": [
    {
      "line": 42,
      "column": 15,
      "message": "Element 'invalid-tag' is not valid in this context",
      "severity": "error"
    }
  ],
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE task PUBLIC \"-//OASIS//DTD DITA Task//EN\" \"task.dtd\">\n<task id=\"setting-up-traffic-analysis\">..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Tab identifier |
| `fileName` | string or null | File name |
| `herettoFile` | object or null | Heretto CMS metadata (uuid, name, path) |
| `dirty` | boolean | Whether there are unsaved changes |
| `xmlErrors` | array | List of XML validation issues, each with `line`, `column`, `message`, and `severity` (`"error"` or `"warning"`) |
| `xml` | string | The complete DITA XML content of the topic |

**When to use this:** To read the actual content of a topic — for analysis, transformation, or feeding into another tool.

---

### PUT /api/tabs/:id/content

**Native app only (port 3001).** Proposes a whole-document replacement for an open tab. The server validates the XML, then **stages a pending review** — it does not apply the content immediately. The XML pane swaps to a read-only Monaco diff (red/green) with an Accept/Reject bar. Accept commits the proposed document byte-for-byte; Reject discards it. The tab's XML is not changed until the author accepts. (ADR-008, v0.9.3)

**Request:**
```bash
curl -s -X PUT http://localhost:3001/api/tabs/tab-1710612345678/content \
  -H "Content-Type: application/json" \
  -d '{"xml": "<task id=\"my-task\"><title>Updated Title</title><taskbody/></task>"}'
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `xml` | string | Yes | The full DITA XML to propose for the tab |

**Response (200) — review staged:**
```json
{ "success": true, "httpStatus": 200, "tabId": "tab-1710612345678", "status": "pending-review" }
```

**Response (200) — no change (incoming XML identical to current content):**
```json
{ "success": true, "httpStatus": 200, "tabId": "tab-1710612345678", "status": "no-change" }
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `xml` field missing or not a string |
| 400 | XML fails structural validation — `details` field contains the parse error |
| 400 | Tab already has a pending review — accept or reject it first |
| 404 | Tab ID not found |

**When to use this:** To deliver AI-generated or revised XML to an open tab for the author to review before it becomes the document. Works in any `documentMode` — the review surface is always presented. After the author accepts, call `POST /api/tabs/:id/save` to persist to Heretto.

> **Breaking change from v0.9.2 and earlier:** PUT used to apply immediately (`xmlContent` replaced, `syncTrigger` bumped). Callers that PUT and then immediately save will now receive a 400 from `save` until the author accepts the review. See `POST /api/tabs/:id/save` below.

---

### POST /api/tabs/:id/save

**Native app only (port 3001).** Triggers a save of the tab's current content to Heretto CMS. The tab must have an associated Heretto file (i.e., it was opened from Heretto, not a local new file).

**Request:**
```bash
curl -s -X POST http://localhost:3001/api/tabs/tab-1710612345678/save
```

**Response (200):**
```json
{ "success": true, "httpStatus": 200, "tabId": "tab-1710612345678" }
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Tab has no associated Heretto file |
| 400 | Tab has a pending review — accept or reject it before saving |
| 400 | The document violates the DITA 1.3 content model (e.g. `<fig>` inside `<cmd>`) — `details` is an array of `{ element, parent, line, column }`, one per violation (FR-067 / ADR-014). Checked before Heretto ever sees the document; `handleHerettoSave` is not called. |
| 400 | The save to Heretto itself failed (the PUT, or verifying it afterward) — `error` names the reason; no `details` field |
| 404 | Tab ID not found |

**When to use this:** After the author accepts a proposal (from `PUT` or `insert-section`) and the content is live in the tab, call this to persist to Heretto. Do not call immediately after `PUT` — since v0.9.3, `PUT` stages a review rather than applying, so save will be refused until the author accepts.

**Example — content-model violation:**
```json
{
  "success": false,
  "httpStatus": 400,
  "error": "1 structural problem blocks this save: <fig> is not a valid child of <cmd> (line 7). Open the error list in the editor for details.",
  "details": [{ "element": "fig", "parent": "cmd", "line": 7, "column": 23 }]
}
```

---

### POST /api/tabs/:id/insert-section

**Native app only (port 3001).** Stages a block-level XML fragment as a **pending review** on an open tab. The proposed document is computed deterministically at the XML level (`currentXml → proposedXml`) and the XML pane swaps to a read-only Monaco diff (red/green) with an Accept/Reject bar. Accept commits the reviewed text byte-for-byte; Reject discards it. No content changes until the author accepts. Designed for AI tools and skills that want to propose content without rewriting the whole document.

**Accepted fragment shapes** (one or more, in any order):

- Block-level body elements: `<p>`, `<ul>`, `<ol>`, `<note>`, `<codeblock>`, `<table>`, `<simpletable>`, `<fig>`, `<image>`, `<dl>`, `<example>`, `<prereq>`, `<context>`, `<result>`, `<postreq>`, `<steps>`
- `<section>` — its children are unwrapped into a flat sequence of body-level nodes

**Request:**
```bash
curl -s -X POST http://localhost:3001/api/tabs/tab-1710612345678/insert-section \
  -H "Content-Type: application/json" \
  -d '{ "xml": "<p>A new paragraph to append.</p>" }'
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `xml` | string | Yes | One or more block-level XML elements |
| `replaceId` | string | No | If set, the matching DITA element (by `id` attribute) is replaced by the fragment in the proposed document rather than appended. If no element with that id exists, the request **fails** (it does not fall back to appending). |

**Response (200):**
```json
{ "success": true, "httpStatus": 200, "status": "pending-review" }
```

Success is returned only after the fragment is validated and the proposed document passes DITA validation — there is no deferred failure. If the author edits the document while a review is pending, Accept is refused (the proposal was computed against a base that no longer exists) and the review is cleared.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `xml` missing, fragment fails validation, `replaceId` not found, or tab already has a pending review |
| 404 | Tab ID not found |

**When to use this:** When an external tool wants to suggest a new paragraph, list, note, or section in an open tab and have the author review it as a precise XML diff before it lands.

---

### POST /api/load-content

Opens a DITA topic in the editor as a new tab. Optionally targets an existing Heretto file to replace.

**Native app (port 3001):** The tab opens immediately — `JSBridge` calls `window.__ditaApi.loadContent()` directly and the editor responds in the same request cycle. No polling involved.

**Dev server (port 3000):** The content is queued. The editor polls `GET /api/pending-loads` on an interval and opens queued items on each cycle.

**Request:**
```bash
curl -s -X POST http://localhost:3000/api/load-content \
  -H "Content-Type: application/json" \
  -d '{
    "xml": "<task id=\"new-task\"><title>New Task</title><taskbody/></task>",
    "fileName": "New_Task.dita",
    "herettoTargetUuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `xml` | string | Yes | The DITA XML content to open |
| `fileName` | string | Yes | The file name to display on the tab |
| `herettoTargetUuid` | string | No | If set, associates the new tab with this Heretto file UUID |

**Response (200):**
```json
{ "success": true, "status": "loaded" }
```

On port 3001 (native app), the tab is already open when this response is returned. On port 3000 (dev server), the editor will open it on its next poll cycle.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `xml` or `fileName` missing |
| 400 | Request body is not valid JSON |

**When to use this:** To open a freshly generated or fetched topic in the editor without the author having to navigate to it manually.

---

### GET /api/pending-loads

Returns all queued content loads and clears the queue atomically. The editor calls this on a poll interval to pick up new tabs. **This endpoint always returns an empty queue on port 3001 (native app)** — the native app never uses the queue mechanism; tabs open immediately via the JS bridge.

**Request:**
```bash
curl -s http://localhost:3000/api/pending-loads | jq
```

**Response:**
```json
{
  "success": true,
  "loads": [
    {
      "xml": "<task id=\"new-task\"><title>New Task</title><taskbody/></task>",
      "fileName": "New_Task.dita",
      "herettoTargetUuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
  ]
}
```

Returns an empty `loads` array if nothing is queued. The queue is cleared on every read — a second call immediately after will return `[]`.

**When to use this:** You generally don't call this directly — the editor polls it automatically. It's useful for debugging whether a `POST /api/load-content` call was received.

---

## Common patterns for Claude Code skills

The examples below use port `3001` (native app). They rely on the tab API, which is **native-only** — they do not work against the dev server on port 3000 (see the Ports table above).

### Check if the editor is available

```bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/status)
if [ "$STATUS" = "200" ]; then
  echo "Editor is running"
else
  echo "Editor is not running"
fi
```

### Get the active tab's content

```bash
# Step 1: Get the active tab ID
ACTIVE_TAB=$(curl -s http://localhost:3001/api/tabs | jq -r '.activeTabId')

# Step 2: Fetch its XML content
curl -s "http://localhost:3001/api/tabs/${ACTIVE_TAB}/content" | jq -r '.xml'
```

### List all dirty (unsaved) tabs

```bash
curl -s http://localhost:3001/api/tabs | jq '.tabs[] | select(.dirty == true) | .fileName'
```

### Check for XML errors across all tabs

```bash
curl -s http://localhost:3001/api/tabs | jq '.tabs[] | select(.xmlErrorCount > 0) | {fileName, xmlErrorCount}'
```

### Propose updated XML for the author to review, then save after acceptance

Since v0.9.3, `PUT` stages a review rather than applying immediately. The author must accept the
diff in the app before the content is live — only then can you save to Heretto.

```bash
ACTIVE_TAB=$(curl -s http://localhost:3001/api/tabs | jq -r '.activeTabId')

# Stage a whole-document proposal — the author sees a red/green diff with Accept/Reject
curl -s -X PUT "http://localhost:3001/api/tabs/${ACTIVE_TAB}/content" \
  -H "Content-Type: application/json" \
  -d "{\"xml\": \"$(cat updated.dita | sed 's/"/\\"/g')\"}"
# → { "success": true, "status": "pending-review" }

# After the author clicks Accept in the app, save to Heretto:
curl -s -X POST "http://localhost:3001/api/tabs/${ACTIVE_TAB}/save"
# → { "success": true } — or 400 if the review is still pending
```

### Load a new topic into the editor

```bash
curl -s -X POST http://localhost:3001/api/load-content \
  -H "Content-Type: application/json" \
  -d '{
    "xml": "<concept id=\"intro\"><title>Introduction</title><conbody/></concept>",
    "fileName": "Introduction.dita"
  }'
```

---

## Response envelope and error responses

Every tab-API response (port 3001) is a JSON object with two fixed fields:

| Field | Type | Meaning |
|-------|------|---------|
| `success` | boolean | `true` on success, `false` on any error |
| `httpStatus` | number | The HTTP status code of this response, repeated in the body |

`httpStatus` exists because the editor logic runs in JavaScript and the HTTP server runs in Swift: the JS bridge decides the outcome and encodes the status in its JSON, and the Swift server reads that field to set the real HTTP status line (`HttpServer.swift` `statusCode(from:)`). The two always match, so clients can use either. Responses that carry other fields (`tabId`, `status`, `xml`, …) include them alongside these two.

```json
{ "success": true,  "httpStatus": 200, "tabId": "tab-1710612345678", "status": "pending-review" }
{ "success": false, "httpStatus": 404, "error": "Tab with ID \"tab-x\" not found" }
{ "success": false, "httpStatus": 400, "error": "Invalid XML format", "details": "Invalid XML: unclosed tag <task>" }
```

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request — missing fields, invalid JSON, XML validation failure, a pending review blocking the action, or a tab with no Heretto file |
| 404 | Tab ID not found, or invalid endpoint path |
| 405 | Wrong HTTP method for this endpoint |
| 413 | Request body over 10 MB |
| 500 | Server-side error during save or content update |

Error responses always have `success: false`, an `error` string, and sometimes a `details` field with more context. The port-3000 dev-server endpoints (`/api/load-content`, `/api/pending-loads`) return `success` but **not** `httpStatus`; they are served by Vite middleware, not the bridge.

The native server also closes any connection that has not delivered a complete request within 30 seconds.

---

## Notes

- Read endpoints (`GET`) reflect live editor state and update as the author opens, edits, and closes tabs.
- The `xml` field in `GET /api/tabs/:id/content` returns the raw XML exactly as it appears in the Monaco editor, including any unsaved edits.
- If a tab was opened from Heretto, `herettoFile.uuid` can be used to cross-reference with the Heretto CMS REST API.
- `PUT /api/tabs/:id/content` runs a structural XML validation before applying the update. It catches tag mismatches and unclosed tags but does not validate against the DITA DTD.
- `POST /api/tabs/:id/save` requires the tab to have a `herettoFile` — tabs that were created locally or via `POST /api/load-content` without a `herettoTargetUuid` cannot be saved through this endpoint.
- On port 3000 (dev server), the `POST /api/load-content` → `GET /api/pending-loads` queue is cleared atomically on each read to prevent duplicate opens. On port 3001 (native app) the queue is never used — `POST /api/load-content` opens tabs immediately.
