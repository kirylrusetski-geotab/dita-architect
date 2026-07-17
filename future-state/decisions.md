# DITA Architect — Architecture Decision Records

A running log of architectural decisions. Stage 3 of [GOVERNANCE.md](../GOVERNANCE.md): an ADR is
written **only** when a change meets the architectural trigger — a new pattern, a new dependency, a
data-model/contract change, or a new run-mode / API surface. Routine bug-sweep work needs no ADR.

An ADR is short and immutable once accepted; if a later decision overrides it, add a new ADR and set
the old one's status to *Superseded by ADR-NNN*.

```
## ADR-NNN — <title>

**Date:** YYYY-MM-DD · **Status:** Accepted | Superseded by ADR-MMM | Proposed

**Context** — the forces and constraints in play.
**Decision** — what was chosen.
**Consequences** — what this makes easy, what it makes hard, what it rules out.
**Alternatives considered** — and why not.
```

The entries below are **back-filled** from decisions already embedded in the app — they record the
load-bearing choices so future changes have something to match against (Gate 7).

---

## ADR-001 — originMap-based serialization

**Date:** 2026-06-18 (back-filled) · **Status:** Accepted

**Context** — Lexical's node model is lossy with respect to DITA: many distinct DITA inline elements
(`ph`, `uicontrol`, `term`, `codeph`) would collapse to the same Lexical node type, and serializing
from node type alone cannot reconstruct the original element.

**Decision** — `parseXmlToLexical` stamps an `originMap` entry recording the DITA element identity
for every node it creates; `serializeLexicalToXml` reconstructs inline DITA elements from
`originMap`, not from Lexical node type.

**Consequences** — Enables byte-stable round-trips (REVIEW-CRITERIA Gates 1 & 6). Every new
node-creating code path must stamp `originMap`, and every serialization path must consult it —
forgetting either is the root of a class of content-loss bugs. Pragmatic extensions (e.g. the
definition-list `originMap`-paragraph approach in v0.8.3) build on this rather than around it.

**Alternatives considered** — Custom Lexical node types per DITA element (rejected at the time:
heavier; partially revisited case-by-case, e.g. `DitaImageNode`, `DitaInfoPreviewNode`).

---

## ADR-002 — Native shell: `dita://` scheme + bare `swiftc` (no SPM)

**Date:** 2026-06-18 (back-filled) · **Status:** Accepted

**Context** — DITA Architect ships as a native macOS app as well as a Vite dev app, serving the same
React frontend, with no terminal required for the native path.

**Decision** — A WKWebView shell loads the built `dist/` via a custom `dita://` URL scheme handler,
with an `NWListener` HTTP server on port 3001 and a JS bridge (`callAsyncJavaScript`). Built with
bare `swiftc` via `macos/build.sh` — no Swift Package Manager.

**Consequences** — Two run modes to keep at parity (REVIEW-CRITERIA Gate 3): every endpoint needs a
Vite middleware route *and* a Swift route + `window.__ditaApi` method. No SPM keeps the build
dependency-light and scriptable. Native-only features (menu bar) live behind the JS bridge.

**Alternatives considered** — Electron (rejected: weight); SPM (rejected: unnecessary for a
single-binary build).

---

## ADR-003 — Multi-agent pipeline as the harness for architectural / cross-file change

**Date:** 2026-06-18 (back-filled) · **Status:** Accepted

**Context** — Some changes span Swift + TypeScript or touch many files and benefit from
plan → implement → review → verify sequencing; others are one-file fixes where that overhead is waste.

**Decision** — A 9-step pipeline on the Claude Agent SDK (`agents/run.ts`) is the harness for
**Multi-agent**-weighted work; Haiku/Sonnet bugs, version bumps, and doc edits are done directly.
The pipeline branches `pipeline/<timestamp>` for isolation and enforces hard gates (Elena review,
Marcus build, Taylor tests).

**Consequences** — Heavy changes get adversarial review and isolation; light changes stay fast. The
pipeline personas *are* the enforcement mechanism for REVIEW-CRITERIA on pipeline work (see the
per-gate "Pipeline owner" notes).

**Alternatives considered** — Always-pipeline (rejected: overhead on trivial fixes); never-pipeline
(rejected: loses isolation/review on risky cross-layer work).

---

## ADR-004 — Edit Mode rebuild: marks-as-data, not diff-and-paint

**Date:** 2026-06-18 (back-filled) · **Status:** Accepted (both tracks implemented; promoted 2026-07-17 with v0.9.0)

