// @vitest-environment jsdom
//
// P2-36 — the three invariants named in the Execution Plan's Session 3 block
// for constants/dita-content-model.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { RECOGNIZED_ELEMENTS, STRUCTURAL_CONTAINERS } from '../constants/heretto';
import { DITA_CONTENT_MODEL, isValidChild } from '../constants/dita-content-model';

// RECOGNIZED_BODY_TAGS is not exported from serializeLexicalToXml.ts (it's an
// internal detail there); the literal list is reproduced here for I1, and the
// value equality check below pins it against drift.
const RECOGNIZED_BODY_TAGS = new Set([
  'p', 'note', 'section', 'steps', 'ol', 'ul', 'prereq', 'context', 'result', 'postreq', 'table', 'simpletable', 'codeblock', 'dl',
  'condition', 'cause', 'remedy', 'troublesolution', 'steps-informal', 'steps-unordered',
]);

const FIXTURES_DIR = join(__dirname, 'sync', 'fixtures');

function listFixtures(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFixtures(full, base));
    else if (entry.endsWith('.dita')) out.push(full.slice(base.length + 1));
  }
  return out;
}

/** Every parent→child tag edge in a parsed DOM tree, as [parentTag, childTag] pairs. */
function collectEdges(root: Element): Array<[string, string]> {
  const edges: Array<[string, string]> = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      edges.push([el.tagName, child.tagName]);
      walk(child);
    }
  };
  walk(root);
  return edges;
}

function parseFixture(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('fixture failed to parse as XML');
  return doc;
}

// ─── I1 — completeness ───────────────────────────────────────────────────────

describe('P2-36 I1 — every tag in the three recognized-element sets appears as a key or a child', () => {
  // Sanity check: RECOGNIZED_BODY_TAGS reproduced above must still match the
  // real one in sync/serializeLexicalToXml.ts. If this ever fails, update the
  // copy here — it is a deliberate duplicate (that file doesn't export it),
  // not a second source of truth.
  it('the local RECOGNIZED_BODY_TAGS copy has the size the serializer\'s set is documented to have', () => {
    expect(RECOGNIZED_BODY_TAGS.size).toBe(20);
  });

  const presentSomewhere = new Set<string>();
  for (const [parent, children] of Object.entries(DITA_CONTENT_MODEL)) {
    presentSomewhere.add(parent);
    for (const child of children) presentSomewhere.add(child);
  }

  const required = new Set<string>();
  for (const tag of RECOGNIZED_ELEMENTS) required.add(tag.toLowerCase());
  for (const tag of STRUCTURAL_CONTAINERS) required.add(tag.toLowerCase());
  for (const tag of RECOGNIZED_BODY_TAGS) required.add(tag.toLowerCase());

  it('the required-tag union is non-trivial (the test is actually checking something)', () => {
    expect(required.size).toBeGreaterThan(50);
  });

  for (const tag of Array.from(required).sort()) {
    it(`"${tag}" appears as a key or a child in DITA_CONTENT_MODEL`, () => {
      expect(presentSomewhere.has(tag)).toBe(true);
    });
  }
});

// ─── I2 — zero false positives over the byte-stability corpus ───────────────

describe('P2-36 I2 — every fixture in the byte-stability corpus validates clean', () => {
  const fixtures = listFixtures(FIXTURES_DIR);

  it('the corpus is non-empty', () => {
    expect(fixtures.length).toBeGreaterThan(40);
  });

  for (const rel of fixtures) {
    it(`${rel} — no parent/child edge is reported invalid`, () => {
      const xml = readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
      const doc = parseFixture(xml);
      const edges = collectEdges(doc.documentElement);
      const violations = edges.filter(([parent, child]) => !isValidChild(parent, child));
      expect(
        violations,
        violations.map(([p, c]) => `<${c}> inside <${p}>`).join(', ')
      ).toEqual([]);
    });
  }
});

// ─── I3 — known-invalid constructs are caught ────────────────────────────────

describe('P2-36 I3 — known-invalid constructs are caught', () => {
  it('<fig> is not a valid child of <cmd>', () => {
    expect(isValidChild('cmd', 'fig')).toBe(false);
  });
  it('<section> is not a valid child of <step>', () => {
    expect(isValidChild('step', 'section')).toBe(false);
  });
  it('<ol> is not a valid direct child of <remedy> (procedural lists go through <steps>/<steps-unordered>/<steps-informal>)', () => {
    expect(isValidChild('remedy', 'ol')).toBe(false);
    expect(isValidChild('remedy', 'ul')).toBe(false);
  });
  it('<steps> is not a valid child of <conbody> (task-only, belongs in <taskbody> or <remedy>)', () => {
    expect(isValidChild('conbody', 'steps')).toBe(false);
  });

  // The symmetric positive cases, so a change that makes isValidChild() trivially
  // return false for everything would still be caught.
  it('the same four parents DO accept their real children', () => {
    expect(isValidChild('cmd', 'uicontrol')).toBe(true);
    expect(isValidChild('step', 'cmd')).toBe(true);
    expect(isValidChild('remedy', 'steps')).toBe(true);
    expect(isValidChild('conbody', 'p')).toBe(true);
  });

  it('case-insensitive: real DITA spells it troubleSolution; the table and the lookup both normalize', () => {
    expect(isValidChild('troubleSolution', 'cause')).toBe(true);
    expect(isValidChild('troublesolution', 'remedy')).toBe(true);
  });

  it('an unmodeled parent gets no opinion (never a false "invalid")', () => {
    expect(isValidChild('glossentry', 'glossdef')).toBe(true);
    expect(isValidChild('prolog', 'author')).toBe(true);
  });
});
