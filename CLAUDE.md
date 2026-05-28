# DITA Architect — Project Instructions

## What This Is

A lightweight DITA editor (React + TypeScript + Vite + Lexical + Monaco) built by Kiryl Rusetski. Visual editor on the left, XML pane on the right, syncs between both. Integrates with Heretto CMS (geotab.heretto.com) for browsing, opening, saving, and replacing topics.

**Current version:** 0.8.1 (2026-05-28)

---

## Two Run Modes

| Mode | How to start | Port | Notes |
|---|---|---|---|
| **Native macOS app** | Open `DITA Architect.app` inside the dev source root | 3001 | Swift WKWebView shell; no terminal needed |
| **Vite dev server** | `npm run dev` | 3000 | Requires a running terminal |

The native app serves the built `dist/` via a custom `dita://` URL scheme. Built with `macos/build.sh` (bare `swiftc`, no SPM). Source at `macos/Sources/DITAArchitect/`.

Use port **3001** when running the native app, **3000** for dev server.

---

## Architecture

- **Parser:** `sync/parseXmlToLexical.ts` — DITA XML → Lexical node tree; stamps `originMap` with DITA element identity for every node
- **Serializer:** `sync/serializeLexicalToXml.ts` — Lexical node tree → DITA XML; uses `originMap` to reconstruct inline DITA elements correctly
- **Sync bridge:** `components/SyncManager.tsx` — coordinates bidirectional sync between Lexical and Monaco; update sources: `'visual'`, `'xml'`, `'api'`
- **Heretto integration:** `hooks/useHerettoCms.ts` — all CMS operations (browse, open, save, replace, connection check)
- **External load:** `hooks/useExternalLoad.ts` — polls `/api/pending-loads` in Vite mode; native mode uses JS bridge directly
- **State bridge (Vite):** `lib/editor-state-bridge.ts` — syncs React state to Vite middleware for API endpoints
- **Native API bridge:** `lib/native-api-bridge.ts` — registers `window.__ditaApi` on `dita:` protocol; Swift calls these via `callAsyncJavaScript`
- **Swift HTTP server:** `macos/Sources/DITAArchitect/HttpServer.swift` — `NWListener` on port 3001, routes to JS bridge
- **JS bridge:** `macos/Sources/DITAArchitect/JSBridge.swift` — routes Swift → JS via `callAsyncJavaScript`

---

## Key Files

| File | Purpose |
|---|---|
| `dita-architect.tsx` | Main component; `window.__ditaApi` registration ~line 354–395 |
| `constants/version.ts` | Version string + all release notes array |
| `constants/keyboard-shortcuts.ts` | Single-source shortcut registry (drives cheat sheet modal) |
| `types/tab.ts` | `Tab` interface — all per-tab state |
| `vite.config.ts` | All Vite `/api/*` middleware endpoints |
| `future-state/BACKLOG.md` | Prioritized backlog — read before starting any session |
| `future-state/feature-requests.md` | Feature request detail and FR status |
| `PROJECT_LOG.md` | Per-session implementation log |
| `API.md` | Full HTTP API reference |
| `bugreports/` | One file per filed bug; shipped bugs noted in backlog Completed |
| `future-state/acquired-products/` | Historical builds (dita-doer-v1, dita-doer-v3) — kept intentionally for reference; not imported by the current app |
| `textAnalysis.ts` | Flesch-Kincaid readability engine — powers the status bar score in `BottomToolbar.tsx`; also earmarked for the pending `GET /api/tabs/:id/stats` endpoint (FR) |
| `agents/run.ts` | Multi-agent pipeline entry point |
| `agents/orchestrator.ts` | Pipeline coordinator — runs all 9 steps, manages retries and checkpoints |
| `agents/shared/types.ts` | Shared types, team roster, `STAKEHOLDER_MESSAGE`, `COMPANY_CULTURE` |
| `agents/shared/file-comm.ts` | File-based inter-agent communication (reports, checkpoints, health) |
| `agents/shared/codebase-context.ts` | Generates a codebase snapshot injected into every agent prompt |
| `agents/agents/` | One file per agent persona |

---

## Multi-Agent Pipeline

A 9-step pipeline built on the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). Run it for large or cross-file tasks that benefit from plan → implement → review → verify sequencing.

### How to invoke

```bash
npx tsx agents/run.ts "Your development request"
```

The pipeline creates a `pipeline/<timestamp>` git branch before implementation so changes are isolated and diffable. It resumes from the last checkpoint if interrupted.

