// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createEditor, $getRoot, $createTextNode } from 'lexical';
import { $createLinkNode } from '@lexical/link';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { DitaOpaqueNode } from '../../components/DitaOpaqueNode';
import { DitaCodeBlockNode } from '../../components/DitaCodeBlockNode';
import { DitaImageNode } from '../../components/DitaImageNode';
import { DitaPhRefNode } from '../../components/DitaPhRefNode';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';

// ─── Editor factory ───────────────────────────────────────────────────────────

function createTestEditor() {
  return createEditor({
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      DitaOpaqueNode,
      DitaCodeBlockNode,
      DitaImageNode,
      DitaPhRefNode,
    ],
  });
}

// ─── XML comparison helpers ───────────────────────────────────────────────────

function normalizeXml(xml: string): string {
  // Remove xml declaration and doctype for comparison
  let normalized = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
  normalized = normalized.replace(/<!DOCTYPE[^[>]*(?:\[[^\]]*\])?\s*>\s*/g, '');
  // Collapse whitespace between tags
  normalized = normalized.replace(/>\s+</g, '><');
  // Trim leading/trailing whitespace
  return normalized.trim();
}

function getBodyContent(xml: string): string {
  // Extract just the body element content for comparison
  const match = xml.match(/<(?:taskbody|conbody|refbody|body)>([\s\S]*?)<\/(?:taskbody|conbody|refbody|body)>/);
  return match ? normalizeXml(match[1]) : '';
}

function expectBodyContains(xml: string, fragment: string) {
  const body = getBodyContent(xml);
  expect(body).toContain(normalizeXml(fragment));
}

// ─── Round-trip helper ────────────────────────────────────────────────────────

function roundTrip(xml: string): string {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();

  parseXmlToLexical(xml, editor, originMap, true);

  const editorState = editor.getEditorState();
  return serializeLexicalToXml(editorState, xml, originMap, cache);
}

// ─── describe: round-trip: task topics ───────────────────────────────────────