**Context** — Edit Mode reconstructs tracked changes by diffing a frozen plain-text snapshot against
the live tree on every keystroke (diff-and-paint). This is the single root cause behind every
reported Edit Mode failure (blind to inline/attribute edits, node-key churn, the 50ms API-insert
race, accept-doesn't-persist). Prior fixes (FR-042/043, P1-16/17/18) were band-aids on this
foundation. Full analysis: [`../bugreports/BUG-edit-mode-architecture.md`](../bugreports/BUG-edit-mode-architecture.md).

**Decision** — Rebuild as **marks-as-data** (the SuperDoc pattern): tracked changes are stored as
data on the model, not derived by diffing text. Two tracks: **FR-045** (Monaco-diff review for API
insertions — do first) then **FR-046** (marks-as-data tracked changes in Lexical).

**Consequences** — Not patchable incrementally; needs its own session(s). Until done, no further
band-aids on the diff-and-paint path (a Gate 7 / smallest-slice violation to add one). This ADR is
**Proposed** until the rebuild lands; promote to Accepted with the implementing version.

**Progress** — Track 1 (FR-045) implemented 2026-07-17 (v0.8.8): API insertions are now a
deterministic XML-level transform (`lib/xml-insert.ts`) reviewed in a Monaco diff with
whole-change Accept/Reject; the executor slot, the 50 ms race, and `SectionInsertPlugin` are
retired. Track 2 (FR-046) implemented 2026-07-17 (v0.9.0): human tracked changes are
marks-as-data on a `TrackedTextNode` (TextNode subclass carrying `{changeId, kind, author,
date}`); `documentMode: 'viewing'|'suggesting'|'editing'` replaces the editMode boolean
(also resolving P2-44); suggesting-mode gestures are recorded at interception time
(commands at CRITICAL priority + a capture-phase beforeinput closing Lexical's typing fast
path) — never derived by diffing; per-change and all accept/reject are atomic mutations
located by changeId scan; `EditModePlugin`, `TrackedChangesPlugin`, and
`TrackedDeletionNode` are deleted (BUG-13 absorbed). Marks are session-only in v1 — the
DITA round-trip carrier (ezd-review PIs) is a follow-up FR.

**Alternatives considered** — Continued incremental patching (rejected: the unreliability persists
regardless; see the bug report).

---

## ADR-005 — Beads skipped; markdown files are the tracker; SemVer (no four-part versions)

**Date:** 2026-06-18 (back-filled) · **Status:** Accepted

**Context** — The agentic approach offers `beads` for issue tracking; the project also accumulated a
four-part versioning style (`0.9.6.1`).

**Decision** — Skip beads — [`BACKLOG.md`](./BACKLOG.md) (Bugs + Features, two-lane scheduling) and
[`feature-requests.md`](./feature-requests.md) are the tracker. Use strict `MAJOR.MINOR.PATCH`
SemVer; the four-part style is retired (every hotfix is the next patch number).

**Consequences** — Zero tracker tooling; everything in git-tracked markdown. The old→new version
mapping table in CLAUDE.md is preserved for historical reference only.

**Alternatives considered** — Adopting beads (rejected: overhead exceeds value at single-maintainer
scale).

---

## ADR-006 — One body walk: patchBodyChildren subsumes the top-level serializer walk

**Date:** 2026-07-17 · **Status:** Accepted (implemented with BUG-04 Session 4A)

**Context** — `serializeLexicalToXml` had two parallel walk implementations doing the same job with
different capabilities: the inline top-level body walk knew about dl-runs and sections but had no
look-ahead; `patchBodyChildren` (used for sections and `<dd>` content) had look-ahead but no dl or
section awareness. Every capability gap was a live content-loss bug: a `<dl>` inside a `<section>`
was destroyed to bare `<p>`s (S4), a deleted paragraph at body level shifted identity onto the wrong
`id` (M9), and the mismatch paths deleted DOM elements whose Lexical counterparts cannot be
recreated — `<note conkeyref>` parsed to a `DitaPhRefNode` was simply removed from the output (S1).
The 2026-07-17 review identified this divergence (D1) as the root cause of BUG-04 and "the likely
site of the next three bugs."

**Decision** — There is exactly **one** walk: `patchBodyChildren`. It groups its Lexical nodes via
`groupBodyNodesForSections` (dl-runs, section groups, singles), handles the Heretto `<p><dl>`
wrapper, keeps look-ahead for deletions, and enforces a **non-recreatable node contract**: when
`createElementFromLexical` returns `null` for a Lexical node, the corresponding DOM element is
preserved in place, never removed (`note`↔`ditaphref` is an explicit preserve-as-is pairing). The
top-level serializer delegates its body patching to this walk. Callers that must not re-group
dl-flattened nodes (the `<dd>` walk inside `patchDlElement`, whose nodes all carry `dlEntryIndex`)
pass `{ groupDl: false }`. Additionally, `patchElementContent` detects "untouched" for elements
with block children using whitespace-collapsed text equality plus a **recursive** xref count —
because the parser's flatten-with-trim is whitespace-lossy by design, exact equality was a false
mismatch trigger that destroyed unedited notes (S3, including the real-topic `<dd>` variant).

**Consequences** — Byte-stability for unedited round-trips is enforceable (the FR-047 corpus is the
gate); dl/section/look-ahead behavior is identical at body level, in sections, and in `<dd>`.
Whitespace-only edits inside block-children notes are treated as no-ops (accepted trade). Any new
grouping concept (e.g. a future block type) is added in ONE place. The formatting-blindness of the
text-diff patch (S2) is *not* addressed here — that is 4B/FR-046 scope.

**Alternatives considered** — Patching S1/S3/S4 individually inside the existing two walks
(rejected: exactly the point-fix pattern that produced this bug class); rebuilding serialization
from scratch without the patch-against-master design (rejected: destroys the Heretto-attribute
preservation that patching exists to provide).

---

## ADR-007 — The tab API is native-only; the dev-server (port 3000) tab API is deleted

**Date:** 2026-07-17 · **Status:** Accepted (BUG-05; code implemented 2026-07-17, ships with next release)

**Context** — The read/write tab API (`GET /api/status` tab fields, `GET /api/tabs`,
`GET /api/tabs/:id/content`, `PUT /api/tabs/:id/content`, `POST /api/tabs/:id/save`) was implemented
twice: once natively (port 3001, via `HttpServer.swift` → `JSBridge` → `callAsyncJavaScript`, which
reaches the live browser realm directly) and once for the Vite dev server (port 3000, via
`lib/editor-state-bridge.ts` shared module state). The 2026-07-17 codebase review (BUG-05) found the
port-3000 path **structurally non-functional and dead since inception**:

- The browser realm (`dita-architect.tsx`) and the Vite Node process (`vite.config.ts`) each get
  their **own** module instance of `editor-state-bridge.ts`. The browser mutates its copy via
  `updateTabsState`/`updateEditorStatus`; the Node process serves `/api/*` from its copy. **No
  transport crosses the realm boundary**, so `/api/status` always reports `tabCount: 0` and every
  `/api/tabs/:id/*` 404s regardless of editor state.
- Write routes are additionally shadowed to 405: the `read-only-api` plugin registers
  `server.middlewares.use('/api/tabs', …)`, which matches all subpaths and never calls `next()` for
  non-GET methods, and it is registered before the `write-api` plugin.
- The API test suites pass only because **vitest runs both realms in one process**, so the shared
  module variable *is* shared there — Gate 3 (run-mode parity) and Gate 5 (test coverage) were both
  fooled into green.

Only the external-load queue (`POST /api/load-content` + `GET /api/pending-loads`) genuinely works
on port 3000, because it uses a Node-side `pendingLoads` array polled over HTTP by the browser
(`useExternalLoad`) — real transport, not shared module state.

**Decision** — Declare the tab API **native-only** (port 3001). Delete the dead port-3000 surface:
the `read-only-api` and `write-api` Vite plugins' tab routes, the Node-side `editorState` object and
its `setEditorStateReference` wiring, and `lib/editor-state-bridge.ts` itself; remove the now-dead
bridge calls from `dita-architect.tsx`. Keep `/api/load-content` + `/api/pending-loads` on port 3000
(the one dev-server API with real transport). Delete the test suites that asserted the dead behavior
(`read-only-api*.test.ts`, `write-api-endpoints.test.ts`, `api-sync-integration.test.ts`,
`elena-typescript-regression.test.ts`) rather than leave false Gate 5 confidence. Sweep API.md and
CLAUDE.md to state the tab API requires the native app on port 3001.

**Consequences** — One implementation of the tab API instead of two, aligned to the established
native-bridge transport (ADR-002). Removes a class of misleading green tests. The dev server keeps
exactly the endpoints that work (external load). If browser-based automation ever becomes a goal
(e.g. a web deployment with no Swift shell), a real browser→server channel — WebSocket/SSE — is a
new decision (its own ADR), not a resurrection of the shared-variable pattern. Run-mode parity
(Gate 3) is now honestly asymmetric by design: the tab API is a native-only capability, documented
as such, not a parity gap.

**Alternatives considered** — **(B)** Build a real browser→middleware state channel (WebSocket/SSE
or reverse-poll) so the full tab API works on port 3000 (rejected: adds a whole transport subsystem
to serve a use case — driving live editor tabs from the dev server — that has had zero consumers
since the feature shipped; the skills target port 3001; YAGNI). Leaving the dead code in place with
a doc note (rejected: the false-green tests actively mislead future Gate 3/5 checks).
