// ADR-015 decision 1 — the pure half of the review carrier: Heretto's
// suggestion-PI data ↔ TrackedMark, nothing else. Every shape here is one
// observed raw in future-state/heretto-review-pi-grammar.md (both passes).
import { describe, it, expect } from 'vitest';
import {
  parseReviewStart,
  parseReviewEnd,
  markFromReviewStart,
  reviewStartData,
  kindCodeFor,
  listReviewSuggestions,
  REVIEW_START,
  REVIEW_END,
} from '../../lib/tracked-changes/pi-carrier';
import type { TrackedMark } from '../../lib/tracked-changes/model';

const ID = 'd313682d-1ade-4fa5-8e86-2d9514f2e44e';

describe('parseReviewStart — CHANGE_ID:KIND:AUTHOR:TIMESTAMP_MS', () => {
  it('reads the four fields of a start PI exactly as Heretto writes them', () => {
    expect(parseReviewStart(`${ID}:ct-del:author@example.com:1793636289210`)).toEqual({
      changeId: ID,
      kind: 'ct-del',
      author: 'author@example.com',
      dateMs: 1793636289210,
    });
  });

  it('keeps an unknown kind code as data (a comment, or a kind Heretto adds later)', () => {
    expect(parseReviewStart(`${ID}:comment:author@example.com:1779810215353`)?.kind).toBe('comment');
    expect(parseReviewStart(`${ID}:ct-future:author@example.com:1`)?.kind).toBe('ct-future');
  });

  it('tolerates the whitespace a PI node may carry around its data', () => {
    expect(parseReviewStart(` ${ID}:ct-ins:author@example.com:5 `)?.dateMs).toBe(5);
  });

  it('returns null for anything that is not four fields with a numeric timestamp', () => {
    expect(parseReviewStart('')).toBeNull();
    expect(parseReviewStart(ID)).toBeNull();
    expect(parseReviewStart(`${ID}:ct-ins`)).toBeNull();
    expect(parseReviewStart(`${ID}:ct-ins:author@example.com`)).toBeNull();
    expect(parseReviewStart(`${ID}:ct-ins:author@example.com:soon`)).toBeNull();
    expect(parseReviewStart(`:ct-ins:author@example.com:1`)).toBeNull();
  });
});

describe('parseReviewEnd — CHANGE_ID only', () => {
  it('reads the id and trims whitespace', () => {
    expect(parseReviewEnd(ID)).toBe(ID);
    expect(parseReviewEnd(` ${ID} `)).toBe(ID);
  });
  it('returns null for an empty end PI', () => {
    expect(parseReviewEnd('')).toBeNull();
    expect(parseReviewEnd('   ')).toBeNull();
  });
});

describe('markFromReviewStart — the kind table', () => {
  const start = (kind: string) => ({ changeId: ID, kind, author: 'author@example.com', dateMs: 1793636289210 });

  it('maps ct-ins, ct-del, ct-split to insert, delete, split with the date as an ISO string', () => {
    expect(markFromReviewStart(start('ct-ins'))).toEqual<TrackedMark>({
      changeId: ID, kind: 'insert', author: 'author@example.com', date: new Date(1793636289210).toISOString(),
    });
    expect(markFromReviewStart(start('ct-del'))?.kind).toBe('delete');
    expect(markFromReviewStart(start('ct-split'))?.kind).toBe('split');
  });

  it('maps nothing else — a comment is not a suggestion, an unknown code is not guessed at', () => {
    expect(markFromReviewStart(start('comment'))).toBeNull();
    expect(markFromReviewStart(start('ct-future'))).toBeNull();
    expect(markFromReviewStart(start(''))).toBeNull();
  });
});

describe('reviewStartData — writing a mark back', () => {
  const mark: TrackedMark = { changeId: ID, kind: 'delete', author: 'author@example.com', date: new Date(1793636289210).toISOString() };

  it('writes the four fields with the date as epoch milliseconds', () => {
    expect(reviewStartData(mark)).toBe(`${ID}:ct-del:author@example.com:1793636289210`);
    expect(kindCodeFor('insert')).toBe('ct-ins');
    expect(kindCodeFor('delete')).toBe('ct-del');
    expect(kindCodeFor('split')).toBe('ct-split');
  });

  it('round-trips through parse at millisecond precision', () => {
    const back = markFromReviewStart(parseReviewStart(reviewStartData(mark))!);
    expect(back).toEqual(mark);
  });

  it('keeps the four-field grammar when an author contains a colon', () => {
    const odd: TrackedMark = { ...mark, author: 'a:b' };
    const data = reviewStartData(odd);
    expect(data).toBe(`${ID}:ct-del:a_b:1793636289210`);
    expect(parseReviewStart(data)?.author).toBe('a_b');
  });

  it('falls back to now for an unparseable date rather than writing NaN', () => {
    const before = Date.now();
    const data = reviewStartData({ ...mark, date: 'not a date' });
    const ms = Number(data.split(':')[3]);
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBeGreaterThanOrEqual(before);
  });

  it('names the PI targets Heretto uses', () => {
    expect(REVIEW_START).toBe('ezd-review-start');
    expect(REVIEW_END).toBe('ezd-review-end');
  });
});

describe('listReviewSuggestions — every suggestion start PI in a document, from the XML alone', () => {
  const XML = `<concept id="c"><title>T</title><conbody>`
    + `<p>A<?ezd-review-start 1111:ct-ins:a@example.com:10?>x<?ezd-review-end 1111?></p>`
    + `<p><?ezd-review-start 2222:comment:b@example.com:20?>c<?ezd-review-end 2222?></p>`
    + `<p><?ezd-review-start 3333:ct-ins:a@example.com:30?>s<?ezd-review-end 3333?><?ezd-review-start 3333:ct-del:a@example.com:29?>p<?ezd-review-end 3333?></p>`
    + `<p><?ezd-review-start 1111:ct-ins:a@example.com:40?>y<?ezd-review-end 1111?></p>`
    + `</conbody></concept>`;

  it('lists one entry per changeId + kind, in document order, skipping comments and later fragments', () => {
    expect(listReviewSuggestions(XML)).toEqual([
      { changeId: '1111', kind: 'ct-ins', author: 'a@example.com', dateMs: 10 },
      { changeId: '3333', kind: 'ct-ins', author: 'a@example.com', dateMs: 30 },
      { changeId: '3333', kind: 'ct-del', author: 'a@example.com', dateMs: 29 },
    ]);
  });

  it('ignores a malformed start PI and returns nothing for a document without PIs or without XML', () => {
    expect(listReviewSuggestions('<p><?ezd-review-start broken?>x</p>')).toEqual([]);
    expect(listReviewSuggestions('<p>plain</p>')).toEqual([]);
    expect(listReviewSuggestions('')).toEqual([]);
    expect(listReviewSuggestions('<p>not <closed')).toEqual([]);
  });
});
