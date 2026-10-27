// P2-36 — DITA 1.3 content models, as a parent → validChildren set.
//
// SOURCE: the OASIS DITA 1.3 specification (topic, concept, task, reference,
// and troubleshooting modules, plus the ui-d/sw-d/pr-d domains for the inline
// phrase elements DITA Architect recognizes). Transcribed 2026-10-21, then
// cross-checked against two things no spec reading alone would catch:
//   1. sync/parseXmlToLexical.ts and sync/inline-units.ts — how this app
//      actually structures each element's children, which is the only
//      reliable source for the handful of elements where real Heretto
//      content quietly deviates from the base spec (see DEVIATIONS below).
//   2. The full FR-064 byte-stability corpus (tests/sync/fixtures/**,
//      52 files incl. sampled/ — every real topic type: Concept, Task,
//      Reference, Topic, Troubleshooting Topic) — every file parsed clean
//      and every parent→child edge in it was checked against this table
//      before it was considered finished (see tests/dita-content-model.test.ts
//      I2). No fixture was excluded or special-cased to make I2 pass.
//
// SCOPE — this is a SET of allowed child element names per parent, not a
// full grammar: it answers "can <child> ever be a direct child of <parent>"
// (what isValidChild() needs), never "in what order" or "how many". It
// covers every element in RECOGNIZED_ELEMENTS (constants/heretto.ts),
// STRUCTURAL_CONTAINERS (constants/heretto.ts), and RECOGNIZED_BODY_TAGS
// (sync/serializeLexicalToXml.ts) — the three sets the app's own code treats
// as structurally meaningful — plus the task-step family (substeps, stepxmp,
// stepresult, choices, stepsection, info, tutorialinfo) those three sets
// imply but don't spell out. A parent tag that is NOT a key here gets no
// opinion from isValidChild() (see "Unmodeled parents" below) — this is a
// deliberate scope boundary, not an oversight: elements outside the app's
// recognized vocabulary (glossary-entry markup, <prolog>/<metadata>,
// <related-links>, <draft-comment>, …) are preserved verbatim by the parser
// as opaque content (DitaOpaqueNode) and this app never restructures them,
// so validating their internals is not this tool's job.
//
// DEVIATIONS FROM STRICT BASE DITA (each one real, each one cited):
//   - <p>, <prereq>, <context>, <result>, <postreq> permit the block tags in
//     BLOCK_CHILD_TAGS (ul, ol, table, simpletable, note, dl, fig, codeblock,
//     section, p) as DIRECT children, which the base OASIS <p> content model
//     (phrase/inline content only) does not allow. This is real, common
//     Heretto-authored content, not an edge case: BUG-25 (p-wrapping-a-list)
//     and BUG-27 (prereq/context/result/postreq wrapping a block) were both
//     found via FR-064's sampled real-topic corpus, and this table's own
//     corpus scan independently confirms it: 7+ sampled fixtures (and both
//     hand-written troubleshooting fixtures) have a <p> directly containing
//     <ul>, <ol>, <table>, <dl>, or <note>. Enforcing the strict base model
//     here would make I2 fail on real DITA, not catch an error. The import
//     from sync/parseXmlToLexical.ts keeps this table unable to drift from
//     what the parser itself treats as legal.
//   - <note> permits NOTE_BLOCK_TAGS (same reasoning, narrower set — this is
//     the parser's own dedicated model for a note's block content, not an
//     incidental share with <p>'s code path).
//   - <cmd> and <shortdesc> do NOT get this widening, even though they share
//     the exact same hasBlockChildren-gated switch-case branch as <p> in the
//     parser (parseXmlToLexical.ts's `case 'shortdesc': case 'prereq': …
//     case 'cmd':` group) — meaning the app's parser would structurally
//     tolerate e.g. <fig> inside <cmd> without crashing. That tolerance is
//     an artifact of code reuse, not evidence Heretto's real DTD accepts it:
//     cmd and shortdesc are phrase-only elements in DITA 1.3 (one line of
//     instruction / one line of summary), confirmed by zero corpus evidence
//     of a block child in either across all 52 fixtures. This table is
//     intentionally STRICTER than the parser's own tolerance here — that gap
//     is exactly what Session 5's pre-save validation (P2-37/FR-067) exists
//     to close: a `<fig>` inside `<cmd>` parses today without error, and
//     would very likely be rejected by Heretto's real schema on save.
//   - <remedy> permits block prose (p, note, dl, table, simpletable, fig,
//     image, example) but NOT bare <ol>/<ul> directly — a remedy's
//     procedural content must go through <steps>, <steps-unordered>, or
//     <steps-informal> instead. <condition> and <cause> (which are
//     descriptive, not procedural) DO permit bare lists, matching how <p>
//     and <context> behave. Every troubleshooting fixture in the corpus
//     that has a list in a remedy wraps it in <steps-informal>
//     (troubleshooting-rich.dita) rather than using a bare <ol> — consistent
//     with, not just assumed to satisfy, this rule.
//
// Unmodeled parents: isValidChild(parent, child) returns true (no opinion)
// when `parent` is not a key in DITA_CONTENT_MODEL. This is what keeps I2
// honest for content outside this table's stated scope (glossary-entry
// elements, <prolog> and its descendants, <related-links>, a stray
// <draft-comment>) without the table having to pretend to model them.

