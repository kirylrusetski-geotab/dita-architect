export const DITA_TOPIC_TYPE = ['task', 'concept', 'reference'] as const;
export type DitaTopicType = typeof DITA_TOPIC_TYPE[number];

// FR-049: templates ship genuinely EMPTY <title/> and <shortdesc/>. The prompt
// the writer sees ("Enter your task title") is CSS decoration applied by
// ShortdescPlugin while the node is empty — it is never document text, so it
// can never be appended to or saved to Heretto. Self-closed form because that
// is what XMLSerializer emits, so a fresh template round-trips byte-stable.
export const DITA_TEMPLATES: Record<DitaTopicType, string> = {
  task: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="new_task">
  <title/>
  <shortdesc/>
  <taskbody>
    <steps>
      <step><cmd>First step.</cmd></step>
    </steps>
  </taskbody>
</task>`,
  concept: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="new_concept">
  <title/>
  <shortdesc/>
  <conbody>
    <p>Concept content goes here.</p>
  </conbody>
</concept>`,
  reference: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="new_reference">
  <title/>
  <shortdesc/>
  <refbody>
    <p>Reference content goes here.</p>
  </refbody>
</reference>`,
};

/** Prompts rendered (as CSS `data-placeholder`) while the title is empty. Keyed by topic type; see GENERIC_PLACEHOLDER_TITLE for unknown types. */
export const DITA_PLACEHOLDER_TITLES: Record<DitaTopicType, string> = {
  task: 'Enter your task title',
  concept: 'Enter your concept title',
  reference: 'Enter your reference title',
};

/** Prompts rendered while the shortdesc is empty. */
export const DITA_PLACEHOLDER_SHORTDESCS: Record<DitaTopicType, string> = {
  task: 'Enter a short description of the task.',
  concept: 'Enter a short description of the concept.',
  reference: 'Enter a short description of the reference.',
};

export const GENERIC_PLACEHOLDER_TITLE = 'Enter a title';
export const GENERIC_PLACEHOLDER_SHORTDESC = 'Enter a short description.';

/** The demo topic the app opens with. Real prose, not placeholders (FR-049 out of scope). */
export const INITIAL_DITA: string = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="setup_widget">
  <title>Setting up the widget</title>
  <shortdesc>To set up the widget, you need Node.js 18.</shortdesc>
  <taskbody>
    <prereq>First, download the widget package from the repo.</prereq>
    <context>The widget runs locally on your machine and connects to the cloud dashboard. Make sure you have an active internet connection before starting.</context>
    <steps>
      <step><cmd>Extract it to your folder.</cmd></step>
      <step><cmd>Run npm install widget-component and finally configure it in your settings.</cmd></step>
      <step><cmd>Check the browser console to make sure it works.</cmd></step>
    </steps>
    <result>The widget appears in your browser at localhost:3000. You should see a green status indicator confirming the connection to the cloud dashboard.</result>
  </taskbody>
</task>`;
