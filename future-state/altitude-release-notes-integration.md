# Altitude Release Notes: DITA Architect Integration Plan

**Date:** 2026-03-12
**Reviewers:** Rafael Santos (Engineering), Maya Chen (UX)
**Scope:** DITA Architect changes only. Skill-side changes are out of scope and will be actioned separately by Kiryl.

---

## Context

The `altitude-release-notes` skill currently loads generated DITA XML into DITA Architect by injecting content directly into the Monaco editor via `cli-chrome` browser automation (`monaco.editor.getEditors()[0].setValue(...)`), then firing a synthetic `Ctrl+Enter` to trigger the XML-to-Lexical sync.

**Problems with this approach:**

1. **Fragile** - Coupled to Monaco's internal API and a keyboard shortcut binding. Any refactor to the editor initialization or keybinding breaks this silently.
2. **Bypasses the import pipeline** - No XML validation, no import verification modal, no `formatXml()` beautification. The tab has no `herettoFile` metadata, so there's no save-back, no conflict detection, no dirty tracking.
3. **No Heretto continuity** - The loaded draft is a dead-end local buffer. The user can't commit it to Heretto from the editor. They have to use the separate `headless-heretto.py` script, which is a second uncoordinated write path.
4. **No user feedback** - The skill has no specified status messages during the load, and no confirmation when it's done.

---

## Goals

**A. Improve DITA Architect's role** - Give it a stable, documented API surface that external tools can use to load content into the editor. Replace the brittle cli-chrome injection with a first-class integration point.

**B. Improve the user experience** - Enable a complete workflow within the editor: import a draft, edit it, then replace the existing release notes document in Heretto. No context-switching to external scripts.

---

## Feature 1: Local API Endpoint for External Content Loading

### What

A new HTTP endpoint on the Vite dev server that accepts DITA XML content and opens it as a new tab in the editor.

### Endpoint Design

```
POST /api/load-content
Content-Type: application/json

{
  "xml": "<concept id='release-notes'>...</concept>",
  "fileName": "altitude_release_notes_draft.dita",
  "herettoTargetUuid": "4bb98119-eae7-49e9-b622-760162156f8e"  // optional
}
```

**Response:** `200 OK` with `{ "status": "loaded" }` on success, or `4xx` with `{ "error": "..." }` on failure.

The optional `herettoTargetUuid` field tells the editor: "This content is intended to replace the Heretto document with this UUID." This metadata is stored on the tab and powers the Replace in Heretto feature (Feature 2).

### Server-Side Implementation

A new Vite plugin in `vite.config.ts`, following the same pattern as `heretto-credentials-api`:

```
Plugin: load-content-api
  POST /api/load-content
    1. Parse JSON body (xml, fileName, herettoTargetUuid)
    2. Store in a module-level pending queue (array of pending loads)
    3. Return 200

  GET /api/pending-loads
    1. Return and clear the pending queue
    2. Return [] if empty
```

### Client-Side Implementation

A new hook `useExternalLoad` (or extend `useLocalFile`) that:

1. Polls `GET /api/pending-loads` on a short interval (1-2 seconds) while the app is open
2. For each pending load:
   a. Run `validateDitaXml(xml)` - reject invalid XML with a toast
   b. Run `formatXml(xml)` - beautify
   c. Call `createTab(beautified)`
   d. Set `tab.localFileName = fileName`
   e. If `herettoTargetUuid` is provided, store it as `tab.herettoReplaceTarget = { uuid }` (new field on Tab)
   f. Set as active tab, show toast: `"Loaded {fileName} from external tool"`

### Tab Type Addition

```typescript
// New optional field on the Tab interface
herettoReplaceTarget: {
  uuid: string;
  name?: string;   // populated after first fetch
  path?: string;   // populated after first fetch
} | null;
```

This field means: "The user intends to use this tab's content to replace the Heretto document at this UUID." It is distinct from `herettoFile`, which means "this tab IS that Heretto document."

### Considerations

- **No CORS needed.** The skill runs via cli-chrome/bash on the same machine. Requests come from localhost.
- **No auth needed.** This is a local dev server. The endpoint only accepts connections from localhost.
- **Polling vs SSE vs WebSocket.** Polling is simplest, matches the app's existing patterns (Heretto remote-change polling is also poll-based), and avoids adding WebSocket dependencies. A 1-2 second poll interval is fine for this use case; the user is waiting and watching.
- **Queue, not single slot.** Using an array means multiple loads won't clobber each other, though in practice only one will arrive at a time.

---

## Feature 2: Replace in Heretto

### What

A workflow that lets the user take the content in their current editor tab and use it to replace an existing document in Heretto CMS. This is the key feature that makes DITA Architect a real part of the publish pipeline instead of just a preview tool.