### Pipeline steps

| Step | Agent | Role | Gate |
|---|---|---|---|
| 1 | **Rafael Santos** (Eng Manager) | Kickoff brief — scopes the request, identifies risks | — |
| 2 | **Anna Sidorova** (Staff Engineer) | Architecture plan — files to change, approach, invariants | — |
| 3 | Code Discovery | Reads targeted files before implementation | — |
| 4 | **Jamie Okafor** (Senior Frontend) | Implementation | Retried if step 5, 7, or 8 fails |
| 5 | **Elena Vasquez** (Principal Engineer) | Code review — emits PASS/FAIL verdict | Hard gate; triggers Jamie retry on FAIL |
| 6 | **Maya Chen** (UX Engineer) | UX review — advisory only | Non-blocking |
| 7 | **Marcus Wren** (DevOps) | Build verification (`npm run build`) | Hard gate; triggers Jamie retry on BUILD FAIL |
| 8 | **Taylor Brooks** (QA Lead) | Test run — emits ALL PASS/FAILURES verdict | Hard gate; triggers Jamie retry on FAILURES |
| 9 | **Rafael Santos** | Wrapup — summary + appends to `PROJECT_LOG.md` | — |

Each step writes its output to a report file in `agents/shared/` via `file-comm.ts`. The orchestrator reads these reports to feed context forward.

### Engineering culture (baked into every agent prompt)

- WYSIWYG/DITA parity is the top acceptance criterion for every feature
- Writer experience wins over developer convenience
- TypeScript strict — no `any`, no unused variables, zero warnings
- Kiryl is the only maintainer — write code he can read and maintain alone
- Prefer editing existing files; follow existing patterns

### When to use the pipeline vs. working directly

Use the pipeline for:
- Features that touch 3+ files
- Anything with Swift + TypeScript simultaneously
- Tasks tagged **Multi-agent** in the backlog

Work directly for:
- Haiku/Sonnet-weight bugs (one or two files, contained fix)
- Version bumps and release note updates
- Backlog/FR file updates

---

## HTTP API

All endpoints return JSON. No authentication required.

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | Version, Heretto connection status, tab count, active tab ID, theme |
| `/api/tabs` | GET | All open tabs with metadata (id, fileName, herettoFile, dirty, xmlErrorCount) |
| `/api/tabs/:id/content` | GET | Full DITA XML + validation errors for a tab |
| `/api/tabs/:id/content` | PUT | Replace tab XML (validates structure before applying; 400 on malformed XML) |
| `/api/tabs/:id/save` | POST | Save tab to Heretto CMS (tab must have `herettoFile`) |
| `/api/tabs/:id/insert-section` | POST | Inject block-level fragment as green tracked addition; author Accepts or Rejects. Body: `{ xml, replaceId? }`. Native app only (port 3001). |
| `/api/load-content` | POST | Open DITA XML as a new tab. Body: `{ xml, fileName, herettoTargetUuid? }`. Native: immediate; Dev: queued. |
| `/api/pending-loads` | GET | Returns queued loads and clears queue atomically. Always empty on port 3001. |

### `insert-section` accepted block elements

`<p>`, `<ul>`, `<ol>`, `<note>`, `<codeblock>`, `<table>`, `<simpletable>`, `<fig>`, `<image>`, `<dl>`, `<example>`, `<prereq>`, `<context>`, `<result>`, `<postreq>`, `<steps>`. `<section>` is also accepted — its children are unwrapped before insertion.

---

## Heretto Credentials

Stored in `~/heretto.json` — `{ "email": "...", "token": "..." }`. Both run modes read from this file. The Settings modal can write it too.

**Important:** The Heretto connection indicator checks `res.ok` AND `content-type: application/xml`. An HTTP 200 with an HTML body (SPA fallback) does not set the green indicator.

---

## Testing

```bash
npm test          # run all tests once
npm run test:watch  # watch mode
npm run test:coverage
```

Tests live in `tests/`. Key suites: `tests/sync/round-trip.test.ts` (XML→Lexical→XML fidelity), `tests/sync/insert-section.test.ts` (block injection), `tests/api/` (endpoint contracts).

---

## Current Backlog Summary

Full detail in `future-state/BACKLOG.md`. No open P0 or P1 items as of v0.9.7.

### Recommended next items (P2)

