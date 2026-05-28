# DITA Architect — Feature Requests

Feature requests are differentiated from action items and bugs. Items here are considered for future work based on priority and impact.

---

## FR-001: Add "Beautify" button to XML toolbar

**Requested:** 2026-03-10
**Status:** Shipped (v0.6.1, 2026-03-13)
**Priority:** P2-3
**Impact:** Medium

### Description

Add a "Beautify" (format/pretty-print) button to the Monaco XML source editor toolbar. When clicked, it should reformat the raw DITA XML with consistent indentation, line breaks, and attribute alignment without altering the semantic content.

### Value Proposition (Maya Chen, UX Advisor)

Writers working in the XML source pane encounter inconsistently formatted markup constantly — pasted content from Heretto, hand-edited sections, content injected via conkeyrefs or sync operations. The cognitive cost of parsing poorly formatted XML is real: mismatched nesting becomes harder to spot, attribute-heavy elements blur into walls of text, and even experienced DITA authors lose time re-reading structure that clean indentation would make obvious at a glance.

A single-click Beautify action directly addresses this. It removes a repetitive manual task (selecting all, copying to an external formatter, pasting back) and keeps the author inside their editing flow. For a split-pane editor like DITA Architect — where the XML source is always visible alongside the WYSIWYG view — source readability is not a convenience feature; it is a primary interface quality. If the right pane is hard to read, half the editor's value is diminished.

This also has a downstream quality benefit: well-formatted XML surfaces structural errors faster. A misplaced `</entry>` or unclosed `<li>` is far easier to catch in properly indented source than in a compressed block. For a team producing API reference documentation with deeply nested tables (like the Altitude content reviewed today), this is especially relevant.

The interaction should be low-friction: a toolbar icon (consistent with the existing Monaco toolbar style), a keyboard shortcut (e.g., Shift+Alt+F, matching VS Code convention), and no confirmation dialog. The formatter should preserve `<codeblock>` and `<pre>` content verbatim, respect `xml:space="preserve"` attributes, and normalize to 2-space indentation to match the project's existing XML style.

---

## FR-002: Release notes version browser in What's New modal

**Requested:** 2026-03-12
**Status:** Proposed
**Priority:** Low
**Impact:** Low–Medium

### Description

The What's New modal currently displays only the latest release notes entry (`RELEASE_NOTES[0]`). As more versions ship, users lose access to past entries unless they read the source code. Add a version selector or scrollable list so users can browse release notes from any version.

### Suggested Approach

- Add a version list or dropdown to the left side of the modal, populated from the `RELEASE_NOTES` array in `constants/version.ts`.
- Default selection remains the latest version.
- Selecting a past version renders that entry's sections in the existing right-side layout.
- No backend changes needed — the `RELEASE_NOTES` array already contains all entries.

### Value Proposition (Maya Chen, UX Advisor)

Right now with two versions this isn't urgent, but every release adds another entry that becomes invisible. A version browser turns the modal from a one-time notification into a lightweight changelog — useful for users returning after multiple updates, onboarding new team members, or simply answering "when did we add conkeyref chips?" without leaving the app.

---

## FR-003: Empty states for Heretto file browser

**Requested:** 2026-03-12
**Status:** Shipped (v0.6.2, 2026-03-13)
**Priority:** P2-5
**Impact:** Medium

### Description

When a Heretto CMS folder contains no topics, the file browser shows nothing — no message, no affordance, just blank space. Add an empty state with a message like `No topics in this folder` and a `Create new topic` action button.

### Value Proposition (Maya Chen, UX Advisor)

An empty folder with no feedback is a dead end. The author doesn't know if the folder is genuinely empty, still loading, or broken. A clear empty state with a `No topics in this folder` message answers the question instantly, and a `Create new topic` call-to-action turns a dead end into a starting point. This is low-effort, high-trust UX — it tells the user "we anticipated this state and we've got you covered."

---

## FR-004: Inline validation hints in the visual editor

**Requested:** 2026-03-12
**Status:** Shipped (v0.9.0, 2026-03-27)
**Priority:** Medium
**Impact:** High

### Description

Add inline visual indicators in the Lexical WYSIWYG editor for content issues that are currently invisible until publish time. Examples include red underlines for broken `xref` targets, yellow highlights for unresolved keyrefs/conkeyrefs, and subtle markers for missing required elements.

### Value Proposition (Maya Chen, UX Advisor)

Right now, an author can write an entire topic with broken cross-references and not know until the output is built. That's a long feedback loop. Inline hints — a red underline on a dead `xref`, a yellow squiggle on an unresolved keyref — bring validation into the authoring moment. Authors catch problems while they still remember the context, not three steps later in a build log. This borrows a pattern every developer already knows from their code editor, applied to the content side of the split pane.

---

## FR-005: Keyboard shortcut cheat sheet

**Requested:** 2026-03-12
**Status:** Proposed
**Priority:** Low
**Impact:** Medium

### Description

Add a discoverable keyboard shortcut overlay that displays all available shortcuts. Trigger via `?` or `Cmd+/` (when not focused in an editor). Show grouped shortcuts for formatting, navigation, file operations, and edit mode actions.

### Value Proposition (Maya Chen, UX Advisor)

We've built good keyboard shortcuts — bold, italic, save, edit mode toggle — but there's no way to discover them without reading source code. A shortcut overlay (like GitHub's `?` or Figma's `Ctrl+Shift+?`) gives power users a reference and new users a learning path. Discoverability is the difference between "this app has shortcuts" and "this app taught me its shortcuts." It's a small surface that signals the app respects keyboard-driven workflows.

---

## FR-006: Hover element labels in visual editor

**Requested:** 2026-03-13
**Status:** Shipped (v0.6.0, 2026-03-13)
**Priority:** P2-7
**Impact:** High

### Description

Add hover-triggered structural labels to DITA body elements in the Lexical visual editor. When an author hovers over a block element — `context`, `result`, `prereq`, `postreq`, `steps`, `section` — a small uppercase label appears indicating the element's DITA role (e.g., `CONTEXT`, `RESULT`, `PREREQUISITE`). Labels should be hover-only to avoid visual clutter during active writing.

### Suggested Approach

The pattern already exists in the codebase. The `SHORT DESCRIPTION` label on shortdesc elements (`index.css:440-451`) uses a `::after` pseudo-element with `position: absolute`, `text-transform: uppercase`, and `opacity: 0.5`. This same CSS pattern can be extended to other DITA body elements:

- In `parseXmlToLexical.ts`, the elements `context`, `result`, `prereq`, `postreq` already map to `$createParagraphNode()` (lines ~130-170). Apply distinguishing CSS classes — `dita-editor-context`, `dita-editor-result`, etc. — to these paragraph nodes via the Lexical theme or inline class assignment.
- Add corresponding `::after` rules in `index.css` for each class, using the same positioning as `.dita-editor-shortdesc::after` but triggered on `:hover` instead of always-visible.
- No new Lexical node types required. No React components. CSS classes on existing paragraph nodes and a few lines in the parser.

Labels should use **semantic DITA names** — `CONTEXT`, `RESULT`, `PREREQUISITE`, `POST-REQUISITE` — not generic labels like `PARAGRAPH`. The value is in surfacing structural meaning, not node type.

Move/reorder arrows (as seen in DITA Doer) are explicitly out of scope. In a split-pane editor where the XML source is visible, structural reorganization belongs in the source pane.

### Value Proposition (Maya Chen, UX Advisor)

Right now, the only element in the Lexical pane that identifies itself structurally is the shortdesc — that small `SHORT DESCRIPTION` watermark. Every other DITA body element renders as an identical paragraph. An author editing a task topic can't tell where `context` ends and `result` begins without switching to the XML source pane.

This matters because DITA structure isn't decoration — `context` and `result` have semantic meaning in task topics that affects how content is rendered in output. When an author accidentally types result content inside the `context` element, they won't know until the output is built. A hover label makes the structure legible at the moment of editing, without making the default view noisy.

This also pairs well with FR-004 (inline validation hints). Once authors can see which element they're in, showing validation state on that element becomes natural — a broken `xref` inside a `CONTEXT` block is more actionable when you can see both the element label and the validation indicator.

### Prior Art

- **DITA Doer 3.0:** Shows element labels with move arrows on hover (screenshot reviewed 2026-03-13). Labels use generic names like `PARAGRAPH`.
- **Heretto CMS:** Shows always-visible element tags as inline chips (e.g., `context`, `result`, `step`, `cmd`). Comprehensive but visually dense.
- **DITA Architect (current):** Only `.dita-editor-shortdesc::after` provides a structural label. All other body elements are visually undifferentiated.

---

## FR-007: Structural color bars for DITA body elements

**Requested:** 2026-03-13
**Status:** Shipped (v0.6.0, 2026-03-13)
**Priority:** P2-8
**Impact:** Medium

### Description

Add subtle left-edge color bars to DITA body element blocks (`context`, `result`, `prereq`, `postreq`) in the Lexical visual editor. Each element type gets a distinct color — a 3px vertical stripe on the left margin — so authors can see where one structural section ends and another begins without reading labels or switching to the XML source.

### Suggested Approach

- Use `border-left` on the same CSS classes introduced for FR-006 (`dita-editor-context`, `dita-editor-result`, etc.).
- Define theme-aware CSS variables for each element type's bar color (e.g., `--editor-context-bar`, `--editor-result-bar`), following the existing pattern for `--editor-quote-border`.
- Add corresponding values in each theme block in `index.css` (dark, light, claude, nord, solarized, geotab).
- The color bars are always visible (unlike the hover labels from FR-006), providing a persistent but low-weight structural signal.

This is a lighter alternative to the full bordered section boxes seen in Heretto CMS. Full dashed-border boxes with headers work well in Heretto's single-pane, full-width editor, but would feel cramped in our split-pane layout where the Lexical pane shares horizontal space with Monaco. A left-edge bar provides the structural distinction with less visual weight — the hover labels (FR-006) tell you *what* the element is, the color bars tell you *where one ends and another begins*.

### Value Proposition (Maya Chen, UX Advisor)

The existing visual editor already uses a left-edge color pattern for one element: `<note>` elements render with `border-left: 4px solid var(--editor-quote-border)` and a tinted background. Authors have learned to recognize that visual pattern as "this is a note." Extending the same idea — left-edge color, no background tint — to `context`, `result`, `prereq`, and `postreq` builds on a visual language the editor already speaks.

Have you considered how this helps with longer task topics? In a topic with 8 steps, a context block, prerequisite, and result, the content can run to several screens of scrolling. Without structural markers, the only way to orient yourself is to scroll up to the heading or check the XML. A colored left bar gives you a peripheral signal — "I'm in the result section" — without interrupting your reading flow. It's the same principle as syntax highlighting in code editors, applied to content structure.

### Prior Art

- **Heretto CMS:** Full dashed-border section boxes with element headers. Effective in a full-width single-pane editor but visually heavy.
- **DITA Architect (current):** `<note>` elements already use `border-left: 4px solid` with a tinted background (`index.css:405-412`). This FR extends that pattern without the background tint.