import { BLOCK_CHILD_TAGS } from '../sync/parseXmlToLexical';
import { NOTE_BLOCK_TAGS } from '../sync/inline-units';

const toSet = (tags: ReadonlySet<string> | readonly string[]): ReadonlySet<string> =>
  tags instanceof Set ? tags : new Set(tags);

// ─── Shared building blocks ──────────────────────────────────────────────────

/**
 * Inline/phrase elements that may appear wherever "ordinary running text"
 * is allowed: title, shortdesc, cmd, li, choice, result/prereq/context/
 * postreq's inline form, table/simpletable cells, and the inside of the
 * container-phrase elements (ph, xref, b/i) themselves.
 */
export const INLINE_PHRASE: readonly string[] = [
  'ph', 'term', 'codeph', 'xref', 'image', 'menucascade',
  'b', 'strong', 'i', 'em',
  'uicontrol', 'wintitle', 'keyword', 'filepath', 'cite',
  'varname', 'cmdname', 'parmname', 'apiname', 'option',
];

/**
 * Leaf phrase elements: DITA 1.3 gives these a text-only content model, and
 * the parser's own M1 generic-leaf-inline path (parseXmlToLexical.ts) treats
 * every one of them the same way — flattened to `el.textContent`, so any
 * element nested inside is lost structurally, not just disallowed on paper.
 * `alt` (image's caption text) and `codeph` (flattened to a format flag, not
 * an inlineTag stamp) share the same text-only shape.
 */
const LEAF_PHRASE: readonly string[] = [
  'uicontrol', 'wintitle', 'term', 'filepath', 'cite', 'varname', 'cmdname',
  'parmname', 'apiname', 'keyword', 'option', 'codeph', 'alt',
];

/** `<p>`/`<note>`'s own block widening, re-exported as string arrays for the table below.
 *  Two variants: `<p>` itself never nests another `<p>` (not a real DITA
 *  pattern), but `<prereq>`/`<context>`/`<result>`/`<postreq>` legitimately
 *  hold MULTIPLE sibling `<p>` elements directly (confirmed by several real
 *  task fixtures — multi-paragraph prereqs/results are common), so `'p'`
 *  stays in BLOCK_CHILD_TAGS for those four. */
const P_BLOCK_WIDENING = Array.from(toSet(BLOCK_CHILD_TAGS)).filter(t => t !== 'p');
const TASK_SECTION_BLOCK_WIDENING = Array.from(toSet(BLOCK_CHILD_TAGS));
const NOTE_BLOCK_WIDENING = Array.from(toSet(NOTE_BLOCK_TAGS));

/** The generic "body" content group: block-level flow content shared by
 *  conbody, refbody, body, section, example, condition, cause, info, and the
 *  block form of prereq/context/result/postreq. */
const BODY_BLOCK_GROUP: readonly string[] = [
  'p', 'note', 'dl', 'ul', 'ol', 'table', 'simpletable', 'fig', 'image', 'codeblock', 'section', 'example',
];