describe('round-trip: task topics', () => {
  it('basic task with title, shortdesc, and steps', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="install-widget">
  <title>Install the Widget</title>
  <shortdesc>Install the widget on your system.</shortdesc>
  <taskbody>
    <steps>
      <step><cmd>Download the installer.</cmd></step>
      <step><cmd>Run the installer.</cmd></step>
      <step><cmd>Restart your computer.</cmd></step>
    </steps>
  </taskbody>
</task>`;

    const output = roundTrip(xml);

    expect(output).toContain('<title>Install the Widget</title>');
    expect(output).toContain('<shortdesc>Install the widget on your system.</shortdesc>');
    expect(output).toContain('<steps>');
    expect(output).toContain('<step>');
    expect(output).toContain('<cmd>Download the installer.</cmd>');
    expect(output).toContain('<cmd>Run the installer.</cmd>');
    expect(output).toContain('<cmd>Restart your computer.</cmd>');
    expect(output).toContain('</steps>');
    // DOCTYPE and XML declaration must be preserved
    expect(output).toContain('<?xml');
    expect(output).toContain('<!DOCTYPE task');
  });

  it('task with prereq, context, result, postreq', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="configure-widget">
  <title>Configure the Widget</title>
  <shortdesc>Configure the widget to suit your needs.</shortdesc>
  <taskbody>
    <prereq>You must have the widget installed.</prereq>
    <context>This task explains how to configure settings.</context>
    <steps>
      <step><cmd>Open the settings panel.</cmd></step>
    </steps>
    <result>The widget is now configured.</result>
    <postreq>Restart the application.</postreq>
  </taskbody>
</task>`;

    const output = roundTrip(xml);

    expect(output).toContain('<prereq>You must have the widget installed.</prereq>');
    expect(output).toContain('<context>This task explains how to configure settings.</context>');
    expect(output).toContain('<result>The widget is now configured.</result>');
    expect(output).toContain('<postreq>Restart the application.</postreq>');
    expect(output).toContain('<steps>');
    expect(output).toContain('<cmd>Open the settings panel.</cmd>');
  });

  it('task with section', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="advanced-task">
  <title>Advanced Task</title>
  <taskbody>
    <section>
      <title>Background</title>
      <p>This section provides background information.</p>
    </section>
  </taskbody>
</task>`;

    const output = roundTrip(xml);

    expect(output).toContain('<section>');
    expect(output).toContain('<title>Background</title>');
    expect(output).toContain('This section provides background information.');
    expect(output).toContain('</section>');
    // The task title should also be present
    expect(output).toContain('<title>Advanced Task</title>');
  });
});

// ─── describe: round-trip: concept topics ────────────────────────────────────

describe('round-trip: concept topics', () => {
  it('concept with paragraphs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="widget-overview">
  <title>Widget Overview</title>
  <shortdesc>An overview of the widget.</shortdesc>
  <conbody>
    <p>The widget is a versatile tool.</p>
    <p>It can be used for many purposes.</p>
    <p>Read on to learn more.</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<!DOCTYPE concept');
    expect(output).toContain('<concept id="widget-overview">');
    expect(output).toContain('<title>Widget Overview</title>');
    expect(output).toContain('<shortdesc>An overview of the widget.</shortdesc>');
    expect(output).toContain('<p>The widget is a versatile tool.</p>');
    expect(output).toContain('<p>It can be used for many purposes.</p>');
    expect(output).toContain('<p>Read on to learn more.</p>');
  });

  it('concept with unordered list', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="widget-features">
  <title>Widget Features</title>
  <conbody>
    <ul>
      <li>Fast performance</li>
      <li>Easy setup</li>
      <li>Cross-platform support</li>
    </ul>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<ul>');
    expect(output).toContain('<li>Fast performance</li>');
    expect(output).toContain('<li>Easy setup</li>');
    expect(output).toContain('<li>Cross-platform support</li>');
    expect(output).toContain('</ul>');
  });
});

// ─── describe: round-trip: inline formatting ──────────────────────────────────

describe('round-trip: inline formatting', () => {
  function conceptWithParagraph(pContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="test">
  <title>Test</title>
  <conbody>
    <p>${pContent}</p>
  </conbody>
</concept>`;
  }

  it('bold text', () => {
    const xml = conceptWithParagraph('Hello <b>world</b>');
    const output = roundTrip(xml);
    expectBodyContains(output, '<p>Hello <b>world</b></p>');
  });

  it('italic text', () => {
    const xml = conceptWithParagraph('Hello <i>world</i>');
    const output = roundTrip(xml);
    expectBodyContains(output, '<p>Hello <i>world</i></p>');
  });

  it('code phrase', () => {
    const xml = conceptWithParagraph('Use <codeph>git commit</codeph> to save');
    const output = roundTrip(xml);
    expectBodyContains(output, '<p>Use <codeph>git commit</codeph> to save</p>');
  });

  it('mixed formatting', () => {
    const xml = conceptWithParagraph('Hello <b>bold</b> and <i>italic</i> and <codeph>code</codeph>');
    const output = roundTrip(xml);
    const body = getBodyContent(output);
    expect(body).toContain('<b>bold</b>');
    expect(body).toContain('<i>italic</i>');
    expect(body).toContain('<codeph>code</codeph>');
    expect(body).toContain('Hello');
    expect(body).toContain('and');
  });

  it('xref link', () => {
    const xml = conceptWithParagraph('See <xref href="http://example.com" format="html">here</xref>');
    const output = roundTrip(xml);
    const body = getBodyContent(output);
    expect(body).toContain('<xref');
    expect(body).toContain('href="http://example.com"');
    expect(body).toContain('here');
  });
});

// ─── describe: round-trip: lists ─────────────────────────────────────────────

describe('round-trip: lists', () => {
  it('ordered list', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="ordered-list-test">
  <title>Ordered List</title>
  <conbody>
    <ol>
      <li>First</li>
      <li>Second</li>
    </ol>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expectBodyContains(output, '<ol><li>First</li><li>Second</li></ol>');
  });

  it('unordered list', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="unordered-list-test">
  <title>Unordered List</title>
  <conbody>
    <ul>
      <li>Apple</li>
      <li>Banana</li>
    </ul>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expectBodyContains(output, '<ul><li>Apple</li><li>Banana</li></ul>');
  });
});

// ─── describe: round-trip: tables ────────────────────────────────────────────

