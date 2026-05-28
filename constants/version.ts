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
    version: '0.8.1',
    date: '2026-05-28',
    title: 'Sections inserted by AI tools now come back as clean, valid DITA, and you can target a specific element to replace instead of always appending.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'When you accepted a section that an AI tool had inserted, the content arrived in your topic looking right but quietly broke on save. Inline elements like `<uicontrol>` and `<wintitle>` were getting flattened into plain bold text, `<ph conkeyref>` attributes vanished, and a stray XHTML namespace tag attached itself to the accepted section. The DITA you pulled back through `GET /api/tabs/:id/content` was not something you could push to Heretto without hand-editing first. Fixed: the editor now remembers exactly which DITA elements every inline node came from, so when you accept a tracked change the original tags come back out intact.',
        ],
      },
      {
        heading: 'API',
        items: [
          '`POST /api/tabs/:id/insert-section` now accepts almost any block-level element as the fragment root: `<p>`, `<ul>`, `<ol>`, `<note>`, `<codeblock>`, `<table>`, `<simpletable>`, `<fig>`, `<image>`, `<dl>`, `<example>`, `<prereq>`, `<context>`, `<result>`, `<postreq>`, and `<steps>`. This also unblocks flat `<conbody>` topics (the ones with no `<section>` wrapper), which can now receive tracked-change injections. Existing `<section>` fragments still work exactly as before.',
          'New `replaceId` parameter on the insert endpoint. Pass the `id` attribute of any element in the open topic and the injected fragment replaces that element in place instead of appending to the end. The old content shows up as a tracked deletion in red, the new content as a tracked insertion in green, and you accept or reject as normal. If the `replaceId` does not match anything in the topic, the fragment appends as a fallback and the console logs a warning rather than erroring out.',
          '`POST /api/load-content` now treats your tab as a real Heretto-backed document when you pass `herettoTargetUuid` in the request body. The `Save to Heretto` button appears, the file association is set, and conflict detection runs the same way as if you had opened the topic from the browser. Before this, external tools that loaded content and wanted you to save it back had to skip the editor entirely and push to the Heretto API on their own.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'When you are in edit mode and hover the pencil icon, the tooltip now reads `Exit Edit Mode` instead of the stale `Enter Edit Mode`. Clicking the pencil to actually exit is a separate fix coming next release. That path needs a confirmation step first so it does not throw away your pending tracked changes.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Four new serialization round-trip tests covering `<uicontrol>` identity, `<wintitle>` identity, `<ph conkeyref>` preservation, and the absence of the stray XHTML namespace on accepted sections.',
          'Seven new injection tests covering `<p>`, `<ul>`, and `<note>` fragments, multi-element fragments, allowlist rejection for non-block elements, backward compatibility for `<section>` fragments, and the `findLexicalKeyByXmlId` resolution path used by `replaceId`.',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-05-27',
    title: 'AI tools can now propose a new section directly into your live document. You see it highlighted as a tracked change, and you decide whether to keep it.',
    sections: [
      {
        heading: 'New API Endpoint',
        items: [
          '`POST /api/tabs/:id/insert-section` lets an AI tool send a `<section>` fragment to one of your open tabs. The new content appears right where you are working, highlighted in green as a tracked insertion. The tab drops into Edit Mode automatically so the only thing left for you to do is click `Accept` to keep the section or `Reject` to throw it away. This is built for AI tools that want to suggest a chunk of new content without overwriting your whole topic.',
        ],
      },
      {
        heading: 'How it works',
        items: [
          'When the request comes in, the editor validates the XML, captures a snapshot of your current document, and appends the new section into the live tree. Because the snapshot did not include the new nodes, the tracked-changes system marks them with the same green styling you already see when you make manual tracked edits.',
          'Nothing else in your document moves or changes color. Only the newly added section is highlighted.',
          'The request body is `{ "xml": "<section><title>...</title><p>...</p></section>" }`. On success you get `{ "success": true, "status": "inserting" }`. Invalid XML or an unknown tab ID returns a descriptive error so the calling tool can react.',
        ],
      },
    ],
  },
  {
    version: '0.7.3',
    date: '2026-05-25',
    title: 'A discoverability sweep: a keyboard shortcut cheat sheet, a version browser for past release notes, a first-run hint, and clearer placeholder copy.',
    sections: [
      {
        heading: 'Discoverability',
        items: [
          'Press `?` (or `Cmd+/` on Mac, `Ctrl+/` on Windows and Linux) to open a cheat sheet that lists every keyboard shortcut grouped by category: Sync, XML editor, Modals. You can also reach it from `File Options` then `Keyboard shortcuts` if you prefer the mouse. The shortcuts have been there for a while, but they were essentially invisible unless you read the source code.',
          'The release notes window now has a version selector along the left side so you can flip through every shipped release, not just the latest one. When the window opens it still lands on the newest version, and the existing one-shot "show on version bump" behavior is unchanged.',
          'The first time you open a tab, a small hint appears over the editor split: `Edit here or in the XML pane — press Ctrl+Enter to sync`. It goes away the moment you sync successfully or close it, and you never see it again. New writers no longer have to guess at the two-pane model.',
        ],
      },
      {
        heading: 'Copy & Polish',
        items: [
          'Placeholder titles now tell you to do something. `Task title`, `Concept title`, and `Reference title` are now `Enter your task title`, and so on. They render in muted italic and vanish the moment you start typing. The old copy looked too much like real content you were supposed to keep.',
          'Toolbar tooltip font size bumped from 10px to 11px. Tiny change, noticeably easier to read at a glance.',
          'Theme dropdown descriptions are tightened into a consistent "what / for whom" pattern: Dark reads `High contrast for low-light work`, Geotab reads `Geotab brand colors`, and the rest follow the same shape.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'The visual editor parser now recognizes template placeholder strings on import (`Enter your task title`, `Short description of the task.`, and the older variants) and applies italic plus muted color so the styling survives a round trip. Backward-compatible: existing topics with the older `Task title` or `Concept title` placeholders still render styled.',
          'New `constants/keyboard-shortcuts.ts` gives shortcuts one place to live. The cheat sheet reads directly from this registry, so future shortcuts only need to be registered once.',
          'Backlog reconciliation: four P3 items (table context menu ARIA, Insert Table modal ARIA plus aria-labels, colspan/rowspan tests) were confirmed shipped untracked and moved to Completed. Four others (LLM-dependent items, conditional text, map discovery) were explicitly parked with unblock conditions so they stop surfacing as actionable.',
        ],
      },
    ],
  },
  {
    version: '0.7.2',
    date: '2026-05-21',
    title: 'The editor finally feels like a document. A real page canvas, redesigned body element indicators, and a + button to insert blocks without touching XML.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          'Your content now sits on a visible "page" that floats on a contrasting "canvas" background, just like every modern writing tool. Light theme gets a soft drop shadow, the dark themes get a clean border. The two surfaces are tuned per theme so they always read clearly against each other.',
          'Prereq, context, result, and postreq sections now render as fully bordered boxes that are always visible. Hovering one lights up the left border in its accent color and fades in a small label chip at the top left. Because the border space is always reserved, the layout no longer jumps when you hover over a section. The old hover-reveal treatment had a small but irritating shift.',
          'The floating `SHORT DESCRIPTION` label is gone. When the short description is empty, a soft italic placeholder now appears right where you would start typing, and disappears the moment you do. Standard placeholder behavior, finally on the field that needed it most.',
        ],
      },
      {
        heading: 'Content Insertion',
        items: [
          'Hover any block in the visual editor and a + button appears in the left margin, in the canvas gutter just outside the page. Click it to open a searchable menu: Paragraph, Bulleted list, Numbered list, Note, Code block, Table, Image, and Link. Type to filter, press Enter or click to insert, and the new block drops in right after the one you hovered. Table and Link open their usual dialogs. The rest insert in place.',
        ],
      },
      {
        heading: 'Theme',
        items: [
          'Dark theme page and canvas backgrounds were only five lightness steps apart, barely enough to tell them apart. Both values are recalibrated so the separation matches the other dark themes.',
          'Geotab theme canvas was near pure black, which made the page look disconnected from the rest of the app. Both values are now anchored in the blue-navy palette the theme is built around.',
        ],
      },
    ],
  },
  {
    version: '0.7.1',
    date: '2026-05-20',
    title: 'A resizable split, word wrap in the XML pane, and a sync hint that knows when to be quiet. Five small things that make long sessions much nicer.',
    sections: [
      {
        heading: 'Polish',
        items: [
          'Drag the handle between the visual editor and the XML pane to set the split to whatever ratio your current task needs. It is clamped between 20% and 80% so neither side can disappear, and your chosen width is remembered across sessions. The old 50/50 split was fixed.',
          'A new word wrap button in the XML toolbar wraps long lines to the pane width instead of letting them run off the right edge. Toggling is immediate and your preference sticks. Deeply nested or attribute-heavy elements no longer require horizontal scrolling just to read a single tag.',
          'The hint `Press Ctrl+Enter to sync between editors` now appears only after an edit creates a real divergence between the two panes, and disappears the moment you sync. It used to live there permanently, which trained you to ignore it.',
          'The Heretto folder browser now tells you what it is doing. Instead of a bare spinner you see `Loading your Heretto folders…`, and during search you see live progress like `Searching… 12 / 34 folders.`. If loading hangs for more than three seconds, a retry option appears.',
          'Hover the readability score in the status bar to see what the number actually means. The tooltip explains the human label and notes that 60 to 70 is the right range for technical documentation. The number was always there. The interpretation was not.',
        ],
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-05-12',
    title: 'Print and export to PDF. Your topics finally leave the editor as clean, readable documents instead of giant browser screenshots.',
    sections: [
      {
        heading: 'New Features',
        items: [
          '`File Options` now has a `Print / Export PDF` item. Click it and your topic opens in a clean print window with proper A4 layout, ready for the browser print dialog. Save as PDF from there. The output is a real document: Inter for body text, JetBrains Mono for code, colored note borders for Warning, Caution, Danger, and Tip, prereq/context/result blocks with their labeled left bars, and bordered tables. Steps render as a numbered list with substeps as a lettered sub-list. Before this, printing meant using the browser`s File then Print on the live editor, which rasterized fonts, Monaco internals, and the whole Lexical DOM into a 10MB+ file for a single page of text.',
          'The print serializer now handles the full DITA element set: CALS tables (`<tgroup>`, `<thead>`, `<tbody>`, `<row>`, `<entry>`), simple tables, definition lists, figures with captions, inline elements (`<uicontrol>` as `<kbd>`, `<filepath>`, `<varname>`, `<cmdname>` as monospace, `<xref>` as linked text), footnotes, and every note type. Unknown elements pass their children through transparently instead of dropping content silently.',
          'If your browser blocks the pop-up, you now see `Print blocked — allow pop-ups for this site` instead of a silent failure.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'The `File Options` and Heretto dropdowns used to get visually clipped by the collapsed XML pane. Both dropdowns lived inside a top bar at the same z-index as the pane`s overlay, so the overlay cut them off. The top bar now sits at a higher z-index, so its dropdowns always render above everything else.',
        ],
      },
    ],
  },
  {
    version: '0.6.2',
    date: '2026-04-14',
    title: 'Cross-references finally look like links, placeholder text reads as editable, and the Heretto connected indicator stops lying.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          '`<xref>` elements now render with an underline in the visual editor so they actually look like the cross-references they are. This sounds like a small CSS tweak, but it unblocked the whole validation layer. The broken-xref red wavy underline and the unresolved-keyref highlight both assumed you could already see where your cross-references were. You could not. The alarm system was built before the house.',
          'The default `Task title` and `Short description of the task.` text now renders muted and italic so it looks like a placeholder, not real content. Until now there was no visual cue that the field needed your attention.',
          'When you convert a new tab from one topic type to another, the template title and short description now swap to match the target type. `Task title` no longer survives a task to concept conversion. If you have already edited those fields, your text is left exactly as it is.',
        ],
      },
      {
        heading: 'Reliability',
        items: [
          'The Heretto connected indicator was lying when your `~/heretto.json` was missing at startup. The Vite proxy never registered, so any request to `/heretto-api/…` quietly returned the SPA `index.html` at HTTP 200. The old check saw a 200 and lit the green dot. The new check also verifies the response carries an `application/xml` content-type, because an HTML body is never a valid Heretto reply. This was the first lie in a two-step failure: the status said `Connected`, and then the save fell apart.',
          'When a save failed and the server returned an HTML page, the toast used to read `Failed to save to Heretto: Failed to save (HTTP 500) <!DOCTYPE html>…`. You now see `Heretto returned an unexpected response — if you just added credentials, restart the dev server and try again.` That is the second lie fixed.',
        ],
      },
    ],
  },
  {
    version: '0.6.1',
    date: '2026-04-10',
    title: 'Broken cross-references surface immediately. An `<xref>` with no `href` now shows a red wavy underline the moment you write it, not after a build.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          '`<xref>` elements with an empty or missing `href` now show a red wavy underline in the visual editor. The indicator appears the instant the XML syncs and clears as soon as you add a valid href. You no longer need to build to find a cross-reference that points nowhere.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Monaco`s `validateDita()` function now scans for `<xref>` tags with empty, missing, or whitespace-only `href` attributes and flags them as Warning markers. The yellow squiggle in the XML pane and the red wavy underline in the visual pane are independent signals that point at the same thing: this link needs an href.',
          'New `XrefValidationPlugin`, a headless Lexical plugin that uses `registerMutationListener(LinkNode, …)` to toggle the `dita-xref-broken` CSS class on link DOM elements in real time. Same mutation-listener pattern as `ShortdescPlugin`. No tree mutations, no serialization side effects. The broken-xref indicator is purely visual.',
          '14 source-code inspection tests covering the plugin structure, Monaco validation logic, CSS class definition, and plugin mounting in `dita-architect.tsx`.',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-04-07',
    title: 'Note types, section bars, and a polish sweep. `<note type="warning">` finally gets a color and a label, hidden step content surfaces, and copy gets clearer across the board.',
    sections: [
      {
        heading: 'Visual Editor',
        items: [
          '`<note type="warning">` now renders with a colored left bar and a `WARNING` label above the content. Caution, Tip, Danger, and Note types each get their own color, and all of them adapt to every theme. You can tell what kind of note you are looking at without checking the XML.',
          '`<title>` elements inside `<section>` elements now have a left border, so section boundaries are easy to scan in long topics. The bar color follows the active theme.',
          'A `<step>` with hidden `<info>` block children now shows inline chips after the command text, like `[codeblock]`, `[p]`, or `[info: 3 elements]` depending on what is in there. The chips are invisible to the serializer (they do not appear in saved output) but they close the silent-failure gap where content existed in the XML and was nowhere to be found in the editor.',
          'A subtle horizontal rule now separates the short description from the body, so the two-part structure of a DITA topic is visible without flipping to the XML pane.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'The `Replace in Heretto` modal grew up. The diff viewer is now 900px wide (up from 600px, capped at 90vw) and fills the available vertical space instead of being stuck at 400px. The diff is the whole point of the preview step. It should not be cramped.',
          'Trying to delete the only remaining row or column in a table now shows a toast: `Can\'t delete the last row` or `Can\'t delete the last column`. Before, the action just silently failed.',
          'Heretto search results now display consistently regardless of how paths come back from the Heretto API.',
          'The `Insert Table` modal now tells you the size limits (`up to 50 rows, 10 columns`), the header row checkbox reads `Include header row (first row as table headers)`, and the keyboard hint matches the link modal: `Press Enter to insert, Escape to cancel.`',
          'Table context menu labels are simpler. The separate `Convert to header row` and `Convert to body row` items are now a single `Toggle header row`. `Merge cells (select multiple cells)` is now the shorter `Merge cells (requires selection)`.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Every `/api/*` response now carries a `success` field (true or false). Error messages are specific too: `Tab with ID "abc" not found` and `Invalid API endpoint format. Expected: /api/tabs/{id}/content` instead of the generic `Not found`. 405 responses now include a JSON body describing the allowed methods.',
          'Fixed two failing tests: corrected assertions in the Heretto image resolution and pending-loads test suites.',
        ],
      },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-04-07',
    title: 'Link integrity and Replace reliability. Links you add visually now actually save, and `Replace in Heretto` stops crying wolf after a successful upload.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'You added a link to existing plain text using the toolbar button, you saw it in the visual editor, and on sync it silently disappeared from the XML. The serializer now checks whether the link structure itself changed, not just the text inside it, before deciding whether the XML needs an update.',
          '`Replace in Heretto` used to report failure after a successful upload. Heretto injects DITA specialization attributes on every element when it ingests content, and the post-upload verification check saw those as a difference and flagged an error. The check now ignores those injected attributes when comparing.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'Links in the visual editor now show a tooltip on hover: `Links open in published output — not in the editor.` so you understand why clicking a link in edit mode does not navigate. The pointer cursor was already telling you it was interactive. The reason it did not respond was missing.',
          'When the `Replace` modal`s verification step finds a difference, that row now shows an amber warning instead of a contradictory green checkmark followed by a red error. Amber means `upload succeeded, but Heretto reformatted the content. Go verify.`',
          'The `Replace` modal error copy is now honest: `Verification failed - remote content differs from uploaded content` is now `Upload succeeded, but Heretto reformatted the content. Check the topic in Heretto to confirm your changes are there.` The `Retry` button is now `Done`, because retrying cannot fix a reformatting difference.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'New round-trip test covers the link-from-scratch case: parses plain-text XML, injects a `LinkNode` programmatically to simulate the toolbar action, and asserts the serialized output contains a well-formed `<xref>` element. The existing tests only covered XML that already had an `<xref>` in it.',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-03-27',
    title: 'Heretto images, inline validation, and clearer status bar copy. Images render in the editor, broken xrefs get wavy underlines, and the status bar speaks like a writer.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Images referenced with relative paths (like `../images/diagram.png`) now resolve and display as real images in the visual editor. You see a shimmer placeholder while the image loads, and the original relative href is preserved in the XML on save.',
          'Broken `<xref>` targets show a red wavy underline, and unresolved keyrefs get a yellow highlight. Validation runs automatically after each sync and updates in real time as you edit. Errors are tracked per tab with no impact on the XML source.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Freshly opened topics used to show a false `Updated in Heretto` conflict warning that was actually just whitespace differences between your local beautified XML and the raw XML from Heretto. The check now normalizes whitespace before comparing.',
          'The status bar label `Conflict — updated in Heretto` now reads `Changes in both locations`, matching the writer-friendly vocabulary used elsewhere in the UI.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Heretto image resolver with a permanent URL cache. Walks ancestor folder UUIDs to resolve relative DITA image paths, caches resolved URLs permanently (image UUIDs do not change), and reuses the existing folder listing cache.',
          'UUID validation on image content URLs. Defense-in-depth check before constructing `/heretto-api/all-files/{uuid}/content` paths.',
          'New `extractXmlIds` utility for validating internal xref targets.',
          'Inline validation color variables added to all six themes. Broken-xref red and unresolved-keyref yellow adapt to Dark, Light, Claude, Nord, Solarized, and Geotab.',
          'SyncManager extended with an `onValidationTrigger` callback so validation re-runs after a successful XML to Lexical sync.',
          '60+ new tests covering image path resolution, folder traversal, caching, UUID security checks, node state management, and inline validation.',
        ],
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-03-17',
    title: 'Insert Table, write API, and a critical parser fix. Tables come from a dialog now, AI tools can edit your content, and task topics with sections finally render correctly.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Click the table icon in the toolbar to create a new DITA table. Pick rows (up to 50), columns (up to 10), and whether you want a header row. The output is valid DITA CALS with proper colspec elements.',
          'AI tools like Claude Code can now edit your content and trigger saves through four new endpoints: `PUT /api/tabs/:id/content` (update the XML), `POST /api/tabs/:id/save` (save to Heretto), `POST /api/tabs/:id/format` (beautify XML), and `GET /api/tabs/:id/stats` (word count, readability). This closes the read-write loop the read endpoints started.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'A task topic with `<section>` elements used to come up with no title and no short description visible in the editor. The parser was matching `<title>` and `<shortdesc>` anywhere in the topic, so the H1 and shortdesc inside the first section were stealing the topic-level slot. The parser now scopes to the topic root, so the topic`s own title and shortdesc always appear above section content.',
        ],
      },
      {
        heading: 'Accessibility',
        items: [
          'The Insert Table modal works from the keyboard. Press Enter to create the table, Escape to cancel. Helper text under the inputs reads `Press Enter to create, Escape to cancel.` Same pattern as the link modal.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Bidirectional sync extended with a third update source (`api`) so content loaded through the write endpoints flows to the visual editor automatically.',
          'Editor state bridge expanded with write callbacks for content update, save, and format.',
          'Parser uses scoped selectors (`:scope > title`) for reliable heading hierarchy across every DITA topic type.',
          '29 new tests across 8 suites covering table creation, keyboard navigation, the write endpoints, API sync integration, and parser edge cases.',
        ],
      },
    ],
  },
  {
    version: '0.3.2',
    date: '2026-03-16',
    title: 'Table editing in place. Right-click any cell to insert or delete rows and columns, plus a batch of bug fixes and accessibility improvements.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Right-click any table cell in the visual editor to insert rows above or below, insert columns left or right, or delete rows and columns. Works for both CALS `<table>` and `<simpletable>` formats. You no longer have to switch to XML to restructure a table.',
          'All three items in the XML toolbar (syntax theme, `Format XML`, collapse) now show tooltips on hover. The `Format XML` tooltip includes its keyboard shortcut: `Format XML (Shift+Alt+F)`.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'The status bar used to get stuck on `Unsaved changes` after a successful save to Heretto. It now updates correctly.',
          'Word count and character count used to show zero when a topic first opened. The counters now reflect your content immediately.',
          'Ctrl+Enter now syncs between editors even when both sides have changed. Before, the sync was blocked when changes existed in both locations.',
          'The `Format XML` button is now inside the XML toolbar row instead of floating outside it.',
        ],
      },
      {
        heading: 'Accessibility',
        items: [
          'Every item in the XML toolbar now has an aria-label. The syntax theme dropdown announces `Select syntax theme: {theme}`, and `Format XML` and `Collapse` have matching labels.',
          'Heretto modal copy improvements. The Replace modal shows a specific recovery path (`topic → History tab`), the diff viewer explains `your content matches the version in Heretto`, and the email placeholder uses `your.name@company.com`.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          '773 tests across 35 suites. New coverage for table context menu operations, format button placement, bottom toolbar initial state, sync change detection, and XML toolbar tooltips.',
          'Multi-agent development pipeline: a 9-agent workflow (kickoff, architecture, code discovery, implementation, code review, UX review, build verification, testing, wrapup) with three self-healing retry gates.',
        ],
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-03-13',
    title: 'Heretto integration. Draft a topic, preview the diff, and replace the live document without leaving the editor.',
    sections: [
      {
        heading: 'New Features',
        items: [
          'Draft a topic, preview the diff against the live version in Heretto, and replace it directly from the editor. The three-step wizard shows you exactly what will change before you commit. After replacing, the tab becomes a real Heretto-backed document with full save, refresh, and change detection.',
          'External tools can now load DITA content into the editor through a stable HTTP endpoint. Content is validated and beautified automatically. This replaces the older browser-automation approach.',
          'Empty Heretto folders now show `No topics in this folder` with a `Create new topic` button instead of just blank space.',
          'A new toolbar button (or `Shift+Alt+F`) beautifies your XML source. Errors now say `Failed to format XML: Check for syntax errors` instead of a generic message.',
        ],
      },
      {
        heading: 'Accessibility',
        items: [
          'All Heretto modals have proper label associations, aria-live regions on search progress, aria-labels on icon buttons, focus management on open, and aria-labelledby on headings.',
          '`Format XML` and the `Replace` bar buttons have screen reader labels.',
        ],
      },
      {
        heading: 'Polish',
        items: [
          'The import toast now says `Imported {fileName}` instead of the developer-centric `Loaded from external tool`.',
          'Theme descriptions are rewritten to help you choose: `High contrast for low-light work`, `Comfortable for extended daytime use`, and so on.',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-03-13',
    title: 'Visual polish. Body element indicators, a warmer Light theme, and tooltip fixes.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'Theme dropdown tooltips used to cover the next option down. They now appear to the right.',
        ],
      },
      {
        heading: 'New Features',
        items: [
          'Prereq, context, result, and postreq blocks now have color bars on the left edge and hover labels. You can tell which DITA element you are in without switching to the XML pane.',
          'The Light theme shifted from cool Slate to warmer Stone tones. Same clarity, easier on the eyes for long sessions.',
        ],
      },
      {
        heading: 'Terminology',
        items: [
          'The `Post-Requisite` label is now `Postrequisites`, matching standard DITA terminology.',
        ],
      },
    ],
  },
  {
    version: '0.1.1',
    date: '2026-03-12',
    title: 'Rendering fixes and editor improvements. Codeblocks, tables, and references finally display faithfully in the visual editor.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          '`<codeblock>` elements nested inside `<p>`, `<context>`, `<prereq>`, `<result>`, or `<postreq>` used to silently disappear from the visual editor. They now render.',
          'H2 section headings are now visible on every theme. The text classes use CSS variables instead of hardcoded colors.',
          'Lists inside table cells now render correctly. Mixed inline-and-block content in a table entry is parsed in reading order.',
          'Empty table rows no longer leave blank visual gaps. Rows with no entries are filtered out.',
          'The theme dropdown is no longer hidden behind the Heretto context toolbar.',
          'Concept-to-task conversion used to silently fail when you tried to save to Heretto. Converted task topics now include the required `<steps>` element that the DITA task DTD requires.',
          'When a Heretto save fails, you now see the specific DTD validation details instead of a generic `Failed to save` message.',
          'The visual editor now syncs immediately after a topic type conversion without needing you to click into it first.',
        ],
      },
      {
        heading: 'New Features',
        items: [
          'Unresolved `<conkeyref>`, `<keyref>`, and `<conref>` references now show as visible chips like `[conkeyref: glossary/term]` instead of blank space. You can see where your unresolved references are.',
          'Table columns now auto-size proportionally based on content length, with a 10% minimum so words do not get broken.',
          'Geotab theme refinements: improved contrast and a clear three-tier hierarchy for text, headings, and muted elements.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Pipeline health reporting: real-time dashboard, error categorization, and fallback plan generation when agents fail.',
          'Agent turn limits raised to 50–100 to prevent mid-task timeouts on complex work.',
          '458 tests across 21 suites, with new coverage for topic type conversions, conkeyref placeholders, mixed-content table cells, and CSS variable consistency.',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-03-10',
    title: 'Stability and usability release. Focused on making the editing experience feel reliable and polished.',
    sections: [
      {
        heading: 'Sync & Data Integrity',
        items: [
          'Round-trip fidelity. Edits in the visual editor no longer silently drop attributes, processing instructions, or comments.',
          'Fixed the savedXmlRef mutation bug that caused false `unsaved changes` warnings.',
          'Heretto saves preserve the remote formatting instead of re-serializing the topic from scratch.',
          'Import now does an integrity check. Topics are fetched twice and compared before opening so you do not start work on a corrupted load.',
        ],
      },
      {
        heading: 'Edit Mode & Tracked Changes',
        items: [
          'A new Edit Mode. Click the pencil icon to isolate your changes before committing them to the document.',
          'Word-level tracked insertions, highlighted via the CSS Custom Highlight API.',
          'Tracked deletions render inline with strikethrough styling so you can see what you removed.',
          'Accept merges your changes into the XML source. Reject restores the snapshot from before you started editing.',
        ],
      },
      {
        heading: 'Editor Polish',
        items: [
          'Full keyboard navigation across every dropdown menu: arrow keys, Escape, and proper focus management.',
          'All modals trap focus, respond to Escape, and carry the right aria-modal attributes.',
          'Multi-tab support. Open several topics side by side, each with its own undo history and sync state.',
          'The status bar shows word count, character count, readability score, encoding, and DITA version.',
        ],
      },
      {
        heading: 'Heretto CMS Integration',
        items: [
          'File browser with breadcrumb navigation, folder-scoped search, and progress indicators.',
          'Save new topics to any Heretto folder, or overwrite existing files.',
          'Background polling detects remote changes and shows you a change indicator.',
          'Credentials live locally in `~/heretto.json` and are never sent to the browser.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          '239 tests covering XML parsing, sync round-trips, tab management, and Heretto utilities.',
          'Modals broken out into standalone components. The main file shrank by 38%.',
          '7-agent development pipeline with checkpoint-based resume for long-running tasks.',
          'Five themes: Dark, Light, Claude, Nord, and Solarized.',
        ],
      },
    ],
  },
];