const DITA_CONTENT_MODEL_SOURCE: Record<string, readonly string[]> = {
  // ─── Root topic types (STRUCTURAL_CONTAINERS) ─────────────────────────────
  // Every root topic type shares the same top-level shape: title, an
  // optional short description, prolog metadata (unmodeled, see header),
  // the type-specific body, and related-links (unmodeled).
  task: ['title', 'shortdesc', 'prolog', 'taskbody', 'related-links'],
  concept: ['title', 'shortdesc', 'prolog', 'conbody', 'related-links'],
  reference: ['title', 'shortdesc', 'prolog', 'refbody', 'related-links'],
  topic: ['title', 'shortdesc', 'prolog', 'body', 'related-links'],
  troubleshooting: ['title', 'shortdesc', 'prolog', 'troublebody', 'related-links'],

  // ─── Bodies (STRUCTURAL_CONTAINERS / RECOGNIZED_ELEMENTS) ─────────────────
  taskbody: ['prereq', 'context', 'steps', 'steps-unordered', 'steps-informal', 'result', 'example', 'postreq'],
  conbody: BODY_BLOCK_GROUP,
  refbody: BODY_BLOCK_GROUP,
  body: BODY_BLOCK_GROUP, // generic <topic>
  troublebody: ['condition', 'troubleSolution', 'cause'], // (condition?, (troubleSolution+ | cause+))

  // ─── Troubleshooting containers (RECOGNIZED_ELEMENTS, ADR-009/011) ────────
  // condition/cause are descriptive (same body-group richness as conbody);
  // remedy is procedural and excludes bare lists on purpose — see the
  // DEVIATIONS note above for why.
  condition: [...BODY_BLOCK_GROUP, 'title'],
  cause: [...BODY_BLOCK_GROUP, 'title'],
  remedy: ['title', 'p', 'note', 'dl', 'table', 'simpletable', 'fig', 'image', 'example', 'steps', 'steps-unordered', 'steps-informal'],
  troubleSolution: ['cause', 'remedy'],

  // ─── Task-step family (implied by RECOGNIZED_ELEMENTS + "task-step families") ─
  steps: ['step', 'stepsection'],
  'steps-unordered': ['step'],
  'steps-informal': BODY_BLOCK_GROUP, // a free-form body, used for non-numbered procedures
  step: ['context', 'cmd', 'info', 'tutorialinfo', 'stepxmp', 'choicetable', 'choices', 'stepresult', 'substeps'],
  substeps: ['substep'],
  substep: ['cmd', 'info', 'tutorialinfo', 'stepxmp', 'choicetable', 'choices', 'stepresult'],
  choices: ['choice'],
  choice: INLINE_PHRASE, // "Open the Filter to…" — text + inline, confirmed by corpus
  stepxmp: INLINE_PHRASE, // example command syntax: text + inline
  stepsection: INLINE_PHRASE, // a text label grouping the steps around it, NOT a wrapper for them (corpus: plain text)
  stepresult: [...BODY_BLOCK_GROUP, ...INLINE_PHRASE],
  info: [...BODY_BLOCK_GROUP, ...INLINE_PHRASE],
  tutorialinfo: [...BODY_BLOCK_GROUP, ...INLINE_PHRASE],

  // ─── Paragraph-shaped elements (RECOGNIZED_ELEMENTS) ──────────────────────
  // Widened per the DEVIATIONS note: real Heretto content nests block
  // elements directly inside these four, and the corpus confirms it.
  p: [...INLINE_PHRASE, ...P_BLOCK_WIDENING],
  prereq: [...INLINE_PHRASE, ...TASK_SECTION_BLOCK_WIDENING],
  context: [...INLINE_PHRASE, ...TASK_SECTION_BLOCK_WIDENING],
  result: [...INLINE_PHRASE, ...TASK_SECTION_BLOCK_WIDENING],
  postreq: [...INLINE_PHRASE, ...TASK_SECTION_BLOCK_WIDENING],
  // cmd and shortdesc are deliberately NOT widened — see DEVIATIONS.
  cmd: INLINE_PHRASE,
  shortdesc: INLINE_PHRASE,
  title: ['ph', 'keyword', 'term', 'b', 'i'], // narrower than the general inline set — no xref/uicontrol/image in a title per spec
  note: [...INLINE_PHRASE, ...NOTE_BLOCK_WIDENING],

  // ─── Sections (RECOGNIZED_ELEMENTS, ADR-011) ──────────────────────────────
  section: [...BODY_BLOCK_GROUP, 'title', 'draft-comment'], // draft-comment: opaque passthrough, preserved verbatim (corpus evidence)

  // ─── Lists (RECOGNIZED_ELEMENTS) ──────────────────────────────────────────
  ul: ['li'],
  ol: ['li'],
  li: [...INLINE_PHRASE, 'p', 'note', 'dl', 'ul', 'ol', 'table', 'simpletable', 'fig', 'image'],

  // ─── Definition lists (RECOGNIZED_BODY_TAGS: dl) ──────────────────────────
  // dlentry/dt/dd aren't in any of the three required sets, but dl needs
  // somewhere to point: the app parses/emits all four (sync/parseXmlToLexical.ts).
  dl: ['dlentry'],
  dlentry: ['dt', 'dd'],
  dt: INLINE_PHRASE,
  dd: [...BODY_BLOCK_GROUP, ...INLINE_PHRASE],

  // ─── Tables (STRUCTURAL_CONTAINERS + RECOGNIZED_ELEMENTS: table, simpletable) ─
  table: ['title', 'tgroup'],
  tgroup: ['colspec', 'thead', 'tbody'],
  thead: ['row'],
  tbody: ['row'],
  row: ['entry'],
  entry: [...INLINE_PHRASE, 'p', 'note', 'dl', 'ul', 'ol', 'table', 'simpletable', 'fig', 'section'],
  simpletable: ['sthead', 'strow'],
  sthead: ['stentry'],
  strow: ['stentry'],
  stentry: [...INLINE_PHRASE, 'p'],

  // ─── Figures and images (RECOGNIZED_ELEMENTS: fig, image, alt) ────────────
  fig: ['title', 'image'],
  image: ['alt'],

  // ─── Inline/phrase elements (RECOGNIZED_ELEMENTS) ─────────────────────────
  // xref/ph/b/strong/i/em are inline CONTAINERS (may themselves hold further
  // inline content — nested <b><i>, a refless <ph> wrapping <uicontrol>, …);
  // everything else in RECOGNIZED_ELEMENTS' inline set is a LEAF per the
  // parser's own generic-leaf path (see LEAF_PHRASE above) — no element may
  // be nested inside them.
  xref: INLINE_PHRASE,
  ph: INLINE_PHRASE,
  b: INLINE_PHRASE,
  strong: INLINE_PHRASE,
  i: INLINE_PHRASE,
  em: INLINE_PHRASE,
  menucascade: ['uicontrol'], // not in RECOGNIZED_ELEMENTS itself, but it's the only valid home for a <uicontrol> sequence
  ...Object.fromEntries(LEAF_PHRASE.map(tag => [tag, []])),
};