---

## FR-008: Light theme warmth refinement

**Requested:** 2026-03-13
**Status:** Shipped (v0.6.0, 2026-03-13)
**Priority:** P2-9
**Impact:** Medium

### Description

Adjust the Light theme's color palette from its current cool blue-gray (Slate) family to warmer neutral tones, and increase content area breathing room. The goal is to shift the editor feel from "application" to "page" — closer to the warmth and spaciousness seen in DITA Doer's light theme.

### Suggested Changes

Current values and proposed replacements (all in `index.css`, `[data-theme="light"]` block, lines 75-124):

| Variable | Current (Slate) | Proposed (Stone/Warm) | Rationale |
|---|---|---|---|
| `--app-bg` | `#f1f5f9` (slate-100) | `#f5f5f4` (stone-100) | Shift chrome from blue-gray to warm neutral |
| `--app-surface-raised` | `#f1f5f9` | `#f5f5f4` | Match chrome warmth |
| `--app-border` | `#e2e8f0` (slate-200) | `#e7e5e4` (stone-200) | Soften border tone |
| `--app-border-subtle` | `#cbd5e1` (slate-300) | `#d6d3d1` (stone-300) | Consistent warm shift |
| `--app-hover` | `#e2e8f0` | `#e7e5e4` | Consistent warm shift |
| `--app-btn-bg` | `#f1f5f9` | `#f5f5f4` | Consistent warm shift |
| `--app-btn-hover` | `#e2e8f0` | `#e7e5e4` | Consistent warm shift |
| `--app-btn-border` | `#cbd5e1` | `#d6d3d1` | Consistent warm shift |
| `--editor-toolbar-bg` | `#f8fafc` (slate-50) | `#fafaf9` (stone-50) | Bring toolbar closer to content white |
| `--editor-toolbar-border` | `#e2e8f0` | `#e7e5e4` | Soften toolbar divider |
| `--editor-code-bg` | `#f1f5f9` | `#f5f5f4` | Consistent warm shift |

Additionally, consider increasing the `ContentEditable` horizontal padding from `px-8` (2rem) to `px-12` (3rem) on wider viewports to enhance the "page" feel (in `dita-architect.tsx`, line ~758).

No structural changes. Same CSS variable tuning pattern used for the Geotab theme (P1-7, shipped v0.5.1).

### Value Proposition (Maya Chen, UX Advisor)

Compare the screenshots side by side. DITA Doer's light theme feels like paper — warm whites, generous margins, the toolbar barely distinguished from content. Our light theme feels like an application — the three-tier separation (chrome at `#f1f5f9`, toolbar at `#f8fafc`, content at `#ffffff`) is organized but clinical. The blue-gray undertone in every surface reinforces "software" rather than "document."

The proposed shift is subtle — same luminance values, just moving from the Tailwind Slate scale to Stone. The editor still has clear visual hierarchy, but the warmth makes long editing sessions more comfortable and the overall feel more inviting. This is the kind of refinement that authors notice as "it just feels nicer" without being able to articulate exactly why.

---

## FR-009: Add aria-label to Format XML button

**Requested:** 2026-03-13
**Status:** Shipped (v0.6.2, 2026-03-13)
**Priority:** P2-12
**Impact:** Low

### Description

The Format XML button added in v0.6.1 is missing an `aria-label="Format XML"` attribute. All other toolbar buttons have appropriate aria-labels for screen reader consistency. One-line fix in `MonacoDitaEditor.tsx`.

### Value Proposition (Maya Chen, UX Advisor)

Every other button in both toolbars has a matching aria-label. The format button works correctly but is invisible to screen readers. Adding the attribute maintains the accessibility standard established across the rest of the toolbar surface.

---

## FR-010: Improve Format XML error toast specificity

**Requested:** 2026-03-13
**Status:** Shipped (v0.6.2, 2026-03-13)
**Priority:** P2-13
**Impact:** Low

### Description

When the Format XML button encounters malformed XML, the error toast shows a generic failure message. Update it to say "Failed to format XML: Check for syntax errors" to give authors actionable guidance.

### Value Proposition (Maya Chen, UX Advisor)

A generic "format failed" message leaves the author guessing. Adding "Check for syntax errors" points them toward the XML source pane where Monaco's built-in validation will highlight the problem. It closes the feedback loop — the toast tells them *what* went wrong, and the source pane shows them *where*.

---

## FR-011: Refine external load toast copy

**Requested:** 2026-03-13
**Status:** Shipped (v0.7.1, 2026-03-13)
**Priority:** P2-14
**Impact:** Low

### Description

The success toast when content is loaded via the external API (`POST /api/load-content`) currently reads `"Loaded {fileName} from external tool"`. The phrase "external tool" is developer-centric jargon that may not resonate with technical writers. Change to `"Imported {fileName}"` or `"Opened {fileName}"`.

One-line change in `hooks/useExternalLoad.ts`.

### Value Proposition (Maya Chen, UX Advisor)

"From external tool" describes the mechanism, not the outcome. Writers don't think in terms of "external tools" — they think "I asked the system to load my draft and it did." A simpler `"Imported {fileName}"` communicates the result without exposing the plumbing. Error messages should be specific (and they are); success messages should be brief.

---

## FR-012: Improve HerettoReplaceModal recovery text

**Requested:** 2026-03-13
**Status:** Shipped (v0.7.2, 2026-03-16)
**Priority:** P2-15
**Impact:** Low

### Description

The HerettoReplaceModal confirmation step mentions that the action "cannot be undone from DITA Architect" and references Heretto's version history, but the recovery path could be more specific and actionable.

- **Current:** `You can restore previous versions from Heretto's version history if needed.`
- **Suggested:** `To recover, use Heretto's version history (topic → History tab).`

One-line change in `components/HerettoReplaceModal.tsx`.

### Value Proposition (Maya Chen, UX Advisor)

The current copy tells authors recovery is possible but not how. Adding the specific navigation path ("topic → History tab") reduces anxiety and eliminates the need to search Heretto's docs. When warning about a destructive action, the recovery path should be as concrete as the warning itself.

---

## FR-013: Improve DiffViewer empty state copy

**Requested:** 2026-03-13
**Status:** Shipped (v0.7.2, 2026-03-16)
**Priority:** P2-16
**Impact:** Low

### Description

When the DiffViewer detects no changes between the editor content and Heretto content, it currently shows `No changes detected`. This is accurate but not informative.

- **Current:** `No changes detected`
- **Suggested:** `No changes detected — your content matches the version in Heretto`

One-line change in `components/DiffViewer.tsx`.

### Value Proposition (Maya Chen, UX Advisor)

"No changes detected" answers "what happened?" but not "what does this mean?" Adding "your content matches the version in Heretto" confirms the comparison was successful and the content is identical. It reassures the author that the diff worked correctly rather than leaving ambiguity about whether something went wrong.

---

## FR-014: Use contextual placeholder in HerettoStatusModal

**Requested:** 2026-03-13
**Status:** Shipped (v0.7.2, 2026-03-16)
**Priority:** P2-17
**Impact:** Low

### Description

The email input field in HerettoStatusModal uses the generic placeholder `user@example.com`. A more contextual placeholder would better communicate that this is a work email for Heretto CMS authentication.

- **Current:** `user@example.com`
- **Suggested:** `your.name@company.com`

One-line change in `components/HerettoStatusModal.tsx`.

### Value Proposition (Maya Chen, UX Advisor)

Placeholder text is a micro-affordance — it answers "what goes here?" at a glance. `user@example.com` is a developer convention that signals nothing about the context. `your.name@company.com` subtly communicates "use your work email" without needing a label change. Small touch, professional signal.

---

## FR-015: Rename `Commit` button to `Save to Heretto`

**Requested:** 2026-03-13
**Status:** Shipped (v0.9.1.1, 2026-04-07)
**Priority:** Low
**Impact:** Medium

### Description

The Heretto-connected status bar shows a `Commit` button alongside status text like `Unsaved changes` or `Conflict — updated in Heretto`. The `Commit` label is developer/Git vocabulary that doesn't match a technical writer's mental model. Additionally, there is both a `Commit` button in the status bar and a `Save` option in the Heretto dropdown menu, creating ambiguity about which action actually saves to Heretto.

- **Current:** `Commit` button in status bar + `Save` in Heretto dropdown
- **Suggested:** Single `Save to Heretto` label for the primary save action, consistent across both locations

### Value Proposition (Maya Chen, UX Advisor)

During my authoring session, I clicked `Commit` expecting it to save my changes to Heretto. It resolved the conflict state but didn't save. Then I tried `Heretto > Save` and couldn't tell if it worked either. Two buttons that sound like they do similar things but behave differently is a recipe for confusion.

Authors think in terms of "save my work." They don't think in terms of "commit." The label should match the action and the audience. `Save to Heretto` is unambiguous — it tells you *what* will happen and *where*. If `Commit` is doing something different from `Save` (like resolving a conflict vs. pushing content), those should be visually and verbally distinct — not two buttons that look interchangeable but aren't.

---

## FR-016: Use writer-friendly vocabulary in Heretto status bar

**Requested:** 2026-03-13
**Status:** Shipped (v0.9.1.1, 2026-04-07)
**Priority:** Low
**Impact:** Medium

### Description

The Heretto status bar uses developer-centric terms that don't align with a technical writer's workflow vocabulary. The combination of `Unsaved changes` + `Commit` reads like a Git staging area, not a document editor.

- **Current status states:** `Unsaved changes`, `Conflict — updated in Heretto`, `Saved just now`
- **Current action:** `Commit`
- **Suggested states:** `Edited — not saved`, `Someone else edited this in Heretto`, `Saved to Heretto`
- **Suggested action:** `Save to Heretto` (see FR-015)

### Value Proposition (Maya Chen, UX Advisor)

The status bar is the author's primary feedback channel for document state. Every word in it should be immediately parseable by someone who has never used Git. `Unsaved changes` is borderline fine, but paired with `Commit` it creates a Git mental model that doesn't serve the audience. `Conflict` is technical jargon — "Someone else edited this in Heretto" tells the author exactly what happened in language they understand.

This isn't about dumbing things down — it's about matching the language to the user. The same author who would be confused by `Commit` would instantly understand `Save to Heretto`. The status bar should speak the author's language, not the developer's.

---

## FR-017: Editor status API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.7.3, 2026-03-16)
**Priority:** Medium
**Impact:** High

### Description

Add a `GET /api/status` endpoint that returns the editor's current state: version, Heretto connection status, number of open tabs, active theme. This is the handshake endpoint — any Claude Code skill that integrates with DITA Architect should start here to confirm the editor is running and ready.

### Suggested Response

```json
{
  "version": "0.7.2",
  "herettoConnected": true,
  "tabCount": 3,
  "activeTabId": "tab-2",
  "theme": "dark"
}
```

### Value Proposition (Maya Chen, UX Advisor)

