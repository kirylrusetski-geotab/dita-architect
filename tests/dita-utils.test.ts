// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseDitaXml, generateDitaXml, extractTextFromBlocks } from '../lib/dita-utils';

// ─── parseDitaXml ────────────────────────────────────────────────────────────

describe('parseDitaXml', () => {
  it('parses a basic task with title and shortdesc', () => {
    const xml = `<task id="t1">
      <title>My Task</title>
      <shortdesc>A short description</shortdesc>
      <taskbody></taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'title', content: 'My Task' });
    expect(blocks[1]).toEqual({ type: 'shortdesc', content: 'A short description' });
  });

  it('parses task body content with paragraphs', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <p>First paragraph</p>
        <p>Second paragraph</p>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ type: 'paragraph', content: 'First paragraph' });
    expect(blocks[2]).toEqual({ type: 'paragraph', content: 'Second paragraph' });
  });

  it('parses task-specific elements context, result, prereq', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <context>Context information</context>
        <prereq>Prerequisites here</prereq>
        <result>Expected result</result>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(4);
    expect(blocks[1]).toEqual({ type: 'context', content: 'Context information' });
    expect(blocks[2]).toEqual({ type: 'prereq', content: 'Prerequisites here' });
    expect(blocks[3]).toEqual({ type: 'result', content: 'Expected result' });
  });

  it('parses note elements with type attribute', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <note type="warning">Warning note</note>
        <note>Default note</note>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ type: 'note', noteType: 'warning', content: 'Warning note' });
    expect(blocks[2]).toEqual({ type: 'note', noteType: 'note', content: 'Default note' });
  });

  it('parses ordered and unordered lists', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <ol>
          <li>First item</li>
          <li>Second item</li>
        </ol>
        <ul>
          <li>Bullet one</li>
          <li>Bullet two</li>
        </ul>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({
      type: 'ordered-list',
      items: ['First item', 'Second item']
    });
    expect(blocks[2]).toEqual({
      type: 'unordered-list',
      items: ['Bullet one', 'Bullet two']
    });
  });

  it('parses codeblock elements', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <codeblock>console.log('hello');</codeblock>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({ type: 'codeblock', content: "console.log('hello');" });
  });

  it('parses steps with cmd, info, and substeps', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <steps>
          <step>
            <cmd>First command</cmd>
            <info>Additional info</info>
          </step>
          <step>
            <cmd>Second command</cmd>
            <substeps>
              <substep><cmd>Sub-command 1</cmd></substep>
              <substep><cmd>Sub-command 2</cmd></substep>
            </substeps>
          </step>
        </steps>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({
      type: 'steps',
      steps: [
        { cmd: 'First command', info: 'Additional info' },
        { cmd: 'Second command', substeps: ['Sub-command 1', 'Sub-command 2'] }
      ]
    });
  });

  it('preserves inline tags like xref, b, i, uicontrol', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <p>Text with <b>bold</b> and <i>italic</i> and <uicontrol>UI</uicontrol></p>
        <p>Link to <xref href="other.dita">other topic</xref></p>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(3);
    expect(blocks[1].content).toBe('Text with <b>bold</b> and <i>italic</i> and <uicontrol>UI</uicontrol>');
    expect(blocks[2].content).toBe('Link to <xref href="other.dita">other topic</xref>');
  });

  it('handles sections with titles', () => {
    const xml = `<concept id="c1">
      <title>Concept</title>
      <conbody>
        <section>
          <title>Section Title</title>
          <p>Section content</p>
        </section>
      </conbody>
    </concept>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ type: 'section-title', content: 'Section Title' });
    expect(blocks[2]).toEqual({ type: 'paragraph', content: 'Section content' });
  });

  it('returns unknown block for malformed XML', () => {
    const malformedXml = '<task id="invalid"';
    const blocks = parseDitaXml(malformedXml);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: 'unknown', rawXml: malformedXml });
  });

  it('handles empty XML gracefully', () => {
    const blocks = parseDitaXml('');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('unknown');
  });

  it('handles concept and reference topics', () => {
    const conceptXml = `<concept id="c1">
      <title>Concept Title</title>
      <conbody>
        <p>Concept content</p>
      </conbody>
    </concept>`;

    const refXml = `<reference id="r1">
      <title>Reference Title</title>
      <refbody>
        <p>Reference content</p>
      </refbody>
    </reference>`;

    const conceptBlocks = parseDitaXml(conceptXml);
    const refBlocks = parseDitaXml(refXml);

    expect(conceptBlocks[0]).toEqual({ type: 'title', content: 'Concept Title' });
    expect(refBlocks[0]).toEqual({ type: 'title', content: 'Reference Title' });
  });

  it('ignores empty content elements', () => {
    const xml = `<task id="t1">
      <title>Task</title>
      <taskbody>
        <p></p>
        <p>   </p>
        <p>Real content</p>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({ type: 'paragraph', content: 'Real content' });
  });
});

// ─── generateDitaXml ─────────────────────────────────────────────────────────

describe('generateDitaXml', () => {
  it('generates basic task XML from blocks', () => {
    const blocks = [
      { type: 'title' as const, content: 'My Task' },
      { type: 'shortdesc' as const, content: 'Task description' },
      { type: 'paragraph' as const, content: 'Task content' }
    ];

    const xml = generateDitaXml(blocks);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">');
    expect(xml).toContain('<topic id="generated_id">');
    expect(xml).toContain('<title>My Task</title>');
    expect(xml).toContain('<shortdesc>Task description</shortdesc>');
    expect(xml).toContain('<p>Task content</p>');
    expect(xml).toContain('</topic>');
  });

  it('auto-detects task type when task-specific blocks present', () => {
    const blocks = [
      { type: 'title' as const, content: 'Task Title' },
      { type: 'context' as const, content: 'Context info' },
      { type: 'steps' as const, steps: [{ cmd: 'Do something' }] }
    ];

    const xml = generateDitaXml(blocks);

    expect(xml).toContain('<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">');
    expect(xml).toContain('<task id="generated_id">');
    expect(xml).toContain('<taskbody>');
    expect(xml).toContain('</taskbody>');
  });

  it('preserves original topic type when provided', () => {
    const blocks = [
      { type: 'title' as const, content: 'Concept Title' },
      { type: 'paragraph' as const, content: 'Concept content' }
    ];

    const originalXml = '<concept id="c1"><title>Old</title></concept>';
    const xml = generateDitaXml(blocks, originalXml);

    expect(xml).toContain('<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">');
    expect(xml).toContain('<concept id="generated_id">');
    expect(xml).toContain('<conbody>');
  });

  it('generates proper XML for all block types', () => {
    const blocks = [
      { type: 'title' as const, content: 'Test Title' },
      { type: 'note' as const, noteType: 'warning', content: 'Warning text' },
      { type: 'ordered-list' as const, items: ['Item 1', 'Item 2'] },
      { type: 'unordered-list' as const, items: ['Bullet 1', 'Bullet 2'] },
      { type: 'codeblock' as const, content: 'code here' }
    ];

    const xml = generateDitaXml(blocks);

    expect(xml).toContain('<note type="warning">Warning text</note>');
    expect(xml).toContain('<ol>\n      <li>Item 1</li>\n      <li>Item 2</li>\n    </ol>');
    expect(xml).toContain('<ul>\n      <li>Bullet 1</li>\n      <li>Bullet 2</li>\n    </ul>');
    expect(xml).toContain('<codeblock>code here</codeblock>');
  });

  it('handles sections properly', () => {
    const blocks = [
      { type: 'title' as const, content: 'Document Title' },
      { type: 'section-title' as const, content: 'First Section' },
      { type: 'paragraph' as const, content: 'Section content 1' },
      { type: 'section-title' as const, content: 'Second Section' },
      { type: 'paragraph' as const, content: 'Section content 2' }
    ];

    const xml = generateDitaXml(blocks);

    expect(xml).toContain('<section>\n      <title>First Section</title>');
    expect(xml).toContain('<section>\n      <title>Second Section</title>');
    expect(xml).toContain('</section>');
  });

  it('escapes XML special characters in content', () => {
    const blocks = [
      { type: 'title' as const, content: 'Title with <brackets> & ampersands' },
      { type: 'paragraph' as const, content: 'Content with "quotes" and \'apostrophes\'' }
    ];

    const xml = generateDitaXml(blocks);

    expect(xml).toContain('Title with &lt;brackets&gt; &amp; ampersands');
    expect(xml).toContain('Content with &quot;quotes&quot; and &apos;apostrophes&apos;');
  });

  it('preserves allowed inline tags', () => {
    const blocks = [
      { type: 'title' as const, content: 'Title' },
      { type: 'paragraph' as const, content: 'Text with <b>bold</b> and <xref href="link.dita">link</xref>' }
    ];

    const xml = generateDitaXml(blocks);

    expect(xml).toContain('Text with <b>bold</b> and <xref href="link.dita">link</xref>');
  });
});

// ─── extractTextFromBlocks ──────────────────────────────────────────────────

describe('extractTextFromBlocks', () => {
  it('extracts plain text from simple blocks', () => {
    const blocks = [
      { type: 'title' as const, content: 'My Title' },
      { type: 'paragraph' as const, content: 'First paragraph' },
      { type: 'paragraph' as const, content: 'Second paragraph' }
    ];

    const text = extractTextFromBlocks(blocks);
    expect(text).toBe('My Title\nFirst paragraph\nSecond paragraph');
  });

  it('strips XML tags from content', () => {
    const blocks = [
      { type: 'paragraph' as const, content: 'Text with <b>bold</b> and <xref href="link.dita">link text</xref>' }
    ];

    const text = extractTextFromBlocks(blocks);
    expect(text).toBe('Text with bold and link text');
  });

  it('extracts text from list items', () => {
    const blocks = [
      { type: 'ordered-list' as const, items: ['First <b>item</b>', 'Second item'] },
      { type: 'unordered-list' as const, items: ['Bullet one', 'Bullet <i>two</i>'] }
    ];

    const text = extractTextFromBlocks(blocks);
    expect(text).toBe(' First item Second item\n Bullet one Bullet two');
  });

  it('extracts text from steps including cmd, info, and substeps', () => {
    const blocks = [
      {
        type: 'steps' as const,
        steps: [
          { cmd: 'First <b>command</b>', info: 'Some info' },
          { cmd: 'Second command', substeps: ['Sub 1', 'Sub <i>2</i>'] }
        ]
      }
    ];

    const text = extractTextFromBlocks(blocks);
    expect(text).toBe(' First command Some info  Second command  Sub 1 Sub 2');
  });

  it('handles blocks without content gracefully', () => {
    const blocks = [
      { type: 'paragraph' as const },
      { type: 'note' as const, noteType: 'info' },
      { type: 'ordered-list' as const }
    ];

    const text = extractTextFromBlocks(blocks);
    expect(text).toBe('\n\n');
  });

  it('handles empty blocks array', () => {
    const text = extractTextFromBlocks([]);
    expect(text).toBe('');
  });
});

// ─── Regex Bug Fix Test ─────────────────────────────────────────────────────

describe('serializeContent regex bug fix', () => {
  it('works correctly on multiple calls (regression test for global regex bug)', () => {
    // This test specifically verifies the fix for the regex lastIndex bug
    // The original had a global flag which caused subsequent calls to fail
    const blocks = [
      { type: 'paragraph' as const, content: 'Text with <b>bold</b>' },
      { type: 'paragraph' as const, content: 'More text with <i>italic</i>' }
    ];

    // Generate XML multiple times - this would fail with the original regex bug
    const xml1 = generateDitaXml(blocks);
    const xml2 = generateDitaXml(blocks);
    const xml3 = generateDitaXml(blocks);

    // All three should contain the preserved tags
    expect(xml1).toContain('<b>bold</b>');
    expect(xml1).toContain('<i>italic</i>');
    expect(xml2).toContain('<b>bold</b>');
    expect(xml2).toContain('<i>italic</i>');
    expect(xml3).toContain('<b>bold</b>');
    expect(xml3).toContain('<i>italic</i>');

    // They should be identical
    expect(xml1).toBe(xml2);
    expect(xml2).toBe(xml3);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles null and undefined content safely', () => {
    const blocks = [
      { type: 'title' as const, content: undefined },
      { type: 'paragraph' as const, content: null as any }
    ];

    // Should not throw errors
    expect(() => generateDitaXml(blocks)).not.toThrow();
    expect(() => extractTextFromBlocks(blocks)).not.toThrow();
  });

  it('handles special characters in XML content', () => {
    const xml = `<task>
      <title>Task with &amp; ampersand</title>
      <taskbody>
        <p>Content with &lt;brackets&gt; and &quot;quotes&quot;</p>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks[0].content).toBe('Task with & ampersand');
    expect(blocks[1].content).toBe('Content with <brackets> and "quotes"');
  });

  it('handles deeply nested XML structures', () => {
    const xml = `<task>
      <title>Complex Task</title>
      <taskbody>
        <section>
          <title>Section</title>
          <ol>
            <li>Item with <uicontrol>nested <b>tags</b></uicontrol></li>
          </ol>
        </section>
      </taskbody>
    </task>`;

    const blocks = parseDitaXml(xml);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ type: 'section-title', content: 'Section' });
    expect(blocks[2].type).toBe('ordered-list');
  });
});