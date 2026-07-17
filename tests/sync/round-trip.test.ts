// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createEditor, $getRoot, $createTextNode, $createParagraphNode } from 'lexical';
import { $createLinkNode } from '@lexical/link';
import { HeadingNode, QuoteNode, $createQuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { DitaOpaqueNode } from '../../components/DitaOpaqueNode';
import { DitaCodeBlockNode, $createDitaCodeBlockNode } from '../../components/DitaCodeBlockNode';
import { DitaImageNode } from '../../components/DitaImageNode';
import { DitaPhRefNode } from '../../components/DitaPhRefNode';
import { DitaInfoPreviewNode } from '../../components/DitaInfoPreviewNode';
import { parseXmlToLexical, parseSectionFragment, parseBlockFragment, findLexicalKeyByXmlId } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';

// ─── Editor factory ───────────────────────────────────────────────────────────
// Shared factory (FR-047) — registers the full PRODUCTION node list, so this
// suite can now represent TrackedDeletionNode/ValidationDecoratorNode content.
import { createTestEditor } from '../helpers/createTestEditor';

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

  // P2-47: parser must trust entry count, not cols attribute
  it('table with cols="1" but 2 entries per row round-trips as 2-column table', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="cols-mismatch-test">
  <title>Cols Mismatch</title>
  <conbody>
    <table>
      <tgroup cols="1">
        <colspec colname="c1"/>
        <colspec colname="c2"/>
        <tbody>
          <row>
            <entry>Alpha</entry>
            <entry>Beta</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    // Both cells must survive the round-trip — parser uses entry count, not cols attr
    expect(output).toContain('Alpha');
    expect(output).toContain('Beta');
    // Serializer must regenerate colspec from actual column count (2), not the original cols="1"
    expect(output).toMatch(/cols="2"/);
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

// ─── describe: P1-16: inserted-section accept-path inline preservation ────────

describe('P1-16: parseSectionFragment + serialize preserves DITA inline tags', () => {
  const baseTaskXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="t1"><title>T</title><taskbody><context><p>existing</p></context></taskbody></task>`;

  function insertAndSerialize(fragmentXml: string): string {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();

    parseXmlToLexical(baseTaskXml, editor, originMap, true);

    editor.update(
      () => {
        const nodes = parseSectionFragment(fragmentXml, originMap);
        if (!nodes) throw new Error('parseSectionFragment returned no nodes');
        const root = $getRoot();
        nodes.forEach(n => root.append(n));
      },
      { discrete: true }
    );

    return serializeLexicalToXml(editor.getEditorState(), baseTaskXml, originMap, cache);
  }

  it('preserves <uicontrol> instead of emitting <b>', () => {
    const out = insertAndSerialize(
      '<section><title>S</title><p>Click <uicontrol>OK</uicontrol> to proceed.</p></section>'
    );
    expect(out).toContain('<uicontrol>OK</uicontrol>');
    expect(out).not.toMatch(/<b[ >]/);
  });

  it('preserves <wintitle> instead of emitting <i>', () => {
    const out = insertAndSerialize(
      '<section><title>S</title><p>Open <wintitle>Settings</wintitle> window.</p></section>'
    );
    expect(out).toContain('<wintitle>Settings</wintitle>');
    expect(out).not.toMatch(/<i[ >]/);
  });

  it('preserves <ph conkeyref="..."/> on inserted content', () => {
    const out = insertAndSerialize(
      '<section><title>S</title><p>See <ph conkeyref="x/y">placeholder</ph> docs.</p></section>'
    );
    expect(out).toContain('conkeyref="x/y"');
  });

  it('does not leak XHTML namespace onto the appended section', () => {
    const out = insertAndSerialize(
      '<section><title>S</title><p>Click <uicontrol>OK</uicontrol>.</p></section>'
    );
    expect(out).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });
});

// ─── describe: P2-43: block-level fragment parsing ────────────────────────────

describe('P2-43: parseBlockFragment accepts block-level top-level elements', () => {
  function parseInEditor(fragmentXml: string): any[] | null {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    let result: any[] | null = null;
    editor.update(
      () => {
        result = parseBlockFragment(fragmentXml, originMap);
      },
      { discrete: true }
    );
    return result;
  }

  it('parses a bare <p>', () => {
    const nodes = parseInEditor('<p>just a paragraph</p>');
    expect(nodes).not.toBeNull();
    expect(nodes!.length).toBe(1);
    expect(nodes![0].getType()).toBe('paragraph');
  });

  it('parses a bare <ul>', () => {
    const nodes = parseInEditor('<ul><li>one</li><li>two</li></ul>');
    expect(nodes).not.toBeNull();
    expect(nodes!.length).toBe(1);
    expect(nodes![0].getType()).toBe('list');
  });

  it('parses a bare <note>', () => {
    const nodes = parseInEditor('<note type="warning">heads up</note>');
    expect(nodes).not.toBeNull();
    expect(nodes!.length).toBe(1);
    expect(nodes![0].getType()).toBe('quote');
  });

  it('parses multiple top-level blocks', () => {
    const nodes = parseInEditor('<p>first</p><p>second</p>');
    expect(nodes).not.toBeNull();
    expect(nodes!.length).toBe(2);
  });

  it('rejects disallowed top-level element (<title>)', () => {
    const nodes = parseInEditor('<title>nope</title>');
    expect(nodes).toBeNull();
  });

  it('still unwraps <section> for back-compat', () => {
    const nodes = parseInEditor('<section><title>S</title><p>x</p></section>');
    expect(nodes).not.toBeNull();
    expect(nodes!.length).toBeGreaterThanOrEqual(2);
    expect(nodes![0].getType()).toBe('heading');
  });
});

describe('P2-43: findLexicalKeyByXmlId locates nodes for replaceId', () => {
  it('finds a paragraph by its DITA id attribute', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1"><title>T</title><conbody>
  <p id="intro">intro</p>
  <p id="body">body</p>
</conbody></concept>`;
    parseXmlToLexical(xml, editor, originMap, true);

    const key = findLexicalKeyByXmlId(originMap, 'body');
    expect(key).not.toBeNull();
    expect(findLexicalKeyByXmlId(originMap, 'nonexistent')).toBeNull();
  });
});

