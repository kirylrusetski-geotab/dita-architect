// @vitest-environment jsdom
//
// FR-045 — computeProposedXml: the deterministic XML-level transform behind
// the Monaco-diff review surface. Core contract: untouched document content is
// byte-identical in the output (string splice, never DOM re-serialization),
// and validation runs before any success is reported.
import { describe, it, expect } from 'vitest';
import { computeProposedXml } from '../lib/xml-insert';

const CONCEPT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1">
  <title>Test</title>
  <conbody>
    <p id="p1">First paragraph.</p>
    <p id="p2">Second paragraph.</p>
  </conbody>
</concept>`;

const TASK = `<?xml version="1.0" encoding="UTF-8"?>
<task id="t1">
  <title>Task</title>
  <taskbody>
    <steps id="steps1">
      <step><cmd>Do it.</cmd></step>
    </steps>
  </taskbody>
</task>`;

const REFERENCE = `<?xml version="1.0" encoding="UTF-8"?>
<reference id="r1">
  <title>Ref</title>
  <refbody>
    <section id="s1"><p>Existing.</p></section>
  </refbody>
</reference>`;

const TOPIC = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="tp1">
  <title>Topic</title>
  <body>
    <p id="p1">Body text.</p>
  </body>
</topic>`;

function ok(result: ReturnType<typeof computeProposedXml>): string {
  if ('error' in result) throw new Error(`Expected success, got error: ${result.error}`);
  return result.proposedXml;
}

function err(result: ReturnType<typeof computeProposedXml>): string {
  if (!('error' in result)) throw new Error('Expected error, got success');
  return result.error;
}

describe('computeProposedXml — append path', () => {
  it('appends a <p> before </conbody>', () => {
    const out = ok(computeProposedXml(CONCEPT, '<p>New paragraph.</p>'));
    expect(out).toContain('<p>New paragraph.</p>');
    expect(out.indexOf('<p>New paragraph.</p>')).toBeGreaterThan(out.indexOf('Second paragraph.'));
    expect(out.indexOf('<p>New paragraph.</p>')).toBeLessThan(out.indexOf('</conbody>'));
  });

  it('appends before </taskbody>, </refbody>, and </body>', () => {
    for (const doc of [TASK, REFERENCE, TOPIC]) {
      const out = ok(computeProposedXml(doc, '<note>Appended.</note>'));
      const closer = doc.match(/<\/(conbody|taskbody|refbody|body)>/)![0];
      expect(out.indexOf('<note>Appended.</note>')).toBeLessThan(out.indexOf(closer));
    }
  });

  it('byte-stability: everything except the inserted region is unchanged', () => {
    const out = ok(computeProposedXml(CONCEPT, '<p>Spliced.</p>'));
    const closerLineStart = CONCEPT.lastIndexOf('\n', CONCEPT.indexOf('</conbody>')) + 1;
    expect(out.slice(0, closerLineStart)).toBe(CONCEPT.slice(0, closerLineStart));
    expect(out.slice(out.indexOf('</conbody>'))).toBe(CONCEPT.slice(CONCEPT.indexOf('</conbody>')));
  });

  it('indents the inserted block to match body children', () => {
    const out = ok(computeProposedXml(CONCEPT, '<p>Indented.</p>'));
    expect(out).toContain('\n    <p>Indented.</p>\n');
  });

  it('inserts a multi-block fragment in order', () => {
    const out = ok(computeProposedXml(CONCEPT, '<p>One.</p><note>Two.</note><codeblock>Three</codeblock>'));
    const i1 = out.indexOf('<p>One.</p>');
    const i2 = out.indexOf('<note>Two.</note>');
    const i3 = out.indexOf('<codeblock>Three</codeblock>');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });

  it('unwraps <section>: children inserted, section wrapper dropped', () => {
    const out = ok(computeProposedXml(CONCEPT, '<section><p>Inner one.</p><p>Inner two.</p></section>'));
    expect(out).toContain('<p>Inner one.</p>');
    expect(out).toContain('<p>Inner two.</p>');
    expect(out.match(/<section/g)).toBeNull();
  });

  it('accepts fig, image, and example fragments (S5 acceptance)', () => {
    const out = ok(
      computeProposedXml(
        CONCEPT,
        '<fig><title>F</title><image href="a.png"/></fig><example><p>Ex.</p></example>',
      ),
    );
    expect(out).toContain('<fig>');
    expect(out).toContain('<image href="a.png"/>');
    expect(out).toContain('<example>');
  });
});

