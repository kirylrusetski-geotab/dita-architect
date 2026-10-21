# DITA Architect — Project Instructions

## What This Is

A lightweight DITA editor (React + TypeScript + Vite + Lexical + Monaco) built by Kiryl Rusetski. Visual editor on the left, XML pane on the right, syncs between both. Integrates with any Heretto CMS instance (host + credentials in `~/heretto.json`) for browsing, opening, saving, and replacing topics.

**Current version:** 0.10.0 (2026-10-21)

---

## Governance

How a change gets from idea to merged is the **five-stage model** in [GOVERNANCE.md](./GOVERNANCE.md):
Capture → Triage → Shape → Build & Review → Anti-entropy. This is a shared model with Cadence
(`~/ai-projects/Cadence/`); much of it codifies what this project already does.

- **Quality gates:** [REVIEW-CRITERIA.md](./REVIEW-CRITERIA.md) — seven named gates (round-trip
  fidelity, Heretto-safe output, run-mode parity, strict build, test coverage, `originMap`
  integrity, and **Gate 7 — conceptual fit & reuse**). Previously implicit in the pipeline personas;
  now they govern direct work too.
- **Architectural decisions:** [future-state/decisions.md](./future-state/decisions.md) — the ADR
  log. Write an ADR (Stage 3) and apply Gate 7's deeper checks **only** when a change meets the
  **architectural trigger**: a new pattern, a new dependency, a data-model/contract change
  (`Tab`, `originMap`, the round-trip contract), or a new run-mode / API surface (`/api/*`,
  `window.__ditaApi`, a Swift route, a macOS menu surface). The Edit Mode rebuild (BUG-02 →
  FR-045/046) is the canonical example — see ADR-004.
- **Feature capture:** new FRs in [future-state/feature-requests.md](./future-state/feature-requests.md)
  open with the problem-first header (**Problem / Signal / Smallest slice / Serves**) above the
  existing rich body. The triage (Fix Now / Batch + model weight) and filing rules already live in
  "Filing Bugs and Feature Requests" below — unchanged.
- **Anti-entropy (Stage 5):** the session-start grooming check below, plus a **per-minor-version
  consolidation pass** — a `/code-review` + simplification sweep that **files debt as BACKLOG items**
  rather than fixing inline, so cleanup is scheduled, not impulsive.

---

## Session Start — Backlog Grooming Check

At the start of every session, after reading this file, scan `future-state/BACKLOG.md` and check these three things:

1. **Parked items** — for each row in the Parked/blocked section, does its unblock condition now appear to be met? (e.g. a dependency shipped, a feature landed that changes the calculus.) If yes, surface it — don't silently leave it parked.
2. **Chain ordering** — for the active feature chains (inline element insertion, edit-mode rebuild, macOS menu bar), does the current sequencing still make sense given what has shipped? Flag any chain where the dependency is now moot or the order should swap.
3. **Sweep-ready rot** — if 4 or more bugs have accumulated in the Sweep-ready lane, flag it: "N sweep-ready bugs — consider a sweep session before starting new features."

