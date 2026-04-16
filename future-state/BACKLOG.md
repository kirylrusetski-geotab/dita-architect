# DITA Architect Backlog

**Last updated:** 2026-04-16 (P2-24, P3-29, P3-30, P3-31 added; P2-25, P3-32–P3-39 added; P3-31 scoped and broken out; P3-30 superseded)

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

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P1-13 | [xref not serialized when link added in visual editor](../bugreports/BUG-xref-not-serialized-from-visual-editor.md) | Bug | Silent data integrity failure. Adding a link via the toolbar creates a Lexical `LinkNode` that is visible in the visual editor but never written as `<xref>` in the XML — even after Ctrl+Enter sync. `patchInlineNodes` in `serializeLexicalToXml.ts` does not detect the structural change and takes the fast path, preserving the original plain-text DOM. UX finding (Maya Chen): failure is silent — no toast, no mismatch indicator. Authors believe the sync worked. |
| P1-14 | Replace in Heretto: false negative on verification due to Heretto `class` attribute injection | Bug | After a successful PUT, `handleHerettoReplace` fetches the content back and runs `compareXml`. The DOM comparison in `compareXml` (`xml-utils.ts:276`) checks `ea.attributes.length !== eb.attributes.length` — but Heretto injects DITA specialization `class` attributes on every element on ingest (e.g. `class="- topic/topic concept/concept "`), so the attribute counts never match and `compareXml` returns `'different'` even though the upload succeeded. Fix: strip `class` attributes from both sides before DOM comparison, mirroring the P3-27 fix that resolved the same class of false-positive in the poll comparison. UX findings (Maya Chen): (1) `HerettoReplaceModal` shows green checkmarks and `"done"` on both the uploading and verifying rows on failure, because the condition is `replaceStatus.success !== null` rather than `=== true` — a failed verification reads as two green successes followed by a red error, which is contradictory. Fix: show an amber warning icon on the verifying row when the comparison returns `'different'`. (2) The error message `"Verification failed - remote content differs from uploaded content"` doesn't tell the author what actually happened or what to do. Since the upload succeeded, the message should read: `"Upload succeeded, but Heretto reformatted the content. Check the topic in Heretto to confirm your changes are there."` and replace the `Retry` button with `Open in Heretto` or `Done`. |

> P1-8 through P1-12 have all shipped (v0.6.0–v0.8.0). See Completed section for details.

---

