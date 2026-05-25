export const DITA_TOPIC_TYPE = ['task', 'concept', 'reference'] as const;
export type DitaTopicType = typeof DITA_TOPIC_TYPE[number];

export const DITA_TEMPLATES: Record<DitaTopicType, string> = {
  task: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="new_task">
  <title>Enter your task title</title>
  <shortdesc>Enter a short description of the task.</shortdesc>
  <taskbody>
    <steps>
      <step><cmd>First step.</cmd></step>
    </steps>
  </taskbody>
</task>`,
  concept: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="new_concept">
  <title>Enter your concept title</title>
  <shortdesc>Enter a short description of the concept.</shortdesc>
  <conbody>
    <p>Concept content goes here.</p>
  </conbody>
</concept>`,
  reference: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="new_reference">
  <title>Enter your reference title</title>
  <shortdesc>Enter a short description of the reference.</shortdesc>
  <refbody>
    <p>Reference content goes here.</p>
  </refbody>
</reference>`,
};

export const DITA_PLACEHOLDER_TITLES: Record<DitaTopicType, string> = {
  task: 'Enter your task title',
  concept: 'Enter your concept title',
  reference: 'Enter your reference title',
};

export const DITA_PLACEHOLDER_SHORTDESCS: Record<DitaTopicType, string> = {
  task: 'Enter a short description of the task.',
  concept: 'Enter a short description of the concept.',
  reference: 'Enter a short description of the reference.',
};

export const INITIAL_DITA: string = DITA_TEMPLATES.task
  .replace('new_task', 'setup_widget')
  .replace('Task title', 'Setting up the widget')
  .replace('Short description of the task.', 'To set up the widget, you need Node.js 18.')
  .replace(
    '<steps>\n      <step><cmd>First step.</cmd></step>\n    </steps>',
    `<prereq>First, download the widget package from the repo.</prereq>
    <context>The widget runs locally on your machine and connects to the cloud dashboard. Make sure you have an active internet connection before starting.</context>
    <steps>
      <step><cmd>Extract it to your folder.</cmd></step>
      <step><cmd>Run npm install widget-component and finally configure it in your settings.</cmd></step>
      <step><cmd>Check the browser console to make sure it works.</cmd></step>
    </steps>
    <result>The widget appears in your browser at localhost:3000. You should see a green status indicator confirming the connection to the cloud dashboard.</result>`,
  );
