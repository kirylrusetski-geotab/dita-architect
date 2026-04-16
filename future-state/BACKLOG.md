# DITA Architect Backlog

**Last updated:** 2026-04-07 (P2-24, P3-29, P3-30, P3-31 added; P2-25, P3-32–P3-39 added; P3-31 scoped and broken out; P3-30 superseded); 2026-04-07 (P1-13 shipped; P2-26 added; P1-14 shipped; P3-40 added); 2026-04-10 (P2-27 added; v0.9.2 shipped — empty-href xref validation in Monaco + visual editor); 2026-04-13 (P3-41 added — placeholder swap on topic type conversion, bundled with P3-25; P3-37/P3-38 promoted to P2-28/P2-29; P3-42 added for conditional text; FR-037 added for general discoverability); 2026-04-14 (P2-30 added — base xref visual styling; P3-25/41, P3-32–35, P3-36, P3-39 promoted to P2-31–P2-37); 2026-04-14 (v0.9.3 shipped — Sonnet sweep: P2-30, P2-31, P3-40 shipped); 2026-04-14 (backlog cleanup: removed shipped/promoted stale rows from P2 and P3 tables; added v0.9.1.1 Completed section)

This is the single prioritized backlog for DITA Architect. Every actionable item — bugs, features, integration work, asset extraction — lives here with a clear priority, dependency chain, and execution criteria.

---

## Priority Definitions

| Priority | Meaning | Action |
|----------|---------|--------|
| **P0** | Blocks users or breaks core functionality now | Fix in next working session |
| **P1** | Degrades the editing experience or blocks a planned workflow | Fix before next feature work |
| **P2** | Improves quality or enables future work | Schedule in next available cycle |
| **P3** | Nice-to-have, no urgency | Pick up opportunistically |

---

## Active Backlog

### P0 — Fix Now

No open P0 items.

> P0-3 shipped in v0.8.0. See Completed section for details.

---

### P1 — Before Next Feature Work

No open P1 items.

> P1-8 through P1-14 have all shipped (v0.6.0–v0.9.1). See Completed section for details.

---