Report findings as a short bullet list before starting work. If nothing has changed, say so in one line and move on.

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
- **Serializer:** `sync/serializeLexicalToXml.ts` — Lexical node tree → DITA XML; uses `originMap` to reconstruct inline DITA elements correctly. Every visual edit patches a clone of the **load-time** master (`SyncManager.masterXmlRef`), not the last serialized XML.
- **Inline scanner + reconciler (ADR-010):** `sync/inline-units.ts` — the one scanner that turns a DOM element's inline children into atoms; the parser builds Lexical nodes from them and the serializer reads them, so the two cannot drift. `sync/inline-reconcile.ts` — `reconcileInline` keeps unchanged inline elements as anchors and splices only the changed run; `patchElementContent`, the table-cell direct-text branch, and `patchPWrapper` call it first and fall to the legacy text-diff path only on a bail (PI/comment inside the changed run, unsupported node). `setReconcileObserver` is the test seam.
- **Inline wrap (ADR-010 slice B):** `lib/inline-wrap.ts` — `$wrapSelectionInInlineTag` / `$unwrapInlineAtSelection` build the parser's exact node shape and never edit an existing key's `originMap` entry (undo safety). `components/InlineWrapPlugin.tsx` (mounted inside `SyncManager`) owns `WRAP_INLINE_COMMAND`, `UNWRAP_INLINE_COMMAND`, and the ⌘⇧U / ⌘⇧C shortcuts; the Toolbar's `Inline element` menu and `Insert Link` dispatch them; `SuggestionPlugin` blocks both.
- **Post-sync structure check (FR-063):** `sync/structure-check.ts` — after every serialize (`SyncManager` both paths, Accept All) counts structure in the editor vs the XML and toasts when the XML has fewer. One-directional, throttled, advisory; runs even when the XML is unchanged.
- **Sync bridge:** `components/SyncManager.tsx` — coordinates bidirectional sync between Lexical and Monaco; update sources: `'visual'`, `'xml'`, `'api'`; sync suspends while a tab is in suggesting mode (`suspendSync`), buffering XML-side changes until marks are resolved
- **Tracked changes (FR-046, marks-as-data):** `components/TrackedTextNode.ts` — TextNode subclass carrying `{changeId, kind: insert|delete|split, author, date}`; `components/SuggestionPlugin.tsx` — suggesting-mode command interception + accept/reject-all lifecycle; `components/ChangeListPanel.tsx` — per-change review sidebar; `lib/tracked-changes/` — model/scan/mutations/edits. `tab.documentMode: 'viewing'|'suggesting'|'editing'` replaces the old editMode boolean. Marks are session-only (carrier = FR-051). See ADR-004.
- **Heretto integration:** `hooks/useHerettoCms.ts` — all CMS operations (browse, open, save, replace, connection check)
- **External load:** `hooks/useExternalLoad.ts` — polls `/api/pending-loads` in Vite mode; native mode uses JS bridge directly
- **Native API bridge:** `lib/native-api-bridge.ts` — registers `window.__ditaApi` on `dita:` protocol; Swift calls these via `callAsyncJavaScript`. This is the **only** transport for the tab API (ADR-007); the dev server has no browser→middleware channel, so port 3000 serves only the external-load queue.
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
| `future-state/BACKLOG.md` | Open work only: lanes, chains, parked items, scheduling model — read before starting any session |
| `future-state/HISTORY.md` | Shipped work by version + the dated changelog (split out of BACKLOG 2026-10-19) |
| `future-state/feature-requests.md` | Feature request detail and FR status |
| `future-state/decisions.md` | ADR log |
| `PROJECT_LOG.md` | Per-session implementation log (git-ignored; the multi-agent pipeline appends to it) |
| `API.md` | Full HTTP API reference |
| `bugreports/` | One file per filed bug (git-ignored); deleted at version-bump time once the bug ships and its resolution is in HISTORY.md |
| `textAnalysis.ts` | Flesch-Kincaid readability engine — powers the status bar score in `BottomToolbar.tsx`; also earmarked for the pending `GET /api/tabs/:id/stats` endpoint (FR) |
| `agents/run.ts` | Multi-agent pipeline entry point |
| `agents/orchestrator.ts` | Pipeline coordinator — runs all 9 steps, manages retries and checkpoints |
| `agents/shared/types.ts` | Shared types, team roster, `STAKEHOLDER_MESSAGE`, `COMPANY_CULTURE` |
| `agents/shared/file-comm.ts` | File-based inter-agent communication (reports, checkpoints, health) |
| `agents/shared/codebase-context.ts` | Generates a codebase snapshot injected into every agent prompt |
| `agents/agents/` | One file per agent persona |

---

## Obsidian Notes Folder (out-of-repo planning artifacts)

Longer-form planning and session artifacts live outside the repo in
`/Users/kirylrusetski/Documents/Obsidian/geotab-work/DITA Architect/`:

