# DITA Architect — Review Criteria

Quality gates tied to *DITA Architect's* architecture, not generic "write clean code" advice. Every
change is reviewed against these gates before merge — whether it was built directly or through the
multi-agent pipeline. A gate failure blocks the merge; a low-impact observation becomes a follow-up
`future-state/BACKLOG.md` item rather than a blocker.

Until now these gates lived **implicitly** — inside the multi-agent pipeline personas (Elena/review,
Marcus/build, Taylor/test) and the "engineering culture" bullets in [CLAUDE.md](./CLAUDE.md). This
doc promotes them to named gates so **direct (non-pipeline) work is held to the same bar**. The
mapping to pipeline personas is noted per gate. This is Stage 4 of [GOVERNANCE.md](./GOVERNANCE.md).

These gates exist because they map to the ways DITA Architect can actually do harm: corrupting a
topic on round-trip, emitting XML that Heretto rejects or mangles, losing the DITA identity of
content, or drifting between the two run modes.

---

## Gate 1 — WYSIWYG / DITA round-trip fidelity

**Content survives the parse → edit → serialize round-trip without loss or drift.**

- `parseXmlToLexical` → `serializeLexicalToXml` is byte-stable for unedited content: opening a topic
  and saving it back without edits must not change the XML.
- Inline elements (`ph`, `uicontrol`, `xref`, `term`, `codeph`, conkeyref/keyref chips) and block
  elements survive editing — no silent dropping of siblings on block-split, no flattening.
- This is the **top acceptance criterion** — WYSIWYG/DITA parity outranks every other consideration.
- **Review check:** `tests/sync/round-trip.test.ts` green; `tests/sync/byte-stability.test.ts` green
  over the fixture corpus; for any element or structure the change touches, a byte-stability fixture
  exists **before** the serializer is touched. The corpus must include **sampled real Heretto topics**
  (FR-064), not only synthetic ones: BUG-25 and BUG-26 survived for months because no fixture had a
  pattern that most real topics contain. **Pipeline owner:** Elena (review) + Taylor (tests).

## Gate 2 — No data corruption / Heretto-safe output

**The app never emits XML that Heretto rejects or mangles.**

- No XHTML-namespace bleed (`xmlns` injection) on serialization — the class of bug behind P1-17 /
  P1-18 / FR-042. Output is DITA, not XHTML.
- `PUT /api/tabs/:id/content` validates structure and rejects malformed XML (400) before applying.
- Destructive operations (Replace in Heretto) follow the established `PUT` → fetch-back → `compareXml`
  verification pattern.
- A change that can emit invalid or namespace-corrupted XML is **Blocking now** (Fix Now lane),
  not a batched bug.
- **Review check:** serialization tests for the touched path; confirm no `xmlns` appears in output;
  confirm validation rejects malformed input. **Pipeline owner:** Elena + Taylor.

## Gate 3 — Run-mode parity

**Any data or behavior the UI consumes works in both run modes.**

- Every endpoint / data path works in **Vite dev (port 3000, `/api/*` middleware + polling)** and in
  the **native app (port 3001, `dita://` scheme + Swift `HttpServer` + JS bridge)**.
- A feature that works only on `:3000` or only on `:3001` is incomplete, not done.
- A new endpoint requires both a `vite.config.ts` middleware route **and** a Swift `HttpServer`
  route + `window.__ditaApi` method.
- **Review check:** confirm the data path exists in both `vite.config.ts` and the Swift shell.
  **Pipeline owner:** Marcus (build/devops) + Elena.

## Gate 4 — Strict build

**The zero-warning bar.**

- `npx tsc --noEmit` clean; `npm run build` clean.
- No `any` where a real type is feasible; no unused variables or imports (prefix-with-`_` is the only
  sanctioned escape).
- **Review check:** run both commands; both exit 0 with no new warnings. **Pipeline owner:** Marcus
  (hard build gate).

## Gate 5 — Test coverage for the changed surface

**New or changed behavior ships with a test.**

- A new parser/serializer variant ships with a round-trip fixture; a new endpoint ships with an API
  contract test (`tests/api/`); a new block-injection path extends `tests/sync/insert-section.test.ts`.
- A bug fix that could regress gets a regression test in the same change.
- **Review check:** `npm test` green, including the new coverage. **Pipeline owner:** Taylor (QA,
  hard test gate).

## Gate 6 — originMap integrity

**Every node carries its DITA identity, and serialization reconstructs from it.**

- `parseXmlToLexical` stamps `originMap` for every node it creates; `serializeLexicalToXml` uses
  `originMap` to rebuild inline DITA elements correctly rather than guessing from Lexical node type.
- A change that creates nodes without origin identity, or serializes without consulting `originMap`,
  breaks the round-trip guarantee (and usually Gate 1 with it).
- **Review check:** confirm new node-creating code stamps `originMap`; confirm new serialization
  consults it. **Pipeline owner:** Elena + Anna (architecture).

## Gate 7 — Conceptual fit & reuse

**The change fits the architecture it lives in, and adds the least new surface that solves the
captured problem.**

Gates 1–6 ask "is this built correctly?" Gate 7 asks "should it be built this way, here?" It is the
review-time half of the governance model in [GOVERNANCE.md](./GOVERNANCE.md).

- **Reuse over reinvention:** uses an existing pattern/hook/utility rather than a parallel one —
  `originMap`, `useHerettoCms`, `native-api-bridge` (the sole tab-API transport — ADR-007), the
  `@lexical/table` commands, the `InlineValidationPlugin` `applyValidationStyles` pattern, `compareXml`.
- **Smallest slice:** the minimum cut that relieves the FR's **Problem** — not a speculative
  framework. (Counter-example to avoid: band-aiding Edit Mode again instead of the marks-as-data
  rebuild — BUG-02.)
- **Matches its ADR:** if the change met the **architectural trigger**, an ADR exists in
  [`future-state/decisions.md`](./future-state/decisions.md) and the implementation matches it.
- **No duplicate surface:** no second endpoint, component, dropdown, or menu item overlapping an
  existing one without retiring the old (respect the macOS menu-bar placement rule in CLAUDE.md).
- **Review check:** name the pattern reused (or the ADR justifying a new one); confirm no parallel
  surface introduced. A new dependency or new `/api` / `__ditaApi` / Swift surface without a matching
  ADR is a Gate 7 failure. **Pipeline owner:** Elena (review) + Anna (architecture).

---

## How these gates are applied

- **Direct work** (Haiku/Sonnet bugs, copy, version bumps): the coder self-reviews against all seven
  gates before merge; the relevant gate's `npm` check must pass.
- **Pipeline work** (`agents/run.ts`, for Multi-agent / cross-file / Swift+TS items): Elena enforces
  Gates 1, 2, 6, 7 (PASS/FAIL, triggers a Jamie retry on FAIL); Marcus enforces Gates 3, 4 (build);
  Taylor enforces Gate 5 (tests). Maya's UX review is advisory and non-blocking.
- A low-impact observation during review → a follow-up `future-state/BACKLOG.md` item; it does not
  block the merge.