### UX Flow

#### Entry Point 1: Automatic (via API)

When content is loaded via `/api/load-content` with a `herettoTargetUuid`, the editor shows a persistent context bar (similar to the existing Heretto context toolbar) indicating the replace intent:

```
[Heretto H] Replace target: Latest_Release_Notes.dita  [Preview Diff]  [Replace in Heretto]  [Dismiss]
```

#### Entry Point 2: Manual (via menu)

A new item in the Heretto dropdown menu:

```
Heretto
  Open
  Save
  Replace existing...    <-- new
  ─────────────
  Status
```

Selecting "Replace existing..." opens the Heretto Browser Modal in a new `replace` mode, where the user navigates to and selects the target file. This sets `herettoReplaceTarget` on the current tab.

### The Replace Modal

When the user clicks "Replace in Heretto" (either from the context bar or after selecting a target), a new `HerettoReplaceModal` opens with a multi-step flow:

#### Step 1: Confirm Target

```
┌─────────────────────────────────────────────────┐
│  Replace in Heretto                             │
│                                                 │
│  You are about to replace:                      │
│                                                 │
│  📄 Latest_Release_Notes.dita                   │
│     Release_Notes / Latest_Release_Notes.dita   │
│                                                 │
│  with the contents of your current editor tab.  │
│                                                 │
│  This will overwrite the existing file in       │
│  Heretto CMS. This action cannot be undone      │
│  from DITA Architect.                           │
│                                                 │
│            [Cancel]  [Preview Changes]           │
└─────────────────────────────────────────────────┘
```

#### Step 2: Preview Changes

```
┌─────────────────────────────────────────────────┐
│  Replace in Heretto — Preview                   │
│                                                 │
│  ┌─────────────────┬──────────────────────────┐ │
│  │ Current         │ New                      │ │
│  │ (in Heretto)    │ (your editor)            │ │
│  ├─────────────────┼──────────────────────────┤ │
│  │ <section        │ <section                 │ │
│  │   id="portal">  │   id="portal">           │ │
│  │ - <title>...    │ + <title>...             │ │
│  │   ...           │   ...                    │ │
│  └─────────────────┴──────────────────────────┘ │
│                                                 │
│  12 lines added, 8 lines removed                │
│                                                 │
│         [Cancel]  [Back]  [Replace Now]          │
└─────────────────────────────────────────────────┘
```

This step fetches the current content from Heretto (`GET /heretto-api/all-files/{uuid}/content`) and displays a side-by-side diff against the editor's content. This lets the user verify they're replacing the right file with the right content.

#### Step 3: Replace and Verify

```
┌─────────────────────────────────────────────────┐
│  Replace in Heretto                             │
│                                                 │
│  ✓ Uploading content...              done       │
│  ✓ Verifying integrity...            done       │
│                                                 │
│  Successfully replaced                          │
│  Latest_Release_Notes.dita in Heretto.          │
│                                                 │
│                              [Done]              │
└─────────────────────────────────────────────────┘
```

Behind the scenes:
1. `PUT /heretto-api/all-files/{uuid}/content` with the editor's XML
2. `GET /heretto-api/all-files/{uuid}/content` to verify (same pattern as existing `handleHerettoSave`)
3. Compare with `compareXml()` and report result

On success:
- The tab's `herettoReplaceTarget` is cleared
- The tab's `herettoFile` is set to `{ uuid, name, path }` of the replaced file — the tab is now a live Heretto-backed tab with full save/refresh/conflict-detection capabilities
- `savedXmlRef.current` is updated
- Toast: `"Replaced {name} in Heretto"`

On failure:
- Toast with specific error
- Modal stays open with error state and a "Retry" button

### Post-Replace State Transition

This is the key design decision. After a successful replace, the tab transitions from "local draft with a replace target" to "live Heretto document." This means:

- The Heretto context toolbar appears with path breadcrumbs and the green "Saved" indicator
- Remote-change polling begins for this tab
- The "Commit" button works for future edits
- The "Refresh" button pulls the latest from Heretto

The user's mental model is: "I drafted this, I edited it, I replaced the old one, and now I'm working on the live document." No context switch.

---

## Feature 3: Diff Preview Component

### What

A reusable XML diff viewer component for comparing two DITA documents side by side. Used by the Replace Modal (Feature 2) but designed to be reusable for other future comparisons (e.g., conflict resolution, review workflows).

### Implementation Approach

Use Monaco's built-in diff editor (`monaco.editor.createDiffEditor`). This avoids adding a diff library dependency and gives us syntax-highlighted XML diff for free. The component wraps Monaco's diff editor in a React component with:

- Read-only mode (no editing in the diff view)
- Labels for left ("Current in Heretto") and right ("Your editor") panes
- A summary line showing added/removed line counts
- Sized to fit the modal (not full-screen)