- **`Roadmap — DITA Architect (2026-07-18).md`** — the **roadmap of record** (milestone ladder to 1.0, cut/re-scoped items, build discipline, the milestone-session checklist, public-repo standing rules). Consult it when choosing the next feature session; update it at milestone boundaries.
- **`Execution Plan — Roadmap to 1.0 (2026-10-20).md`** — the ladder as eight sessions: which model to use, invariants to pin before code, steps, exit criteria, risks, and gap fillers. **Read the current session's block at session start** and append to its status log at session end.
- **`Session Log — 4A Complete, 4B Model Weights (2026-07-17).md`** — the 2026-07-17 codebase-review and remediation record (v0.8.5 → v0.9.0 arc, incl. the BUG-20 post-mortem). The separate Remediation Plan note was folded into it and deleted 2026-10-19.
- **`Session Log — Session 2A Handoff, ADR-010 slice A (2026-10-20).md`** — the mid-session handoff written when Session 2A paused; superseded (2A shipped as v0.9.9 on 2026-10-21, and its design notes are now ADR-010's implementation note). Kept as a record of the method; nothing in it is still pending.
- **`Session Log — FR-057 Real-Scenario Context (2026-08-04).md`** — the three-attempt live authoring session that drove v0.9.2/v0.9.3; the FR-057 build plan was deleted 2026-10-19 (its reasoning is ADR-008).
- **`dita-architect-market-analysis.md`** — March 2026 competitive positioning; the roadmap's strategic lens is derived from it.

Session logs and plans that need to survive context-window limits are written there, not to the repo. `PROJECT_LOG.md` (in-repo) remains the per-session implementation log.

The Obsidian folder also contains **symlinks** to `future-state/BACKLOG.md` and `future-state/feature-requests.md` (created 2026-07-18) so they're readable from the vault. The repo copies are canonical and git-tracked (ADR-005); the symlinks are views, not duplicates — always edit via the repo paths.

---

## Multi-Agent Pipeline

A 9-step pipeline built on the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). **It is a tool, not the default.** Every release since v0.8.5 was built directly with Gates 1–7 applied by hand; the pipeline has not run since March 2026. See "When to use the pipeline vs. working directly" below for the rule, and dry-run it on a disposable task before trusting it on a milestone.

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

*Rewritten 2026-10-20 to match how the project actually works.* The pipeline earns its overhead when you need **independent review**, not **breadth**. Breadth across Swift and TypeScript is held better by one Fable session, because the pipeline's hand-offs lose context between agents (that is why the Fable weight exists).

Use the pipeline when:
- The task is **well specified and mechanical across files** and the risk is sloppiness, not a wrong idea. A fixed list of items each needing a Swift selector and a bridge method, with a one-line exit test (the v0.14 menu bar), is the canonical case.
- You want a **reviewer who did not write the code**. Running only the Elena (review) step on a finished diff is the fresh-context adversarial review the roadmap requires for Fable milestones (v0.13, v0.14).
- It is the **per-minor anti-entropy consolidation pass** (GOVERNANCE Stage 5): a sweep for duplication that files debt as BACKLOG rows.
- You need **parallel investigation of independent subsystems**, like the 2026-07-17 codebase review.