/** Normalized (lowercase keys/children) and frozen as Sets for O(1) lookup.
 *  Case-insensitive throughout, matching how domTag is compared everywhere
 *  else in this codebase (serializeLexicalToXml.ts's own `.toLowerCase()`
 *  convention) — including for `troubleSolution`, whose real DITA 1.3
 *  element name is mixed-case. */
export const DITA_CONTENT_MODEL: Readonly<Record<string, ReadonlySet<string>>> = Object.fromEntries(
  Object.entries(DITA_CONTENT_MODEL_SOURCE).map(([parent, children]) => [
    parent.toLowerCase(),
    new Set(children.map(c => c.toLowerCase())),
  ])
);

/**
 * True when `child` may be a direct child of `parent` per DITA 1.3 (as
 * widened for real Heretto content — see the file header). Both arguments
 * are compared case-insensitively. A `parent` this table has no opinion
 * about (see "Unmodeled parents" above) is always valid — this function
 * only ever reports a NEGATIVE finding, never invents a positive one for
 * content it doesn't model.
 */
export const isValidChild = (parent: string, child: string): boolean => {
  const validChildren = DITA_CONTENT_MODEL[parent.toLowerCase()];
  if (!validChildren) return true; // unmodeled parent — no opinion, see header
  return validChildren.has(child.toLowerCase());
};

/**
 * The set of element names DITA 1.3 permits as a direct child of `parent`,
 * or `null` if `parent` is not modeled (see "Unmodeled parents" above — this
 * is a real "don't know", not an empty set, which would mean "nothing is
 * valid here"). Intended for P2-28/P2-29's `+` menu filtering and P2-37's
 * context-aware insertion (both post-1.0).
 */
export const getValidChildren = (parent: string): ReadonlySet<string> | null =>
  DITA_CONTENT_MODEL[parent.toLowerCase()] ?? null;
