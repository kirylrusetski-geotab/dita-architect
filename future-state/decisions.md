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

**Date:** 2026-06-18 (back-filled) · **Status:** Proposed (tracked: BUG-02 → FR-045 → FR-046)

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
