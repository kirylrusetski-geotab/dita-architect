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

**Second pass — 2026-11-02 (Session 6 shaping, before ADR-015).** The same
scratch topic, driven through Heretto's web editor in **Suggesting** mode
(the mode is a native `<select class="editingMode">`; checked before every
edit), raw XML fetched over REST after each step and diffed against the
previous fetch. Every gap below marked **closed** was observed this way, not
inferred. Heretto persists an edit to the REST view about 5–10 seconds after
it is made, not instantly. The topic was restored to its 1018-byte baseline
afterwards (SHA-256 `c8546a2b…f699`, byte-identical).

---

## The grammar

```
<?ezd-review-start CHANGE_ID:KIND:AUTHOR_EMAIL:TIMESTAMP_MS?> content <?ezd-review-end CHANGE_ID?>
```

- **`CHANGE_ID`** — a UUID (e.g. `a9fb170e-18dd-4e67-a740-7e243d0720d6`). Identifies one logical
  suggestion. The *same* `CHANGE_ID` can appear in more than one
  `ezd-review-start`/`-end` pair — see "One suggestion, multiple fragments" below.
- **`KIND`** — a short code. Observed raw: `ct-ins` (insert), `ct-del`
  (delete — second pass), `ct-split` (a paragraph split — Enter pressed
  mid-paragraph), and `comment` (a Heretto comment, not a suggestion; two
  real topics in the byte-stability corpus carry one, wrapping the commented
  range with the same four-field start PI). There is no separate kind for
  replace, format toggle, or whole-element insert: each is built from
  `ct-ins`/`ct-del` with a different *placement* (see "Second pass" below).
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

## Second pass (2026-11-02) — the gaps, closed with raw samples

Each sample is the `<conbody>` fragment exactly as Heretto's REST view
returned it, with the author email scrubbed. Baseline body before the pass
(one pending insert, left over from the first pass):

```xml
<p class="- topic/p ">One sentence . Added edits<?ezd-review-start 29518720-0774-4c3e-aff3-faa08db47921:ct-ins:author@example.com:1792524402429?> over here<?ezd-review-end 29518720-0774-4c3e-aff3-faa08db47921?></p><p class="- topic/p "> existing paragraph. </p>
```

### Delete — `ct-del`, deleted text KEPT between the PIs (closed)

Double-clicked the word "existing", pressed Backspace. The Review panel
showed "Delete: existing" with a strikethrough. Raw:

```xml
<p class="- topic/p "> <?ezd-review-start d313682d-1ade-4fa5-8e86-2d9514f2e44e:ct-del:author@example.com:1793636289210?>existing<?ezd-review-end d313682d-1ade-4fa5-8e86-2d9514f2e44e?> paragraph. </p>
```

Same four-field start PI as an insert, kind `ct-del`; the struck text stays
in the document as ordinary character data between the two PIs. This is
exactly DA's own kept-and-struck model (FR-046), so `kind: 'delete'` maps
1:1.

### Replace — a `ct-ins` + `ct-del` pair sharing ONE `CHANGE_ID` (closed)

Double-clicked "paragraph", typed "sentence". Raw:

```xml
<?ezd-review-start b9791ffd-569e-46c2-9807-14fa5eab9c84:ct-ins:author@example.com:1793636711165?>sentence<?ezd-review-end b9791ffd-569e-46c2-9807-14fa5eab9c84?><?ezd-review-start b9791ffd-569e-46c2-9807-14fa5eab9c84:ct-del:author@example.com:1793636707892?>paragraph<?ezd-review-end b9791ffd-569e-46c2-9807-14fa5eab9c84?>.
```