### P2 — Next Cycle

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P2-23 | [Render Heretto images in the visual editor](feature-requests.md#fr-030-render-heretto-images-in-the-visual-editor) | Feature | Infrastructure built, two sub-bugs fixed (wrong API endpoint, off-by-one parent folder index), but images still fall back to placeholder chip. Root cause unresolved — see `bugreports/BUG-heretto-image-resolution-fails.md`. |
| P2-24 | [Normalize separators in "Open from Heretto" search](feature-requests.md#fr-033-normalize-separators-in-open-from-heretto-search) | Bug/Polish | Search uses raw `.includes()` — spaces, underscores, and hyphens are treated as distinct characters. Writers searching `traffic analysis` get no results for `setting-up-traffic-analysis.dita`. Fix: normalize both query and file name by collapsing `[\s_-]+` to a single space before comparison. One-line change in `useHerettoCms.ts:250`. High impact on daily file discovery. |
| P2-25 | Troubleshooting topic support | Feature | Full support for DITA troubleshooting topics across three surfaces: (1) **Parser** — `troubleshootingbody` is absent from the body selector in `parseXmlToLexical.ts:537` (`'taskbody, conbody, refbody, body'`), so topics opened from Heretto silently drop all body content; add `troubleshootingbody` and handle `cause`, `remedy`, `condition` as structural body children. (2) **Heretto import** — once parser is fixed, opening troubleshooting topics from Heretto should work correctly. (3) **New Topic modal** — add `Troubleshooting` as a fourth option alongside Task, Concept, Reference, with an appropriate XML template. Design session (2026-04-07): confirmed DA cannot create troubleshooting topics; silent body drop on Heretto open is a bug. Body element indicators (`cause`, `remedy`) to be added as a follow-on once parse support is in place. |
| P2-27 | "Connect a Map" — key registry, keyref validation, and cross-file xref validation | Feature | Writers currently see all keyref chips as neutral with no validation — there is no way to know whether a key resolves without building to HTML. This item delivers the full "ditamap-aware" layer: (1) **Entry point** — `"Connect a Map"` action in the Heretto dropdown (future top-level menu bar redesign tracked separately as a design FR). (2) **Loader** — fetches and parses a ditamap from Heretto by UUID; follows `<mapref>` elements recursively up to **3 levels deep** (covers the Altitude warehouse hierarchy: root → `Altitude_variables_within_variables.ditamap` → `Altitude_variables.ditamap`); extracts all `<keydef>` and `<glossref>` elements to build a `Map<string, { href: string; mapName: string }>` key registry. Note: writers must connect the correct map for their workflow — the User Guide root map exposes 18 keys (VARS + 17 GLOS-*), while warehouse keys (`varsAltitude`, `varsAltitudeUI`, `varsAltitudeNotes`, `varsAltitudeNav`, `varsAltitudeXREF`) live in separate ditamaps not referenced from the User Guide root; writers know which map to load. (3) **Persistence** — UUID written to `localStorage` automatically on successful connect; silently restored on next launch with no toast. No close-tab modal (browsers block `beforeunload`). Manual `"Reload map"` button in Heretto dropdown; auto-refresh is a future FR. (4) **Three chip states** (UX review, Kiryl): neutral "no map" chip + tooltip `"Load a ditamap to verify this key resolves"`; yellow "unresolved" chip + tooltip `"Key not found in the loaded map"`; neutral "resolved" chip + tooltip `"Key found in [MapName.ditamap]"`. Do not collapse resolved and no-map chips into one — all three states must be visually distinct. (5) **Success feedback** — toast: `"Connected [MapName.ditamap] — N key definitions loaded"`. (6) **Failure feedback** — modal (not toast) with specific error message (network failure, bad UUID, malformed XML each get distinct language); keyrefs remain in their previous state on failure. (7) **Cross-file xref validation** — for `href` values that reference another file (e.g. `other-file.dita` or `other-file.dita#target-id`), fetch the target topic from Heretto, extract its ID set, and check that the fragment exists; broken → red wavy underline (`dita-validation-broken-xref`, already styled). Same-document `#anchor` validation already ships in v0.9.0 and is unaffected. (8) **Discovery** — writers know which map to connect; a map-discovery tool (surface ditamaps that reference the current topic) is a future FR tracked separately. |
| P2-28 | Inline element insertion menu (`+` shell) | Feature | The visual editor has no way to insert inline semantic elements (`<uicontrol>`, `<codeph>`, `<term>`, `<xref>`, etc.) — writers must switch to XML, type manually, and sync back. This blocks the tool from being used for serious authoring work where inline markup is constant. Add a `+` button in the toolbar that opens a searchable picker modal: left column shows element categories (UI Elements, Code, Cross-references, Text markup), right shows filtered results with descriptions. Arrow keys navigate, Enter inserts at cursor. Follows the modal pattern of Insert Table and Insert Link. Promoted from P3-37. **Blocks P2-29 and P3-39.** Opus-sized — requires cursor/selection preservation during sync and attribute handling for elements like `<xref>`. |
| P2-29 | DITA inline element catalog with insertion logic | Feature | Populate the `+` menu (P2-28 shell) with the full DITA inline element catalog: `<uicontrol>`, `<codeph>`, `<apiname>`, `<varname>`, `<filepath>`, `<systemoutput>`, `<userinput>`, `<msgph>`, `<wintitle>`, `<term>`, `<ph>`, `<xref>`, `<cite>`, `<q>`, `<keyword>`, `<parmname>`, `<option>`, `<cmdname>`, and others. Each entry: display name, description, category, DITA element name, whether it requires attributes. On insert: wrap selection if text is selected; insert empty element and position cursor inside if no selection; open attribute sub-modal for elements requiring attributes (`<xref>`, `<image>`). Element catalog lives in a new `constants/dita-inline-elements.ts`. Promoted from P3-38. **Ship with P2-28 in the same session.** Opus-sized. |
| P2-26 | `<info>` and block children of `<step>` are invisible in the visual editor | Bug | `parseXmlToLexical.ts:255` reduces every `<step>` to its `<cmd>` child only: `const contentNode = child.querySelector('cmd') \|\| child`. Any `<info>` content — including `<codeblock>`, `<note>`, `<ul>`, and other block elements — is never traversed and never rendered. The data is **not lost** (the serializer deliberately preserves `<info>` and other non-`<cmd>` children in the DOM, per the comment at `serializeLexicalToXml.ts:490`), but it is completely invisible in the visual editor. A disabled test file (`parse-xml-to-lexical.test.ts.disabled`) covers a `<step><cmd>/<info><codeblock>` case, indicating this was identified previously and deferred. UX finding (Maya Chen, authoring session 2026-03-13 and product review 2026-03-16): "`<info>`, `<substep>`, and `<substeps>` elements are invisible in the visual editor" — flagged twice, never formally tracked. The worst case is a command-line task topic where the code authors are supposed to run is inside `<step>/<info>/<codeblock>` — the step reads `"Run the following command:"` and then shows nothing. Authors cannot tell whether the content exists without switching to the XML pane. **Two-phase fix:** (1) **Phase 1 — Affordance chips (Sonnet-sized):** Render collapsed inline chips within each step list item for any `<info>` block children that cannot be fully rendered — e.g. a `[codeblock]` or `[info: 2 elements]` chip after the `<cmd>` text. Closes the `"is my content there?"` question without architectural rework. (2) **Phase 2 — Full `<info>` rendering (Opus-sized):** Requires a custom `DitaStepNode` or a sibling-node approach so that `<info>` block content (codeblocks, notes, lists) renders as visually nested content under each step. Lexical's `ListItemNode` does not support block children natively — this is the architectural blocker. Phase 1 can ship independently. |

| P2-35 | Always-visible border box with top-left label chip for semantic task elements | Feature | Replace hover-reveal treatment for `prereq`, `context`, `result`, `postreq` with always-visible full border box and top-left label chip. New approach: all four sides border (always visible, rounded corners), label chip in top-left (`CONTEXT`, `PREREQ`, etc. — always visible). Supersedes P3-30. Design rationale (Maya Chen): always-visible labels are more accessible, match left-to-right reading patterns, match acquired product reference. Requires CSS redesign across all six themes and `ShortdescPlugin.tsx` changes. **Good candidate to bundle with P3-12 (page-view layout)** — both touch the visual editor container. Promoted from P3-35. Opus-sized. |
| P2-36 | DITA 1.3 content model map | Tech debt | Build `parentElement → validChildren[]` lookup table from the DITA 1.3 spec. No UI — this becomes the source of truth for element insertion filtering (P2-28/P2-29) and future validation. Independent, can ship any time. Reused by P2-29 (catalog insertion logic), P2-37 (context-aware filtering), and potentially autocomplete. Promoted from P3-36. Opus-sized. |
| P2-37 | Context-aware insertion filtering for `+` menu | Feature | Wire the content model map (P2-36) to `originMap` context to filter the `+` menu (P2-28) to only valid children of the current element. `"Intelligently"` mode is default; `"All elements"` toggle available for power users. **Depends on P2-36 + P2-28.** Maya (2026-04-07): not optional — showing writers they can insert `<section>` inside a `<step>` would be worse than no menu. Promoted from P3-38. Opus-sized. |
| P2-38 | Recently used elements section in `+` menu | Polish | Surface last 3–5 inserted elements at top of `+` menu, above the full searchable list. Persist in localStorage, scoped per topic type. **Depends on P2-28 (menu shell).** Promoted from P3-39. Sonnet-sized. |

> P2-1 through P2-5, P2-6 through P2-22 have all shipped (v0.6.0–v0.9.0). P2-32, P2-33, and P2-34 shipped in v0.9.1.1. P2-30 and P2-31 shipped in v0.9.3. See Completed section for details.

---

### P3 — Opportunistic

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P3-1 | [Extract AI diff-review workflow from V1](acquisition-evaluation-dita-doer.md) | Extraction | ⚠️ **AI-dependent.** High-value pattern but requires new AI integration infrastructure. Not needed for current workflows. |
| P3-2 | [Extract geminiService.ts from V3](acquisition-evaluation-dita-doer.md) | Extraction | ⚠️ **AI-dependent.** Good prompt engineering reference. Useful when AI features are on the roadmap. |
| P3-3 | [Extract ConversionWizard from V3](acquisition-evaluation-dita-doer.md) | Extraction | ⚠️ **AI-dependent.** Guided migration for new users. Valuable but no user demand yet. |
| P3-4 | [Extract ChatSidebar pattern from V3](acquisition-evaluation-dita-doer.md) | Extraction | ⚠️ **AI-dependent.** AI chat with inline proposals. Design is sound, needs full rewrite. |

> **Note on AI features (P3-1 through P3-4):** These items require an API key to an LLM provider (e.g., Anthropic, OpenAI, Google). We do not currently have access to one and there is no timeline for obtaining one. **Approach:** If feasible, build the backend integration with the LLM abstraction in place and gate the frontend features behind a key-availability check — they remain hidden until a key is configured. Otherwise, defer these items to a future roadmap when LLM access is available.
| P3-5 | [Extract ditaUtils.ts from V3](acquisition-evaluation-dita-doer.md) | Extraction | XML parser/serializer reference. Fix regex bug at line 188 before any use. |
| P3-6 | [Extract DownloadWarningModal from V1](acquisition-evaluation-dita-doer.md) | Extraction | 51-line validation gate. Trivial to port when export flow is built. |
| P3-7 | Geotab theme session action items | Polish | Theme descriptions, tooltip font size, screen reader testing, visual verification. See `.claude/session-2026-03-10-geotab-theme.md`. |
| P3-8 | [Release notes version browser in What's New modal](feature-requests.md#fr-002-release-notes-version-browser-in-whats-new-modal) | Feature | Modal currently shows only the latest entry. A version selector turns it from a one-time notification into a lightweight changelog. Low urgency — only two versions exist today. |
| P3-9 | [Keyboard shortcut cheat sheet](feature-requests.md#fr-005-keyboard-shortcut-cheat-sheet) | Feature | Good shortcuts exist but are undiscoverable without reading source. Overlay triggered by `?` or `Cmd+/`, grouped by category. Small surface, signals respect for keyboard-driven workflows. |
| P3-12 | [Page-view layout for the visual editor](feature-requests.md#fr-029-page-view-layout-for-the-visual-editor) | Polish | Content area fills the pane edge-to-edge — no visual boundary between document and chrome. Wrap `ContentEditable` in a page surface with background differentiation and theme-aware elevation (shadow on Light, border on dark). Pure CSS, no behavioral changes. Good candidate to bundle with P2-35 (semantic element border box redesign) since both touch the visual editor container. |
| P3-13 | Table context menu accessibility (ARIA + keyboard navigation) | Accessibility | UX review (Maya Chen, P2-19 pipeline): context menu lacks `role="menu"`/`role="menuitem"`, no keyboard navigation (arrow keys, Enter/Space), no focus management on open, no focus trapping, disabled items need `aria-disabled="true"`. Mouse-only right now — keyboard and screen reader users can't use it. |
| P3-15 | Restore colspan/rowspan table tests | Tech debt | Pipeline wrapup (Rafael Santos, P2-19): colspan/rowspan parsing fails in test environment — 3 tests skipped. Restore when test infrastructure supports them. |
| P3-18 | API authentication for production | Tech debt | Pipeline wrapup (Rafael Santos, P2-20): endpoints expose full XML content with no auth. Fine for localhost dev, but needs an auth gate if the editor is ever exposed beyond the local machine. |
| P3-22 | Insert Table modal ARIA dialog attributes | Accessibility | UX review (Maya Chen, P2-21 pipeline): modal needs proper ARIA dialog role and label attributes for screen reader support. |
| P3-24 | Insert Table modal aria-labels on number inputs | Accessibility | UX review (Maya Chen, P3-19 pipeline): number inputs need explicit `aria-label="Number of rows"` and `aria-label="Number of columns"` for screen readers. Also add `aria-describedby` linking helper text to inputs. |
| P3-42 | Conditional text support (audience, platform, product attributes) | Feature | DITA's multi-variant content model — `@audience`, `@platform`, `@product` filtering — is not supported. No visual indication when an element is conditionalized, no filtering UI, no attribute editor. Two-phase approach if ever prioritized: (1) **Phase 1 — Visual indicator:** badge or border on conditionalized elements showing the attribute value (e.g., `[audience: admin]`); (2) **Phase 2 — Filtering:** UI to preview the topic rendered for a specific audience/platform/product, hiding elements that don't match. Deliberately deferred — no current user demand for multi-variant authoring. Worth tracking so it doesn't get forgotten if the tool scales to larger teams. Filed 2026-04-13. |
| P3-26 | Out-of-sync indicator for visual editor | Feature | UX review (Maya Chen, product question): when the XML editor has been updated but Ctrl+Enter hasn't been pressed, the visual editor shows stale content with no visual indicator. Add a subtle banner or dimmed overlay like `"Visual editor is out of sync — press Ctrl+Enter to refresh"`. |
| P3-27 | ["Loaded from Heretto" status state for freshly opened topics](feature-requests.md#fr-031-loaded-from-heretto-status-state-for-freshly-opened-topics) | Bug/Polish | Opening a topic from Heretto immediately shows 🔴 `Updated in Heretto` due to formatting differences between beautified local XML and raw remote XML. Two fixes: (1) use `compareXml` instead of strict string equality in the poll comparison to eliminate false positives, (2) add a `herettoJustLoaded` state that shows 🟢 `Loaded from Heretto` until the writer edits or saves. |
| P3-30 | ~~Polish body element hover frame interaction~~ | ~~Polish~~ | **Superseded by P3-35.** The hover frame approach is being replaced entirely with an always-visible border box. The three issues this item targeted (layout shift, missing transition, label offset) are resolved as a side effect of the P3-35 redesign. Do not implement separately. |
| P3-31 | [Extend body element indicators to non-task topic types](feature-requests.md#fr-032-extend-body-element-indicators-to-non-task-topic-types) | Feature | **Scoped and broken out — promoted to P2.** Design session (2026-04-07) split this into four discrete items: P2-32 (shortdesc divider, shipped v0.9.1.1), P2-33 (note type labels, shipped v0.9.1.1), P2-34 (section left bar, shipped v0.9.1.1), P2-35 (always-visible border box, active). Original broad item retired for traceability. |

---

## Recommended Execution Order

**Session N (next):** P2-24 (search separator normalization). One-line fix in `useHerettoCms.ts:250` — high impact on daily file discovery with near-zero risk. Good candidate to batch with P2-23 if the image debugging session is short.

**Session N+1:** P2-23 (Heretto image resolution root cause). Infrastructure is in place — needs runtime debugging to identify why `resolvedUrl` stays empty. See investigation leads in `bugreports/BUG-heretto-image-resolution-fails.md`.

**Session N+2:** P2-25 (Troubleshooting topic support). Three-surface feature: parser body selector fix (`troubleshootingbody`), `cause`/`remedy`/`condition` traversal, and New Topic modal fourth option with XML template. Start with the parser fix first — it unblocks Heretto import immediately.

**Session N+3:** P2-26 Phase 1 (`<info>` affordance chips). Render collapsed inline chips in step list items for `<info>` block content that can't yet be fully rendered — e.g. `[codeblock]` or `[info: 2 elements]` after the `<cmd>` text. Closes the "is my content there?" feedback gap without the architectural rework. Sonnet-sized.

**Sonnet sweep (done — v0.9.3):** P2-30 (xref base styling), P2-31 (placeholder treatment + conversion fix), P3-40 (Heretto connection false positive + HTML error copy) shipped. All remaining sweep items (P2-32, P2-33, P2-34, P3-10, P3-11, P3-14, P3-16, P3-17, P3-20, P3-21, P3-23, P3-28, P3-29) shipped in v0.9.1.1.

**Opus session A:** P3-12 (page-view layout) + P2-35 (always-visible border box treatment). Bundle these — both touch the visual editor container. P3-12 is also the prerequisite for P2-28 (`+` button shell), so shipping it unlocks the insertion menu work.

**Opus session B:** P2-36 (DITA 1.3 content model map). Independent — can be built any time. No UI, just the data structure. Output used by P2-37.

**Opus session C:** P2-28 + P2-29 (inline element insertion — `+` menu shell + DITA element catalog). The single biggest authoring friction point. Depends on P3-12. Start with currently-supported elements only; populates incrementally as Phase 1A elements ship.

**Opus session D:** P2-37 (context-aware filtering). Depends on P2-36 + P2-28. Completes the intelligent insertion feature.

**Sonnet (after P2-28 ships):** P2-38 (recently used elements). Single addition to the existing menu; Sonnet-sized.

**Opus session E:** P2-26 Phase 2 (full `<info>` rendering in steps). Design and implement `DitaStepNode` or a sibling-node approach so `<info>` block children (codeblocks, notes, lists) render as visually nested content under each step. Depends on Phase 1 having shipped — the chips give authors a working affordance while the architectural work is in progress.

**Ongoing:** P3 items are picked up when the relevant feature area is being worked on (e.g., extract DownloadWarningModal when building export, version browser when a third release ships). P3-30 is superseded by P2-35 — do not implement separately. **P3-1 through P3-4 are blocked** on LLM API key access — no timeline; defer to future roadmap unless key becomes available.

---

## Completed

### Shipped in v0.9.3 (2026-04-14)

Sonnet sweep: xref base styling, placeholder visual treatment, and Heretto reliability fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-30 | Base visual styling for xrefs in the visual editor | Bug/Polish | Added `text-decoration: underline` to `.dita-editor-text-link` so xrefs are always visually distinct from plain prose. `InlineValidationPlugin` was already stamping `title` attributes on all `LinkNode` DOM elements (edit-mode tooltip on valid links, error message on broken/unresolved). |
| P2-31 | Template placeholder visual treatment + stale text on topic type conversion | Polish | (1) `ShortdescPlugin` now detects whether the H1 title or shortdesc text matches a DITA template placeholder (from new `DITA_PLACEHOLDER_TITLES` / `DITA_PLACEHOLDER_SHORTDESCS` constants in `constants/dita.ts`) and applies `dita-editor-placeholder-title` or `dita-editor-placeholder-shortdesc` CSS class. Placeholder titles render muted italic; placeholder shortdescs render at reduced opacity. (2) `convertDitaTopic` in `lib/xml-utils.ts` now swaps `<title>` and `<shortdesc>` content when converting topic type, if the text exactly matches the source type's placeholder — `"Task title"` no longer survives a task→concept conversion unchanged. Writer-edited content is never touched. |
| P3-40 | Heretto connection check false positive and HTML-body error copy | Bug/Polish | (1) Connection check (`useHerettoCms.ts`) now verifies `content-type: application/xml` in addition to `res.ok`. An HTTP 200 with an HTML body (the SPA fallback when the proxy is unregistered) no longer sets the green "Connected" indicator. Applied to mount check, `testHerettoConnection`, and post-credential-save recheck. (2) `handleHerettoSave` error body parsing now detects HTML responses (`startsWith('<!DOCTYPE')` or `startsWith('<html')`) and substitutes an actionable message instead of dumping raw HTML into the toast. |

---

### Shipped in v0.9.1.1 (2026-04-14)

Copy/polish batch: visual editor semantics, writer-friendly terminology, API polish, modal UX, and table feedback.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-32 | Shortdesc/body divider line | Polish | Added `border-bottom: 1px solid var(--app-border-subtle)` to `.dita-editor-shortdesc`. Separates the topic header (title + shortdesc) from the body content with a clean horizontal rule across all topic types. |
| P2-33 | Note type labels and color bars | Feature | Parser stamps `noteType` in `nodeOriginMap` during traversal; `ShortdescPlugin` reads it and applies `NOTE_TYPE_CLASSES` mapping (`dita-editor-note-warning`, `dita-editor-note-caution`, `dita-editor-note-tip`, `dita-editor-note-danger`). CSS variables per theme: `--editor-note-warning` (amber), `--editor-note-caution` (amber-orange), `--editor-note-tip` (green), `--editor-note-danger` (red). Untyped notes keep existing orange. All six themes updated. |
| P2-34 | Section left bar on H2 title | Feature | Parser stamps `{ tag: 'section-title' }` in `nodeOriginMap` when a heading is a direct child of `<section>`; `ShortdescPlugin` applies `dita-editor-section-title` class. CSS adds `border-left: 3px solid var(--editor-section-bar)` with `--editor-section-bar` mapped to `--editor-accent` per theme. |
| P3-10 | Rename `Commit` to `Save to Heretto` | Polish | Replaced `Commit` with `Save to Heretto` in the status bar and Heretto dropdown. Removes Git vocabulary from the writer-facing UI. |
| P3-11 | Writer-friendly vocabulary in status bar | Polish | Rephrased developer-centric status bar terms: `Unsaved changes` → `Unsaved`, `Conflict` → `Out of sync`, `Commit` → `Save to Heretto`. |
| P3-14 | Table context menu copy refinements | Polish | Replaced separate "Convert to header row" / "Convert to body row" labels with "Toggle header row". Simplified merge label from "Merge cells (select multiple cells)" to "Merge cells (requires selection)". |
| P3-16 | Improve API error messages | Polish | `"Not found"` → `"Invalid API endpoint format. Expected: /api/tabs/{id}/content"`. `"Tab not found"` → `"Tab with ID \"{tabId}\" not found"`. 405 responses now include body: `"Method not allowed. This endpoint only supports GET requests"`. |
| P3-17 | Add `success` field to API responses | Polish | Added `success: boolean` to all API JSON responses. Consistent status signal without inspecting HTTP codes — makes Claude Code skill integration cleaner. |
| P3-20 | Insert Table modal help text for size constraints | Polish | Added help text below row/column inputs: "Max 50 rows, 10 columns." Writers no longer discover the limit by hitting a validation error. |
| P3-21 | Clarify Insert Table "Include header row" label | Polish | Changed checkbox label from "Include header row" to "Include header row (first row as table headers)". |
| P3-23 | Insert Table modal verb consistency | Polish | Changed helper text from "Press Enter to create, Escape to cancel" to "Press Enter to insert, Escape to cancel" — consistent with the link modal pattern. |
| P3-28 | Larger Replace in Heretto preview modal with fluid diff height | Polish | Modal width changed from `w-[600px]` to `w-[900px] max-w-[90vw]`. DiffViewer changed from `height={400}` to `flex-1 min-h-0`, filling available vertical space within the existing `max-h-[90vh]` modal. |
| P3-29 | User feedback for prevented table operations | Polish | Deleting the last row now toasts `"Cannot delete the last row — tables must have at least one row"`. Deleting the last column toasts the equivalent message. Delete menu items gain explanatory hover tooltips. |

---

### Shipped in v0.9.1 (2026-04-07)

xref serialization fix and Replace verification fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-13 | [xref not serialized when link added in visual editor](../bugreports/BUG-xref-not-serialized-from-visual-editor.md) | Bug | `patchElementContent` in `serializeLexicalToXml.ts` was returning early when `domText === lexText`, bypassing serialization even when the Lexical node had a `LinkNode` with no matching `<xref>` in the DOM. Fix: before the early return, compare the count of `link`-type children in Lexical against `<xref>` elements in the DOM — a mismatch forces `replaceElementContent`. Added a creation-from-scratch test to `tests/sync/round-trip.test.ts`: parses plain-text XML, injects a `LinkNode` via `editor.update({ discrete: true })`, asserts `<xref href="..." format="html">` in the serialized output. |
| P1-14 | Replace in Heretto: false negative on verification due to Heretto `class` attribute injection | Bug | Three fixes: (1) `handleHerettoReplace` in `hooks/useHerettoCms.ts` now strips Heretto-injected DITA specialization `class` attributes from both sides before calling `compareXml` — `xml.replace(/\s+class="[^"]*"/g, '')` applied to `content` and `remote` before comparison. Heretto adds these on every element on ingest, causing a false `'different'` result even when content is correct. Error message updated to `"Upload succeeded, but Heretto reformatted the content. Check the topic in Heretto to confirm your changes are there."` (2) `HerettoReplaceModal.tsx` verifying row: icon now correctly shows `<AlertTriangle>` (amber) on `success === false` instead of `<CheckCircle>` (green) — the `!== null` condition was showing two green rows followed by a red error, which was contradictory. `"done"` text also restricted to `success === true`. (3) Action buttons: `Cancel + Retry` replaced with a single `Done` button on failure — retrying cannot fix a Heretto reformatting difference. |

---

### Shipped in v0.9.0 (2026-03-27)

Inline validation hints and Heretto image infrastructure (partial).

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-6 | [Inline validation hints in visual editor](feature-requests.md#fr-004-inline-validation-hints-in-the-visual-editor) | Feature | Red underlines on broken `xref` targets, yellow highlights on unresolved keyrefs. Brings validation into the authoring moment instead of waiting for build time. |

---

### Shipped in v0.8.0 (2026-03-17)

Insert Table, write API, keyboard navigation, parser fix, and tooltip fix.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P0-3 | Task-level title and shortdesc not rendered in visual editor | Bug | Replaced broad `doc.querySelector('title')` with scoped `topicElement.querySelector(':scope > title')` to ensure topic-level title and shortdesc are selected, not nested section titles. 7 tests covering all DITA topic types with sections. |
| P1-12 | `Expand XML editor` tooltip covers header status text | Bug | Replaced native `title` attribute with `<Tooltip>` component using `placement="left"`. Added `left` as a new Tooltip placement option. Also added `aria-label` for screen reader support. |
| P2-21 | Insert Table toolbar action | Feature | Toolbar button opens modal with rows (1-50), columns (1-10), and header row checkbox. Generates DITA CALS `<table>` with sequential colspec elements. Defaults to 3×3 with header. |
| P2-22 | Write API endpoints for Claude Code integration | Feature | Four endpoints: `PUT /api/tabs/:id/content` (update XML), `POST /api/tabs/:id/save` (save to Heretto), `POST /api/tabs/:id/format` (beautify XML), `GET /api/tabs/:id/stats` (word count, readability). Bidirectional sync extended with `'api'` update source. |
| P3-19 | Insert Table modal keyboard navigation | Accessibility | Enter key creates table, Escape key closes modal. Helper text "Press Enter to create, Escape to cancel." follows link modal pattern. |

---

### Shipped in v0.7.3–v0.7.4 (2026-03-17)

Table context menu and read-only API endpoints.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-19 | Table context menu (insert/delete rows and columns) | Feature | Right-click context menu on table cells with toggle header row, cell merge (CALS only), and cell unmerge. Conservative simpletable detection prevents invalid DITA spanning attributes. Menu height increased to 320px. Passed code review after retry (header/body boundary validation added). Build clean, 39/42 tests passing. Accessibility follow-up tracked as P3-13. |
| P2-20 | Read-only API endpoints for Claude Code integration | Feature | Three endpoints: `GET /api/status` (version, Heretto connection, tab count, active tab, theme), `GET /api/tabs` (list open tabs with metadata), `GET /api/tabs/:id/content` (full DITA XML + validation errors). State bridge via `lib/editor-state-bridge.ts` syncs React state to Vite server. 25 tests. Passed code review after TypeScript strict mode fix. |

---

### Shipped in v0.7.2 (2026-03-16)

P1 bug fixes: word count, sync during conflict, format button placement. Tooltips and aria-labels on XML toolbar. Save feedback loop fix.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-9 | Word/character count shows zeros on initial load | Bug | Defensive try-catch error boundaries in `BottomToolbar.tsx` around editor state reads. Immediate state read in `useEffect` catches content parsed before listener attached. |
| P1-10 | XML→visual sync blocked during conflict state | Bug | Removed redundant `pending === lastXmlRef.current` condition in `SyncManager.tsx` that prevented Ctrl+Enter sync during Heretto conflict state. |
| P1-11 | Format XML button floats outside XML toolbar | Bug | Moved Format button from absolute-positioned overlay in `MonacoDitaEditor.tsx` into the XML toolbar row in `dita-architect.tsx`. Restyled to match existing toolbar button pattern. |
| — | XML toolbar tooltips and aria-labels | Feature | Added `<Tooltip>` wrappers and aria-labels to all three XML toolbar items (syntax theme dropdown, format button, collapse button). Dynamic aria-label on syntax theme: `"Select syntax theme: {theme}"`. Keyboard shortcut in format tooltip: `"Format XML (Shift+Alt+F)"`. |
| P2-15 | Improve HerettoReplaceModal recovery text | Polish | Changed to `"To recover, use Heretto's version history (topic → History tab)."` in HerettoReplaceModal.tsx. |
| P2-16 | Improve DiffViewer empty state copy | Polish | Changed to `"No changes detected — your content matches the version in Heretto"` in DiffViewer.tsx. |
| P2-17 | Use contextual placeholder in HerettoStatusModal | Polish | Changed email placeholder from `"user@example.com"` to `"your.name@company.com"` in HerettoStatusModal.tsx. |
| P2-18 | Save confirmation feedback loop | Bug | `handleHerettoSave` in `useHerettoCms.ts` was missing `herettoDirty: false` in the `setTabs` call after successful save. Status bar stayed on `Unsaved changes` because the `useEffect` deriving dirty state only watched `xmlContent`, not `savedXmlRef.current`. One-line fix. |

---

### Shipped in v0.7.1 (2026-03-13)

Replace in Heretto workflow + accessibility + toast copy.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-2 | Replace in Heretto workflow | Feature | Three-step replace wizard (HerettoReplaceModal), Monaco diff viewer (DiffViewer), persistent context bar (HerettoReplaceBar), handleHerettoReplace in useHerettoCms. Full draft-to-publish workflow with post-replace tab state transition. |
| P2-4 | Accessibility fixes on Heretto modals | Fix | htmlFor/id pairing on HerettoStatusModal, aria-live on search progress, aria-labels on toolbar buttons, autoFocus on all modals, aria-labelledby on ImportVerificationModal, aria-labels on HerettoReplaceBar buttons. |
| P2-14 | Refine external load toast copy | Polish | Changed "Loaded {fileName} from external tool" to "Imported {fileName}" in useExternalLoad.ts. |

---

### Shipped in v0.7.0 (2026-03-13)

External content loading API — replaces cli-chrome Monaco injection.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-1 | API endpoint for external content loading | Feature | Vite plugin with `POST /api/load-content` and `GET /api/pending-loads`. New `useExternalLoad` hook polls, validates, beautifies, and creates tabs. `herettoReplaceTarget` field added to Tab type for P2-2. |

---

### Shipped in v0.6.2 (2026-03-13)

Accessibility and empty states batch.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-5 | Empty states for Heretto file browser | Feature | Added "No topics in this folder" message with optional "Create new topic" button. Proper modal sequencing from browser to new topic flow. |
| P2-12 | Add aria-label to Format XML button | Fix | Added `aria-label="Format XML"` to format button in `MonacoDitaEditor.tsx`. |
| P2-13 | Improve Format XML error toast specificity | Polish | Error toast updated to "Failed to format XML: Check for syntax errors". |

---

### Shipped in v0.6.1 (2026-03-13)

Small polish batch: beautify button + UX copy fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-3 | Beautify button | Feature | Added Format XML button (Code2 icon) to Monaco editor toolbar with Shift+Alt+F shortcut. Toast on success/failure. |
| P2-10 | Rename "Post-Requisite" to "Postrequisites" | Fix | Updated `::after` content in `index.css` to match DITA standard terminology. |
| P2-11 | Improve theme descriptions | Polish | Updated `THEME_DESCRIPTIONS` in `Toolbar.tsx` to user-focused copy across all 6 themes. |

---

### Shipped in v0.6.0 (2026-03-13)

Visual polish batch: tooltip fix + body element indicators + light theme warmth.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-8 | Theme dropdown tooltip blocks next option | Bug | Added `placement` prop to `Tooltip.tsx` (`'bottom'` default, `'right'` option). Theme dropdown tooltips use `placement="right"`. |
| P2-7 | Hover element labels in visual editor | Feature | Extended `ShortdescPlugin.tsx` mutation listener with `BODY_TAG_CLASSES` map covering `shortdesc`, `prereq`, `context`, `result`, `postreq`. Hover-triggered `::after` labels on each element. |
| P2-8 | Structural color bars for DITA body elements | Feature | Left-edge `border-left: 3px solid` color bars on prereq/context/result/postreq. Four new CSS variables (`--editor-*-bar`) defined across all 6 themes. |
| P2-9 | Light theme warmth refinement | Feature | Swapped 18 Slate values to Stone in `[data-theme="light"]` block. Increased editor padding `px-8` → `px-12`. |

---

### Shipped in v0.5.1 (2026-03-12)

All P0 and P1 items from the original backlog were resolved in a single session and shipped as v0.5.1.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P0-1 | [H2 invisible on Light theme](../bugreports/BUG-h2-light-theme-invisible.md) | Bug | CSS variables instead of hardcoded colors in `index.css`. |
| P0-2 | [Codeblock renders as label with no content](../bugreports/BUG-codeblock-no-content.md) | Bug | Block-child detection in `parseXmlToLexical.ts`; content split into inline runs and block children. |
| P1-1 | [Nested list in table cell renders as raw text](../bugreports/BUG-nested-list-in-table-cell.md) | Bug | Block-level elements now parsed correctly in table entries. |
| P1-2 | [dateRange sub-parameters not rendered](../bugreports/BUG-nested-list-not-rendered.md) | Bug | Fixed by same root cause fix as P1-1. |
| P1-3 | [conkeyref renders as empty whitespace](../bugreports/BUG-conkeyref-empty-whitespace.md) | Bug | Placeholder chips via `DitaPhRefNode` — renders as e.g. `[conkeyref: glossary/term]`. |
| P1-4 | [Table column auto-sizing truncates words](../bugreports/BUG-table-column-autosizing.md) | Bug | `TableColumnSizer` plugin with proportional widths and 10% minimum. |
| P1-5 | [Empty table rows rendered as blank space](../bugreports/BUG-empty-table-rows.md) | Bug | Rows with no `<entry>` children filtered during parsing. |
| P1-6 | [Theme dropdown hidden behind Heretto context toolbar](../bugreports/BUG-theme-dropdown-z-index.md) | Bug | z-index fix in `Toolbar.tsx`. |
| P1-7 | [Geotab theme lacks visual hierarchy](../bugreports/BUG-geotab-theme-low-contrast.md) | Bug | Three-tier contrast hierarchy in `index.css`. |

---

### Pre-backlog (v0.5.0 and earlier)

Features shipped before the backlog was formalized. Added retroactively for traceability.

| Item | Type | Resolution |
|------|------|------------|
| DITA-aware auto-completion in XML editor | Feature | Context-sensitive element suggestions via `registerCompletionItemProvider` in `MonacoDitaEditor.tsx`. Walks tag stack to determine parent element, suggests only valid DITA children from a full `ditaContentModel`. Triggered on `<` or Ctrl+Space. |
| Auto-close XML tags | Feature | `setupAutoCloseTags` in `MonacoDitaEditor.tsx`. Inserts matching closing tag on `>` keystroke and positions cursor between open/close pair. Skips self-closing tags, closing tags, comments, PIs, and DOCTYPE declarations. |
| Clickable error panel (jump-to-line) | Feature | Code Status Footer in `dita-architect.tsx`. Problems panel shows XML errors as clickable buttons that call `monacoApiRef.current.revealLine()` to jump to the offending line. |
| Import integrity check (double-fetch verification) | Feature | `ImportVerificationModal` + `useHerettoCms`. Topic content is fetched twice from Heretto and compared before opening. Flags unrecognized DITA elements that won't render in the visual editor. |
| Processing instruction round-trip preservation | Feature | Heretto review markers (`<?ezd-review-start?>` / `<?ezd-review-end?>`) are filtered from Lexical rendering but preserved and round-tripped in the XML output. |

---

## How to Use This File

- **Before starting a session:** Read this file. Pick the highest-priority unfinished item.
- **After finishing work:** Update the item's status here. If a fix revealed new issues, add them at the appropriate priority.
- **New items:** Add to the appropriate priority tier with a rationale. Link to a detailed file in `bugreports/` or `future-state/` if the item needs more than a one-liner.
- **Promotions/demotions:** If a P2 becomes urgent, move it up with a note on why. If a P0 turns out to be cosmetic, move it down.
