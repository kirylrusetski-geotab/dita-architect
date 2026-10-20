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
| 🟢  | [FR-049](#fr-049-true-placeholders-for-template-titleshortdesc-empty-node--css-decoration)      | True placeholders for template title/shortdesc                                    | 2026-07-17 | Shipped v0.9.7            |
| 🔴  | [FR-050](#fr-050-native-pdf-export--print-fidelity-pass)                                        | Native PDF export + print fidelity pass                                           | 2026-07-17 | Open                      |
| 🔴  | [FR-051](#fr-051-tracked-changes-v2--format-marks-block-merge-tracking-dita-round-trip-carrier) | Tracked changes v2 — format marks, block-merge tracking, DITA round-trip carrier  | 2026-07-17 | Open                      |
| 🟢  | FR-052                                                                                          | Markdown rendering in release notes                                               | 2026-07-20 | Shipped v0.9.1            |
| 🟢  | FR-053                                                                                          | Release notes modal — X button replaces Close button                              | 2026-07-20 | Shipped v0.9.1            |
| 🔴  | [FR-054](#fr-054-heretto-folder-tree-view-in-browser-modal)                                   | Heretto folder tree view in browser modal                                         | 2026-07-20 | Open                      |
| 🟢  | [FR-055](#fr-055-read-active-tab-content-api-endpoint)                                        | Read active tab content API endpoint                                              | 2026-07-30 | Closed 2026-10-20 — already shipped (`GET /api/tabs/:id/content`, v0.3.3) |
| 🟢  | FR-056                                                                                          | API content loads flush into suggesting mode                                      | 2026-08-04 | Shipped v0.9.2            |
| 🟢  | FR-057                                                                                          | API whole-document replace rendered as a reviewable diff                          | 2026-08-04 | Shipped v0.9.3            |
| 🔴  | [FR-058](#fr-058-ingest-api-whole-document-replace-as-tracked-marks)                           | Ingest API whole-document replace as tracked marks                                | 2026-08-04 | Open                      |
| 🔴  | [FR-059](#fr-059-expose-readability-score-via-api)                                             | Expose readability score via API                                                  | 2026-08-12 | Open                      |
| 🔴  | [FR-060](#fr-060-native-windows-and-linux-app-shells)                                          | Native Windows and Linux app shells                                               | 2026-10-19 | Open                      |
| 🟢  | [FR-061](#fr-061-rename-the-geotab-theme-to-navy)                                              | Rename the Geotab theme to Navy                                                   | 2026-10-19 | Shipped v0.9.7 |
| 🔴  | [FR-062](#fr-062-heretto-instance-agnosticism)                                                 | Heretto instance agnosticism — no hardcoded host, root folder, or tenant data    | 2026-10-19 | Open (slices 1–2 shipped v0.9.4/v0.9.6; slice 3 discovery open) |
| 🔴  | [FR-063](#fr-063-post-sync-structural-mismatch-warning)                                        | Post-sync structural mismatch warning (links vs. xrefs)                          | 2026-10-19 | Open |

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
**Status:** Shipped (v0.9.7, 2026-10-20) — Option A as designed: empty `<title/>`/`<shortdesc/>` templates, `data-placeholder` + `::before` decoration in `ShortdescPlugin`, topic-type-aware prompts, parser detector deleted, conversion swap deleted, `INITIAL_DITA` made standalone. The optional save guard (item 6) was **not** built: `handleHerettoSave` is also the API `saveTab` path, and a confirm modal there would stall automated saves with a false success. File separately as a UI-only guard if wanted.
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
**Status:** Closed 2026-10-20 — **already shipped.** `GET /api/tabs/:id/content` has returned the live XML of any open tab since the v0.3.3 read API (API.md, commit `051c9fc`, 2026-03-17) and was verified live on 2026-10-20 (`HTTP 200`, body `{ success, httpStatus, id, fileName, herettoFile, dirty, xmlErrors, xml }`). The two failures recorded below happened because the caller requested `/api/tab-content?tabId=…`, a URL that has never existed (404), rather than the documented path. No new endpoint is needed; the fix is on the caller side (point the skill/agent at API.md). If a 404 on the documented path ever recurs, check that the native app is the instance answering on 3001 (dev server port 3000 has no tab API — ADR-007).
**Priority:** P2
**Impact:** High for AI-assisted workflows

**Problem:** The Swift app API has no endpoint to read the current XML content of an open tab. `POST /api/load-content` and `GET /api/tabs` both work, but there is no way to pull the content back out — making it impossible for an external tool (GIA, a script, a review workflow) to read changes the writer has made in the editor without the writer manually copying and pasting.
**Signal:** Hit directly on 2026-07-30 while GIA attempted to review formatting changes in a release notes draft loaded via `/api/load-content`. The review had to be abandoned because the edited content could not be retrieved. **Recurred 2026-08-27** during the Altitude release notes workflow: GIA loaded an Aug 27 release draft into `Latest_Release_Notes.dita` (`tab-3`), the writer edited it in the visual editor (removed several bullet sections, reworded others), and `GET /api/tabs` confirmed `"dirty": true` on that tab — but GIA had no way to retrieve the edited XML to sync its own copy, verify the change, or proceed with downstream steps (archiving prior content, drafting the tracking ticket). The writer had to describe the changes via a screenshot instead.
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
**Status:** Shipped (v0.9.2, 2026-08-04)
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

---

## FR-057: API whole-document replace rendered as a reviewable diff

**Requested:** 2026-08-04
**Source:** Kiryl — follow-on to FR-056; discovered that PUT gives no diff surface for reviewing AI edits
**Status:** Shipped (v0.9.3, 2026-08-04)
**Priority:** P2
**Impact:** High — "Claude rewrites a Heretto topic, human reviews the changes" is the core intended workflow; FR-056 unblocks the delivery but not the review
**Model weight:** Sonnet (Option 1 only)

**Problem:** After FR-056, `PUT /api/tabs/:id/content` in suggesting mode renders the new document as the base — `trackedChangeCount` goes to 0, the ChangeListPanel is empty, and there is no indication of what the AI changed. The intended workflow ("AI drafts, human reviews each change") requires a diff surface, not a silent replace.

The `insert-section` / `pendingReview` path (FR-045, v0.8.8) already has exactly this: a red/green Monaco diff in the XML pane with an Accept/Reject bar. But it explicitly refuses to run while the tab is in suggesting mode (`native-api-bridge.ts:114-116`), and it operates on fragments, not whole documents.

**Smallest slice — Option 1 (recommended):** Extend the existing `pendingReview` surface to whole-document PUTs.

Instead of `PUT /api/tabs/:id/content` replacing `tab.xmlContent` immediately, it populates `tab.pendingReview` (the same `{ proposedXml, baseXml, sourceLabel? }` shape already on `Tab`). The existing `ReviewBar` and `DiffViewer` machinery renders in the XML pane. Accept commits the proposed XML; Reject discards it. `computeProposedXml` in `lib/xml-insert.ts` already produces a byte-exact proposed document — the PUT can reuse it directly.

Side benefit: once a PUT populates `pendingReview` rather than overwriting, the `insert-section` guard that refuses suggesting mode becomes moot — both routes go through the same review surface, so there is nothing to guard against.

**Option 2 (richer, more expensive):** Diff old vs new XML and synthesise `TrackedTextNode` marks so the AI's changes appear inline in the visual editor with the full suggesting-mode change list. Depends on FR-051's carrier work and requires a reliable XML diff algorithm. Not the first slice.

**Serves:** The core Heretto-AI-review loop. Without this, users must mentally diff two whole documents to understand what the AI changed.

### Acceptance criteria

1. `PUT /api/tabs/:id/content` (Option 1) populates `tab.pendingReview` instead of replacing `xmlContent` when the tab has existing content (non-empty body), giving the standard red/green Monaco diff + Accept/Reject bar.
2. Accept commits the AI's version byte-for-byte (no serializer round-trip) and clears `pendingReview`.
3. Reject discards the proposed version and restores the tab to its prior state.
4. A `PUT` into a blank tab (no prior content) bypasses `pendingReview` and renders immediately — there is nothing to diff against.
5. The `insert-section` guard on suggesting mode is removed now that both routes go through `pendingReview`.

---

## FR-058: Ingest API whole-document replace as tracked marks

**Requested:** 2026-08-04
**Source:** Kiryl — follow-on to FR-057; the Monaco diff surface is all-or-nothing; the intended end state is per-change review in the visual editor
**Status:** Open
**Priority:** P2
**Impact:** High — completes the "AI drafts, human reviews each change" workflow; FR-057 is a waypoint
**Model weight:** Fable (touches round-trip contract and tracked-changes machinery simultaneously)

**Problem:** FR-057 (v0.9.3) delivers a whole-document red/green diff with Accept/Reject. The writer can see what the AI produced, but must accept or reject the entire document at once. The intended end state is:

1. AI PUTs a revised document
2. Each change appears as a tracked insertion/deletion in the visual editor (green underline / red strikethrough)
3. Writer accepts or rejects individual changes via the ChangeListPanel — same UX as human-typed suggestions

**Smallest slice:** Diff the `baseXml` against `proposedXml`, and synthesise `TrackedTextNode` marks from the diff — treating every added run as a tracked insertion and every removed run as a tracked deletion. The tab transitions to suggesting mode with the diff pre-loaded as marks, and the writer uses the existing accept/reject UI.

**Dependencies:**
- **FR-051** (tracked-changes v2 carrier): marks are currently session-only. If the writer closes the tab or saves before resolving all marks, they are lost. FR-051's round-trip carrier (`<?ezd-review-start?>`/`<?ezd-review-end?>` PIs) is needed for marks to survive across sessions. FR-058 can ship without FR-051 if the writer resolves and saves in one sitting, but the limitation must be surfaced.
- A reliable **text-level XML diff algorithm**: standard Myers/LCS diff on the serialized XML text produces false positives at tag boundaries. A structure-aware diff (walk both DOM trees, identify matching subtrees, diff leaf text runs) is the right approach. This is the hard part — it is novel engineering, not configuration of existing machinery.

**Why Fable:** The diff synthesis touches both the parser/serializer round-trip contract (marks must be stamped with correct `originMap` entries so the serializer can reconstruct them) and the `TrackedTextNode` machinery (FR-046). A single context holding both simultaneously is the risk-mitigation argument from the model-weight scale.

### Acceptance criteria

1. After a PUT is staged and the writer clicks "Accept as suggestions" (a new button alongside the existing Accept/Reject bar), the tab transitions to suggesting mode with AI changes pre-loaded as `TrackedTextNode` marks.
2. Unchanged content carries no marks — the diff is minimal, not a whole-document replacement.
3. The writer can accept/reject individual AI changes via the existing ChangeListPanel.
4. The existing "Accept all / Reject all" Accept/Reject bar from FR-045 remains as the all-or-nothing shortcut.
5. If FR-051 has not shipped, a toast warns that marks are session-only.

---

## FR-059: Expose readability score via API

**Requested:** 2026-08-12
**Source:** Kiryl — surfaced during TECHWR-6606 GO Talk topic authoring workflow
**Status:** Open
**Priority:** P2
**Impact:** Medium — enables AI agents to measure and improve content quality without requiring human review of the score in the UI
**Model weight:** Sonnet

**Problem:** DITA Architect displays a readability score (e.g. Flesch-Kincaid or equivalent) in the editor UI for the active tab. This score is not currently accessible via the HTTP API on port 3001. When an AI agent drafts or revises a topic, it cannot read the score, evaluate whether it meets a target threshold, or iterate on the content autonomously to improve it.

**Use case that triggered this:** During the TECHWR-6606 Video Coaching User Guide Q3 update workflow, a concept topic (`GO_Talk_camera_speaker_integration.dita`) was drafted by an AI agent and loaded into DITA Architect via `POST /api/load-content`. The author observed a readability score of 35.6 in the UI. The agent had no way to see this score, could not assess whether it was acceptable, and could not offer to revise the content to improve it — the human had to flag the number manually. The intended workflow is: agent drafts → agent reads score → agent revises if below threshold → human reviews final content.

**Smallest slice:** Add the readability score to the response of `GET /api/tabs/:id/content` as an additional field alongside the existing `xml` and `xmlErrors` fields. Computing it server-side (Swift) or in the JS layer and surfacing it via the JSBridge is equivalent — whichever is simpler given the existing architecture.

**Serves:** The AI-drafts-human-reviews workflow. Without API access to the readability score, quality control on AI-generated content requires manual human inspection of the UI metric on every draft iteration.

### Acceptance criteria

1. `GET /api/tabs/:id/content` includes a `readabilityScore` field (number, same scale and algorithm as the UI display) in its JSON response.
2. If the score cannot be computed (e.g. empty topic, XML errors), `readabilityScore` is `null`.
3. The score reflects the current state of the tab at the time of the request — the same value the author sees in the UI.
4. No new endpoint is required — the score is added to the existing content response.

---

## FR-060: Native Windows and Linux app shells

**Requested:** 2026-10-19
**Source:** Kiryl — filed when the GitHub repos were made public; the project is no longer macOS-only in audience
**Status:** Open
**Priority:** P3
**Impact:** Medium — the web frontend already runs anywhere Node does, but the native experience (no terminal, port-3001 tab API, `dita://` scheme, menu bar) exists only on macOS
**Model weight:** Fable (new run-mode per platform — ADR required under the architectural trigger; one context must hold the HTTP server, scheme handler, and JS bridge contracts across platforms)

**Problem:** The native app is a Swift `WKWebView` shell (`macos/`) that serves the built `dist/` over a custom `dita://` scheme, hosts the `NWListener` HTTP server on port 3001, and routes Swift → JS through `callAsyncJavaScript`. All of that is Apple-only API. On Windows and Linux the only option is the Vite dev server on port 3000, which per ADR-007 serves **only** `/api/load-content` and `/api/pending-loads` — so the tab API (`/api/status`, `/api/tabs/*`, insert-section, the FR-057 review flow) is unavailable to non-Mac users. The AI-review loop, which is the project's first moat, is therefore macOS-only today.

**Signal:** Repos made public 2026-10-19. Any non-Mac user who clones gets a strictly weaker product with no documentation of why.

**Smallest slice:** Pick one cross-platform shell and reach **native-mode parity for the tab API only** — not the menu bar, not print. Candidates, in rough order of fit:

1. **Tauri 2** (Rust shell, system WebView2 on Windows / WebKitGTK on Linux) — closest analogue to the current architecture (thin native shell, system webview, small binary). Custom URI scheme and IPC are first-class; an HTTP listener is a small Rust dependency. Would also be able to replace the Swift shell on macOS eventually, collapsing three shells into one.
2. **Electron** — heaviest, but the frontend needs zero changes and the Node side could host the port-3001 server directly; the JS bridge becomes an in-process call.
3. **A Node sidecar** (no native shell): `npm run app` starts a Node process that serves `dist/`, hosts port 3001, and opens the system browser. Cheapest; loses "feels like an app" but delivers the tab API everywhere. Could ship first as a stopgap while 1 or 2 is built.

Whichever is chosen, the existing contracts stay fixed: `window.__ditaApi` (`lib/native-api-bridge.ts`) is the only transport for the tab API (ADR-007); `/api/*` shapes in `API.md` do not change; the `dita:` protocol check that gates `__ditaApi` registration needs a platform-neutral replacement (e.g. an injected `window.__ditaNative` flag).

**Serves:** Moat 1 (AI-review loop) and moat 2 (local speed + native app) for anyone not on a Mac; also a prerequisite for the repos being meaningfully public.

**Not in scope for the first slice:** native menu bar parity (P2-39/40/41 are macOS-specific by design), FR-050 print, code signing / installers, auto-update.

### Acceptance criteria

1. An ADR records the shell choice, how `__ditaApi` is reached on each platform, and why the alternatives were rejected.
2. On Windows and Linux, a packaged or `npm`-launched app serves the built `dist/` without a Vite dev server and exposes the full port-3001 tab API with the same response shapes as macOS (`API.md` is the contract; `tests/native-api-bridge.test.ts` passes unchanged).
3. `POST /api/load-content`, `PUT /api/tabs/:id/content` (stages a review per ADR-008), and `POST /api/tabs/:id/save` work end-to-end against Heretto from a non-Mac machine, reading credentials from the user's home-directory `heretto.json`.
4. CLAUDE.md's "Two Run Modes" table and `README.md` gain the new platform rows; the macOS-only limitation is documented until parity lands.
5. The Swift shell is untouched; macOS behaviour has no regressions (`npm run build:app` and the native smoke pass still succeed).

---

## FR-061: Rename the Geotab theme to Navy

**Requested:** 2026-10-19
**Source:** Kiryl — filed when the repos went public; the theme is a colour palette, not an integration, and should not carry a company name
**Status:** Shipped (v0.9.7, 2026-10-20) — label `Navy`, tooltip `Deep blue-navy palette for low-light work`, CSS selector, Monaco key, API enum, README; `resolveStoredTheme` migrates a stored `geotab` to `navy` and rewrites localStorage; six theme test files updated, `tests/theme-migration.test.ts` added. Palette unchanged; release-note history not rewritten.
**Priority:** P3
**Impact:** Low — cosmetic, but it is user-visible in the theme dropdown, the API `theme` field, and `localStorage`
**Model weight:** Sonnet (one rename with a persisted-value migration and six test files to update)

**Problem:** The sixth app theme is called `geotab` (`[data-theme="geotab"]` in `index.css`, `{ value: 'geotab', label: 'Geotab' }` in `components/Toolbar.tsx`, description `Geotab brand colors`, Monaco `bgColors.geotab`, and the `GET /api/status` `theme` enum in `API.md`). It is a blue-navy dark palette. Now that the repository is public and the Heretto integration is instance-agnostic (FR-062), a company-named theme is the one remaining tenant-specific label in the product surface.

**Smallest slice:** Rename the theme to **Navy** everywhere it is user-visible or persisted, with a one-time migration for stored preferences:

- `index.css`: `[data-theme="geotab"]` → `[data-theme="navy"]` (palette values unchanged).
- `components/Toolbar.tsx`: `{ value: 'navy', label: 'Navy' }`. **The dropdown tooltip/description changes too:** `THEME_DESCRIPTIONS.geotab` currently reads `Geotab brand colors` (visible on hover over the `Geotab` entry); it becomes `THEME_DESCRIPTIONS.navy = 'Deep blue-navy palette for low-light work'` (keep the "what / for whom" pattern from v0.7.x). No user-visible string may keep the company name.
- `components/MonacoDitaEditor.tsx` `bgColors.navy`; `hooks/useEditorUi.ts` validator accepts `'navy'`, and **maps a stored `'geotab'` to `'navy'`** so existing users keep their theme (write the migrated value back to `localStorage`).
- `API.md` `theme` enum; `README.md` theme list.
- Tests: `tests/geotab-theme-integration.test.ts` (rename file to `navy-theme-integration.test.ts`), `tests/monaco-theme-config.test.ts`, `tests/theme-options.test.ts`, `tests/theme-validation.test.ts`, `tests/theme-descriptions-user-focused-update.test.ts`, `tests/light-theme-stone-color-conversion.test.ts` — update expectations; add one test for the `geotab → navy` localStorage migration.
- Release notes history in `constants/version.ts` is **not** rewritten — past entries keep the name they shipped with.

**Serves:** Moat-neutral hygiene for a public repo; also unblocks FR-044 (an "Altitude" theme) being re-evaluated without two company-named entries side by side.

### Acceptance criteria

1. The theme dropdown shows **Navy**, and hovering it shows `Deep blue-navy palette for low-light work` instead of `Geotab brand colors`; no user-visible string, CSS selector, or API value says `geotab`.
2. A user whose `localStorage` holds `dita-architect-theme = geotab` opens the app and gets Navy with no flash of the default theme; the stored value is rewritten to `navy`.
3. `GET /api/status` returns `theme: "navy"` when selected; `API.md` lists it.
4. All theme tests pass with the new name; the migration test is pinned.
5. The rendered palette is byte-identical to the current Geotab theme (CSS variables unchanged).

---

## FR-062: Heretto instance agnosticism

**Requested:** 2026-10-19
**Source:** Kiryl — "it can integrate with any Heretto instance provided it has the right credentials"; filed when the repos went public and a code audit showed that was not yet true
**Status:** Open — **slice 1 (configurable host) shipped v0.9.4, slice 2 (configurable root folder) shipped v0.9.6, fixture hygiene shipped v0.9.5 (all 2026-10-19)**; slice 3 (root discovery) open
**Priority:** P2
**Impact:** High for anyone outside the original tenant; without this the public repo advertises an integration that only works against one Heretto instance
**Model weight:** Sonnet (slice 2), Opus (slice 3 — touches browse/search/save navigation and the connection probe)

**Problem:** Three tenant-specific values were baked into the Heretto integration:

1. **Host.** `vite.config.ts` proxied `/heretto-api/*` to a hardcoded `https://<tenant>.heretto.com`, and `DITASchemeHandler.swift` built upstream URLs with the same literal host. **Fixed 2026-10-19:** both read `host` from `~/heretto.json`; the Settings modal has a Heretto host field; a PUT without `host` preserves the one on disk. The Vite proxy target is fixed at startup, so a host change in dev mode needs a restart (documented).
2. **Content root folder.** `constants/heretto.ts` exports `HERETTO_ROOT_UUID`, a single tenant's content-root folder UUID. It is used as the connection probe (`/heretto-api/all-files/<root>` on mount, on Test, and after saving credentials), as the starting breadcrumb for browse and search, and as the fallback ancestor when resolving image paths — about a dozen call sites in `hooks/useHerettoCms.ts` and `components/HerettoBrowserModal.tsx`. On any other instance the probe 404s, the connection indicator stays red, and the browser modal opens on a folder that does not exist.
3. **Tenant data in fixtures.** `tests/sync/fixtures/journey-definition.dita` is a byte-exact topic from the original tenant (it must stay byte-exact to be a valid Gate 1 fixture) and carries a real author email in `<prolog>`. Not a functional dependency, but it is personal data in a public repo.

**Slice 2 — configurable root (Sonnet):** ✅ **Shipped v0.9.6 (2026-10-19).** `rootUuid` in `~/heretto.json`; both `/heretto-credentials` handlers return it on GET and preserve it on a PUT that omits it; third field (`Content root folder UUID`) in the Settings modal. `HERETTO_ROOT_UUID` deleted from `constants/heretto.ts`; the value lives in `useHerettoCms` state (`herettoRootUuid`, loaded on mount) and reaches `HerettoBrowserModal` as a `rootUuid` prop. With no root configured: the mount probe is skipped, Test/Browse show `Set the Heretto content root folder UUID in Heretto Status first`, and Save reports `Credentials saved. Enter the content root folder UUID to connect.` **Probe endpoint finding (verified live 2026-10-19):** `/rest/all-files`, `/rest/files`, `/rest/root`, `/rest/whoami`, `/rest/user`, `/rest/content-root` all return HTTP 500, so there is no folder-independent probe; the probe still hits `/rest/all-files/<rootUuid>`. Three tests in `tests/heretto-verification-guards.test.tsx` (probe uses configured root; no root → no probe, disconnected; the constant no longer exists).

**Slice 3 — root discovery (Sonnet, optional):** Verified live 2026-10-19: every folder's XML carries `parent-folder-id`, and walking it upward from the content folder reaches a folder named `master` with **no** parent — the repository root. So discovery is possible from *any* known folder or file UUID (e.g. the UUID in a topic the writer already opened via `POST /api/load-content` with `herettoTargetUuid`): fetch, follow `parent-folder-id` until it is absent, then offer the `master` folder (or its `content` child) as the root. Only worth doing if slice 2 shows users struggle to find their root UUID.

**Fixture hygiene (any time, Haiku):** ✅ **Done in v0.9.5 (2026-10-19).** The author email in the Journey Definition fixture's `<prolog>` is now `author@example.com`. The byte-stability test compares the fixture against its own round-trip (`expect(roundTrip(xml)).toBe(xml)`), so no separate expected-output file needed regenerating. The fixture's value is its structure (nested `<dl>`, table, note, inline image), not its metadata.

**Serves:** The public repo's basic honesty; moat 3 (workflow glue) becomes portable to any Heretto tenant instead of one.

### Acceptance criteria

1. ✅ (shipped) `~/heretto.json` `host` drives both proxies; the Settings modal edits it; a missing host yields a clear 400 in native mode and a startup warning in dev mode; no literal Heretto hostname remains in `vite.config.ts`, `DITASchemeHandler.swift`, or the READMEs.
2. ✅ (shipped v0.9.6) `~/heretto.json` `rootUuid` drives browse/search/save navigation; `constants/heretto.ts` no longer exports a tenant UUID.
3. The connection indicator turns green against a second Heretto instance given only host, email, token (and `rootUuid` until slice 3). *Code path complete; not yet exercised against a second live tenant.*
4. ✅ (shipped v0.9.5) No real person's email address appears in any tracked file; byte-stability tests still pass.
5. ✅ (shipped v0.9.6) `README.md`, `macos/README.md`, and `CLAUDE.md` describe the full `heretto.json` shape.

---

## FR-063: Post-sync structural mismatch warning

**Requested:** 2026-10-19
**Source:** Salvaged from the deleted `bugreports/BUG-xref-not-serialized-from-visual-editor.md` (P1-13, shipped May 2026). The root-cause fix landed; the UX safety net proposed alongside it never did.
**Status:** Open
**Priority:** P3
**Impact:** Medium — turns the most dangerous serializer failure mode (silent structural drop) into a visible one
**Model weight:** Sonnet

**Problem:** When the visual editor → XML serializer drops structure, the author gets no signal. P1-13 was the canonical case: a link added in the visual editor looked like a link, the `Last update` indicator confirmed the sync ran, and the XML had no `<xref>`. The fix for that path shipped, but the class of failure remains possible for any future serializer gap (Gate 1 names it as the project's top harm). Today the only defence is tests.

**Signal:** Every serializer content-loss bug in the project's history (P1-13, BUG-04 S1–S6, the two BUG-01 exposures) was silent at the moment it happened and found later by inspection.

**Smallest slice:** After each Lexical → XML serialize, compare cheap structural counts between the Lexical tree and the resulting XML and toast on mismatch:

- `LinkNode` count vs `<xref>` count (the P1-13 case).
- `originMap` nodes stamped with an `inlineTag` vs occurrences of that tag in the output.
- Block-level counts per recognized body tag (`p`, `note`, `table`, `dl`, …) between the Lexical body and the serialized body.

Toast copy, per the P1-13 UX note: `1 link in the visual editor has no matching xref in the XML — check the source pane.` One toast per sync, throttled; never blocks the sync.

**Serves:** Gate 1 (round-trip fidelity) and Gate 2 (Heretto-safe output) by making violations visible to the author instead of only to the test suite. Writer experience: the tool stops confirming a sync that quietly lost their work.

**Not in scope:** fixing any mismatch automatically; running the check on the XML → Lexical direction (the parser direction is covered by the byte-stability corpus).

### Acceptance criteria

1. Adding a link in the visual editor and forcing a serializer path that drops it (test-only hook or fixture) produces the toast; the normal path produces none.
2. The check adds no measurable latency on the FR-047 byte-stability corpus (counts, not diffs).
3. No false positives across the byte-stability corpus and the round-trip suite (a pinned test asserts zero warnings for every fixture).
4. The warning is advisory: the sync still completes and the XML pane updates.
