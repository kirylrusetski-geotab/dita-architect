declare const __APP_VERSION__: string;

/** Application version injected from package.json at build time. */
export const APP_VERSION: string = __APP_VERSION__;

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  sections: {
    heading: string;
    items: string[];
  }[];
}

/**
 * Release notes for each version, newest first.
 * When shipping a new version:
 *   1. Update `version` in package.json
 *   2. Add a new entry at the top of this array
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.9.6.1',
    date: '2026-05-27',
    title: 'AI-assisted editing — inject a new section directly into the live editor and see it highlighted as a tracked change, ready to accept or reject.',
    sections: [
      {
        heading: 'New API Endpoint',
        items: [
          '`POST /api/tabs/:id/insert-section` — send a `<section>` XML fragment to an open tab and it appears immediately in the visual editor, highlighted in green as a tracked insertion. The tab enters Edit Mode automatically; the author clicks Accept to keep the change or Reject to discard it. Designed for AI tools that want to propose new content without replacing the whole document.',
        ],
      },
      {
        heading: 'How it works',
        items: [
          'The endpoint validates the incoming XML fragment, enters Edit Mode to capture a baseline snapshot of the current editor state, then appends the new section nodes directly into the live Lexical tree. Because the new nodes were not in the baseline, `TrackedChangesPlugin` marks them with the green `tracked-addition` style — the same visual treatment used for manual tracked edits.',
          'Existing content is untouched. Only the appended section carries the green highlight.',
          'Request body: `{ "xml": "<section><title>...</title><p>...</p></section>" }`. Returns `{ "success": true, "status": "inserting" }` on success, or a descriptive error on invalid XML or unknown tab ID.',
        ],
      },
    ],
  },
  {
    version: '0.9.6',
    date: '2026-05-25',
    title: 'Discoverability sweep — a keyboard shortcut cheat sheet, a What\'s New version browser, a first-run coach mark, action-oriented placeholder copy, and a tooltip polish pass.',
    sections: [
      {
        heading: 'Discoverability',
        items: [
          'Keyboard shortcut cheat sheet — press `?` or `Cmd+/` (Mac) / `Ctrl+/` (Windows/Linux) to open a modal listing every shortcut grouped by category (Sync, XML editor, Modals). Also reachable from File Options → "Keyboard shortcuts" for mouse-first discoverability. Until now the shortcuts existed but were undiscoverable without reading the source.',
          'What\'s New version browser — the release notes modal now has a left-rail version selector so you can flip between every shipped version, not just the latest. Default selection is the most recent release; the existing one-shot "show on version bump" behavior is unchanged.',
          'First-run coach mark — the first time you open a tab, a hint appears over the editor split: `"Edit here or in the XML pane — press Ctrl+Enter to sync"`. Dismissed on first successful sync or explicit close and never shown again. New writers no longer have to guess at the two-pane model.',
        ],
      },
      {
        heading: 'Copy & Polish',
        items: [
          'Action-oriented placeholder titles — `"Task title"`, `"Concept title"`, and `"Reference title"` become `"Enter your task title"`, etc. Renders muted-italic and disappears the moment you start typing. The old copy looked too much like real content.',
          'Tooltip font size — bumped from 10px to 11px across the toolbar. Small change, noticeably more legible at glance distance.',
          'Theme description copy refresh — the dropdown descriptions are tightened to a consistent "what / for whom" pattern: Dark → "High contrast for low-light work", Geotab → "Geotab brand colors", and similar for the rest.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Placeholder text styling is now preserved end-to-end — the visual editor parser detects template placeholder strings (`"Enter your task title"`, `"Short description of the task."`, and the older variants) and applies italic + muted color on import. Backward-compatible: existing topics with `"Task title"` or `"Concept title"` still render styled, since the previous shortdesc/placeholder treatment is preserved alongside the new copy.',
          'Single-source keyboard shortcut registry — new `constants/keyboard-shortcuts.ts` so future shortcuts have one place to register. Drives the cheat sheet directly.',
          'Backlog reconciliation — four P3 items (table context menu ARIA, Insert Table modal ARIA + aria-labels, colspan/rowspan tests) confirmed shipped untracked and moved to Completed. Four others (LLM-dependent items, conditional text, map discovery) explicitly parked with unblock conditions so they stop surfacing as actionable.',
        ],
      },
    ],
  },
  {
    version: '0.9.5',
    date: '2026-05-21',
    title: 'The editor feels like a document — a page-canvas layout, redesigned body element indicators, and a + button for inserting blocks without touching XML.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          'Page-canvas layout — the editor surface now sits on a visible "page" that floats on a contrasting "canvas" background, the layout every modern writing tool uses to give content a clear home. Light theme gets a soft drop shadow; dark themes get a clean border. Canvas and page colors are tuned per theme so the two surfaces are always legible against each other.',
          'Body element indicators redesigned — PREREQUISITE / CONTEXT / RESULT / POSTREQ sections now render as always-visible full bordered boxes. Hovering a section lights up the left border in its accent color and fades in a small label chip at the top left. Because the border space is always reserved, nothing shifts when you hover — the layout-shift bug from the old hover-reveal treatment is gone.',
          'Short description placeholder — the floating "SHORT DESCRIPTION" label is gone. When the short description field is empty, a soft italic placeholder appears exactly where you\'d start typing and disappears the moment you do. Standard placeholder behavior, applied to the field that needed it most.',
        ],
      },
      {
        heading: 'Content Insertion',
        items: [
          '+ button for block insertion — hover any block in the visual editor and a + button appears in the left margin, in the canvas gutter just outside the page. Click it to open a searchable element menu: Paragraph, Bulleted list, Numbered list, Note, Code block, Table, Image, and Link. Type to filter, press Enter or click to insert. The new block drops in directly after the hovered element. Table and Link open their existing dialogs; everything else inserts in place.',
        ],
      },
      {
        heading: 'Theme',
        items: [
          'Dark theme contrast — the page and canvas backgrounds were only five lightness steps apart, barely enough to distinguish them. Both values are recalibrated to match the separation established in other dark themes.',
          'Geotab theme canvas — the canvas background was near pure black, making the page feel disconnected from the rest of the app chrome. Both values are now anchored in the blue-navy palette the theme is built around.',
        ],
      },
    ],
  },
  {
    version: '0.9.4',
    date: '2026-05-20',
    title: 'Resizable split pane, word wrap, and a sync hint that knows when to be quiet: five quality-of-life improvements for long editing sessions.',
    sections: [
      {
        heading: 'Polish',
        items: [
          'Split pane is now resizable: drag the handle between the visual and XML editors to adjust the split to whatever ratio your current task needs. Clamped at 20–80% so neither pane collapses out of reach, and your chosen width is remembered across sessions. Previously the 50/50 split was fixed.',
          'Word wrap toggle in the XML editor: a new button in the XML toolbar wraps long lines to the pane width instead of running off the right edge. Toggling is immediate and the preference persists. Deeply nested or attribute-heavy elements no longer require horizontal scrolling just to read a single tag.',
          'Sync hint only appears when editors diverge: "Press Ctrl+Enter to sync between editors" now shows only after an edit in one pane creates a divergence, and disappears the moment you sync. It was permanently visible before, which trained authors to ignore it.',
          'Heretto browser tells you what\'s loading: the folder browser now shows "Loading your Heretto folders…" instead of a bare spinner, and search shows live progress: "Searching… 12 / 34 folders." If loading takes more than three seconds, a retry option appears.',
          'Readability score tooltip: hover the score in the status bar to see what the number means — the human label and a note that 60–70 is the right range for technical documentation. The number was there; the interpretation wasn\'t.',
        ],
      },
    ],
  },
  {
    version: '0.9.3.1',
    date: '2026-05-12',
    title: 'Print / Export PDF — topics leave the editor as clean, readable documents instead of 10MB browser screenshots.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Print / Export PDF — File Options now includes a `Print / Export PDF` item. Clicking it opens your topic in a clean print window with proper A4 layout and calls the browser print dialog. Save as PDF from there. The output is a real document: Inter body text, JetBrains Mono for code, colored note borders (Warning, Caution, Danger, Tip), prereq/context/result blocks with their labeled left bars, and bordered tables. Steps render as a numbered list with substeps as a lettered sub-list. Previously, printing meant using the browser\'s File > Print on the live editor, which rasterized web fonts, Monaco internals, and the Lexical DOM into a 10MB+ file for a single page of text.',
          'Full DITA element coverage in print output — the serializer handles CALS tables (`<tgroup>/<thead>/<tbody>/<row>/<entry>`), simple tables, definition lists, figures with captions, inline elements (`<uicontrol>` as `<kbd>`, `<filepath>/<varname>/<cmdname>` as monospace, `<xref>` as linked text), footnotes, and all note types. Unknown elements pass through their children transparently rather than dropping content.',
          'Pop-up blocked? A toast says so — if Chrome\'s pop-up blocker prevents the print window from opening, you see `"Print blocked — allow pop-ups for this site"` instead of silent failure.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Heretto dropdown no longer clips behind the collapsed XML pane — the File Options and Heretto dropdowns were rendering at `z-index: 20` inside a top bar stacked at the same level, which let the collapsed XML pane\'s overlay (`z-index: 10`) visually cut them off. The top bar is now `z-index: 30`, so its dropdowns always clear the panel.',
        ],
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-04-14',
    title: 'Cross-references look like links, placeholder text signals editability, and the Heretto connected indicator tells the truth.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          'Xrefs are now visually distinct from prose \u2014 `<xref>` elements render with an underline in the visual editor. This sounds like a small CSS fix, but it unblocked the whole validation layer: the broken-xref red wavy underline and unresolved-keyref highlight both assumed authors could already see where their cross-references were. They couldn\u2019t. The alarm was built before the house.',
          'Template placeholder text now looks like a prompt, not content \u2014 the default `Task title` and `Short description of the task.` text renders muted and italic in the visual editor. Until now it was visually identical to real content, with no signal that anything needed replacing.',
          'Topic type conversion no longer carries stale placeholder text \u2014 converting a new tab from task to concept (or any other type) now swaps the template title and short description to match the target type. `"Task title"` no longer survives a task \u2192 concept conversion unchanged. If you\u2019ve already edited those fields, they\u2019re left exactly as-is.',
        ],
      },
      {
        heading: 'Reliability',
        items: [
          'The Heretto connected indicator no longer lies \u2014 when `~/heretto.json` is missing at startup, the Vite proxy is never registered and any request to `/heretto-api/\u2026` falls through to the SPA handler, which returns `index.html` at HTTP\u00a0200. The old check saw `res.ok` and lit the green dot. The new check also verifies the response carries an `application/xml` content-type \u2014 an HTML body is never a valid Heretto reply. Maya Chen flagged this as the first lie in a two-step failure: the status indicator says \u201cConnected\u201d and then the save falls apart.',
          'Save error toasts no longer dump raw HTML \u2014 when a save fails and the server returns an HTML page, the toast used to read `"Failed to save to Heretto: Failed to save (HTTP\u00a0500)\u00a0\u2014\u00a0<!DOCTYPE html>\u2026"`. Authors now see: `"Heretto returned an unexpected response \u2014 if you just added credentials, restart the dev server and try again."` That\u2019s the second lie fixed.',
        ],
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-04-10',
    title: 'Broken links surface earlier \u2014 `<xref>` elements with an empty or missing `href` now show a red wavy underline in both editors the moment you write them, not after a build.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          'Broken xref underlines \u2014 `<xref>` elements with an empty or missing `href` attribute now show a red wavy underline in the visual editor. The indicator appears as soon as the XML syncs and clears the moment a valid href is added. Authors no longer need to build to discover a cross-reference that points nowhere.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Monaco xref validation \u2014 the XML editor\u2019s `validateDita()` function now scans for `<xref>` tags with empty, missing, or whitespace-only `href` attributes and flags them as Warning markers. The yellow squiggle in the XML pane and the red wavy underline in the visual pane are independent signals that agree: this link needs an href.',
          'New `XrefValidationPlugin` \u2014 a headless Lexical plugin that uses `registerMutationListener(LinkNode, \u2026)` to toggle the `dita-xref-broken` CSS class on link DOM elements in real time. Follows the same mutation-listener pattern as `ShortdescPlugin`. No tree mutations, no serialization side effects \u2014 the broken-xref indicator is purely visual.',
          '14 source-code inspection tests covering the plugin structure, Monaco validation logic, CSS class definition, and plugin mounting in `dita-architect.tsx`.',
        ],
      },
    ],
  },
  {
    version: '0.9.1.1',
    date: '2026-04-07',
    title: 'Note types, section bars, and a sweep of polish \u2014 `<note type="warning">` gets a color and a label, steps surface hidden `<info>` content, and a batch of copy and UX refinements lands across the board.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          'Note type labels and color bars \u2014 `<note type="warning">` elements now render with a colored left bar and a `WARNING` label above the content. Caution, Tip, Danger, and Note types each get a distinct color that adapts to all six themes. Authors can see the note type at a glance without checking the XML.',
          'Section heading left bar \u2014 `<title>` elements inside `<section>` elements now render with a left border, making section boundaries visually scannable in long topics. The bar color follows each theme.',
          'Info affordance chips in steps \u2014 `<step>` elements with `<info>` block children now show inline chips after the command text: `[codeblock]`, `[p]`, or `[info: 3 elements]` depending on what\u2019s inside. The chips are invisible to the XML serializer \u2014 they don\u2019t appear in saved output \u2014 but they close the silent-failure gap where step content existed in the XML but wasn\u2019t visible anywhere in the editor.',
          'Short description divider \u2014 a subtle horizontal rule now separates the short description from the body content, making the two-part structure of a DITA topic visible without switching to XML.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'Replace in Heretto modal is now wider \u2014 the diff viewer expands from 600px to 900px (max 90vw) and fills the available vertical space instead of a fixed 400px height. The diff is the whole point of the preview step; it shouldn\u2019t be cramped.',
          'Table operations now explain why they\u2019re blocked \u2014 attempting to delete the only remaining table row or column now shows a toast: `"Can\'t delete the last row"` / `"Can\'t delete the last column"`. Previously this was silent.',
          'Heretto search path separators normalized \u2014 search results now display consistently regardless of how paths are formatted in the Heretto API response.',
          'Insert Table modal clarifications \u2014 help text now shows the size limits (`up to 50 rows, 10 columns`), the header row checkbox reads `"Include header row (first row as table headers)"`, and the keyboard hint aligns with the link modal: `"Press Enter to insert, Escape to cancel."`',
          'Table context menu labels simplified \u2014 separate \u201cConvert to header row\u201d / \u201cConvert to body row\u201d items consolidated to a single `"Toggle header row"`. Merge cells label shortened from `"Merge cells (select multiple cells)"` to `"Merge cells (requires selection)"`.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'All API endpoints now include a `success` field \u2014 every `/api/*` response carries `success: true` or `success: false`. Error messages are specific: `"Tab with ID \\"abc\\" not found"` and `"Invalid API endpoint format. Expected: /api/tabs/{id}/content"` instead of the generic `"Not found"`. 405 responses now include a JSON body describing the allowed methods.',
          'Two failing test fixes \u2014 corrected assertions in the Heretto image resolution and pending-loads test suites.',
        ],
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-04-07',
    title: 'Link integrity and Replace reliability \u2014 links you add in the visual editor now save correctly, and Replace in Heretto no longer cries wolf after a successful upload.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'Links added in the visual editor now serialize as `<xref>` in the XML \u2014 using the Insert Link toolbar button on existing plain text created a visible link in the visual editor that silently disappeared from the XML on sync. Fixed: the serializer now checks whether the link structure changed, not just the text, before deciding whether to update the XML.',
          'Replace in Heretto no longer reports failure after a successful upload \u2014 Heretto injects DITA specialization attributes on every element when it ingests content, which caused the post-upload verification check to see a false difference and show an error. The check now ignores those injected attributes when comparing.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'Links in the visual editor now show a tooltip on hover \u2014 `"Links open in published output \u2014 not in the editor"` so authors understand why clicking a link in edit mode doesn\u2019t navigate. The pointer cursor was already there; the explanation wasn\u2019t.',
          'Replace modal verifying row shows an amber warning instead of a contradictory green checkmark when verification finds a difference \u2014 two green rows followed by a red error was confusing. Amber means \u201cupload succeeded, but Heretto reformatted the content \u2014 go verify.\u201d',
          'Replace modal error message updated to be honest \u2014 `"Verification failed - remote content differs from uploaded content"` is now `"Upload succeeded, but Heretto reformatted the content. Check the topic in Heretto to confirm your changes are there."` The `Retry` button is replaced with `Done`, since retrying can\u2019t fix a reformatting difference.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'New round-trip test covers the link creation-from-scratch case \u2014 parses plain-text XML, injects a `LinkNode` programmatically (simulating the Insert Link toolbar action), and asserts the serialized output contains a well-formed `<xref>` element. The existing tests only covered XML that already contained `<xref>`.',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-03-27',
    title: 'Heretto images, inline validation, and status bar clarity \u2014 images from Heretto render in the visual editor, broken xrefs get wavy underlines, and the status bar speaks writer.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Heretto image rendering \u2014 images referenced with relative paths (like `../images/diagram.png`) now resolve and display as actual images in the visual editor. A shimmer placeholder shows while the image loads, and the original relative href is preserved in the XML on save.',
          'Inline validation hints \u2014 broken `<xref>` targets show a red wavy underline, and unresolved keyrefs get a yellow highlight. Validation runs automatically after each sync and updates in real time as you edit. Errors are tracked per-tab with no impact on the XML source.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'False-positive "Updated in Heretto" resolved \u2014 freshly opened topics no longer show a conflict warning caused by whitespace differences between beautified local XML and raw Heretto XML.',
          'Status bar conflict label updated \u2014 `Conflict \u2014 updated in Heretto` now reads `Changes in both locations`, matching the writer-friendly vocabulary established in the rest of the UI.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Heretto image resolver with permanent URL cache \u2014 walks ancestor folder UUIDs to resolve relative DITA image paths, caches resolved URLs permanently (image UUIDs don\u2019t change), and reuses the existing folder listing cache.',
          'UUID validation on image content URLs \u2014 defense-in-depth check before constructing `/heretto-api/all-files/{uuid}/content` paths.',
          'XML ID extraction utility (`extractXmlIds`) for validation of internal xref targets.',
          'Inline validation variables added to all six app themes \u2014 broken-xref red and unresolved-keyref yellow adapt to Dark, Light, Claude, Nord, Solarized, and Geotab themes.',
          'SyncManager extended with `onValidationTrigger` callback to re-run validation after successful XML\u2192Lexical sync.',
          '60+ new tests covering image path resolution, folder traversal, caching, UUID security checks, node state management, and inline validation.',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-03-17',
    title: 'Insert Table, write API, and a critical parser fix \u2014 create tables visually, let Claude Code edit your content, and section-heavy task topics now render correctly.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Insert Table \u2014 click the table icon in the toolbar to create a new DITA table. Choose rows (up to 50), columns (up to 10), and whether to include a header row. Tables are generated as valid DITA CALS format with proper colspec elements.',
          'Write API endpoints \u2014 Claude Code skills can now edit content and trigger saves via four new endpoints: PUT /api/tabs/:id/content (update XML), POST /api/tabs/:id/save (save to Heretto), POST /api/tabs/:id/format (beautify XML), and GET /api/tabs/:id/stats (word count, readability). Completes the read-write loop started in v0.7.2.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Task topics with sections now render correctly \u2014 the topic-level title and short description were invisible in the visual editor when the topic contained <section> elements. The parser now correctly scopes to the topic root, so the H1 title and shortdesc always appear above section content.',
        ],
      },
      {
        heading: 'Accessibility',
        items: [
          'Insert Table modal supports keyboard navigation \u2014 press Enter to create the table, Escape to cancel. Helper text below the inputs reads "Press Enter to create, Escape to cancel." Matches the existing link modal pattern.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Bidirectional sync extended with a third update source ("api") so content loaded via write endpoints syncs to the visual editor automatically.',
          'Editor state bridge expanded with write callbacks for content update, save, and format operations.',
          'Parser uses scoped selectors (:scope > title) for reliable heading hierarchy across all DITA topic types.',
          '29 new tests across 8 test suites covering table creation, keyboard navigation, write API endpoints, API sync integration, and parser edge cases.',
        ],
      },
    ],
  },
  {
    version: '0.7.2',
    date: '2026-03-16',
    title: 'Table editing \u2014 right-click any table cell to insert or delete rows and columns, plus bug fixes and accessibility improvements.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Table context menu \u2014 right-click any table cell in the visual editor to insert rows above or below, insert columns left or right, or delete rows and columns. Works for both CALS <table> and <simpletable> formats. No more switching to XML to restructure a table.',
          'XML toolbar tooltips \u2014 all three XML toolbar items (syntax theme, Format XML, collapse) now show tooltips on hover. Format XML tooltip includes the keyboard shortcut: "Format XML (Shift+Alt+F)".',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Save status now updates correctly \u2014 the status bar no longer stays stuck on "Unsaved changes" after a successful save to Heretto.',
          'Word and character count no longer shows zeros on initial load \u2014 counters reflect content immediately when a topic opens.',
          'XML\u2192visual sync works when changes exist in both locations \u2014 Ctrl+Enter now syncs changes even when there are changes in both locations.',
          'Format XML button moved into the XML toolbar row \u2014 no longer floats outside the toolbar area.',
        ],
      },
      {
        heading: 'Accessibility',
        items: [
          'Aria-labels on all XML toolbar items \u2014 syntax theme dropdown now announces "Select syntax theme: {theme}", Format XML and Collapse buttons have matching labels.',
          'Heretto modal copy improvements \u2014 replace modal shows specific recovery path ("topic \u2192 History tab"), diff viewer explains "your content matches the version in Heretto", email placeholder uses "your.name@company.com".',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          '773 tests across 35 test suites \u2014 new coverage for table context menu operations, format button placement, bottom toolbar initial state, sync change detection handling, and XML toolbar tooltips.',
          'Multi-agent development pipeline \u2014 9-agent workflow (kickoff, architecture, code discovery, implementation, code review, UX review, build verification, testing, wrapup) with three self-healing retry gates.',
        ],
      },
    ],
  },
  {
    version: '0.7.1',
    date: '2026-03-13',
    title: 'Heretto integration \u2014 draft topics, preview diffs, and replace live documents directly from the editor.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Replace in Heretto \u2014 draft a topic, preview the diff against the live version, and replace it directly from the editor. The three-step wizard shows you exactly what will change before you save. After replacing, the tab transitions to a live Heretto-backed document with full save, refresh, and change detection.',
          'External content loading API \u2014 external tools can now load DITA content into the editor via a stable HTTP endpoint. Content is validated and beautified automatically, replacing the previous browser automation approach.',
          'Heretto empty states \u2014 empty folders now show "No topics in this folder" with a "Create new topic" button instead of blank space.',
          'Format XML \u2014 new toolbar button (or Shift+Alt+F) to beautify your XML source. Errors now tell you "Failed to format XML: Check for syntax errors" instead of a generic message.',
        ],
      },
      {
        heading: 'Accessibility',
        items: [
          'All Heretto modals now have proper label associations, aria-live regions on search progress, aria-labels on icon buttons, focus management on open, and aria-labelledby on headings.',
          'Format XML button and Replace bar buttons have screen reader labels.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'Import toast now says "Imported {fileName}" instead of developer-centric "Loaded from external tool".',
          'Theme descriptions updated to help you choose: "High contrast for low-light work", "Comfortable for extended daytime use", and more.',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-03-13',
    title: 'Visual polish \u2014 body element indicators, light theme warmth, and tooltip fixes.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'Theme dropdown tooltips no longer cover the next option \u2014 they now appear to the right.',
        ],
      },
      {
        heading: 'New Features',
        items: [
          'Body element indicators \u2014 prereq, context, result, and postreq blocks now show left-edge color bars and hover labels so you can tell which DITA element you\'re editing without checking the XML source.',
          'Light theme warmth \u2014 the Light theme shifted from cool Slate to warmer Stone tones. Same clarity, more comfortable for long sessions.',
        ],
      },
      {
        heading: 'Terminology',
        items: [
          '"Post-Requisite" label corrected to "Postrequisites" to match DITA standard terminology.',
        ],
      },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-03-12',
    title: 'Rendering fixes and editor improvements — codeblocks, tables, and references now display faithfully in the visual editor.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'Codeblock content now renders in the visual editor \u2014 <codeblock> elements nested inside <p>, <context>, <prereq>, <result>, or <postreq> no longer silently disappear',
          'H2 section headings visible on all themes \u2014 text classes now use CSS variables instead of hardcoded colors',
          'Lists inside table cells render correctly \u2014 mixed inline-and-block content in table entries is parsed in reading order',
          'Empty table rows filtered out \u2014 rows with no entries no longer create blank visual gaps',
          'Theme dropdown no longer hidden behind the Heretto context toolbar',
          'Concept-to-task conversion no longer fails to save to Heretto \u2014 converted task topics now include the required <steps> element per the DITA task DTD',
          'Heretto save errors now surface specific DTD validation details instead of a generic "Failed to save" message',
          'Visual editor syncs immediately after topic type conversion without requiring focus',
        ],
      },
      {
        heading: 'New Features',
        items: [
          'Conkeyref / keyref / conref placeholder chips \u2014 unresolved references display as visible chips (e.g. [conkeyref: glossary/term]) instead of blank space',
          'Table column auto-sizing \u2014 columns proportionally distribute width based on content length, with a 10% minimum to prevent word-breaking',
          'Geotab theme refinements \u2014 improved contrast and visual hierarchy with three distinct tiers for text, headings, and muted elements',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Pipeline health reporting \u2014 real-time dashboard, error categorization, and fallback plan generation when agents fail',
          'Agent turn limits increased to 50\u2013100 to prevent mid-task timeouts on complex work',
          '458 tests across 21 test suites, with new coverage for topic type conversions, conkeyref placeholders, mixed-content table cells, and CSS variable consistency',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-03-10',
    title: 'Stability and usability release focused on making the editing experience feel reliable and polished.',
    sections: [
      {
        heading: 'Sync & Data Integrity',
        items: [
          'Fixed XML round-trip fidelity \u2014 edits in the visual editor no longer silently drop attributes, processing instructions, or comments',
          'Resolved the savedXmlRef mutation bug that caused false \u201cunsaved changes\u201d warnings',
          'Heretto CMS sync now preserves remote formatting on save instead of re-serializing from scratch',
          'Added integrity verification on import \u2014 topics are fetched twice and compared before opening',
        ],
      },
      {
        heading: 'Edit Mode & Tracked Changes',
        items: [
          'New Edit Mode \u2014 click the pencil icon to isolate changes before saving them to the document',
          'Word-level tracked insertions highlighted via the CSS Custom Highlight API',
          'Tracked deletions rendered inline with strikethrough styling',
          'Accept merges changes into the XML source; Reject restores the pre-edit snapshot',
        ],
      },
      {
        heading: 'Editor Polish',
        items: [
          'Full keyboard navigation across all dropdown menus \u2014 Arrow keys, Escape, and focus management',
          'All modals now trap focus, respond to Escape, and carry proper aria-modal attributes',
          'Multi-tab support \u2014 open several topics side by side, each with independent undo history and sync state',
          'Status bar shows word count, character count, readability score, encoding, and DITA version',
        ],
      },
      {
        heading: 'Heretto CMS Integration',
        items: [
          'File browser with breadcrumb navigation, folder-scoped search, and progress indicators',
          'Save new topics to any Heretto folder or overwrite existing files',
          'Background polling detects remote changes and surfaces change indicators',
          'Credentials stored locally in ~/heretto.json \u2014 never sent to the browser',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          '239 tests covering XML parsing, sync round-trips, tab management, and Heretto utilities',
          'Modals decomposed into standalone components \u2014 main file reduced by 38%',
          '7-agent development pipeline with checkpoint-based resume for long-running tasks',
          'Five application themes: Dark, Light, Claude, Nord, and Solarized',
        ],
      },
    ],
  },
];
