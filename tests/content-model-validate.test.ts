// @vitest-environment jsdom
//
// FR-067 / ADR-014 — pre-save content-model validation. Written before the
// code. `validateContentModel` is the pure, synchronous re-check both the
// save-path hook and the API call fresh on the exact string about to be
// written; `MonacoDitaEditor`'s own wiring (woven into the live error panel)
// is covered separately by component-level tests.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  validateContentModel,
  violationMessage,
  summarizeViolations,
  type ContentModelViolation,
} from '../lib/content-model-validate';

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

/** True when a violation's reported {line, column} lands exactly on that
 *  element's own start tag `<element` — the location round-trips, not just exists. */
function locatesOwnTag(xml: string, v: ContentModelViolation): boolean {
  const lines = xml.split('\n');
  const lineText = lines[v.line - 1] ?? '';
  return lineText.slice(v.column - 1).startsWith(`<${v.element}`);
}

const DOC = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="c"><title>T</title><conbody>${body}</conbody></concept>`;

// ─── I1 — zero false positives over the byte-stability corpus ───────────────

describe('I1: the whole byte-stability corpus validates clean', () => {
  const fixtures = listFixtures(FIXTURES_DIR);

  it('the corpus is non-empty (the test is actually checking something)', () => {
    expect(fixtures.length).toBeGreaterThan(40);
  });

  for (const rel of fixtures) {
    it(`${rel} — no violations`, () => {
      const xml = readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
      const violations = validateContentModel(xml);
      expect(violations, violations.map(v => violationMessage(v)).join('; ')).toEqual([]);
    });
  }
});

// ─── I2 — the four P2-36 I3 constructs, each with a message and a location ──

describe('I2: the four known-invalid constructs block with element, parent, and a location that round-trips', () => {
  it('<fig> inside <cmd>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">\n<task id="t"><title>T</title><taskbody><steps><step><cmd>Do this.<fig><title>F</title></fig></cmd></step></steps></taskbody></task>`;
    const violations = validateContentModel(xml);
    expect(violations).toEqual([{ element: 'fig', parent: 'cmd', line: expect.any(Number), column: expect.any(Number) }]);
    expect(violationMessage(violations[0])).toBe('<fig> is not a valid child of <cmd>');
    expect(locatesOwnTag(xml, violations[0])).toBe(true);
  });

  it('<section> inside <step>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">\n<task id="t"><title>T</title><taskbody><steps><step><cmd>Do this.</cmd><section><p>Extra</p></section></step></steps></taskbody></task>`;
    const violations = validateContentModel(xml);
    expect(violations).toEqual([{ element: 'section', parent: 'step', line: expect.any(Number), column: expect.any(Number) }]);
    expect(locatesOwnTag(xml, violations[0])).toBe(true);
  });

  it('a bare <ol> inside <remedy>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">\n<troubleshooting id="ts"><title>T</title><troublebody><troubleSolution><cause><p>C</p></cause><remedy><ol><li>Step one</li></ol></remedy></troubleSolution></troublebody></troubleshooting>`;
    const violations = validateContentModel(xml);
    expect(violations).toEqual([{ element: 'ol', parent: 'remedy', line: expect.any(Number), column: expect.any(Number) }]);
  });

  it('<steps> inside <conbody>', () => {
    const xml = DOC('<steps><step><cmd>Do this.</cmd></step></steps>');
    const violations = validateContentModel(xml);
    expect(violations).toEqual([{ element: 'steps', parent: 'conbody', line: expect.any(Number), column: expect.any(Number) }]);
  });

  it('the same four parents validate clean with their real children (symmetric positive case)', () => {
    expect(validateContentModel(`<?xml version="1.0"?>\n<task id="t"><title>T</title><taskbody><steps><step><cmd>Click <uicontrol>OK</uicontrol>.</cmd></step></steps></taskbody></task>`)).toEqual([]);
    expect(validateContentModel(`<?xml version="1.0"?>\n<troubleshooting id="ts"><title>T</title><troublebody><troubleSolution><cause><p>C</p></cause><remedy><steps><step><cmd>Fix it.</cmd></step></steps></remedy></troubleSolution></troublebody></troubleshooting>`)).toEqual([]);
  });
});

// ─── Message and summary formatting ──────────────────────────────────────────

