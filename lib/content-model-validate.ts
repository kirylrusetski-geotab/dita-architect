// FR-067 / ADR-014 — pre-save content-model validation.
//
// A pure, synchronous check of a serialized document against the DITA 1.3
// content model (constants/dita-content-model.ts, P2-36). Called from two
// places for two different reasons (ADR-014 decisions 2–3): woven into
// MonacoDitaEditor's own validateDita, so a violation is always live in the
// existing error panel; and again, independently, at the instant of
// Save/Replace/the API save, since the live panel is debounced and can be
// stale at the exact moment the author clicks Save.
import { isValidChild } from '../constants/dita-content-model';

export interface ContentModelViolation {
  /** The child's tag name, spelled exactly as written in the source. */
  element: string;
  /** The parent's tag name, spelled exactly as written in the source. */
  parent: string;
  /** 1-based, matching Monaco's marker convention (startLineNumber). */
  line: number;
  /** 1-based, matching Monaco's marker convention (startColumn). */
  column: number;
}

/** A start tag's name and its offset (index of the leading `<`) in document order. */
interface TagOccurrence {
  tagName: string;
  offset: number;
}

// Matches, in order of preference at each position: a comment, a CDATA
// section, a processing instruction, a DOCTYPE declaration (consumed so
// nothing inside any of them is mistaken for a tag), or a start/end tag's
// opening `<` plus name. Mirrors sync/structure-check.ts's markup scan.
const TAG_SCAN_RE =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^[>]*(?:\[[^\]]*\])?\s*>|<\/?([A-Za-z][\w.-]*)/g;

const scanStartTags = (xml: string): TagOccurrence[] => {
  const tags: TagOccurrence[] = [];
  for (const m of xml.matchAll(TAG_SCAN_RE)) {
    const tagName = m[1];
    // An end tag (`</foo`) matches the same alternative; its `/` sits right
    // after the `<` this match started at.
    if (tagName && xml[m.index! + 1] !== '/') {
      tags.push({ tagName, offset: m.index! });
    }
  }
  return tags;
};

const domPreOrder = (root: Element): Element[] => {
  const out: Element[] = [];
  const visit = (el: Element) => {
    out.push(el);
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
  return out;
};

/** Newline offsets, precomputed once so every location lookup is O(log n). */
const newlineOffsets = (text: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) out.push(i);
  return out;
};

const offsetToPosition = (offsets: number[], offset: number): { line: number; column: number } => {
  // Largest newline offset strictly before `offset` (binary search).
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] < offset) lo = mid + 1;
    else hi = mid;
  }
  const lastNewline = lo > 0 ? offsets[lo - 1] : -1;
  return { line: lo + 1, column: offset - lastNewline };
};

/**
 * Every direct parent→child edge in `xml` the content model rejects.
 * Returns `[]` for malformed XML — that is validateDitaXml's job, not this
 * validator's — and never throws.
 */
export const validateContentModel = (xml: string): ContentModelViolation[] => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  const root = doc.documentElement;
  if (!root) return [];

  const elements = domPreOrder(root);
  const tags = scanStartTags(xml);

  // Pre-order DOM traversal visits elements in the same order their start
  // tags appear in the source, for ordinary (unnamespaced) XML — so the i-th
  // element corresponds to the i-th scanned start tag. Verified by tag-name
  // equality at each position; any mismatch abandons locations for the whole
  // call rather than ever reporting a wrong one.
  let locatable = elements.length === tags.length;
  if (locatable) {
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].tagName !== tags[i].tagName) { locatable = false; break; }
    }
  }
  if (!locatable) {
    console.warn('[content-model-validate] tag scan did not line up with the DOM; locations unavailable for this document');
  }
  const offsets = locatable ? newlineOffsets(xml) : [];
  const indexOfElement = new Map<Element, number>();
  elements.forEach((el, i) => indexOfElement.set(el, i));

  const violations: ContentModelViolation[] = [];
  for (const el of elements) {
    for (const child of Array.from(el.children)) {
      if (isValidChild(el.tagName, child.tagName)) continue;
      const childIndex = indexOfElement.get(child);
      const position = locatable && childIndex !== undefined
        ? offsetToPosition(offsets, tags[childIndex].offset)
        : { line: 1, column: 1 };
      violations.push({ element: child.tagName, parent: el.tagName, ...position });
    }
  }
  // The walk finds violations in the order each PARENT is visited, not the
  // order each violating element's own tag appears in the source (a parent
  // can be visited before an earlier sibling's descendant that is itself a
  // parent with a violation). Sort by location so the list reads the way a
  // human scanning the document would expect.
  violations.sort((a, b) => a.line - b.line || a.column - b.column);
  return violations;
};

export const violationMessage = (v: ContentModelViolation): string =>
  `<${v.element}> is not a valid child of <${v.parent}>`;

/** One-line text for a surface with no room for the full list (a toast, HerettoReplaceModal's error line). */
export const summarizeViolations = (violations: ContentModelViolation[]): string => {
  if (violations.length === 0) return '';
  const named = (v: ContentModelViolation) => `${violationMessage(v)} (line ${v.line})`;
  const count = violations.length;
  const lead = `${count} structural ${count === 1 ? 'problem' : 'problems'} ${count === 1 ? 'blocks' : 'block'} this save: `;
  let body: string;
  if (count === 1) {
    body = named(violations[0]);
  } else if (count === 2) {
    body = `${named(violations[0])} and ${named(violations[1])}`;
  } else {
    body = `${named(violations[0])}, ${named(violations[1])}, and ${count - 2} more`;
  }
  return `${lead}${body}. Open the error list in the editor for details.`;
};