### P2 — Next Cycle

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P2-23 | [Render Heretto images in the visual editor](feature-requests.md#fr-030-render-heretto-images-in-the-visual-editor) | Feature | Infrastructure built, two sub-bugs fixed (wrong API endpoint, off-by-one parent folder index), but images still fall back to placeholder chip. Root cause unresolved — see `bugreports/BUG-heretto-image-resolution-fails.md`. |
| P2-24 | [Normalize separators in "Open from Heretto" search](feature-requests.md#fr-033-normalize-separators-in-open-from-heretto-search) | Bug/Polish | Search uses raw `.includes()` — spaces, underscores, and hyphens are treated as distinct characters. Writers searching `traffic analysis` get no results for `setting-up-traffic-analysis.dita`. Fix: normalize both query and file name by collapsing `[\s_-]+` to a single space before comparison. One-line change in `useHerettoCms.ts:250`. High impact on daily file discovery. |
| P2-25 | Troubleshooting topic support | Feature | Full support for DITA troubleshooting topics across three surfaces: (1) **Parser** — `troubleshootingbody` is absent from the body selector in `parseXmlToLexical.ts:537` (`'taskbody, conbody, refbody, body'`), so topics opened from Heretto silently drop all body content; add `troubleshootingbody` and handle `cause`, `remedy`, `condition` as structural body children. (2) **Heretto import** — once parser is fixed, opening troubleshooting topics from Heretto should work correctly. (3) **New Topic modal** — add `Troubleshooting` as a fourth option alongside Task, Concept, Reference, with an appropriate XML template. Design session (2026-04-07): confirmed DA cannot create troubleshooting topics; silent body drop on Heretto open is a bug. Body element indicators (`cause`, `remedy`) to be added as a follow-on once parse support is in place. |

> P2-1 through P2-5, P2-6 through P2-22 have all shipped (v0.6.0–v0.9.0). See Completed section for details.

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
| P3-10 | [Rename `Commit` to `Save to Heretto`](feature-requests.md#fr-015-rename-commit-button-to-save-to-heretto) | Polish | UX review (Maya Chen): `Commit` is Git vocabulary that doesn't match a writer's mental model. Unify with `Save to Heretto` across status bar and Heretto dropdown. |
| P3-11 | [Use writer-friendly vocabulary in status bar](feature-requests.md#fr-016-use-writer-friendly-vocabulary-in-heretto-status-bar) | Polish | UX review (Maya Chen): Status bar terms like `Unsaved changes` + `Commit` and `Conflict` are developer-centric. Rephrase for technical writers. |
| P3-12 | [Page-view layout for the visual editor](feature-requests.md#fr-029-page-view-layout-for-the-visual-editor) | Polish | Content area fills the pane edge-to-edge — no visual boundary between document and chrome. Wrap `ContentEditable` in a page surface with background differentiation and theme-aware elevation (shadow on Light, border on dark). Pure CSS, no behavioral changes. Good candidate to bundle with P3-35 (semantic element border box redesign) since both touch the visual editor container. |
| P3-13 | Table context menu accessibility (ARIA + keyboard navigation) | Accessibility | UX review (Maya Chen, P2-19 pipeline): context menu lacks `role="menu"`/`role="menuitem"`, no keyboard navigation (arrow keys, Enter/Space), no focus management on open, no focus trapping, disabled items need `aria-disabled="true"`. Mouse-only right now — keyboard and screen reader users can't use it. |
| P3-14 | Table context menu copy refinements | Polish | UX review (Maya Chen, P2-19 pipeline): consider "Toggle header row" instead of separate "Convert to header/body row" labels. Simplify merge label from "Merge cells (select multiple cells)" to "Merge cells (requires selection)". |
| P3-15 | Restore colspan/rowspan table tests | Tech debt | Pipeline wrapup (Rafael Santos, P2-19): colspan/rowspan parsing fails in test environment — 3 tests skipped. Restore when test infrastructure supports them. |
| P3-16 | Improve API error messages | Polish | UX review (Maya Chen, P2-20 pipeline): `"Not found"` and `"Tab not found"` are too generic. Change to `"Invalid API endpoint format. Expected: /api/tabs/{id}/content"` and `"Tab with ID \"{tabId}\" not found"`. Add body to 405 responses: `"Method not allowed. This endpoint only supports GET requests"`. |
| P3-17 | Add `success` field to API responses | Polish | Pipeline wrapup (Rafael Santos, P2-20): add `success: boolean` to all API responses for consistency. Makes it easier for Claude Code skills to check response status without inspecting HTTP codes. |
| P3-18 | API authentication for production | Tech debt | Pipeline wrapup (Rafael Santos, P2-20): endpoints expose full XML content with no auth. Fine for localhost dev, but needs an auth gate if the editor is ever exposed beyond the local machine. |
| P3-20 | Insert Table modal help text for size constraints | Polish | UX review (Maya Chen, P2-21 pipeline): no indication of max table size (50 rows × 10 columns). Add help text below inputs. |
| P3-21 | Clarify Insert Table "Include header row" label | Polish | UX review (Maya Chen, P2-21 pipeline): checkbox label is ambiguous. Change to "Include header row (first row as table headers)". |
| P3-22 | Insert Table modal ARIA dialog attributes | Accessibility | UX review (Maya Chen, P2-21 pipeline): modal needs proper ARIA dialog role and label attributes for screen reader support. |
| P3-23 | Insert Table modal verb consistency | Polish | UX review (Maya Chen, P3-19 pipeline): helper text uses "create" but link modal uses "insert". Align to `"Press Enter to insert, Escape to cancel."` for consistency. |
| P3-24 | Insert Table modal aria-labels on number inputs | Accessibility | UX review (Maya Chen, P3-19 pipeline): number inputs need explicit `aria-label="Number of rows"` and `aria-label="Number of columns"` for screen readers. Also add `aria-describedby` linking helper text to inputs. |
| P3-25 | Template placeholder text should look editable | Polish | UX review (Maya Chen, product question): default template text (`Task title`, `Short description of the task.`) looks like real content in both editors. Should use a lighter visual treatment (gray italic) to signal editability. **Bundle with P3-27 and P3-28** — all three touch the same placeholder strings and visual editor behavior. |
| P3-26 | Out-of-sync indicator for visual editor | Feature | UX review (Maya Chen, product question): when the XML editor has been updated but Ctrl+Enter hasn't been pressed, the visual editor shows stale content with no visual indicator. Add a subtle banner or dimmed overlay like `"Visual editor is out of sync — press Ctrl+Enter to refresh"`. |
| P3-27 | ["Loaded from Heretto" status state for freshly opened topics](feature-requests.md#fr-031-loaded-from-heretto-status-state-for-freshly-opened-topics) | Bug/Polish | Opening a topic from Heretto immediately shows 🔴 `Updated in Heretto` due to formatting differences between beautified local XML and raw remote XML. Two fixes: (1) use `compareXml` instead of strict string equality in the poll comparison to eliminate false positives, (2) add a `herettoJustLoaded` state that shows 🟢 `Loaded from Heretto` until the writer edits or saves. |
| P3-28 | [Larger Replace in Heretto preview modal with fluid diff height](feature-requests.md#fr-034-larger-replace-in-heretto-preview-modal-with-fluid-diff-height) | Polish | Modal is `w-[600px]` and DiffViewer is a fixed `height={400}` — too narrow and too short to comfortably review diffs. Change to `w-[900px] max-w-[90vw]` and make DiffViewer `flex-1 min-h-0` so it fills available vertical space within the existing `max-h-[90vh]` modal. UX finding (Maya Chen): the diff is the whole reason the preview step exists; a cramped 400px box inside a tall modal wastes the space and makes the review perfunctory. |
| P3-29 | [User feedback for prevented table operations](feature-requests.md#fr-027-user-feedback-for-prevented-table-operations) | Polish | When deleting the last row or column in a table, the operation silently fails. Add toasts: `"Cannot delete the last row — tables must have at least one row"` / `"Cannot delete the last column — tables must have at least one column"`. Add explanatory hover tooltips to the delete menu items. UX finding (Maya Chen, P2-19 pipeline): silent failure leaves authors wondering if the click registered. |
| P3-30 | ~~Polish body element hover frame interaction~~ | ~~Polish~~ | **Superseded by P3-35.** The hover frame approach is being replaced entirely with an always-visible border box. The three issues this item targeted (layout shift, missing transition, label offset) are resolved as a side effect of the P3-35 redesign. Do not implement separately. |
| P3-31 | [Extend body element indicators to non-task topic types](feature-requests.md#fr-032-extend-body-element-indicators-to-non-task-topic-types) | Feature | **Scoped and broken out — see P3-32 through P3-35.** Design session (2026-04-07) resolved all open design questions and split this into four discrete, tiered items. Original broad item retired for traceability. |
| P3-32 | Shortdesc/body divider line | Polish | A horizontal rule between the shortdesc and the body content, following the acquired product reference reviewed in design session (2026-04-07). Communicates "the header is done; the document has begun." One CSS rule — `border-bottom` on `.dita-editor-shortdesc` or a `::after` pseudo-element. Applies to all topic types. Sonnet-sized. |
| P3-33 | Note type labels and color bars | Feature | Surface the DITA `type` attribute on `<note>` elements in the visual editor. Currently all notes render as identical orange-bordered blockquotes regardless of type. Fix: read `type` attribute during parser traversal, stamp in `originMap`, extend `BODY_TAG_CLASSES` in `ShortdescPlugin.tsx`, add CSS variables per theme. Color palette agreed in design session (2026-04-07): `WARNING` → amber (`--editor-note-warning`), `CAUTION` → amber-orange (`--editor-note-caution`), `TIP` → green (`--editor-note-tip`), `DANGER` → red (`--editor-note-danger`), untyped/`type="note"` → keep existing orange. Hover labels: `WARNING`, `CAUTION`, `TIP`, `DANGER`, `NOTE`. Benefits all topic types since `<note>` appears everywhere. Sonnet-sized. |
| P3-34 | Section left bar on H2 title | Feature | Add a blue left bar to section title H2 nodes, following the acquired product reference reviewed in design session (2026-04-07). Implementation: the parser already distinguishes section titles (`parseXmlToLexical.ts:153` — if parent is `<section>`, render as H2). Stamp `{ tag: 'section-title' }` in `originMap` at that point; `ShortdescPlugin.tsx` applies a CSS class; add `--editor-section-bar` per theme (value: existing `--editor-accent`). No wrapper node required — bar goes on the title, not the section container. This bypasses the architectural flattening problem identified in design session. Sonnet-sized. |
| P3-35 | Always-visible border box with top-left label chip for semantic task elements | Feature | Replace the current hover-reveal treatment for `prereq`, `context`, `result`, `postreq` with an always-visible full border box and a top-left label chip, following the acquired product reference reviewed in design session (2026-04-07). Current approach: left bar (always visible) + right-aligned `::after` label (hover only) + hover frame border (buggy). New approach: all four sides border (always visible, rounded corners), label chip in top-left corner (`CONTEXT`, `PREREQ`, etc. — always visible). Supersedes P3-30 entirely. Design rationale (Maya Chen, 2026-04-07): always-visible labels are more accessible (hover states exclude motor-impaired users), match left-to-right reading patterns (label seen before content), and match the interaction model of the acquired product reference. Requires CSS redesign across all six themes and `ShortdescPlugin.tsx` changes. Opus-sized. Good candidate to bundle with P3-12 (page-view layout) since both touch the visual editor container. |
| P3-36 | DITA 1.3 content model map | Tech debt | Build `parentElement → validChildren[]` lookup table from DITA 1.3 spec. Maps each DITA element to its allowed child elements per content model. Example: `{ "step": ["cmd", "info", "substeps", "choices", "choicetable", "stepxmp", "stepresult", "tasktroubleshooting"], "taskbody": ["prereq", "context", "steps", "steps-unordered", "steps-informal", "result", "tasktroubleshooting", "example", "postreq"] }`. No UI. This becomes the source of truth for both element insertion filtering (P3-38) AND future validation. Can be stored as a JSON constant or derived programmatically. Independent — can be built anytime. Opus-sized (DITA spec is large; all topic types + domain elements). Rafael (2026-04-07): worth building correctly the first time; gets reused for validation, insertion, and potentially autocomplete. |
| P3-37 | `+` button and searchable element menu shell | Feature | Inspired by Heretto CMS reference (2026-04-07): a `+` button appears in the left margin when a writer hovers a block element. Clicking opens a searchable dropdown — writer types a name or label, selects an element, it inserts at that position. Menu design: searchable input at top; element label on left (e.g., `API Name`), DITA tag on right (e.g., `apiname`); keyboard navigable (arrow keys, Enter to select, Escape to close). Initial element list: only currently-supported elements (`<p>`, `<ul>`, `<ol>`, `<note>`, `<codeblock>`, `<table>`, `<image>`, `<xref>`). Implementation: Lexical floating toolbar plugin pattern; hover trigger on block elements; position in left margin outside page boundary. **Prerequisite: P3-12 (page-view layout)** — the `+` button lives in the margin between canvas and page surface; without the page container, there's no natural left-margin space for it. Maya (2026-04-07): the `+` is better than `/` — it's a visual affordance that appears right where writers are looking. Opus-sized. **Note:** Menu populates incrementally as Phase 1A elements ship; each new element (substeps, choices, uicontrol, etc.) gets added to the menu as part of its implementation. |
| P3-38 | Context-aware insertion filtering ("Intelligently" mode) | Feature | Wire the content model map (P3-36) to `originMap` context to filter the `+` menu to only valid children of the current element. Example: cursor inside `<step>` → menu shows `<info>`, `<substeps>`, `<choices>`, `<choicetable>`; cursor inside `<conbody>` → menu shows `<p>`, `<section>`, `<ul>`, `<note>`, not `<substeps>`. "Intelligently" mode is the default; "All elements" mode available as a fallback toggle for power users who know what they're doing. **Depends on P3-36 (content model map) and P3-37 (menu shell).** Maya (2026-04-07): this is not optional — showing writers they can insert `<section>` inside a `<step>` (invalid DITA) would be worse than no menu at all. The intelligence is what makes the feature safe. Opus-sized. |
| P3-39 | Recently used elements section in `+` menu | Polish | Surface last 3-5 inserted elements at the top of the `+` menu, above the full searchable list. Persist in localStorage, scoped per topic type (task writers don't want to see concept-specific elements). Example: a writer authoring API docs inserts `<codeph>`, `<apiname>`, `<uicontrol>` dozens of times per session — surfacing those above the full list eliminates most search friction. **Depends on P3-37 (menu shell).** Maya (2026-04-07): small addition, big daily impact. Sonnet-sized. |

---

## Recommended Execution Order

**Session N (next):** P1-13 (xref not serialized from visual editor). Fix `patchInlineNodes` in `serializeLexicalToXml.ts` to detect `LinkNode` additions as structural changes requiring full re-serialization. Add a round-trip test covering the creation-from-scratch case. Consider adding a post-sync mismatch toast as a safety net.

**Session N+1:** P1-14 (Replace verification false negative). Strip `class` attributes from both sides in `compareXml` before DOM comparison. Fix `HerettoReplaceModal` checkmark logic to use `replaceStatus.success === true` (not `!== null`) so a failed verify doesn't show two green rows. Update the error message to reflect that the upload succeeded and direct the author to verify in Heretto.

**Session N+2:** P2-24 (search separator normalization). One-line fix in `useHerettoCms.ts:250` — high impact on daily file discovery with near-zero risk. Good candidate to batch with P2-23 if the image debugging session is short.

**Session N+3:** P2-23 (Heretto image resolution root cause). Infrastructure is in place — needs runtime debugging to identify why `resolvedUrl` stays empty. See investigation leads in `bugreports/BUG-heretto-image-resolution-fails.md`.

**Session N+4:** P2-25 (Troubleshooting topic support). Three-surface feature: parser body selector fix (`troubleshootingbody`), `cause`/`remedy`/`condition` traversal, and New Topic modal fourth option with XML template. Start with the parser fix first — it unblocks Heretto import immediately.

**Sonnet sweep (any session after P1s clear):** P3-32 (shortdesc divider), P3-33 (note type labels + color bars), P3-34 (section H2 left bar), P2-24 if not yet done, plus the copy/polish batch (P3-10, P3-11, P3-14, P3-16, P3-17, P3-20, P3-21, P3-23, P3-28, P3-29). These are independent and can be stacked in a single session.

**Opus session A:** P3-12 (page-view layout) + P3-35 (always-visible border box treatment). Bundle these — both touch the visual editor container. P3-12 is also the prerequisite for P3-37 (`+` button shell), so shipping it unlocks the insertion menu work.

**Opus session B:** P3-36 (DITA 1.3 content model map). Independent — can be built any time after the P1s clear. No UI, just the data structure. Output used by P3-38.

**Opus session C:** P3-37 (`+` button and menu shell). Depends on P3-12. Start with currently-supported elements only; populates incrementally as Phase 1A elements ship.

**Opus session D:** P3-38 (context-aware filtering). Depends on P3-36 + P3-37. Completes the intelligent insertion feature.

**Sonnet (after P3-37 ships):** P3-39 (recently used elements). Single addition to the existing menu; Sonnet-sized.

**Ongoing:** P3 items are picked up when the relevant feature area is being worked on (e.g., extract DownloadWarningModal when building export, version browser when a third release ships). P3-29 is a good candidate to bundle with any future table context menu work. P3-30 is superseded by P3-35 — do not implement separately. **P3-1 through P3-4 are blocked** on LLM API key access — no timeline; defer to future roadmap unless key becomes available.

---

## Completed

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
