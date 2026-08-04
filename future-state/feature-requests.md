# DITA Architect — Feature Requests

Feature requests are differentiated from action items and bugs. Items here are considered for future work based on priority and impact.

Each open FR opens with a **problem-first header** so the *why* is legible before the *how*:

- **Problem:** what's missing/wrong for the writer (not the solution)
- **Signal:** evidence it matters — who hit it, when, how often
- **Smallest slice:** the minimum shippable cut that relieves the Problem
- **Serves:** which acceptance criterion it advances (top criterion: WYSIWYG/DITA parity; writer experience over developer convenience)

Detailed sections below exist only for open items. Shipped items are fully recorded in the table.

---

## All Feature Requests

|     | ID                                                                                              | Title                                                                             | Requested  | Status                    |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ------------------------- |
| 🟢  | FR-001                                                                                          | Add "Beautify" button to XML toolbar                                              | 2026-03-10 | Shipped v0.6.1            |
| 🔴  | [FR-002](##fr-002-release-notes-version-browser-in-whats-new-modal)                             | Release notes version browser in What's New modal                                 | 2026-03-12 | Open                      |
| 🟢  | FR-003                                                                                          | Empty states for Heretto file browser                                             | 2026-03-12 | Shipped v0.6.2            |
| 🟢  | FR-004                                                                                          | Inline validation hints in the visual editor                                      | 2026-03-12 | Shipped v0.9.0            |
| 🔴  | [FR-005](#fr-005-keyboard-shortcut-cheat-sheet)                                                 | Keyboard shortcut cheat sheet                                                     | 2026-03-12 | Open                      |
| 🟢  | FR-006                                                                                          | Hover element labels in visual editor                                             | 2026-03-13 | Shipped v0.6.0            |
| 🟢  | FR-007                                                                                          | Structural color bars for DITA body elements                                      | 2026-03-13 | Shipped v0.6.0            |
| 🟢  | FR-008                                                                                          | Light theme warmth refinement                                                     | 2026-03-13 | Shipped v0.6.0            |
| 🟢  | FR-009                                                                                          | Add aria-label to Format XML button                                               | 2026-03-13 | Shipped v0.6.2            |
| 🟢  | FR-010                                                                                          | Improve Format XML error toast specificity                                        | 2026-03-13 | Shipped v0.6.2            |
| 🟢  | FR-011                                                                                          | Refine external load toast copy                                                   | 2026-03-13 | Shipped v0.7.1            |
| 🟢  | FR-012                                                                                          | Improve HerettoReplaceModal recovery text                                         | 2026-03-13 | Shipped v0.7.2            |
| 🟢  | FR-013                                                                                          | Improve DiffViewer empty state copy                                               | 2026-03-13 | Shipped v0.7.2            |
| 🟢  | FR-014                                                                                          | Use contextual placeholder in HerettoStatusModal                                  | 2026-03-13 | Shipped v0.7.2            |
| 🟢  | FR-015                                                                                          | Rename `Commit` button to `Save to Heretto`                                       | 2026-03-13 | Shipped v0.9.1.1          |
| 🟢  | FR-016                                                                                          | Use writer-friendly vocabulary in Heretto status bar                              | 2026-03-13 | Shipped v0.9.1.1          |
| 🟢  | FR-017                                                                                          | Editor status API endpoint                                                        | 2026-03-16 | Shipped v0.7.3            |
| 🟢  | FR-018                                                                                          | List open tabs API endpoint                                                       | 2026-03-16 | Shipped v0.7.3            |
| 🟢  | FR-019                                                                                          | Read tab content API endpoint                                                     | 2026-03-16 | Shipped v0.7.3            |
| 🟢  | FR-020                                                                                          | Update tab content API endpoint                                                   | 2026-03-16 | Shipped v0.8.0            |
| 🟢  | FR-021                                                                                          | Save tab to Heretto API endpoint                                                  | 2026-03-16 | Shipped v0.8.0            |
| 🟢  | FR-022                                                                                          | Format tab XML API endpoint                                                       | 2026-03-16 | Shipped v0.8.0            |
| 🟢  | FR-023                                                                                          | Tab content statistics API endpoint                                               | 2026-03-16 | Shipped v0.8.0            |
| 🟢  | FR-024                                                                                          | Table context menu (insert/delete rows and columns)                               | 2026-03-16 | Shipped v0.7.2            |
| 🟢  | FR-025                                                                                          | Insert Table toolbar action                                                       | 2026-03-16 | Shipped v0.8.0            |
| 🔴  | [FR-026](#fr-026-table-context-menu-accessibility-aria-roles-and-keyboard-navigation)           | Table context menu accessibility (ARIA roles and keyboard navigation)             | 2026-03-16 | Open                      |
| 🟢  | FR-027                                                                                          | User feedback for prevented table operations                                      | 2026-03-16 | Shipped v0.9.1.1          |
| ⚫   | FR-028                                                                                          | Polish body element hover frame interaction                                       | 2026-03-16 | Superseded by FR-032      |
| 🟢  | FR-029                                                                                          | Page-view layout for the visual editor                                            | 2026-03-16 | Shipped v0.9.5            |
| 🟢  | FR-030                                                                                          | Render Heretto images in the visual editor                                        | 2026-03-27 | Shipped                   |
| 🟢  | FR-031                                                                                          | "Loaded from Heretto" status state for freshly opened topics                      | 2026-03-27 | Shipped                   |
| 🟢  | FR-032                                                                                          | Extend body element indicators to non-task topic types                            | 2026-03-27 | Shipped (P2-32/33/34/35)  |
| 🟢  | FR-033                                                                                          | Normalize separators in "Open from Heretto" search                                | 2026-03-30 | Shipped v0.9.1.1          |
| 🟢  | FR-034                                                                                          | Larger Replace in Heretto preview modal with fluid diff height                    | 2026-04-06 | Shipped v0.9.1.1          |
| 🔴  | [FR-035](#fr-035-connect-a-map--key-registry-keyref-validation-and-cross-file-xref-validation)  | "Connect a Map" — key registry, keyref validation, and cross-file xref validation | 2026-04-10 | Open                      |
| 🔴  | [FR-036](#fr-036-map-discovery--surface-ditamaps-that-reference-the-current-topic)              | Map discovery — surface ditamaps that reference the current topic                 | 2026-04-10 | Open                      |
| 🔴  | [FR-037](#fr-037-general-discoverability--empty-states-onboarding-hints-and-feature-surfacing)  | General discoverability — empty states, onboarding hints, and feature surfacing   | 2026-04-13 | Open                      |
| 🟢  | FR-038                                                                                          | Base visual styling for xrefs in the visual editor                                | 2026-04-14 | Shipped v0.9.3            |
| 🔴  | [FR-039](#fr-039-macos-native-app--menu-bar-structure-and-item-placement-policy)                | macOS native app — menu bar structure and item placement policy                   | 2026-05-25 | Open                      |
| 🔴  | [FR-040](#fr-040-element-insertion-mode--before-after-wrap-in-the--menu)                        | Element insertion mode — Before, After, Wrap in the `+` menu                      | 2026-05-25 | Open                      |
| 🟢  | FR-041                                                                                          | `POST /api/load-content` should accept an optional Heretto UUID                   | 2026-05-27 | Shipped v0.9.6.1          |
| 🟢  | FR-042                                                                                          | `insert-section` tracked changes must serialize back to DITA XML on accept        | 2026-05-27 | Shipped v0.9.6.1          |
| 🟢  | FR-043                                                                                          | `insert-section` should support block-level elements into flat `<conbody>` topics | 2026-05-27 | Shipped v0.9.6.1          |
| ⏸️  | [FR-044](#fr-044-altitude-by-geotab-theme)                                                      | Altitude by Geotab theme                                                          | 2026-06-02 | Parked — Rolled back 2026-07-20 |
| 🟢  | FR-045                                                                                          | Monaco-diff review surface for API insertions                                     | 2026-06-04 | Shipped v0.8.8            |
| 🟢  | FR-046                                                                                          | Marks-as-data tracked changes in Lexical (suggesting mode)                        | 2026-06-04 | Shipped v0.9.0            |
| 🔴  | [FR-047](#fr-047-byte-stability-test-corpus--shared-test-editor-factory)                        | Byte-stability test corpus + shared test editor factory                           | 2026-07-17 | Open (P1 — blocks BUG-04) |
| 🔴  | [FR-048](#fr-048-test-suite-triage--gate-5-artifacts)                                           | Test-suite triage — Gate 5 artifacts                                              | 2026-07-17 | Open                      |
| 🔴  | [FR-049](#fr-049-true-placeholders-for-template-titleshortdesc-empty-node--css-decoration)      | True placeholders for template title/shortdesc                                    | 2026-07-17 | Open                      |
| 🔴  | [FR-050](#fr-050-native-pdf-export--print-fidelity-pass)                                        | Native PDF export + print fidelity pass                                           | 2026-07-17 | Open                      |
| 🔴  | [FR-051](#fr-051-tracked-changes-v2--format-marks-block-merge-tracking-dita-round-trip-carrier) | Tracked changes v2 — format marks, block-merge tracking, DITA round-trip carrier  | 2026-07-17 | Open                      |
| 🟢  | FR-052                                                                                          | Markdown rendering in release notes                                               | 2026-07-20 | Shipped v0.9.1            |
| 🟢  | FR-053                                                                                          | Release notes modal — X button replaces Close button                              | 2026-07-20 | Shipped v0.9.1            |
| 🔴  | [FR-054](#fr-054-heretto-folder-tree-view-in-browser-modal)                                   | Heretto folder tree view in browser modal                                         | 2026-07-20 | Open                      |
| 🔴  | [FR-055](#fr-055-read-active-tab-content-api-endpoint)                                        | Read active tab content API endpoint                                              | 2026-07-30 | Open                      |

---

## Open Feature Requests

## FR-002: Release notes version browser in What's New modal

**Requested:** 2026-03-12
**Status:** Open
**Priority:** Low
**Impact:** Low–Medium

**Problem:** The What's New modal shows only the latest release notes entry, so past versions become invisible to users unless they read the source code.
**Signal:** Raised by Maya Chen on 2026-03-12; she notes every release adds another entry that disappears, even though it's not yet urgent at two versions.
**Smallest slice:** A version list/dropdown in the modal populated from the existing `RELEASE_NOTES` array, defaulting to the latest version — no backend changes.
**Serves:** discoverability

### Description

The What's New modal currently displays only the latest release notes entry (`RELEASE_NOTES[0]`). As more versions ship, users lose access to past entries unless they read the source code. Add a version selector or scrollable list so users can browse release notes from any version.

### Suggested Approach

- Add a version list or dropdown to the left side of the modal, populated from the `RELEASE_NOTES` array in `constants/version.ts`.
- Default selection remains the latest version.
- Selecting a past version renders that entry's sections in the existing right-side layout.
- No backend changes needed — the `RELEASE_NOTES` array already contains all entries.

---

## FR-005: Keyboard shortcut cheat sheet

**Requested:** 2026-03-12
**Status:** Open
**Priority:** Low
**Impact:** Medium

**Problem:** The app has good keyboard shortcuts (bold, italic, save, edit mode toggle) but no way to discover them without reading source code.
**Signal:** Maya Chen flagged this on 2026-03-12, comparing the gap to GitHub's `?` and Figma's `Ctrl+Shift+?` discovery overlays.
**Smallest slice:** A shortcut overlay triggered by `?` or `Cmd+/` that lists grouped shortcuts for formatting, navigation, file operations, and edit mode.
**Serves:** discoverability

### Description

Add a discoverable keyboard shortcut overlay that displays all available shortcuts. Trigger via `?` or `Cmd+/` (when not focused in an editor). Show grouped shortcuts for formatting, navigation, file operations, and edit mode actions.

---

## FR-026: Table context menu accessibility (ARIA roles and keyboard navigation)

**Requested:** 2026-03-16
**Source:** Maya Chen UX review of FR-024 implementation
**Status:** Open
**Priority:** Medium
**Impact:** Medium

**Problem:** The FR-024 table context menu works for mouse users but is invisible to screen readers and inoperable by keyboard beyond ESC to dismiss.
**Signal:** Maya Chen's UX review of the FR-024 implementation (2026-03-16).
**Smallest slice:** Add `role="menu"`/`role="menuitem"`, an `aria-label`, arrow-key navigation, focus-on-open, and completion announcements.
**Serves:** accessibility

### Description

The table context menu shipped in FR-024 lacks proper accessibility attributes and keyboard navigation. Add ARIA roles, focus management, and keyboard interaction to bring the context menu up to accessibility standards.

### Required Changes

1. Add `role="menu"` to the context menu container and `role="menuitem"` to each menu item.
2. Add `aria-label="Table actions"` to the menu container.
3. Implement arrow key navigation (Up/Down) between menu items.
4. Move focus to the first menu item when the menu opens.
5. Add screen reader announcements when table operations complete (e.g., "Row inserted below").

## FR-035: "Connect a Map" — key registry, keyref validation, and cross-file xref validation

**Requested:** 2026-04-10
**Source:** Kiryl Rusetski, with engineering scoping by Rafael Santos and UX scoping by Maya Chen
**Status:** Open
**Priority:** P2 (tracked as P2-27 in BACKLOG.md)
**Impact:** High

**Problem:** Keyref chips all show in a neutral state with no indication of whether the key resolves, and cross-file xref targets (`href="other-file.dita#id"`) are unvalidated, so this content fails silently at build time.
**Signal:** Raised by Kiryl Rusetski with a formal 2026-04-10 scoping session (Rafael Santos engineering, Maya Chen UX); the Altitude User Guide has 18 keys across 2 ditamap levels.
**Smallest slice:** A `useDitamap` hook that loads a Heretto map by UUID, builds a key registry (3 levels of `<mapref>` recursion), and drives three distinct keyref chip states plus cross-file xref checking.
**Serves:** authoring-time validation

### Description

Writers currently see all keyref chips in a neutral state with no indication of whether the key resolves. Cross-file xref targets (`href="other-file.dita#id"`) are also unvalidated. This feature delivers the full ditamap-aware validation layer.

### Scoping decisions (2026-04-10)

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
**Impact:** Medium

**Problem:** To use "Connect a Map" (FR-035) a writer must already know which ditamap defines their keys; new writers unfamiliar with the publication structure don't, and must navigate the CMS manually.
**Signal:** Emerged from the 2026-04-10 FR-035 scoping session (Kiryl Rusetski); explicitly deferred from that item.
**Smallest slice:** A picker that surfaces ditamaps whose `<topicref>` hierarchy includes the current topic, each with name, folder path, and a connect button.
**Serves:** discoverability

### Description

When a writer opens a topic from Heretto and wants to use "Connect a Map" (FR-035), they need to know which ditamap to point the tool at. A discovery tool would surface ditamaps that include the currently open topic in their `<topicref>` hierarchy.

### Proposed approach

On open or on demand, query Heretto for all ditamap files accessible to the user. For each map, check whether the current topic's UUID appears as a `<topicref href>` at any depth. Surface matching maps in a `"Connect a Map"` picker panel with the map name, folder path, and a connect button.

### Constraints

- Heretto does not expose a "find maps referencing this topic" API directly — this would require fetching and parsing all ditamaps, which may be slow.
- Could be approximated by searching within known parent folders rather than the full CMS.
- Caching parsed maps between sessions would mitigate performance concerns.

### Notes

Explicitly deferred from FR-035. Writers know which map to connect in the current workflow. Discovery becomes more valuable as the tool is adopted by writers less familiar with the publication structure.

---

## FR-037: General discoverability — empty states, onboarding hints, and feature surfacing

**Requested:** 2026-04-13
**Source:** Maya Chen (UX Engineer, product review session)
**Status:** Open
**Priority:** P3
**Impact:** High for new users, low for experienced users

**Problem:** Nothing in the editor explains itself to new writers — they don't know `Ctrl+Enter` syncs the panes, what toolbar buttons do beyond their icons, or that the inline-element `+` menu exists.
**Signal:** Raised by Maya Chen in the 2026-04-13 product review session; she frames discoverability as a perspective, not one feature.
**Smallest slice:** A one-time empty-state coach mark explaining the two-view + `Ctrl+Enter` model, persisted in `localStorage`, as the first cut of a broader discoverability set.
**Serves:** discoverability

### Description

New writers open DITA Architect and see a visual editor on the right and XML on the left, but there's no moment where the tool explains itself.

### Proposed improvements

1. **Empty state coach mark** — First time a new tab opens, show a one-time hint: `"This editor has two views — edit here or in the XML pane on the left, then press Ctrl+Enter to sync"`. Dismiss after first sync or manual close. Persist in `localStorage`.
2. **Better placeholder copy** — `"Task title"` looks like real content. `"Click to add title"` or `"Enter your task title"` signal the action more clearly.
3. **Tooltip coverage audit** — Full toolbar pass to ensure every interactive element explains itself on hover. The topic type badge (`TASK`) has no tooltip; add `"Topic type: task"`.
4. **Out-of-sync banner** (P3-26) — When XML diverges without `Ctrl+Enter`, show: `"Visual editor is out of sync — press Ctrl+Enter to refresh"`.
5. **Success feedback for Connect a Map** (P2-27) — Toast: `"Connected [MapName.ditamap] — N key definitions loaded"`. Already scoped in P2-27; flagged here as a discoverability principle.
6. **Keyboard shortcut cheat sheet** (P3-9) — Overlay via `?` or `Cmd+/`. Already backlogged as FR-005.

### Notes (Maya Chen, 2026-04-13)

Discoverability isn't one feature — it's a perspective. Each new feature should ship with its success feedback, its tooltip, and its empty state built in — not as follow-on items.

## FR-039: macOS native app — menu bar structure and item placement policy

**Requested:** 2026-05-25
**Status:** Open
**Priority:** P2
**Impact:** High

**Problem:** The native macOS app has a minimal menu bar and buries document actions in in-app dropdowns, so `⌘N`/`⌘O`/`⌘S`/`⌘W` don't work and document-level commands are undiscoverable to keyboard users.
**Signal:** Raised 2026-05-25; as the native app grows there's a real risk of duplicating commands inconsistently and breaking macOS conventions.
**Smallest slice:** Establish the menu bar structure and placement policy — add File and View menus (with `⌘` shortcuts via the JS bridge) and a rule for where future items go.
**Serves:** discoverability

### Placement Principle

| Layer | Job |
|---|---|
| **macOS menu bar** | App-wide commands, document lifecycle, keyboard shortcuts |
| **In-app toolbar/header** | Active editing controls, view state, connection status |

**Decision rule:** If an action deserves a `⌘` shortcut or applies to the document as a whole → menu bar (or both). If it is a formatting control used mid-sentence or a view toggle → toolbar. If it shows connection status as much as it provides actions → header.

### Recommended Menu Bar Structure

**DITA Architect menu (expand from current)**

| Item | Shortcut | Action |
|---|---|---|
| About DITA Architect | — | Info panel (version, build) |
| What's New... | — | Opens release notes modal via JS bridge |
| Keyboard Shortcuts... | — | Opens shortcut modal via JS bridge |
| *(separator)* | | |
| Quit DITA Architect | `⌘Q` | Existing |

**File menu (new)**

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

**View menu (new)**

| Item | Shortcut | Action |
|---|---|---|
| Toggle XML Pane | `⌘\` | Show/hide the Monaco XML panel |
| Toggle Split View | — | Cycle view modes |
| *(separator)* | | |
| Theme | submenu | Lists all app themes |
| XML Syntax Theme | submenu | Lists all XML syntax themes |

### Technical Approach

Each menu item requires two things:

1. **Swift side (`AppDelegate.swift`):** An `NSMenuItem` with a target/action selector that calls into `jsBridge`.
2. **Web app side (`dita-architect.tsx`):** A `window.__ditaApi.methodName()` function exposed to the JS context that the bridge can call via `callAsyncJavaScript`.

### In-App Header — Policy Going Forward

- The **Heretto button/dropdown** stays in the header permanently — it is a connection status indicator. Its actions should appear in the File menu too (dual-path is acceptable), but the header button is not going away.
- The **File Options dropdown** should stop growing. Any new document-level action goes in the macOS File menu, not File Options.

---

## FR-040: Element insertion mode — Before, After, Wrap in the `+` menu

**Requested:** 2026-05-25
**Status:** Open
**Priority:** P3
**Impact:** High for authoring precision; low urgency until P2-28 (the `+` menu shell) ships
**Depends on:** P2-28

**Problem:** The `+` menu inserts at a fixed position relative to the cursor, so "insert paragraph" is ambiguous about before/after and wrapping a selection in `<ph>` is impossible in a single gesture.
**Signal:** Raised 2026-05-25 referencing Heretto CMS's insertion-mode selector.
**Smallest slice:** Add a four-option mode selector (Intelligently, Before, After, Wrap) above the search field in the `+` menu, persisted in `localStorage`.
**Serves:** WYSIWYG/DITA parity

### Description

The `+` menu (P2-28) currently inserts elements at a fixed position. Add an explicit insertion mode selector at the top of the panel:

- **Intelligently** — editor decides the best placement based on DITA content model context
- **Before** — insert immediately before the current block
- **After** — insert immediately after the current block
- **Wrap** — wrap the current selection (or current block if nothing is selected) inside the new element

### Suggested Approach

- Add a `mode` selector above the search field in the `+` menu. Four options: Intelligently, Before, After, Wrap. Default: Intelligently.
- Persist the selected mode in `localStorage` under `dita-architect-insert-mode`.
- **Before / After:** use Lexical's `insertBefore` / `insertAfter` on the nearest block ancestor.
- **Wrap:** use `$wrapNodes` or `$wrapLeafNodesInElements` from `@lexical/selection`.
- **Intelligently:** current default behavior — insert at cursor, let the DITA content model filter (P2-37) handle validity.
- Disable **Wrap** when nothing is selected and the insertion target is an inline-only element.

### Scope

- Does not change the element catalog (P2-29) or content model filtering (P2-37).
- The mode selector only appears in the modal `+` menu (P2-28), not in the block-level hover button (which always inserts after).

---

## FR-044: Altitude by Geotab theme

**Requested:** 2026-06-02
**Status:** ⏸️ Parked — Rolled back 2026-07-20
**Priority:** P3
**Impact:** Medium

**Problem:** Writers who author Altitude content all day open a dark or neutral editor that doesn't feel like it belongs to the same visual world as the Altitude docs, decks, and Help Center they work in.
**Signal:** Raised by Kiryl Rusetski on 2026-06-02; brand colors sourced from `workflow-altitude-docs`.
**Smallest slice:** Add a light-based `[data-theme="altitude"]` CSS block (~30 variables) using the Altitude red accent, plus a theme-dropdown label and a theme-name constant.
**Serves:** writer experience over developer convenience

### Implementation History

**2026-07-20 — Full implementation completed and rolled back (same day):**
- All 4 files modified: `index.css` (62-variable CSS block), `Toolbar.tsx` (dropdown + description), `useEditorUi.ts` (localStorage validation), `MonacoDitaEditor.tsx` (Monaco theming)
- Tests: all 16 theme tests passing, TypeScript clean, build successful
- **Rollback reason:** Product owner visual review — the rendered palette did not meet expectations
- **Unblock condition:** Explicit re-request with either a revised color palette or approval to re-apply the current implementation
- **Do not** pick up in future sprints without explicit instruction

### Brand Color Reference

| Role | Color | Hex |
|------|-------|-----|
| Primary accent | Red | `#FF0000` |
| Digital accent (text) | Dark Red | `#DB0000` |
| Body text | Dark Gray | `#3C3C41` |
| Border / dividers | Medium Gray | `#ACAFB2` |
| Surface / canvas | Light Gray | `#F2F2F2` |
| Content background | White | `#FFFFFF` |

### Suggested CSS Variable Mapping

| Variable | Value | Notes |
|---|---|---|
| `--app-bg` | `#F2F2F2` | Light Gray chrome / canvas |
| `--app-border` | `#ACAFB2` | Medium Gray |
| `--app-text` | `#3C3C41` | Dark Gray |
| `--app-text-muted` | `#ACAFB2` | Medium Gray |
| `--editor-bg` | `#FFFFFF` | White content surface |
| `--editor-page-bg` | `#FFFFFF` | White page |
| `--editor-canvas-bg` | `#F2F2F2` | Light Gray canvas behind page |
| `--color-dita-500` | `#DB0000` | Dark Red — xref link color |
| `--editor-quote-border` | `#FF0000` | Red — note element left border |
| `--editor-context-bar` | `#DB0000` | Dark Red — context element bar |
| `--editor-result-bar` | `#FF0000` | Red — result element bar |
| `--editor-prereq-bar` | `#ACAFB2` | Medium Gray — prereq bar |
| `--editor-postreq-bar` | `#ACAFB2` | Medium Gray — postreq bar |

Page elevation follows the light theme pattern: `box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)`.

### Suggested Approach

Follow the same pattern as the Geotab theme (shipped v0.5.1): add a `[data-theme="altitude"]` block in `index.css` and add `"altitude"` to the theme selector in the toolbar. No behavioral changes. No new dependencies. Pure CSS — one new theme block (~30 variables).

## FR-047: Byte-stability test corpus + shared test editor factory

**Requested:** 2026-07-17
**Status:** Open
**Priority:** P1 — blocks BUG-04
**Impact:** High
**Model weight:** Sonnet

**Problem:** Gate 1's first bullet ("parse→serialize is byte-stable for unedited content") has no enforcement artifact — `tests/sync/round-trip.test.ts` asserts only `toContain`/`toMatch`, never byte-equality, so the serializer can delete ref-carrying notes, destroy section-nested `<dl>`s, and rewrite xref attributes on unedited round-trips while the entire suite stays green.
**Signal:** 2026-07-17 codebase review — BUG-04's S1/S3/S4 all pass CI today; the v0.8.4 test literally named "byte-stable" asserts only containment.
**Smallest slice:** One `expect(roundTrip(xml)).toBe(xml)` suite over a small corpus of real Heretto topics, with known failures marked `test.fails` keyed to BUG-04 S-IDs.
**Serves:** Round-trip fidelity (Gate 1), Heretto-safe output (Gate 2), test coverage (Gate 5)

### Deliverables

1. **`tests/sync/fixtures/`** — 8–12 real Heretto topics as fixture files: ref-carrying `<note conkeyref>`, section-nested `<dl>`, tables (CALS + simpletable), xrefs inside notes, a task with substeps and step `<info>`, mixed inline elements (`<filepath>`, `<menucascade>`, nested `<b><i>`). The Journey Definition topic (uuid `f0f00e9c-470d-4413-862a-c46f4680a3c7`) is a proven fixture — start there.
2. **`tests/sync/byte-stability.test.ts`** — for each fixture: parse → serialize with zero edits → `toBe(original)` modulo *declared* normalizations only (XML declaration, DOCTYPE). Fixtures that currently fail get `test.fails` with the BUG-04 S-ID in the test name.
3. **`tests/helpers/createTestEditor.ts`** — a single shared factory importing the production node list (export the array from `dita-architect.tsx`). Replaces the 16 hand-rolled `createEditor()` node lists across the suite.
4. **REVIEW-CRITERIA.md** — amend Gate 1 to name `tests/sync/byte-stability.test.ts` as the enforcement artifact.

### Sequencing

Must land **before** the BUG-04 sessions — the point is that all six S-bugs are red (or `test.fails`-tracked) tests before the serializer is touched. FR-048's `tests/sync/insert-section.test.ts` also depends on deliverable 3.

---

## FR-048: Test-suite triage — Gate 5 artifacts

**Requested:** 2026-07-17
**Status:** Open
**Priority:** P2
**Impact:** High
**Model weight:** Sonnet

**Problem:** The suite fails 113 tests across 18 files on code that is correct — ~21 suites are `readFileSync` source-grep tests asserting stale UI copy, release-note phrasing, and CSS strings. Meanwhile the artifacts Gate 5 names (`tests/api/`, `tests/sync/insert-section.test.ts`) were never created, and `hooks/useHerettoCms.ts` has zero executed coverage.
**Signal:** 2026-07-17 review test run: 113 failed / 1,266 passed / 3 skipped; CLAUDE.md and REVIEW-CRITERIA.md both cite suites verified not to exist.
**Smallest slice:** Delete the source-grep suites and add the jsdom `scrollTo` shim — the suite goes green and red regains meaning; the new Gate 5 suites follow.
**Serves:** Test coverage (Gate 5), run-mode parity (Gate 3), Heretto-safe output (Gate 2)

### Deliverables

1. **Delete/port the ~21 source-grep suites** (`writer-friendly-terminology`, `css-variable-consistency`, `elena-*`, `jamie-*`, `heretto-save-feedback-loop`, `shortdesc-plugin-body-elements`, etc.). Before deleting each: a 2-minute check for any genuinely behavioral assertion worth porting.
2. **`tests/setup.ts` fixes** — `Element.prototype.scrollTo` shim (unblocks the ReleaseNotesModal failure cascade); replace the stale `__APP_VERSION__ = '0.7.1'` stub with the package.json value.
3. **`tests/api/`** — real endpoint contract tests: extract the vite middleware handlers into testable functions. Cover: PUT 400-on-malformed, load-content/pending-loads queue atomicity, save contract.
4. **`tests/sync/insert-section.test.ts`** — the full block-injection pipeline: fragment → tracked green addition → Accept and Reject paths → serialize, with `TrackedDeletionNode` registered (needs FR-047's shared factory), including `replaceId` targeting and a `<fig>`/`<image>` fragment marked `test.fails` until BUG-04/S5 lands.
5. **`useHerettoCms` behavioral suite** — `renderHook` + mocked `fetch`: save → fetch-back → `compareXml` verification path, the connection indicator's `res.ok` + `content-type: application/xml` rule, error paths.

### Exit criteria

`npm test` fully green; suite count drops by ~20 files; CLAUDE.md and REVIEW-CRITERIA.md name only suites that exist.

---

## FR-049: True placeholders for template title/shortdesc (empty node + CSS decoration)

**Requested:** 2026-07-17
**Status:** Open
**Priority:** P2
**Impact:** High for first-run UX
**Model weight:** Sonnet

**Problem:** The template "placeholder" is real document text wearing a costume. `DITA_TEMPLATES` bakes `<title>Enter your task title</title>` into the topic; clicking and typing appends to the real text ("Enter your task title.qwerty"), the exact-match styling check fails, the styling drops, and the writer is left editing template prose. Untouched placeholder text also serializes and saves to Heretto verbatim.
**Signal:** Kiryl has "never been able to make it work" — 2026-07-17 screenshot showing appended text in both title and shortdesc.
**Smallest slice:** Empty `<title/>`/`<shortdesc/>` in the templates + `data-placeholder` CSS decoration on empty nodes.
**Serves:** Writer experience; Heretto-safe output (no template prose in saved topics)

### Design (Option A — placeholder-ness is a property of emptiness, not of text content)

1. **Templates** (`constants/dita.ts`): `<title></title>` and `<shortdesc></shortdesc>` — genuinely empty.
2. **Decoration** (`ShortdescPlugin.tsx`): when the node's text content is **empty**, set `data-placeholder="Enter your task title"` (topic-type-aware) and keep the placeholder CSS class; when non-empty, remove both.
3. **CSS** (`index.css`): `.dita-editor-placeholder-title::before { content: attr(data-placeholder); }` with the current muted-italic styling. Note Lexical renders a `<br>` inside empty elements — the `::before` approach works regardless (do not rely on `:empty`).
4. **Behavior achieved:** click into the field → node is actually blank, caret at position 0 → typing inserts real content and the decoration disappears the moment text exists. Delete everything → prompt returns.
5. **Round-trip safety:** verify empty `<title/>`/`<shortdesc/>` parse→serialize byte-stably (add a round-trip test; coordinate with FR-047's corpus). `<title></title>` is DTD-valid DITA.
6. **Save guard (optional but recommended):** Save to Heretto with an empty title → confirm dialog ("This topic has no title — save anyway?").
7. **Cleanup riding along:** delete the dead 19-pattern placeholder regex list in `parseXmlToLexical.ts:53-84`; unify the three drifted placeholder-string locations into the single constants module.
8. **Topic type conversion:** `convertDitaTopic` (`lib/xml-utils.ts`) currently swaps placeholder *text* between types — with empty nodes this simplifies to nothing.

### Out of scope

Rebuilding `INITIAL_DITA` (the demo widget topic) — it uses real sample prose, not placeholders. Body-level placeholders ("First step.", "Concept content goes here.") — file separately if wanted after title/shortdesc proves the pattern.

## FR-050: Native PDF export + print fidelity pass

**Requested:** 2026-07-17
**Status:** Open
**Priority:** P2
**Impact:** Medium-high
**Model weight:** Sonnet (each slice)

**Problem:** "Export as PDF" never produces a PDF. Both run modes generate an HTML page (via `lib/dita-print.ts`) and hand it to a browser print dialog. The native app's `PrintBridge` writes the HTML to a temp file and opens it in the **default browser**, where the user must press ⌘P and choose Save as PDF. The print HTML also has fidelity gaps: conkeyref variables print as literal/empty text, Heretto images emit raw relative hrefs, block content inside `<note>` and table cells flattens to run-on text, and the `@page @bottom-center` page-number footer has never appeared (Paged-Media feature Chrome/Safari don't render).
**Signal:** `WebViewController.swift`'s own comment records that `WKWebView.printOperation` "consistently produces blank pages when called from inside the app's own WKWebView shell" — the standard dedicated-print-webview workaround was never attempted. Temp `dita-print-*.html` files also accumulate uncleaned, and a Swift write failure logs to console after the JS side already showed a success toast.
**Smallest slice:** Slice 1 alone — replace the temp-file body of `PrintBridge` with a real native render.
**Serves:** Writer experience; run-mode coherence

### Slice 1 — Native rendering (Swift, own small session)

Replace the body of `PrintBridge.userContentController` (`macos/Sources/DITAArchitect/WebViewController.swift:20-31`) with:

1. A **dedicated hidden print WKWebView** hosted in an off-screen `NSWindow` — the fix for the blank-page failure (that failure came from printing the shell webview; a dedicated webview loaded via `loadHTMLString` and printed from `navigationDelegate.didFinish` after a paint delay is the standard workaround).
2. `printOperation(with: NSPrintInfo)` — **not** `createPDF()` (which produces one continuous unpaginated page). `NSPrintInfo` with `jobDisposition = .save` writes the PDF directly via the native save panel.
3. **Page-number header/footer via `NSPrintInfo`** — retiring the dead `@page @bottom-center` counter.
4. Error propagation: a failed render/save must surface to the JS side so the user never sees a false success toast.
5. Cleanup: no more temp files; delete the `NSWorkspace.open` path.

Keeps unchanged: `generatePrintHtml` + `PRINT_CSS` as the input, `derivePrintTitle`, and the browser-mode hidden-iframe path (acceptable Gate 3 asymmetry — document it in API.md/CLAUDE.md).

### Slice 2 — Print fidelity pass (`lib/dita-print.ts`)

1. **conkeyref/keyref parity:** print should at minimum render the chip label the editor shows (`[conkeyref: key/path]`), and use resolved values when a map is connected (post-P2-27).
2. **Heretto images:** in browser mode resolve through the `/heretto-api/all-files/<uuid>/content` proxy; for the native print webview, embed as base64 data URIs at generation time.
3. **Block content in `<note>` and table `entry` cells:** `serializeInlineContent` flattens nested `<p>`/lists/codeblocks — route through the block serializer. Same for block content in `<dd>`.
4. **Fonts:** Google Fonts CDN links are an offline liability. Embed the fonts or fall back to system fonts in `PRINT_CSS`.
5. **Tests:** first-ever print tests — `generatePrintHtml` unit tests over the FR-047 fixture corpus asserting the gap cases above.

### Sequencing

Slices are independent; either can ship alone. Slice 1 is Swift-heavy with a one-line TS toast change. Slice 2 is pure TS.

---

## FR-054: Heretto folder tree view in browser modal

**Requested:** 2026-07-20
**Source:** Kiryl Rusetski — pain point with existing breadcrumb drill-down navigation
**Status:** Open
**Priority:** Medium (navigation polish, not a blocker)
**Impact:** Medium (touches every "Open from Heretto" session)
**Model weight:** Sonnet

**Problem:** The Heretto file browser uses a breadcrumb-trail modal with drill-down navigation. This requires many clicks to navigate deeply nested folder structures and makes it hard to see the overall repository shape at a glance.
**Signal:** Kiryl observed that folder navigation is messy and ungainly; writers spend time drilling and re-drilling to find files.
**Smallest slice:** Replace the breadcrumb view with a lazy-expanding indented tree (single-disclosure pattern, Finder-style) inside the existing browser modal. Read-only, no drag/drop or file operations.
**Serves:** Navigation speed and file discovery

### Scope

1. **Tree rendering** — indented disclosure tree (VS Code / Finder list-view pattern) showing folder hierarchy. Each folder has a disclosure chevron; click to expand children (fetches via existing `/heretto-api/all-files/{uuid}` endpoint if not cached). 
2. **Lazy loading** — fetch folder contents only on expand (not eager full-tree load). Reuse existing `herettoFolderCache` from `useHerettoCms.ts`. 
3. **File selection** — click a topic in the tree to open it (same behavior as the current breadcrumb modal). The selected file is highlighted.
4. **Keyboard navigation** — arrow keys traverse tree; Enter opens selected file. Optional `Cmd+K` / `Ctrl+K` filter/search (same live-search progress UI as current modal).
5. **Read-only** — no drag-to-reorder, no context menus, no file moves. This is navigation only.
6. **Refresh** — optional "Refresh folders" button (reuses the existing BFS cache-bust path from search retry).
7. **Location inside the modal** — a toggle (or automatic tab switch) between "Tree" and "Search" views within the same modal. Don't create a separate sidebar; keep it contained.

### Not in scope (phase 2 or later)

- File operations (move, rename, delete)
- ditamap support — this is a CMS folder tree, not a publication structure tree (see FR-035 for ditamap integration)
- Drag-and-drop
- Persistent sidebar (would require layout changes and surface-area ADR review)

### Technical approach

- Extend `hooks/useHerettoCms.ts` with a `buildFolderTree(uuid, cache)` helper that recursively builds a tree node array `{ uuid, name, children: [] }` structure (lazy children populated on expand).
- New component `components/FolderTreeView.tsx` with recursive node rendering, state management for expanded nodes, and click/keyboard handlers.
- Wire into `HerettoBrowserModal.tsx` as an alternative view alongside search (or replace breadcrumb view entirely if feedback confirms the tree is strictly better).
- Reuse `herettoFolderCache` and the existing folder fetch logic; no new API calls.

### Success criteria

- Writers can navigate a 10-folder-deep structure in < 5 clicks (vs current 10+).
- File discovery (scanning the tree for a topic name) is faster than search for shallow structures.
- Keyboard nav feels natural (arrow keys, Enter, Escape to close).
- Search remains available and preferred for named-target discovery.

---

## FR-055: Read active tab content API endpoint

**Requested:** 2026-07-30
**Source:** Kiryl Rusetski — hit when trying to review in-editor changes via GIA
**Status:** Open
**Priority:** P2
**Impact:** High for AI-assisted workflows

**Problem:** The Swift app API has no endpoint to read the current XML content of an open tab. `POST /api/load-content` and `GET /api/tabs` both work, but there is no way to pull the content back out — making it impossible for an external tool (GIA, a script, a review workflow) to read changes the writer has made in the editor without the writer manually copying and pasting.
**Signal:** Hit directly on 2026-07-30 while GIA attempted to review formatting changes in a release notes draft loaded via `/api/load-content`. The review had to be abandoned because the edited content could not be retrieved.
**Smallest slice:** A `GET /api/tab-content?tabId=<id>` endpoint (or `GET /api/tabs/<id>/content`) that returns the current XML string of the specified tab — matching the shape of what was loaded in via `load-content`.
**Serves:** AI-assisted authoring workflows; round-trip verification

### Description

The existing `GET /api/tabs` endpoint lists open tabs with metadata (`id`, `fileName`, `dirty`, `xmlErrorCount`) but does not include content. The `POST /api/load-content` endpoint can push XML into a tab, but there is no paired read endpoint to pull the current XML back out.

This creates a one-way pipe: GIA can push a draft into DITA Architect, but after the writer edits it, GIA cannot retrieve the updated content for review, diff, or further processing without manual copy-paste.

### Proposed endpoint

```
GET /api/tab-content?tabId=<id>
```

Response:
```json
{
  "tabId": "tab-2",
  "fileName": "Latest_Release_Notes.dita",
  "xml": "<?xml version=\"1.0\"...>",
  "dirty": true
}
```

Alternatively as a path parameter: `GET /api/tabs/tab-2/content`.

### Use cases

1. **GIA formatting review** — load a draft, let the writer edit, then GIA reads back the XML to review for DITA conventions, formatting issues, or variable opportunities without the writer leaving the app.
2. **Round-trip verification** — confirm that a load-content → edit → save cycle produces the expected XML.
3. **Diff before save** — compare in-editor XML against the last-saved Heretto version before committing.

### Notes

- Should return the live Monaco/Lexical editor state, not the last-saved Heretto version.
- If no tab with the given ID exists, return a clear 404.
- Content does not need to be validated before returning — dirty/invalid XML is a valid response.

---

## FR-051: Tracked changes v2 — format marks, block-merge tracking, DITA round-trip carrier

**Requested:** 2026-07-17
**Source:** FR-046 v1 scope decisions (Kiryl) — the deliberate exclusions, filed at ship time
**Status:** Open
**Priority:** P3
**Impact:** Medium
**Model weight:** Fable (the carrier touches the round-trip contract — Gate 1)

**Problem:** FR-046 v1 blocks formatting toggles, line breaks, block merges, drag-and-drop, decorator deletion, and IME composition in suggesting mode, and marks do not survive save/reload.
**Smallest slice:** Any one of the three independently: (1) format marks, (2) block-merge tracking, (3) the persistence carrier.
**Serves:** WYSIWYG/DITA parity

### Scope

1. **Tracked formatting** — a third mark kind `format` storing the previous format flags on the affected range, with its own accept/reject semantics (accept = keep new format, strip mark; reject = restore stored flags).
2. **Block-merge tracking** — backspace at a boundary between two original blocks records a merge marker (the inverse of FR-046's split marker); reject re-splits at the recorded position.
3. **DITA round-trip carrier** — serialize marks into the already-round-tripped Heretto review PIs (`<?ezd-review-start?>` / `<?ezd-review-end?>`) so tracked changes survive save/reload; the `TrackedMark` payload (changeId/author/date) is already shaped for it. This is the piece that makes suggesting mode multi-session and unlocks reviewing in Heretto itself.
4. **Smaller residuals:** IME composition tracking (currently toast-only), rich multi-block paste (currently flattened inline), bounded `resolvedUrlCache` in the image resolver (BUG-18 residual).


---

## FR-056: API content loads flush into suggesting mode without requiring a mode toggle

**Requested:** 2026-08-04
**Source:** Kiryl — discovered during Heretto workflow (loading a DITA draft via PUT /api/tabs/:id/content while tab was in suggesting mode)
**Status:** Open
**Priority:** P2
**Impact:** High — blocks the intended AI-drafts-human-reviews workflow
**Model weight:** Sonnet

**Problem:** When a tab is in suggesting mode, `PUT /api/tabs/:id/content` lands (returns 200, "Last update: API" shows in the header) but the content does not render in the visual editor or XML pane. Switching to Editing mode and back to Suggesting does not flush the buffered content — the tab remains blank. The only recovery is to close and re-open the tab in editing mode, then switch to suggesting mode.

**Signal:** Direct reproduction during TECHWR-6335 / TECHWR-6606 Heretto content workflow — the intended pattern was: (1) load blank topic, (2) enable suggesting mode, (3) AI injects draft via API, (4) human reviews tracked changes. Step 3 silently fails.

**Root cause (suspected):** `SyncManager.tsx` suspends the XML→Lexical sync direction while `tab.documentMode === 'suggesting'` (the `suspendSync` flag). A `PUT /api/tabs/:id/content` update arrives with `lastUpdatedBy: 'api'` and `syncTrigger` incremented, but the suspended sync bridge never processes it. When the user toggles back to editing mode, the sync effect fires but the `lastUpdatedBy` source is stale or the trigger has already been consumed, so the flush doesn't happen.

**Smallest slice:** When `lastUpdatedBy === 'api'` and the update source is `PUT /api/tabs/:id/content` (not a human keystroke), the sync bridge should **not** be suspended — it should flush immediately regardless of `documentMode`. Human keystrokes in suggesting mode still go through the mark-recording path; API replacements are whole-document replacements that should reset the base document, not be buffered.

**Serves:** The core AI-drafts-human-reviews workflow. Without this, the only way to use suggesting mode for API-driven content review is the `insert-section` pending-review path, which requires the tab to already have content and cannot be used for initial topic creation.

### Acceptance criteria

1. `PUT /api/tabs/:id/content` while tab is in suggesting mode renders the new XML in both the visual editor and XML pane immediately, without requiring a mode toggle.
2. The rendered content is treated as the new base document — subsequent human edits in suggesting mode are tracked as changes against it.
3. Existing suggesting-mode behaviour for human keystrokes is unaffected.
4. Existing `suspendSync` behaviour (buffering XML-side changes while marks are being resolved) is preserved for all non-API update sources.
