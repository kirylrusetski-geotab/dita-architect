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
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import { roundTrip } from '../helpers/createTestEditor';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const SAMPLED_DIR = join(FIXTURES_DIR, 'sampled');

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

  // v0.10.0 prerequisite (Execution Plan, Session 2): the seven wrap-slice
  // elements (uicontrol, codeph, ph, term, filepath, wintitle, xref) in every
  // context the wrap feature will touch, pinned unedited before the serializer
  // changes.
  it('inline-contexts.dita — seven wrap-slice elements in p, li, note, entry, entry/p, dd, section, shortdesc', () => {
    expectByteStable('inline-contexts.dita');
  });

  it('inline-contexts-trouble.dita — seven wrap-slice elements in condition, cause, cause/note, remedy cmd', () => {
    expectByteStable('inline-contexts-trouble.dita');
  });

  it('corpus completeness — every fixture on disk has a test above', () => {
    // readdirSync on FIXTURES_DIR returns the "sampled" directory entry too,
    // but the .dita filter excludes it (it has no extension) — this checks
    // only the hand-written top-level fixtures, same as always.
    const onDisk = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.dita')).sort();
    const tested = [
      'dl-multi-paragraph-dd.dita',
      'inline-contexts-trouble.dita',
      'inline-contexts.dita',
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

// FR-064 — sampled real-topic corpus. Generated by
// scripts/sample-heretto-corpus.ts (see tests/sync/fixtures/sampled/MANIFEST.md
// for provenance); every .dita file under sampled/** gets one `it` here with
// no hand-written entry required (byte-stability invariant I3). A fixture
// that is known-broken is listed in KNOWN_FAILURES with the bug filed for it
// — that turns its `it` into `it.fails`, so the suite stays green today and
// errors loudly the moment the fix lands (same convention as the hand-written
// corpus above).
//
// relPath is POSIX-style (forward slashes) regardless of host OS, since it is
// also the manifest's join key and the KNOWN_FAILURES lookup key.
function listSampledFixtures(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSampledFixtures(full, base));
    } else if (entry.endsWith('.dita')) {
      out.push(full.slice(base.length + 1).split(sep).join('/'));
    }
  }
  return out.sort();
}

/**
 * relPath (e.g. "task/some-topic.dita") -> the bug(s) filed for its known
 * failure. Found 2026-10-20, FR-064's first run against the live sampled
 * corpus — see the BACKLOG rows for fix direction and severity.
 */
const KNOWN_FAILURES: Record<string, string> = {
  // (BUG-26 — adjacent same-type lists merging on parse — was fixed in
  // v0.10.3 for the same-container case too, with the same boundary-node
  // device ADR-009 already used across a container boundary.
  // external-support-options.dita left this list, byte-stable now.)

  // (BUG-28's three fixtures — external-aux-rear-cam, j1939-ev-mandatory-
  // signals, altitude-api-reuse — left this list in v0.10.1: ADR-011 gave
  // sections identity, and all three now round-trip byte-for-byte.)

  // (BUG-29 — notes, definition lists, and image + <p> in table cells — was
  // fixed in v0.10.2: both its fixtures' cells now round-trip byte-for-byte.
  // What each still differs by is filed below.)

  // (BUG-41 — patchTableElement rewrote <tgroup cols> from the first row's
  // cell count on every serialize, even when nothing changed; this source
  // says cols="1" over two columns, so it always flipped to cols="2" on an
  // unedited round trip. Fixed in v0.10.3: @cols is now rewritten only when
  // the editor's count differs from what the source's first row represents,
  // so this fixture's own mismatch is left exactly as it was.)

  // (BUG-30 — the XML declaration was unconditionally added on serialize
  // even when the source document had none — was fixed in v0.10.3:
  // `installing-the-go-anywhere` and `go10-regulatory-statements` left this
  // list, byte-stable now. `installation-codes` stays below under BUG-31,
  // which it also has.)

  // BUG-31 — serializing the whole cloned document through one
  // XMLSerializer.serializeToString pass re-normalizes empty-element tag
  // syntax (<x></x> -> <x/>) and character-entity choice (&#160; -> the
  // literal character) everywhere, including regions the edit never touched
  // (prolog/metadata). No information is lost — this is syntax-only drift —
  // but it means Gate 1's byte-stability is not actually achievable for any
  // topic with such a construct until the serializer stops doing a whole-
  // document pass.
  'concept/auxiliary-rules.dita': 'BUG-31',
  'concept/hos-status-page.dita': 'BUG-31',
  'reference/driver-safety-scorecard-defaults.dita': 'BUG-31',
  'reference/querytype-getopenendedorigindestinationmatrix.dita': 'BUG-31',
  'task/viewing-the-hos-logs-report.dita': 'BUG-31',
  'troubleshooting-topic/why-cant-i-add-users.dita': 'BUG-31',
  'reference/platform-terms-and-definitions.dita': 'BUG-31',
  'topic/installation-codes.dita': 'BUG-31',
};

describe('byte-stability: sampled real-topic corpus (FR-064)', () => {
  const sampledFixtures = listSampledFixtures(SAMPLED_DIR);

  it('the sampled corpus is non-empty (the sampler ran and wrote fixtures)', () => {
    expect(sampledFixtures.length).toBeGreaterThan(0);
  });

  for (const relPath of sampledFixtures) {
    const bugId = KNOWN_FAILURES[relPath];
    const label = bugId ? `${relPath} — known failure, see ${bugId}` : relPath;
    const runner = bugId ? it.fails : it;
    runner(label, () => {
      expectByteStable(join('sampled', relPath));
    });
  }
});