// ─── describe: P1-17 + P1-18: no XHTML namespace leak ────────────────────────

describe('P1-17 + P1-18: no XHTML namespace leak on block insert or API round-trip', () => {
  const baseConceptXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1"><title>T</title><conbody><p>existing</p></conbody></concept>`;

  const cache = createXmlMetaCache();

  function buildAndSerialize(
    buildFn: (editor: ReturnType<typeof createTestEditor>, originMap: ReturnType<typeof createNodeOriginMap>) => void
  ): string {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    parseXmlToLexical(baseConceptXml, editor, originMap, true);
    editor.update(() => { buildFn(editor, originMap); }, { discrete: true });
    return serializeLexicalToXml(editor.getEditorState(), baseConceptXml, originMap, cache);
  }

  // P1-17: paragraph inserted by the + tool
  it('paragraph stamped with originMap serializes as <p>, no XHTML xmlns', () => {
    const out = buildAndSerialize((_editor, originMap) => {
      const p = $createParagraphNode();
      $getRoot().append(p);
      originMap.set(p.getKey(), { tag: 'p', bodyIndex: -1 });
    });
    expect(out).toContain('<p>');
    expect(out).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  // P1-17: note inserted by the + tool
  it('note stamped with originMap serializes as <note>, no XHTML xmlns, no <b>', () => {
    const out = buildAndSerialize((_editor, originMap) => {
      const quote = $createQuoteNode();
      const inner = $createParagraphNode();
      quote.append(inner);
      $getRoot().append(quote);
      originMap.set(quote.getKey(), { tag: 'note', bodyIndex: -1, noteType: 'NOTE' });
    });
    expect(out).toContain('<note');
    expect(out).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(out).not.toMatch(/<b[ >]/);
  });

  // P1-17: unordered list (created by node type, no originMap needed)
  it('list node without originMap serializes as <ul>/<li>, no XHTML xmlns', () => {
    const out = buildAndSerialize((_editor, originMap) => {
      const list = new ListNode('bullet', 1);
      const item = new ListItemNode();
      item.append($createTextNode('item text'));
      list.append(item);
      $getRoot().append(list);
      // Intentionally no originMap stamp — node-type routing should handle this
      void originMap;
    });
    expect(out).toMatch(/<ul>|<li>/);
    expect(out).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  // P1-17: codeblock inserted by the + tool
  it('codeblock stamped with originMap serializes as <codeblock>, no XHTML xmlns', () => {
    const out = buildAndSerialize((_editor, originMap) => {
      const cb = $createDitaCodeBlockNode('echo hello', 'bash');
      $getRoot().append(cb);
      originMap.set(cb.getKey(), { tag: 'codeblock', bodyIndex: -1 });
    });
    expect(out).toContain('<codeblock');
    expect(out).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  // P2-46: xref inside <note><p> must parse as a LinkNode, not flattened to text
  it('xref inside <note><p> round-trips as <xref> and is parsed as a LinkNode', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="note-xref-test">
  <title>Note with Xref</title>
  <conbody>
    <note type="note"><p>See <xref href="topic.dita">the topic</xref> for more details.</p></note>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();

    parseXmlToLexical(xml, editor, originMap, true);

    // The QuoteNode (note) must contain a LinkNode — not a plain text node with flattened xref text
    let foundLinkNode = false;
    editor.getEditorState().read(() => {
      const root = $getRoot();
      for (const child of root.getChildren()) {
        if (child.getType() === 'quote') {
          for (const inline of (child as any).getChildren()) {
            if (inline instanceof LinkNode) {
              foundLinkNode = true;
            }
          }
        }
      }
    });
    expect(foundLinkNode).toBe(true);

    // Serialization must also preserve the <xref> element
    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(output).toContain('<xref');
    expect(output).toContain('href="topic.dita"');
    expect(output).toContain('the topic');
  });

  // P2-45: PUT replace — serialize after parse-B must not contain content from master-A
  // Simulates the stale-masterXmlRef scenario: parse new XML B into Lexical, but then
  // serialize against old masterXmlRef (XML A). The output must only contain B content.
  it('serializing after PUT parse against stale master produces only new content, not old+new', () => {
    const xmlA = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1"><title>T</title><conbody>
  <p>paragraph-one</p>
  <p>paragraph-two</p>
  <p>paragraph-three</p>
</conbody></concept>`;

    const xmlB = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1"><title>T</title><conbody>
  <note type="note">Only this note.</note>
</conbody></concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();

    // Step 1: initial parse against A (simulates app startup)
    parseXmlToLexical(xmlA, editor, originMap, true);

    // Step 2: PUT arrives — parse B into Lexical (but deliberately leave masterXmlRef = A)
    // This is the stale-master scenario the bug describes.
    parseXmlToLexical(xmlB, editor, originMap, true);

    // Step 3: serialize against stale master (xmlA). The serializer walk matches
    // Lexical nodes (QuoteNode=note) against DOM children of xmlA (<p>×3).
    // The serializer must NOT produce both old paragraphs AND the new note.
    const out = serializeLexicalToXml(editor.getEditorState(), xmlA, originMap, cache);
    const body = getBodyContent(out);

    // New content must be present
    expect(body).toContain('<note');
    expect(body).toContain('Only this note.');
    // Old content must NOT appear alongside it — no duplication
    expect(body).not.toContain('paragraph-one');
    expect(body).not.toContain('paragraph-two');
    expect(body).not.toContain('paragraph-three');
  });

  // P1-18: API PUT round-trip — new note type not previously in the topic
  it('parseXmlToLexical + serialize on an API-pushed note produces no XHTML xmlns', () => {
    const editor = createTestEditor();
    const originMap = createNodeOriginMap();

    const updatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1"><title>T</title><conbody>
  <p>existing</p>
  <note type="tip" class="- topic/note "><p>Heads up</p></note>
</conbody></concept>`;

    parseXmlToLexical(updatedXml, editor, originMap, true);
    const out = serializeLexicalToXml(editor.getEditorState(), updatedXml, originMap, cache);

    expect(out).toContain('<note');
    expect(out).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });
});

// ─── describe: BUG-01: definition lists (<dl>/<dlentry>/<dt>/<dd>) ─────────────

describe('BUG-01: definition list round-trip', () => {
  it('bare <dl> preserves dt/dd structure and inline elements', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="journey-def">
  <title>Journey Definition</title>
  <conbody>
    <dl>
      <dlentry>
        <dt>Single trip</dt>
        <dd><p>Select <uicontrol>A single trip (default)</uicontrol> to define a journey.</p></dd>
      </dlentry>
      <dlentry>
        <dt>Multiple consecutive trips</dt>
        <dd><p>Select <uicontrol>Chained consecutive trips</uicontrol> to chain trips.</p></dd>
      </dlentry>
    </dl>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    const body = getBodyContent(output);

    // Skeleton preserved
    expect(body).toContain('<dl>');
    expect(body).toContain('</dl>');
    expect((body.match(/<dlentry>/g) || []).length).toBe(2);
    expect(body).toContain('<dt>Single trip</dt>');
    expect(body).toContain('<dt>Multiple consecutive trips</dt>');
    // Inline <uicontrol> re-emitted (not flattened to <b> or plain text)
    expect(body).toContain('<uicontrol>A single trip (default)</uicontrol>');
    expect(body).toContain('<uicontrol>Chained consecutive trips</uicontrol>');
    // No XHTML namespace leak
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('non-standard <p>-wrapped <dl> preserves the wrapper and the inner dl (no duplication)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="wrapped-dl">
  <title>Wrapped</title>
  <conbody>
    <p><dl>
      <dlentry>
        <dt>Term A</dt>
        <dd><p>Definition A.</p></dd>
      </dlentry>
    </dl></p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    const body = getBodyContent(output);

    // Wrapper <p> preserved, inner <dl> intact, exactly one of each — no duplication
    expect((body.match(/<dl>/g) || []).length).toBe(1);
    expect((body.match(/<dlentry>/g) || []).length).toBe(1);
    expect(body).toContain('<dt>Term A</dt>');
    expect(body).toContain('Definition A.');
    // The dl is still wrapped in the <p> (wrapper not unwrapped)
    expect(body).toMatch(/<p>\s*<dl>/);
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('<dd> with nested table and note keeps them (structural, not byte-identical)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="dd-blocks">
  <title>DD Blocks</title>
  <conbody>
    <dl>
      <dlentry>
        <dt>Complex</dt>
        <dd>
          <p>Intro paragraph.</p>
          <table>
            <tgroup cols="2">
              <colspec colname="col1"/>
              <colspec colname="col2"/>
              <tbody>
                <row><entry>A</entry><entry>B</entry></row>
              </tbody>
            </tgroup>
          </table>
          <note type="tip">A tip inside the definition.</note>
        </dd>
      </dlentry>
    </dl>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    const body = getBodyContent(output);

    expect(body).toContain('<dt>Complex</dt>');
    expect(body).toContain('Intro paragraph.');
    // Nested block elements survive inside the dd
    expect(body).toContain('<table>');
    expect(body).toContain('<entry>A</entry>');
    expect(body).toContain('<entry>B</entry>');
    expect(body).toContain('<note');
    expect(body).toContain('A tip inside the definition.');
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('editing a <dt> term patches only the dt, leaving the dd untouched', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="edit-dt">
  <title>Edit</title>
  <conbody>
    <dl>
      <dlentry>
        <dt>Old term</dt>
        <dd><p>Unchanged definition.</p></dd>
      </dlentry>
    </dl>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();

    parseXmlToLexical(xml, editor, originMap, true);

    // Replace the dt term text in the visual editor
    editor.update(
      () => {
        const root = $getRoot();
        for (const child of root.getChildren()) {
          if (child.getTextContent() === 'Old term') {
            (child as any).clear();
            (child as any).append($createTextNode('New term'));
            break;
          }
        }
      },
      { discrete: true }
    );

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);

    expect(body).toContain('<dt>New term</dt>');
    expect(body).not.toContain('Old term');
    expect(body).toContain('Unchanged definition.');
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('dd paragraph with conkeyref, uicontrol, inline image + sibling p/table all survive', () => {
    // Mirrors the real Journey Definition topic: a <dd> whose first <p> mixes
    // inline <ph conkeyref>, <uicontrol>, and an inline <image>, followed by
    // another <p> and a <table>. Regression for two bugs BUG-01 exposed:
    // (1) inline elements lost when a block-split runs; (2) an inline image
    // misaligning the dd's child walk and dropping a sibling <p>.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="dd-inline-mix">
  <title>Mix</title>
  <conbody>
    <p><dl>
      <dlentry>
        <dt>Chaining</dt>
        <dd>
          <p>Unique to <ph conkeyref="varsAltitude/ProdNameShort"/>, set <uicontrol>Chain trips</uicontrol> here.<image href="../img/x.png"><alt>diagram</alt></image></p>
          <p>To configure, follow the table:</p>
          <table>
            <tgroup cols="2">
              <colspec colname="c1"/>
              <colspec colname="c2"/>
              <tbody>
                <row><entry>Param</entry><entry>Desc</entry></row>
              </tbody>
            </tgroup>
          </table>
        </dd>
      </dlentry>
    </dl></p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    const body = getBodyContent(output);

    // Inline ref + control preserved (not flattened to plain text)
    expect(body).toContain('conkeyref="varsAltitude/ProdNameShort"');
    expect(body).toContain('<uicontrol>Chain trips</uicontrol>');
    // Inline image preserved with its alt
    expect(body).toContain('href="../img/x.png"');
    expect(body).toContain('diagram');
    // Sibling paragraph NOT dropped
    expect(body).toContain('To configure, follow the table:');
    // Table survives
    expect(body).toContain('<entry>Param</entry>');
    expect(body).toContain('<entry>Desc</entry>');
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });
});

// ─── describe: P2-26 Phase 2: read-only <info> preview under steps ─────────────

describe('P2-26 Phase 2: info preview round-trip', () => {
  it('step <info> with codeblock + note is byte-stable (preview serializes to nothing)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="info-task">
  <title>Task with Info</title>
  <taskbody>
    <steps>
      <step>
        <cmd>Run the command.</cmd>
        <info>
          <codeblock>npm run build</codeblock>
          <note type="warning">This may take a while.</note>
        </info>
      </step>
    </steps>
  </taskbody>
</task>`;

    const output = roundTrip(xml);

    // <cmd> preserved
    expect(output).toContain('<cmd>Run the command.</cmd>');
    // <info> and its block children survive byte-stable
    expect(output).toContain('<info>');
    expect(output).toContain('<codeblock>npm run build</codeblock>');
    expect(output).toContain('<note type="warning">This may take a while.</note>');
    expect(output).toContain('</info>');
    // The preview must not leak its content into <cmd>
    expect(output).not.toContain('<cmd>Run the command.npm run build');
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('editing a <cmd> does not disturb the sibling <info>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="info-edit-task">
  <title>Edit Cmd</title>
  <taskbody>
    <steps>
      <step>
        <cmd>Original command.</cmd>
        <info>
          <p>Helpful context.</p>
          <codeblock>do-thing --flag</codeblock>
        </info>
      </step>
    </steps>
  </taskbody>
</task>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    // Edit the first list item's command text.
    editor.update(() => {
      const root = $getRoot();
      const list = root.getChildren().find(n => n.getType() === 'list') as any;
      const li = list.getChildren()[0];
      const firstChild = li.getChildren().find((c: any) => c.getType() === 'text');
      firstChild.setTextContent('Edited command.');
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);

    expect(output).toContain('<cmd>Edited command.</cmd>');
    expect(output).not.toContain('Original command.');
    // <info> untouched
    expect(output).toContain('<p>Helpful context.</p>');
    expect(output).toContain('<codeblock>do-thing --flag</codeblock>');
    expect(output).not.toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });
});

// ─── describe: Session 4B (S6): table row add/delete reaches the XML ──────────
//
// BUG-04/S6: both patchTableElement and patchSimpleTable walk only
// Math.min(dom,lex) rows — added rows are silently dropped and deleted rows
// survive in the DOM. Fixed in Session 4B by adding append/remove phases
// mirroring patchListElement.

describe('Session 4B (S6): table row add/delete reaches the XML', () => {
  it('CALS table: adding a row via Lexical mutation appends a <row> to <tbody>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="table-add-row">
  <title>Table Add Row</title>
  <conbody>
    <table>
      <tgroup cols="2">
        <colspec colname="col1" colwidth="1*"/>
        <colspec colname="col2" colwidth="1*"/>
        <tbody>
          <row>
            <entry>Alpha</entry>
            <entry>A</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const tableNode = root.getChildren().find((n: any) => n.getType() === 'table') as any;
      const newRow = new TableRowNode();
      const cell1 = new TableCellNode(0);
      cell1.append($createParagraphNode().append($createTextNode('Beta')));
      const cell2 = new TableCellNode(0);
      cell2.append($createParagraphNode().append($createTextNode('B')));
      newRow.append(cell1, cell2);
      tableNode.append(newRow);
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);

    expect(body).toContain('Alpha');
    expect(body).toContain('Beta');
    expect((body.match(/<row>/g) || []).length).toBe(2);
  });

  it('CALS table: removing a row via Lexical mutation removes the <row> from <tbody>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="table-del-row">
  <title>Table Delete Row</title>
  <conbody>
    <table>
      <tgroup cols="2">
        <colspec colname="col1" colwidth="1*"/>
        <colspec colname="col2" colwidth="1*"/>
        <tbody>
          <row>
            <entry>Alpha</entry>
            <entry>A</entry>
          </row>
          <row>
            <entry>Beta</entry>
            <entry>B</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const tableNode = root.getChildren().find((n: any) => n.getType() === 'table') as any;
      const rows = tableNode.getChildren();
      rows[rows.length - 1].remove();
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);

    expect(body).toContain('Alpha');
    expect(body).not.toContain('Beta');
    expect((body.match(/<row>/g) || []).length).toBe(1);
  });

  it('CALS table with thead: adding a body row does not disturb the header row', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="table-thead-add">
  <title>Table Thead Add</title>
  <conbody>
    <table>
      <tgroup cols="2">
        <colspec colname="col1" colwidth="1*"/>
        <colspec colname="col2" colwidth="1*"/>
        <thead>
          <row>
            <entry>Name</entry>
            <entry>Value</entry>
          </row>
        </thead>
        <tbody>
          <row>
            <entry>Alpha</entry>
            <entry>A</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const tableNode = root.getChildren().find((n: any) => n.getType() === 'table') as any;
      const newRow = new TableRowNode();
      const cell1 = new TableCellNode(0);
      cell1.append($createParagraphNode().append($createTextNode('Beta')));
      const cell2 = new TableCellNode(0);
      cell2.append($createParagraphNode().append($createTextNode('B')));
      newRow.append(cell1, cell2);
      tableNode.append(newRow);
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);

    expect(body).toContain('<thead>');
    expect(body).toContain('Name');
    expect(body).toContain('Alpha');
    expect(body).toContain('Beta');
    expect((body.match(/<row>/g) || []).length).toBe(3);
  });

  it('simpletable: adding a row via Lexical mutation appends an <strow>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="stbl-add-row">
  <title>Simpletable Add Row</title>
  <conbody>
    <simpletable>
      <sthead>
        <stentry>Key</stentry>
        <stentry>Val</stentry>
      </sthead>
      <strow>
        <stentry>alpha</stentry>
        <stentry>1</stentry>
      </strow>
    </simpletable>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const tableNode = root.getChildren().find((n: any) => n.getType() === 'table') as any;
      const newRow = new TableRowNode();
      const cell1 = new TableCellNode(0);
      cell1.append($createParagraphNode().append($createTextNode('beta')));
      const cell2 = new TableCellNode(0);
      cell2.append($createParagraphNode().append($createTextNode('2')));
      newRow.append(cell1, cell2);
      tableNode.append(newRow);
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);

    expect(body).toContain('alpha');
    expect(body).toContain('beta');
    expect((body.match(/<strow>/g) || []).length).toBe(2);
  });

  it('simpletable: removing a row via Lexical mutation removes the <strow>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="stbl-del-row">
  <title>Simpletable Delete Row</title>
  <conbody>
    <simpletable>
      <sthead>
        <stentry>Key</stentry>
        <stentry>Val</stentry>
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

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const tableNode = root.getChildren().find((n: any) => n.getType() === 'table') as any;
      const rows = tableNode.getChildren();
      rows[rows.length - 1].remove();
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);

    expect(body).toContain('alpha');
    expect(body).not.toContain('beta');
    expect((body.match(/<strow>/g) || []).length).toBe(1);
  });
});

// ─── describe: Session 4B (S2): formatting-only edits reach the XML ───────────
//
// BUG-04/S2: patchElementContent compared text + link count only, so a
// bold/italic/code toggle (text unchanged) was treated as "untouched" and the
// formatting never reached the XML. Fixed by a format-run signature comparison
// restricted to the provably-safe inline subset (text, attribute-less b/i/codeph
// with text-only content). Elements containing xref/ph/uicontrol/nested inline
// tags bail to the old behavior — preserved byte-stable, formatting edits there
// still dropped (residual, annotated on FR-046).

describe('Session 4B (S2): formatting-only edits reach the XML', () => {
  function editParagraphByText(editor: any, matchText: string, buildChildren: () => any[]) {
    editor.update(() => {
      const root = $getRoot();
      for (const child of root.getChildren()) {
        if (child.getTextContent() === matchText) {
          (child as any).clear();
          buildChildren().forEach(n => (child as any).append(n));
          break;
        }
      }
    }, { discrete: true });
  }

  it('bold toggle on a plain paragraph produces <b> in the XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-bold">
  <title>Bold Toggle</title>
  <conbody>
    <p>Make this word bold now.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editParagraphByText(editor, 'Make this word bold now.', () => {
      const bold = $createTextNode('word');
      bold.toggleFormat('bold');
      return [$createTextNode('Make this '), bold, $createTextNode(' bold now.')];
    });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(getBodyContent(output)).toContain('<p>Make this <b>word</b> bold now.</p>');
  });

  it('removing bold produces plain text in the XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-unbold">
  <title>Unbold</title>
  <conbody>
    <p>Some <b>emphasis</b> here.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editParagraphByText(editor, 'Some emphasis here.', () => [
      $createTextNode('Some emphasis here.'),
    ]);

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);
    expect(body).toContain('<p>Some emphasis here.</p>');
    expect(body).not.toMatch(/<b[ >]/);
  });

  it('italic toggle inside a task <cmd> produces <i>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="s2-cmd-italic">
  <title>Cmd Italic</title>
  <taskbody>
    <steps>
      <step><cmd>Click the save button.</cmd></step>
    </steps>
  </taskbody>
</task>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const list = root.getChildren().find((n: any) => n.getType() === 'list') as any;
      const li = list.getChildren()[0];
      li.clear();
      const ital = $createTextNode('save');
      ital.toggleFormat('italic');
      li.append($createTextNode('Click the '), ital, $createTextNode(' button.'));
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(output).toContain('<cmd>Click the <i>save</i> button.</cmd>');
  });

  it('code toggle produces <codeph>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-codeph">
  <title>Code Toggle</title>
  <conbody>
    <p>Run npm install to set up.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editParagraphByText(editor, 'Run npm install to set up.', () => {
      const code = $createTextNode('npm install');
      code.toggleFormat('code');
      return [$createTextNode('Run '), code, $createTextNode(' to set up.')];
    });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(getBodyContent(output)).toContain('<p>Run <codeph>npm install</codeph> to set up.</p>');
  });

  it('bold toggle inside a simple <note> preserves the type attribute and adds <b>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-note-bold">
  <title>Note Bold</title>
  <conbody>
    <note type="tip">Remember this word.</note>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const quote = root.getChildren().find((n: any) => n.getType() === 'quote') as any;
      quote.clear();
      const bold = $createTextNode('this');
      bold.toggleFormat('bold');
      quote.append($createTextNode('Remember '), bold, $createTextNode(' word.'));
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);
    expect(body).toContain('<note type="tip">Remember <b>this</b> word.</note>');
  });

  it('table entry with direct text: bold toggle reaches the <entry>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-entry-bold">
  <title>Entry Bold</title>
  <conbody>
    <table>
      <tgroup cols="1">
        <colspec colname="col1" colwidth="1*"/>
        <tbody>
          <row>
            <entry>plain cell</entry>
          </row>
        </tbody>
      </tgroup>
    </table>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const tableNode = root.getChildren().find((n: any) => n.getType() === 'table') as any;
      const cell = tableNode.getChildren()[0].getChildren()[0];
      const para = cell.getChildren()[0];
      para.clear();
      const bold = $createTextNode('plain');
      bold.toggleFormat('bold');
      para.append(bold, $createTextNode(' cell'));
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(getBodyContent(output)).toContain('<entry><b>plain</b> cell</entry>');
  });

  it('SAFETY: paragraph containing <ph conkeyref> bails — ref preserved, formatting edit dropped', () => {
    // Residual limitation (annotated on FR-046): elements whose inline content
    // includes non-recreatable pieces (ph/xref/uicontrol/...) are never
    // force-replaced on a formatting-only edit, because the rewrite would lose
    // the ref/attributes. Preservation wins over honoring the toggle.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-ph-bail">
  <title>Ph Bail</title>
  <conbody>
    <p>See <ph conkeyref="vars/Product"/> and more text.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      for (const child of root.getChildren()) {
        if (child.getType() !== 'paragraph') continue;
        const kids = (child as any).getChildren();
        const last = kids[kids.length - 1];
        if (last?.getType() === 'text' && last.getTextContent() === ' and more text.') {
          last.remove();
          const bold = $createTextNode('more');
          bold.toggleFormat('bold');
          (child as any).append($createTextNode(' and '), bold, $createTextNode(' text.'));
          break;
        }
      }
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    const body = getBodyContent(output);
    // The ref must survive — never sacrificed to a formatting toggle
    expect(body).toContain('conkeyref="vars/Product"');
    expect(body).not.toMatch(/<b[ >]/);
  });

  it('SAFETY: unedited nested <b><i> and inline DITA elements stay byte-identical', () => {
    // The parser flattens <b><i>x</i></b> to bold-only; a naive format
    // comparison would see a mismatch and rewrite. The signature builder must
    // bail on nested inline tags so unedited content is never touched.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="s2-nested-safe">
  <title>Nested Safe</title>
  <conbody>
    <p>Text with <b><i>both styles</i></b> and <uicontrol>OK</uicontrol> together.</p>
  </conbody>
</concept>`;

    const output = roundTrip(xml);
    const body = getBodyContent(output);
    expect(body).toContain('<b><i>both styles</i></b>');
    expect(body).toContain('<uicontrol>OK</uicontrol>');
  });
});

// ─── describe: Session 4B (M2) — noteType consumed on createElementFromLexical ─

describe('Session 4B (M2): noteType consumed on createElementFromLexical', () => {
  it('new warning note created in Lexical writes type="warning" to XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="m2-warning">
  <title>Note Type</title>
  <conbody>
    <p>Before.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const quote = $createQuoteNode();
      quote.append($createTextNode('Do not ignore this.'));
      originMap.set(quote.getKey(), { tag: 'note', bodyIndex: 1, noteType: 'WARNING' });
      root.append(quote);
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(output).toContain('<note type="warning">Do not ignore this.</note>');
  });

  it('new caution note writes type="caution" to XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="m2-caution">
  <title>Note Type</title>
  <conbody></conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const quote = $createQuoteNode();
      quote.append($createTextNode('Be careful.'));
      originMap.set(quote.getKey(), { tag: 'note', bodyIndex: 0, noteType: 'CAUTION' });
      root.append(quote);
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(output).toContain('<note type="caution">Be careful.</note>');
  });

  it('new plain note (noteType NOTE) writes no type attribute', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="m2-plain">
  <title>Note Type</title>
  <conbody></conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const quote = $createQuoteNode();
      quote.append($createTextNode('A plain note.'));
      originMap.set(quote.getKey(), { tag: 'note', bodyIndex: 0, noteType: 'NOTE' });
      root.append(quote);
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
    expect(output).toContain('<note>A plain note.</note>');
    expect(output).not.toContain('type="note"');
  });
});

// ─── describe: Session 4A (ADR-006) — unified body walk ──────────────────────

describe('Session 4A (ADR-006): unified body walk', () => {
  it('M9: deleting the first paragraph keeps the survivor\'s id (identity-aware walk)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="m9-fixture">
  <title>Identity survives deletion</title>
  <conbody>
    <p id="intro">Introductory paragraph.</p>
    <p id="detail">Detailed paragraph other topics conref.</p>
  </conbody>
</concept>`;

    const editor = createTestEditor();
    const originMap = createNodeOriginMap();
    const cache = createXmlMetaCache();
    parseXmlToLexical(xml, editor, originMap, true);

    editor.update(() => {
      const root = $getRoot();
      const target = root
        .getChildren()
        .find((n: any) => n.getTextContent() === 'Introductory paragraph.');
      target!.remove();
    }, { discrete: true });

    const output = serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);

    // The surviving paragraph must keep ITS OWN id — not inherit "intro".
    expect(output).toContain('<p id="detail">Detailed paragraph other topics conref.</p>');
    expect(output).not.toContain('id="intro"');
  });
});
