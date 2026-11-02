// ADR-015 — the review carrier's pure half: Heretto's suggestion-PI data
// <-> TrackedMark. Only shapes observed raw in
// future-state/heretto-review-pi-grammar.md are mapped; everything else is
// reported as data and left to the caller to preserve untouched.
//
//   <?ezd-review-start CHANGE_ID:KIND:AUTHOR:TIMESTAMP_MS?> ... <?ezd-review-end CHANGE_ID?>
import type { TrackedKind, TrackedMark } from './model';

export const REVIEW_START = 'ezd-review-start';
export const REVIEW_END = 'ezd-review-end';

/** The four fields of a start PI, as written. `kind` is the raw code. */
export interface ReviewStart {
  changeId: string;
  kind: string;
  author: string;
  dateMs: number;
}

// The author is the greedy middle: an email never holds a colon, and a
// written author has its colons replaced (reviewStartData), but a future
// Heretto field would still parse rather than fail.
const START_RE = /^([^:\s]+):([^:\s]+):(.*):(\d+)$/;

export const parseReviewStart = (data: string): ReviewStart | null => {
  const m = START_RE.exec(data.trim());
  if (!m) return null;
  return { changeId: m[1], kind: m[2], author: m[3], dateMs: Number(m[4]) };
};

export const parseReviewEnd = (data: string): string | null => {
  const id = data.trim();
  return id ? id : null;
};

const CODE_FOR_KIND: Record<TrackedKind, string> = { insert: 'ct-ins', delete: 'ct-del', split: 'ct-split' };
const KIND_FOR_CODE: Record<string, TrackedKind> = { 'ct-ins': 'insert', 'ct-del': 'delete', 'ct-split': 'split' };

export const kindCodeFor = (kind: TrackedKind): string => CODE_FOR_KIND[kind];
export const kindForCode = (code: string): TrackedKind | null => KIND_FOR_CODE[code] ?? null;

/** A Heretto `comment` wraps a commented range; it is review data, not a suggestion. */
export const isCommentKind = (code: string): boolean => code === 'comment';

export const markFromReviewStart = (start: ReviewStart): TrackedMark | null => {
  const kind = kindForCode(start.kind);
  if (!kind) return null;
  return { changeId: start.changeId, kind, author: start.author, date: new Date(start.dateMs).toISOString() };
};

export const reviewStartData = (mark: TrackedMark): string => {
  const parsed = Date.parse(mark.date);
  const ms = Number.isFinite(parsed) ? parsed : Date.now();
  return `${mark.changeId}:${kindCodeFor(mark.kind)}:${mark.author.replace(/:/g, '_')}:${ms}`;
};

// Comments and CDATA first so a PI quoted inside one is not counted.
const PI_SCAN_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?ezd-review-start\s+([^?]*)\?>/g;

/**
 * Every suggestion start PI in a document, from the XML alone: one entry per
 * changeId + kind in document order (later fragments of the same suggestion
 * are the same entry), comments excluded.
 */
export const listReviewSuggestions = (xml: string): ReviewStart[] => {
  const out: ReviewStart[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(PI_SCAN_RE)) {
    if (m[1] === undefined) continue;
    const start = parseReviewStart(m[1]);
    if (!start || isCommentKind(start.kind)) continue;
    const key = `${start.changeId}\u0000${start.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(start);
  }
  return out;
};

/** The suggestions in `xml` that the editor did not turn into marks (ADR-015 decision 3). */
export const listUnsupportedSuggestions = (xml: string, mappedChangeIds: ReadonlySet<string>): ReviewStart[] =>
  listReviewSuggestions(xml).filter(s => !mappedChangeIds.has(s.changeId));
