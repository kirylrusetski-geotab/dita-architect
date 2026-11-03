/**
 * Tests for the DITA topic conversion logic in convertDitaTopic (lib/xml-utils.ts),
 * which backs handleConvertTopic in hooks/useTabManager.ts.
 *
 * Environment: vitest + jsdom (provides DOMParser, XMLSerializer, Node constants).
 */

import { describe, it, expect } from 'vitest';
import { convertDitaTopic } from '../lib/xml-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRoot(xml: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc.documentElement;
}

/** Return text content of the first element matching `tag` inside `root`. */
function text(root: Element, tag: string): string | null {
  return root.querySelector(tag)?.textContent ?? null;
}

// ---------------------------------------------------------------------------
// Fixture XML strings
// ---------------------------------------------------------------------------

const TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="install_widget">
  <title>Install Widget</title>
  <shortdesc>How to install the widget.</shortdesc>
  <taskbody>
    <prereq>You need Node.js 18.</prereq>
    <steps>
      <step><cmd>Download the package.</cmd></step>
      <step><cmd>Run npm install.</cmd></step>
    </steps>
  </taskbody>
</task>`;

const CONCEPT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="widget_overview">
  <title>Widget Overview</title>
  <shortdesc>What the widget is.</shortdesc>
  <conbody>
    <p>The widget is a reusable component.</p>
  </conbody>
</concept>`;

const REFERENCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="widget_api">
  <title>Widget API</title>
  <shortdesc>API reference.</shortdesc>
  <refbody>
    <p>Use <codeph>widget.init()</codeph> to start.</p>
  </refbody>
</reference>`;

/** A task with no taskbody element at all. */
const TASK_NO_BODY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="bare_task">
  <title>Bare Task</title>
</task>`;

/** A task whose <step> has no <cmd> child — bare text node inside <step>. */
const TASK_STEP_NO_CMD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="no_cmd_task">
  <title>No-Cmd Task</title>
  <taskbody>
    <steps>
      <step>Do something directly.</step>
    </steps>
  </taskbody>