describe('round-trip: tables', () => {
  it('CALS table', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="table-test">
  <title>Table Test</title>
  <conbody>
    <table>
      <tgroup cols="2">
        <thead>
          <row>
            <entry>H1</entry>
            <entry>H2</entry>
          </row>
        </thead>
        <tbody>
          <row>
            <entry>A</entry>
            <entry>B</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<table>');
    expect(output).toContain('<tgroup');
    expect(output).toContain('<thead>');
    expect(output).toContain('<tbody>');
    expect(output).toContain('H1');
    expect(output).toContain('H2');
    expect(output).toContain('A');
    expect(output).toContain('B');
    expect(output).toContain('</table>');
  });

  it('simple table', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="simpletable-test">
  <title>Simpletable Test</title>
  <conbody>
    <simpletable>
      <sthead>
        <stentry>Col1</stentry>
        <stentry>Col2</stentry>
      </sthead>
      <strow>
        <stentry>A</stentry>
        <stentry>B</stentry>
      </strow>
    </simpletable>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<simpletable>');
    expect(output).toContain('<sthead>');
    expect(output).toContain('<strow>');
    expect(output).toContain('Col1');
    expect(output).toContain('Col2');
    expect(output).toContain('A');
    expect(output).toContain('B');
  });
});

// ─── describe: round-trip: special elements ───────────────────────────────────

describe('round-trip: special elements', () => {
  it('note element maps to Lexical quote and back', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="note-test">
  <title>Note Test</title>
  <conbody>
    <note>Important notice</note>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expectBodyContains(output, '<note>Important notice</note>');
  });

  it('codeblock with outputclass language attribute', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="codeblock-test">
  <title>Codeblock Test</title>
  <conbody>
    <codeblock outputclass="javascript">const x = 1;</codeblock>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expectBodyContains(output, '<codeblock outputclass="javascript">const x = 1;</codeblock>');
  });
});

// ─── describe: round-trip: content preservation ──────────────────────────────

describe('round-trip: content preservation', () => {
  it('processing instructions adjacent to body content are preserved', () => {
    // The parser skips PIs from the Lexical model, but the serializer
    // preserves PIs already in the DOM element by re-appending them.
    // This test verifies the PI survives in elements where text content
    // has not changed (PI-adjacent elements).
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="pi-test">
  <title>PI Test</title>
  <conbody>
    <p><?oxy_comment_start author="alice" comment="review this"?>Reviewed text<?oxy_comment_end?></p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    // The paragraph text content should survive
    expect(output).toContain('Reviewed text');
    // Processing instructions should be preserved (serializer re-appends them)
    expect(output).toContain('oxy_comment_start');
    expect(output).toContain('oxy_comment_end');
  });

  it('unrecognized elements with text content are preserved as opaque nodes', () => {
    // The <data> element is not recognized by the parser; it creates a DitaOpaqueNode.
    // The serializer skips opaque/image nodes (they are preserved from the original DOM clone).
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="opaque-test">
  <title>Opaque Test</title>
  <conbody>
    <data name="version">2.0</data>
    <p>Regular paragraph</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    // The <data> element should be preserved from the original DOM clone
    expect(output).toContain('<data');
    expect(output).toContain('2.0');
    // Regular content should still be present
    expect(output).toContain('<p>Regular paragraph</p>');
  });
});

// ─── describe: patchBodyChildren edge cases ───────────────────────────────────

describe('patchBodyChildren edge cases', () => {
  it('serializing 2 paragraphs produces both paragraphs in output', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="two-paras">
  <title>Two Paragraphs</title>
  <conbody>
    <p>First paragraph</p>
    <p>Second paragraph</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<p>First paragraph</p>');
    expect(output).toContain('<p>Second paragraph</p>');

    // Verify both paragraphs appear in proper order
    const firstIdx = output.indexOf('<p>First paragraph</p>');
    const secondIdx = output.indexOf('<p>Second paragraph</p>');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(-1);
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('single paragraph round-trips correctly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="single-para">
  <title>Single Para</title>
  <conbody>
    <p>Only paragraph</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expectBodyContains(output, '<p>Only paragraph</p>');
  });

  it('type change: note (quote) among paragraphs is serialized as note', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="mixed-types">
  <title>Mixed Types</title>
  <conbody>
    <p>Before note</p>
    <note>This is a note</note>
    <p>After note</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<p>Before note</p>');
    expect(output).toContain('<note>This is a note</note>');
    expect(output).toContain('<p>After note</p>');
  });
});

// ─── Additional structural fidelity tests ────────────────────────────────────