Every Claude Code skill that talks to DITA Architect needs a way to answer one question first: "is the editor running?" Without this, skills fail silently or throw opaque network errors. A status endpoint lets a skill say `"DITA Architect is not running on localhost:3000 — start it with npm run dev"` instead of leaving the user to debug a connection refused error. It's the difference between a tool that assumes everything is fine and one that checks before acting.

---

## FR-018: List open tabs API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.7.3, 2026-03-16)
**Priority:** Medium
**Impact:** High

### Description

Add a `GET /api/tabs` endpoint that returns all open tabs with their metadata: id, file name, Heretto file info, dirty state, and XML error count. Include the `activeTabId` at the top level so callers know which tab the author is currently working in.

### Suggested Response

```json
{
  "activeTabId": "tab-2",
  "tabs": [
    {
      "id": "tab-2",
      "fileName": "setting-up-traffic-analysis.dita",
      "herettoFile": { "uuid": "abc-123", "name": "Setting up a Traffic Analysis" },
      "dirty": true,
      "xmlErrorCount": 0
    },
    {
      "id": "tab-3",
      "fileName": "new-topic.dita",
      "herettoFile": null,
      "dirty": false,
      "xmlErrorCount": 1
    }
  ]
}
```

### Value Proposition (Maya Chen, UX Advisor)

This is the foundation for any Claude Code skill that wants to work *with* the editor rather than just pushing content *at* it. A skill that says "review the current topic for DITA best practices" needs to know which topic is active. A skill that says "check all open tabs for broken cross-references" needs the full list. Without this endpoint, every skill has to guess — and guessing means either asking the user to specify (friction) or assuming there's only one tab (wrong). The `activeTabId` field is the key detail: it answers "what is the author looking at right now?" without requiring them to say so.

---

## FR-019: Read tab content API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.7.3, 2026-03-16)
**Priority:** Medium
**Impact:** High

### Description

Add a `GET /api/tabs/:id/content` endpoint that returns the full XML content of a specific tab along with relevant metadata. This enables the "copilot" pattern — Claude Code reads the author's current work, analyzes it, and provides suggestions.

### Suggested Response

```json
{
  "id": "tab-2",
  "fileName": "setting-up-traffic-analysis.dita",
  "herettoFile": { "uuid": "abc-123", "name": "Setting up a Traffic Analysis" },
  "dirty": true,
  "xmlErrors": [],
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE task ...>..."
}
```

### Value Proposition (Maya Chen, UX Advisor)

This is the endpoint that makes DITA Architect a *collaborative* tool rather than a closed editor. Right now, the only way to get content out of the editor is to copy-paste from the XML pane or save to Heretto and fetch via API. Neither of those works for a Claude Code skill that wants to read, analyze, and respond in real time.

Have you considered the workflows this unlocks? A skill reads the XML, checks that every `<step>` has a `<cmd>`, flags any `<xref>` without an `href`, counts words per section, or suggests where to split a 3,000-word topic. All from the terminal, while the author keeps writing. The response includes `xmlErrors` and `dirty` state so the skill has full context — it knows whether the content has unsaved changes and whether there are validation issues before it starts its analysis.

---

## FR-020: Update tab content API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.8.0, 2026-03-17)
**Priority:** Medium
**Impact:** High

### Description

Add a `PUT /api/tabs/:id/content` endpoint that updates the XML content of an existing tab. This completes the read-write loop — Claude Code can read content via FR-019, transform it, and push the result back into the same tab.

### Suggested Request Body

```json
{
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE task ...>..."
}
```

### Suggested Response

```json
{
  "id": "tab-2",
  "status": "updated"
}
```

### Value Proposition (Maya Chen, UX Advisor)

This is where the integration goes from "read-only" to "useful." A skill that can read content and write it back can do real work: reformat XML, add missing `<shortdesc>` elements, normalize `<uicontrol>` usage, or apply terminology corrections across a topic. The key UX consideration is feedback — when content changes in the editor because a skill updated it, the author should see a toast like `"Content updated from terminal"` so the change isn't invisible. Without feedback, the XML pane silently changes and the author might not notice, especially if they're focused on the visual pane.

The `PUT` should also trigger a sync to the visual editor so the author sees the updated content in both panes immediately, matching the behavior of typing directly in the XML editor.

---

## FR-021: Save tab to Heretto API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.8.0, 2026-03-17)
**Priority:** Medium
**Impact:** High

### Description

Add a `POST /api/tabs/:id/save` endpoint that triggers a save to Heretto for a specific tab. This completes the full lifecycle: a Claude Code skill can read a topic, edit it, and save it back to Heretto without the author touching the browser.

### Suggested Response

```json
{
  "id": "tab-2",
  "status": "saved",
  "herettoFile": { "uuid": "abc-123", "name": "Setting up a Traffic Analysis" }
}
```

### Value Proposition (Maya Chen, UX Advisor)

This is the endpoint that closes the loop. Without it, a Claude Code skill can push edited content into the editor but the author still has to manually click `Save to Heretto` in the browser. That breaks the terminal workflow — the whole point of CLI integration is that the author can stay in their terminal.

The save should follow the same verification pattern we already use (`PUT` → fetch-back → compare) and return the result. If the save fails (not connected to Heretto, tab not linked to a Heretto file, conflict state), the response should include a clear error: `"Tab is not connected to Heretto"` or `"Conflict — resolve in the editor first"`. Those error messages can flow directly into the Claude Code skill's output to the user.

---

## FR-022: Format tab XML API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.8.0, 2026-03-17)
**Priority:** Low
**Impact:** Medium

### Description

Add a `POST /api/tabs/:id/format` endpoint that triggers XML formatting (pretty-print) on a specific tab. Useful for Claude Code skills that generate or transform XML and want to ensure the result is cleanly formatted before the author sees it.

### Suggested Response

```json
{
  "id": "tab-2",
  "status": "formatted"
}
```

### Value Proposition (Maya Chen, UX Advisor)

Skills that generate XML — whether from scratch or by transforming existing content — don't always produce cleanly indented output. Rather than requiring every skill to implement its own XML formatter, this endpoint lets them push content via FR-020 and then call format to clean it up. It's the API equivalent of the author clicking the Format button in the toolbar. One less thing for skill authors to worry about, and consistent formatting regardless of where the XML came from.

---

## FR-023: Tab content statistics API endpoint

**Requested:** 2026-03-16
**Status:** Shipped (v0.8.0, 2026-03-17)
**Priority:** Low
**Impact:** Medium

### Description

Add a `GET /api/tabs/:id/stats` endpoint that returns the word count, character count, readability score, and grade level for a specific tab. These statistics are already computed by `analyzeText()` in `textAnalysis.ts` and displayed in the `BottomToolbar` — this endpoint exposes them to external tools.

### Suggested Response

```json
{
  "id": "tab-2",
  "wordCount": 487,
  "characterCount": 2841,
  "readabilityScore": 42.3,
  "gradeLevel": "12th",
  "readingLevel": "College",
  "sentenceCount": 31
}
```

### Value Proposition (Maya Chen, UX Advisor)

Imagine a Claude Code skill that says: "This topic is 2,400 words at a 12th-grade reading level — have you considered splitting the procedure section into two topics?" That's the kind of feedback that helps writers produce better content without leaving their terminal. We already compute all of this data in `BottomToolbar` via `analyzeText()`. Exposing it via API means skills can use readability as a decision input — flag topics that exceed a word count threshold, track reading level trends across a documentation set, or suggest simplification when the Flesch-Kincaid score drops too low. The data is already there; this endpoint just makes it accessible.

---

## FR-024: Table context menu (insert/delete rows and columns)

**Requested:** 2026-03-16
**Status:** Shipped (v0.7.2, 2026-03-16)
**Priority:** Medium
**Impact:** High

### Description

Add a right-click context menu on table cells in the Lexical visual editor. Currently, authors can edit content *within* existing table cells, but cannot add or remove rows, columns, or tables from the visual pane — they must switch to the XML editor and manually write DITA markup.

