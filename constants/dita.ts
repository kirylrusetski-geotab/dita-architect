// P2-25 slice 2: troubleshooting joins the other three topic types. Every
// place that used to switch on the 3-value literal union was audited when
// this was added — see lib/xml-utils.ts (BODY_TAG_MAP, DOCTYPE_MAP,
// DEFAULT_TOPIC_IDS, withUpdatedTopicId), components/ShortdescPlugin.tsx
// (isKnownTopicType), components/TopicTypeModal.tsx (a `types` prop restricts
// Convert Topic Type to the original three — composing a troubleshooting
// topic's condition/cause/remedy structure from generic content is a
// different problem than creating one from a template, and isn't asked for).
export const DITA_TOPIC_TYPE = ['task', 'concept', 'reference', 'troubleshooting'] as const;
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
  // Shape matches real Heretto troubleshooting topics (ADR-009): a <condition>,
  // then a <troubleSolution> holding one <cause> and one <remedy> whose steps
  // are <steps-unordered> (the form Heretto's own authors use, and the only
  // list form the content model allows inside <remedy> — bare <ul>/<ol> are
  // deliberately excluded there).
  troubleshooting: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">
<troubleshooting id="new_troubleshooting">
  <title/>
  <shortdesc/>
  <troublebody>
    <condition>
      <p>Describe the condition that triggers this issue.</p>
    </condition>
    <troubleSolution>
      <cause>
        <p>Describe the cause of the issue.</p>
      </cause>
      <remedy>
        <steps-unordered>
          <step><cmd>First remedy step.</cmd></step>
        </steps-unordered>
      </remedy>
    </troubleSolution>
  </troublebody>
</troubleshooting>`,
};

/** Prompts rendered (as CSS `data-placeholder`) while the title is empty. Keyed by topic type; see GENERIC_PLACEHOLDER_TITLE for unknown types. */
export const DITA_PLACEHOLDER_TITLES: Record<DitaTopicType, string> = {
  task: 'Enter your task title',
  concept: 'Enter your concept title',
  reference: 'Enter your reference title',
  troubleshooting: 'Enter your troubleshooting title',
};

/** Prompts rendered while the shortdesc is empty. */
export const DITA_PLACEHOLDER_SHORTDESCS: Record<DitaTopicType, string> = {
  task: 'Enter a short description of the task.',
  concept: 'Enter a short description of the concept.',
  reference: 'Enter a short description of the reference.',
  // "the issue" reads better to a writer than "the troubleshooting" — the one
  // deliberate deviation from the task/concept/reference naming pattern above.
  troubleshooting: 'Enter a short description of the issue.',
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
