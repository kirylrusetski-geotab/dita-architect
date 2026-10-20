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

  // Fixed in Session 4A (ADR-006): whitespace-insensitive untouched-detection
  // for flattened block-children elements preserves the in-dd note.
  it('journey-definition.dita — real Heretto topic (p-wrapped dl, conkeyrefs, table, note) [BUG-04/S3]', () => {
    expectByteStable('journey-definition.dita');
  });

  // Fixed in Session 4A (ADR-006): non-recreatable node contract — the
  // note↔ditaphref pairing preserves the DOM element byte-stable.
  it('ref-note.dita — body-level <note conkeyref/> [BUG-04/S1]', () => {
    expectByteStable('ref-note.dita');
  });

  // Fixed in Session 4A (ADR-006): recursive xref counting removes the false
  // mismatch that forced the rewrite.
  it('xref-in-note.dita — <note><p>…<xref format="dita"/></p></note> [BUG-04/S3]', () => {
    expectByteStable('xref-in-note.dita');
  });

  // Fixed in Session 4A (ADR-006): the unified walk carries dl grouping into
  // sections.
  it('section-dl.dita — <dl> nested inside <section> [BUG-04/S4]', () => {
    expectByteStable('section-dl.dita');
  });

  // Fixed in Session 4B (M4): multi-paragraph <dd> round-trips without
  // duplicating paragraphs.
  it('dl-multi-paragraph-dd.dita — <dd> with two <p> elements [BUG-04/M4]', () => {
    expectByteStable('dl-multi-paragraph-dd.dita');
  });

  // P2-25 slice 1 / ADR-009 — troubleshooting topics. The skeleton is a real
  // Heretto topic (empty placeholders, trailing self-closed <cause/>, whitespace
  // -only <p>); the rich one exercises titled containers, a <p> that wraps a
  // <ul>, <steps-unordered> with <info>, <steps-informal>, and three
  // <troubleSolution>s so container ordinals matter.
  it('troubleshooting-skeleton.dita — real Heretto troubleshooting topic with empty containers', () => {
    expectByteStable('troubleshooting-skeleton.dita');
  });

  it('troubleshooting-rich.dita — titled condition/remedy, nested solutions, all three step list kinds', () => {
    expectByteStable('troubleshooting-rich.dita');
  });

  it('corpus completeness — every fixture on disk has a test above', () => {
    const onDisk = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.dita')).sort();
    const tested = [
      'dl-multi-paragraph-dd.dita',
      'inline-elements.dita',
      'journey-definition.dita',
      'ref-note.dita',
      'section-dl.dita',
      'tables.dita',
      'task-info.dita',
      'troubleshooting-rich.dita',
      'troubleshooting-skeleton.dita',
      'xref-in-note.dita',
    ].sort();
    expect(onDisk).toEqual(tested);
  });
});
