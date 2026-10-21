# DITA Architect — History

Shipped work by version (newest first) and the dated changelog. Split out of [BACKLOG.md](BACKLOG.md) on 2026-10-19; everything below was moved verbatim. Open work, lanes, and the scheduling model stay in BACKLOG.md.

---

## Completed

### Shipped in v0.10.0 (2026-10-21) — Session 2B of the execution plan: wrap-selection inline authoring

| ID | Item | Type | Resolution |
|----|------|------|------------|
| ADR-010 (slice B) | Wrap selected text in `<uicontrol>`, `<codeph>`, `<ph>`, `<term>`, `<filepath>`, `<wintitle>`, `<xref>`; unwrap; toolbar + shortcuts | Feature | `lib/inline-wrap.ts` (`$wrapSelectionInInlineTag` / `$unwrapInlineAtSelection`: parser-identical node shapes; new nodes only, never an edited `originMap` entry, so undo/redo restore; refusals `collapsed`/`cross-block`/`overlap`/`formatted`/`whitespace`/`no-href`/`bad-href`/`nothing-to-unwrap`, each with toast copy). `components/InlineWrapPlugin.tsx` inside `SyncManager`: `WRAP_INLINE_COMMAND`, `UNWRAP_INLINE_COMMAND`, `KEY_DOWN_COMMAND` at HIGH priority for ⌘⇧U/⌘⇧C (Lexical's `isUnderline` ignores Shift, verified `Lexical.dev.mjs:1048`; `KEY_DOWN_COMMAND` is dispatched first, `:onKeyDown`). Toolbar: one `Inline element` menu (Gate 7: not seven buttons), opening leftward (the first build clipped its right column, caught in the smoke); `Insert Link` routed through the xref wrap with `Format`/`Scope` selects, retargeting an existing link as before. `SuggestionPlugin` blocks both commands at CRITICAL (I6). Shortcuts added to `constants/keyboard-shortcuts.ts`. Supersedes P2-28/P2-29 for 1.0 (roadmap). |
| FR-063 | Post-sync structural mismatch warning | Feature | `sync/structure-check.ts`, hooked into both `SyncManager` serialize paths and Accept All, run whether or not the XML changed (the first hook placement inside the "XML changed" branch would have missed P1-13's exact shape; caught by the integration test). One-directional (editor > XML only), throttled 10 s per message, advisory. Zero false warnings on every byte-stable corpus fixture and across the round-trip suite (91 serializations, 0 warnings); 0.04 ms per sync. **True positive on first run: BUG-28's two fixtures lose every `<ul>` on a round trip** (row updated, severity raised). |

Tests: `tests/sync/inline-wrap.test.ts` (139: I1/I2 for 7 elements × 13 contexts incl. shortdesc, `<li>`, `<note>`, `<entry>` direct and `<p>`, `<dd>`, section, troubleshooting condition/cause/cause-note/remedy cmd, and a BUG-25 `<p>` wrapper segment; I3; I4; I5; I7 with history registered before the parse as in the app; refusals), `tests/inline-wrap-plugin.test.tsx` (10: commands, retarget, refusal toast, shortcuts incl. plain ⌘U left to Lexical, I6 incl. ⌘⇧U in Suggesting mode), `tests/sync/structure-check.test.tsx` (67). Suite 64 files / 1424 passed / 3 skipped. tsc clean; eslint clean on touched files (18 pre-existing unused imports in `dita-architect.tsx` removed; 2 pre-existing warnings there and 3 in `SyncManager.tsx` unchanged); `npm run build` clean.

Smoke (2026-10-21, native app rebuilt twice with `macos/build.sh`): Kiryl ran the six steps in a topic with `<menucascade>`, `<ph keyref outputclass>`, and step/result paragraphs. `GET /api/tabs/:id/content` showed `<uicontrol>Settings</uicontrol>` (wrap, unwrap, ⌘Z), `<codeph>Export</codeph>` (⌘⇧C), `<filepath>report file</filepath>`, `<xref href="downloads.dita" format="dita" scope="local">`, menucascade and `outputclass` byte-identical, no XML errors. In Suggesting mode a `U` was inserted as a tracked change: the code path was pinned by a new test (⌘⇧U claimed, blocked, toast, no insertion), so the `U` was Shift+U without ⌘ registering; Reject All restored the text. Heretto DTD round trip (approved by Kiryl): a payload built by the real parser, `lib/inline-wrap.ts`, and serializer from the sandbox topic `Kiryl_Test/Test_concept_2.dita` (all seven elements plus a typed sentence, next to an existing Heretto `ezd-review` insertion PI pair) was PUT to Heretto: `is-valid: true`, empty `validation-err-msg`, every element present with Heretto's own `class` stamped on, the review PIs kept. (`__has_broken_links: true` only because the test xref targeted a non-existent `Test_concept_1.dita`.) The original content was then PUT back and fetched: byte-identical, `is-valid: true`. Found in the smoke: FR-068 (no visual style for `<term>`/`<filepath>`/`<ph>`).

---

### Shipped in v0.9.9 (2026-10-21) — Session 2A of the execution plan: ADR-010 slice A

The serializer half of v0.10.0, shipped first as its own patch because the probes that shaped v0.10.0 found two Blocking-now bugs already live in v0.9.8.

| ID | Item | Type | Resolution |
|----|------|------|------------|
| ADR-010 (slice A) | Inline reconciliation: patch inline content around preserved anchors | Architecture | `sync/inline-units.ts` (shared scanner: the parser's `parseTextNodes`/`parseInlineElement` are now wrappers over it, verified behaviour-identical by the full suite before anything else changed) and `sync/inline-reconcile.ts` (`reconcileInline`: LCS over unit signatures → anchors; per gap, character-level prefix/suffix with atomic element runs and container-owner clamping; raw-offset text splits via a normalized→raw map; PIs/comments/`<note>` block boundaries as fixed points → `bail('fixed-inside')`; one-shot console warning on bail; `setReconcileObserver` test seam). Wired into `patchElementContent` (trim/note modes), `patchTableEntry`'s direct-text branch (segment), and `patchPWrapper`'s inline segments (segment); the legacy `patchInlineNodes`/S2 path survives only as the bail path. `serializeInlineContent` split into `serializeInlineChild` + `serializeTextRun` so the reconciler emits with the same rules. Corpus tally on unedited parses: 691 decisions, 686 untouched, 5 patched (all `sampled/concept/installing-the-go-anywhere.dita`, the BUG-29 fixture, where `patchTableEntry` pairs a DOM `<p>` with the image-chip paragraph the parser emitted for the same cell), 0 bails. |
| BUG-32 | Insert Link (any full-rewrite inline change) destroyed sibling inline markup | Bug | **Fixed.** R3: `$toggleLink` beside `<menucascade>` and `<ph keyref outputclass>` → output byte-equal to the source with only the `<xref>` added. |
| BUG-33 | Structure-only edits dropped in an element holding an XML comment | Bug | **Fixed.** R4: link added beside `<!-- … -->` is emitted, comment kept; typed text beside Heretto review PIs keeps the PIs. |
| S2 residual | Formatting toggle dropped beside ph/xref/uicontrol (annotated on FR-046 since v0.8.7) | Bug | **Fixed as a consequence** (ADR-010's intended behaviour change). The SAFETY test that pinned the drop now pins the opposite. |

Tests: new `tests/sync/inline-reconcile.test.ts` (R1 over all 52 fixtures, conditional on a fixture being byte-stable today so it tightens as BUG-28/29/30/31 are fixed; R3–R6; bail case). Suite: 61 files / 1208 passed / 3 skipped. tsc, eslint (touched files), `npm run build` clean. Smoke (2026-10-21, native app rebuilt with `macos/build.sh`, `/api/status` → 0.9.9): a topic with `<menucascade>`, `<ph keyref outputclass>`, and an XML comment loaded via `POST /api/load-content`; Kiryl selected `Settings` and used the toolbar's Insert Link (`other.dita`); `GET /api/tabs/:id/content` returned the `<xref href="other.dita" format="dita">` with the menucascade, the chip's `outputclass`, and the comment all byte-identical, `xmlErrors: []`.

---

### Shipped in v0.9.8 (2026-10-20) — Session 1 of the execution plan

Released as v0.9.8 (commit `325973d`, tag `v0.9.8`; this heading said "no version bump" until 2026-10-20, but the BUG-27 fix triggered the plan's patch release). FR-064 and FR-065, the two read-only prerequisites the execution plan put ahead of v0.10.0. One Blocking-now serializer bug fixed on the way; four more found and filed for later sessions.

| ID | Item | Type | Resolution |
|----|------|------|------------|
| FR-064 | Sampled real-topic byte-stability corpus | Tech debt | `scripts/sample-heretto-corpus.ts` (`npm run corpus:sample`) enumerates the live Heretto repository (767 folders, 2,545 `.dita` resources across 6 types, 5 excluded folders), deterministically samples 5 per type plus one topic per structural pattern not yet in the hand-written corpus (11 probes: `dl`, `simpletable`, `fig`, `choices`, `substeps`, `stepxmp`, `stepresult`, `example`, nested `section`, a `<p>` wrapping a block, adjacent same-type lists, review PIs, block-level `conref`, `image` in `<p>`), scrubs every author/email to `author@example.com`, and writes 40 fixtures + `tests/sync/fixtures/sampled/MANIFEST.md`. `byte-stability.test.ts` gained a second `describe` that walks the directory and generates one test per file automatically, with a `KNOWN_FAILURES` map turning a listed fixture into `it.fails` — no hand-written entry needed per fixture (I3). First run: 20 of 40 real topics failed. See the four bugs below. |
| BUG-27 | `<prereq>`/`<context>`/`<result>`/`<postreq>` wrapping a block child (almost always a single `<p>`) lost its wrapper, its class attribute, and the inner element's own attributes on an unedited round-trip | Bug | **Fixed this session — Blocking-now (real content/attribute loss, e.g. `audience="partner"` silently dropped).** The direct-inline-text case (`<prereq>text</prereq>`, the only case the hand-written corpus had) was always fine; the block-child case (`<prereq><p audience="partner">…</p></prereq>`, common in real Heretto topics) recursed into the inner `<p>` with no `bodyIndex`, leaving it completely untagged in `originMap`, so the serializer treated it as an unmatched mismatch, deleted the real `<prereq>`, and recreated a bare `<p>` from scratch. Fixed by routing this case through the same container mechanism ADR-009 built for troubleshooting topics: `prereq`/`context`/`result`/`postreq` added to `TROUBLE_CONTAINER_TAGS` (parser) and `TROUBLE_CONTAINER_TAGS_LOWER` (serializer); the block-child branch stamps `containerPath` and the existing `patchContainer` patches the element in place. Fixed 5 of the 20 sampled failures with zero regressions (confirmed against the full suite, including `task-info.dita`'s direct-text prereqs, which don't take this path and were unaffected). |
| BUG-28 | Untitled `<section>` loses its wrapper entirely | Bug | Found, not fixed — filed Larger. See the BACKLOG row for the confirmed root cause (no heading means no origin identity at all) and fix direction. 3 fixtures. |
| BUG-29 | Table-cell content model gaps (block content, mixed image+paragraph) | Bug | Found, not fixed — filed Larger. See the BACKLOG row. 2 fixtures. |
| BUG-30 | XML declaration unconditionally added when the source has none | Bug | Found, not fixed — filed Sweep-ready (cosmetic, no data loss). See the BACKLOG row. 2 fixtures (1 shared with BUG-31). |
| BUG-31 | Whole-document `XMLSerializer` pass re-normalizes empty-tag syntax and entity choice everywhere, including untouched regions | Bug | Found, not fixed — filed Sweep-ready in lane but Opus-weight to actually fix (serialization-strategy change); cosmetic, no data loss. See the BACKLOG row. 7 fixtures (1 shared with BUG-30). |
| FR-065 | Heretto suggestion-PI grammar discovery | Task | First pass, done interactively against a live Heretto scratch topic (`Kiryl_Test/Test_concept_2.dita`) via the browser, with raw XML fetched over REST at each step — not scraped from the UI. `future-state/heretto-review-pi-grammar.md` has the grammar (`<?ezd-review-start CHANGE_ID:KIND:AUTHOR_EMAIL:TIMESTAMP_MS?>…<?ezd-review-end CHANGE_ID?>`), two worked examples, the finding that one logical edit can share one `CHANGE_ID` across multiple fragments when a later split interrupts it, the finding that Heretto's mode dropdown has a fourth "Commenting" state alongside DA's three, and a `TrackedMark` mapping table. Four gaps named explicitly rather than guessed at — most importantly, the delete kind's raw PI was never captured (resolved via Accept All before a fetch caught it). The document tells whoever shapes v0.13.0 to close the gaps first, not design from the inferences. |

Suite after this session: 60 files / 1142 passed (15 of them expected `it.fails`) / 3 skipped. tsc and eslint clean on touched files.

---

### Shipped in v0.9.7 (2026-10-20)

The three items the roadmap re-slotted ahead of v0.10.0, plus one pre-existing serializer bug found on the way.

| ID | Item | Type | Resolution |
|----|------|------|------------|
| P2-25 (slice 1) | DITA troubleshooting topics open, render, and round-trip | Feature | ADR-009. `troublebody` added to the body selector; `condition`/`troubleSolution`/`cause`/`remedy`/`steps-informal` flatten to body-level nodes stamped with `originMap.containerPath`; serializer groups by path and recurses into the preserved element (`patchContainer`), never deleting an unconsumed container. `DitaContainerBoundaryNode` labels each condition/cause/remedy and blocks Lexical's same-type list merge across containers. `steps-unordered` both ways; lists created in a remedy emit steps/steps-unordered. `troubleshooting` accepted by `validateDitaXml`, the XML-pane root check, the tab badge, and the import element lists. Grammar verified against all 22 live Heretto troubleshooting topics; the real median topic round-trips byte-stable and loads in the native app. Fixtures: `troubleshooting-skeleton.dita` (real), `troubleshooting-rich.dita` (synthetic). Slice 2 (template) remains open. |
| BUG-25 | `<p>` wrapping a block lost its wrapper and attributes on an unedited round-trip (any topic type) | Bug | Pre-existing; surfaced by the troubleshooting fixtures. `originMap.pWrapperId` ties the flattened run to its source `<p>`; `patchPWrapper` patches blocks through the normal walk (wrapper grouping off, base path carried) and rewrites an inline segment only when its text changed; falls back to rebuilding the wrapper when the shapes no longer align. `<p><dl>` keeps the dl path. 4 tests. |
| FR-049 | True placeholders for template title/shortdesc | Feature | Templates ship `<title/>`/`<shortdesc/>`; `ShortdescPlugin` sets `data-placeholder` + class on empty nodes (topic-type-aware prompts, generic fallback); CSS `::before { content: attr(data-placeholder) }`. Parser's 19-pattern prose detector deleted; `convertDitaTopic` prose swap deleted; `INITIAL_DITA` made standalone. Optional save guard deliberately not built (shared with the API save path). 12 tests. |
| FR-061 | Rename the Geotab theme to Navy | Polish | Label `Navy`, tooltip `Deep blue-navy palette for low-light work`, `[data-theme="navy"]`, Monaco `bgColors.navy`, API enum, README. `resolveStoredTheme` maps a stored `geotab` to `navy` and rewrites localStorage. Six theme test files renamed/updated; `tests/theme-migration.test.ts` added. Palette unchanged. |

Suite 60 files / 1101 passed / 3 skipped; tsc + eslint clean on touched files; app rebuilt and relaunched.

---

### Shipped in v0.9.6 (2026-10-19)

FR-062 slice 2 — the content root folder is configuration, not a constant.

| ID | Item | Type | Resolution |
|----|------|------|------------|
| FR-062 (slice 2) | Heretto content-root folder UUID read from `~/heretto.json` | Feature | `HERETTO_ROOT_UUID` deleted from `constants/heretto.ts`. `useHerettoCms` loads `rootUuid` from `/heretto-credentials` on mount into `herettoRootUuid` state; the connection probe is an effect on that state; `testHerettoConnection`, `saveHerettoCredentials`, the search effect, `openHerettoBrowser`, `handleImportContinue`, `handleHerettoSaveNew`, and `onBrowseFromRoot` all read it (12 former call sites). `HerettoBrowserModal` takes a `rootUuid` prop. Settings modal gained `Content root folder UUID`. Both `/heretto-credentials` handlers (Vite + Swift) return `rootUuid` on GET and preserve it on a PUT that omits it. Empty-root UX: probe skipped, `Test`/`Browse` toast `Set the Heretto content root folder UUID in Heretto Status first`, Save warns `Enter the content root folder UUID to connect`. Live probe of six candidate folder-independent endpoints: all HTTP 500, so no change to the probe URL shape. 3 new tests. Suite 57 files / 1067 passed / 3 skipped; tsc clean; app rebuilt. |

---

### Shipped in v0.9.5 (2026-10-19)

Bug sweep — the whole Sweep-ready lane (precedent: the v0.9.3-old-scheme Sonnet sweep).

| ID | Item | Type | Resolution |
|----|------|------|------------|
| BUG-22 | 8 of 11 modals hand-rolled their overlay | Bug/A11y | All eight (`ExitEditModeModal`, `HerettoBrowserModal`, `HerettoReplaceModal`, `HerettoStatusModal`, `ImportVerificationModal`, `KeyboardShortcutsModal`, `ReleaseNotesModal`, `SaveTopicModal`) now render through `components/Modal.tsx`; the copies are retired (`grep 'fixed inset-0' components/` now hits only `Modal.tsx` and the two Toolbar popovers). `Modal` hardened for the migration: new `style` prop (fixed widths), mount effect runs once with `onClose` read via a ref (inline-arrow parents no longer re-run it and steal focus from an input mid-keystroke), initial focus skipped when a child `autoFocus` already holds it, focus restore guarded on `isConnected`. Three dialogs that lacked `aria-labelledby` gained ids (`save-topic-title`, `heretto-status-title`, `heretto-browser-title`). Closes the BUG-11 remainder. |
| BUG-23 | `API.md` silent on the `httpStatus` envelope | Bug/Docs | New "Response envelope and error responses" section: `success` + `httpStatus` on every port-3001 response, why the field exists (Swift derives the status line from the bridge JSON via `statusCode(from:)`), port-3000 exemption, `413` row, idle timeout. PUT/save/insert-section example responses updated to show the field. Closes the BUG-10 remainder. |
| BUG-24 | No regression tests for the BUG-16 Heretto fixes | Tech debt | `tests/heretto-verification-guards.test.tsx` — 8 tests driving the real `useHerettoCms` and `useExternalLoad` with `renderHook` + mocked `fetch`: save verification "identical" through Heretto class stamping (+ genuine-diff control + HTML-verify failure rethrows); Refresh rejects HTML and leaves `xmlContent`/`savedXmlRef` untouched (+ XML control); background poll treats HTML as a failed check (+ XML control); external-load poller reschedules after a 500 and delivers the next queued load. Closes the BUG-16 remainder. |
| BUG-21 | No idle timeout on `NWConnection` | Bug | `HttpServer.swift`: per-connection `DispatchWorkItem` cancels the connection after 30 s unless a complete request has been routed; cancelled on every other exit path. Closes the BUG-03 residual. |
| — | Fixture hygiene (FR-062 Haiku item) | Chore | Real author email in `tests/sync/fixtures/journey-definition.dita` `<prolog>` replaced with `author@example.com`; byte-stability test is self-referential so it stays green. |

---

### Shipped in v0.9.4 (2026-10-19)

Configurable Heretto host (FR-062 slice 1). Public-repo housekeeping.

| ID | Item | Type | Resolution |
|----|------|------|------------|
| FR-062 (slice 1) | Heretto host is read from `~/heretto.json` instead of being hardcoded | Feature | `vite.config.ts` proxy target and `DITASchemeHandler.swift` upstream host both come from a new `host` key (scheme and trailing slash normalised). `HerettoStatusModal` gained a `Heretto host` field; `useHerettoCms` credential state carries `host`; `GET /heretto-credentials` returns it; a PUT without `host` preserves the on-disk value. Native mode answers `400 Heretto host not configured` when absent; dev mode logs a startup warning and disables the proxy (target is fixed at startup, restart required after a change). READMEs, CLAUDE.md, and the stable repo README de-tenanted. Slices 2–3 (root folder UUID, discovery) and fixture hygiene remain open under FR-062. Suite 56 files / 1056 passed / 3 skipped; tsc clean; app rebuilt. |
| — | Public-repo housekeeping | Chore | Both GitHub repos made public 2026-10-19. Added an all-rights-reserved `LICENSE` to each; `package.json` `license: UNLICENSED`. Pushed v0.9.1–v0.9.3 (previously local-only) and tagged `v0.9.0`, `v0.9.1`, `v0.9.3`. `package-lock.json` version re-synced (had been stuck at 0.9.1). ADR-008 promoted to Accepted. |

---

### Shipped in v0.9.3 (2026-08-04)

PUT proposes, not applies. insert-section works in suggesting mode. (ADR-008)

| ID | Item | Type | Resolution |
|----|------|------|------------|
| FR-057 | API whole-document replace as a reviewable diff | Feature | `updateTabContent` now stages `tab.pendingReview = { proposedXml, baseXml, sourceLabel: 'AI draft' }` instead of overwriting `xmlContent` — the existing FR-045 `ReviewBar`/`DiffViewer` surface renders without modification. No-op branch for identical content (`status: 'no-change'`). `insertSection` suggesting-mode guard removed (ADR-008 — both routes stage `pendingReview`, live marks are not touched). `saveTab` guard added: refuses while `pendingReview` is set to prevent silent pre-PUT pushes to Heretto. `handleReviewAccept` toast added: warns when accepting discards live tracked-change marks. `API.md` updated throughout (PUT contract, save guard, worked example). 11 new tests in `tests/native-api-bridge.test.ts` including the blank-skeleton regression case. ADR-008 in `future-state/decisions.md`. Build clean; 56 files, 1056 passed, 3 skipped, 0 failures. |

---

### Shipped in v0.9.2 (2026-08-04)

FR-056 fix: API content now flushes into suggesting mode immediately.

| ID | Item | Type | Resolution |
|----|------|------|------------|
| FR-056 | API content loads do not flush into suggesting mode | Bug | Two-file fix (verified against source before writing code). **Half 1** (`SyncManager.tsx`): `suspendSync` branch now checks `lastUpdatedBy === 'api'` — API whole-document replacements call `applyPendingSync()` directly, bypassing focus branching entirely; non-API sources still buffer as before. **Half 2** (same branch): pre-assigning `pendingXmlRef` before flushing discards any stale buffered Monaco edit. Also: `pendingXmlRef.current = null` added in the focused-Lexical timeout branch (independent hygiene — prevents stale buffer clobbering on next focus). **Change 3** (`lib/native-api-bridge.ts`): toast when an API PUT discards unresolved tracked-change marks. 3 new tests added to `tests/sync-manager-out-of-sync-banner.test.tsx`, including the no-focus case (the test that would have passed against the incomplete first-draft fix). Build clean; 55 files, 1045 passed, 3 skipped, 0 failures. |

---

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
| P1-13 | xref not serialized when link added in visual editor (bug report file deleted 2026-10-19; its unbuilt follow-up idea is FR-063) | Bug | `patchElementContent` in `serializeLexicalToXml.ts` was returning early when `domText === lexText`, bypassing serialization even when the Lexical node had a `LinkNode` with no matching `<xref>` in the DOM. Fix: before the early return, compare the count of `link`-type children in Lexical against `<xref>` elements in the DOM — a mismatch forces `replaceElementContent`. Added a creation-from-scratch test to `tests/sync/round-trip.test.ts`: parses plain-text XML, injects a `LinkNode` via `editor.update({ discrete: true })`, asserts `<xref href="..." format="html">` in the serialized output. |
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
| P0-1 | H2 invisible on Light theme | Bug | CSS variables instead of hardcoded colors in `index.css`. |
| P0-2 | Codeblock renders as label with no content | Bug | Block-child detection in `parseXmlToLexical.ts`; content split into inline runs and block children. |
| P1-1 | Nested list in table cell renders as raw text | Bug | Block-level elements now parsed correctly in table entries. |
| P1-2 | dateRange sub-parameters not rendered | Bug | Fixed by same root cause fix as P1-1. |
| P1-3 | conkeyref renders as empty whitespace | Bug | Placeholder chips via `DitaPhRefNode` — renders as e.g. `[conkeyref: glossary/term]`. |
| P1-4 | Table column auto-sizing truncates words | Bug | `TableColumnSizer` plugin with proportional widths and 10% minimum. |
| P1-5 | Empty table rows rendered as blank space | Bug | Rows with no `<entry>` children filtered during parsing. |
| P1-6 | Theme dropdown hidden behind Heretto context toolbar | Bug | z-index fix in `Toolbar.tsx`. |
| P1-7 | Geotab theme lacks visual hierarchy | Bug | Three-tier contrast hierarchy in `index.css`. |

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

## Changelog

Reverse-chronological. Newest day first; within a day, entries read in the order they happened.

### 2026-10-21

- **v0.10.0 released (Session 2B).** Wrap-selection inline authoring (ADR-010 slice B) plus FR-063 (post-sync structure warning). FR-063's first corpus run found BUG-28 loses every `<ul>` in two real topics on a round trip; BUG-28's severity raised and flagged for a lane decision. Smoke found and fixed a clipped menu; FR-068 filed for unstyled `<term>`/`<filepath>`/`<ph>`. Suite 64 / 1424 / 3.
- **v0.9.9 released (Session 2A, ADR-010 slice A).** Shared inline scanner (`sync/inline-units.ts`) replaces the parser's two inline helpers with wrappers over it; inline reconciler (`sync/inline-reconcile.ts`) wired into the three inline patch sites. **BUG-32 and BUG-33 fixed**; the v0.8.7 S2 residual (toggle dropped beside a stamped element) fixed as a consequence. Corpus: 686/691 reconciler decisions untouched on unedited parses, the other 5 inside the BUG-29 fixture, 0 bails. Suite 61 files / 1208 passed / 3 skipped. Anti-entropy row filed: retire the legacy `patchInlineNodes`/S2 path once the bail cases are covered. Next: Session 2B, the wrap UI (v0.10.0).

### 2026-10-20

- **Execution Plan Session 2 shaped; the plan's premise was wrong.** The v0.10.0 plan assumed the serializer already emits `inlineTag` stamps generically, so a wrap would be editor-only work. Throwaway probes showed otherwise: a `<uicontrol>` wrap is dropped on serialize in every case tried (9 of 9), because `patchElementContent` only rewrites when text or xref count changes; an `<xref>` wrap goes through the full-rewrite path and destroys sibling markup. Two existing bugs filed **Blocking now**: **BUG-32** (the shipped Insert Link button deletes `<menucascade>` wrappers and strips chip attributes like `outputclass` in the same paragraph) and **BUG-33** (in an element holding an XML comment, structure-only edits such as adding a link are dropped). **ADR-010 accepted** — an inline reconciler that keeps unchanged inline elements as byte-exact anchors and rewrites only the changed run, against the load-time master (mixed type-then-wrap edits are the common case). Split into slice A (reconciler, fixes BUG-32/33, **v0.9.9**) and slice B (wrap UI, **v0.10.0**). Session 2 prerequisite met: fixtures `inline-contexts.dita` and `inline-contexts-trouble.dita` cover all seven wrap elements in p, li, note, table entry, dd, section, shortdesc, condition, cause, and remedy cmd, both byte-stable. The ADRs planned for Sessions 4–7 renumber to ADR-011–014. FR-064/FR-065 statuses corrected to Shipped (v0.9.8). Suite: 60 files / 1144 passed / 3 skipped. No version bump; nothing in `sync/` changed.
- **Execution Plan Session 1 run.** FR-064 (sampled real-topic corpus — 40 fixtures from a live enumeration of 767 Heretto folders) and FR-065 (Heretto suggestion-PI grammar, done interactively via browser automation against a scratch topic in Kiryl's own sandbox folder) both shipped. The corpus's first run found 20 of 40 real topics failing byte-stability: **BUG-27 fixed** (prereq/context/result/postreq wrapping a `<p>` lost its wrapper and attributes — Blocking-now, real content loss); **BUG-28, BUG-29 filed Larger** (untitled-section identity loss; table-cell content model gaps — root cause known, fix is architectural); **BUG-30, BUG-31 filed Sweep-ready** (XML-declaration and empty-tag/entity normalization — cosmetic, no data loss, despite BUG-31's fix needing a real serialization-strategy change). Sweep-ready lane: 2 items (BUG-26, BUG-30).
- **Method review after v0.9.7.** Roadmap "Build discipline" gained rules 8 (sample real topics into the corpus before touching the serializer) and 9 (direct work is the norm, the pipeline is a tool), narrowed rule 7 (adversarial review mandatory for Fable milestones only — it had been done once in six releases), and a "How to run a milestone session" checklist with a suggested order that pulls two prerequisites forward. CLAUDE.md's pipeline section rewritten to the independent-review-not-breadth rule with a dry-run caveat; version-bump checklist extended (build.sh, corpus check, smoke pass, tag/push). REVIEW-CRITERIA Gate 1 names the sampled corpus. GOVERNANCE Stage 4 wording aligned. **FR-064** (sampled real-topic corpus, P1, before any serializer work) and **FR-065** (Heretto suggestion-PI grammar discovery, v0.13 prerequisite) filed with backlog rows.
- **v0.9.7 released** — P2-25 slice 1 (troubleshooting topics, ADR-009), FR-049 (true placeholders), FR-061 (Navy theme), BUG-25 fixed. Live verification: all 22 Heretto troubleshooting topics enumerated via the REST listings (`<resource type="Troubleshooting Topic">`); the median one round-trips byte-stable and loads in the native app with every cause rendered. **BUG-26 filed** (adjacent same-type lists merge inside one container — the cross-container case is fixed by the boundary node).

- **FR-055 closed as already shipped.** It asked for a tab-content read endpoint; `GET /api/tabs/:id/content` has existed since v0.3.3 and was verified live. Both recorded failures used a non-existent URL (`/api/tab-content?tabId=`). Caller-side fix only.
- **FR-059 given a backlog row** (readability score in the content response). It had an FR entry since 2026-08-12 but was invisible to the grooming check.
- **Document review completed** (commit `123db47`): prototypes removed, HISTORY.md split out of BACKLOG.md, CLAUDE.md trimmed, shipped bug reports and two superseded Obsidian plans deleted, FR-063 salvaged from the P1-13 report.

### 2026-10-19

- **v0.9.1–v0.9.3 pushed** — they had been local-only since 2026-08-04 (main was at v0.9.0 on GitHub). `main` fast-forwarded over `release/v0.9.1`; tags `v0.9.0`, `v0.9.1`, `v0.9.3` created retroactively.
- **Repos made public** by Kiryl. All-rights-reserved `LICENSE` added; `package.json` `license: UNLICENSED`. The frozen `dita-architect-stable` repo and its local clone were deleted. Full-history scan of both repos for `~/heretto.json` contents, token-shaped strings, and credential files: nothing found.
- **ADR-008 promoted to Accepted.** `package-lock.json` version re-synced (had been stuck at 0.9.1 through two releases).
- **v0.9.4 released** — FR-062 slice 1: Heretto host read from `~/heretto.json` instead of hardcoded in `vite.config.ts` and `DITASchemeHandler.swift`; Settings modal gained a host field. README, macOS README, CLAUDE.md de-tenanted. **FR-060** (Windows/Linux shells), **FR-061** (rename Geotab theme → Navy, incl. the `Geotab brand colors` tooltip), **FR-062** (instance agnosticism) filed; FR index table brought current for FR-056–FR-062.
- **v0.9.5 released** — bug sweep clearing the whole Sweep-ready lane: BUG-22 (all 8 remaining dialogs on the shared `Modal`, which was hardened: `style` prop, mount-once effect with `onClose` via ref, respects child `autoFocus`), BUG-21 (30 s `NWConnection` idle timeout, verified live at 33 s with raw sockets), BUG-23 (`httpStatus` envelope documented in API.md), BUG-24 (8 `renderHook` regression tests for the v0.9.1 Heretto fixes). Real author email scrubbed from the `journey-definition.dita` fixture.
- **v0.9.6 released** — FR-062 slice 2: `HERETTO_ROOT_UUID` deleted from `constants/heretto.ts`; `rootUuid` in `~/heretto.json`, held in `useHerettoCms` state, passed to `HerettoBrowserModal` as a prop; third Settings field. Live finding: no folder-independent Heretto probe endpoint exists (six candidates all HTTP 500); folder XML carries `parent-folder-id` and the chain ends at a parentless `master` folder, making slice 3 discovery feasible.
- **Roadmap re-sequenced** (Obsidian note): v0.9.1/v0.9.2 as planned never shipped; P2-25 slice 1, FR-049, and FR-061 re-slotted as v0.9.7 ahead of v0.10.0. CLAUDE.md's Versioning Policy roadmap block reduced to a pointer.
- **Acquisition evaluation deleted; P3-1–P3-6 retired** (see Parked). Document review found four shipped `bugreports/` files, two fully-executed July notes, and two FR-057 notes as consolidation candidates — pending Kiryl's call.

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

---

## Version numbering map (old four-part numbering → SemVer)

Moved here from CLAUDE.md on 2026-10-19. Releases before 2026-06 used a four-part scheme that was retired by ADR-005; this table maps each old number to its SemVer equivalent.

| New | Old | Release | Notes |
|---|---|---|---|
| 0.1.0 | 0.5.0 | Foundation | |
| 0.1.1 | 0.5.1 | Rendering fixes | |
| 0.2.0 | 0.6.0 | Body element indicators | |
| 0.2.1 | 0.6.1 | Polish batch (beautify, copy) | BACKLOG only — not in What's New (bundled into 0.3.1) |
| 0.2.2 | 0.6.2 | Accessibility + empty states | BACKLOG only — not in What's New (bundled into 0.3.1) |
| 0.3.0 | 0.7.0 | External load API | BACKLOG only — not in What's New (bundled into 0.3.1) |
| 0.3.1 | 0.7.1 | Replace workflow | What's New entry also covers 0.2.1–0.3.0 content |
| 0.3.2 | 0.7.2 | P1 bug fixes (word count, sync) | BACKLOG only — not in What's New (bundled into What's New 0.3.2) |
| 0.3.3 | 0.7.3–0.7.4 | Table context menu + read API | What's New calls this 0.3.2 (combines BACKLOG 0.3.2 + 0.3.3) |
| 0.4.0 | 0.8.0 | Write API + Insert Table | |
| 0.5.0 | 0.9.0 | Heretto images + inline validation | |
| 0.5.1 | 0.9.1 | Link + Replace verification fixes | |
| 0.6.0 | 0.9.1.1 | Note types, section bars, info chips | |
| 0.6.1 | 0.9.2 | Empty href xref validation | |
| 0.6.2 | 0.9.3 | Xref styling, placeholder treatment | |
| 0.7.0 | 0.9.3.1 | Print / Export PDF | |
| 0.7.1 | 0.9.4 | Resizable pane, word wrap, QoL | |
| 0.7.2 | 0.9.5 | Page-canvas layout, block + button | |
| 0.7.3 | 0.9.6 | Keyboard shortcuts, version browser | |
| 0.8.0 | 0.9.6.1 | AI insert-section | |
| 0.8.1 | 0.9.7 | insert-section fixes + block injection | |
