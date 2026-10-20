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
foundation. Full analysis: `../bugreports/BUG-edit-mode-architecture.md` (bug report file deleted at v0.9.0 per the version-bump checklist; the analysis is summarised in ADR-004).

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

---

## ADR-008 — `PUT /api/tabs/:id/content` proposes; it does not apply

**Date:** 2026-08-04 · **Status:** Accepted (implemented by FR-057, v0.9.3, 2026-08-04; promoted 2026-10-19)

**Context** — `PUT /api/tabs/:id/content` has always been write-through: it validates the incoming
XML and replaces `tab.xmlContent` immediately. That was adequate when the API's job was "put this
document in the editor." It is not adequate for the workflow the tool is now used for — an AI drafts
or revises a topic and a writer reviews the result before it reaches Heretto.

Three sessions against a live topic (TECHWR-6335, `Coaching_Effectiveness_tab.dita`; see
`Session Log — FR-057 Real-Scenario Context (2026-08-04)` in the Obsidian folder) established the
gap in stages:

- **Attempt 1** — loading the finished draft directly meant it arrived as the committed base
  document. Nothing to review. Suggesting mode has to be active *before* the content arrives.
- **Attempt 2** — with suggesting mode active, the PUT silently vanished: `SyncManager`'s
  `suspendSync` buffered it and nothing ever flushed the buffer. Filed as FR-056, fixed in v0.9.2.
- **Attempt 3** — the content now renders, but as plain committed text. `trackedChangeCount` is 0
  and the ChangeListPanel is empty. The writer can see the AI's output but not what it *changed*.

Meanwhile the review surface already exists and is proven: ADR-004 track 1 (FR-045, v0.8.8) built
`Tab.pendingReview` + `ReviewBar` + a read-only Monaco diff with Accept/Reject, and wired it to
`POST /api/tabs/:id/insert-section`. Two API routes that both deliver AI-authored content behave
inconsistently — one stages a review, the other overwrites the document.

A related asymmetry: `insertSection` refuses outright when `documentMode === 'suggesting'`, on the
reasoning that writing `xmlContent` would clobber live tracked marks. That guard is correct for a
write-through route and unnecessary for a staging one.

**Decision** — Make `PUT /api/tabs/:id/content` **stage a proposal rather than apply a change**. It
populates `tab.pendingReview = { proposedXml, baseXml, sourceLabel: 'AI draft' }` and leaves
`tab.xmlContent` untouched; the existing FR-045 surface renders the diff and the writer commits via
Accept. Specifically:

- **Always stage** when the incoming XML differs from `tab.xmlContent` — no heuristic exemptions,
  in any `documentMode`. A PUT identical to current content is a no-op (`status: 'no-change'`).
- **Remove** the `insertSection` suggesting-mode guard. Both API routes now stage rather than write,
  so the reason for it is gone. The "one pending review at a time" conflict check stays on both.
- **`POST /api/tabs/:id/save` refuses while a review is pending.** Since PUT no longer writes,
  save-after-PUT would otherwise push the pre-PUT document to Heretto silently.
- **Warn on Accept when marks are discarded.** `handleReviewAccept` commits with
  `lastUpdatedBy: 'api'`, which under the FR-056 bypass re-parses immediately and destroys live
  `TrackedTextNode` marks. Removing the `insertSection` guard makes that state reachable, so the
  discarded-count toast moves from `updateTabContent` into the accept path.
- **The FR-056 `suspendSync` bypass stays.** It is what makes Accept render in suggesting mode.

**Consequences** — One review model for every route that delivers AI-authored content: propose,
diff, accept. The writer always gets a chance to see what arrived before it becomes the document,
which is the behaviour the session log asks for.

The cost is a breaking contract change. Any caller that PUTs and then saves now persists stale
content unless the writer accepts first; the `saveTab` guard converts that from silent corruption
into a 400, and `API.md` (including the worked example and the "after writing via PUT, call save"
note at `:222`) must be corrected. No installed skill calls PUT today — the blast radius is ad-hoc
API use — but the contract is documented and must be re-documented, not just changed.

It also makes automated end-to-end writes deliberately impossible: a fully unattended
"draft → PUT → save to Heretto" pipeline can no longer complete without a human. That is the intent,
not a side effect. If an unattended path is ever needed it should be an explicit opt-out
(`?apply=1`) recorded as its own ADR, not a quiet return to write-through.

