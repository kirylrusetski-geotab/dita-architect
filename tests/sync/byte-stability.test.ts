// @vitest-environment jsdom
//
// FR-047 — Gate 1 enforcement: parse → serialize with ZERO edits must return
// the input byte-for-byte (modulo the single declared normalization below).
// `toContain` assertions elsewhere cannot catch attribute rewrites, dropped
// wrappers, or deleted elements; this suite can.
//
// Known-broken fixtures are marked `it.fails` with their BUG-04 S-ID: the
// suite stays green today, and the moment a fix lands the corresponding
// `it.fails` errors loudly — flip it to `it` in the same change.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { roundTrip } from '../helpers/createTestEditor';

const FIXTURES_DIR = join(__dirname, 'fixtures');

/** The one declared normalization: ignore trailing whitespace at EOF. */
function normalize(xml: string): string {
  return xml.replace(/\s+$/, '');
}

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

function expectByteStable(name: string) {
  const xml = fixture(name);
  expect(normalize(roundTrip(xml))).toBe(normalize(xml));
}

describe('byte-stability: unedited round-trips over the fixture corpus', () => {
  it('task-info.dita — task with prereq/context/steps/info/result/postreq', () => {
    expectByteStable('task-info.dita');
  });

  it('inline-elements.dita — filepath/menucascade/term/cite/ph/nested b+i/xref', () => {
    expectByteStable('inline-elements.dita');
  });

  it('tables.dita — CALS table with mixed cells + simpletable in sections', () => {
    expectByteStable('tables.dita');
  });

  // BUG-04/S3 (in-dd variant): the <note> inside <dd> is force-rewritten —
  // <p class="- topic/p "> wrappers dropped, <uicontrol> attributes stripped.
  it.fails('journey-definition.dita — real Heretto topic (p-wrapped dl, conkeyrefs, table, note) [BUG-04/S3]', () => {
    expectByteStable('journey-definition.dita');
  });

  // BUG-04/S1: the ref-carrying note is DELETED — the serializer's mismatch
  // path removes the DOM node and cannot recreate a ditaphref.
  it.fails('ref-note.dita — body-level <note conkeyref/> [BUG-04/S1]', () => {
    expectByteStable('ref-note.dita');
  });

  // BUG-04/S3: xref-count mismatch (direct children only) forces a rewrite —
  // <p> wrapper dropped, format="dita" rewritten to format="html".
  it.fails('xref-in-note.dita — <note><p>…<xref format="dita"/></p></note> [BUG-04/S3]', () => {
    expectByteStable('xref-in-note.dita');
  });

  // BUG-04/S4: patchBodyChildren has no dl grouping — the <dl> skeleton is
  // destroyed into bare <p> elements.
  it.fails('section-dl.dita — <dl> nested inside <section> [BUG-04/S4]', () => {
    expectByteStable('section-dl.dita');
  });

  it('corpus completeness — every fixture on disk has a test above', () => {
    const onDisk = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.dita')).sort();
    const tested = [
      'inline-elements.dita',
      'journey-definition.dita',
      'ref-note.dita',
      'section-dl.dita',
      'tables.dita',
      'task-info.dita',
      'xref-in-note.dita',
    ].sort();
    expect(onDisk).toEqual(tested);
  });
});