The Lexical playground ships a [`TableActionMenuPlugin`](https://github.com/facebook/lexical/tree/main/packages/lexical-playground/src/plugins/TableActionMenuPlugin) that provides 16 table operations. Port the relevant subset to DITA Architect.

### Operations to Include

| Operation | Menu Label | Notes |
|---|---|---|
| Insert row above | `Insert row above` | Explicit direction eliminates ambiguity |
| Insert row below | `Insert row below` | |
| Insert column left | `Insert column left` | |
| Insert column right | `Insert column right` | |
| Delete row | `Delete row` | |
| Delete column | `Delete column` | |
| Delete table | `Delete table` | Confirmation dialog before destructive action |
| Toggle header row | `Toggle header row` | Maps to DITA `<thead>` vs `<tbody>` |
| Merge cells | `Merge cells` | Only show when multiple cells selected |
| Unmerge cells | `Unmerge cells` | Only show on merged cells |

### Operations to Defer

Background color, vertical alignment, row striping, and column/row freeze are presentation-layer features that don't map to DITA semantics. Defer until there's demand.

### Suggested Approach

- Port `TableActionMenuPlugin` from the [Lexical playground source](https://github.com/facebook/lexical/tree/main/packages/lexical-playground/src/plugins/TableActionMenuPlugin). The underlying commands (`INSERT_TABLE_ROW_COMMAND`, `INSERT_TABLE_COLUMN_COMMAND`, etc.) already exist in `@lexical/table`, which is already in our dependency tree.
- Style the context menu to match the existing dropdown pattern: `bg-[var(--app-surface-raised)]`, `border-[var(--app-border-subtle)]`, `text-xs` sizing — consistent with the syntax theme dropdown.
- Ensure Tab/Shift+Tab navigation between cells works (Tab in the last cell should create a new row).
- Serializer impact: `createTableFromLexical` in `serializeLexicalToXml.ts` already handles CALS table output. New rows/columns created via the context menu will serialize correctly without changes.

### Value Proposition (Maya Chen, UX Advisor)

If I'm editing the Parameters table in a concept topic and I need to add a new `format` parameter, my only option today is to switch to the XML pane, find the right `<tbody>`, write `<row><entry>format</entry><entry>...</entry><entry>STRING</entry><entry>-</entry><entry>N</entry></row>`, and sync back. That's five nested elements for what should be a right-click and `"Insert row below"`.

This is the single most common structural editing operation in DITA API documentation. Every concept topic with a parameters table, every reference topic with a properties table, every task topic with a troubleshooting table — they all need row insertion during the writing process. The gap between "I can edit cell text visually" and "I can't add a row visually" is the gap between a viewer and an editor.

The good news is that Lexical has already solved this problem. The `@lexical/table` package provides the commands, and the playground provides a reference implementation of the context menu UI. We're porting proven code, not inventing new interactions.

---

## FR-025: Insert Table toolbar action

**Requested:** 2026-03-16
**Status:** Shipped (v0.8.0, 2026-03-17)
**Priority:** Medium
**Impact:** Medium

### Description

Add an "Insert Table" action to the WYSIWYG toolbar that opens a small dialog for specifying table dimensions (rows × columns), then inserts a new DITA table at the cursor position. This complements FR-024 (context menu for existing tables) by enabling table *creation* from the visual pane.

### Suggested Interaction

1. Author clicks the table icon in the toolbar (or selects `Insert > Table` from a dropdown).
2. A small popover appears with two number inputs: `Rows` (default: 3) and `Columns` (default: 3), plus a `"Include header row"` checkbox (checked by default).
3. Author adjusts values and clicks `Insert`.
4. A new table appears at the cursor position with the specified dimensions. The first row is marked as a header row if the checkbox was checked.

### Suggested Implementation

- Use `INSERT_TABLE_COMMAND` from `@lexical/table`, which is already in our dependency tree.
- The serializer should output CALS `<table>` format (with `<tgroup>`, `<colspec>`, `<thead>`, `<tbody>`) as the default for new tables. CALS supports column spans, row spans, and column width specifications — it's the standard format Heretto uses and what our parser/serializer already handles.
- Toolbar button: use the Lucide `Table` icon, with `<Tooltip content="Insert table">` and `aria-label="Insert a new table"`.
- The popover should match the existing toolbar dropdown styling.

### Value Proposition (Maya Chen, UX Advisor)

Right now, the only way to create a table in DITA Architect is to type the XML manually in the source pane — `<table>`, `<tgroup cols="3">`, `<colspec>` for each column, `<thead>`, `<row>`, `<entry>` for each header cell, `<tbody>`, more `<row>` and `<entry>` elements. That's a lot of markup for "I want a 3×3 table." A toolbar button with a rows-and-columns dialog reduces that to two clicks and two numbers.

Have you considered defaulting to `"Include header row"` checked? In my experience reviewing DITA content, virtually every table has a header row. Starting with one saves authors from remembering to add it, and producing tables without `<thead>` is a common DITA quality issue that reviewers flag. A sensible default prevents a common mistake.

For the toolbar placement, I'd suggest grouping it with the list buttons (ordered list, unordered list) since tables are structural elements in the same category. The tooltip `"Insert table"` is concise and matches the pattern of our other toolbar tooltips.

---

## FR-026: Table context menu accessibility (ARIA roles and keyboard navigation)

**Requested:** 2026-03-16
**Source:** Maya Chen UX review of FR-024 implementation
**Status:** Proposed
**Priority:** Medium
**Impact:** Medium

### Description

The table context menu shipped in FR-024 lacks proper accessibility attributes and keyboard navigation. Add ARIA roles, focus management, and keyboard interaction to bring the context menu up to accessibility standards.

### Required Changes

1. Add `role="menu"` to the context menu container and `role="menuitem"` to each menu item.
2. Add `aria-label="Table actions"` to the menu container.
3. Implement arrow key navigation (Up/Down) between menu items.
4. Move focus to the first menu item when the menu opens.
5. Add screen reader announcements when table operations complete (e.g., "Row inserted below").

### Value Proposition (Maya Chen, UX Advisor)

The context menu works correctly for mouse users but is invisible to screen readers and inaccessible via keyboard beyond ESC to dismiss. Adding `role="menu"` and `role="menuitem"` makes the menu discoverable by assistive technology. Arrow key navigation is the expected interaction pattern for menus — without it, keyboard users can see the menu but can't operate it. Focus management on open ensures the menu is immediately actionable without requiring a Tab keypress to reach it. Screen reader announcements confirm that the action completed, which is especially important since table structure changes may not be visually obvious to users relying on assistive technology.

---

## FR-027: User feedback for prevented table operations

**Requested:** 2026-03-16
**Source:** Maya Chen UX review of FR-024 implementation
**Status:** Shipped (v0.9.1.1, 2026-04-07)
**Priority:** Medium
**Impact:** Medium

### Description

When a user attempts to delete the last remaining row or column in a table, the operation silently fails. Add toast notifications explaining why the action was prevented, and add explanatory tooltips to the delete menu items.

### Required Changes

1. When last-row deletion is prevented, show a toast: `"Cannot delete the last row — tables must have at least one row"`
2. When last-column deletion is prevented, show a toast: `"Cannot delete the last column — tables must have at least one column"`
3. Add tooltips on hover for delete menu items:
   - Delete row: `"Remove this row (at least one row must remain)"`
   - Delete column: `"Remove this column (at least one column must remain)"`

### Value Proposition (Maya Chen, UX Advisor)

Silent failure when trying to delete the last row or column violates the principle of reducing cognitive load — users shouldn't have to guess why an action didn't work. The author clicks "Delete row," nothing happens, and they're left wondering if the click didn't register, if there's a bug, or if they're doing something wrong. A toast notification immediately closes the feedback loop: the action was received, understood, and intentionally prevented, with a clear explanation of why. The tooltips provide proactive guidance so users understand the constraint before they encounter it.

---

## FR-028: Polish body element hover frame interaction

**Requested:** 2026-03-16
**Source:** Maya Chen UX review of body element indicators (FR-006/FR-007)
**Status:** Superseded — replaced by FR-032 (always-visible border box, shipped v0.9.5). The three issues targeted here (layout shift, missing transition, label offset) are all resolved as a side effect of the always-visible treatment. Do not implement separately.
**Priority:** Medium
**Impact:** Medium

### Description

The hover frame on body elements (`prereq`, `context`, `result`, `postreq`) has three visual issues that make the interaction feel unpolished:

1. **Layout shift on hover.** The border and padding are added on `:hover` rather than being present in the resting state. This changes the element's box model dimensions, causing content below to shift down by a few pixels on mouse enter and snap back on mouse leave. The result is visible jitter.

2. **No easing on the border transition.** The frame appears and disappears instantly because there is no `transition` on the border properties. The `::after` label already uses `transition: opacity 0.15s` for a smooth fade — the border should match.

3. **Label too close to the frame edge.** The element label (`Context`, `Result`, etc.) sits at `right: 0` with no inset, so it appears pressed against the right border of the hover frame. It needs a small offset (e.g., `right: 0.5rem`) to breathe.

### Required Changes

1. Move `border` and `padding` to the resting state with `border-color: transparent`. On `:hover`, change only `border-color` to `var(--app-border-subtle)`.
2. Add `transition: border-color 0.15s` to the base rule to match the existing label opacity transition.
3. Change the `::after` label position from `right: 0` to `right: 0.5rem` to add spacing between the label and the frame edge.

### Value Proposition (Maya Chen, UX Advisor)

Layout shift on hover is one of those things users feel before they can name — the content jumps, the eye loses its place, and the interaction feels fragile. The fix is a well-known CSS pattern: render the border in the resting state with `transparent` color so the box dimensions are stable, then transition just the color on hover. Same technique used in button hover states across most design systems.

The missing easing compounds the problem. The label fades in smoothly over 150ms, but the border snaps on instantly — two elements of the same interaction moving at different speeds. Matching the `transition` timing creates a single, cohesive reveal.

The label spacing is smaller but worth fixing at the same time. When the label reads `Context` and it's flush against a 1px border, the two elements visually merge. A half-rem inset gives the label room to be read as a label rather than part of the border decoration.

---

## FR-029: Page-view layout for the visual editor

**Requested:** 2026-03-16
**Source:** Kiryl Rusetski, with reference to Heretto CMS's author view
**Status:** Shipped (v0.9.5, 2026-05-21)
**Priority:** P3
**Impact:** Medium

### Description

The visual editor's content area currently fills its full pane — the `ContentEditable` has `max-w-6xl mx-auto px-12` which constrains and centers the text, but the background (`--editor-bg`) extends edge-to-edge with no visual boundary between "document" and "chrome." The result is an application-panel feel rather than a document-on-a-surface feel.

Add a page-view layout that renders the content region as a distinct, bounded surface — a visible "page" sitting on the editor background. This is the pattern used by Google Docs, Notion, and Heretto CMS (visible in the second reference screenshot: content sits inside a bordered region with element labels, on a distinct background surface).

### Current State (dita-architect.tsx, line ~857)

```tsx
<ContentEditable className="outline-none max-w-6xl mx-auto px-12 min-h-[500px]" />
```

The `ContentEditable` is constrained and centered, but shares the same `--editor-bg` background as the surrounding pane. There is no box-shadow, border, or background differentiation to separate the content region from the editor chrome.

### Suggested Changes

1. **Wrapper element.** Wrap the `ContentEditable` (and its placeholder) in a container `div` that acts as the "page." Apply `max-w-6xl mx-auto` to this wrapper instead of the `ContentEditable` itself.

2. **Page surface.** Give the wrapper a distinct background, subtle shadow, and vertical margin:
   - Background: a new CSS variable `--editor-page-bg` (set per theme — typically the same as `--editor-bg` or slightly lighter/warmer)
   - Shadow: theme-dependent (see below)
   - Vertical margin/padding: `py-12` or similar to create visible space above and below the page region
   - Border-radius: `rounded-lg` for a soft edge

3. **Surrounding canvas.** The `flex-1 overflow-y-auto` container behind the page should use `--app-bg` or a new `--editor-canvas-bg` variable instead of `--editor-bg`, creating a visible contrast between the "desk" surface and the "page" surface.

4. **Theme-aware treatment.** Each theme needs an appropriate page elevation:

   | Theme | Page background | Canvas background | Elevation |
   |-------|----------------|-------------------|-----------|
   | Light | `#ffffff` | `#f5f5f4` (stone-100) | `box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` |
   | Dark | `#161616` | `#111111` | `border: 1px solid var(--app-border)` |
   | Claude | `#2d2019` | `#1f150f` | `border: 1px solid var(--app-border)` |
   | Nord | `#2e3440` | `#242933` | `border: 1px solid var(--app-border)` |
   | Solarized | `#002b36` | `#001e28` | `border: 1px solid var(--app-border)` |
   | Geotab | `#252d3d` | `#0f1419` | `border: 1px solid var(--app-border)` |

   The Light theme gets a drop shadow because shadows read naturally on light surfaces. Dark themes use a subtle border instead — shadows on dark backgrounds tend to disappear or look muddy.

5. **Placeholder alignment.** The placeholder (`Start typing your DITA content here...`) is absolutely positioned and independently constrained with `max-w-6xl mx-auto px-12`. Move it inside the page wrapper so it inherits the same layout without duplicating constraints.

### What Not to Change

- **Content width.** Keep `max-w-6xl` — don't reduce the writing surface. The page metaphor is about visual containment, not reducing available space.
- **Split-pane ratio.** The Monaco/Lexical split is unchanged. The page treatment applies only to the Lexical pane's content area.
- **Body element indicators.** The color bars (FR-007) and hover labels (FR-006) continue to work inside the page container. No changes needed.
- **Toolbar placement.** The visual editor toolbar stays pinned at the top of the Lexical pane, outside the page wrapper.

### Value Proposition (Maya Chen, UX Advisor)

There's a reason every modern writing tool — Google Docs, Notion, Dropbox Paper, Heretto CMS — renders content on a bounded surface rather than letting it bleed to the edges. The page metaphor creates a psychological frame: this is a *document*, not a text field. It tells the author "you're writing something that has boundaries and structure" in a way that edge-to-edge content simply doesn't.

We're already 80% of the way there. The `max-w-6xl mx-auto px-12` constrains the content and creates generous side margins. The body element color bars (FR-007) and hover labels (FR-006) give structural signals. The Light theme warmth refinement (FR-008) shifted the palette toward "paper." What's missing is the last visual cue: the page surface itself — a background boundary that says "this is where your document lives."

The implementation is almost entirely CSS. A wrapper `div`, two new CSS variables per theme (`--editor-page-bg`, `--editor-canvas-bg`), and a theme-conditional `box-shadow` vs `border`. No behavioral changes, no new state, no Lexical API work. The hardest part is picking shadow values that look right across all six themes — and the table above is a starting point, not a prescription.

One thing to watch: the page wrapper should not interfere with the body element hover frames (FR-028). The hover border uses `border-color: transparent` in its resting state, and the page wrapper's own border is on a parent container, so there shouldn't be a conflict — but it's worth verifying visually once both are implemented.

---

## FR-030: Render Heretto images in the visual editor

**Requested:** 2026-03-27
**Source:** Product question session (Rafael Santos + Maya Chen)
**Status:** Shipped (v0.9.0 + patches — all four root-cause bugs resolved; see `bugreports/BUG-heretto-image-resolution-fails.md`)
**Priority:** P2
**Impact:** High

### Description

When a DITA topic opened from Heretto contains `<image>` elements with relative `href` paths (e.g., `../Altitude_FAQ_Images/image1.png`), the visual editor renders them as placeholder chips showing the raw file path, a mountain SVG icon, and an `IMAGE` label. This is because no code exists to resolve relative DITA image paths to fetchable Heretto URLs — the `href` is passed verbatim into `DitaImageNode`, and only absolute `https://` URLs render as actual `<img>` tags.

For image-heavy topics (e.g., Altitude FAQ guides), the visual editor stops feeling like a preview and becomes a code view with better fonts. Writers cannot see screenshots or diagrams in context.

### Current State

**Parsing** (`sync/parseXmlToLexical.ts`):
- Block-level `<image>` (line ~477): `$createDitaImageNode(href, alt, '', false)` — `href` taken verbatim
- `<fig><image>` (line ~464): `$createDitaImageNode(href, alt, figTitle, true)` — `href` taken verbatim
- Inline `<image>` in `<p>` (line ~83): `$createDitaPhRefNode('image', href, alt)` — renders as a monospace code chip

**Rendering** (`components/DitaImageNode.tsx`):
- If `href` starts with `http://` or `https://` → real `<img>` tag with `maxWidth: 100%`
- Otherwise → placeholder chip with raw path, alt text, and type label

**Heretto API proxy** (`vite.config.ts`, lines ~163–176):
- Proxies `/heretto-api/*` to `https://geotab.heretto.com/rest/*` with Basic Auth
- No image/binary asset endpoints are proxied

### Suggested Approach

1. **Add a Vite proxy route for images.** A new proxy path (e.g., `/heretto-images/{uuid}/content`) that fetches binary content from Heretto's file API using the existing Basic Auth credentials. Keeps credentials server-side.

2. **Build a path resolver.** When a topic is opened from Heretto, resolve relative `href` paths against the topic's known folder location in the CMS. Walk the relative path segments (`../`) via Heretto API folder listings to find the target image's UUID.

3. **Update `DitaImageNode` rendering.** When a Heretto-connected topic has resolved image UUIDs, rewrite the `href` to point at the local proxy route instead of rendering the placeholder.

4. **Loading states.** Show a shimmer placeholder while images resolve asynchronously. Fall back to the existing placeholder chip for unresolvable paths with an updated label: `Image not available` instead of `IMAGE`.

5. **Consider an opt-in toggle.** A `Show images` toggle in the toolbar or status bar so writers on slow connections or working with text-only topics aren't waiting for image fetches they don't need.

### UX Considerations (Maya Chen)

- `<fig>` titles should move below the image when rendered (matching most publishing pipelines)
- Alt text should remain visible as a caption: `Alt: Description of the screenshot`
- Inline `<image>` in `<p>` should render at constrained height (~1.5em) to avoid breaking paragraph flow
- The existing placeholder chip is fine as a permanent fallback — just update the label from `IMAGE` to `Image not available`

### Risks (Rafael Santos)

- **Path resolution complexity.** DITA relative paths like `../../images/foo.png` need the topic's parent folder UUID and API calls to walk the path. This is the bulk of the engineering work.
- **Performance.** Topics with many images will trigger multiple proxy fetches on open. Lazy-loading and capped display dimensions are needed.
- **Serialization safety.** `DitaImageNode` is currently skipped during serialization back to XML (line ~901 in `serializeLexicalToXml.ts`). Image resolution must not alter the serialized `href` — the original relative path must be preserved.

### What Not to Change

- **Serialized `href` values.** The XML output must preserve the original relative paths exactly. Resolution is display-only.
- **Existing absolute URL rendering.** Images with `https://` hrefs already work and should remain unchanged.
- **`DitaPhRefNode` for non-image refs.** Only the `refType='image'` case should be affected; conkeyref/keyref chips stay as-is.

---

## FR-031: "Loaded from Heretto" status state for freshly opened topics

**Requested:** 2026-03-27
**Source:** Kiryl Rusetski, with input from Rafael Santos and Maya Chen
**Status:** Shipped (`herettoJustLoaded` field added to Tab type; `compareXml` used in polling to eliminate false positives)
**Priority:** P3
**Impact:** Medium

### Description

When a topic is opened from Heretto for the first time, the status bar immediately shows 🔴 `Updated in Heretto` — the same red-dot treatment used for genuine remote conflicts. This happens because the polling effect (`useHerettoCms.ts:147–186`) compares the remote content against `savedXmlRef.current`, and the `formatXml()` beautification applied at import time (`useHerettoCms.ts:397`) introduces whitespace differences that make the strict string comparison (`remote !== t.savedXmlRef.current` at line 172) return `true`.

The result: writers see a red warning the moment they open a topic, even though nothing is wrong. This trains them to ignore the red dot, undermining the status bar's value as a trust signal.

### Root Cause

Two issues compound:

1. **False positive from formatting.** `handleImportContinue` runs `formatXml(firstContent)` before storing the content. The `savedXmlRef` gets the beautified version, but the remote poll fetches the raw Heretto version. Whitespace differences trigger `herettoRemoteChanged: true`.

2. **Missing state distinction.** The status bar has no concept of "just loaded" — it only knows `herettoRemoteChanged` (red), `herettoDirty` (amber), and the default saved state (green). A freshly loaded topic with formatting differences falls into the red branch even though no one edited it.

### Suggested Changes

**Fix 1 — Semantic XML comparison (root cause):**

Replace the strict string comparison at `useHerettoCms.ts:172`:

```ts
// Before
return { ...t, herettoRemoteChanged: remote !== t.savedXmlRef.current };

// After
return { ...t, herettoRemoteChanged: !compareXml(remote, t.savedXmlRef.current) };
```

`compareXml` is already imported in the file — it performs whitespace-insensitive XML comparison. This prevents formatting-only differences from triggering the remote change flag.

**Fix 2 — "Loaded from Heretto" status state:**

Add a `herettoJustLoaded` flag to the `Tab` type:

```ts
// types/tab.ts
herettoJustLoaded: boolean;  // true after opening from Heretto, cleared on first edit or save
```

Set it in `handleImportContinue` (`useHerettoCms.ts:398–402`):

```ts
newTab.herettoFile = { uuid: item.uuid, name: item.name, path: pathStr };
newTab.herettoLastSaved = new Date();
newTab.herettoJustLoaded = true;  // NEW
```

Clear it on first edit (when `herettoDirty` becomes true) and on first save (in `handleHerettoSave` success path).

Add a new branch in the status bar conditional (`dita-architect.tsx:891`), before the `herettoRemoteChanged` check:

```tsx
) : tab.herettoJustLoaded && !tab.herettoDirty ? (
  <>
    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
    <span>Loaded from Heretto</span>
  </>
) : tab.herettoRemoteChanged ? (
```

### Status Bar States (Updated)

| State | Dot | Text | When |
|-------|-----|------|------|
| Saving | 🟡 | `Saving to Heretto...` | Save in progress |
| Verifying | 🟡 | `Verifying save...` | Post-save verification |
| Just loaded | 🟢 | `Loaded from Heretto` | Topic just opened, no local edits yet |
| Remote changed | 🔴 | `Updated in Heretto` | Remote content changed after initial load |
| Conflict | 🔴 | `Changes in both locations` | Remote changed + local edits |
| Local edits | 🟡 | `Edited — not yet saved` | Local changes, no remote changes |
| Saved | 🟢 | `Saved to Heretto {time}` | Successfully saved, in sync |

### What Not to Change

- **`herettoRemoteChanged` semantics for real conflicts.** The red dot must still appear when someone else genuinely edits the remote topic after the initial load.
- **Polling behavior.** The 30-second poll cycle is fine — the fix is in the comparison logic, not the frequency.
- **Internal variable names.** `herettoRemoteChanged`, `herettoDirty`, etc. are code, not UI.

---

## FR-032: Extend body element indicators to non-task topic types

**Requested:** 2026-03-27
**Source:** Maya Chen (UX Engineer), based on observation by Kiryl Rusetski
**Status:** Shipped — scoped and broken into four discrete items, all delivered: P2-32 (shortdesc divider, v0.9.1.1), P2-33 (note type labels, v0.9.1.1), P2-34 (section left bar, v0.9.1.1), P2-35 (always-visible border box with label chips, v0.9.5)
**Priority:** Unassigned — needs scoping before committing to a tier
**Impact:** Medium

### Observation

The body element indicator system — color bars (FR-007) and hover labels (FR-006) — currently covers only five elements: `shortdesc`, `prereq`, `context`, `result`, and `postreq`. These are all `<taskbody>` children. When a writer opens a concept, reference, or troubleshooting topic, the visual editor shows no structural indicators at all beyond the shortdesc label.

Kiryl noticed this when switching between a task topic (which had the purple `CONTEXT` bar and green `RESULT` bar) and a concept topic from Heretto (which had no bars despite having structured content like `<note>`, `<section>`, and `<conbody>` paragraphs). The visual editor goes from "I can see the structure" to "it's just paragraphs" depending on the topic type.

This isn't a bug — the system was intentionally scoped to task body children, which have strong semantic roles. But the inconsistency is noticeable, and it reduces the visual editor's value for non-task content.

### Why this needs design thought

Task body children are easy to indicate because they map 1:1 to distinct semantic roles (`prereq` = "do this first", `context` = "background", `result` = "expected outcome"). Concept and reference topics are structurally flatter — a `<conbody>` is mostly `<p>` elements with occasional `<section>` and `<note>` wrappers. Labeling every `<p>` with a bar would be noise, not signal.

The question isn't "can we add more bars?" — the infrastructure is all there in `ShortdescPlugin.tsx` and `index.css`. The question is: **which elements, across which topic types, actually benefit from visual indicators?** And what's the right visual treatment for each?

### Elements worth considering

| Element | Topic types | Current rendering | Potential indicator value |
|---------|------------|-------------------|-------------------------|
| `<section>` | concept, reference, task | Children render normally; `<title>` renders as H2 | **High.** Section boundaries are invisible — writers can't tell where one section ends and another begins. A subtle separator or label would help. |
| `<note>` | all | Orange left border + italic text | **Medium.** The note *type* (`note`, `caution`, `warning`, `tip`, `danger`) isn't surfaced. A hover label showing the type would complete the pattern. |
| `<conbody>` `<p>` | concept | Plain paragraph | **Low.** No semantic role — labeling would be noise. |
| `<stepsection>` | task | Renders like a paragraph between steps | **Medium.** Writers may not realize these exist in the visual view. |
| `<info>` | task | Currently invisible in the visual editor | **High** (but separate issue — these elements don't render at all yet). |
| `<substeps>` | task | Currently invisible in the visual editor | **High** (same — not rendered). |
| `<cause>`, `<remedy>` | troubleshooting | Untested | **High** if troubleshooting topics are authored in the editor. |
| `<refsyn>`, `<properties>` | reference | Untested | **Medium.** Reference topics have their own structural elements that could benefit from labels. |

### Current implementation scope

For reference, the indicator system has three layers:

1. **Parser** (`sync/parseXmlToLexical.ts:215–221`): stamps `originMap` entries for recognized tags. Currently only `shortdesc`, `prereq`, `context`, `result`, `postreq` get entries unconditionally. `<p>` elements only get entries when a `bodyIndex` is passed (which doesn't happen for direct body children).

2. **Plugin** (`components/ShortdescPlugin.tsx:16–23`): the `BODY_TAG_CLASSES` map determines which tags get CSS classes applied. Only five entries today.

3. **CSS** (`index.css:489–567`): color bar borders, `::after` hover labels, and theme-aware color variables. Each new element needs a CSS variable, a border rule, and a `::after` content rule.

Adding new elements is mechanically straightforward — it's a map entry, a CSS class, and a color variable per theme. The hard part is making good design decisions about *which* elements deserve visual weight and *what* visual treatment matches their role.

### Open questions

- Should `<section>` indicators be color bars (same as task elements), or a different visual treatment — like a horizontal rule with a faded label?
- Should `<note>` types get hover labels, or is the existing orange border sufficient?
- Are troubleshooting and reference topics used enough in the editor to warrant coverage now?
- Should this be one feature request or broken into per-topic-type items?
- Does extending indicators to more elements risk making the visual editor feel cluttered?

### What not to change

- **Task body indicators.** The existing `prereq`/`context`/`result`/`postreq` bars and labels are working well. Don't alter them.
- **`<p>` elements in `<conbody>`.** These have no semantic role worth labeling. Adding bars to every paragraph would be noise.
- **`shortdesc` treatment.** Already works across all topic types via a separate code path. Leave as-is.

---

## FR-033: Normalize separators in "Open from Heretto" search

**Requested:** 2026-03-30
**Source:** Kiryl Rusetski, with UX notes from Maya Chen (UX Engineer)
**Status:** Shipped (v0.9.1.1, 2026-04-07 — `useHerettoCms.ts:255` normalizes with `.replace(/[\s_-]+/g, ' ')`)
**Priority:** P2
**Impact:** High — directly affects discoverability of files in the Heretto browser

### Description

The "Open from Heretto" search treats spaces, underscores, and hyphens as distinct literal characters. Heretto file names use underscores (`How_can_I_export_Altitude_data_for_usage_elsewhere.dita`) or hyphens (`setting-up-traffic-analysis.dita`), but writers naturally search using spaces (`how can i export` or `traffic analysis`). The result is `No results found` for queries that should obviously match.

The search match in `useHerettoCms.ts:250` is a raw `.includes()` with no normalization:

```ts
item.name.toLowerCase().includes(lowerQuery)
```

### Proposed fix

Normalize both the query and the file name before comparison by collapsing spaces, underscores, and hyphens to a common character:

```ts
const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, ' ');
// ...
normalize(item.name).includes(normalize(query))
```

This is a single-line change in the match condition. No API changes, no schema changes, no new dependencies. The normalization is purely cosmetic at match time — it does not alter file names or search results beyond making them findable.

### Scope

- Normalize underscores, hyphens, and spaces to a common form before matching
- Apply to both the query string and the `item.name` from Heretto
- No changes to how results are displayed — file names still show their original form

### Value Proposition (Maya Chen, UX Engineer)

This is a classic case of the tool asking the writer to think like a file system. A writer types what they're *thinking* — `how can i` — and gets `No results found`. Then they have to mentally translate into the CMS's file naming convention (`how_can_i`) to find anything. That's exactly backwards. The tool should meet the writer where they are.

The fix should cover all three separators — spaces, underscores, and hyphens — because Heretto teams use different naming conventions. A file like `setting-up-traffic-analysis.dita` won't match `setting up traffic analysis` either, and there's no reason a writer should need to know which convention their CMS admin chose.

One more thing worth pairing with this: the `No results found` empty state currently offers no guidance. When someone searches with spaces and gets nothing, they have no idea *why*. Even after this fix ships, a general improvement to the empty state — something like `No results found — try different keywords` instead of the bare `No results found` — would close the feedback loop. When the UI shows "nothing," it should always suggest a next step. This connects to FR-003 (empty states for the Heretto file browser) — same principle, different surface.

---

## FR-034: Larger Replace in Heretto preview modal with fluid diff height

**Requested:** 2026-04-06
**Source:** Kiryl Rusetski, with UX notes from Maya Chen (UX Engineer)
**Status:** Shipped (v0.9.1.1, 2026-04-07)
**Priority:** P3
**Impact:** Medium — improves readability of the diff preview step without changing any behaviour

### Description

The Replace in Heretto modal is currently `w-[600px] max-h-[90vh]` (`HerettoReplaceModal.tsx:147`), and the DiffViewer is rendered at a fixed `height={400}` (`HerettoReplaceModal.tsx:232`, `DiffViewer.tsx:141`). At 600px wide the side-by-side diff is difficult to read — XML lines wrap or require horizontal scrolling, and authors cannot comfortably review their changes before confirming.

### Proposed changes

Two targeted changes with no structural impact:

1. **Modal width:** Change `w-[600px]` to `w-[900px] max-w-[90vw]` so the modal grows on larger screens and scales down gracefully on smaller ones. The existing `max-h-[90vh]` constraint is unchanged.

2. **DiffViewer height:** Replace the fixed `height={400}` prop with a flex-fill approach. The modal wrapper is already `flex flex-col`, so passing `className="flex-1 min-h-0"` to `DiffViewer` and removing the fixed `height` prop allows the diff pane to fill all available vertical space between the header and the footer buttons. The `height` prop on `DiffViewer` can remain as an optional fallback for other call sites.

### Scope

- `HerettoReplaceModal.tsx`: update modal width class; remove `height={400}` from `DiffViewer` and add `className="flex-1 min-h-0"`
- `DiffViewer.tsx`: make `height` prop optional (already is — default is `400`); when not provided, the container div should use `height: 100%` to fill its flex parent instead of the fixed pixel value

No behaviour changes, no new dependencies, no other surfaces affected.

### Value Proposition (Maya Chen, UX Engineer)

The diff view is the whole reason the preview step exists. Authors are supposed to review what's about to change before committing to an irreversible replace. But at 600px wide with a 400px-tall diff box, that review is more of a formality than a real check — lines wrap, you're scrolling in both directions inside a modal, and it's genuinely hard to read.

Making the modal wider addresses the most immediate pain. The flex-fill height change is the more valuable of the two, though. Right now the modal can be tall (it's `max-h-[90vh]`) but the diff is always a fixed 400px regardless — so you get empty modal chrome above and below the diff on larger screens, while the diff itself is still cramped. Letting the diff fill the available height means the modal space is actually *used*.

The `"No changes detected — your content matches the version in Heretto"` status line at the bottom of the diff viewer also benefits — at 400px it can get pushed below the fold on content-heavy diffs, so authors sometimes miss it entirely. With flex-fill it stays visible relative to the content height.

---

## FR-035: "Connect a Map" — key registry, keyref validation, and cross-file xref validation

**Requested:** 2026-04-10
**Source:** Kiryl Rusetski, with engineering scoping by Rafael Santos and UX scoping by Maya Chen
**Status:** Open
**Priority:** P2 (tracked as P2-27 in BACKLOG.md)
**Impact:** High — closes the validation gap on keyref chips and cross-file xrefs; brings authoring-time signal to content that previously failed silently at build time

### Description

Writers currently see all keyref chips in a neutral state with no indication of whether the key resolves. Cross-file xref targets (`href="other-file.dita#id"`) are also unvalidated. This feature delivers the full ditamap-aware validation layer.

### Scoping decisions (2026-04-10)

All decisions from the formal scoping session are preserved here:

**Entry point and naming**
- Action label: `"Connect a Map"` (not `"Load ditamap"` — too jargon-heavy for writers who don't think in maps)
- Lives in the Heretto dropdown for the current toolbar; future top-level menu bar redesign tracked separately

**Loader**
- Source: Heretto (by UUID), fetched via existing authenticated API. Local file upload deferred.
- Depth: 3 levels of `<mapref>` recursion. The Altitude warehouse hierarchy requires this: root → `Altitude_variables_within_variables.ditamap` → `Altitude_variables.ditamap`.
- Writers select the correct map manually — they know which map defines their keys. A map discovery tool is tracked separately as FR-036.
- Real-world key count (Altitude User Guide): 18 keys across 2 levels (1 root keydef `VARS` + 17 `GLOS-*` glossrefs via `Glossary_Altitude.ditamap`). Warehouse keys (`varsAltitude`, `varsAltitudeUI`, `varsAltitudeNotes`, `varsAltitudeNav`, `varsAltitudeXREF`) live in separate ditamaps and require connecting a different root map.

**Persistence**
- UUID written to `localStorage` automatically on successful connect; silently restored on next launch.
- No close-tab modal (browsers block `beforeunload`).
- Manual `"Reload map"` button in Heretto dropdown.
- Auto-refresh of the registry is a future feature request.

**Three chip states** (UX review, Kiryl)
All three states are visually distinct:
1. No map loaded: neutral chip + tooltip `"Load a ditamap to verify this key resolves"`
2. Map loaded, key not found: yellow highlight + tooltip `"Key not found in the loaded map"`
3. Map loaded, key resolved: neutral chip + tooltip `"Key found in [MapName.ditamap]"`

**Feedback**
- Success: toast — `"Connected [MapName.ditamap] — N key definitions loaded"`
- Failure (network error, bad UUID, malformed XML): modal with specific error message per failure type; keyrefs remain in their previous state on failure

**Cross-file xref validation (in scope for same item)**
- For `href` values referencing another file (`other-file.dita` or `other-file.dita#id`), fetch the target topic from Heretto and check that the fragment ID exists.
- Broken: red wavy underline (`dita-validation-broken-xref`, already styled).
- Same-document `#anchor` validation already shipped in v0.9.0 and is unaffected.

### Technical implementation sketch

- `useDitamap` hook: fetches root ditamap XML from Heretto, walks `<mapref>` elements recursively (max 3 levels), extracts `<keydef>` and `<glossref>` elements, builds `Map<string, { href: string; mapName: string }>` registry, persists UUID to `localStorage`
- `DitamapContext` or prop passed down to `InlineValidationPlugin`
- `InlineValidationPlugin` extended to validate `DitaPhRefNode` key values against registry (in addition to existing `LinkNode` href validation)
- Cross-file xref: parse `href` to separate file path from anchor, fetch target topic by path from Heretto, extract ID set, validate anchor presence

---

## FR-036: Map discovery — surface ditamaps that reference the current topic

**Requested:** 2026-04-10
**Source:** Kiryl Rusetski (emerged from FR-035 scoping session)
**Status:** Open
**Priority:** P3
**Impact:** Medium — reduces friction for new writers who don't know which map to connect

### Description

When a writer opens a topic from Heretto and wants to use "Connect a Map" (FR-035), they need to know which ditamap to point the tool at. Experienced writers know this. New writers or writers unfamiliar with the publication structure may not.

A discovery tool would surface ditamaps that include the currently open topic in their `<topicref>` hierarchy — giving writers an informed starting point rather than requiring them to navigate the CMS manually.

### Proposed approach (for scoping)

On open or on demand, query Heretto for all ditamap files accessible to the user. For each map, check whether the current topic's UUID appears as a `<topicref href>` at any depth. Surface matching maps in a `"Connect a Map"` picker panel with the map name, folder path, and a connect button.

### Constraints

- Heretto does not expose a "find maps referencing this topic" API directly — this would require fetching and parsing all ditamaps, which may be slow.
- Could be approximated by searching within known parent folders rather than the full CMS.
- Caching parsed maps between sessions would mitigate performance concerns.

### Notes

This is explicitly deferred from FR-035. Writers know which map to connect in the current workflow. Discovery becomes more valuable as the tool is adopted by writers less familiar with the publication structure.

---

## FR-037: General discoverability — empty states, onboarding hints, and feature surfacing

**Requested:** 2026-04-13
**Source:** Maya Chen (UX Engineer, product review session)
**Status:** Open
**Priority:** P3
**Impact:** High for new users, low for experienced users — reduces learning curve without changing functionality

### Description

New writers open DITA Architect and see a visual editor on the right and XML on the left, but there's no moment where the tool explains itself. They don't know that `Ctrl+Enter` syncs the two panes, what the toolbar buttons do beyond their icons, or that a `+` menu for inline elements exists (once shipped).

### Proposed improvements

1. **Empty state coach mark** — First time a new tab opens, show a one-time hint: `"This editor has two views — edit here or in the XML pane on the left, then press Ctrl+Enter to sync"`. Dismiss after first sync or manual close. Persist in `localStorage`.

2. **Better placeholder copy** — `"Task title"` looks like real content. `"Click to add title"` or `"Enter your task title"` signal the action more clearly. (Visual treatment addressed by P3-25 + P3-41; this covers the copy itself.)

3. **Tooltip coverage audit** — Full toolbar pass to ensure every interactive element explains itself on hover. The topic type badge (`TASK`) has no tooltip (Maya, 2026-03-16); add `"Topic type: task"`.

4. **Out-of-sync banner** (P3-26) — When XML diverges without `Ctrl+Enter`, show: `"Visual editor is out of sync — press Ctrl+Enter to refresh"`. Surfaces the sync gesture in context.

5. **Success feedback for Connect a Map** (P2-27) — Toast: `"Connected [MapName.ditamap] — N key definitions loaded"`. Already scoped in P2-27; flagged here as a discoverability principle.

6. **Keyboard shortcut cheat sheet** (P3-9) — Overlay via `?` or `Cmd+/`. Already backlogged; included here as part of the discoverability theme.

### Notes (Maya Chen, 2026-04-13)

Discoverability isn't one feature — it's a perspective. Each new feature should ship with its success feedback, its tooltip, and its empty state built in — not as follow-on items. The gap between "works" and "feels right" is this work.

---

## FR-038: Base visual styling for xrefs in the visual editor

**Requested:** 2026-04-14
**Source:** Kiryl Rusetski, with UX notes from Maya Chen
**Status:** Shipped (v0.9.3, 2026-04-14 — underline styling added; `InlineValidationPlugin` stamps `title` attributes on all `LinkNode` DOM elements)
**Priority:** P2 (tracked as P2-30 in BACKLOG.md)
**Impact:** High — without base xref styling, the broken-xref validation layer (v0.9.0/v0.9.2) is functionally invisible to authors

### Description

`<xref>` elements are correctly parsed into Lexical `LinkNode` objects (`parseXmlToLexical.ts:92`) and render as `<a>` tags in the DOM. However, `index.css` has no base styling for `a` elements inside the editor content area — so valid xrefs are visually identical to plain text. Authors have no way to know a cross-reference exists unless they switch to the XML pane.

The broken-xref validation (`.dita-validation-broken-xref`, red wavy underline) and unresolved-keyref highlight shipped in v0.9.0 and v0.9.2, but those features assume authors can already distinguish xrefs from surrounding text. Without the base styling, the alarm works but the house is invisible.

### Fix

Add a scoped CSS rule to the editor content area:

```css
.dita-editor-content a {
  color: var(--color-dita-500);
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

Verify the color resolves correctly across all six themes (dark, light, claude, nord, solarized, geotab). The `--color-dita-500` token is already defined globally.

### UX notes (Maya Chen, 2026-04-14)

The sequencing here is backwards — we built the alarm system before we built the house. The broken-xref wavy underline only lands if the author already knows `"beginner guide"` is an xref. If they don't — and why would they, it looks like a sentence — they see a red squiggle under what looks like plain text and assume they misspelled something.

**Three-state model** — once base styling is in, xref visual states become legible as a system:
- **Styled, unvalidated** (cross-file xref, no map loaded) — blue underline, no squiggle. Author sees it's a link; validation is deferred to P2-27.
- **Styled, broken** — blue underline + red wavy overlay. Clearly a link, clearly wrong.
- **Styled, resolved** — blue underline, clean. Confirmed by P2-27 "Connect a Map".

**Inline icon** — have you considered a small `↗` or chain-link glyph after the link text, like Notion's external link indicator? It would make xrefs visually distinct from `<codeph>` and `<term>`, which otherwise compete with link styling.

**Hover title** — show the href on hover via a `title` attribute: `"Linked to: _Calls.dita#getting_started_altitude_api"`. Authors can verify the target without switching to XML. This can be wired through `InlineValidationPlugin`'s `applyValidationStyles` pattern, extended to cover all `LinkNode`s — not just broken ones.

### Implementation notes

- **CSS** — one scoped rule; verify across all six themes. Sonnet-sized.
- **Hover title** — extend `InlineValidationPlugin` to set `title` attribute on all `LinkNode` DOM elements (not just broken ones). Add alongside CSS in the same pass.
- **Inline icon** — optional polish; can ship independently or bundle with P2-27.

---

## FR-039: macOS native app — menu bar structure and item placement policy

**Requested:** 2026-05-25
**Status:** Open
**Priority:** P2
**Impact:** High — establishes the correct native macOS UX pattern for all future feature work on the native app

### Description

The native macOS app (`macos/`) currently has a minimal menu bar (DITA Architect → Quit; Edit → Cut/Copy/Paste/Undo/Redo; Window → Minimise/Zoom) and an in-app header with a "File Options" dropdown and a "Heretto" dropdown. As the native app grows, there is a risk of duplicating commands in inconsistent places, confusing users who expect macOS conventions, and making actions undiscoverable to keyboard users.

This feature request establishes the correct structure and a placement policy for all future items.

### Current State

**macOS menu bar (AppDelegate.swift):**
- DITA Architect: Quit `⌘Q`
- Edit: Cut `⌘X`, Copy `⌘C`, Paste `⌘V`, Select All `⌘A`, Undo `⌘Z`, Redo `⇧⌘Z`
- Window: Minimise `⌘M`, Zoom

**In-app header bar (web UI):**
- File Options dropdown — New Topic (Task/Concept/Reference), Open Local File, Save Locally, Export PDF, What's New, Keyboard Shortcuts
- Heretto dropdown — Connect/Disconnect, Open from Heretto, Browse, Replace in Heretto, Reload Map, Connect a Map

**In-app formatting toolbar (web UI):**
- Theme selector, Undo/Redo, H1/H2, Bold/Italic, Lists, Table, Note, Link, Edit mode, Delete
- XML theme selector, Format XML, Word wrap, View toggle, Topic type badge

### Placement Principle

macOS has two layers with distinct jobs:

| Layer | Job | User mental model |
|---|---|---|
| **macOS menu bar** | App-wide commands, document lifecycle, keyboard shortcuts | "How do I do X to this document?" |
| **In-app toolbar/header** | Active editing controls, view state, connection status | "I need this while I'm writing" |

**Decision rule:** If an action deserves a `⌘` shortcut or applies to the document as a whole, it belongs in the menu bar (or both). If it is a formatting control used mid-sentence or a view toggle, it belongs in the toolbar. If it shows connection status as much as it provides actions, it belongs in the header.

### Recommended Menu Bar Structure

**DITA Architect menu (expand from current)**
| Item | Shortcut | Action |
|---|---|---|
| About DITA Architect | — | Info panel (version, build) |
| What's New... | — | Opens release notes modal via JS bridge |
| Keyboard Shortcuts... | — | Opens shortcut modal via JS bridge |
| *(separator)* | | |
| Quit DITA Architect | `⌘Q` | Existing |

**File menu (new — does not exist yet)**
| Item | Shortcut | Action |
|---|---|---|
| New Task | `⌘N` | Opens new task topic via JS bridge |
| New Concept | `⇧⌘N` | Opens new concept topic via JS bridge |
| New Reference | `⌥⌘N` | Opens new reference topic via JS bridge |
| *(separator)* | | |
| Open Local File... | `⌘O` | Opens file picker via JS bridge |
| Close Tab | `⌘W` | Closes the active tab via JS bridge |
| *(separator)* | | |
| Save to Heretto | `⌘S` | Saves active tab to Heretto via JS bridge |
| Replace in Heretto... | — | Opens replace workflow via JS bridge |
| Export as PDF... | — | Opens print/export via JS bridge |
| *(separator)* | | |
| Connect to Heretto... | — | Opens Heretto connection modal via JS bridge |
| Open from Heretto... | — | Opens Heretto browser modal via JS bridge |

**Edit menu (no changes needed)**
Existing items (Cut, Copy, Paste, Select All, Undo, Redo) are correct.

**View menu (new — does not exist yet)**
| Item | Shortcut | Action |
|---|---|---|
| Toggle XML Pane | `⌘\` | Show/hide the Monaco XML panel |
| Toggle Split View | — | Cycle view modes |
| *(separator)* | | |
| Theme | submenu | Lists all app themes |
| XML Syntax Theme | submenu | Lists all XML syntax themes |

**Window menu (no changes needed)**

### In-App Header — Policy Going Forward

- The **Heretto button/dropdown** stays in the header permanently — it is a connection status indicator as much as a menu. Its actions (Connect, Open from Heretto, etc.) should appear in the File menu too (dual-path is acceptable and expected for Mac apps), but the header button is not going away.
- The **File Options dropdown** should stop growing. Any new document-level action (new export format, history, versioning) should be added to the macOS File menu, not to File Options. File Options may eventually be removed from the native app once the File menu is complete, but that is not required immediately.

### Technical Approach

Each menu item requires two things:

1. **Swift side (`AppDelegate.swift`):** An `NSMenuItem` with a target/action selector that calls into `jsBridge`.
2. **Web app side (`dita-architect.tsx` or a new `lib/macos-api.ts`):** A `window.__ditaApi.methodName()` function exposed to the JS context that the bridge can call via `callAsyncJavaScript`.

Existing pattern (from `HttpServer.swift`):
```swift
bridge.call("window.__ditaApi.getStatus") { result in ... }
```

New File menu action example:
```swift
@objc func newTask(_ sender: Any?) {
    jsBridge?.call("window.__ditaApi.newTopic", args: ["type": "task"], body: "return window.__ditaApi.newTopic(type)") { _ in }
}
```

The `window.__ditaApi` surface in the web app needs new entries for any action not already exposed via the HTTP API.

### Value Proposition

Mac users have 40+ years of muscle memory for `⌘N`, `⌘O`, `⌘S`, `⌘W`. When those shortcuts don't work in a native app, users notice immediately — they either give up on keyboard-driven workflows or feel the app is unfinished. Beyond shortcuts, the macOS menu bar is the universal discoverability surface: new users who don't know what an app can do open the menu and read. "File Options" inside the web UI is invisible to this discovery path.

This is also a prerequisite for future features. Every document-level capability added to the native app — version history, map export, multi-file operations — needs a home in the menu bar before it can have a keyboard shortcut.

### What This Does Not Change

- The formatting toolbar stays exactly as-is. Bold, Italic, lists, tables, undo/redo, theme selectors — all toolbar, all correct.
- The visual editor vs XML editor split is unchanged.
- The Heretto status indicator in the header stays.
- The web app (browser) is unaffected — it has no macOS menu bar.

---

## FR-040: Element insertion mode — Before, After, Wrap in the `+` menu

**Requested:** 2026-05-25
**Status:** Open
**Priority:** P3
**Impact:** High for authoring precision; low urgency until P2-28 (the `+` menu shell) ships
**Depends on:** P2-28

### Description

The `+` menu (P2-28) currently inserts elements at a fixed position relative to the cursor. Heretto's equivalent menu exposes an explicit insertion mode selector at the top of the panel:

- **Intelligently** — editor decides the best placement based on DITA content model context
- **Before** — insert the new element immediately before the current block
- **After** — insert the new element immediately after the current block
- **Wrap** — wrap the current selection (or current block if nothing is selected) inside the new element

The mode selector sits above the search field, always visible. The selected mode persists for the session so repeated insertions use the same mode without re-selecting.

### Value Proposition

Without an explicit mode, "insert paragraph" is ambiguous — does it go before or after the cursor block? "Wrap selection in `<ph>`" is impossible with a single insertion gesture today. These three modes turn the `+` menu from a creation tool into a structural editing tool. Wrap is especially valuable for inline elements: the author selects text, chooses Wrap, picks `<uicontrol>`, and the selection becomes `<uicontrol>selected text</uicontrol>` in one gesture instead of requiring XML editing.

### Suggested Approach

- Add a `mode` selector component above the search field in the `+` menu (P2-28 shell). Four options: Intelligently, Before, After, Wrap. Default: Intelligently.
- Persist the selected mode in `localStorage` under `dita-architect-insert-mode`.
- **Before / After:** use Lexical's `insertBefore` / `insertAfter` on the nearest block ancestor of the current selection.
- **Wrap:** for block elements, wrap the current block node. For inline elements, wrap the current text selection in the chosen element (use `$wrapNodes` or `$wrapLeafNodesInElements` from `@lexical/selection`).
- **Intelligently:** current default behavior — insert at cursor, let the DITA content model filter (P2-37) handle validity.
- Disable **Wrap** in the selector when nothing is selected and the insertion target is an inline-only element (wrapping a block in `<codeph>` is invalid).

### Scope

- Does not change the element catalog (P2-29) or content model filtering (P2-37).
- Does not affect the block-level `+` hover button (shipped v0.9.5) — that button always inserts after the current block and does not need a mode selector.
- The mode selector only appears in the modal `+` menu (P2-28), not in the hover button.

### Reference

Heretto CMS (screenshot, 2026-05-25): mode selector positioned as a dropdown at the top of the element insertion panel, above the search field. Options: Intelligently, Before, After, Wrap. Wrap is checkmarked when selected.

---

## FR-041: `POST /api/load-content` should accept an optional Heretto UUID

**Requested:** 2026-05-27
**Source:** Kiryl Rusetski, observed during Claude Code skill workflow
**Status:** Open
**Priority:** P2
**Impact:** High — without this, content loaded via the API has no path back to Heretto from the editor UI

### Description

When a topic is loaded into DITA Architect via `POST /api/load-content`, the resulting tab has `herettoFile: null` regardless of whether the content originated from Heretto. The Heretto status bar and push button are absent because the editor has no knowledge of the file's CMS origin.

This forces external tools (Claude Code skills, scripts) to push edits back to Heretto themselves via the REST API, bypassing the editor's built-in save flow entirely — including the diff preview, conflict detection, and version history that the editor provides.

### Proposed Change

Add an optional `herettoUuid` field to the `POST /api/load-content` request body:

```json
{
  "xml": "<?xml version=\"1.0\" ...>...",
  "fileName": "my-topic.dita",
  "herettoUuid": "eaf9b2ce-a916-46ed-b693-2a68dc43ad2b"
}
```

When `herettoUuid` is present, set `tab.herettoFile` to `{ uuid: herettoUuid, name: fileName }` on the new tab. The tab then behaves identically to one opened from the Heretto file browser — the push button appears, conflict detection is active, and the author can save normally.

### Value Proposition

A Claude Code skill that loads a topic for review or editing should be able to hand off the save action to the author in the editor. Today it cannot — the editor has no "Save to Heretto" button for externally loaded content, so the skill must push programmatically or ask the author to copy-paste. Adding `herettoUuid` to the load payload closes the hand-off loop: the skill loads the content, the author reviews and edits, and the editor's normal save flow handles the rest.

---

## FR-042: `insert-section` tracked changes must serialize back to DITA XML on accept

**Requested:** 2026-05-27
**Source:** Kiryl Rusetski, observed during Claude Code skill workflow
**Status:** Open
**Priority:** P1
**Impact:** Critical — accepted tracked changes currently produce malformed output that cannot be pushed to Heretto

### Description

When a section is injected via `POST /api/tabs/:id/insert-section` and the author accepts the tracked change in Edit Mode, the accepted content is serialized back into the tab XML in the XHTML namespace (`xmlns="http://www.w3.org/1999/xhtml"`) rather than as DITA markup. All DITA-specific elements and attributes in the injected section are lost or downgraded:

- `<keyword conkeyref="..."/>` → empty (conkeyref stripped)
- `<ph conkeyref="..."/>` → empty (conkeyref stripped)
- `<uicontrol conkeyref="..."/>` → empty (conkeyref stripped)
- `<uicontrol>text</uicontrol>` → `<b>text</b>` (element downgraded)
- `class="..."` attributes removed
- Namespace of the entire section set to `http://www.w3.org/1999/xhtml`

The result is structurally invalid DITA that cannot be pushed to Heretto and does not round-trip correctly through `GET /api/tabs/:id/content`.

### Root Cause (suspected)

The `TrackedChangesPlugin` stores injected sections as Lexical nodes during Edit Mode. When the author accepts, the plugin likely serializes via the Lexical XHTML path (used for clipboard and export) rather than through the DITA-aware `serializeLexicalToXml` path. DITA-specific node types (`DitaPhRefNode`, `DitaImageNode`, conkeyref nodes) may not survive the round-trip through Lexical's internal representation.

### Expected Behavior

After the author accepts a tracked insertion:
- The accepted section should appear in the tab XML in the DITA namespace, with all conkeyrefs, element types, and `class` attributes intact.
- `GET /api/tabs/:id/content` should return valid, publishable DITA.
- The accepted content should be indistinguishable from content typed directly into the XML source pane.

### Workaround (current)

Build the final XML by hand (combining original unchanged sections with new content) and push directly to Heretto via REST API, bypassing the editor entirely. This defeats the purpose of Edit Mode as a review workflow.

### Notes

This was discovered during a real authoring workflow: a Claude Code skill injected three new sections into a topic using `insert-section`, the author accepted all three, and `GET /api/tabs/:id/content` returned a mix of original DITA sections and XHTML-namespaced accepted sections with stripped conkeyrefs. The content could not be pushed to Heretto without manual reconstruction.

---

## FR-043: `insert-section` should support injecting block-level elements into flat `<conbody>` topics

**Requested:** 2026-05-27
**Source:** Kiryl Rusetski, observed during Claude Code skill workflow
**Status:** Open
**Priority:** P2
**Impact:** Medium — concept topics without `<section>` structure cannot use tracked-change injection at all

### Description

`POST /api/tabs/:id/insert-section` only accepts `<section>` fragments. Concept topics that use a flat `<conbody>` structure — `<p>`, `<ul>`, `<note>` elements directly in the body, with no `<section>` wrappers — cannot receive any tracked-change injections via the API, even for targeted edits like inserting or replacing a single paragraph.

### Proposed Change

Extend `insert-section` (or add a companion endpoint, e.g. `insert-block`) to accept any block-level DITA element as the injection fragment: `<p>`, `<ul>`, `<ol>`, `<note>`, `<table>`, in addition to `<section>`. The injected block appears highlighted green in Edit Mode exactly as sections do today.

Optionally, support a `replaceId` parameter that targets an existing element by its `id` attribute, so the tracked change is shown as a replacement (old content struck through in red, new content green) rather than a pure insertion.

### Value Proposition

Many Geotab topics — particularly older concept topics — use flat `<conbody>` structure without sections. A skill that can only inject `<section>` elements cannot offer Edit Mode review for any change in these topics, even a one-word edit. This forces the skill to either bypass the editor entirely (direct REST push, no author review) or ask the author to make the edit manually. Supporting block-level injection would make Edit Mode usable for the full range of DITA topic structures.