Work directly (gates applied by hand) when:
- The **invariants are still being discovered** — serializer contract changes, tracked-changes machinery, anything where one wrong assumption ships silent corruption. One context must hold everything (v0.9.7's troubleshooting work changed design three times as live facts arrived).
- The work is **discovery**: probing the Heretto REST API, reading Lexical source, counting real occurrences.
- It is **Haiku or Sonnet weight**, a version bump, or a backlog/FR update.

Before the first real use: run `npx tsx agents/run.ts` on a trivial, disposable request and confirm all nine steps complete, the reports land in `agents/shared/`, and the `pipeline/<timestamp>` branch is created. Budget half an hour; the Agent SDK has moved since the pipeline last ran.

---

## HTTP API

[API.md](./API.md) is the contract: every endpoint, request/response shape, the `success` + `httpStatus` envelope, and worked examples. The three facts that shape any change here:

- **The tab API is native-only (port 3001)** — `/api/status`, `/api/tabs`, `/api/tabs/:id/*` reach live editor state only through the Swift↔JS bridge (`window.__ditaApi`, ADR-007). The dev server (port 3000) serves **only** `/api/load-content` + `/api/pending-loads`.
- **Writes propose, they do not apply** — `PUT /api/tabs/:id/content` and `POST /api/tabs/:id/insert-section` both stage a `pendingReview` that the author accepts or rejects in the XML pane (ADR-008); `POST /api/tabs/:id/save` is refused while a review is pending.
- No authentication; the listener is loopback-bound with a 30 s idle timeout.

---

## Heretto Credentials

Stored in `~/heretto.json` — `{ "host": "yourcompany.heretto.com", "rootUuid": "<content-folder-uuid>", "email": "...", "token": "..." }`. Both run modes read from this file. The Settings modal can write it too. `host` is the Heretto instance hostname (scheme and trailing slash are stripped). `rootUuid` is the content folder the browser opens on and the connection probe hits; it lives in `useHerettoCms` state as `herettoRootUuid` (loaded from `/heretto-credentials` on mount) and is passed to `HerettoBrowserModal` as a prop. Nothing tenant-specific is hardcoded (FR-062 slices 1–2). In dev mode the Vite proxy target is fixed at startup, so a host change needs a dev-server restart. Heretto's folder XML carries `parent-folder-id`; walking it upward from any folder reaches a parentless `master` folder, which is the discovery path for FR-062 slice 3.

**Important:** The Heretto connection indicator checks `res.ok` AND `content-type: application/xml`. An HTTP 200 with an HTML body (SPA fallback) does not set the green indicator.

---

## Testing

```bash
npm test          # run all tests once
npm run test:watch  # watch mode
npm run test:coverage
```

Tests live in `tests/`. Key suites: `tests/sync/round-trip.test.ts` (XML→Lexical→XML fidelity), `tests/sync/byte-stability.test.ts` (Gate 1 corpus, incl. the FR-064 `sampled/` real topics), `tests/sync/inline-reconcile.test.ts` (ADR-010 R1–R6; R1 asserts zero false rewrites over the whole corpus), `tests/sync/inline-wrap.test.ts` (ADR-010 I1–I7: every wrap element × 13 contexts), `tests/inline-wrap-plugin.test.tsx` (wrap commands, shortcuts, and the Suggesting-mode block through the real component tree), `tests/sync/structure-check.test.tsx` (FR-063: zero false warnings over the corpus), `tests/xml-insert.test.ts` (FR-045 API insertion transform).

Test-harness facts that cost time once: a non-headless Lexical editor with no mounted root rebuilds its selection from the (absent) DOM at the start of every update, so multi-update tests must re-select; register history *before* parsing, as the app's `HistoryPlugin` is; and mount a `ContentEditable` in component tests or Lexical will not commit updates.

---

## Current Backlog Summary

This file does not carry a copy of the backlog; copies go stale (the one that used to live here was two releases behind when it was removed on 2026-10-19). Read `future-state/BACKLOG.md` directly. The shape to expect: **Bugs** in three lanes (Blocking now / Sweep-ready / Larger) and **Features** in dependency chains plus Standalone, scheduled by the two-lane rule (**Fix Now** vs **Batch**); priority tiers P0–P3 are retired and old `P#-NN` IDs are stable labels only. The milestone order for feature sessions is in the Obsidian roadmap (see Versioning Policy below).

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

**Roadmap:** the roadmap of record is the Obsidian note `Roadmap — DITA Architect (2026-07-18).md` (see "Obsidian Notes Folder" above). Summary as of 2026-10-20: `0.9.7` displaced items (P2-25 troubleshooting parser, FR-049 placeholders, FR-061 Navy theme) → `0.9.8` sampled corpus + grammar discovery → `0.9.9` ADR-010 slice A inline reconciler (fixes BUG-32/33) → `0.10.0` wrap-selection inline authoring (ADR-010 slice B) → `0.11.0` map-aware authoring → `0.12.0` validation → `0.13.0` review carrier → `0.14.0` native menu bar → `1.0.0` daily driver. Consult the note before choosing a feature session; update it at milestone boundaries.

**Version history mapping** (old four-part numbering → SemVer) lives in `future-state/HISTORY.md` under "Version numbering map".

---

## Filing Bugs and Feature Requests

`future-state/BACKLOG.md` is split into two lists — **Bugs** and **Features** — because they're handled differently. There are no priority tiers; schedule with the two-lane rule documented at the top of the backlog (**Fix Now** vs **Batch**). Numbering: new bugs are `BUG-NN`; new features keep their `FR-NNN` from `feature-requests.md`. Old `P#-NN` IDs are retained as stable labels only.

### Bugs

Triage every new bug in ~30 seconds and drop it into one subsection of the backlog's **Bugs** list — the subsection *is* the schedule signal:

| Subsection | Use when | What happens |
|---|---|---|
| 🔴 **Blocking now** | Blocks you from using the tool, or **corrupts data** (emits invalid XML Heretto rejects/mangles) | Fix immediately, on its own, ship a patch |
| 🟡 **Sweep-ready** | Small, contained (Haiku/Sonnet) | Batch — clear with the next bug sweep when ~4–6 pile up |
| 🔵 **Larger** | Architectural, spans layers, or root cause not fully known (Opus / Multi-agent) | Gets its own dedicated session |

The backlog row is the record — one to a few sentences covering what's broken, the file and rough line where it lives, the fix direction, and a **model weight** (table below). Do not fix a bug the moment it's filed unless it's Blocking now — batching is the point.

A `bugreports/` file is **only warranted when**:

- The investigation produces code-level detail that won't fit a table cell — specific line numbers, before/after snippets, the non-obvious reason existing tests missed it
- Multiple distinct root causes cluster under one symptom (e.g. four separate bugs all causing the same image-not-rendering failure)
- Someone other than the coder contributed analysis (UX review, external input) that should be preserved as a named artifact
- The root cause involves a subtle invariant or mechanism (e.g. Lexical format inheritance) that a future reader would not deduce from the fix alone

If none of those apply — backlog row only. Do not create a bugreport file for bugs that haven't been investigated yet; the file should document what was *found*, not speculate about what might be there. Name it `BUG-short-kebab-description.md` and link it from the backlog row.

| Weight | When to use |
|--------|-------------|
| **Haiku** | Mechanical one-liner fixes — a wrong constant, a missing condition, a copy change |
| **Sonnet** | Contained fixes requiring reasoning about one or two files — logic bugs, serialization edge cases, small new behaviors |
| **Opus** | Fixes requiring architectural understanding across multiple files, or where the root cause is not yet fully known |
| **Fable** | Reserve for work where the risk is *incomplete invariant tracking in a single context*: cross-cutting refactors of the round-trip contract, rebuilds of subtle stateful machinery (tracked changes), sessions where one wrong assumption ships silent data corruption. Also consider it as a replacement for Multi-agent when the driver was cross-language breadth rather than the need for independent review gates — one Fable session holding Swift + TypeScript together avoids the pipeline's cross-agent context loss (keep the build/review/test gates as checkpoints). |
| **Multi-agent** | Fixes that span Swift + TypeScript simultaneously, or require parallel investigation of independent subsystems; use `agents/run.ts`. Before choosing this, check whether the Fable row above fits better — Multi-agent earns its overhead when you need *independent* review perspectives, not just breadth. |

When in doubt, pick the weight that matches the complexity of the *investigation*, not just the eventual one-line fix — a subtle invariant that takes an hour to find is Opus even if the patch is small.

### Feature Requests

Feature requests go in `future-state/feature-requests.md` with a `**Status:** Open` field. Substantial features that graduate to active work also get a row in the **Features** list of `future-state/BACKLOG.md`, placed in the right dependency chain or under Standalone — the FR file holds the full design rationale and user story; the backlog row holds the dependency order, model weight, and execution criteria. Features are chosen deliberately, one at a time, top-down within a chain — pick one when you want new capability.

Update the FR `**Status:**` field to `Shipped (vX.Y.Z, YYYY-MM-DD)` at version bump time.

---

## Version Bump Checklist

When bumping the version in `constants/version.ts` and writing release notes:

1. Update the version string in `package.json` and add release notes entry at top of `RELEASE_NOTES` array in `constants/version.ts`
2. Move shipped backlog items from `future-state/BACKLOG.md` to the Completed section of `future-state/HISTORY.md`, and add a dated changelog bullet there
3. **Delete resolved bug reports** — scan `bugreports/` and remove any files for bugs that shipped in this release
4. **Update feature request statuses** — scan `future-state/feature-requests.md` and update the `**Status:**` field to `Shipped (vX.Y.Z, YYYY-MM-DD)` for any FRs that shipped in this release
5. **Sync `macos/Sources/DITAArchitect/Info.plist`** — update `CFBundleShortVersionString` to the new version
6. Run `macos/build.sh` (web bundle + Swift shell + Info.plist) — `npm run build:app` alone does not recompile Swift or refresh the bundled Info.plist
7. If the serializer or parser changed: confirm every fixture in `tests/sync/fixtures/` (including `sampled/`, FR-064) is still byte-stable, and add a fixture for any new structure the release handles
8. Relaunch the app and run the 10-minute smoke pass; record it in the HISTORY row
9. Commit, create an **annotated** tag (`git tag -a vX.Y.Z -m "…"`), `git push origin main --follow-tags`, confirm the tag on GitHub with `git ls-remote --tags origin`. `--follow-tags` pushes annotated tags only; a lightweight tag is silently left behind (v0.9.9 had to be pushed by name)