describe('computeProposedXml — replace path', () => {
  it('replaces the element with the given id', () => {
    const out = ok(computeProposedXml(CONCEPT, '<p>Replacement.</p>', 'p2'));
    expect(out).toContain('<p>Replacement.</p>');
    expect(out).not.toContain('Second paragraph.');
    expect(out).toContain('First paragraph.');
  });

  it('byte-stability: content before and after the replaced element is unchanged', () => {
    const start = CONCEPT.indexOf('<p id="p2">');
    const end = CONCEPT.indexOf('</p>', start) + '</p>'.length;
    const out = ok(computeProposedXml(CONCEPT, '<p>Swap.</p>', 'p2'));
    expect(out.slice(0, start)).toBe(CONCEPT.slice(0, start));
    expect(out.slice(out.indexOf('<p>Swap.</p>') + '<p>Swap.</p>'.length)).toBe(CONCEPT.slice(end));
  });

  it('handles nested same-tag elements (ul inside ul)', () => {
    const doc = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="c2">
  <title>Nested</title>
  <conbody>
    <ul id="outer">
      <li>Item<ul id="inner"><li>Nested item</li></ul></li>
    </ul>
    <p id="after">After.</p>
  </conbody>
</concept>`;
    const out = ok(computeProposedXml(doc, '<p>Was a list.</p>', 'outer'));
    expect(out).not.toContain('Nested item');
    expect(out).toContain('<p>Was a list.</p>');
    expect(out).toContain('<p id="after">After.</p>');
  });

  it('replaces a self-closing element', () => {
    const doc = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="c3">
  <title>Img</title>
  <conbody>
    <image id="img1" href="old.png"/>
    <p id="p1">Text.</p>
  </conbody>
</concept>`;
    const out = ok(computeProposedXml(doc, '<image href="new.png"/>', 'img1'));
    expect(out).toContain('<image href="new.png"/>');
    expect(out).not.toContain('old.png');
    expect(out).toContain('<p id="p1">Text.</p>');
  });

  it('errors when replaceId is not found (no silent append)', () => {
    expect(err(computeProposedXml(CONCEPT, '<p>X.</p>', 'nope'))).toContain('nope');
  });

  it('errors when multiple elements share the id', () => {
    const doc = CONCEPT.replace('id="p2"', 'id="p1"');
    expect(err(computeProposedXml(doc, '<p>X.</p>', 'p1'))).toContain('Multiple');
  });
});

describe('computeProposedXml — validation gates', () => {
  it('rejects a disallowed top-level element', () => {
    expect(err(computeProposedXml(CONCEPT, '<danger>Nope</danger>'))).toContain('danger');
  });

  it('rejects a malformed fragment', () => {
    expect(err(computeProposedXml(CONCEPT, '<p>Unclosed'))).toContain('well-formed');
  });

  it('rejects an empty fragment', () => {
    expect(err(computeProposedXml(CONCEPT, '   '))).toContain('empty');
  });

  it('rejects a text-only fragment', () => {
    expect(err(computeProposedXml(CONCEPT, 'just text'))).toContain('no elements');
  });

  it('rejects a malformed current document', () => {
    expect(err(computeProposedXml('<concept><broken', '<p>X.</p>'))).toContain('not well-formed');
  });

  it('rejects when the document has no body element', () => {
    const noBody = '<?xml version="1.0"?>\n<concept id="nb"><title>T</title></concept>';
    expect(err(computeProposedXml(noBody, '<p>X.</p>'))).toContain('No <conbody>');
  });
});