</task>`;

// ---------------------------------------------------------------------------
// 1. Basic structural conversion: task → concept
// ---------------------------------------------------------------------------

describe('task → concept conversion', () => {
  it('returns ok: true', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    expect(result.ok).toBe(true);
  });

  it('sets the root element to <concept>', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.tagName).toBe('concept');
  });

  it('preserves the id attribute', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.getAttribute('id')).toBe('install_widget');
  });

  it('renames taskbody → conbody', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelector('taskbody')).toBeNull();
    expect(root.querySelector('conbody')).not.toBeNull();
  });

  it('preserves the title and shortdesc', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(text(root, 'title')).toBe('Install Widget');
    expect(text(root, 'shortdesc')).toBe('How to install the widget.');
  });

  it('adds the correct DOCTYPE declaration', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.xml).toContain('<!DOCTYPE concept PUBLIC');
  });

  it('adds the XML declaration', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.xml).toMatch(/^<\?xml version="1\.0"/);
  });
});

// ---------------------------------------------------------------------------
// 2. concept → reference conversion
// ---------------------------------------------------------------------------

describe('concept → reference conversion', () => {
  it('sets the root element to <reference>', () => {
    const result = convertDitaTopic(CONCEPT_XML, 'reference');
    if (!result.ok) throw new Error('unexpected failure');
    expect(parseRoot(result.xml).tagName).toBe('reference');
  });

  it('renames conbody → refbody', () => {
    const result = convertDitaTopic(CONCEPT_XML, 'reference');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelector('conbody')).toBeNull();
    expect(root.querySelector('refbody')).not.toBeNull();
  });

  it('preserves paragraph content', () => {
    const result = convertDitaTopic(CONCEPT_XML, 'reference');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(text(root, 'p')).toBe('The widget is a reusable component.');
  });

  it('uses the correct reference DOCTYPE', () => {
    const result = convertDitaTopic(CONCEPT_XML, 'reference');
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.xml).toContain('<!DOCTYPE reference PUBLIC');
  });
});

// ---------------------------------------------------------------------------
// 3. reference → task conversion (no task-element conversion applied)
// ---------------------------------------------------------------------------

describe('reference → task conversion', () => {
  it('renames refbody → taskbody', () => {
    const result = convertDitaTopic(REFERENCE_XML, 'task');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelector('refbody')).toBeNull();
    expect(root.querySelector('taskbody')).not.toBeNull();
  });

  it('uses the correct task DOCTYPE', () => {
    const result = convertDitaTopic(REFERENCE_XML, 'task');
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.xml).toContain('<!DOCTYPE task PUBLIC');
  });
});

// ---------------------------------------------------------------------------
// 4. Task-specific element conversion (steps → ol, prereq → p)
// ---------------------------------------------------------------------------

describe('task-specific element conversion on task → concept', () => {
  it('converts <steps>/<step>/<cmd> to <ol>/<li>', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);

    expect(root.querySelector('steps')).toBeNull();
    expect(root.querySelector('step')).toBeNull();
    expect(root.querySelector('cmd')).toBeNull();

    const ol = root.querySelector('ol');
    expect(ol).not.toBeNull();
    const items = ol!.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Download the package.');
    expect(items[1].textContent).toBe('Run npm install.');
  });

  it('converts <prereq> to <p>', () => {
    const result = convertDitaTopic(TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);

    expect(root.querySelector('prereq')).toBeNull();
    const paras = root.querySelectorAll('p');
    const prereqPara = Array.from(paras).find(p => p.textContent?.includes('Node.js'));
    expect(prereqPara).not.toBeUndefined();
    expect(prereqPara!.textContent).toBe('You need Node.js 18.');
  });
});

describe('task-specific element conversion on task → reference', () => {
  it('converts <steps> to <ol> and <prereq> to <p>', () => {
    const result = convertDitaTopic(TASK_XML, 'reference');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);

    expect(root.querySelector('steps')).toBeNull();
    expect(root.querySelector('ol')).not.toBeNull();
    expect(root.querySelector('prereq')).toBeNull();
  });
});

describe('task-specific elements NOT converted when source is not task', () => {
  it('does not touch <p> elements when converting concept → task', () => {
    const result = convertDitaTopic(CONCEPT_XML, 'task');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    // The <p> in the concept body should survive unchanged
    expect(root.querySelector('p')).not.toBeNull();
    expect(text(root, 'p')).toBe('The widget is a reusable component.');
  });
});

// ---------------------------------------------------------------------------
// 5. Step without <cmd> — bare text node inside <step>
// ---------------------------------------------------------------------------

describe('step without <cmd> child', () => {
  it('moves step children directly into <li>', () => {
    const result = convertDitaTopic(TASK_STEP_NO_CMD_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    const li = root.querySelector('li');
    expect(li).not.toBeNull();
    expect(li!.textContent?.trim()).toBe('Do something directly.');
  });
});

// ---------------------------------------------------------------------------
// 6. Missing body element — should produce an empty new body tag
// ---------------------------------------------------------------------------

describe('missing body element', () => {
  it('appends an empty conbody when task has no taskbody', () => {
    const result = convertDitaTopic(TASK_NO_BODY_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    const body = root.querySelector('conbody');
    expect(body).not.toBeNull();
    // The body should be empty (no children)
    expect(body!.children).toHaveLength(0);
  });

  it('still preserves title when body is missing', () => {
    const result = convertDitaTopic(TASK_NO_BODY_XML, 'reference');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(text(root, 'title')).toBe('Bare Task');
    expect(root.querySelector('refbody')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Already-same-type handling
// ---------------------------------------------------------------------------

describe('already-same-type', () => {
  it('returns ok: false with reason "same-type" for task → task', () => {
    const result = convertDitaTopic(TASK_XML, 'task');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('same-type');
  });

  it('returns ok: false with reason "same-type" for concept → concept', () => {
    const result = convertDitaTopic(CONCEPT_XML, 'concept');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('same-type');
  });

  it('returns ok: false with reason "same-type" for reference → reference', () => {
    const result = convertDitaTopic(REFERENCE_XML, 'reference');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('same-type');
  });
});

// ---------------------------------------------------------------------------
// 8. Invalid XML handling
// ---------------------------------------------------------------------------

describe('invalid XML', () => {
  it('returns ok: false with reason "invalid-xml" for malformed XML', () => {
    const result = convertDitaTopic('<task><unclosed>', 'concept');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('invalid-xml');
  });

  it('returns ok: false with reason "invalid-xml" for empty string', () => {
    const result = convertDitaTopic('', 'concept');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('invalid-xml');
  });

  it('returns ok: false with reason "invalid-xml" for plain text', () => {
    const result = convertDitaTopic('not xml at all', 'task');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('invalid-xml');
  });
});

// ---------------------------------------------------------------------------
// 9. Attribute preservation
// ---------------------------------------------------------------------------

describe('attribute preservation', () => {
  const XML_WITH_ATTRS = `<?xml version="1.0" encoding="UTF-8"?>
<task id="my-task" xml:lang="en-US" outputclass="premium">
  <title>Attrs Task</title>
  <taskbody/>
