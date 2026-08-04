# DITA Architect Backlog

**Last updated:** 2026-08-04 — v0.9.1 released; backlog audit corrected five stale rows. Full history in [Changelog](#changelog) at the end of this file.

This backlog has two lists — **Bugs** and **Features** — because they need different handling. Bugs arrive on their own and get cleared reactively, in batches; features are chosen deliberately and sequenced by dependency. Most rows carry a **model weight** (Haiku / Sonnet / Opus / Multi-agent, in bold) and any dependency chain.

The `P0`–`P3` numbers inside item IDs (e.g. `P2-47`) are now just **stable labels** — the old priority tier is no longer how work is scheduled, so don't read meaning into the number. New bugs are numbered `BUG-NN`; new features keep their `FR-NNN` from `feature-requests.md`.

---

## How work gets scheduled

Two lanes. Every new item lands in one after a 30-second triage — *does this block me right now?*

- **Fix Now** — the item blocks you from using the tool, or **corrupts data** (emits invalid XML that Heretto rejects or mangles). Fix it immediately, on its own, and ship a patch. This is the only "drop everything" trigger.
- **Batch** — everything else. Do **not** fix it on arrival; let it accumulate, then clear in groups:
  - **Bug sweep** — when ~4–6 small (Haiku/Sonnet) bugs pile up, fix them all in one session and ship a single patch version. (Precedent: the v0.9.3 Sonnet sweep.)
  - **Feature session** — pick one feature deliberately when you want new capability. Do Opus-sized / architectural features in their own isolated session, in dependency order.

The backlog is never "done." Success is: the Fix Now lane is empty and small bugs aren't rotting — not an empty list.

---

## Bugs

The subsection a bug sits in **is** its schedule signal — blocking bugs are fixed now, sweep-ready bugs batch into the next sweep, and larger architectural bugs get their own session. Model weight is in bold at the end of each rationale.

### 🔴 Blocking now — corrupts data or blocks use; fix immediately

— (cleared 2026-08-04: **BUG-03** shipped v0.8.5 — see Completed. The row had been left in this lane after shipping; its one unimplemented sub-item, the NWConnection idle timeout, is now tracked as **BUG-21** in Sweep-ready.)

> P1-8 through P1-18 have all shipped (v0.6.0–v0.8.2). See Completed section for details.

---

### 🟡 Sweep-ready — small and contained; batch into the next bug sweep

**5 items — at the sweep threshold (~4–6). Run a sweep before starting new features.**
(BUG-17 shipped v0.8.6; BUG-15 shipped v0.8.7; BUG-06/07/08/09/12/13/14/18 shipped v0.8.9; BUG-16 code shipped v0.9.1; BUG-10 and BUG-11 **partially** shipped v0.9.1 — remainders re-filed below as BUG-22/23/24. See Completed.)

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| BUG-22 | 8 of 11 modals still hand-roll their overlay — no focus trap, no focus restore | Bug/A11y | **Remainder of BUG-11**, re-filed 2026-08-04 after the v0.9.1 closure was found to be overstated. v0.9.1 shipped the shared `components/Modal.tsx` and migrated `ConfirmModal`, `TopicTypeModal`, and `DownloadWarningModal` — that fixed the acute defect (Escape did nothing in those three). But BUG-11's actual ask was "none of the ~10 hand-rolled overlays trap Tab or restore focus on close (WCAG 2.1.2/2.4.3) — extract one shared `Modal` and **retire the copies**." Still hand-rolling `fixed inset-0` with no trap: `ExitEditModeModal`, `HerettoBrowserModal`, `HerettoReplaceModal`, `HerettoStatusModal`, `ImportVerificationModal`, `KeyboardShortcutsModal`, `ReleaseNotesModal`, `SaveTopicModal`. Migration is mechanical — the wrapper pattern is established in the three that landed. Gate 7. **Sonnet.** |
| BUG-23 | `API.md` does not document the `httpStatus` envelope | Bug/Docs | **Remainder of BUG-10**, re-filed 2026-08-04. v0.9.1 added `httpStatus` to every `lib/native-api-bridge.ts` response and `HttpServer.swift:274` `statusCode(from:)` reads it, killing the substring-sniffing. But BUG-10's scope was "structured status envelope from the JS bridge **+ API.md alignment**", and `API.md` mentions `httpStatus` zero times — the documented contract still doesn't match the code. **Haiku.** |
| BUG-24 | No regression tests for the BUG-16 Heretto fixes | Tech debt | **Test-coverage remainder of BUG-16**, re-filed 2026-08-04. All three code fixes shipped in v0.9.1 and are correct on inspection, but none has a test: the class-attribute strip in save verification, the `content-type` guards on poll/Refresh, and the `useExternalLoad` reschedule-on-failure are all unpinned, so a regression would be silent. BUG-16's row said to land these "together with the FR-048 `useHerettoCms` behavioral tests" — that suite was never written (FR-048 shipped without it). Needs `renderHook` + mocked fetch. **Sonnet.** |
| BUG-21 | Native API server has no idle timeout on `NWConnection` | Bug | Residual from the BUG-03 security cluster: the 10 MB request size cap shipped in v0.8.5 (`HttpServer.swift:51,60`) but the paired idle timeout named in the same remediation item never did — a peer that opens a connection and sends nothing holds it open indefinitely. Low severity now that the listener is loopback-bound (v0.8.5), which is why it can wait for a sweep. Filed 2026-08-04 during backlog audit so the sub-item is not lost when the stale BUG-03 row was cleared from Blocking now. **Haiku.** |
| FR-056 | API content loads do not flush into suggesting mode (PUT /api/tabs/:id/content silently discarded while suspendSync active — content never renders; mode toggle does not recover) | Bug | Two halves, both required (verified 2026-08-04): (1) `SyncManager.tsx:120-125` buffers the update because `suspendSync` is true, and the `syncTrigger` recovery path is blocked by `if (suspendSync) return;` at `:94`; (2) **even with a `lastUpdatedBy === 'api'` bypass, the fall-through at `:127-149` re-buffers whenever the Lexical root lacks focus** — which is the actual repro — and the out-of-sync banner is suppressed by `!suspendSync` at `:157`, so it fails silently. Same focus branching is why toggling the mode doesn't recover it. Fix: call `applyPendingSync()` directly inside the suspension branch for API updates, plus a toast when unresolved marks are discarded. Note: **PUT gives no diff** — if the goal is reviewing the AI's edits, that's the proposed FR-057 follow-on. ID is `FR-` but this is a bug row; kept to preserve the `feature-requests.md` anchor. Full plan: Obsidian `geotab-work/DITA Architect/Plan — FR-056 API Content Flush in Suggesting Mode (2026-08-04).md`. See [FR-056](../future-state/feature-requests.md#fr-056-api-content-loads-flush-into-suggesting-mode-without-requiring-a-mode-toggle). **Sonnet.** |

---

### 🔵 Larger — architectural; needs its own dedicated session

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| BUG-02 | Edit Mode is architecturally unreliable — it reconstructs tracked changes by diffing a frozen plain-text snapshot against the live tree on every keystroke (diff-and-paint) instead of storing changes as data | Bug | **RESOLVED 2026-07-17 — both tracks shipped; BUG-02 closed with v0.9.0.** FR-045 (v0.8.8) took the API path off diff-and-paint; FR-046 (v0.9.0) rebuilt the human path as marks-as-data (`TrackedTextNode`, `documentMode`, suggesting-mode interception, per-change accept/reject); `EditModePlugin`/`TrackedChangesPlugin`/`TrackedDeletionNode` deleted; ADR-004 promoted to Accepted; bug report deleted per checklist. — *Original diagnosis:* Single root cause behind every reported Edit Mode failure: edits that don't show as edits (plain-text diff is blind to inline/attribute changes; node-key churn misclassifies blocks; the 50 ms API-insert race absorbs insertions into the baseline), and accepted edits not persisting (Accept re-serializes and patches against a possibly-stale `masterXml` through an origin-map-dependent serializer → duplication P2-45, XHTML corruption FR-042/P1-17). Affects manual typing and Claude-workflow API insertions alike. Not patchable incrementally — the prior insert-section/edit-mode fixes (FR-042/043, P1-16/17/18) were band-aids on this foundation and the unreliability persists. Lives across `components/EditModePlugin.tsx`, `components/TrackedChangesPlugin.tsx`, `components/TrackedDeletionNode.tsx`, `components/SectionInsertPlugin.tsx`, `lib/native-api-bridge.ts`, and the serializer. Resolution is a two-track rebuild (marks-as-data, SuperDoc pattern): **FR-045** (Monaco-diff review for API insertions — **shipped v0.8.8, 2026-07-17**; the API path no longer touches diff-and-paint) and **FR-046** (marks-as-data tracked changes in Lexical — remaining; resolves the human-edit half). Full analysis in [bugreports/BUG-edit-mode-architecture.md](../bugreports/BUG-edit-mode-architecture.md). **Fable** (re-tagged 2026-07-17, via the FR-045/FR-046 re-tags). |
| BUG-04 | Serializer loses content on unedited round-trips and drops visual edits (S1–S6 cluster, 2026-07-17 codebase review) | Bug | **RESOLVED — both sessions shipped; verified against git 2026-08-04.** Session 4A shipped in v0.8.5-era work (`d95166e`, ADR-006); **Session 4B shipped in v0.8.7** (`5c87612` "serializer fixes + mediums release") — S2 `b67262d`, S6 `5a15b0e`, M1 `e810cde`, M2 `94857a3`, M3 `2fd4833`, M4 `5630b1f`, M5 `c71dc7e`, plus 4B.4 `86ef323`. **FR-047 landed first as required** (`090d1d0`). The "Remaining: Session 4B" text below was stale. — *Original diagnosis:* Six high-severity defects sharing one root cause — two divergent body-walk implementations (the top-level walk `sync/serializeLexicalToXml.ts:1020-1143` has dl-grouping but no look-ahead; `patchBodyChildren:801-874` has look-ahead but no dl-grouping): **S1** body-level `<note conkeyref/conref>` deleted on any serialize (`:1089-1096` — mismatch path removes the DOM node and `createElementFromLexical` can't recreate a `ditaphref`); **S2** formatting-only edits (bold/italic/codeph toggles) silently discarded (`patchElementContent:332-352` compares text + link count only); **S3** `<note><p>…<xref/></p></note>` force-rewritten with zero edits — `<p>` wrapper dropped, `format="dita"` → `"html"`; **S4** section-nested `<dl>` destroyed into bare `<p>`s; **S5** insert-section-accepted `<fig>`/`<image>`/`<example>` vanish on save (`:983-984` skips `ditaopaque`/`ditaimage` assuming a master-DOM counterpart exists); **S6** table row add/delete in the visual editor never serialized (min-row walk `:612-664`, no append/remove phase unlike `patchListElement:539-554`). Mediums ride along: `noteType` never consumed on recreate; `inlineAttrs` never written anywhere so xref `scope`/`type`/`format` drop on rewrite; `stripSpuriousXmlns:947-951` corrupts codeblocks legitimately containing the XHTML namespace string; paragraph-in-dl split duplicates entries; generic `inlineTag` stamping needed for all inline elements (uicontrol/wintitle were point patches). Resolution: remediation plan Item 4, two sessions — **4A** walk consolidation (**ADR required** — round-trip contract change) + S1/S3/S4; **4B** S2/S6 + mediums (if S2 drags in marks-as-data, fold into FR-046 instead of band-aiding). FR-047 (byte-stability corpus) landed first as required. **Session 4A SHIPPED 2026-07-17 (Fable)** — ADR-006 implemented: `patchBodyChildren` is now the single body walk (dl/section grouping + look-ahead + non-recreatable node contract); S1, S3 (both variants incl. the real-topic in-`<dd>` note), S4, and M9 (identity-aware deletion guard, beyond plan scope) all fixed; byte-stability corpus 8/8, full suite zero new failures. Session 4B — S2 (formatting-only edits discarded, **Fable**), S6 (table row add/delete, Sonnet), medium batch (noteType, inlineAttrs, stripSpuriousXmlns, dl-split duplication, generic inlineTag stamping — Sonnet, M1 Opus) — **all shipped v0.8.7**, see the RESOLVED note at the head of this row. |
| BUG-05 | Port-3000 tab API is structurally non-functional; green tests cover a dead feature (2026-07-17 codebase review) | Bug | **RESOLVED 2026-07-17 — ADR-007 option A implemented (code done; version bump rides with next release).** Kiryl chose **A**: the tab API is now native-only (port 3001). Deleted `lib/editor-state-bridge.ts`, the Node-side `editorState` + `read-only-api`/`write-api` Vite plugins (and the dead `validateXmlStructure`), and the dead bridge wiring in `dita-architect.tsx`; port 3000 keeps only `/api/load-content` + `/api/pending-loads` (the endpoints with real transport). Deleted the false-green suites (`read-only-api*.test.ts`, `write-api-endpoints.test.ts`, `api-sync-integration.test.ts`, `elena-typescript-regression.test.ts`); swept API.md + CLAUDE.md; ADR-007 recorded. Build clean, suite green (58 files, 1159 tests). — *Original diagnosis:* verified live with curl that the browser realm and the Vite Node process each get a separate `editor-state-bridge.ts` instance with **no transport between them**, so `/api/status` always reported 0 tabs and every `/api/tabs/:id/*` 404'd; write routes were additionally shadowed to 405 by the `/api/tabs` read-only middleware that never called `next()`. Tests passed only because vitest ran both realms in one process — Gate 3 and Gate 5 both fooled. |

---

## Features

Chosen deliberately, one at a time, in dependency order. Take a chain from the top, or pick a standalone item for a self-contained capability. Opus-sized items get their own session.

### Inline element insertion — the biggest authoring gap

Build order: **P2-36 → P2-28 + P2-29 (same session) → P2-37 → P2-38 / P3-45**

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P2-36 | DITA 1.3 content model map | Tech debt | Build `parentElement → validChildren[]` lookup table from the DITA 1.3 spec. No UI — this becomes the source of truth for element insertion filtering (P2-28/P2-29) and future validation. Independent, can ship any time. Reused by P2-29 (catalog insertion logic), P2-37 (context-aware filtering), and potentially autocomplete. Promoted from P3-36. Sonnet-sized (downgraded from Opus 2026-07-17 — careful transcription from the DITA 1.3 spec, not architectural reasoning; thoroughness matters more than depth). |
| P2-28 | Inline element insertion menu (`+` shell) | Feature | The visual editor has no way to insert inline semantic elements (`<uicontrol>`, `<codeph>`, `<term>`, `<xref>`, etc.) — writers must switch to XML, type manually, and sync back. This blocks the tool from being used for serious authoring work where inline markup is constant. Add a `+` button in the toolbar that opens a searchable picker modal: left column shows element categories (UI Elements, Code, Cross-references, Text markup), right shows filtered results with descriptions. Arrow keys navigate, Enter inserts at cursor. Follows the modal pattern of Insert Table and Insert Link. Promoted from P3-37. **Blocks P2-29 and P3-39.** Opus-sized — requires cursor/selection preservation during sync and attribute handling for elements like `<xref>`. Note: v0.9.5 shipped a block-level `+` hover button (separate feature); this item is specifically for inline element insertion. |
| P2-29 | DITA inline element catalog with insertion logic | Feature | Populate the `+` menu (P2-28 shell) with the full DITA inline element catalog: `<uicontrol>`, `<codeph>`, `<apiname>`, `<varname>`, `<filepath>`, `<systemoutput>`, `<userinput>`, `<msgph>`, `<wintitle>`, `<term>`, `<ph>`, `<xref>`, `<cite>`, `<q>`, `<keyword>`, `<parmname>`, `<option>`, `<cmdname>`, and others. Each entry: display name, description, category, DITA element name, whether it requires attributes. On insert: wrap selection if text is selected; insert empty element and position cursor inside if no selection; open attribute sub-modal for elements requiring attributes (`<xref>`, `<image>`). Element catalog lives in a new `constants/dita-inline-elements.ts`. Promoted from P3-38. **Ship with P2-28 in the same session.** Opus-sized. |
| P2-37 | Context-aware insertion filtering for `+` menu | Feature | Wire the content model map (P2-36) to `originMap` context to filter the `+` menu (P2-28) to only valid children of the current element. `"Intelligently"` mode is default; `"All elements"` toggle available for power users. **Depends on P2-36 + P2-28.** Maya (2026-04-07): not optional — showing writers they can insert `<section>` inside a `<step>` would be worse than no menu. Promoted from P3-38. Opus-sized. |
| P2-38 | Recently used elements section in `+` menu | Polish | Surface last 3–5 inserted elements at top of `+` menu, above the full searchable list. Persist in localStorage, scoped per topic type. **Depends on P2-28 (menu shell).** Promoted from P3-39. Sonnet-sized. |
| P3-45 | Element insertion mode (Before/After/Wrap) for the `+` menu | Feature | Add an insertion mode selector to the block `+` menu (shipped in v0.9.5). Inspired by Heretto's insertion mode panel. **Before** inserts the new element before the block at the cursor; **After** inserts after (current default); **Wrap** wraps the selected block(s) in a structural parent (e.g. `<section>`, `<info>`) using Lexical `$wrapNodes`. Mode displayed as a small toggle above the search field or surfaced in the `+` button tooltip; persists to localStorage. **Depends on P2-28** (inline `+` menu shell — the same element picker should handle both block and inline contexts before the mode selector is unified). Filed from [FR-040](feature-requests.md#fr-040-element-insertion-mode-beforeafterwrap-for-the--menu). Sonnet-sized. |

### Edit-mode rebuild — tracked changes that are data, not pixels

Resolved **BUG-02** — chain complete. **FR-045 shipped v0.8.8; FR-046 shipped v0.9.0** (both 2026-07-17) — see Completed. FR-051 carries the v2 follow-ups.

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| FR-051 | Tracked changes v2: format marks, block-merge tracking, DITA round-trip carrier | Feature | The three deliberate v1 exclusions from FR-046: (1) tracked formatting toggles (a third mark kind `format` storing previous format flags — Bold/Italic currently blocked with a toast in suggesting mode); (2) block-merge tracking (backspace at a block boundary between original blocks — currently blocked); (3) persistence via the already-round-tripped Heretto review PIs (`<?ezd-review-start?>`/`<?ezd-review-end?>`) so marks survive save/reload — the `TrackedMark` payload (changeId/author/date) is already shaped for it. Also: IME composition tracking, rich multi-block paste, bounded `resolvedUrlCache` (BUG-18 residual). **Fable** (carrier touches the round-trip contract — Gate 1). |

### macOS native menu bar

Build order: **P2-39 (establishes the JS-bridge surface) → P2-41 → P2-40**

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P2-39 | macOS File menu | Native | Add a standard macOS **File** menu to `AppDelegate.swift` with: New Task `⌘N`, New Concept `⇧⌘N`, New Reference `⌥⌘N`, Open Local File `⌘O`, Close Tab `⌘W`, Save to Heretto `⌘S`, Replace in Heretto, Export as PDF, Connect to Heretto, Open from Heretto. Each item calls an action via `JSBridge` → `window.__ditaApi`. New `window.__ditaApi` methods must be exposed in `dita-architect.tsx` for any action not already in the HTTP API surface (`newTopic(type)`, `openLocalFile()`, `closeActiveTab()`, `saveActiveTab()`, `openReplaceModal()`, `openExportModal()`, `openHerettoConnectModal()`, `openHerettoBrowserModal()`). See [FR-039](feature-requests.md#fr-039-macos-native-app--menu-bar-structure-and-item-placement-policy) for full menu layout, shortcut assignments, and Swift code pattern. **Multi-agent workflow** — spans `macos/Sources/DITAArchitect/AppDelegate.swift` (Swift, menu + action selectors) and `dita-architect.tsx` + `lib/` (TypeScript, new `__ditaApi` surface). Use `agents/run.ts`. |
| P2-41 | macOS DITA Architect menu expansion | Native | Expand the DITA Architect app menu in `AppDelegate.swift` to add: About DITA Architect (version + build info alert), What's New... (calls `window.__ditaApi.openReleaseNotes()`), Keyboard Shortcuts... (calls `window.__ditaApi.openKeyboardShortcuts()`). These are single JS bridge calls — simpler than P2-39. **Depends on P2-39** (bridge pattern established, `__ditaApi` surface). Sonnet-sized. |
| P2-40 | macOS View menu | Native | Add a standard macOS **View** menu to `AppDelegate.swift` after the Edit menu: Toggle XML Pane `⌘\`, Toggle Split View, separator, Theme submenu (lists all 6 app themes), XML Syntax Theme submenu (lists all 7 syntax themes). Each item calls a JS bridge action. Theme submenus must reflect the current active theme via a checked menu item — bridge needs a `getActiveTheme()` call and a `setTheme(name)` / `setXmlTheme(name)` call. **Depends on P2-39** (JS bridge `__ditaApi` surface established). Sonnet-sized. |

### Standalone features

| ID | Item | Type | Rationale |
|----|------|------|-----------|
| P2-25 | Troubleshooting topic support | Feature | Full support for DITA troubleshooting topics across three surfaces: (1) **Parser** — `troubleshootingbody` is absent from the body selector in `parseXmlToLexical.ts:537` (`'taskbody, conbody, refbody, body'`), so topics opened from Heretto silently drop all body content; add `troubleshootingbody` and handle `cause`, `remedy`, `condition` as structural body children. (2) **Heretto import** — once parser is fixed, opening troubleshooting topics from Heretto should work correctly. (3) **New Topic modal** — add `Troubleshooting` as a fourth option alongside Task, Concept, Reference, with an appropriate XML template. Design session (2026-04-07): confirmed DA cannot create troubleshooting topics; silent body drop on Heretto open is a bug. Body element indicators (`cause`, `remedy`) to be added as a follow-on once parse support is in place. Start with the parser body-selector fix — it unblocks Heretto import immediately. **Sonnet/Opus.** |
| P2-27 | "Connect a Map" — key registry, keyref validation, and cross-file xref validation | Feature | Writers currently see all keyref chips as neutral with no validation — there is no way to know whether a key resolves without building to HTML. This item delivers the full "ditamap-aware" layer: (1) **Entry point** — `"Connect a Map"` action in the Heretto dropdown (future top-level menu bar redesign tracked separately as a design FR). (2) **Loader** — fetches and parses a ditamap from Heretto by UUID; follows `<mapref>` elements recursively up to **3 levels deep** (covers the Altitude warehouse hierarchy: root → `Altitude_variables_within_variables.ditamap` → `Altitude_variables.ditamap`); extracts all `<keydef>` and `<glossref>` elements to build a `Map<string, { href: string; mapName: string }>` key registry. Note: writers must connect the correct map for their workflow — the User Guide root map exposes 18 keys (VARS + 17 GLOS-*), while warehouse keys (`varsAltitude`, `varsAltitudeUI`, `varsAltitudeNotes`, `varsAltitudeNav`, `varsAltitudeXREF`) live in separate ditamaps not referenced from the User Guide root; writers know which map to load. (3) **Persistence** — UUID written to `localStorage` automatically on successful connect; silently restored on next launch with no toast. No close-tab modal (browsers block `beforeunload`). Manual `"Reload map"` button in Heretto dropdown; auto-refresh is a future FR. (4) **Three chip states** (UX review, Kiryl): neutral "no map" chip + tooltip `"Load a ditamap to verify this key resolves"`; yellow "unresolved" chip + tooltip `"Key not found in the loaded map"`; neutral "resolved" chip + tooltip `"Key found in [MapName.ditamap]"`. Do not collapse resolved and no-map chips into one — all three states must be visually distinct. (5) **Success feedback** — toast: `"Connected [MapName.ditamap] — N key definitions loaded"`. (6) **Failure feedback** — modal (not toast) with specific error message (network failure, bad UUID, malformed XML each get distinct language); keyrefs remain in their previous state on failure. (7) **Cross-file xref validation** — for `href` values that reference another file (e.g. `other-file.dita` or `other-file.dita#target-id`), fetch the target topic from Heretto, extract its ID set, and check that the fragment exists; broken → red wavy underline (`dita-validation-broken-xref`, already styled). Same-document `#anchor` validation already ships in v0.9.0 and is unaffected. (8) **Discovery** — writers know which map to connect; a map-discovery tool (surface ditamaps that reference the current topic) is a future FR tracked separately. |
| ~~P3-46~~ | ~~Altitude by Geotab theme~~ | ~~Feature~~ | **PARKED (2026-07-20) — Implemented but rolled back by product owner decision.** Full implementation completed: 62-variable CSS block, Toolbar dropdown entry, localStorage validation, Monaco editor theming, all tests passing. Palette applied as specified in the brand guide (`#FFFFFF` surface, `#F2F2F2` chrome, `#3C3C41` text, `#ACAFB2` borders, `#FF0000` red accent, `#DB0000` dark red). **Reason for rollback:** The rendered result did not meet visual expectations. **Unblock condition:** Explicit re-request with either a revised color palette or approval to re-apply the current one. Do not pick up in future sprints unless explicitly requested. Implementation plan and palette snapshot archived at `.claude/plans/floating-gathering-moth.md` (rollback commit: 2026-07-20). |
| ~~FR-047~~ | ~~Byte-stability test corpus + shared test editor factory~~ | Tech debt | **SHIPPED — commit `090d1d0`, before BUG-04 Session 4A as required. Verified on disk 2026-08-04: `tests/sync/byte-stability.test.ts`, `tests/sync/fixtures/`, and `tests/helpers/createTestEditor.ts` all exist; CLAUDE.md already names byte-stability as a key suite.** This row sat open with a stale "**blocks BUG-04, do first**" marker in front of work that had already landed. See Completed. — *Original scope:* Gate 1's "byte-stable for unedited content" was unenforced: `tests/sync/round-trip.test.ts` (1,522 lines, 65 tests) asserts only `toContain`/`toMatch` — never byte-equality — which is exactly why BUG-04's S1/S3/S4 pass CI today. Deliver: (1) `tests/sync/fixtures/` corpus of 8–12 real Heretto topics (ref-carrying notes, section-nested `<dl>`, tables, xrefs-in-notes, task with substeps — Journey Definition is a proven fixture); (2) `tests/sync/byte-stability.test.ts` — `expect(roundTrip(xml)).toBe(xml)` modulo declared normalizations only, current failures marked `test.fails` keyed to BUG-04 S-IDs so debt is visible and flips loudly when fixed; (3) `tests/helpers/createTestEditor.ts` importing the **production** node list exported from `dita-architect.tsx` — replaces 16 hand-rolled factories, none of which register `TrackedDeletionNode`/`ValidationDecoratorNode` (the Edit Mode path is currently unrepresentable in round-trip tests). Amend REVIEW-CRITERIA Gate 1 to name the suite. Filed from [FR-047](feature-requests.md#fr-047-byte-stability-test-corpus--shared-test-editor-factory). **Sonnet.** |
| ~~FR-048~~ | ~~Test-suite triage — make red mean something, create the Gate 5 artifacts~~ | Tech debt | **SHIPPED — commit `4b1ccc7` "FR-048: test suite triage — 0 failures from 113" (2026-07-17).** The backlog's own Last-updated line already recorded this ("113 failures → 0") while the row stayed open. Verified 2026-08-04. Note: the `useHerettoCms` behavioral suite named in the exit criteria should be re-checked when the uncommitted BUG-16 work is committed. See Completed. — *Original scope:* 113 tests failed across 18 files — ~21 suites are `readFileSync` source-grep tests asserting stale UI copy and CSS strings (fail on legitimate change, pass on real regressions — inverse tests); both Gate 5 named artifacts (`tests/api/`, `tests/sync/insert-section.test.ts`) **do not exist**; `hooks/useHerettoCms.ts` (808 lines, the CMS write path) has zero executed coverage (its "tests" mock the hook itself or test re-implemented copies). Deliver: delete/port the source-grep suites (2-minute behavioral-assertion check each before deleting); jsdom `Element.prototype.scrollTo` shim + stale `__APP_VERSION__ = '0.7.1'` stub fix in `tests/setup.ts`; real `tests/api/` against extracted vite middleware handlers (kills the duplicated `validateXmlStructure` copy drift); `tests/sync/insert-section.test.ts` (fragment → tracked addition → Accept/Reject → serialize, `replaceId`, fig/image fragment marked `test.fails` until S5 lands — needs FR-047's factory); `useHerettoCms` behavioral suite (`renderHook` + mocked fetch) landing BUG-16's fixes with their tests. Exit: `npm test` fully green. Any time after FR-047. Filed from [FR-048](feature-requests.md#fr-048-test-suite-triage--gate-5-artifacts). **Sonnet.** |
| FR-049 | True placeholders for template title/shortdesc (empty node + CSS decoration) | Feature | The template "placeholder" is real document text: `DITA_TEMPLATES` bakes `<title>Enter your task title</title>` into the topic; `ShortdescPlugin` applies the muted style only while the text exactly matches, so clicking and typing appends ("Enter your task title.qwerty") and the styling drops — no clear-on-click mechanism exists, and untouched placeholder prose saves to Heretto verbatim. **Option A design approved 2026-07-17:** templates become genuinely empty `<title/>`/`<shortdesc/>`; ShortdescPlugin sets `data-placeholder` on empty nodes; CSS `::before { content: attr(data-placeholder) }` renders the prompt; typing into a truly blank node just works. Includes: round-trip test for empty title/shortdesc, optional empty-title save confirm, deletion of the dead 19-pattern placeholder regex in `parseXmlToLexical.ts:53-84`, unification of the three drifted placeholder-string locations. Full design in [FR-049](feature-requests.md#fr-049-true-placeholders-for-template-titleshortdesc-empty-node--css-decoration). **Sonnet.** |
| FR-050 | Native PDF export + print fidelity pass | Feature | "Export as PDF" never produces a PDF — both modes generate HTML (`lib/dita-print.ts`, a second DITA→HTML serializer) and hand it to a browser print dialog; the native `PrintBridge` opens a temp file in the default browser for a manual ⌘P. **Slice 1 (Swift):** dedicated hidden print WKWebView in an off-screen NSWindow + `printOperation(with: NSPrintInfo)` with `jobDisposition = .save` — paginated, native save panel, real page-number footers (the recorded blank-page failure came from printing the *shell* webview; the dedicated-webview workaround was never tried). Not `createPDF()` (unpaginated). **Slice 2 (TS):** fidelity — conkeyref chips (currently print as literal/empty), Heretto images (raw relative hrefs, broken everywhere; base64-embed for native), block content in `<note>`/table cells/`<dd>` (currently flattened), font embedding, first print tests over the FR-047 corpus. Slices independent. Full design in [FR-050](feature-requests.md#fr-050-native-pdf-export--print-fidelity-pass). **Sonnet** each. |
| FR-054 | Heretto folder tree view in browser modal | Feature | Replace the breadcrumb-drill-down folder browser with a lazy-expanding indented tree (Finder-style) inside the modal. Scratch the pain point that navigating deeply nested folder structures requires many clicks and obscures the overall repository shape. Scope: tree rendering with disclosure on expand (fetches folder children via `/heretto-api/all-files/{uuid}` cached), file selection (opens topic), optional keyboard nav (arrow keys, Enter), read-only (no drag, no file moves). **Not in scope:** file operations, ditamap integration (see FR-035), persistent sidebar. Implementation: `buildFolderTree()` helper reusing `herettoFolderCache`, new `FolderTreeView.tsx` component, optional toggle between "Tree" and "Search" views in the existing modal. **Sonnet.** Full scope in [FR-054](feature-requests.md#fr-054-heretto-folder-tree-view-in-browser-modal). |

---

## Parked / blocked

Not scheduled. Each carries an explicit unblock condition — revisit only when that condition is met.

| ID | Item | Type | Unblock condition |
|----|------|------|-------------------|
| P3-1–P3-4 | AI extraction items — diff-review workflow, `geminiService.ts`, ConversionWizard, ChatSidebar. See [acquisition-evaluation-dita-doer.md](acquisition-evaluation-dita-doer.md). | Extraction | **LLM API key access — no timeline.** If feasible, build the backend with the LLM abstraction in place and gate the frontend behind a key-availability check; otherwise defer to a future roadmap. |
| P3-5 | [Extract `ditaUtils.ts` from V3](acquisition-evaluation-dita-doer.md) | Extraction | Pull only when the current parser/serializer needs an enhancement this file handles. Fix the stateful `g`-flag regex bug at line 188 first (`.test()` inside a loop causes alternating false negatives). |
| P3-6 | [Extract DownloadWarningModal from V1](acquisition-evaluation-dita-doer.md) | Extraction | When the export flow is built — 51-line validation gate, trivial to port. |
| P3-18 | API authentication for production | Tech debt | If/when network deployment becomes a goal. Endpoints currently expose full XML with no auth — fine for localhost dev only. |
| P3-43 | [Map discovery — surface ditamaps referencing the current topic](feature-requests.md#fr-036-map-discovery--surface-ditamaps-that-reference-the-current-topic) | Feature | After P2-27 ("Connect a Map") ships and writers report not knowing which map to connect. Requires fetching/parsing all maps (Heretto has no reverse-reference API). |
| P3-42 | Conditional text support (`@audience`, `@platform`, `@product`) | Feature | User demand for multi-variant authoring. Two-phase if prioritized: (1) visual indicator on conditionalized elements; (2) audience-filtered preview. |

*Resolved/retired: P3-30 (superseded by P2-35) and P3-31 (broken out into P2-32–P2-35). Both shipped or retired — see Completed.*

---

## Completed

### Shipped in v0.9.1 (2026-08-04)

Modal accessibility, Heretto verification/polling fixes, and the API status envelope. **This is the release that the 2026-07-20 entry mis-recorded as "v0.9.2":** the code had been written but left uncommitted and unversioned (`package.json` still read `0.9.0`, and no `0.9.1`/`0.9.2` entry existed in `RELEASE_NOTES`). Committed and versioned 2026-08-04 after a clean build and a green suite (55 files, 1042 passed, 3 skipped, 0 failed).

| ID | Item | Type | Resolution |
|----|------|------|------------|
| BUG-11 | Modal system: Escape dead in three modals — **acute half only** | Bug/A11y | **Partial.** New shared `components/Modal.tsx` owns the overlay, a document-level Escape listener, a Tab focus trap, focus restore to the previously-focused element on unmount, and `role="dialog"`/`aria-modal`/`aria-labelledby` wiring. `ConfirmModal`, `TopicTypeModal`, and `DownloadWarningModal` are now thin wrappers over it — the dead `onKeyDown` handlers on unfocused overlay divs are gone, and `Toolbar.tsx:435` Link modal has `role="dialog"`. **Not done: 8 of 11 modals still hand-roll their own overlay with no focus trap and no focus restore** — `ExitEditModeModal`, `HerettoBrowserModal`, `HerettoReplaceModal`, `HerettoStatusModal`, `ImportVerificationModal`, `KeyboardShortcutsModal`, `ReleaseNotesModal`, `SaveTopicModal`. The row's ask was to retire the copies; only 3 were migrated. Remainder stays in Sweep-ready. Gate 7. |
| BUG-16 | Heretto verification/polling gaps (three related) | Bug | **Resolved (code); no regression tests.** (1) Save verification now applies `stripHerettoClassAttrs` to both sides before `compareXml` (`useHerettoCms.ts:533`), killing the false "remote content differs" on every save of an API-loaded tab. (2) `content-type: application/xml` guards added to the remote-change poll and to Refresh — an HTML error page can no longer overwrite a tab's XML or its `savedXmlRef`. (3) `useExternalLoad.ts` reschedules instead of exiting permanently on a single non-OK poll response, so queued content is no longer silently lost. **Caveat:** none of the three has a regression test — the row asked to land these with the FR-048 `useHerettoCms` behavioral suite, which still does not exist. Tracked as **BUG-24**. |
| BUG-10 | API error-contract drift across run modes — **code half only** | Bug | **Partial.** Every `lib/native-api-bridge.ts` response now carries an explicit `httpStatus`, which `HttpServer.swift:274` `statusCode(from:)` reads directly — replacing the substring-sniffing that flipped the HTTP status whenever an error message happened to contain "not found". The first half (dead vite tab routes) was already removed by ADR-007. **Not done: the `API.md` alignment named in the same row — `API.md` mentions `httpStatus` zero times, so the documented contract still does not match the code.** Remainder stays in Sweep-ready. |
| FR-052 | Markdown rendering in release notes | Feature | `renderInlineCode` generalized to `renderMarkdown` — handles `` `code` `` and `**bold**` inline. |
| FR-053 | Release notes modal — X button replaces Close button | Polish | Header now carries an X button top-right; the full-width bottom Close button is retired. |

---

### Fixed 2026-07-23 (no version bump — standalone patch commit `520dab8`)

| ID | Item | Resolution |
|----|------|------------|
| BUG-20 | NWListener double-port bind — API server silent failure since v0.8.5 | The v0.8.5 security commit added `params.requiredLocalEndpoint = .hostPort(host:"127.0.0.1", port:port)` but left `NWListener(using:on:NWEndpoint.Port(rawValue:port)!)` unchanged — specifying the port twice causes NWListener to enter `.failed` silently. Fixed: `on: .any` so the endpoint constraint is the sole port authority. Also carries uncommitted `statusCode(from:)` helper replacing fragile `bodyStr.contains(...)` string-sniffing in all write-result handlers. Rebuilt and relaunched; `GET /api/status` responds. |

### Shipped in v0.9.0 (2026-07-17)

| ID | Item | Resolution |
|----|------|------------|
| FR-046 | Marks-as-data tracked changes in Lexical (suggesting mode) | The SuperDoc pattern on Lexical 0.16: `documentMode: 'viewing'\|'suggesting'\|'editing'` replaces the editMode boolean (also resolves P2-44's mode-toggle awkwardness); `TrackedTextNode` (TextNode subclass) carries `{changeId, kind: insert\|delete\|split, author, date}`; suggesting-mode gestures recorded at interception time (commands at CRITICAL + capture-phase beforeinput closing the typing fast path) — never derived by diffing; deletions kept-and-struck (token mode); Enter tracked via zero-width split markers; change-list side panel + per-change and all accept/reject as atomic changeId-scan mutations; reject-all restores the document byte-for-byte (pinned by test); accept-all has serialize parity with direct edits. Retired: `EditModePlugin`, `TrackedChangesPlugin`, `TrackedDeletionNode`. v1 limits (blocked with toasts, filed as FR-051): format toggles, line breaks, block merges, drag, decorator deletion, IME; marks are session-only. |
| BUG-02 | Edit Mode architecturally unreliable (diff-and-paint) | Closed by FR-045 (v0.8.8, API track) + FR-046 (v0.9.0, human track). ADR-004 promoted to Accepted. `bugreports/BUG-edit-mode-architecture.md` deleted per checklist. |

### Shipped in v0.8.9 (2026-07-17)

| ID | Item | Resolution |
|----|------|------------|
| BUG-06 | Clear Contents dead in native app | `window.confirm` (always false in WKWebView) → existing `ConfirmModal`. |
| BUG-07 | Full-doc serialize per caret move | `ignoreSelectionChange={true}` on `OnChangePlugin`. |
| BUG-08 | API updates lost during edit mode | XML→Lexical effect buffers during suspension and flushes on exit (mode flag in the dep array). |
| BUG-09 | Out-of-sync banner ref-read at render | Banner driven by `useState`. |
| BUG-12 | Shortdesc creation dead after delete | `hasShortdesc` cross-checks `$getNodeByKey` liveness. |
| BUG-13 | Document-global tracked-insert highlight | Per-tab highlight key + unmount cleanup in v0.8.9; the entire file then retired by FR-046 in v0.9.0. |
| BUG-14 | No fetch timeouts in useHerettoCms | `AbortSignal.timeout(30s)` on all 17 fetch sites (`AbortSignal.any` where a user abort already existed). |
| BUG-18 | Hygiene batch | "Last update: API" label fixed; dead `lib/dita-utils.ts` + `types/dita-block.ts` deleted; image-resolver console noise stripped; false 0.4.0 release-note claim corrected. Residual (unbounded `resolvedUrlCache`) folded into FR-051. |

*(BUG-15 — readability NaN on "constructor" — shipped earlier in v0.8.7 as Session 4B.4; row retired.)*

### Shipped in v0.8.8 (2026-07-17)

FR-045 — Monaco-diff review surface for API insertions (Item 5.3 of the remediation plan; track 1 of ADR-004).

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| FR-045 | Monaco-diff review surface for API insertions | Feature | API insertions are now a deterministic XML-level transform: new `lib/xml-insert.ts` (`computeProposedXml` — string-splice append/replace, untouched content byte-identical, validation before success), new `Tab.pendingReview` state, new `components/ReviewBar.tsx` + `DiffViewer` swap in the XML pane, Accept commits reviewed text byte-for-byte via the `lastUpdatedBy:'api'` path with a base-drift guard. Retired: `SectionInsertPlugin.tsx`, the module-level executor slot, and the 50 ms race (multi-tab collision fixed by construction). `replaceId` not found is now an error instead of a silent append. Propose-replace: `stripHerettoClassAttrs` lifted to `lib/xml-utils.ts` and applied to the `HerettoReplaceModal` diff inputs (display-only). All four expanded acceptance criteria met; BUG-04/S5 moot by design (no serializer on accept). 19 new tests in `tests/xml-insert.test.ts`. |

---

### Shipped in v0.8.6 (2026-07-17)

Save API truthfulness fix (Item 5.2 of the remediation plan).

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| BUG-17 | Save API reports success on failed Heretto saves; unknown tabId saves the wrong tab | Bug | `handleHerettoSave` now rethrows after toasting the error, so the native bridge's `saveTab` catch block fires and returns `{success:false}` to callers. Unknown tabId now throws immediately (before entering the saving state) instead of silently falling back to `activeTab`. `useHerettoCms.ts:463-466, 540-545`. |

---

### Shipped in v0.8.5 (2026-07-17)

Security hardening: loopback bind, path traversal guard, plaintext credential protection (BUG-03, Item 2 of the remediation plan).

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| BUG-03 | Native API server network-exposed + credential disclosure | Bug | (1) `HttpServer.swift` — `NWListener` now binds `127.0.0.1` via `requiredLocalEndpoint`; wildcard CORS removed; 10 MB request size cap added. (2) `DITASchemeHandler.swift` — `handleStaticFile` validates resolved path stays inside `dist/` via `standardizedFileURL` + prefix guard. (3) Credentials GET returns `{email, hasCredentials}` only — token never leaves disk. (4) `vite.config.ts` `/heretto-credentials` checks `Host` header; dev server GET also returns `{email, hasCredentials}`. (5) `Info.plist` `CFBundleShortVersionString` synced to `0.8.4`. |

---

### Shipped in v0.8.4 (2026-06-11)

Step `<info>` content renders as a read-only preview nested under each step (P2-26 Phase 2).

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-26 | `<info>` block children of `<step>` — Phase 2: full rendering | Bug | Phase 1 (affordance chips, v0.9.1.1) replaced by a real preview. New `components/DitaInfoPreviewNode.tsx` — a read-only `DecoratorNode` (`isInline()` false, `getTextContent()` `''`, `isKeyboardSelectable()` false) that renders a serializable model of the `<info>` block content (codeblock/note/list/paragraph + inline b/i/codeph/uicontrol) built by `buildInfoModel`. Parser (`case 'steps'/'ol'`) appends `$createDitaInfoPreviewNode(buildInfoModel(info))` per `:scope > info` in place of the chip. Serializer skips `dita-info-preview` in `serializeInlineContent` (alongside `tracked-deletion`), so the preview emits nothing into `<cmd>` and the original `<info>` stays byte-stable via the existing `patchListElement` path. Node registered in `dita-architect.tsx` and the test editor factory. CSS: `.dita-editor-info-preview` (+ nested codeblock/note rules), one un-themed block reusing existing vars. Two new round-trip tests: step `<info>` (codeblock + note) byte-stable; editing `<cmd>` leaves the sibling `<info>` undisturbed. Lexical's `ListItemNode` block-child limitation sidestepped by the read-only decorator. |

---

### Shipped in v0.8.3 (2026-06-11)

Definition lists render in the visual editor; two content-loss bugs the fix exposed were also resolved.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| BUG-01 | Definition lists (`<dl>`/`<dlentry>`/`<dt>`/`<dd>`) not rendered in the visual editor | Bug | Pragmatic originMap-paragraph representation (approved over custom nodes). Parser: `dl` added to the `<p>`/`<note>` `blockTags` so the non-standard `<p><dl>` wrapper routes to a new `case 'dl'`, which flattens each `<dt>` to a styled paragraph (tag `dt`) and each `<dd>`'s content to its block children, every node tagged with `dlEntryIndex` (new `NodeOrigin` fields `dlEntryIndex`/`ddFirst`). Serializer: `dl` added to `RECOGNIZED_BODY_TAGS`; `groupBodyNodesForSections` re-groups the dt/dd run into a `dl` group; new `patchDlElement` preserves the `<dl>`/`<dlentry>` skeleton and patches `<dt>`/`<dd>` in place (mirrors how `<cmd>` is patched in steps), reusing `patchBodyChildren` for `<dd>` block content; `createDlFromLexical` covers the insert-from-scratch path. CSS: `.dita-editor-dt`/`.dita-editor-dd` (one un-themed block); `dt`/`dd` added to `BODY_TAG_CLASSES` in `ShortdescPlugin`. Verified end-to-end against the real Journey Definition topic (Heretto uuid `f0f00e9c-470d-4413-862a-c46f4680a3c7`). Bug report deleted. |
| — | Inline `<ph conkeyref>`/`<uicontrol>` lost when sharing a paragraph with a block element | Bug | Exposed by BUG-01. The `<p>`/`<note>`/cell/`<dd>` block-split else branches called `parseTextNodes(el)` on an inline element, which descends into the element's *children* — so an empty `<ph conkeyref/>` yielded nothing and `<uicontrol>` lost its tag. Extracted a `parseInlineElement` helper that parses the element itself; all block-split inline sites now use it (and `parseTextNodes` is refactored to call it too). |
| — | Inline `<image>` inside a `<p>` dropped a following sibling on save | Bug | Exposed by BUG-01. An `<image>` in `<p>` was modeled as a block node, splitting the paragraph into two Lexical nodes and misaligning the dd/section child walk so the next `<p>` was deleted. `<image>` is inline in DITA `<p>`, so it was removed from the block-split `blockTags`/`ddBlockTags` and is now handled inline via `DitaPhRefNode` (round-trips as `<image href><alt>`). Standalone/`<fig>` images stay block `DitaImageNode`. |

---

### Shipped in v0.8.2 (2026-06-04)

XHTML namespace corruption fix (Blocking now lane cleared) + Sonnet sweep: P2-44, P2-45, P2-46, P2-47.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-17 | "+" block tool serializes XHTML namespace instead of DITA, corrupting topics | Bug | Two-layer fix. (1) Defensive net: `stripSpuriousXmlns` in `sync/serializeLexicalToXml.ts` now also strips `xmlns="http://www.w3.org/1999/xhtml"` in addition to `xmlns=""`, so the serializer can never emit the XHTML namespace regardless of trigger path. (2) Root cause: `constants/insertable-elements.ts` `INSERTABLE_ELEMENTS[].insert()` now stamps `originMap` entries for every synchronously-created node (`p`, `note`, `codeblock`, `image`, `xref`-wrapper); lists and tables route correctly by Lexical node type and don't need a stamp. `InsertableElement.insert` signature extended with `originMap: NodeOriginMapType`; `components/InsertElementPlugin.tsx` pulls `nodeOriginMap` via `useSyncContext()` (same pattern as `ShortdescPlugin`) and passes it at the call site. Added 4 new round-trip tests. |
| P1-18 | `PUT /api/tabs/:id/content` triggers XHTML xmlns injection on serialization round-trip | Bug | Covered by the defensive net in P1-17 fix (1): `parseXmlToLexical` already re-stamps all recognized elements on every API re-parse; the residual xmlns leak was purely the serializer's fallback behavior, which the broadened `stripSpuriousXmlns` eliminates. No change to the API round-trip or parse path. Added 1 new round-trip test (parse updated XML with a new `<note type="tip">`, serialize, assert no xmlns). |
| P2-44 | Pencil button does not exit edit mode | Bug | **Already implemented — verified, not a regression.** `dita-architect.tsx:1006-1012` already has the correct branch: `if (tab.editMode) setExitEditModeConfirmTabId(tab.id)` else increment enter trigger. `ExitEditModeModal` (Accept all / Reject all / Cancel) is rendered at lines 546-558 and wired to `editModeAcceptTrigger`/`editModeRejectTrigger`. The backlog row described the old broken behavior that was fixed when P3-52 shipped; the fix shipped untracked at the same time. Confirmed by code read — no code change needed. |
| P2-45 | `PUT /api/tabs/:id/content` appends content instead of replacing | Bug | Root cause confirmed by unit test: the serializer's DOM walk exited early once all Lexical nodes were matched (`break` at `lexGroupIdx >= groupedNodes.length`), leaving unmatched recognized body elements from the old master XML in the output. Fix: track which recognized DOM children were consumed (`consumedDomChildren` Set), then remove any remaining recognized children after the walk in `sync/serializeLexicalToXml.ts`. Added 1 round-trip test (3-paragraph topic replaced by a 1-note topic via PUT against stale master — output must contain only the note). |
| P2-46 | `<xref>` inside `<note><p>` not rendered as a link | Bug | Root cause: `case 'note'` in `sync/parseXmlToLexical.ts` called `parseTextNodes(xmlNode)` directly without block-children detection, so `<p>` inside a note was treated as an unknown inline element and flattened to plain text, destroying any `<xref>` inside it. Fix: before the `parseTextNodes` call, check whether the note's direct children include block-level elements (`p`, `ul`, `ol`, etc.); if so, iterate each block child and call `parseTextNodes` on it, appending its inline content (including `LinkNode`s from `<xref>`) directly into the `QuoteNode`. Round-trip note: `<note><p>x</p></note>` serializes to `<note>x</note>` (inline content, no `<p>` wrapper) — both are valid DITA; Heretto re-wraps on ingest. Added 1 round-trip test (xref-in-note parses as `LinkNode`, serializes back with `<xref href=...>`). |
| P2-47 | Table parser trusts `cols` attribute instead of actual entry count | Bug | **Already handled — regression test added.** The parser (`parseXmlToLexical.ts:392-436`) builds one `TableCellNode` per `<entry>` element found — it reads neither `cols` nor `<colspec>`. A `<tgroup cols="1">` with 2 entries/row already yields a 2-column Lexical table. The serializer derives `colCount` from actual cells and regenerates `colspec`, so round-trip is self-correcting. Added 1 regression test: `cols="1"`, 2 `<colspec>`, 2 entries/row → both cells round-trip and serialized output has `cols="2"`. |

---

### Shipped in v0.8.1 (2026-05-28)

Insert-section accept-path fix, `load-content` Heretto association, block-level injection, and pencil tooltip fix.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-16 | `insert-section` accepted tracked changes serialize to XHTML instead of DITA XML | Bug | Root cause: `parseSectionFragment` created Lexical TextNodes for DITA inline elements (`<uicontrol>`, `<wintitle>`, `<codeph>`, `<ph conkeyref>`) without `originMap` entries, so `serializeLexicalToXml` fell back to generic bold/italic serialization emitting `<b>`, `<i>`, and the XHTML namespace on the wrapping section. Fix: `traverseXmlElement` in `sync/parseXmlToLexical.ts` now stamps `{ inlineTag, inlineAttrs }` into `originMap` for every DITA inline element at parse time; the serializer's existing `inlineTag` branch handles output correctly. Added 4 tests in `tests/sync/round-trip.test.ts` covering `<uicontrol>`, `<wintitle>`, `<ph conkeyref>`, and XHTML-namespace absence. |
| P2-42 | `POST /api/load-content` — associate tab with Heretto file via `herettoTargetUuid` | Feature | `hooks/useExternalLoad.ts` and `lib/native-api-bridge.ts` now populate `tab.herettoFile = { uuid, name: fileName, path: fileName }`, `tab.herettoLastSaved`, and `tab.herettoJustLoaded` when `herettoTargetUuid` is present — matching the field set from the "open from Heretto" flow. The Save to Heretto button now appears immediately after the tab opens. |
| P2-43 | `insert-section` — block-level injection and `replaceId` for flat `<conbody>` topics | Feature | `parseSectionFragment` generalized to `parseBlockFragment` accepting any block-level DITA element (`<p>`, `<ul>`, `<ol>`, `<note>`, `<codeblock>`, `<table>`, `<simpletable>`, `<fig>`, `<image>`, `<dl>`, `<example>`, `<prereq>`, `<context>`, `<result>`, `<postreq>`, `<steps>`). `<section>` children are unwrapped for backward compatibility. Optional `replaceId` targets a DITA element by `id` attribute and shows the replacement as tracked changes (old red, new green). `HttpServer.swift` forwards `replaceId` from the JSON body to the JS bridge. `findLexicalKeyByXmlId` helper walks `originMap` to resolve the target node. `API.md` updated with the full block-element allowlist and `replaceId` parameter docs. Added 7 tests. |
| P3-52 | Pencil icon tooltip stuck on "Enter Edit Mode" when in edit mode | Bug/Polish | `Toolbar.tsx:271` static string replaced with ternary on `editMode` prop: `"Exit Edit Mode"` when in edit mode, `"Enter Edit Mode"` otherwise. Same ternary on `aria-label`. Verification confirmed that clicking the pencil while in edit mode does not actually exit — logged as P2-44. |

---

### Shipped in v0.8.0 (2026-05-25)

Placeholder Lexical format inheritance fix.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-15 | Typed text inherits muted italic style when editing inside a placeholder field | Bug | Placeholder `TextNode`s in `sync/parseXmlToLexical.ts` were created with `setFormat('italic')` and `setStyle('color: var(--app-text-muted)')`. Lexical's format inheritance mechanism propagates those properties to characters typed at the cursor position, making new text appear muted and italic. Fix: removed both calls — placeholder `TextNode`s are now plain nodes. Visual appearance (muted, italic) is entirely handled by CSS classes on the parent element via `ShortdescPlugin` (`dita-editor-placeholder-title` / `dita-editor-placeholder-shortdesc`), which do not touch Lexical's format state. Bug report: `bugreports/BUG-placeholder-text-color-on-edit.md`. |

---

### Shipped in v0.7.3 (2026-05-25)

Discoverability sweep — keyboard shortcut cheat sheet, What's New version browser, first-run coach mark, action-oriented placeholder copy, theme description refresh, tooltip font bump.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P3-9 | Keyboard shortcut cheat sheet | Feature | `?` or `Cmd+/` / `Ctrl+/` opens a modal listing every shortcut grouped by category (Sync, XML editor, Modals). Also reachable from File Options → "Keyboard shortcuts". New `components/KeyboardShortcutsModal.tsx` + `constants/keyboard-shortcuts.ts` single-source registry. |
| P3-8 | Release notes version browser in What's New modal | Feature | Left-rail version selector lets you flip between every shipped version. Default selection: latest release. Existing one-shot "show on version bump" behavior unchanged. |
| P3-44 | General discoverability (coach mark + placeholder copy + tooltip audit) | Polish | Three sub-items shipped: (1) First-run coach mark on first tab open — `"Edit here or in the XML pane — press Ctrl+Enter to sync"`, dismissed on first sync or close, persisted via `dita-architect-coach-sync-hint` localStorage key; (2) Placeholder copy updated from `"Task title"` → `"Enter your task title"` (and equivalents for Concept/Reference) with backward-compatible detection of old strings; (3) Tooltip coverage audit — verified all interactive toolbar elements have tooltips. |
| P3-7 | Geotab theme session action items | Polish | Theme descriptions tightened to consistent "what / for whom" pattern. Tooltip font size bumped from 10px to 11px. Visual verification of Geotab theme across editor, toolbar, and modals. |

---

### Shipped in v0.7.2 (2026-05-21)

Page-canvas layout, redesigned body element indicators, shortdesc placeholder, block insertion `+` button, and theme contrast fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P3-12 | Page-view layout for the visual editor | Polish | Editor surface now sits on a visible "page" that floats on a contrasting "canvas" background. Light theme gets a soft drop shadow; dark themes get a clean border. Canvas and page colors are tuned per theme so the two surfaces are always legible against each other. |
| P2-35 | Always-visible border box with top-left label chip for semantic task elements | Feature | PREREQUISITE / CONTEXT / RESULT / POSTREQ sections now render as always-visible full bordered boxes. Hovering a section lights up the left border in its accent color and fades in a small label chip at the top left. Border space is always reserved — no layout shift on hover. |
| — | Shortdesc placeholder | Polish | The floating "SHORT DESCRIPTION" label is gone. When the shortdesc field is empty, a soft italic placeholder appears exactly where you'd start typing and disappears the moment you do. |
| — | Block `+` button for content insertion | Feature | Hovering any block in the visual editor reveals a `+` button in the left margin (canvas gutter). Click to open a searchable element menu: Paragraph, Bulleted list, Numbered list, Note, Code block, Table, Image, Link. Type to filter, press Enter or click to insert. Table and Link open their existing dialogs; everything else inserts in place. |
| — | Dark theme contrast refinement | Polish | Page and canvas backgrounds recalibrated — previously only five lightness steps apart. Both values now match the separation established in other dark themes. |
| — | Geotab theme canvas fix | Polish | Canvas background was near pure black, disconnecting the page from app chrome. Both values anchored to the blue-navy palette the theme is built around. |

---

### Shipped in v0.7.1 (2026-05-20)

Resizable split pane, word wrap toggle, smarter sync hint, Heretto folder loading feedback, readability score tooltip.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| — | Resizable split pane | Polish | Drag the handle between visual and XML editors to adjust the split (clamped 20–80%). Chosen width persists across sessions. Previously fixed at 50/50. |
| — | Word wrap toggle in XML editor | Polish | New toolbar button wraps long lines to the pane width. Preference persists. |
| — | Sync hint only when editors diverge | Polish | "Press Ctrl+Enter to sync" now appears only after an edit creates divergence and disappears the moment you sync. Was permanently visible before. |
| — | Heretto browser loading feedback | Polish | Folder browser shows "Loading your Heretto folders…" instead of a bare spinner; search shows live progress ("Searching… 12 / 34 folders") with a retry option after 3 seconds. |
| — | Readability score tooltip | Polish | Hovering the score in the status bar now shows the human label and a note that 60–70 is the right range for technical documentation. |
| P3-26 | Out-of-sync indicator for visual editor | Feature | `SyncManager.tsx` now shows "Visual editor is out of sync — press Ctrl+Enter to refresh" only after an edit creates divergence between panes; disappears on sync. Was permanently visible before — this matches the release note "Sync hint only appears when editors diverge". |
| P3-27 | "Loaded from Heretto" status + compareXml polling | Bug/Polish | `herettoJustLoaded` field added to Tab type; `useHerettoCms.ts` sets it on open and clears it on first edit or save. Polling now uses `compareXml` instead of strict string equality, eliminating the false-positive "Updated in Heretto" on freshly opened topics. |

---

### Shipped in v0.7.0 (2026-05-12)

Print / Export PDF and z-index fix for dropdowns behind collapsed XML pane.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| — | Print / Export PDF | Feature | File Options → "Print / Export PDF" opens a clean print window (A4 layout, Inter body, JetBrains Mono code, colored note borders, CALS/simpletable support, definition lists, figures, inline elements). Previous browser File > Print rasterized the live editor. Pop-up blocker shows an actionable toast instead of silent failure. |
| — | Heretto dropdown z-index fix | Bug | File Options and Heretto dropdowns were clipped by the collapsed XML pane overlay. Top bar bumped to z-index 30. |

---

### Shipped in v0.6.2 (2026-04-14)

Sonnet sweep: xref base styling, placeholder visual treatment, and Heretto reliability fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-30 | Base visual styling for xrefs in the visual editor | Bug/Polish | Added `text-decoration: underline` to `.dita-editor-text-link` so xrefs are always visually distinct from plain prose. `InlineValidationPlugin` was already stamping `title` attributes on all `LinkNode` DOM elements (edit-mode tooltip on valid links, error message on broken/unresolved). |
| P2-31 | Template placeholder visual treatment + stale text on topic type conversion | Polish | (1) `ShortdescPlugin` now detects whether the H1 title or shortdesc text matches a DITA template placeholder (from new `DITA_PLACEHOLDER_TITLES` / `DITA_PLACEHOLDER_SHORTDESCS` constants in `constants/dita.ts`) and applies `dita-editor-placeholder-title` or `dita-editor-placeholder-shortdesc` CSS class. Placeholder titles render muted italic; placeholder shortdescs render at reduced opacity. (2) `convertDitaTopic` in `lib/xml-utils.ts` now swaps `<title>` and `<shortdesc>` content when converting topic type, if the text exactly matches the source type's placeholder — `"Task title"` no longer survives a task→concept conversion unchanged. Writer-edited content is never touched. |
| P3-40 | Heretto connection check false positive and HTML-body error copy | Bug/Polish | (1) Connection check (`useHerettoCms.ts`) now verifies `content-type: application/xml` in addition to `res.ok`. An HTTP 200 with an HTML body (the SPA fallback when the proxy is unregistered) no longer sets the green "Connected" indicator. Applied to mount check, `testHerettoConnection`, and post-credential-save recheck. (2) `handleHerettoSave` error body parsing now detects HTML responses (`startsWith('<!DOCTYPE')` or `startsWith('<html')`) and substitutes an actionable message instead of dumping raw HTML into the toast. |

---

### Shipped in v0.6.0 (2026-04-14)

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
| P2-24 | Normalize separators in "Open from Heretto" search | Bug/Polish | `useHerettoCms.ts:255` now normalizes both query and filename with `.replace(/[\s_-]+/g, ' ')` before `.includes()`. Searching "traffic analysis" now matches `setting-up-traffic-analysis.dita`. |
| P2-26 Phase 1 | `<info>` affordance chips in steps | Bug | `sync/parseXmlToLexical.ts:263` adds inline chips (`[codeblock]`, `[p]`, `[info: N elements]`) after `<cmd>` text for any `<info>` block children — invisible to the serializer, purely visual. Closes the "is my content there?" gap without the Phase 2 architectural rework. |
| P3-28 | Larger Replace in Heretto preview modal with fluid diff height | Polish | Modal width changed from `w-[600px]` to `w-[900px] max-w-[90vw]`. DiffViewer changed from `height={400}` to `flex-1 min-h-0`, filling available vertical space within the existing `max-h-[90vh]` modal. |
| P3-29 | User feedback for prevented table operations | Polish | Deleting the last row now toasts `"Cannot delete the last row — tables must have at least one row"`. Deleting the last column toasts the equivalent message. Delete menu items gain explanatory hover tooltips. |

---

### Shipped in v0.5.1 (2026-04-07)

xref serialization fix and Replace verification fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-13 | [xref not serialized when link added in visual editor](../bugreports/BUG-xref-not-serialized-from-visual-editor.md) | Bug | `patchElementContent` in `serializeLexicalToXml.ts` was returning early when `domText === lexText`, bypassing serialization even when the Lexical node had a `LinkNode` with no matching `<xref>` in the DOM. Fix: before the early return, compare the count of `link`-type children in Lexical against `<xref>` elements in the DOM — a mismatch forces `replaceElementContent`. Added a creation-from-scratch test to `tests/sync/round-trip.test.ts`: parses plain-text XML, injects a `LinkNode` via `editor.update({ discrete: true })`, asserts `<xref href="..." format="html">` in the serialized output. |
| P1-14 | Replace in Heretto: false negative on verification due to Heretto `class` attribute injection | Bug | Three fixes: (1) `handleHerettoReplace` in `hooks/useHerettoCms.ts` now strips Heretto-injected DITA specialization `class` attributes from both sides before calling `compareXml` — `xml.replace(/\s+class="[^"]*"/g, '')` applied to `content` and `remote` before comparison. Heretto adds these on every element on ingest, causing a false `'different'` result even when content is correct. Error message updated to `"Upload succeeded, but Heretto reformatted the content. Check the topic in Heretto to confirm your changes are there."` (2) `HerettoReplaceModal.tsx` verifying row: icon now correctly shows `<AlertTriangle>` (amber) on `success === false` instead of `<CheckCircle>` (green) — the `!== null` condition was showing two green rows followed by a red error, which was contradictory. `"done"` text also restricted to `success === true`. (3) Action buttons: `Cancel + Retry` replaced with a single `Done` button on failure — retrying cannot fix a Heretto reformatting difference. |

---

### Shipped in v0.5.0 (2026-03-27)

Inline validation hints and Heretto image infrastructure (partial).

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-6 | [Inline validation hints in visual editor](feature-requests.md#fr-004-inline-validation-hints-in-the-visual-editor) | Feature | Red underlines on broken `xref` targets, yellow highlights on unresolved keyrefs. Brings validation into the authoring moment instead of waiting for build time. |
| P2-23 | Render Heretto images in the visual editor | Feature | Four bugs found and fixed across two commits: (1) wrong API endpoint (`/folders/{uuid}/items` → `/all-files/{uuid}`); (2) off-by-one in `parentFolderUuid` index; (3) stale closure capturing wrong breadcrumbs in `handleImportContinue` — breadcrumbs now snapshotted into `ImportVerificationState` at file-selection time; (4) search results missing ancestor UUIDs — `ancestorUuids: string[]` added to `HerettoSearchResult` and tracked during BFS traversal. Bug report: `bugreports/BUG-heretto-image-resolution-fails.md` (status: Resolved). |

---

### Shipped in v0.4.0 (2026-03-17)

Insert Table, write API, keyboard navigation, parser fix, and tooltip fix.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P0-3 | Task-level title and shortdesc not rendered in visual editor | Bug | Replaced broad `doc.querySelector('title')` with scoped `topicElement.querySelector(':scope > title')` to ensure topic-level title and shortdesc are selected, not nested section titles. 7 tests covering all DITA topic types with sections. |
| P1-12 | `Expand XML editor` tooltip covers header status text | Bug | Replaced native `title` attribute with `<Tooltip>` component using `placement="left"`. Added `left` as a new Tooltip placement option. Also added `aria-label` for screen reader support. |
| P2-21 | Insert Table toolbar action | Feature | Toolbar button opens modal with rows (1-50), columns (1-10), and header row checkbox. Generates DITA CALS `<table>` with sequential colspec elements. Defaults to 3×3 with header. |
| P2-22 | Write API endpoints for Claude Code integration | Feature | Four endpoints: `PUT /api/tabs/:id/content` (update XML), `POST /api/tabs/:id/save` (save to Heretto), `POST /api/tabs/:id/format` (beautify XML), `GET /api/tabs/:id/stats` (word count, readability). Bidirectional sync extended with `'api'` update source. |
| P3-19 | Insert Table modal keyboard navigation | Accessibility | Enter key creates table, Escape key closes modal. Helper text "Press Enter to create, Escape to cancel." follows link modal pattern. |
| P3-22 | Insert Table modal ARIA dialog attributes | Accessibility | Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="table-modal-title"`. Shipped alongside P2-21 but untracked. |
| P3-24 | Insert Table modal aria-labels on number inputs | Accessibility | Row input has `aria-label="Number of rows"` + `aria-describedby="rows-help-text"`; column input has `aria-label="Number of columns"` + `aria-describedby="columns-help-text"`. Shipped alongside P2-21 but untracked. |

---

### Shipped in v0.3.3 (2026-03-17)

Table context menu and read-only API endpoints.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-19 | Table context menu (insert/delete rows and columns) | Feature | Right-click context menu on table cells with toggle header row, cell merge (CALS only), and cell unmerge. Conservative simpletable detection prevents invalid DITA spanning attributes. Menu height increased to 320px. Passed code review after retry (header/body boundary validation added). Build clean, 39/42 tests passing. |
| P3-13 | Table context menu accessibility (ARIA + keyboard navigation) | Accessibility | `TableActionMenuPlugin.tsx` has `role="menu"`, `role="menuitem"`, `aria-disabled`, arrow/Home/End/Enter/Space/Escape navigation, auto-focus first item on open, focus restoration on close. Shipped alongside P2-19 but untracked. |
| P2-20 | Read-only API endpoints for Claude Code integration | Feature | Three endpoints: `GET /api/status` (version, Heretto connection, tab count, active tab, theme), `GET /api/tabs` (list open tabs with metadata), `GET /api/tabs/:id/content` (full DITA XML + validation errors). State bridge via `lib/editor-state-bridge.ts` syncs React state to Vite server. 25 tests. Passed code review after TypeScript strict mode fix. |

---

### Shipped in v0.3.2 (2026-03-16)

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

### Shipped in v0.3.1 (2026-03-13)

Replace in Heretto workflow + accessibility + toast copy.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-2 | Replace in Heretto workflow | Feature | Three-step replace wizard (HerettoReplaceModal), Monaco diff viewer (DiffViewer), persistent context bar (HerettoReplaceBar), handleHerettoReplace in useHerettoCms. Full draft-to-publish workflow with post-replace tab state transition. |
| P2-4 | Accessibility fixes on Heretto modals | Fix | htmlFor/id pairing on HerettoStatusModal, aria-live on search progress, aria-labels on toolbar buttons, autoFocus on all modals, aria-labelledby on ImportVerificationModal, aria-labels on HerettoReplaceBar buttons. |
| P2-14 | Refine external load toast copy | Polish | Changed "Loaded {fileName} from external tool" to "Imported {fileName}" in useExternalLoad.ts. |

---

### Shipped in v0.3.0 (2026-03-13)

External content loading API — replaces cli-chrome Monaco injection.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-1 | API endpoint for external content loading | Feature | Vite plugin with `POST /api/load-content` and `GET /api/pending-loads`. New `useExternalLoad` hook polls, validates, beautifies, and creates tabs. `herettoReplaceTarget` field added to Tab type for P2-2. |

---

### Shipped in v0.2.2 (2026-03-13)

Accessibility and empty states batch.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-5 | Empty states for Heretto file browser | Feature | Added "No topics in this folder" message with optional "Create new topic" button. Proper modal sequencing from browser to new topic flow. |
| P2-12 | Add aria-label to Format XML button | Fix | Added `aria-label="Format XML"` to format button in `MonacoDitaEditor.tsx`. |
| P2-13 | Improve Format XML error toast specificity | Polish | Error toast updated to "Failed to format XML: Check for syntax errors". |

---

### Shipped in v0.2.1 (2026-03-13)

Small polish batch: beautify button + UX copy fixes.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P2-3 | Beautify button | Feature | Added Format XML button (Code2 icon) to Monaco editor toolbar with Shift+Alt+F shortcut. Toast on success/failure. |
| P2-10 | Rename "Post-Requisite" to "Postrequisites" | Fix | Updated `::after` content in `index.css` to match DITA standard terminology. |
| P2-11 | Improve theme descriptions | Polish | Updated `THEME_DESCRIPTIONS` in `Toolbar.tsx` to user-focused copy across all 6 themes. |

---

### Shipped in v0.2.0 (2026-03-13)

Visual polish batch: tooltip fix + body element indicators + light theme warmth.

| Former ID | Item | Type | Resolution |
|-----------|------|------|------------|
| P1-8 | Theme dropdown tooltip blocks next option | Bug | Added `placement` prop to `Tooltip.tsx` (`'bottom'` default, `'right'` option). Theme dropdown tooltips use `placement="right"`. |
| P2-7 | Hover element labels in visual editor | Feature | Extended `ShortdescPlugin.tsx` mutation listener with `BODY_TAG_CLASSES` map covering `shortdesc`, `prereq`, `context`, `result`, `postreq`. Hover-triggered `::after` labels on each element. |
| P2-8 | Structural color bars for DITA body elements | Feature | Left-edge `border-left: 3px solid` color bars on prereq/context/result/postreq. Four new CSS variables (`--editor-*-bar`) defined across all 6 themes. |
| P2-9 | Light theme warmth refinement | Feature | Swapped 18 Slate values to Stone in `[data-theme="light"]` block. Increased editor padding `px-8` → `px-12`. |

---

### Shipped in v0.1.1 (2026-03-12)

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

### Pre-backlog (v0.1.0 and earlier)

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

- **When a new item arrives — triage in 30 seconds:** Is it a **bug** or a **feature**? For a bug, does it **block you now** (corrupts data / can't use the tool)? If yes → Bugs ▸ Blocking now. If no → Bugs ▸ Sweep-ready (small/contained) or Bugs ▸ Larger (architectural). Features go under the right chain or Standalone, with their dependency order noted. Add a one-line rationale and a model weight; link a `bugreports/` or `future-state/` file only when the detail won't fit a table cell (see CLAUDE.md "Filing Bugs and Feature Requests").
- **When choosing what to work on:**
  - **Blocking-now bug?** Fix it immediately, on its own, ship a patch.
  - **Otherwise, batch.** Run a **bug sweep** when ~4–6 sweep-ready bugs have piled up; ship one patch. Pick a **feature** deliberately when you want new capability, top-down within its chain; give Opus-sized items their own session.
- **Don't fix bugs the moment they're filed** unless they block you — batching is the whole point. The backlog is never "done"; success is an empty Blocking-now lane and no rotting sweep-ready bugs.
- **After finishing work:** Move the item to Completed with a resolution note. If the fix revealed new issues, file them using the triage above. Delete any resolved `bugreports/` file at version-bump time.

---

## Changelog

Reverse-chronological. Newest day first; within a day, entries read in the order they happened.

### 2026-08-04

- **v0.9.1 released** — the 2026-07-20 sweep (BUG-10 / BUG-11 / BUG-16) plus FR-052 / FR-053. The code had been written but left uncommitted and unversioned for two weeks. Build verified clean and suite green (55 files, 1042 passed, 3 skipped, 0 failed) before committing; `package.json`, `constants/version.ts`, and `Info.plist` all synced to `0.9.1`.
- **Version-numbering discrepancy resolved.** The 2026-07-20 entry claimed the sweep "shipped as v0.9.2" and `feature-requests.md` marked FR-052/FR-053 "Shipped v0.9.1" — but neither version existed anywhere: `package.json` read `0.9.0`, `RELEASE_NOTES` had no such entry, and the last release commit was `42489f9 release(v0.9.0)`. Both claims now reconcile to the real v0.9.1. "BUG-19" appears nowhere in this file and looks like a typo. FR-056 will be the next patch (v0.9.2).
- **Backlog audit — five stale rows corrected.** **BUG-03** cleared from Blocking now (shipped v0.8.5; its one unimplemented sub-item, the NWConnection idle timeout, re-filed as **BUG-21**). **BUG-04** marked resolved — Session 4B shipped in v0.8.7 (`b67262d`, `5a15b0e`, `e810cde`, `94857a3`, `2fd4833`, `5630b1f`, `c71dc7e`, `86ef323`) while the row still read "Remaining: Session 4B". **FR-047** and **FR-048** marked shipped (`090d1d0`, `4b1ccc7`) — FR-047 had been sitting in front of BUG-04 with a stale "blocks, do first" marker.
- **FR-056 row rewritten** after code verification showed the proposed one-line fix was insufficient — the focus branching at `SyncManager.tsx:127-149` is a required second half.
- **This changelog restructured** from a single 9,032-character run-on paragraph into dated sections. All 36 entries preserved verbatim.
- **Correction — v0.9.1 closure claims were overstated.** BUG-10, BUG-11, and BUG-16 were initially all marked shipped on the strength of the diffs plus a green suite, without checking each against its stated scope. On re-check: BUG-16 is resolved in code but has zero regression tests; BUG-10 shipped the envelope but not the `API.md` alignment its row also required; BUG-11 migrated 3 of 11 modals when the row asked to retire all the copies. Remainders re-filed as **BUG-22** (8 un-migrated modals), **BUG-23** (`API.md`), **BUG-24** (BUG-16 tests). Sweep-ready is back at 5 items. The v0.9.1 release itself is unaffected — the code that shipped is good; only the closure bookkeeping was wrong.

### 2026-07-23

- BUG-20 filed and fixed: NWListener double-port bind regression introduced in v0.8.5 security commit caused API server to fail silently on every launch since; fixed by passing `on: .any` to NWListener constructor when `requiredLocalEndpoint` encodes the port; rebuilt and relaunched (commit `520dab8`); also carries pre-existing uncommitted statusCode-from-JSON helper replacing string-sniffing

### 2026-07-20

- bug sweep (BUG-16/11/10) written but left uncommitted; **actually committed and shipped as v0.9.1 on 2026-08-04, not v0.9.2** (this entry originally claimed v0.9.2 — see the 2026-08-04 audit above; "BUG-19" appears nowhere in this file and looks like a typo); P3-46 Altitude theme implemented 2026-07-20 but rolled back same day — product owner decision, palette did not meet visual expectations; item parked pending explicit re-request with revised design; FR-054 filed — Heretto folder tree view in browser modal as a Standalone Sonnet feature

### 2026-07-17

- full codebase review — six subsystem reviews + build/test run. Filed: BUG-03 security cluster (Blocking now); BUG-04 serializer content-loss cluster + BUG-05 dead port-3000 tab API (Larger); BUG-06–BUG-18 sweep-ready (13 items — sweep warranted); FR-047 byte-stability corpus + FR-048 test-suite triage (tech debt, standalone); FR-045 scope expanded with the insert-section reliability trio. Full remediation plan: Obsidian `geotab-work/DITA Architect/Remediation Plan — Codebase Review v0.8.4 (2026-07-17).md`

- follow-up investigations — FR-049 filed: true placeholders for template title/shortdesc, Option A design approved (the "placeholder" was real document text with no clear-on-click mechanism); FR-050 filed: native PDF export via dedicated print WKWebView + print fidelity pass; FR-045 acceptance expanded again with Heretto-aware propose-replace diff review for the altitude-release-notes workflow

- Fable tier added to the model-weight scale in CLAUDE.md — single-context invariant work; BUG-02, BUG-04, FR-045, FR-046 re-tagged Fable; P2-36 downgraded to Sonnet

- FR-048 test-suite triage complete — 113 failures → 0: deleted 12 source-grep/stale-mock suites, fixed Lexical type-guard/async assertions, added jsdom scrollTo shim; suite green

- **ADR-007 decided + implemented** — BUG-05 resolved via option A: tab API is native-only, dead port-3000 tab endpoints + `editor-state-bridge.ts` deleted, docs swept; version bump rides with next release

- v0.8.9 shipped — sweep batch: BUG-06/07/08/09/12/13/14 + BUG-18 hygiene; BUG-15 confirmed shipped earlier in v0.8.7/4B.4; BUG-10 partially resolved — success:false on updateTabContent, remainder (Swift status envelope) stays sweep-ready with BUG-11 and BUG-16

- **v0.9.0 shipped — FR-046 marks-as-data tracked changes**: documentMode viewing/suggesting/editing, TrackedTextNode marks, per-change accept/reject + change-list panel, EditModePlugin/TrackedChangesPlugin/TrackedDeletionNode retired; BUG-02 closed, ADR-004 promoted to Accepted; FR-051 filed — tracked-changes v2 follow-ups

### 2026-06-11

- v0.8.3 shipped — BUG-01 definition lists rendered via pragmatic originMap-paragraph + patchDlElement; two content-loss bugs it exposed also fixed: inline ph/uicontrol loss in block-split, inline image dropping a sibling. Bug report deleted. P2-26 Phase 2 plan recorded — read-only DitaInfoPreviewNode, sequenced next.

- v0.8.4 shipped — P2-26 Phase 2: read-only DitaInfoPreviewNode renders step `<info>` content nested under each step, replacing the Phase 1 chip; serializes to nothing so `<info>` stays byte-stable. P2-26 moved to Completed.

### 2026-06-04

- P2-47 added — table parser trusts cols attribute instead of deriving column count from colspec elements

- backlog restructured — split into Bugs + Features lists; replaced P0–P3 tiers with a "blocks me now" Fix Now/Batch model and a bug-sweep cadence; existing P-IDs kept as stable labels; BUG-01 filed — definition lists not rendered in the visual editor, found while triaging the Journey_Definition topic; P2-47 confirmed present in that same topic but masked by BUG-01

- v0.8.2 shipped — P1-17 + P1-18 XHTML namespace corruption fixed; Blocking now lane cleared

- BUG-02 filed — Edit Mode architecturally unreliable, diff-and-paint instead of marks-as-data; root cause behind all reported Edit Mode failures, subsumes P2-45 and recontextualizes P2-44/FR-042/FR-043; full analysis in bugreports/BUG-edit-mode-architecture.md. Edit-mode rebuild feature chain added: FR-045 Monaco-diff API review → FR-046 marks-as-data tracked changes in Lexical

- v0.8.2 sweep — P2-44, P2-45, P2-46, P2-47 all resolved: P2-46 fixed in parser, P2-45 fixed in serializer, P2-44 verified already-implemented, P2-47 verified already-handled with regression test added; Sweep-ready lane cleared

### 2026-06-03

- P1-18 added — PUT /api/tabs/:id/content triggers XHTML xmlns injection on serialization round-trip; P2-45 added — PUT /api/tabs/:id/content duplicates content instead of replacing; P2-46 added — xref inside note/p not rendered as link in visual editor

### 2026-05-28

- P1-16 added — insert-section accepted changes serialize to XHTML; P2-42/P2-43 added — load-content herettoUuid + block-level injection; P3-52 added — pencil icon tooltip stuck in edit mode; FR-041/042/043 added from Documents working copy

- v0.9.7 shipped — P1-16, P2-42, P2-43, P3-52 shipped; P2-44 added — pencil button does not exit edit mode

- P1-17 added — "+" block tool in Edit Mode serializes XHTML namespace instead of DITA, corrupting topics

### 2026-05-25

- v0.9.5 shipped — P3-12, P2-35, shortdesc placeholder, block + button, theme contrast fixes

- backlog audit — P2-23, P2-24, P2-26 Phase 1, P3-26, P3-27 moved to Completed; found shipped but untracked

- P3 audit — P3-13, P3-22, P3-24 moved to Completed as untracked ships; P3-15 deleted — stale claim; P3-18 deferred; P3-5, P3-42, P3-43 explicitly parked with unblock conditions

- v0.9.6 shipped — P3-7, P3-8, P3-9, P3-44 shipped; discoverability sweep + theme polish

- P2-39, P2-40, P2-41 added — macOS native app menu bar structure from FR-039 UI/UX review

- v0.9.6.1 shipped — P1-15 placeholder Lexical format inheritance fix; P3-45 added — Before/After/Wrap insertion modes from FR-040

### 2026-05-20

- v0.9.4 shipped — resizable split pane, word wrap, sync hint, Heretto loading feedback, readability tooltip

### 2026-05-12

- v0.9.3.1 shipped — Print/Export PDF, dropdown z-index fix

### 2026-04-14

- P2-30 added — base xref visual styling; P3-25/41, P3-32–35, P3-36, P3-39 promoted to P2-31–P2-37

- v0.9.3 shipped — Sonnet sweep: P2-30, P2-31, P3-40 shipped

- backlog cleanup: removed shipped/promoted stale rows from P2 and P3 tables; added v0.9.1.1 Completed section

### 2026-04-13

- P3-41 added — placeholder swap on topic type conversion, bundled with P3-25; P3-37/P3-38 promoted to P2-28/P2-29; P3-42 added for conditional text; FR-037 added for general discoverability

### 2026-04-10

- P2-27 added; v0.9.2 shipped — empty-href xref validation in Monaco + visual editor

### 2026-04-07

- P2-24, P3-29, P3-30, P3-31 added; P2-25, P3-32–P3-39 added; P3-31 scoped and broken out; P3-30 superseded

- P1-13 shipped; P2-26 added; P1-14 shipped; P3-40 added
