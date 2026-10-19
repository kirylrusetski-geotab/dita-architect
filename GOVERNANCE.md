# DITA Architect — Governance

How a change gets from idea to merged, in a way that resists bloat, spaghetti, and drift. This is
the **process** layer; the **quality** layer is [REVIEW-CRITERIA.md](./REVIEW-CRITERIA.md) and the
**intent** lives in [CLAUDE.md](./CLAUDE.md) ("What This Is" + engineering culture).

This is a shared model — a sibling project of the maintainer's runs the same five stages, and the two
keep their governance vocabulary aligned on purpose. Much of this codifies what DITA
Architect already does (the Fix Now / Batch triage, model weights, the session-start grooming check,
the multi-agent pipeline); the genuinely new pieces are **Gate 7**, the **ADR log**, and the
**anti-entropy cadence**.

---

## The five stages

A change moves through up to five stages. A small fix touches only **1 → 2 → 4**. An architectural
change touches all five. The heavy stages (3, and Gate 7's deeper checks in 4) fire **only** when the
architectural trigger is met — so routine bug-sweep work stays fast.

| Stage | Trigger | Artifact | Output |
|---|---|---|---|
| **1. Capture** | every idea | [`future-state/feature-requests.md`](./future-state/feature-requests.md) | a problem-first FR entry |
| **2. Triage** | every captured item | [`future-state/BACKLOG.md`](./future-state/BACKLOG.md) | a lane (Fix Now / Batch) + model weight, or stays parked |
| **3. Shape** | *architectural only* | [`future-state/decisions.md`](./future-state/decisions.md) | an ADR |
| **4. Build & Review** | every change | [`REVIEW-CRITERIA.md`](./REVIEW-CRITERIA.md) | direct build or the multi-agent pipeline → Gates 1–7 |
| **5. Anti-entropy** | recurring | [`CLAUDE.md`](./CLAUDE.md) | session-start grooming + per-minor consolidation pass |

**Default answer is "not yet."** Capturing an idea is cheap and always allowed (the 39 FRs prove it).
Committing to build one is deliberate — a feature session pulls a single item from the top of a
dependency chain.

---

## The architectural trigger

This single test decides whether Stage 3 (write an ADR) and Gate 7's deeper checks apply. A change is
**architectural** if it does any of:

- introduces a **new pattern** (a new way of doing something the codebase already does another way —
  e.g. a second sync mechanism, a new node-identity scheme),
- adds a **new dependency**,
- changes the **data model / contract** (`Tab` shape, `originMap` semantics, the parse/serialize
  round-trip contract),
- adds a **new run-mode or API surface** (a new `/api/*` endpoint, a new `window.__ditaApi` method, a
  new Swift route or `dita://` behavior, a new macOS menu surface).

If none apply, skip Stage 3 — no ADR, and Gate 7 reduces to the lightweight reuse check. The
**Edit Mode rebuild** (BUG-02 → FR-045/FR-046) is the canonical example of a change that *does* meet
the trigger and needs an ADR before code.

---

## Stage 1 — the problem-first FR header

Every FR opens with four fields so the *why* is legible before the *how*:

- **Problem** — what's missing or wrong for the writer. Not the solution.
- **Signal** — evidence it matters: who hit it, when, how often.
- **Smallest slice** — the minimum shippable cut that relieves the Problem.
- **Serves** — which acceptance criterion it advances (top criterion: WYSIWYG/DITA parity; writer
  experience over developer convenience).

The existing rich body (Description / Value Proposition / Suggested Approach / Prior Art / Risks /
What Not to Change) stays — the header just surfaces intent.

---

## Stage 2 — triage (already in place)

The two-lane **Fix Now / Batch** model and the **Haiku / Sonnet / Opus / Multi-agent** weights are
documented in [`future-state/BACKLOG.md`](./future-state/BACKLOG.md) and [CLAUDE.md](./CLAUDE.md)
("Filing Bugs and Feature Requests"). This stage is unchanged — the shared model simply names it.

---

## Stage 4 — Gate 7 in one line

On top of the architecture-specific Gates 1–6, every change is checked for **conceptual fit & reuse**:
does it reuse an existing pattern (the parser's `originMap`, `useHerettoCms`, the state bridges, the
`@lexical/table` commands) instead of inventing a parallel one, is it the smallest slice that solves
the captured Problem, does it match its ADR (if architectural), and does it avoid duplicating an
existing surface? See [REVIEW-CRITERIA.md](./REVIEW-CRITERIA.md) Gate 7. The multi-agent pipeline's
Elena (review) step owns this gate alongside Gates 1–6 for pipeline work; it applies equally to
direct work.

---

## Stage 5 — keeping entropy down

- **Session start:** run the grooming check already in [CLAUDE.md](./CLAUDE.md) ("Session Start —
  Backlog Grooming Check"): parked items whose unblock condition is met, chain-ordering sanity, and
  sweep-ready rot.
- **Per minor version:** a consolidation pass — a `/code-review` + simplification sweep that **files
  debt as BACKLOG items** rather than fixing inline, so cleanup is scheduled, not impulsive.