</task>`;

  it('copies all root attributes to the new element', () => {
    const result = convertDitaTopic(XML_WITH_ATTRS, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.getAttribute('id')).toBe('my-task');
    expect(root.getAttribute('outputclass')).toBe('premium');
  });
});

// ---------------------------------------------------------------------------
// 10. Nested task elements (steps-unordered would be unusual but steps nesting)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 11. Troubleshooting conversion (P2-25 slice 2 — BODY_TAG_MAP/DOCTYPE_MAP
// completeness). The UI never offers troubleshooting as a Convert target
// (TopicTypeModal's `types` prop), but convertDitaTopic itself must not
// crash or corrupt a document if it's ever called with it directly.
// ---------------------------------------------------------------------------

const TROUBLESHOOTING_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">
<troubleshooting id="cant_add_users">
  <title>Why can't I add users?</title>
  <shortdesc>Learn why the option is unavailable.</shortdesc>
  <troublebody>
    <condition>
      <p>The option to add a user is unavailable.</p>
    </condition>
    <troubleSolution>
      <cause>
        <p>Your account lacks the clearance to add users.</p>
      </cause>
      <remedy>
        <steps-unordered>
          <step><cmd>Contact an administrator.</cmd></step>
        </steps-unordered>
      </remedy>
    </troubleSolution>
  </troublebody>
</troubleshooting>`;

describe('task → troubleshooting conversion', () => {
  it('renames taskbody → troublebody', () => {
    const result = convertDitaTopic(TASK_XML, 'troubleshooting');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelector('taskbody')).toBeNull();
    expect(root.querySelector('troublebody')).not.toBeNull();
  });

  it('uses the correct troubleshooting DOCTYPE and preserves title/shortdesc', () => {
    const result = convertDitaTopic(TASK_XML, 'troubleshooting');
    if (!result.ok) throw new Error('unexpected failure');
    expect(result.xml).toContain('<!DOCTYPE troubleshooting PUBLIC');
    const root = parseRoot(result.xml);
    expect(text(root, 'title')).toBe('Install Widget');
  });

  it('converts <steps>/<step>/<cmd> to <ol>/<li> (task-specific cleanup still applies)', () => {
    const result = convertDitaTopic(TASK_XML, 'troubleshooting');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelector('steps')).toBeNull();
    expect(root.querySelector('ol')).not.toBeNull();
  });
});

describe('troubleshooting → concept conversion', () => {
  it('renames troublebody → conbody and preserves the condition/cause/remedy content', () => {
    const result = convertDitaTopic(TROUBLESHOOTING_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelector('troublebody')).toBeNull();
    const conbody = root.querySelector('conbody');
    expect(conbody).not.toBeNull();
    // Nothing is dropped — the troubleshooting containers move in whole.
    expect(conbody!.querySelector('condition')).not.toBeNull();
    expect(conbody!.querySelector('troubleSolution > cause')).not.toBeNull();
    expect(conbody!.querySelector('troubleSolution > remedy')).not.toBeNull();
  });

  it('does not duplicate the body — exactly one body-tag element', () => {
    const result = convertDitaTopic(TROUBLESHOOTING_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    expect(root.querySelectorAll('conbody, troublebody')).toHaveLength(1);
  });
});

describe('troubleshooting → troubleshooting (same-type)', () => {
  it('returns ok: false with reason "same-type"', () => {
    const result = convertDitaTopic(TROUBLESHOOTING_XML, 'troubleshooting');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.reason).toBe('same-type');
  });
});

describe('nested task elements', () => {
  const NESTED_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="nested">
  <title>Nested</title>
  <taskbody>
    <prereq><b>Bold prereq</b> text.</prereq>
    <steps>
      <step><cmd><b>Bold</b> command.</cmd></step>
    </steps>
  </taskbody>
</task>`;

  it('preserves inline markup inside <cmd> when converting to <li>', () => {
    const result = convertDitaTopic(NESTED_TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    const li = root.querySelector('li');
    expect(li).not.toBeNull();
    // The <b> element should be preserved inside the <li>
    expect(li!.querySelector('b')).not.toBeNull();
    expect(li!.textContent).toContain('Bold');
  });

  it('preserves inline markup inside <prereq> when converting to <p>', () => {
    const result = convertDitaTopic(NESTED_TASK_XML, 'concept');
    if (!result.ok) throw new Error('unexpected failure');
    const root = parseRoot(result.xml);
    const paras = root.querySelectorAll('p');
    const prereqPara = Array.from(paras).find(p => p.querySelector('b'));
    expect(prereqPara).not.toBeUndefined();
    expect(prereqPara!.querySelector('b')!.textContent).toBe('Bold prereq');
  });
});