| ID | Item | Size |
|---|---|---|
| **P2-44** | Pencil button does not exit edit mode — `onEnterEditMode` at `dita-architect.tsx:990` increments trigger regardless of current `editMode`; fix to check state and run Accept all / Reject all / Cancel dialog | Sonnet |
| **P2-25** | Troubleshooting topic support — `troubleshootingbody` missing from parser body selector at `parseXmlToLexical.ts:537`; add `cause`/`remedy`/`condition` traversal; New Topic modal fourth option | Sonnet/Opus |
| **P2-26 Ph2** | Full `<info>` rendering in steps — Phase 1 (affordance chips) shipped; Phase 2 requires `DitaStepNode` or sibling-node approach for block children in `<step>` | Opus |
| **P2-36** | DITA 1.3 content model map — `parentElement → validChildren[]` lookup table; no UI; prerequisite for P2-37 | Opus |
| **P2-28+29** | Inline element insertion `+` menu — shell + full DITA inline element catalog; depends on P3-12 (shipped v0.9.5) | Opus |
| **P2-39** | macOS File menu in `AppDelegate.swift` — New Task/Concept/Reference, Open, Close, Save, Replace, Export, Connect; multi-agent workflow via `agents/run.ts` | Multi-agent |
| **P2-40** | macOS View menu — Toggle XML Pane, Theme submenu (depends on P2-39) | Sonnet |
| **P2-41** | macOS DITA Architect menu expansion — About, What's New, Keyboard Shortcuts (depends on P2-39) | Sonnet |

---

## macOS Native App — Menu Bar Placement Rule

Two layers with distinct jobs:

| Layer | Job |
|---|---|
| **macOS menu bar** | App-wide commands, document lifecycle, `⌘` shortcuts |
| **In-app toolbar/header** | Active editing controls, view state, connection status |

**Decision rule:** If an action deserves a `⌘` shortcut or applies to the document as a whole → menu bar (or both). If it is a formatting control used mid-sentence or a view toggle → toolbar. If it shows connection status as much as it provides actions → header.

Dual-path is acceptable and expected for Mac apps: an action can appear in both the macOS menu bar and the in-app header dropdown. The **Heretto button/dropdown stays in the header permanently** — it is a status indicator. The **File Options dropdown should stop growing** — new document-level actions go in the macOS File menu, not File Options.

Every menu item requires two things: (1) an `NSMenuItem` with a target/action selector in `AppDelegate.swift` that calls into `jsBridge`, and (2) a `window.__ditaApi.methodName()` function in `dita-architect.tsx` exposed to the JS context.

---

## Versioning Policy

DITA Architect uses **Semantic Versioning**: `MAJOR.MINOR.PATCH`

| Number | When to bump | Example |
|---|---|---|
| **MAJOR** | Reserved for 1.0.0 — the "shipped game". Not used yet. | `0.x.x → 1.0.0` |
| **MINOR** | A meaningful new capability that changes what the app can do | `0.8.x → 0.9.0` |
| **PATCH** | Bug fixes, polish, small additions that don't open a new capability | `0.8.1 → 0.8.2` |

**No four-part versions.** The old `0.9.6.1` / `0.9.3.1` style is retired. Every hotfix or urgent fix is the next patch number — `0.8.1 → 0.8.2`, never `0.8.1.1`.

**What counts as MINOR vs PATCH:**
- MINOR: new API endpoint surface, new editor capability (table editing, external load API, print/export, AI insert-section), significant new visual system (body element indicators, page-canvas layout)
- PATCH: bug fixes, UX copy, accessibility, theme tweaks, polish, extending an existing capability

**Roadmap:**
- `0.8.x` — remaining insert-section work, pencil toggle fix
- `0.9.0` — inline element insertion (`+` menu, P2-28/29) — the single biggest authoring gap
- `0.9.x` — Connect a Map, macOS menu bar, troubleshooting topic support
- `1.0.0` — the shipped game: polished, full authoring workflow

**Version history mapping** (old → new, for reference):

