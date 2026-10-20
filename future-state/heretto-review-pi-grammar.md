# Heretto suggestion-PI grammar (FR-065)

**Discovered:** 2026-10-20, against a live Heretto instance, scratch topic
`Test_concept_2.dita` (UUID `6b548365-ccba-11f1-9fe9-f7cb02f1f7db`) in Kiryl's
own `__sandbox/Kiryl_Test` folder. Driven interactively in Heretto's web
editor (mode dropdown: Viewing / Commenting / Suggesting / Editing); raw XML
fetched via `GET /rest/all-files/<uuid>/content` at each step, not scraped
from the UI. This is a first-pass discovery, not an exhaustive spec — gaps
are named explicitly below rather than guessed at.

This is the v0.13.0 (review carrier) prerequisite named in the roadmap since
2026-07-18 and pulled forward on 2026-10-20.

---

## The grammar

```
<?ezd-review-start CHANGE_ID:KIND:AUTHOR_EMAIL:TIMESTAMP_MS?> content <?ezd-review-end CHANGE_ID?>
```

- **`CHANGE_ID`** — a UUID (e.g. `a9fb170e-18dd-4e67-a740-7e243d0720d6`). Identifies one logical
  suggestion. The *same* `CHANGE_ID` can appear in more than one
  `ezd-review-start`/`-end` pair — see "One suggestion, multiple fragments" below.
- **`KIND`** — a short code. Observed: `ct-ins` (insert), `ct-split` (a paragraph
  split — Enter pressed mid-paragraph). Not observed raw: a delete kind
  (the UI labelled one "Delete: body", so the code is presumably `ct-del` or
  similar, but this was accepted before it was fetched — see Gaps).
  Replace, bold/format toggle, whole-element insert, and whole-element delete
  were not isolated as distinct kinds in this pass (see Gaps).
- **`AUTHOR_EMAIL`** — the suggesting author's email, written plain (not
  wrapped, not percent-encoded in what was observed: `author@example.com`).
- **`TIMESTAMP_MS`** — epoch milliseconds as a plain integer, e.g. `1792523746308`.
- **`-end` PI takes only `CHANGE_ID`** — no kind/author/timestamp repeated.
- An insert's suggested text sits literally between the `-start` and `-end`
  PIs, as ordinary element content — e.g.
  `<?ezd-review-start …?> Added edits<?ezd-review-end …?>`.

### Worked example — insert, then a paragraph split, same changeId across both

Typed "Added edits" after existing text, then pressed Enter mid-sentence to split the paragraph. Fetched while both were still pending:

```xml
<p class="- topic/p ">One sentence body paragraph.<?ezd-review-start a9fb170e-18dd-4e67-a740-7e243d0720d6:ct-ins:author@example.com:1792523746308?> Added edits<?ezd-review-end a9fb170e-18dd-4e67-a740-7e243d0720d6?><?ezd-review-start 0cb9e52d-ec01-4378-a4e9-d3e7e0ab9a8a:ct-split:author@example.com:1792523752079?></p><p class="- topic/p "><?ezd-review-end 0cb9e52d-ec01-4378-a4e9-d3e7e0ab9a8a?><?ezd-review-start a9fb170e-18dd-4e67-a740-7e243d0720d6:ct-ins:author@example.com:1792523752080?> existing paragraph.<?ezd-review-end a9fb170e-18dd-4e67-a740-7e243d0720d6?> </p>
```

### Worked example — Accept All strips every PI, leaves plain committed XML

Before accept (three pending suggestions: delete "body", insert "existing paragraph.", split the paragraph):

```
Current (3): Delete: body · Add: existing paragraph. · Split p
```

After clicking **Accept All Changes** in the Review panel (there is no separate "Save" — Heretto persists continuously; Accept/Reject is the only commit action):

```xml
<conbody class="- topic/body  concept/conbody "><p class="- topic/p ">One sentence . Added edits</p><p class="- topic/p "> existing paragraph. </p></conbody>
```

No `ezd-review` PIs remain anywhere. The accepted delete's text ("body") is
simply gone; the accepted inserts are now plain text; the split is now two
ordinary `<p>` elements with no trace of the operation. **Accept is a clean
flatten to exactly what direct typing would have produced** — important for
FR-051: the carrier only needs to round-trip *pending* marks; an accepted
document needs no special handling at all.

---

## One suggestion, multiple fragments

A single logical edit can be split across more than one `-start`/`-end` pair
that share the same `CHANGE_ID`, when a *later* operation (here, the
paragraph split) interrupts it. The insert "Added edits existing paragraph."
was typed as one continuous action, got divided by the split into two
`<p>` elements, and Heretto re-emitted the SAME insert `CHANGE_ID` around each
resulting fragment rather than minting a new one. The Review panel's sidebar
correctly showed this as a single "Add" card, not two.