describe('violationMessage / summarizeViolations', () => {
  const v = (element: string, parent: string, line = 1, column = 1): ContentModelViolation => ({ element, parent, line, column });

  it('one violation', () => {
    expect(summarizeViolations([v('fig', 'cmd', 5, 10)]))
      .toBe('1 structural problem blocks this save: <fig> is not a valid child of <cmd> (line 5). Open the error list in the editor for details.');
  });

  it('two violations: both named', () => {
    expect(summarizeViolations([v('fig', 'cmd', 5, 10), v('section', 'step', 8, 3)]))
      .toBe('2 structural problems block this save: <fig> is not a valid child of <cmd> (line 5) and <section> is not a valid child of <step> (line 8). Open the error list in the editor for details.');
  });

  it('three or more: names the first two, counts the rest', () => {
    expect(summarizeViolations([v('fig', 'cmd', 5, 10), v('section', 'step', 8, 3), v('ol', 'remedy', 12, 1)]))
      .toBe('3 structural problems block this save: <fig> is not a valid child of <cmd> (line 5), <section> is not a valid child of <step> (line 8), and 1 more. Open the error list in the editor for details.');
  });
});

// ─── Robustness: malformed input, unmodeled parents, comments/CDATA/PIs ─────

describe('robustness', () => {
  it('malformed XML returns no violations (not this validator\'s job)', () => {
    expect(validateContentModel('<concept><title>Unclosed')).toEqual([]);
  });

  it('empty input returns no violations', () => {
    expect(validateContentModel('')).toEqual([]);
  });

  it('an unmodeled parent (prolog/metadata) gets no opinion, however it is nested', () => {
    const xml = `<?xml version="1.0"?>\n<concept id="c"><title>T</title><prolog><metadata><keywords><keyword>x</keyword></keywords><othermeta name="a" content="b"/></metadata></prolog><conbody><p>Text.</p></conbody></concept>`;
    expect(validateContentModel(xml)).toEqual([]);
  });

  it('a violation inside a comment, CDATA, or PI is not a real violation (text, not structure)', () => {
    const xml = DOC('<p>Before.</p><!-- <fig><title>not real</title></fig> --><p>After <![CDATA[<fig>also not real</fig>]]> text.</p><?some-pi <fig>pi text</fig>?>');
    expect(validateContentModel(xml)).toEqual([]);
  });

  it('a comment/CDATA/PI before a real violation does not shift its reported location', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">\n<task id="t"><title>T</title><!-- unrelated --><taskbody><steps><step><cmd>Do this.<fig><title>F</title></fig></cmd></step></steps></taskbody></task>`;
    const violations = validateContentModel(xml);
    expect(violations).toHaveLength(1);
    expect(locatesOwnTag(xml, violations[0])).toBe(true);
  });

  it('a violation deep in the tree (not a direct child of the root) is still found', () => {
    const xml = DOC('<p>Click <uicontrol>OK</uicontrol> then see:<section><p>nested ok</p><steps><step><cmd>x</cmd></step></steps></section></p>');
    // <steps> is not valid inside <section> (not in BODY_BLOCK_GROUP's task-step set) — real violation buried three levels deep.
    const violations = validateContentModel(xml);
    expect(violations.map(v => `${v.element}/${v.parent}`)).toContain('steps/section');
  });

  it('multiple violations are reported in document order', () => {
    const xml = `<?xml version="1.0"?>\n<task id="t"><title>T</title><taskbody><steps><step><cmd>a<fig><title>F1</title></fig></cmd><section><p>s</p></section></step></steps></taskbody></task>`;
    const violations = validateContentModel(xml);
    expect(violations.map(v => v.element)).toEqual(['fig', 'section']);
    expect(violations[0].line).toBeLessThanOrEqual(violations[1].line);
  });

  it('mixed-case real DITA (troubleSolution) is both checked case-insensitively and reported with its real spelling', () => {
    const xml = `<?xml version="1.0"?>\n<troubleshooting id="ts"><title>T</title><troublebody><troubleSolution><cause><p>C</p></cause><remedy><ol><li>bad</li></ol></remedy></troubleSolution></troublebody></troubleshooting>`;
    const violations = validateContentModel(xml);
    expect(violations).toEqual([{ element: 'ol', parent: 'remedy', line: expect.any(Number), column: expect.any(Number) }]);
  });

  it('never throws on adversarial input (unterminated comment, stray "<", binary-ish bytes)', () => {
    expect(() => validateContentModel('<concept><!-- unterminated')).not.toThrow();
    expect(() => validateContentModel('<concept>a < b</concept>')).not.toThrow();
    expect(() => validateContentModel('\x00\x01<concept/>')).not.toThrow();
  });

  it('a self-closing violator is still found and located correctly', () => {
    const xml = `<?xml version="1.0"?>\n<task id="t"><title>T</title><taskbody><steps><step><cmd>a</cmd><fig/></step></steps></taskbody></task>`;
    const violations = validateContentModel(xml);
    expect(violations).toEqual([{ element: 'fig', parent: 'step', line: expect.any(Number), column: expect.any(Number) }]);
    expect(locatesOwnTag(xml, violations[0])).toBe(true);
  });
});