describe('round-trip: structural fidelity', () => {
  it('preserves XML declaration encoding', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="enc-test">
  <title>Encoding Test</title>
  <taskbody>
    <p>Content here</p>
  </taskbody>
</task>`;

    const output = roundTrip(xml);
    expect(output).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('preserves original DOCTYPE verbatim', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="doctype-test">
  <title>DOCTYPE Test</title>
  <conbody>
    <p>Content</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expect(output).toContain('<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">');
  });

  it('preserves topic root element id attribute', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="preserve-id-test">
  <title>ID Preservation</title>
  <taskbody>
    <p>Content</p>
  </taskbody>
</task>`;

    const output = roundTrip(xml);
    expect(output).toContain('id="preserve-id-test"');
  });

  it('reference topic uses refbody', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="ref-test">
  <title>API Reference</title>
  <refbody>
    <p>Reference content</p>
  </refbody>
</reference>`;

    const output = roundTrip(xml);
    expect(output).toContain('<!DOCTYPE reference');
    expect(output).toContain('<reference id="ref-test">');
    expect(output).toContain('<refbody>');
    expect(output).toContain('<p>Reference content</p>');
    expect(output).toContain('</refbody>');
  });

  it('task steps are serialized as steps (not ol) in task topics', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="steps-test">
  <title>Steps Task</title>
  <taskbody>
    <steps>
      <step><cmd>Step one</cmd></step>
      <step><cmd>Step two</cmd></step>
    </steps>
  </taskbody>
</task>`;

    const output = roundTrip(xml);

    // In a task topic, numbered lists are <steps>/<step>/<cmd>, not <ol>/<li>
    expect(output).toContain('<steps>');
    expect(output).toContain('<step>');
    expect(output).toContain('<cmd>Step one</cmd>');
    expect(output).toContain('<cmd>Step two</cmd>');
    expect(output).not.toContain('<ol>');
  });

  it('concept ordered list uses ol/li (not steps)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="ol-test">
  <title>OL Test</title>
  <conbody>
    <ol>
      <li>Step one</li>
      <li>Step two</li>
    </ol>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    // In a concept topic, ordered lists stay as <ol>/<li>
    expect(output).toContain('<ol>');
    expect(output).toContain('<li>Step one</li>');
    expect(output).toContain('<li>Step two</li>');
    expect(output).not.toContain('<steps>');
  });

  it('empty shortdesc round-trips correctly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="shortdesc-test">
  <title>Short Desc Test</title>
  <shortdesc>This is the short description.</shortdesc>
  <conbody>
    <p>Body content</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    expect(output).toContain('<shortdesc>This is the short description.</shortdesc>');
  });

  it('codeblock without outputclass round-trips without spurious attribute', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="codeblock-no-lang">
  <title>Codeblock No Lang</title>
  <conbody>
    <codeblock>plain code here</codeblock>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<codeblock>');
    expect(output).toContain('plain code here');
  });

  it('xref with format attribute round-trips preserving href and format', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="xref-test">
  <title>Xref Test</title>
  <conbody>
    <p>See <xref href="http://example.com" format="html">the example site</xref> for more.</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    const body = getBodyContent(output);
    expect(body).toContain('<xref');
    expect(body).toContain('href="http://example.com"');
    expect(body).toContain('the example site');
  });

  it('section with title and paragraph preserves h2 heading as section title', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="section-test">
  <title>Concept With Section</title>
  <conbody>
    <section>
      <title>Section Heading</title>
      <p>Section body text.</p>
    </section>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<section>');
    expect(output).toContain('<title>Section Heading</title>');
    expect(output).toContain('Section body text.');
    expect(output).toContain('</section>');
  });

  it('table cell content with inline bold is preserved', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="table-inline">
  <title>Table Inline</title>
  <conbody>
    <table>
      <tgroup cols="2">
        <tbody>
          <row>
            <entry><b>Bold cell</b></entry>
            <entry>Plain cell</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('<b>Bold cell</b>');
    expect(output).toContain('Plain cell');
  });

  it('multiple body children survive round-trip in correct order', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="order-test">
  <title>Order Test</title>
  <conbody>
    <p>First</p>
    <ul>
      <li>List item</li>
    </ul>
    <p>Last</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    const firstIdx = output.indexOf('<p>First</p>');
    const ulIdx = output.indexOf('<ul>');
    const lastIdx = output.indexOf('<p>Last</p>');

    expect(firstIdx).toBeGreaterThan(-1);
    expect(ulIdx).toBeGreaterThan(-1);
    expect(lastIdx).toBeGreaterThan(-1);
    expect(firstIdx).toBeLessThan(ulIdx);
    expect(ulIdx).toBeLessThan(lastIdx);
  });

  it('multiple calls with same editor/originMap/cache pair each produce stable output', () => {
    // Ensure independent invocations with fresh state produce identical results
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="stability-test">
  <title>Stability Test</title>
  <conbody>
    <p>Stable content</p>
  </conbody>
</concept>`;

    const output1 = roundTrip(xml);
    const output2 = roundTrip(xml);

    // Both round-trips from fresh state should produce structurally identical output
    expect(normalizeXml(output1)).toBe(normalizeXml(output2));
  });

  it('task step with multi-word cmd text is preserved exactly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="step-text">
  <title>Step Text</title>
  <taskbody>
    <steps>
      <step><cmd>Click the big red button carefully.</cmd></step>
    </steps>
  </taskbody>
</task>`;

    const output = roundTrip(xml);
    expect(output).toContain('<cmd>Click the big red button carefully.</cmd>');
  });

  it('simpletable with multiple rows and columns round-trips correctly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="simpletable-multi">
  <title>Simpletable Multi</title>
  <conbody>
    <simpletable>
      <sthead>
        <stentry>Name</stentry>
        <stentry>Value</stentry>
      </sthead>
      <strow>
        <stentry>alpha</stentry>
        <stentry>1</stentry>
      </strow>
      <strow>
        <stentry>beta</stentry>
        <stentry>2</stentry>
      </strow>
    </simpletable>
  </conbody>
</concept>`;

    const output = roundTrip(xml);

    expect(output).toContain('Name');
    expect(output).toContain('Value');
    expect(output).toContain('alpha');
    expect(output).toContain('1');
    expect(output).toContain('beta');
    expect(output).toContain('2');
  });

  it('task with all optional body elements in sequence', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="full-task">
  <title>Full Task</title>
  <shortdesc>A complete task with all elements.</shortdesc>
  <taskbody>
    <prereq>Install prerequisites first.</prereq>
    <context>Provides context for the task.</context>
    <steps>
      <step><cmd>Do the first thing.</cmd></step>
      <step><cmd>Do the second thing.</cmd></step>
    </steps>
    <result>You have completed the task.</result>
    <postreq>Verify the result.</postreq>
  </taskbody>
</task>`;

    const output = roundTrip(xml);

    expect(output).toContain('<shortdesc>A complete task with all elements.</shortdesc>');
    expect(output).toContain('<prereq>Install prerequisites first.</prereq>');
    expect(output).toContain('<context>Provides context for the task.</context>');
    expect(output).toContain('<cmd>Do the first thing.</cmd>');
    expect(output).toContain('<cmd>Do the second thing.</cmd>');
    expect(output).toContain('<result>You have completed the task.</result>');
    expect(output).toContain('<postreq>Verify the result.</postreq>');
  });

  it('concept title-only (no body) round-trips without crashing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="title-only">
  <title>Just a Title</title>
  <conbody/>
</concept>`;

    // Should not throw
    const output = roundTrip(xml);
    expect(output).toContain('<title>Just a Title</title>');
  });
});

// ─── describe: visual editor mutation: link creation ─────────────────────────

describe('visual editor mutation: link creation', () => {
  it('LinkNode added to existing plain-text paragraph is serialized as xref', () => {
    const plainXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="link-mutation-test">
  <title>Link Test</title>
  <conbody>
    <p>Click our website for details.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();

    // 1. Parse plain-text XML — no xref in the source
    parseXmlToLexical(plainXml, editor, originMap, true);

    // 2. Simulate the user clicking Insert Link in the visual editor toolbar:
    //    wrap "our website" in a LinkNode while leaving the surrounding text intact.
    //    Text content of the paragraph stays identical — only the structure changes.
    editor.update(
      () => {
        const root = $getRoot();
        let targetPara: any = null;
        for (const child of root.getChildren()) {
          if (child.getTextContent() === 'Click our website for details.') {
            targetPara = child;
            break;
          }
        }
        if (!targetPara) return;

        targetPara.clear();
        const link = $createLinkNode('https://example.com');
        link.append($createTextNode('our website'));
        targetPara.append($createTextNode('Click '), link, $createTextNode(' for details.'));
      },
      { discrete: true }
    );

    // 3. Serialize — the LinkNode must produce <xref href="..." format="html">
    const editorState = editor.getEditorState();
    const output = serializeLexicalToXml(editorState, plainXml, originMap, cache);
    const body = getBodyContent(output);
    expect(body).toContain('<xref href="https://example.com" format="html">our website</xref>');
  });
});