Two known rough edges accepted for this slice: while a review is pending the visual editor stays
live, so in **editing** mode a single keystroke drifts `xmlContent` and the accept-time drift guard
discards the proposal ("Re-send the request"); making the editor read-only while
`pendingReview` is set is the honest fix and is deferred. And the diff is **XML-level with
all-or-nothing Accept/Reject** — this decision does not deliver green insertions in the visual
editor or per-change review in the ChangeListPanel. That requires synthesising `TrackedTextNode`
marks from the diff (FR-058, dependent on FR-051's carrier) and is a separate decision.

**Alternatives considered** — **(B)** Keep PUT write-through and add opt-in review via `?review=1`
or a new `POST /api/tabs/:id/propose` (rejected: preserves the existing contract and needs no
`saveTab` guard, but makes the safe path the one you have to remember. The session log is explicit
that the writer should *always* get a review surface when AI content arrives; an opt-in flag means
the destructive default survives, and the route that skips review is the one an automated caller
reaches for first). **(C)** Stage a review only when the tab has content, applying immediately to a
blank tab (rejected — and it was the original FR-057 plan: the real workflow's base *is* a blank
skeleton, so the exemption removed the review surface from the primary use case. The proposed
`isBlankDocument` regex also matched every document, which would have made FR-057 a no-op; the
corrected regex would have been worse, correctly exempting exactly the scenario the feature exists
to serve. Heuristics about "is this document meaningful" earn their complexity nowhere here).
**(D)** Go straight to tracked marks (FR-058) and skip the diff surface (rejected for sequencing,
not merit: it is the better end state, but it depends on FR-051 and is Fable-weight, while this
reuses a surface that already ships. FR-058 supersedes the diff surface for whole-doc PUTs if and
when it lands).

---

## ADR-009 — Troubleshooting topics: flatten containers, group by `containerPath`, mark boundaries

**Date:** 2026-10-20 · **Status:** Accepted (implemented for P2-25 slice 1, ships in v0.9.7)

**Context** — DITA 1.3 troubleshooting topics nest body content two levels deeper than the other
three topic types: `<troublebody>` → `<condition>` and one or more `<troubleSolution>` wrappers, each
holding `<cause>` and `<remedy>`; `<remedy>` holds `<steps>`, `<steps-unordered>`, or
`<steps-informal>`. Verified against all 22 "Troubleshooting Topic" resources in the live Heretto
repository (2026-10-20); the backlog's `troubleshootingbody` never existed. The parser's body
selector (`taskbody, conbody, refbody, body`) did not match `troublebody`, so these topics opened
with an empty editor — silent data loss on the first keystroke-and-save.

The serializer (ADR-006) is a single parallel walk over DOM children and body-level Lexical nodes,
grouped where one DOM element maps to many Lexical nodes (`<section>` by its h2, `<dl>` by
`dlEntryIndex`). It has no notion of an element that both *contains* body-level content *and* has no
heading, nor of a wrapper (`<troubleSolution>`) that contains such elements.

Two pre-existing defects surfaced while building the fixtures, both invisible until now because no
fixture had the pattern:

- **BUG-25** — a `<p>` wrapping a block (`<p>text<ul>…</ul></p>`, which Heretto authors freely and
  which appears in most troubleshooting causes) was split on parse into a paragraph plus a list and
  then serialized as `<p>text</p><ul>`: wrapper attributes lost on an *unedited* round-trip. Only the
  `<p><dl>` special case was handled.
- **BUG-26** — Lexical merges adjacent same-type lists (`ListNode.transform()` →
  `mergeNextSiblingListIfSameType`, `@lexical/list` 0.16.0). A remedy's `<steps>` following another
  remedy's `<ol>` was swallowed on parse and re-emitted as an extra `<li>` of the first list.

**Decision**

1. **Flatten, don't nest.** `condition`, `troubleSolution`, `cause`, `remedy`, and `steps-informal`
   are parsed like `<section>`: their children become body-level Lexical nodes, an optional `<title>`
   becomes an h2. No new ElementNode containers in Lexical — the editor's flat body model, the
   ShortdescPlugin class mapping, and every existing plugin keep working unchanged.
2. **`originMap.containerPath`** records the chain of enclosing containers as `tag#ordinal`
   segments (`troubleSolution#1/remedy#0`), ordinal = index among same-tag siblings, merged onto
   each node's existing origin exactly like `dlEntryIndex`. The serializer groups consecutive nodes
   by the next path segment below the current base path and recurses into the matching DOM element
   (`patchContainer` → `patchBodyChildren` with the container's path as the new base). Container
   grouping takes precedence over h2/section and dl grouping, so a titled `<condition>` cannot
   swallow the following `<troubleSolution>`. Unconsumed container elements are **preserved, never
   deleted** — an empty `<cause/>` is legitimate authoring state and must round-trip byte-for-byte
   (consequence: deleting a whole cause in the visual editor does not propagate; use the XML pane).
3. **`DitaContainerBoundaryNode`** — a visual-only `DecoratorNode` emitted at the start of every
   `condition`/`cause`/`remedy` run. It renders the container's label (the author's only cue that a
   flattened structure exists), has `getTextContent() === ''`, is filtered out of every serializer
   walk, and — the structural reason it exists — sits between two lists so Lexical's merge transform
   never sees them as siblings (BUG-26 across containers). The class-level transform cannot be
   unregistered; a non-list sibling is the only reliable guard.
4. **`originMap.pWrapperId`** (BUG-25) — the block-split branch for `<p>` stamps every result with a
   per-parse unique id; the serializer groups the run and `patchPWrapper` partitions the DOM `<p>`
   into inline segments and block elements, patches blocks through the normal walk (wrapper grouping
   off, base path carried through), and rewrites an inline segment only when its whitespace-stripped
   text changed. If the Lexical run no longer matches the DOM shape (author restructured the
   paragraph) the wrapper is rebuilt from Lexical, keeping the `<p>`'s own attributes. `<p><dl>` keeps
   using the dl path (nodes carrying `dlEntryIndex` are excluded).
5. Supporting changes: `troubleshooting` accepted by `validateDitaXml`, the XML-pane root check, the
   tab-type badge, and the import-verification element lists; `steps-unordered` is a bullet list of
   `<step>`s in both directions; new lists created inside a `<remedy>` emit `<steps>`/
   `<steps-unordered>`, never `<ol>`/`<ul>`.

**Consequences** — Troubleshooting topics open, render with labelled Condition/Cause/Remedy
regions, and round-trip byte-stable (two fixtures: the smallest real Heretto topic and a synthetic
rich one with three solutions and all three step-list kinds). Edits land in the right container.
`<p>`-wrapped lists now survive in every topic type. The walk gained two grouping dimensions
(`containerPath`, `pWrapperId`) on top of `dlEntryIndex`; all three are "a run of body-level nodes
maps to one DOM element", and the pattern is now general enough that a fourth would be suspicious.

Known v1 limits (honest exclusions): deleting an entire container in the visual editor is not
propagated (preserved); `<responsibleParty>` and `<choices>` inside a remedy are preserved but not
rendered (unrecognized elements, 1 occurrence each in the repository); two adjacent same-type lists
*inside one container* still merge (BUG-26's general case, filed); only paragraphs get the container
bar class — lists and tables inside a cause rely on the boundary label.

**Alternatives considered** — **(B)** Custom Lexical ElementNodes for each container (rejected: every
plugin that walks `$getRoot().getChildren()` — ShortdescPlugin, SuggestionPlugin, the stats bar,
insert-section — assumes a flat body; nesting would be a rebuild of the body model for one topic
type). **(C)** Parse `troublebody` children only, treating containers as `DitaOpaqueNode`s
(rejected: that is the "visible but uneditable" failure mode the project left behind at v0.8; the
content *is* the point). **(D)** For BUG-26, subclass `ListNode` via node replacement to drop the
merge transform (rejected: Lexical registers the class transform under the node type, so the
original class's transform still runs for the same type; verified in `LexicalList.dev.mjs:1021`).
**(E)** For BUG-25, keep splitting and teach the serializer to re-wrap on the way out (rejected:
without an id tying the run to its source `<p>` there is no way to know which following blocks were
inside the wrapper versus after it).