| New | Old | Release | Notes |
|---|---|---|---|
| 0.1.0 | 0.5.0 | Foundation | |
| 0.1.1 | 0.5.1 | Rendering fixes | |
| 0.2.0 | 0.6.0 | Body element indicators | |
| 0.2.1 | 0.6.1 | Polish batch (beautify, copy) | BACKLOG only — not in What's New (bundled into 0.3.1) |
| 0.2.2 | 0.6.2 | Accessibility + empty states | BACKLOG only — not in What's New (bundled into 0.3.1) |
| 0.3.0 | 0.7.0 | External load API | BACKLOG only — not in What's New (bundled into 0.3.1) |
| 0.3.1 | 0.7.1 | Replace workflow | What's New entry also covers 0.2.1–0.3.0 content |
| 0.3.2 | 0.7.2 | P1 bug fixes (word count, sync) | BACKLOG only — not in What's New (bundled into What's New 0.3.2) |
| 0.3.3 | 0.7.3–0.7.4 | Table context menu + read API | What's New calls this 0.3.2 (combines BACKLOG 0.3.2 + 0.3.3) |
| 0.4.0 | 0.8.0 | Write API + Insert Table | |
| 0.5.0 | 0.9.0 | Heretto images + inline validation | |
| 0.5.1 | 0.9.1 | Link + Replace verification fixes | |
| 0.6.0 | 0.9.1.1 | Note types, section bars, info chips | |
| 0.6.1 | 0.9.2 | Empty href xref validation | |
| 0.6.2 | 0.9.3 | Xref styling, placeholder treatment | |
| 0.7.0 | 0.9.3.1 | Print / Export PDF | |
| 0.7.1 | 0.9.4 | Resizable pane, word wrap, QoL | |
| 0.7.2 | 0.9.5 | Page-canvas layout, block + button | |
| 0.7.3 | 0.9.6 | Keyboard shortcuts, version browser | |
| 0.8.0 | 0.9.6.1 | AI insert-section | |
| 0.8.1 | 0.9.7 | insert-section fixes + block injection | |

---

## Filing Bugs and Feature Requests

### Bugs

Every bug gets a row in `future-state/BACKLOG.md` at the appropriate priority tier (P0–P2). The backlog row is the prioritization signal — one to a few sentences covering what's broken, the file and rough line where it lives, and the fix direction.

A `bugreports/` file is **only warranted when**:

- The investigation produces code-level detail that won't fit a table cell — specific line numbers, before/after snippets, the non-obvious reason existing tests missed it
- Multiple distinct root causes cluster under one symptom (e.g. four separate bugs all causing the same image-not-rendering failure)
- Someone other than the coder contributed analysis (UX review, external input) that should be preserved as a named artifact
- The root cause involves a subtle invariant or mechanism (e.g. Lexical format inheritance) that a future reader would not deduce from the fix alone

If none of those apply — backlog row only. Do not create a bugreport file for bugs that haven't been investigated yet; the file should document what was *found*, not speculate about what might be there.

Name the file `BUG-short-kebab-description.md`. Link to it from the backlog row.

Every backlog bug row must include a **model weight** estimate — the expected execution complexity for the fix:

| Weight | When to use |
|--------|-------------|
| **Haiku** | Mechanical one-liner fixes — a wrong constant, a missing condition, a copy change |
| **Sonnet** | Contained fixes requiring reasoning about one or two files — logic bugs, serialization edge cases, small new behaviors |
| **Opus** | Fixes requiring architectural understanding across multiple files, or where the root cause is not yet fully known |
| **Multi-agent** | Fixes that span Swift + TypeScript simultaneously, or require parallel investigation of independent subsystems; use `agents/run.ts` |

Use the same weights already applied to backlog feature items. When in doubt, pick the weight that matches the complexity of the *investigation*, not just the eventual one-line fix — a subtle invariant that takes an hour to find is Opus even if the patch is small.

### Feature Requests

Feature requests go in `future-state/feature-requests.md` with a `**Status:** Open` field. Substantial features that graduate to active work also get a backlog row in `future-state/BACKLOG.md` — the FR file holds the full design rationale and user story; the backlog row holds the prioritization and execution criteria.

Update the FR `**Status:**` field to `Shipped (vX.Y.Z, YYYY-MM-DD)` at version bump time.

---

## Version Bump Checklist

When bumping the version in `constants/version.ts` and writing release notes:

1. Update the version string in `package.json` and add release notes entry at top of `RELEASE_NOTES` array in `constants/version.ts`
2. Move shipped backlog items to the Completed section in `future-state/BACKLOG.md`
3. **Delete resolved bug reports** — scan `bugreports/` and remove any files for bugs that shipped in this release
4. **Update feature request statuses** — scan `future-state/feature-requests.md` and update the `**Status:**` field to `Shipped (vX.Y.Z, YYYY-MM-DD)` for any FRs that shipped in this release
5. Run `npm run build:app` to rebuild `dist/` and copy into `DITA Architect.app/Contents/Resources/dist/`
