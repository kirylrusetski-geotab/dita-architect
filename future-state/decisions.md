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
rendered (unrecognized elements, 1 occurrence each in the repository); only paragraphs get the
container bar class — lists and tables inside a cause rely on the boundary label. (Two adjacent
same-type lists inside one container — BUG-26's general case — was fixed in v0.10.3, using the same
boundary-node device as decision 3's cross-container case, scoped to the one place the corpus showed
it: body level, not yet inside a container, since nothing in the corpus exercises that.)

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

**Amendment (2026-10-22, v0.10.2 — BUG-29) · Status: Accepted 2026-10-22 (Kiryl)** — `<entry>` and `<stentry>` are block
wrappers in the BUG-25 sense (decision 4). *Context:* two copies of `parseCellContent` (one per table
kind) model only `p, ul, ol, li, table, section, div` as cell blocks, so a `<note>`, `<dl>`, `<fig>`,
`<codeblock>`, or `<simpletable>` in a cell is flattened into the cell's inline paragraph; a cell `<p>`
gets no origin at all. The serializer pairs DOM `<p>` children with Lexical paragraphs **by position**,
and `CELL_WALK_TAGS` mirrors the parser's gap on purpose (BUG-35). The corpus has 13 such cells in 4 of
52 fixtures (`<image>`+`<p>` ×4, `<note>` ×4, `<p>`+`<dl>` ×3, `<p>`+`<note>` ×1, loose text+`<p>` ×1).
An unedited round trip writes the image into the `<p>` and drops its text; a cell note loses its `id`
and `<p>` on edit; edits to a cell `<dl>` or `<note>` are silently dropped (24 of 24 and 4 of 4 in the
edit fuzz). *Decision:* (1) **One cell parser** shared by both table kinds. Its blocks are
`p, ul, ol, note, dl, fig, codeblock, table, simpletable`, each parsed by the body's own
`traverseXmlElement` (so `<note>` → quote, `<dl>` → `dt`/`dd` paragraphs, `<fig>` → image node), plus the
legacy `li`/`div`, which stay opaque as before. A `<section>` in a cell is invalid DITA (0 in the corpus)
and its flatten has no identity in a cell, so it becomes an opaque node: preserved, not editable.
An inline `<image>` stays inline (a chip), as DITA allows it in an entry. (2) **Every cell paragraph is
stamped:** loose inline content → `{ tag: 'cell-inline' }`, a `<p>` → `{ tag: 'p' }`; an empty cell is one
`cell-inline` paragraph. (3) **One cell patcher** for both table kinds, modelled on `patchPWrapper`: the
DOM children split into inline segments and block runs (consecutive blocks, with the whitespace,
comments, and PIs between them), the Lexical children into `cell-inline` paragraphs and block runs. When
the two patterns match, each block run is walked by `patchBodyChildren` (note ↔ quote, dl grouping,
`<p>` wrappers, lists, codeblocks, and nested tables come for free, and blocks can be added or removed
inside a run) in a detached holder, so a new block lands before the following inline segment instead
of at the end of the cell; each inline segment is reconciled with the `segment` rules (ADR-010); a cell
that is a single inline run keeps today's fallback on a bail. When the patterns differ, the cell content
is rebuilt from Lexical, keeping the `<entry>`'s own attributes. As in the body, `<fig>` and opaque
blocks are preserved by the walk, not rewritten. (4) **Rebuild paths emit the same shape**
(`writeCellContent`, used by `buildRowEl`, `createTableFromLexical`, new simpletable rows, and the
rebuild above): `cell-inline` paragraphs as loose inline content, block runs through the walk on an empty
DOM (so a `<dl>` is re-created as a `<dl>`, not as `<p>`s), and a lone unstamped paragraph inline (today's
rule for new tables). (5) The `dt`/`dd` and note-type classes reach cell content too, so a cell `<dl>`
reads as a definition list. `CELL_WALK_TAGS` and the positional paragraph pairing are retired.
*Invariants* (`tests/sync/table-cells.test.ts`, written first): **T1** each shape above, unedited, is
byte-stable; **T2** an edit inside a cell block (note text, `dd` text, the `<p>` after an image, a
codeblock) changes only that text; **T3** an edit to loose inline text beside a block lands in place;
**T4** ordinary cells (one inline run; `<p>`s only; `<p>`+`<ul>`) are byte-identical edited and unedited;
**T5** `<stentry>` behaves as `<entry>`; **T6** a paragraph or list added to a cell is serialized, in
order, including before trailing loose text; plus BUG-35's S8, the mixed-content suite, the
byte-stability corpus, ADR-010 R1, FR-063, and the edit fuzz with its BUG-29 allowances removed.
*Alternatives:* (B) add the missing tags to `CELL_WALK_TAGS` and keep the positional pairing (rejected:
the pairing *is* the image + `<p>` bug — a chip paragraph is aligned with the `<p>`); (C) a new ADR-012
(rejected: this is decision 4's pattern applied to one more wrapper, and a new number would renumber the
Execution Plan's ADR-012–015).
*Implementation note (2026-10-22, v0.10.2).* (1) **`<dd>` is the same wrapper (BUG-40, found while
building this).** A `<p>` + `<dl>` cell exposed it: `patchDlElement` walked only a `<dd>`'s element
children, so a `<dd>` holding loose text gained a copy of that text as a new `<p>` on every serialize,
edited or not (`<dd>a1</dd>` → `<dd>a1<p>a1</p></dd>`), in any topic since ADR-006. No body-level fixture
had a text-only `<dd>`; the corpus's only 12 are in the BUG-29 cells. The parser also tagged a `<dd>`'s
loose text and a `<p>` in it alike (`dd`), the same ambiguity as cells. So the patcher is generic —
`patchMixedContent` / `writeMixedContent` over a `MixedWrapper` (the parser's block set, the inline-run
tag, and the walk with the wrapper's options) — used for `<entry>`/`<stentry>` (`CELL_BLOCK_TAGS`,
`cell-inline`) and `<dd>` (`DD_BLOCK_TAGS`, `dd`, `groupDl: false` + base path); a `<p>` in a `<dd>` is now
tagged `p`, and the `dd` class follows `dlEntryIndex`. `createDlFromLexical` writes `<dd>` content the
same way. (2) **Block runs, not single blocks, are the unit of alignment**, so adding or removing a block
inside a run is a walk, not a rebuild; the detached holder is what keeps an added block before trailing
loose text. (3) **Rebuild keeps non-recreatable blocks:** a figure, an opaque block, or a
`<note conkeyref>` is written by moving its source element back, matched by content (opaque XML, image
`href`, ref attribute), never by position. (4) **A block that parses to nothing** (an empty `<div>`)
becomes an opaque node, so both sides keep the same shape. *Verified:* `table-cells.test.ts` 99/99 (T1–T6
in both table kinds, plus BUG-40); full suite 69 files, 1689 passed, 4 skipped; edit fuzz on the same
1,405 edits 132 → 73 failures and 6 → 0 bails against the BUG-36 build (0 new, 59 fixed, 3 reduced to the
BUG-37 pattern), with the four BUG-29 allowances removed; the 73 left are BUG-26 (43) and the BUG-37
pattern (30). Byte-stability: the BUG-29 cells in all four fixtures round-trip; what remains is
re-attributed — `installing-the-go-anywhere` to BUG-30 alone, `altitude-notes-warehouse` to **BUG-41**
(`patchTableElement` rewrites `<tgroup cols>` from the first row on every serialize; that source says
`cols="1"` over two columns).

---

## ADR-010 — Inline reconciliation: patch inline content around preserved anchors

**Date:** 2026-10-20 · **Status:** Accepted 2026-10-20; **fully implemented** — slice A in **v0.9.9**,
slice B (the wrap UI) in **v0.10.0**, both 2026-10-21

**Context** — The Session 2 plan assumed the serializer "already consumes `originMap.inlineTag`
generically", so wrapping a selection would only need editor work. That is true only on the
*full-rewrite* paths (`createElementFromLexical`, `replaceElementContent` → `serializeInlineContent`).
The *patch* path — the one every existing element takes — decides whether an element changed from
three signals: normalized text, xref count, and the S2 format-run comparison, which deliberately
bails when any `inlineTag`-stamped sibling is present (`buildLexicalInlineRuns`). A wrap changes none
of the three. Probes run 2026-10-20 (throwaway tests, deleted; outputs recorded in the session):

- `<uicontrol>` wrap (split + token mode + stamp, exactly M1's parse shape) in a `<p>` and a `<cmd>`:
  **dropped** — output byte-identical to input, in all 9 cases tried (8 in a `<p>`, 1 in a `<cmd>`).
- `<xref>` wrap in a plain `<p>`: emitted, via the link-count mismatch → `replaceElementContent`.
- `<xref>` wrap — and the shipping **Insert Link** command, `$toggleLink` — in a `<p>` that also holds
  `<menucascade>` and `<ph keyref="prod" outputclass="x"/>`: emitted, but the full rewrite **deletes
  the `<menucascade>` wrapper and strips `outputclass`** (BUG-32, shipped behaviour today).
- `<xref>` wrap in a `<p>` containing an XML comment: **dropped** — `getNormalizedDomText` counts the
  comment's text, so the texts never match, and `patchInlineNodes` (which skips comments) then finds
  old = new and reports untouched (BUG-33).
- Typed text plus a wrap in the same element: text kept, wrap **dropped**.

The last case matters for the design: `SyncManager.masterXmlRef` is the *load-time* source, and every
visual edit patches a fresh clone of it. The serializer never sees "a wrap" in isolation — it sees the
cumulative difference between the load-time element and the current Lexical node, so "type a word,
then wrap it" must work. Table cells (`patchTableEntry`'s direct-text branch) and `<p>`-wrapper inline
segments (`patchPWrapper`, BUG-25) run their own text comparisons with the same blindness.

**Decision**

1. **One inline reconciler.** New module `sync/inline-reconcile.ts` exporting
   `reconcileInline(domParent, domNodes, lexicalNode, doc, originMap) → 'untouched' | 'patched' | 'bail'`.
   It replaces "decide whether changed, then rewrite everything" with "keep what still matches,
   rewrite only the changed run".
2. **Units.** Both sides become sequences of units with a *signature*:
   - Lexical inline children: plain text (no stamp, no b/i/code); stamped text (`inlineTag` +
     `inlineAttrs`); code-format text → `codeph`; bold/italic text → `b` / `i`; `LinkNode` → `xref`
     (URL + `inlineAttrs` + its own child units); `DitaPhRefNode` chip (ref type + value + text).
     Visual-only nodes are skipped, as everywhere else.
   - DOM children: text nodes (normalized exactly as the parser does — newline-run collapse, edge
     trim — with a normalized→raw offset map so splits land on raw bytes); inline elements; and
     **fixed points** that have no Lexical presence: PIs (Heretto review markers), comments, and the
     block-child boundaries of a `<note>` whose `<p>` children the parser concatenates.
   - An element's *expected units* come from one function, `expectedUnits(el)`, a mirror of
     `parseInlineElement`. This generalizes the mirror S2 already keeps (`buildDomInlineRuns`), which
     is retired in its favour.
3. **Anchors.** A longest-common-subsequence match between DOM elements (by expected units) and
   Lexical units (signature + text). Matched DOM elements are **anchors and are never touched** —
   that is what keeps `<menucascade>`, `<ph … outputclass>`, `<codeph outputclass>`, and every
   attribute the parser does not model byte-exact.
4. **Gaps.** Between anchors, if the Lexical units are plain text equal to the DOM gap's normalized
   text and the gap holds no unmatched element, the gap is untouched. Otherwise take the common prefix
   and suffix over units — text-node characters may be split at any offset; **element runs are
   atomic** (an edit inside `<uicontrol>Save</uicontrol>` replaces that one element, it never splits
   into two) — keep prefix and suffix raw bytes, and replace only the middle with
   `serializeInlineContent` output for the middle Lexical units. Adjacent DOM text nodes are merged
   afterwards, so wrap → unwrap returns the original bytes.
5. **Bail, loudly.** If a fixed point falls strictly inside the middle region, or the mirror disagrees
   with the Lexical text (drift), return `'bail'`: the existing path (`patchInlineNodes` /
   `replaceElementContent`) runs unchanged and a one-shot console warning fires (the
   `warnTrackedTextReachedSerializer` pattern). The legacy path survives **only** as the bail path; an
   anti-entropy BACKLOG row tracks retiring it once the bail cases are covered.
6. **Call sites.** `patchElementContent` runs the reconciler **before** its text-equality fast path
   (that fast path is what hides a wrap) for direct-inline elements — `p`, `cmd`, `li`, `dt`,
   `title`, `shortdesc`, the prereq family, a `<note>` (block boundaries as fixed points), `entry/p` —
   plus `patchTableEntry`'s direct-text branch and `patchPWrapper`'s inline segments.
7. **Editor representation (slice B).** A wrap produces exactly the tree the parser would produce for
   that element, so a later re-parse is a no-op: `uicontrol` = token + bold + stamp; `wintitle` =
   token + italic + stamp; `term`, `filepath`, refless `ph` = token + stamp; `codeph` = code format
   only, no stamp (identical to what the parser produces; the toolbar has no code toggle today, only
   Bold and Italic); `xref` = `LinkNode` + `inlineAttrs`
   `{format, scope}`. Code lives in `lib/inline-wrap.ts` and an `InlineWrapPlugin` mounted inside
   `SyncManager` (it needs `useSyncContext()`, as `InsertElementPlugin` does — the Toolbar renders
   outside the provider); the Toolbar and shortcuts dispatch `WRAP_INLINE_COMMAND` /
   `UNWRAP_INLINE_COMMAND`. **Wrap and unwrap always create new nodes and never delete or mutate an
   existing key's `originMap` entry**: undo restores old node keys, and their stamps must still be
   valid. Refused with a toast: collapsed selection, a selection crossing a block or overlapping an
   existing stamped run, link, or chip, mixed formats, inside a codeblock, and suggesting mode (I6).
8. **Sequencing.** Slice A (the reconciler, serializer-only) ships first as **v0.9.9**: it fixes
   BUG-32 and BUG-33, which exist today independent of the wrap UI. Slice B (the wrap UI) ships as
   **v0.10.0**.

**Invariants** (each a test, written before code)

- **R1** No false rewrites: the byte-stability corpus is unchanged — hand-written fixtures green, the
  sampled corpus' `KNOWN_FAILURES` set identical — and `reconcileInline` returns `'untouched'` for every
  inline-content element of every corpus fixture on an unedited parse (asserted directly, not only
  through the end-to-end round trip).
- **R2** `round-trip.test.ts` and the S2 suites stay green.
- **R3** BUG-32: Insert Link (`$toggleLink`) beside `<menucascade>` and `<ph keyref outputclass>`
  leaves both byte-identical.
- **R4** BUG-33: a link added in a paragraph holding a comment is emitted; the comment is kept in place.
- **R5** Typed text plus a wrap in the same element: both are emitted.
- **R6** A text edit inside `<uicontrol>` keeps one element with its attributes.
- Slice B: the plan's I1–I6, with I1 stated relative to the pre-wrap serialization ("the output equals
  the pre-wrap output with the selected substring replaced by `<tag>…</tag>`"), plus **I7** undo/redo
  of a wrap and an unwrap serializes to the matching state.

**Consequences** — Any inline structure change — wrap, unwrap, link insert/remove, formatting toggle,
and v0.11's Insert Variable (its I4) — serializes surgically, with unchanged neighbours byte-exact.
Intended behaviour change: a bold/italic toggle in a paragraph that also holds a stamped element now
serializes (today S2 bails and the toggle is lost). The mirror must track `parseInlineElement`; R1's
direct assertion over the corpus is the drift guard. Known limit: an edit *inside* a container inline
(the text of a `<uicontrol>` within `<menucascade>`) still flattens the container, as today — filed
as BUG-34. Rules out: wrapping a selection that crosses an existing inline element (content-model
territory, P2-29/P2-37).

**Alternatives considered** — **(B)** Detect any signature change, then rewrite the whole element
(rejected: the probe shows the full rewrite deleting `<menucascade>` and attributes; it would be
viable only after making `serializeInlineContent` lossless, a larger change). **(C)** Record wrap
operations and replay them at serialize (rejected: state outside the tree that must be replayed
against the load-time master on every serialize and survive undo/redo). **(D)** Parse-time identity
stamps (`originMap` remembers the source DOM child index) instead of a mirror (rejected for now:
format-only nodes — codeph, b, i — merge with neighbours and lose their keys, and it widens the
`originMap` contract; the mirror already exists for S2). **(E)** Splice only when the text is
unchanged (the first-cut option, rejected: the load-time master makes mixed text-plus-wrap edits the
common case).

**Implementation note (slice A, 2026-10-21)** — Two refinements over the text above. (1) Decision 2's
"mirror of `parseInlineElement`" became a **shared scanner**: `sync/inline-units.ts` produces atoms,
`parseTextNodes`/`parseInlineElement` build Lexical nodes from them, and the reconciler reads them, so
the expected units cannot drift from the parser by construction; R1's direct assertion still runs as
the guard for Lexical-normalization assumptions (merge of adjacent simple text, removal of empty
simple text) that the scanner reproduces by hand. (2) R1 asserts zero `patched` only for fixtures that
are byte-stable today; the one BUG-29 fixture already hands the reconciler a genuinely different pair
(`patchTableEntry` aligns a DOM `<p>` with the image-chip paragraph), which is the filed parser bug,
not a reconciler fault. The condition is computed, so R1 tightens as BUG-28/29/30/31 are fixed.

**Implementation note (slice B, 2026-10-21)** — Decision 7 as built, with what the build added. (1)
Refusals are a closed set with author-facing copy (`WRAP_REFUSAL_MESSAGES`): `collapsed`, `cross-block`,
`overlap` (any stamped run, link, chip, existing `<codeph>`, or non-plain node in the selection), and
`formatted` — v1 also refuses bold/italic text, because a wrap would silently drop that formatting.
(2) `Insert Link` is the `<xref>` wrap: it dispatches `WRAP_INLINE_COMMAND`, so format/scope land in
`originMap` and the same refusals apply; inside an existing link it retargets via `$toggleLink`
(previous behaviour) and leaves that link's format/scope alone, since changing them would edit an
existing key's entry. When only `scope` is given, `format` is inferred from the href so a scoped xref
always carries one. (3) The shortcut handler sits at `COMMAND_PRIORITY_HIGH` on `KEY_DOWN_COMMAND`:
Lexical's `isUnderline` ignores Shift, and `KEY_DOWN_COMMAND` is dispatched before its built-in key
checks, so claiming ⌘⇧U there is the only way to keep it from also underlining. (4) FR-063 shipped in
the same release as the user-visible guard for a reconciler bail; its check runs even when the XML did
not change, which is the shape a dropped wrap has. Known v1 limit beyond the ADR: `<term>`,
`<filepath>`, and refless `<ph>` render unstyled, so their wraps are invisible in the visual editor
(FR-068).

**Amendment (2026-10-22, v0.10.2 — BUG-34 + BUG-36)** — Decision 4 said element runs are atomic and a
container inline's units are clamped together, which the build implemented by splicing at the
**outermost container**. That was wrong in three ways, all content loss on ordinary edits: replacing one
`<uicontrol>` in a `<menucascade>` removed the whole cascade, including its *other* `<uicontrol>`, which
was an unchanged anchor outside the gap (BUG-34); text inserted inside an `<li><p>` that held an element
was placed after the `<p>` (words reordered); and the `<p>`'s attributes were lost (BUG-36). Corrected:
(1) **splice level** is the deepest node containing the parent of every changed item, so a change inside
one element of a container is spliced inside the container; (2) the clamp uses real DOM ancestry — a
partly covered element is taken whole *unless it contains the whole change*; (3) **never remove an element
that holds a node outside the changed run** (anchors or another gap's content) — bail instead;
(4) **gaps split per unit** when both sides have the same number of units of matching kinds, because
cumulative edits against the load-time master often put two independent changes in one gap;
(5) **insertions** go to the shallower level between two neighbours at different depths, except after
text, where they stay with the text (left-affine), and a pure insertion **slides left** across characters
equal to its last one so typing that continues a word stays in that word's element; (6) links anchor on
their **identity** (href + attributes) and a link whose text changed is reconciled *inside* its `<xref>`,
so its attributes stay byte-identical; a rebuilt link never writes an empty `href`. Verified by a new
opt-in edit fuzz over the corpus (1,405 edits: 0 new failures vs v0.10.1, 30 fixed). Residuals filed:
BUG-37 (`<b>`/`<i>`/`<codeph>` text is still an atomic element piece), BUG-29 (cell `<dl>`/`<note>`).
(7) **BUG-42** (found in the same release's native smoke, present since slice A): a pure insertion in a
gap that holds **no DOM item at all** — a run Lexical cannot merge into a neighbour, such as bold text
typed right after a `<uicontrol>`, between two anchors — had no neighbour to position against and was
appended at the end of the element (`…</menucascade> now.<b> As</b>`). Such a gap now takes the anchors
either side of it as its neighbours, with the same level rules; a gap that holds any item, or a `<note>`
block boundary, is unchanged (the fuzz's 73 failures and 0 bails are line-for-line identical). Pinned by
C9 in `inline-containers.test.ts`.

---

## ADR-011 — Sections are identity-carrying containers, matched by ordinal

**Date:** 2026-10-21 · **Status:** Accepted 2026-10-21 (Kiryl); **implemented in v0.10.1** (BUG-28 + BUG-35)

**Context** — `<section>` is the most common wrapper in real topics and the serializer has no identity
for it. The parser flattens a section's children to body-level nodes; a titled section's `<title>`
becomes an h2, and the serializer re-groups "an h2 plus every node until the next h2" into a section
group, matched to DOM sections **in order**. An untitled section leaves no trace at all. Probed
2026-10-21 (throwaway tests, deleted):

- **Untitled section** (`<section><table>…</table></section>`): the DOM section matches nothing, is
  deleted, and its table is recreated at body level — and the recreated table drops the list in its
  cell (BUG-35: `ul` 1 → 0). Three sampled real topics; `altitude-api-reuse.dita` loses 3 `<ul>`,
  11 `<li>`, and 12 `<p>` (13,088 → 6,777 chars) on an *unedited* round trip, which FR-063 now reports.
- **Titled sections, author deletes the first one** (title + body of `s1`): `s1`'s element is kept
  and `s2`'s content is patched into it; `s2` and its `id` are gone. Order, not identity.
- **Empty conref sections** (`reference/go10-regulatory-statements.dita`: seven
  `<section conref="…Regulatory_Statements.dita#…"/>`): no editor nodes, so the body is skipped and
  they survive only by accident. Adding one paragraph deletes all seven.

ADR-009 solved the same shape for troubleshooting containers (`condition`, `cause`, `remedy`,
`troubleSolution`, `steps-informal`; extended to `prereq`/`context`/`result`/`postreq` by BUG-27):
each produced node carries `originMap.containerPath` (`tag#ordinal` segments) and the serializer
groups by path and patches the preserved element in place. But it matches a group to the next DOM
child **with the same tag**, not the same ordinal, and it never deletes an unconsumed container — so
it shares the deletion problem in milder form (deleting a whole cause in the editor is not written
back, a documented ADR-009 limit).

**Decision**

1. **`<section>` joins the container set.** The parser flattens it like a troubleshooting container:
   every produced node gets a `containerPath` segment `section#N` (N = ordinal among the parent's
   `<section>` children), titled or not; the title stays an h2. `patchContainer` already patches an
   optional leading h2 into `<title>`, and `createContainerFromLexical` already writes one.
2. **Match containers by ordinal, not by tag.** Before the walk, map each direct container child of
   the parent to its `tag#ordinal` segment (computed on the untouched clone, so later removals cannot
   shift ordinals). A container group patches exactly the element its segment names. This applies to
   every container, so it also fixes the troubleshooting look-ahead's same-tag matching.
3. **Delete by provenance.** After the walk, an unconsumed container is **removed** when the parse
   produced editor nodes for it — some `originMap` entry carries its path or a descendant path (the map
   keeps entries for deleted nodes) — because then the author deleted all of its content. It is
   **preserved** when the parse produced nothing for it: empty `<cause/>`, a conref'd
   `<section conref/>`, a section holding only markup the parser ignores. This lifts ADR-009's
   "deleting a whole container does not propagate" limit for every container.
4. **New sections stay new.** An h2 the author types (no `containerPath`) still starts the legacy
   h2 section group, which now **stops at the first node that has a `containerPath`**, so a new
   heading can never swallow an existing section, and is always *created* rather than patched into an
   existing `<section>` element.
5. **Untitled sections get a boundary marker.** The `DitaContainerBoundaryNode` gains a `section`
   kind, emitted only for untitled sections: it is the author's only cue that a wrapper exists, and it
   keeps Lexical from merging a list at the end of one untitled section into a list at the start of
   the next (BUG-26's cross-container case, as for troubleshooting). Titled sections already show
   their h2.
6. **BUG-35 rides along.** Table cell serialization (`buildRowEl`, `createTableFromLexical`,
   `patchTableEntry`'s rewrite and `<p>`-parallel branches) emits non-paragraph cell children through
   `createElementFromLexical` instead of dropping them, so a cell list survives a rebuild and a list
   the author adds to a cell reaches the XML.
7. **Author-created blocks inherit their container.** *(Added at acceptance, found while writing the
   tests: without it, decision 1 would regress titled sections, because a paragraph the author adds
   inside one — Enter at the end of its last paragraph, or the block `+` menu — has no
   `containerPath` and would land outside the section, where the old h2 grouping happened to keep it
   inside. ADR-009 containers already had this gap.)* The parser stamps every top-level node it
   produces with its real `bodyIndex` (≥ 0; until now the field was declared but never set, and nothing
   reads it). In the walk, a top-level node with neither a `containerPath` nor a `bodyIndex ≥ 0` was
   created by the author, and it joins the container of the nearest preceding node that has one —
   unless it is an h2, which starts a new section (decision 4) that the following author-created nodes
   join. Grouping-only: no `originMap` entry is written, so undo needs nothing.

**Invariants** (each a test, written before code)

- **S1** Every corpus fixture that is byte-stable today stays byte-stable, and the inline-reconcile
  R1 and FR-063 corpus suites stay green.
- **S2** The three BUG-28 fixtures leave `KNOWN_FAILURES` or are re-attributed to a remaining bug
  with evidence; FR-063 reports nothing for them.
- **S3** An edit inside an untitled section lands in that section; its wrapper, `id`, and `class`
  are byte-identical.
- **S4** Deleting every node of one section removes exactly that section; other sections keep their
  ids and content (the `s1`/`s2` probe).
- **S5** Adding content anywhere in the go10 topic keeps all seven conref sections byte-identical;
  an empty `<cause/>` is still preserved.
- **S6** A new h2 typed before, between, or after existing sections creates a new `<section>` and
  leaves the existing ones byte-identical.
- **S7** Two adjacent untitled sections, the first ending and the second starting with a `<ul>`,
  round-trip as two lists in two sections.
- **S8** BUG-35: a cell list survives a forced table rebuild; a list added to a cell is serialized.
- **S9** Troubleshooting suites stay green; deleting a whole non-empty `<cause>` now removes it
  (ADR-009's limit lifted — the one intended behaviour change for existing containers).
- **S10** A paragraph the author adds after the last paragraph of a titled section, an untitled
  section, or a `<cause>` is written inside that container; a block added after a body-level
  paragraph stays at body level.

**Consequences** — Section edits become identity-safe in every topic type, and `<section>` stops
being special-cased in the walk: one mechanism (container + ordinal + provenance) covers sections,
troubleshooting containers, and the task-section wrappers. The legacy h2 section group survives only
for author-created headings. Deleting a whole container in the visual editor now propagates
everywhere. Risks: provenance depends on `originMap` keeping entries for deleted nodes (true today:
nothing prunes it; a future pruning change must keep container provenance); `<example>`,
`<sectiondiv>`, and `<bodydiv>` still have no identity (opaque or unparsed today — out of scope, to
be checked against the corpus).

**Alternatives considered** — **(B)** Give only untitled sections an identity and keep h2 grouping
for titled ones (rejected: the `s1`/`s2` probe shows titled sections have the same order-not-identity
flaw). **(C)** Keep "never delete a container" and add sections to it (rejected: deleting a section
in the editor would silently stop working — a regression from today for titled sections). **(D)**
Decide deletion from the DOM ("non-empty in source") instead of `originMap` provenance (rejected: a
section holding only markup the parser ignores is non-empty but produced no nodes, so it would be
deleted the first time anything else is edited). **(E)** Custom Lexical ElementNode for sections
(rejected for the reasons ADR-009 alternative B gives: every plugin assumes a flat body).

**Implementation note (2026-10-21, v0.10.1)** — Refinements the build and its tests forced, each caught
before release. (1) **Provenance ignores boundary markers**: the parser emits one for every
condition/cause/remedy, so an empty `<cause/>` looked like deleted content and was removed.
(2) **The walk steps past a container that produced no content** (empty, conref'd) instead of placing
groups before it; otherwise a paragraph after a nodeless container would be recreated in front of it
and the real one deleted. (3) **A task section is a container only in its block-child form**, decided by
the parser's own `BLOCK_CHILD_TAGS` (now exported) — a direct-text `<result>` treated as a container
was skipped and then duplicated. (4) **`patchDlElement` threads the base path into each `<dd>` walk**:
`<dd>` nodes carry the enclosing container's path, and at base `''` the walk re-wrapped them in a new
container — a latent ADR-009 bug for any `<dl>` in a cause or remedy. (5) **BUG-35's cell walk sees only
the blocks the cell parser models** (`p`, `ul`, `ol`, `table`, `section`); a `<note>` in a cell has no
node (BUG-29) and would otherwise be deleted as unconsumed, and the pre-existing paragraph-parallel path
is kept whenever neither side has a list. (6) Decision 5's boundary marker is emitted only for untitled
sections **with element children**, so empty and conref'd sections stay invisible as before. (7) The
order-based `patchSection` / `patchSectionFromHeading` were removed: every source section is a container
group, and a legacy h2 group is always new. Native smoke: untitled section kept `id`/`outputclass`,
Enter inside a titled section stayed inside, a cell list grew in place, a conref section survived, and
a titled section deleted heading-and-all was removed while its neighbours stayed byte-identical.

---

## ADR-012 — The serializer re-spells unchanged markup from the source

**Date:** 2026-10-27 · **Status:** Accepted 2026-10-27 (Kiryl); **implemented in v0.10.4** (BUG-31). Took the
next free number, as ADR-011 did: the Execution Plan's ADRs for Sessions 4–7 are now ADR-013–016.

**Context** — `serializeLexicalToXml` patches a clone of the load-time DOM and then writes the **whole**
document with one `XMLSerializer.serializeToString` pass. The DOM keeps the document's meaning but not
its spelling, so the serializer imposes its own spelling everywhere, including regions no edit touched.
Probed 2026-10-27 over the 8 sampled real topics that `byte-stability.test.ts` lists for BUG-31 (a
token-level diff of each unedited round trip, throwaway): exactly two kinds of drift, nothing else.

- **Empty elements**: `<keyword class="- topic/keyword "></keyword>` and `<prodname …></prodname>` in
  `<prolog><metadata>` come back as `<x/>` (7 topics, 1–5 places each). The parser never reads the
  prolog; nothing changed there but the bytes.
- **Character references**: `&#160;` in body text comes back as the literal character
  (`reference/platform-terms-and-definitions.dita`, one place, in a paragraph that was not edited).

The same mechanism also re-spells attribute quoting and spacing (`class='x'`, `<p  a="1" >`), CRLF
line ends, and `&gt;` / `>` choice — none in the corpus today, but common in hand-edited XML. Gate 1
("byte-stable for unedited content") is unreachable for any such topic while the final pass is a
whole-document serialize. No information is lost, so this was never Blocking-now; but every save of
an untouched topic shows the author (and Heretto's history) changes they did not make.

The original fix direction (BACKLOG) was to leave untouched regions as literal source substrings, as
FR-045's `lib/xml-insert.ts` string splice does. Tracking "untouched" through the patch functions would
mean every patch path reporting the DOM ranges it changed, with source offsets the DOM does not have
(`DOMParser` records none), and a missed report would duplicate or drop source text.

**Decision** — Keep the patch pipeline and the whole-document serialize exactly as they are, and add one
last pass, `restoreSourceSpelling(output, source)` in a new `sync/source-spelling.ts`, that puts the
source's spelling back wherever the markup is unchanged:

1. **Tokenize** both strings into markup tokens: start/empty tag, end tag, text run, comment, PI, CDATA,
   DOCTYPE. A tokenizer failure on either side (malformed markup the regexes do not model) returns the
   output unchanged.
2. **Canonicalize** each token to what it *means*: a tag is its name plus its attributes in order, with
   decoded, normalized values (order is kept because XMLSerializer keeps it, so a reordered tag is a
   real change to the output and keeps the serializer's spelling); `<x/>` is the two canonical
   tokens of `<x></x>`; a text run is its decoded text with CRLF folded to LF; a comment/PI/CDATA/DOCTYPE
   is its raw text with CRLF folded.
3. **Align** the two canonical streams: common prefix and suffix first (an unedited topic is one linear
   prefix match), Myers' O(ND) diff on the middle, with a cap on D past which the middle keeps the
   output's spelling.
4. **Emit**, walking the output's tokens: a run of output tokens whose canonical tokens align to a
   consecutive run of source canonical tokens covering **whole** source tokens is written as that exact
   source substring; anything else is written as the serializer wrote it. A source `<x/>` that gained
   content therefore cannot be emitted for the output's `<x>` (it covers only half of the source token),
   so new content is never written after a self-closed tag.
5. **End of file**: when the output ends on the source's last markup token, the source's trailing
   whitespace is appended (the DOM keeps no text after the root element). This removes byte-stability's
   one declared normalization.

The safety property is structural: anything emitted from the source is canonically equal to the output
token(s) it replaces, so the pass can change spelling, never content. A test seam
(`setSourceSpellingObserver`, the `setReconcileObserver` pattern) hands tests both strings.

**Invariants** (each a test, written before code)

- **B1** Every corpus fixture round-trips byte-identical unedited, including the 8 BUG-31 fixtures;
  `KNOWN_FAILURES` is empty and the EOF-whitespace normalization is removed from `byte-stability.test.ts`.
- **B2** The pass never changes the document: for every edit-fuzz edit, the output before and after
  the pass parse to the same tree (compared through `XMLSerializer`).
- **B3** After an edit elsewhere, untouched markup keeps its source spelling: a prolog `<keyword></keyword>`,
  an `&#160;` in another paragraph, an `&#160;` in an unedited text run of the edited paragraph, and the
  edited paragraph's own start tag (`<p  class='x' >`).
- **B4** An edited text run is written in the serializer's spelling (its `&#160;` becomes the
  character) — the documented limit, since a changed run has no source token to borrow from.
- **B5** Content added to a source-self-closed element is written as `<x>…</x>`, never `<x/>…`.
- **B6** Malformed or unmodelled input on either side leaves the serializer's output unchanged.

**Consequences** — Gate 1 becomes exact: unedited means byte-identical, with no declared normalization.
Edits show in a diff as only what changed, in Heretto's history too. The patch functions are unchanged,
so this cannot reintroduce any of the walk bugs ADR-006/009/010/011 fixed. Costs: a tokenize + canonicalize
of the output on every serialize (the source side is cached with the parsed DOM in `XmlMetaCache`), and
a diff whose cost grows with how much of the document differs from the load-time master (edits
accumulate against it). Limits: a changed text run, or a tag whose attributes changed, takes the
serializer's spelling; entities other than the five XML ones and numeric references are not decoded, so
a source using them keeps the serializer's spelling for that token (the parser would reject such a
document without its DTD in any case).

**Alternatives considered** — **(A)** Splice source substrings for untouched DOM subtrees (the BACKLOG
direction): needs source offsets per DOM node, which `DOMParser` does not provide, so it means a second,
offset-tracking XML parser kept in sync with the browser's — and every patch path reporting what it
touched. Rejected: far larger, and a missed report corrupts content instead of spelling. **(B)** A custom
XML serializer that remembers source spelling per node: same offset problem. **(C)** Targeted
post-processing (`<x/>` → `<x></x>` when the source did that; re-encode U+00A0 as `&#160;`): has to guess
per token and is wrong whenever source spelling is mixed (some `<x/>`, some `<x></x>`). Rejected: an
alignment against the source answers per token, so it never guesses.

**Implementation note (2026-10-27, v0.10.4)** — Built as decided; three refinements the tests forced.
(1) **Attributes stay in source order** in the canonical form (the draft sorted them): XMLSerializer keeps
order, so a sorted form made a reordered tag look unchanged and the B2 tree check (order-sensitive)
caught it. (2) **An alignment pair is used only when its two canonical entries are equal**, so the safety
property holds even against a bug in the diff. (3) **The diff keeps only the window of diagonals each
step reads** (O(D²) memory, not O(D·(N+M))). Measured: the pass ran on all 1,407 edit-fuzz edits and
re-spelled the output of 608, with the same tree every time (B2); a seeded randomized test (200
deletions, insertions, and content changes over mixed spellings) gets every byte outside the change from
the source; under 1 ms per pass on the largest real fixture (25.6 KB), about 3 ms on a 200 KB document,
8.9 ms with 620 of its 1,240 paragraphs edited (jsdom). **Scope found in the native smoke:** "the source"
here is the editor's master — the XML as loaded. Every load path runs `formatXml` before that point
(BUG-45), so the master is already a re-indented copy of what Heretto holds; this ADR makes the serializer
exact relative to the master, and BUG-45 is the remaining gap to Heretto's bytes.

**Amendment (2026-10-27, BUG-45 — accepted by Kiryl: "keep it verbatim")** — *A topic opens exactly as its
source has it.* Every load path (`lib/native-api-bridge.ts` load-content, `hooks/useExternalLoad.ts`,
`hooks/useHerettoCms.ts` open and refresh) used to run `formatXml` before the XML became the tab's content
and so the serializer's master. That was not cosmetic: measured over the corpus, the editor showed
different text for 7 of 52 fixtures (5 real topics — e.g. "refer to Installation overview." → "refer to
Installation overview  ."), and constructed cases showed "H<sub>2</sub>O" → "H 2 O", doubled spaces around
mid-sentence review PIs, and a `<codeblock>` losing its first-line indentation — all written back to
Heretto on save. Decisions: (1) **loading never formats**: the tab's content and `savedXmlRef` are the
source bytes, so with this ADR an unedited save sends Heretto its own bytes and an edited save differs
only by the edit; (2) **formatting is the author's action only** (Format button, Format Document), and
**`formatXml` is content-safe**: it moves whitespace only between the children of an element that holds
no text of its own and whose element children are all known block elements (an `<image placement="break">`
counts as one), copies every other element verbatim — preformatted elements and `xml:space="preserve"`
always — and returns malformed input unchanged. Accepted cost: Heretto topics often arrive as a few very
long lines; the XML pane's word-wrap toggle and the Format button cover it. Invariants (tests first, 31 of
them red): **B7** each of the four load paths keeps the source bytes in `xmlContent` and `savedXmlRef`;
**B8** for every corpus fixture `formatXml` leaves the editor's text unchanged, keeps every text-holding
element byte-identical, and is idempotent; **B9** it still lays block structure out one element per line;
**B10** an API insert into an unformatted topic changes only the insertion point. `compareXml`'s first
tier (`formatXml(a) === formatXml(b)` → "formatting only") becomes stricter, never looser: two documents
whose text differs can no longer format equal.

---

## ADR-013 — A connected map's key registry: the whole mapref tree, DITA precedence, view-only chips

**Date:** 2026-10-27 · **Status:** Accepted 2026-10-27 (Kiryl: whole tree, no three-level cap; the chip
extension is Session 4's first step, filed as BUG-46) — Execution Plan Session 4, P2-27/FR-035 + FR-066

**Context** — Keyref and conkeyref chips cannot say whether their key resolves, cross-file xrefs are
never checked, and inserting a variable means typing `<ph conkeyref="key/id"/>` in the XML pane. FR-035
scoped a fix on 2026-04-10 from the Altitude User Guide alone; before designing, every map in the live
tenant was read (2026-10-27, throwaway scripts, read-only: 899 folders, **449 maps**, 0 fetch or parse
errors). What the maps actually do, against what FR-035 assumed:

- **Keys live on any topicref-class element.** Of 1,878 key-defining elements, 133 are `<keydef>` and 33
  `<glossref>`; **1,707 (91%) are a plain `<topicref keys>`**, 5 a `<topicsetref>`. The User Guide root's
  18 keys include 2 `GLOS-*` keys on plain `<topicref>`s — a `<keydef>`/`<glossref>`-only loader finds 16.
  12 `@keys` values carry more than one name.
- **Every reference is a relative path.** All 726 submap references are relative hrefs (0 UUIDs, 0
  absolute); 2 are `<topicref format="ditamap">`, not `<mapref>`; 1,075 hrefs climb with `..`, often above
  the map's own folder (`../Data_Dictionary/…`). The REST API has no path lookup, but every folder's XML
  carries `parent-folder-id` and a `<children>` listing (name → UUID), and a resource's metadata carries its
  `folder-uuid` — so a path resolves one folder at a time.
- **Trees are deeper than three levels.** Submap depth below the connected map: 214 maps 0, 129 at 1, 67 at
  2, 24 at 3, **9 at 4, 6 at 5**. The production Altitude Help Center map is depth 5 (84 maps in its tree);
  the largest tree is 164 maps. FR-035's three-level cap came from one chain (root → variables-within-
  variables → variables) and would cut 15 real trees short, the Help Center among them. 0 cycles; 7
  referenced submaps do not exist (sandbox/archive leftovers).
- **Keys are defined more than once.** 10 trees define some key twice with different targets — the Help
  Center map 18 times (the `Altitude_Copy` warehouse redefines every Altitude key one level deeper). Which
  definition wins depends on traversal order, so the rule must be the spec's, not a guess.
- **Key scopes exist but are rare** — 5 `@keyscope`s in 2 maps; one map defines `checking-vehicle-eligibility`
  in each of its three scopes.
- **No text-only keys** (0 `<keydef>`s with `<keyword>` and no href). Variables are conkeyref targets in
  warehouse topics: `@id`-carrying `<ph>` mostly, also `<uicontrol>`, `<wintitle>`, `<keyword>`, `<note>`.
- **Most variable references are invisible today.** The scanner makes a chip only of `<ph>`/`<term>` with a
  ref; `<keyword conkeyref/>` (37 in the corpus), `<uicontrol conkeyref/>`, `<wintitle conkeyref/>` parse to
  an *empty* text node — byte-stable, kept on edit (probed), but nothing on screen. A chip state cannot be
  shown on them, and FR-066 would insert something the writer cannot see.

DITA 1.3 key precedence (spec, "Core concepts for working with keys"): the effective definition is the
first in a **breadth-first** traversal of the map tree — the shallowest map wins, document order within a
map — "so higher-level map authors can override keys defined in referenced submaps"; a child scope's keys
are addressable from the parent as `scope.key`.

**Decision**

1. **Path resolution — `lib/heretto-path.ts`.** `resolveHerettoPath(href, folderUuid)` → `{ uuid, name,
   folderUuid } | null`: drop the fragment, walk `..` through the folder's `parent-folder-id`, named
   segments through the folder's `<children>`, all listings through the existing `herettoFolderCache`
   (5-minute TTL). One resolver serves maps, conkeyref targets, and cross-file xrefs. (The image resolver
   keeps its breadcrumb-based `ancestorUuids` walk; moving it onto this resolver is filed as debt, not done
   here.)
2. **Loader — `lib/heretto-map-loader.ts`.** `loadKeyRegistry(mapUuid)` fetches the map's metadata (name,
   `folder-uuid`) and content, then walks the tree **breadth-first, level by level** (a level's maps fetched
   in parallel): every element with `@keys` defines each whitespace-separated name; every `<mapref>` or
   element with `format="ditamap"` and an `@href` is a submap, resolved against *its own map's* folder. No
   fixed level cap: a visited set stops cycles, and a safety cap of **10 levels and 300 maps** (twice the
   largest real tree) stops runaway structure — reaching it is reported, never silent. A submap that cannot
   be resolved or fetched is skipped and counted; only the connected map itself failing fails the connect.
3. **Precedence.** First definition in that breadth-first, document-order walk wins; later definitions of the
   same name are kept only as a count. Keys inside an element with `@keyscope` register as `scope.key` (how
   the parent scope addresses them) and also under the bare name when no unscoped definition exists, marked
   with the scope, so a topic inside the scope shows resolved. Keyscope-aware resolution per topic is out
   of scope (2 maps use it).
4. **Registry shape.** `KeyRegistry = { map: { uuid, name }, keys: Map<string, KeyDefinition>, mapsRead,
   mapsSkipped, capped }`, `KeyDefinition = { href: string | null, mapName, mapUuid, mapFolderUuid, scope? }`.
   The href stays as written (with its fragment); its target UUID is resolved lazily, when the picker or a
   validator needs it — connecting does not walk folders for 1,000+ targets.
5. **Where it lives — `hooks/useKeyRegistry.ts`**, beside `useHerettoCms` in `dita-architect.tsx`: one
   registry for the app (not per tab), exposed through a `KeyRegistryContext`. **Persistence:** only the map
   `{ uuid, name }` goes to `localStorage`; the registry is rebuilt on launch silently — success restores
   chips, failure leaves them in the no-map state with no toast and no modal. **Feedback:** connect success
   is a toast (`Connected X.ditamap — N key definitions loaded`, plus `, M submaps could not be read` when
   M > 0); connect failure is a modal with distinct language for network failure, not-found/bad UUID, and
   not-a-map/malformed XML, and the previous registry stays in force. "Connect a Map…" and "Reload map" go
   in the Heretto dropdown.
6. **Chips cover every ref-carrying inline element.** The scanner makes a chip of `<ph>`/`<term>` with a
   ref (unchanged) **and of any other inline element carrying `conkeyref`/`keyref`/`conref` with no text of
   its own** (`<keyword conkeyref/>`, `<uicontrol conkeyref/>`, …); an element with fallback text keeps
   today's stamped-text display. `DitaPhRefNode` gains **`refTag`** (the element name; JSON field defaults
   to `ph`, so existing serialized state imports unchanged); the reconciler's chip signature includes it,
   and a chip the author creates serializes as `<refTag refType="refValue"/>`, not always `<ph>`.
7. **Chip states are view-only.** The chip component reads `KeyRegistryContext` during render; it never
   calls `editor.update`, so connecting, reloading, or failing can change no byte of any document. Three
   states for `conkeyref`/`keyref` chips (the key is the part before `/`): **no map** (muted, dashed border,
   tooltip `Load a ditamap to verify this key resolves`), **unresolved** (the existing
   `--validation-unresolved-keyref` yellow, tooltip `Key not found in the loaded map`), **resolved**
   (normal text colour, solid border, tooltip `Key found in X.ditamap`). `conref` and image chips get no state.
8. **Cross-file xrefs.** For a tab opened from Heretto, an xref href with no scheme, not `#…`, and not
   `scope="external"`/`format="html"` resolves its path from the tab's `herettoFile.parentFolderUuid`; the
   target's XML is fetched once per UUID (TTL cache) and the fragment checked the DITA way (`#topicid` names
   a topic in the file; `#topicid/elementid` an `@id` inside it). Missing file or fragment → the existing
   broken-xref underline with a message naming which. A network error marks nothing (an error is not
   evidence of a broken link). Local-file tabs are not checked. Independent of the connected map.
9. **Insert Variable (FR-066)** reads the registry: a key's target topic is fetched on demand and every
   inline `@id` element listed; inserting creates a chip with `refTag` = the target's element, so the output
   is `<tag conkeyref="key/id"/>` — the conref rule, not the writer, picks the element.

**Invariants** (each a test, written before code)

- **I1** Against saved, scrubbed copies of the real maps: the User Guide root resolves exactly its 18 keys
  (`VARS` + 17 `GLOS-*`, including the 2 on plain `<topicref>`); `Altitude_variables.ditamap` resolves its 15,
  among them `varsAltitude`, `varsAltitudeUI`, `varsAltitudeNotes`, `varsAltitudeNav`, `varsAltitudeXREF`.
  (The plan's warehouse half named 5 keys; the map has grown to 15.)
- **I1b** Precedence: a key defined at level 1 and again at level 2 resolves to the level-1 definition even
  when the level-2 map comes first in document order; a five-level chain resolves its deepest key; a cycle
  terminates; a missing submap is skipped and counted.
- **I2** Connecting, reloading, or failing changes no byte of any open topic (serialize before and after).
- **I3** Exactly three chip states with the tooltips above; each state's class differs from the others.
- **I4** Insert Variable emits `<tag conkeyref="key/id"/>` at the caret; the document is otherwise
  byte-identical.
- **I5** A persisted map restores silently; a failed restore leaves chips in no-map state and shows nothing.
- **I6** Cross-file: a missing fragment in a fetched topic underlines; a present one does not;
  same-document `#anchor` validation is unchanged.
- **I7** The chip extension changes no byte: the byte-stability corpus is byte-identical, reconcile R1 is
  still zero false rewrites, and the edit fuzz has 0 failures (its edit count may fall: an empty text node
  that becomes a chip is no longer an editable text node — the new count is recorded).

**Consequences** — A writer connects any map in the tenant, including the Help Center, and gets its real
key set with the spec's precedence. Every variable reference in the corpus becomes visible. The resolver
gives later work (map discovery, P3-43; images) one path walk instead of two. Costs: a connect to a large
tree is up to ~300 map fetches plus folder listings (parallel per level; the folder cache shares the
listings); the chip extension touches the parser and reconciler, so Gate 1's full suite and the edit fuzz
gate it. Limits: keyscope resolution is approximate (decision 3); a key's target is not checked until
something asks for it, so a key whose href is broken still shows resolved (the key exists — the target is
the warehouse's problem); conkeyref element ids are not validated by the chip state (three states only).

**Alternatives considered** — **(A) FR-035's three-level cap** — simple, but measured to truncate 15 real
trees, the production Help Center among them, and a truncated tree shows real keys as unresolved. **(B)
Depth-first document order** — what a naive recursion does. Measured on the production Help Center tree, it
picks the `Altitude_Copy` definition for **12 of 282 keys**, all five `varsAltitude*` warehouses among them;
breadth-first picks the real warehouse for every one. **(C) Read only `<keydef>`/
`<glossref>`** (the FR sketch) — misses 91% of key definitions. **(D) Resolve hrefs by filename search**
(what the `read-map.py` skill does) — wrong whenever two folders hold the same filename, which the
`Altitude_Copy` tree guarantees. **(E) Store chip state in the node** (a `resolved` field set by an update)
— makes connecting an editor update, which risks I2 and pollutes undo history; render-time context cannot.

**Implementation note (2026-10-28, v0.11.0)** — Built as decided, tests first; four things the build and
the smoke added. (1) **Folder requests are shared while in flight**: a level's submaps resolve in
parallel, mostly through the same folders, and without it one folder was fetched once per reference (the
300-map test took 6 s). (2) **The resolver says why** (`resolveHerettoPathResult`: found / missing /
error), so a validator never calls a link broken on a failed fetch. (3) **Tabs that know only their file
UUID** — an API load (the AI-drafting flow), a dev-server load, a Replace — carry no `parentFolderUuid`;
`fetchResourceFolder` reads the file's `folder-uuid` so cross-file checks run for them too. (4) **BUG-48**:
the native smoke drew no underline on broken links although the plugin set the class — `.dita-editor-text-link`'s
`text-decoration` shorthand (P2-30, v0.9.3) overrode `.dita-validation-broken-xref` at equal specificity,
so the same-document indicator had been invisible since then too; a more specific rule fixes both. The
loader, run against the live tenant: User Guide root 18 keys, warehouse map 15, Help Center 282 keys from
84 maps in 3.8 s with every `varsAltitude*` key from the real warehouse, the largest tree 1,321 keys from
166 maps in 4.4 s. Limits as stated in Consequences; an Insert Variable search covers the selected key's
variables, not every key's at once.

---

## ADR-014 — Pre-save content-model validation: woven into the live panel, re-checked synchronously at write time

**Date:** 2026-10-28 · **Status:** Accepted (Execution Plan Session 5, P2-36/FR-067)

**Context** — P2-36 (Session 3) built `constants/dita-content-model.ts` (`isValidChild(parent, child)`, a flat
parent→children set, no severity tiers) and named the gap it exists to close: the parser's own body-split
code is more tolerant than real DITA (a `<fig>` inside `<cmd>` parses and round-trips cleanly), so an
invalid document is discovered only when Heretto's PUT rejects it — after the attempt, as a DTD-error
string with no location. The session's own architectural-trigger question ("write ADR-014 only if the API
`saveTab` path also gains the check") resolves yes: `saveTab` needs the check (Gate 2 — "the API must not
push invalid XML either"), and that means a new structured error shape (`details: violations[]`) on an
existing endpoint, plus a new step in the save/replace write contract — both are architectural triggers
per GOVERNANCE.md.

A naming detail worth recording: `constants/dita-content-model.ts`'s header comment paired this work with
"P2-37/FR-067", but P2-37 (context-aware `+`-menu insertion filtering) is a different, still-open feature
that happens to read the same table for a different reason (what the menu offers) — unrelated to validating
what is about to be saved. The comment is corrected to name FR-067 alone.

The surface this blocks on matters: `tab.xmlErrors` is NOT a quiet place to merge new findings into.
`MonacoDitaEditor.tsx`'s `validateDita` already owns it — called on mount, 500 ms after every keystroke, and
100 ms after every `value`-prop change — and each call **replaces** the array (`onValidation` →
`updateTab(id, { xmlErrors: errors })`). A violation merged into that array from outside `validateDita`
would be overwritten by Monaco's own next validation pass within roughly half a second, not a reliable "the
existing xmlErrors surface" the plan asks for.

**Decision**

1. **`lib/content-model-validate.ts`** — pure `validateContentModel(xml): ContentModelViolation[]`
   (`{ element, parent, line, column }`, tag spelling preserved as written). Walks `doc.documentElement` in
   pre-order checking every direct parent→child edge against `isValidChild`, exactly as P2-36's own I2 test
   does (`collectEdges` + the same filter) — this is the same comparison already proven against the whole
   corpus, not a new one. Location: one regex pass over the raw string collects every start-tag's `(tagName,
   offset)` in document order (skipping comments/CDATA/PIs/DOCTYPE, as `structure-check.ts` already does);
   zipped index-for-index against the DOM pre-order element list, which visits elements in the same linear
   order their start tags appear in source for ordinary (unnamespaced) XML. A tag-name mismatch at any zipped
   pair — the one case that would mean the zip assumption broke — abandons locations for the whole call
   (every violation gets `line: 1, column: 1` and a `console.warn`) rather than ever reporting a wrong one.
   Malformed XML (`parsererror`) returns `[]`: distinguishing malformed-XML handling is `validateDitaXml`'s
   job, not this validator's.
2. **Woven into `MonacoDitaEditor.tsx`'s `validateDita`** as additional `error`-severity markers, alongside
   the DOCTYPE/structural/xref checks already there. This is "the existing xmlErrors surface" literally: no
   new `Tab` field, no merge, no race with Monaco's own revalidation cycle — a violation is live in the
   bottom-left error indicator and panel the moment the author's content matches it, exactly like every
   other check that feeds those markers.
3. **Re-checked independently and synchronously at write time** — `handleHerettoSave`, `handleHerettoReplace`
   (`hooks/useHerettoCms.ts`) and `saveTab` (`lib/native-api-bridge.ts`) each call `validateContentModel`
   fresh on the exact string about to be PUT, never trusting the live panel's debounced, possibly-stale
   state. A violation returns before any `fetch`.
4. **No "Save anyway"** — the table has no severity tier (P2-36 built it as a flat valid/invalid set), so
   every finding here is a hard block, matching the plan's own instruction ("not offered for violations
   Heretto's DTD would reject").
5. **Presentation reuses what each write path already has, rather than adding one new UI piece per path:**
   `handleHerettoSave` has no existing feedback surface beyond a toast, so it gets a new, minimal
   `ContentModelViolationModal` listing every violation (element, parent, `line:column`); `handleHerettoReplace`
   returns `{ success: false, error: <one-line summary> }` through `HerettoReplaceModal`'s own existing error
   display (already a `Modal`) — no second overlay stacked on top of it; `saveTab` returns
   `{ success: false, httpStatus: 400, error, details: violations[] }` with no UI side effect (an API/AI
   caller gets a structured answer without a modal popping up under it; a human who later opens that tab
   still sees the same violations live, via decision 2).
6. **`handleHerettoSaveNew`** (Save As / create a new Heretto file) carries the identical risk and is **not**
   touched here — filed as an ADR-014 debt row rather than silently widened into.

**Invariants** (from FR-067's acceptance criteria, each a test written before the code)

- **I1** The whole byte-stability corpus (`sampled/` included) validates clean through
  `validateContentModel` — zero false positives, matching P2-36's own I2 result for `isValidChild` directly.
- **I2** The four P2-36 I3 constructs (`<fig>` in `<cmd>`, `<section>` in `<step>`, bare `<ol>`/`<ul>` in
  `<remedy>`, `<steps>` in `<conbody>`) each produce a violation naming the right element and parent, at a
  location that round-trips (re-slicing the source at `line:column` finds that element's own start tag).
- **I3** A blocked `handleHerettoSave`/`handleHerettoReplace` call never reaches `fetch`; `xmlContent`,
  `savedXmlRef.current`, and every Heretto dirty flag are the same object/value before and after the call.
- **I4** `POST /api/tabs/:id/save` returns `{ success: false, httpStatus: 400, error, details: violations[] }`
  for the same invalid input, and never calls `handleHerettoSave` when it does (no UI side effect from an
  API-only caller).

**Consequences** — Gate 2 becomes locally executable for structural shape, not just "Heretto will catch it
eventually": a `<fig>` inside `<cmd>` is named, with a location, before any network round-trip, in both the
human-authoring and the AI-drafting (API) paths. Costs: one more rule inside `validateDita` (a string scan
and a DOM walk per validation cycle — the same order of cost the existing checks there already pay) and one
more synchronous validation pass at the moment of every save/replace (negligible: the corpus's largest real
fixture is 25.6 KB). Limits: no severity tiers, so a future soft-warning kind of violation would need the
content-model table itself to grow one first, not a guess bolted on here; the location zip degrades to
`1,1` for any document shape that breaks the pre-order-matches-source-order assumption (not expected for
ordinary unnamespaced DITA XML, never observed in the corpus, but never silently wrong either way).

**Alternatives considered** — **(A) Merge violations into `tab.xmlErrors` from the save-path hook.** Simpler
to write, but races Monaco's own debounced revalidation (500 ms on keystroke, 100 ms on `value` change),
which fully replaces that array — a violation would flash and then vanish, unreliable as "the existing
surface." Rejected once the `validateDita` call sites were read. **(B) One shared blocking modal for every
write path, including Replace.** `HerettoReplaceModal` already has its own dedicated error display (a
`Modal`); stacking a second overlay on top of it is visually redundant for no gain — a descriptive string
through the existing display does the job. **(C) Severity tiers now, with "Save anyway" for soft
violations.** Would mean inventing a distinction the content-model table does not encode today (P2-36 built
it as a flat set, deliberately — see its own file header) rather than reading what the table actually says;
revisit only if/when the table grows a soft tier for a real reason.