Not its own kind. The new text comes first in document order, the struck
original second, and **both pairs carry the same `CHANGE_ID`** with
different kinds (the delete's timestamp is the earlier one). The Review
panel shows this as **one card** ("Add: sentence"); rejecting that one card
resolved both halves (see Reject below). Implication: a `CHANGE_ID` is not
one kind — DA's `Change` grouping (one kind per changeId) has to key on
changeId + kind, or model a replace explicitly.

### Format toggle (bold) — a `ct-ins` pair that STRADDLES the element's start tag (closed)

Double-clicked "One", pressed ⌘B. Review card: "Add: &lt;b&gt;". Raw:

```xml
<p class="- topic/p "><?ezd-review-start 99902364-a1c2-41ed-a33f-fe0abbe0031f:ct-ins:author@example.com:1793636530061?><b class="+ topic/ph hi-d/b "><?ezd-review-end 99902364-a1c2-41ed-a33f-fe0abbe0031f?>One</b> sentence . …
```

The start PI is a sibling *before* `<b>`; the end PI is the *first child*
of `<b>`. Heretto is saying "the `<b>` start tag was inserted". So a
`-start`/`-end` pair is **not guaranteed to be well-nested with elements**:
the two PIs can have different parents. No dedicated format kind exists.
FR-051's format marks stay post-1.0; for the carrier this shape is an
*unmapped* suggestion (preserved opaque, listed, never dropped).

### Whole-element insert — a `ct-ins` pair wrapping the whole new element at the parent's level (closed)

Caret at the very end of the second paragraph, Enter. This did **not**
produce a `ct-split`; Heretto inserted a new empty paragraph and wrapped it:

```xml
… paragraph. </p><?ezd-review-start 5e5c46ca-8157-4b86-8cb1-d741b6038a2e:ct-ins:author@example.com:1793637142239?><p class="- topic/p "/><?ezd-review-end 5e5c46ca-8157-4b86-8cb1-d741b6038a2e?></conbody>
```

Review card: "Add: &lt;p&gt;&lt;/p&gt;". So `ct-split` is the mid-paragraph
case only (first pass); Enter at a paragraph's end is an element insertion
with the PIs as siblings of the element inside its parent (`<conbody>`
here). Backspace inside that own, pending, empty paragraph removed the
element **and both PIs** outright — no `ct-del`; retracting your own pending
insertion is invisible, as the first pass found for text. After the
retraction Heretto's Review panel kept a greyed card labelled "Not in
content", and the resource metadata's `num-open-comments` went from 1 to 2
while the XML held one pair — Heretto keeps a side record of review items
that is not derived from the PIs alone.

### Whole-element delete — not isolated (still open, lower priority)

Selecting the whole paragraph's text (triple-click) and pressing Backspace
struck only the remaining *plain* character (the "."); the own pending
insert "sentence" inside the range was **left as it was** (not retracted),
and already-struck text stayed struck. Whether Heretto has a distinct
element-deletion shape (a `ct-del` pair around a whole `<p>`, by symmetry
with the insert above) was not observed — the synthetic selection never
became a block selection. DA has no element-delete mark kind (block merges
are blocked in suggesting mode, FR-046), so nothing in the carrier depends
on this; symmetry with the insert case is the likely answer, unverified.

### Reject and Accept, per kind (closed)

Each card resolved individually from the Review panel; raw diff per step:

| Action | Before (fragment) | After |
|---|---|---|
| Reject `ct-ins` (text) | `<?…ct-ins…?>Brand new paragraph<?…end…?>` | *(gone — text and both PIs removed)* |
| Reject `ct-del` | `<?…ct-del…?>.<?…end…?>` | `.` (PIs removed, text kept) |
| Reject the replace pair (one card) | `<?…ct-ins…?>sentence<?…?><?…ct-del…?>paragraph<?…?>` | `paragraph` (insert removed, original un-struck — both halves of the shared `CHANGE_ID`) |
| Accept `ct-del` | ` <?…ct-del…?>existing<?…end…?> paragraph.` | `  paragraph.` (text and PIs removed; the whitespace around the struck run is left exactly as it was — hence the double space) |
| Reject the bold wrap | `<?…ct-ins…?><b class="…"><?…end…?>One</b>` | `One` (the `<b>` unwrapped, text kept) |

Accept of a text `ct-ins` was observed in the first pass (Accept All →
plain text). Reject is exactly the inverse of Accept for every kind
observed, and both are clean: no PI, marker, or attribute is left behind.

### Suggestions written by the REST API: rendered inline, not indexed as cards (Session 6 smoke, 2026-11-02)

After DITA Architect saved a topic carrying two of its own suggestions
(`ct-del` "sentence", `ct-ins` " plus more", author = the account email) over
`PUT /rest/all-files/<uuid>/content`, Heretto's editor **rendered both
correctly inline** — the struck word in red strikethrough, the insertion
underlined, exactly like its own — and `is-valid` stayed `true`. But its
**Review panel did not list them**: it showed only the card for the
suggestion made in Heretto's own editor, plus the greyed "Not in content"
ghost; the resource metadata's `num-open-comments` did not change; clicking
the struck word placed a caret and opened nothing; switching the editor to
Suggesting mode changed nothing. Heretto's cards come from a side index that
its editor writes when a suggestion is made there, not from the PIs in the
file. So a suggestion made in DITA Architect is *visible* in Heretto and
survives there, and can be accepted or rejected in DITA Architect, but
Heretto's own Accept/Reject buttons are not offered for it (no card).
Whether Heretto re-indexes on some later event (an edit in its editor, a
publish, a reopen hours later) was not observed.

- **Nested/overlapping suggestions from two authors** — needs a second
  Heretto account; not tested. One author never produced overlapping pairs
  (edits inside an own pending insert shrink/extend it in place).
- **Author identity encoding** — only a plain email was observed, again.
- **Whole-element delete** — see above.

### A trap for anyone automating Heretto's editor

Synthetic `insertText` input (CDP `Input.insertText`, what a plain
"type" automation step sends) changes the editor's **DOM** without the
editor's **model** noticing: the text appeared on screen, no suggestion was
created, and the REST view never changed; closing and reopening the editor
re-rendered the model and the phantom text vanished. Only real per-key
events (`keydown`/`keyup`) produce suggestions. Enter likewise needs a full
key event (`code: Enter`, virtual key 13, `\r` text); a bare `key: Enter`
did nothing.

---

## Mapping to `TrackedMark` (FR-046 → FR-051 carrier)

| `TrackedMark` field | Heretto PI equivalent | Confidence |
|---|---|---|
| `changeId` | the UUID in `CHANGE_ID` position | High — observed directly, including the multi-fragment case |
| `kind: 'insert'` | `ct-ins` | High — observed directly |
| `kind: 'split'` | `ct-split` — mid-paragraph Enter only; the `-start` PI is the last child of the first paragraph, the `-end` PI the first child of the second (Enter at a paragraph's *end* is a whole-element `ct-ins` instead, see the second pass) | High — observed raw in both passes; positional translation only (see the note below the table) |
| `kind: 'delete'` | `ct-del`, deleted text kept between the PIs | High — observed raw 2026-11-02 |
| `author` | the plain email after the second `:` | High |
| `date` | epoch milliseconds after the third `:` (DA stores an ISO string; `Date.parse` / `toISOString` round-trip at millisecond precision) | High |
| *(no DA kind)* | a `ct-ins` pair straddling an element start tag (format/wrap), a `ct-ins` pair around a whole element (block insert), `comment`, anything else | Unmapped — preserved as opaque PIs, listed as unsupported, never dropped (ADR-015) |

A correction to the first pass's note on splits: DA's `kind: 'split'` *is* a
first-class mark kind (FR-046's zero-width `TrackedTextNode` at the head of
the new block — see `lib/tracked-changes/edits.ts`, `$trackedParagraphSplit`),
so the translation is positional only: Heretto puts the `-start` PI as the
last child of the first paragraph and the `-end` PI as the first child of
the second; DA's marker sits where the `-end` PI is. ADR-015 decides how the
carrier translates between the two.

---

## For whoever shapes v0.13.0

Done 2026-11-02: every gap that the carrier's three kinds depend on is
closed with a raw sample above; ADR-015 is written from these samples. The
two items still open (two-author overlap, whole-element delete) do not
touch the carrier's mapping. Re-run the second pass if Heretto's editor is
upgraded (the scratch topic and the step list are above).