**Implication for FR-051's carrier:** `TrackedTextNode`'s `changeId` must be
able to span multiple Lexical nodes/blocks the same way, and the carrier
needs to re-associate fragments by `CHANGE_ID` on read, not assume one PI
pair per mark.

## Editing within your own pending insertion is invisible

Deleting or retyping characters that are still inside your own *pending*
insert does not create a separate delete marker — it just shrinks the
existing insert's content in place. Confirmed indirectly: early edits inside
"Added edits" produced no extra PI pairs, only the one insert wrapper with
its final text.

## Editing mode matters — and it is easy to be in the wrong one by accident

Heretto's mode dropdown (top right of the editor) has **four** states:
Viewing, Commenting, Suggesting, Editing — one more than DITA Architect's
three (`viewing` / `suggesting` / `editing`; DA has no separate Commenting
mode). A delete made while the dropdown was on **Editing** produced *no*
review PI at all — the text was simply gone, applied as a direct edit, not a
suggestion. This was confirmed by checking the dropdown directly (see
2026-10-20 session), not inferred. **This is a real-world trap worth naming
in the eventual DA review-carrier UI**: a writer who thinks they are
suggesting but has silently dropped into Editing mode will make untracked
changes with no warning — DA's own three-mode switcher does not have this
exact failure mode since there is no fourth "plain edit while looking like
suggest" state, but the *general* lesson (mode state must be unambiguous to
the user) applies when designing how DA's suggesting-mode indicator looks
once marks start round-tripping through Heretto.

---

## Gaps — not resolved in this pass

- **The delete kind's exact code and wrapping are not captured raw.** The UI
  labelled one suggestion "Delete: body" with a strikethrough render in the
  editor, but it was accepted (via Accept All) before a raw fetch captured
  it. Based on the `ct-ins`/`ct-split` pattern, a `ct-del` (or similar) kind
  is likely, and the deleted text is probably *kept* in the document (struck
  through, not removed) until resolved — mirroring DA's own kept-and-struck
  deletion model (FR-046) — but this is an inference, not an observation.
  **Action before v0.13.0 code:** repeat this with a deliberate pause after a
  delete-only edit, fetch before accepting, and update this section with the
  raw PI.
- **Replace** (select a word, retype it) was not cleanly isolated — it likely
  decomposes into a delete + insert pair rather than being its own kind, but
  this was not directly observed with both halves visible simultaneously.
- **Bold/format toggle** was not captured (not reached in this session — the
  live edit flow moved to accept-all before format toggles were tried).
  FR-051 names format marks as its own open item regardless, so this gap
  does not block anything already filed, but a future pass should still look
  for whether Heretto has a dedicated format-change PI kind.
- **Whole-element insert/delete** (adding or removing an entire `<p>`, not
  just text within one) was not distinctly captured — the paragraph-split
  case is adjacent but not the same operation.
- **Reject** was not exercised in isolation (only Accept All was used).
  Expected to be symmetric with Accept (strip the PI, restore prior state)
  by analogy with DA's own `handleReviewReject`, but not confirmed against
  Heretto.
- **Nested/overlapping suggestions** (two authors, or one author with
  suggestions that overlap in range) were not tested — only one author, one
  session, non-overlapping edits.
- **Author identity encoding** — only a plain email was observed. Whether
  Heretto ever encodes a display name, a user UUID, or percent-encodes special
  characters in the email is unknown.

---

## Mapping to `TrackedMark` (FR-046 → FR-051 carrier)

| `TrackedMark` field | Heretto PI equivalent | Confidence |
|---|---|---|
| `changeId` | the UUID in `CHANGE_ID` position | High — observed directly, including the multi-fragment case |
| `kind: 'insert'` | `ct-ins` | High — observed directly |
| `kind: 'split'` | `ct-split` (DA has no separate "split" kind today — FR-046 encodes a split as a zero-width marker inside an `insert`-kind run; the carrier will need to translate between the two models) | High that the PI kind exists; translation design still open |
| `kind: 'delete'` | presumably `ct-del` or similar | **Unconfirmed — see Gaps** |
| `author` | the plain email after the second `:` | High |
| `date` | epoch milliseconds after the third `:` | High |

No DA mark kind maps to Heretto's `ct-split` as a *first-class* thing today —
FR-046 deliberately modelled splits as a side effect of an insert run, not a
mark kind of its own. ADR-012 (when v0.13.0 is shaped) needs to decide
whether the carrier teaches DA a real split-mark kind, or keeps translating
Heretto's `ct-split` into DA's zero-width-marker convention on read and
regenerates `ct-split` on write. The fragment-spanning `CHANGE_ID` behaviour
documented above is the strongest argument for giving splits real first-class
representation: DA's own model already needs `changeId` to span multiple
nodes for the insert case, so reusing that same mechanism for splits is the
smaller change.

---

## For whoever shapes v0.13.0

Read this document, then do the four items in "Gaps" above (at minimum the
delete capture — it is one five-minute pass) before writing ADR-012. Do not
design the carrier from the inference in the gaps list; verify it.