---

## Accessibility Improvements (Discovered During Review)

These are existing gaps found during the review that should be addressed alongside the new features, since we'll be touching related components:

| Gap | Location | Fix |
|-----|----------|-----|
| Labels not associated with inputs | `HerettoStatusModal.tsx` | Add `htmlFor`/`id` pairing on email and token fields |
| No `aria-label` on icon buttons | Heretto context toolbar | Add `aria-label` to Refresh and Disconnect buttons |
| No `aria-live` on search progress | `HerettoBrowserModal.tsx` | Add `aria-live="polite"` to the scanning progress region |
| No focus management on modal open | All Heretto modals | Add `autoFocus` to first interactive element |
| No `aria-labelledby` on modals | `ImportVerificationModal.tsx` | Point `aria-labelledby` to the heading element |

---

## Implementation Sequence

### Phase 1: API Endpoint (Feature 1)

Files to create or modify:

| File | Change |
|------|--------|
| `vite.config.ts` | Add `load-content-api` plugin with `POST /api/load-content` and `GET /api/pending-loads` |
| `hooks/useExternalLoad.ts` | New hook: poll `/api/pending-loads`, validate, create tabs |
| `types/tab.ts` | Add `herettoReplaceTarget` field to `Tab` interface and `createTab` |
| `dita-architect.tsx` | Wire up `useExternalLoad` hook |

**Outcome:** The `altitude-release-notes` skill can `POST` to `localhost:3000/api/load-content` instead of using cli-chrome. The draft appears in the editor as a validated, formatted tab.

### Phase 2: Replace in Heretto (Feature 2)

Files to create or modify:

| File | Change |
|------|--------|
| `components/HerettoReplaceModal.tsx` | New: three-step replace wizard (confirm, preview, execute) |
| `components/DiffViewer.tsx` | New: reusable Monaco diff viewer component |
| `components/HerettoReplaceBar.tsx` | New: persistent context bar shown when `herettoReplaceTarget` is set |
| `hooks/useHerettoCms.ts` | Add `handleHerettoReplace` function |
| `dita-architect.tsx` | Add "Replace existing..." to Heretto dropdown, render replace bar and modal |
| `HerettoBrowserModal.tsx` | Support `replace` mode (select target file, not open/save) |

**Outcome:** Full draft-to-publish workflow within the editor. User edits the draft, previews the diff, replaces the live document, and continues working on it as a live Heretto-backed tab.

### Phase 3: Accessibility Fixes

Files to modify:

| File | Change |
|------|--------|
| `components/HerettoStatusModal.tsx` | Label association, focus management |
| `components/HerettoBrowserModal.tsx` | `aria-live` on search progress, search input `aria-label` |
| `components/ImportVerificationModal.tsx` | `aria-labelledby` |
| `dita-architect.tsx` | `aria-label` on context toolbar icon buttons |

**Outcome:** Screen reader users can navigate all Heretto-related UI.

---

## What This Enables for the Skill

Once Phases 1 and 2 are implemented, the release notes skill workflow simplifies to:

1. Gather data (GitLab + Jira + Heretto) — unchanged
2. Draft DITA XML — unchanged
3. Present draft to user for review — unchanged
4. **`POST /api/load-content` with `herettoTargetUuid` set to `Latest_Release_Notes.dita`'s UUID** — replaces the entire cli-chrome injection sequence (preflight, tab find, eval, keypress dispatch, observe)
5. User edits in DITA Architect with full editor capabilities
6. **User clicks "Replace in Heretto"** — replaces the `headless-heretto.py update` call for the main file
7. Archiving history files — still uses `headless-heretto.py` (out of scope for this plan)
8. TECHWRSD ticket — unchanged

The cli-chrome dependency is eliminated from the content-loading step. The `headless-heretto.py` dependency is eliminated for the main release notes file (it remains for per-module history file updates, which is a separate workflow).

---

## Open Questions

1. **Diff granularity.** Monaco's built-in diff is line-based. For DITA XML, a semantic diff (element-level) might be more useful. Is Monaco's line diff sufficient for the replace preview, or should we invest in an XML-aware diff? Recommendation: start with Monaco's line diff and evaluate.

2. **Multi-file replace.** The current plan supports replacing one file at a time. The archiving step in the skill updates multiple history files. Should we support batch replace via the API? Recommendation: defer. History file updates are structurally different (appending rows to tables) and are better handled by `headless-heretto.py` for now.

3. **Undo in Heretto.** The replace modal warns that the action "cannot be undone from DITA Architect." Heretto itself may have version history. Should we surface that? Recommendation: add a note in the confirmation step — `"You can restore previous versions from Heretto's version history if needed."` — and leave it at that.
