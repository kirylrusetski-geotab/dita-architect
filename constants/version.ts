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
    version: '0.9.6',
    date: '2026-10-19',
    title: 'The Heretto content root is now a setting. Nothing about your Heretto instance is baked into the app anymore.',
    sections: [
      {
        heading: 'New',
        items: [
          'Heretto Status has a new `Content root folder UUID` field under `Heretto host`. This is the folder the Heretto browser opens on and the folder the connection check probes. Before, it was a fixed value compiled into the app, so the browser and the green indicator only worked against one Heretto instance.',
          '`~/heretto.json` accepts a `rootUuid` key. The README explains how to find yours: ask your Heretto administrator, or read the `id` from any folder in the REST API and follow `parent-folder-id` upward.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'If no root folder is configured, `Test`, `Open from Heretto`, and `Browse from root` now tell you exactly what is missing: `Set the Heretto content root folder UUID in Heretto Status first`. Before, they would have queried a folder that does not exist on your instance and failed with no explanation.',
          'Saving credentials without a root folder reports `Credentials saved. Enter the content root folder UUID to connect.` instead of claiming the connection failed.',
          'Saving credentials from an older client that does not send a root folder keeps the one already stored on disk.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          '`HERETTO_ROOT_UUID` is gone from `constants/heretto.ts`. The value lives in `useHerettoCms` state (`herettoRootUuid`), is loaded from `/heretto-credentials` on mount, and reaches `HerettoBrowserModal` as a `rootUuid` prop. The connection probe waits for it instead of firing with a constant.',
          'There is no folder-independent probe endpoint. `/rest/all-files`, `/rest/files`, `/rest/root`, `/rest/whoami`, `/rest/user`, and `/rest/content-root` were all tried against a live instance and all return HTTP 500, so the probe still hits `/rest/all-files/<rootUuid>`.',
          'Root discovery (FR-062 slice 3) is now known to be feasible: every folder\'s XML carries `parent-folder-id`, and walking it upward reaches a parentless `master` folder. Not built yet.',
          'Three new tests pin the behaviour: the probe uses the configured root, no root means no probe, and the constant no longer exists.',
        ],
      },
    ],
  },
  {
    version: '0.9.5',
    date: '2026-10-19',
    title: 'Bug sweep: every modal traps focus, the API docs match the API, and the native server stops holding idle connections.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'All eleven modals now share one dialog shell. Before, eight of them (Exit Suggesting Mode, Open from Heretto, Replace in Heretto, Heretto Status, the import verification dialog, Keyboard Shortcuts, What\'s New, and Save Topic) drew their own overlay: Tab could walk out of the dialog into the editor behind it, and closing the dialog did not return focus to the button that opened it. Each now traps Tab inside the dialog, restores focus to the opener on close, and closes on Escape from anywhere, not only while focus happens to be inside it. (WCAG 2.1.2 and 2.4.3.)',
          'Typing in a dialog field no longer risks losing focus. The shared shell reads its close handler through a ref, so a parent that re-renders on every keystroke cannot restart the focus logic mid-word. A field marked `autoFocus` keeps focus; the shell only focuses the first control when nothing inside has focus yet.',
          'The native API server now closes a connection that has not delivered a complete request within 30 seconds. Before, a client that connected and sent nothing held the connection open indefinitely.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          '`API.md` now documents the response envelope: every port-3001 response carries `success` and `httpStatus`, and the Swift server derives the real HTTP status line from that field. The documented contract had lagged the code since v0.9.1 (BUG-23). Example responses updated; `413` and the idle timeout added to the status table.',
          'Regression tests now pin the three Heretto fixes that shipped untested in v0.9.1 (BUG-24): save verification ignores Heretto\'s injected `class` attributes; an HTML body from Heretto can never overwrite a tab or its saved baseline, on Refresh or on the background change poll; and the external-load poller keeps polling after a failed request. New file `tests/heretto-verification-guards.test.tsx`, 8 tests driving the real hooks.',
          'The byte-stability fixture `journey-definition.dita` no longer carries a real author email. The test compares the fixture against its own round-trip, so the edit is self-consistent.',
          'Sweep-ready lane cleared: BUG-21, BUG-22, BUG-23, BUG-24. Remaining dialog-like overlays not covered by this sweep: the Insert Link and Insert Table popovers in `Toolbar.tsx`, which close on outside click and were not in BUG-22\'s scope.',
        ],
      },
    ],
  },
  {
    version: '0.9.4',
    date: '2026-10-19',
    title: 'Connect to any Heretto instance: the host is now a setting, not a constant.',
    sections: [
      {
        heading: 'New',
        items: [
          'The Heretto Settings panel has a new `Heretto host` field above `Email`. Enter your instance hostname (for example `yourcompany.heretto.com`) and the app proxies every Heretto request there. Before, the hostname was fixed in the app and could not be changed without editing source code.',
          '`~/heretto.json` accepts a `host` key alongside `email` and `token`. You can paste the hostname with or without `https://` or a trailing slash; both are stripped before use.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'If no host is configured, the native app now answers Heretto requests with a clear `Heretto host not configured` message that points you to Settings. Before, requests went to a hostname you could not see or change.',
          'Saving credentials from an older client that sends only email and token no longer wipes the host already stored on disk.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'The dev server reads the host once at startup, so after changing it you need to restart `npm run dev`. The native app reloads it on every request.',
          'The Heretto content-root folder UUID is still a constant (FR-062, slice 2). Browse, search, and the connection check depend on it, so a second Heretto instance will not show as connected yet.',
          'The repository is now public under an all-rights-reserved LICENSE. FR-060 (Windows and Linux shells), FR-061 (rename the Geotab theme to Navy), and FR-062 (Heretto instance agnosticism) were filed.',
        ],
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-08-04',
    title: 'PUT now shows a diff — AI-drafted content goes to review, not straight into the document.',
    sections: [
      {
        heading: 'New',
        items: [
          '`PUT /api/tabs/:id/content` now stages a proposal instead of applying immediately. The XML pane shows a red/green Monaco diff with an Accept/Reject bar — the same surface used by `insert-section`. The tab\'s content is not changed until you click Accept. Works in any mode, including suggesting mode, and from any base document including a blank skeleton.',
          '`insert-section` now works in suggesting mode. The guard that previously blocked it ("resolve tracked changes before inserting") is gone — both routes go through the review surface, so there is nothing left to guard against.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Saving while a review is pending is now refused with a clear error instead of silently pushing the pre-PUT document to Heretto.',
          'Accepting a proposal while in suggesting mode now reports how many unresolved suggestions were discarded, rather than losing them silently.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'ADR-008 records the contract change: `PUT /api/tabs/:id/content` proposes; it does not apply. Any caller that PUT-then-saved must accept first. `API.md` updated throughout.',
        ],
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-08-04',
    title: 'API content now renders in suggesting mode immediately — the AI-drafts-human-reviews workflow unblocked.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          '`PUT /api/tabs/:id/content` while a tab is in suggesting mode now renders in the visual editor and XML pane straight away, with no mode toggle required. Previously, the sync bridge buffered the incoming content behind the suspension that protects live tracked-change marks, and nothing flushed that buffer — leaving the tab blank with no indication anything had gone wrong. The fix applies API whole-document replacements immediately regardless of focus; the new content becomes the base document, and any further edits in suggesting mode are tracked against it.',
          'If an API replacement discards unresolved suggestions, a toast reports how many were lost rather than letting them disappear silently.',
        ],
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-08-04',
    title: 'Every dialog now closes with Escape and keeps your keyboard inside it, and Heretto stops reporting problems that were never there.',
    sections: [
      {
        heading: 'Accessibility',
        items: [
          'Escape now closes every dialog. In the Confirm, New Topic, and Download Warning dialogs it did nothing at all: the key handler sat on an element that never held focus, so the keystroke never reached it.',
          'Tab now stays inside the open dialog instead of wandering into the page behind it, and when a dialog closes, focus returns to whatever you were on before it opened. Both behaviours come from one shared **Modal** component rather than being re-implemented per dialog (WCAG 2.1.2, 2.4.3).',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Saving a topic that was loaded through the API no longer reports a false "remote content differs". Heretto injects `class` attributes on ingest, and the save check was comparing them against your local copy: the same attribute strip that Replace already used is now applied to both sides before comparing.',
          'Refresh and the remote-change poll can no longer overwrite a topic with an error page. Both now confirm Heretto actually returned XML before touching your content — previously an HTML error response would be written straight into the tab **and** into the saved-state reference.',
          'Content sent to a running editor is no longer lost when a single poll fails. The external-load loop treated one non-OK response as permanent and stopped forever, silently discarding everything queued after it; it now keeps polling.',
        ],
      },
      {
        heading: 'Improvements',
        items: [
          'Release notes render `code` and **bold** inline, and the modal closes with an X button in the top-right corner instead of a full-width button at the bottom.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'API responses from the native bridge now carry an explicit `httpStatus`, which the Swift server reads directly instead of guessing the HTTP status by searching the response text for phrases like "not found". Any error message that happened to contain those words previously changed the status code.',
          'New `components/Modal.tsx` owns overlay, focus trap, focus restore, document-level Escape, and ARIA wiring; `ConfirmModal`, `TopicTypeModal`, and `DownloadWarningModal` are now thin wrappers over it.',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-07-17',
    title: 'Suggesting mode: tracked changes are now real data: insertions, deletions, and splits you can accept or reject one by one.',
    sections: [
      {
        heading: 'New',
        items: [
          'The pencil button is now a three-way mode control: **Viewing** (read-only), **Suggesting** (edits become tracked changes), and **Editing** (direct edits). In Suggesting mode, typed text shows green underlined, deleted text stays visible with red strikethrough, and pressing Enter marks the paragraph split with a small pilcrow.',
          'A tracked-changes panel docks to the right edge of the editor whenever suggestions exist: every change listed with its text, kind, and time. Click a row to jump to it, or accept/reject each change individually. Accept All / Reject All live in the toolbar with a live change counter.',
          'Every change is durable data in the document model (`TrackedTextNode` carrying a change ID, author, and timestamp), not pixels recomputed from a diff. Deleting your own suggestion retracts it. Backspacing right after your own paragraph split undoes that split.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Edits that never showed as edits, accepted edits that failed to persist, flickering deletion markers, and the multi-tab highlight collision are all gone by construction: the diff-and-paint machinery (`EditModePlugin`, `TrackedChangesPlugin`, `TrackedDeletionNode`, the per-keystroke LCS diff, CSS Custom Highlights, and raw DOM overlays) has been deleted. Rejecting all suggestions restores the document byte-for-byte; accepting them produces exactly what typing the same edits directly would.',
        ],
      },
      {
        heading: 'Known Limits',
        items: [
          'Tracked changes are session-only. Resolve them before saving to Heretto (a DITA round-trip carrier is a planned follow-up).',
          'In Suggesting mode these are blocked with a toast rather than silently untracked: formatting toggles (Bold/Italic), line breaks, paragraph merges, drag-and-drop, structural inserts, deleting embedded elements (images, ref chips), and IME composition.',
        ],
      },
    ],
  },
  {
    version: '0.8.9',
    date: '2026-07-17',
    title: 'Polish sweep: native-safe clear dialog, serializer performance, and multi-tab edit mode fixes.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'The Clear Contents button now uses the standard confirm modal instead of `window.confirm`, which was silently returning false in the native app (WKWebView has no `WKUIDelegate` wired up, so `window.confirm` always cancels). The button now works in the native app.',
          'The visual editor no longer re-serializes the full document on every caret move or selection change. `OnChangePlugin` now ignores selection-only changes, so only real content edits trigger a round-trip.',
          'The "Last update" indicator in the header now correctly shows "API" (with a green dot) when content was last written by the insert-section API. Before, it showed "Source Code" for all non-editor sources.',
          'Creating a shortdesc by pressing Enter at the end of the title now reliably works after deleting and recreating a shortdesc. The plugin was checking a stale originMap entry whose node had already been removed from the tree.',
          'With two tabs open in Edit Mode simultaneously, each tab now uses an isolated CSS highlight channel for tracked insertions. Before, the second tab\'s highlights overwrote the first tab\'s.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Per-tab `::highlight()` CSS rules are injected dynamically at mount and cleaned up at unmount, replacing the single document-global `tracked-insert` key.',
          'Dead `lib/dita-utils.ts` and `types/dita-block.ts` removed. They were only ever imported by their own test file and had no production consumers.',
          'v0.4.0 release notes corrected: the `format` and `stats` endpoints listed there were part of the port-3000 tab API that was never functional (ADR-007). The note now describes the native API accurately.',
        ],
      },
    ],
  },
  {
    version: '0.8.8',
    date: '2026-07-17',
    title: 'API insertions are now reviewed as a precise Monaco XML diff: reliable, validated, byte-exact.',
    sections: [
      {
        heading: 'New',
        items: [
          'When an AI tool or skill proposes content via the insert-section API, the XML pane now shows a read-only red/green Monaco diff with an Accept/Reject bar. What you review is byte-for-byte what gets committed. No more green-highlight edit mode for API insertions.',
          'The Heretto Replace preview diff now strips Heretto-injected class attributes, so the comparison against the live remote topic shows your actual content changes instead of attribute noise.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'API insertions are now reliable with any number of tabs open. The previous implementation silently did nothing when targeting any tab except the most recently opened one.',
          'The API returns success only after the fragment and the resulting document pass validation. Previously it reported success 50 ms before validation ran.',
          'Inserted figures, images, and examples survive accept and save. Previously they could vanish because the accept path re-serialized through the visual editor.',
          'Targeting a replaceId that does not exist is now an explicit error instead of silently appending the content at the end.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'New lib/xml-insert.ts computes the proposed document by string splicing; untouched content stays byte-identical, so the review diff shows only the actual change (ADR-004 track 1; FR-045). SectionInsertPlugin, the module-level executor slot, and the 50 ms timing race are retired. 19 new tests.',
        ],
      },
    ],
  },
  {
    version: '0.8.7',
    date: '2026-07-17',
    title: 'Serializer fixes: formatting-only edits, table row add/delete, inline element stamping.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'Formatting-only edits (bold/italic/codeph toggles) now serialize correctly instead of being silently discarded.',
          'Table row add/delete in the visual editor now reaches the XML (append/remove phases added to CALS and simpletable walkers).',
          'All inline elements (filepath, term, codeph, uicontrol, etc.) now survive round-trip rewrites instead of flattening to plain text.',
          'Note type attribute (warning, caution, tip) now preserved on recreate.',
          'Xref attributes (scope, type, format) now preserved via originMap instead of being rewritten.',
          'Spurious xmlns attributes no longer corrupt codeblocks containing the literal XHTML namespace string.',
          'Readability score no longer becomes NaN on words like "constructor".',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Five serializer mediums (noteType, inlineAttrs, stripSpuriousXmlns, dl-split, generic inlineTag stamping) plus prototype-chain fix. Byte-stability corpus 9/9, suite green.',
          'Technical debt D2 (flushInline consolidation) and D3 (PI-whitespace triplication) identified and filed for future cleanup.',
        ],
      },
    ],
  },
  {
    version: '0.8.6',
    date: '2026-07-17',
    title: 'Save API now correctly reports failure when a Heretto save fails.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          '`POST /api/tabs/:id/save` no longer returns `{success: true}` when the Heretto PUT fails (HTTP 500, network error, etc.). The error is now propagated to callers so the altitude-release-notes workflow and other API consumers can detect and handle save failures correctly.',
          'Passing an unknown tab ID to the save API now returns an explicit error instead of silently saving the wrong (active) tab.',
        ],
      },
    ],
  },
  {
    version: '0.8.5',
    date: '2026-07-17',
    title: 'Security hardening: loopback-only bind, path traversal guard, plaintext credential protection.',
    sections: [
      {
        heading: 'Security',
        items: [
          'The native app HTTP server now binds to 127.0.0.1 only (loopback), making the API unreachable from the LAN. Removed wildcard CORS header (the API is for local tools only).',
          'The `dita://` static file handler now validates that resolved paths stay inside the `dist/` directory, blocking `../../../etc/passwd` traversal attempts.',
          'Credentials endpoints (native and dev server) no longer return the Heretto API token. They return only `{email, hasCredentials}` so the token never travels over the network. The Settings modal token field starts blank. Users must re-enter their token to save, which is correct security practice for any credential.',
          'Added a 10 MB request size cap to the native HTTP server to prevent resource exhaustion.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Synced `Info.plist` `CFBundleShortVersionString` to match the actual app version (was stuck at a retired version number).',
        ],
      },
    ],
  },
  {
    version: '0.8.4',
    date: '2026-06-11',
    title: 'Step info content now renders nested under each step instead of as a placeholder chip.',
    sections: [
      {
        heading: 'Improvements',
        items: [
          'When a procedure step carries supplementary `<info>` content (a code sample, a note, or an extra explanation), the visual editor previously showed only a small placeholder chip like `[codeblock]` or `[info: 2 elements]`. That content now renders as a read-only preview nested beneath the step, so you can see the code, note, or paragraph in context without switching to the XML pane. Editing the info content still happens in the XML pane; the preview is display-only and never alters your saved file.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'The info preview serializes to nothing. The original `<info>` element is left byte-for-byte untouched on save. Two new round-trip tests confirm a step with `<info>` (codeblock + note) is byte-stable and that editing a step command leaves the sibling `<info>` undisturbed (P2-26 Phase 2).',
        ],
      },
    ],
  },
  {
    version: '0.8.3',
    date: '2026-06-11',
    title: 'Definition lists now render in the visual editor instead of collapsing into a wall of text.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'Definition lists (`<dl>`) were invisible in the visual editor. When you opened a topic that used a definition list (a list of terms, each paired with a definition); the terms and definitions collapsed into one undifferentiated run of prose, and anything nested inside a definition (a table, a note, extra paragraphs) was dragged into that same flattened text. The XML pane showed the structure correctly, but the visual side was unreadable. Definition lists now render with each term emphasized and its definition indented beneath it, and block content inside a definition (tables, notes, paragraphs) renders normally. The non-standard `<p><dl>…</dl></p>` wrapper that Heretto authors is handled transparently.',
          'While fixing the above, two related content-loss bugs surfaced and were also fixed. An inline element such as `<ph conkeyref>` or `<uicontrol>` was silently dropped when it sat in the same paragraph as a block element. On save, the conkeyref vanished. And an `<image>` placed inside a paragraph could knock the following paragraph out of the saved output entirely. Inline images are now treated as inline content (so they round-trip in place), and inline references and controls are preserved regardless of what else shares their paragraph.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Five new round-trip tests covering definition lists: bare `<dl>`, the `<p>`-wrapped form, a definition containing a nested table and note, editing a term in place, and a definition paragraph mixing a conkeyref, a uicontrol, and an inline image followed by sibling content (BUG-01).',
          'Verified end-to-end against the real Journey Definition topic from Heretto. The `<dl>` structure, conkeyrefs, uicontrols, the six-row table, the note, and the inline image all round-trip without data loss or a stray XHTML namespace.',
        ],
      },
    ],
  },
  {
    version: '0.8.2',
    date: '2026-06-04',
    title: 'Inserting blocks with the + tool and pushing content through the API no longer corrupt your topic with a stray XHTML namespace.',
    sections: [
      {
        heading: 'Bug Fixes',
        items: [
          'When you inserted a paragraph, note, code block, or image using the + hover button, accepted the tracked change, and then saved to Heretto, the topic sometimes came back with a stray XHTML namespace (`xmlns="http://www.w3.org/1999/xhtml"`) attached to the inserted elements. Heretto rejected those saves with an HTTP 500. The same corruption could happen when you pushed updated XML through the `PUT /api/tabs/:id/content` endpoint and a freshly introduced element (such as a note that wasn\'t in the topic before) went through a Lexical round-trip before being serialized. Both are fixed: the serializer now strips the XHTML namespace unconditionally (it should never appear in DITA output), and the + tool now stamps each inserted block with its correct DITA identity so the serializer produces clean output from the start.',
          'When you opened a Heretto topic that had an `<xref>` inside a `<note><p>` (the common authoring pattern), the link silently disappeared. The visual editor showed the note\'s text with the link text flattened in, but with no underline and no href. The parser was treating the `<p>` inside a note as an unrecognised inline element and collapsing its content to plain text. The xref is now preserved as a proper clickable link.',
          'When you pushed replacement XML through `PUT /api/tabs/:id/content` where the new content had fewer body elements than the original (for example, replacing three paragraphs with a single note), the extra paragraphs from the old version remained in the output alongside the new note. The serializer\'s DOM walk was exiting early once all the new Lexical nodes were matched and leaving the leftover elements in place. Unmatched recognized body elements are now removed after the walk, so the PUT result contains only the new content.',
        ],
      },
      {
        heading: 'Under the Hood',
        items: [
          'Five new round-trip tests covering paragraph, note, list, and codeblock block insertion (P1-17) and the API push round-trip (P1-18).',
          'Three new round-trip tests from the bug sweep: xref-in-note parse and serialize fidelity (P2-46); PUT replace producing only new content when master has more elements (P2-45); table with `cols="1"` but two entries per row round-tripping as a 2-column table (P2-47 regression guard).',
        ],
      },
    ],
  },
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
        heading: 'New',
        items: [
          '`POST /api/tabs/:id/insert-section` lets an AI tool send a `<section>` fragment to one of your open tabs. The new content appears right where you are working, highlighted in green as a tracked insertion. The tab drops into Edit Mode automatically so the only thing left for you to do is click `Accept` to keep the section or `Reject` to throw it away. This is built for AI tools that want to suggest a chunk of new content without overwriting your whole topic.',
          'When the request comes in, the editor validates the XML, captures a snapshot of your current document, and appends the new section into the live tree. Because the snapshot did not include the new nodes, the tracked-changes system marks them with the same green styling you already see when you make manual tracked edits. Nothing else in your document moves or changes color. Only the newly added section is highlighted.',
        ],
      },
      {
        heading: 'API',
        items: [
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
        heading: 'New',
        items: [
          'Press `?` (or `Cmd+/` on Mac, `Ctrl+/` on Windows and Linux) to open a cheat sheet that lists every keyboard shortcut grouped by category: Sync, XML editor, Modals. You can also reach it from `File Options` then `Keyboard shortcuts` if you prefer the mouse. The shortcuts have been there for a while, but they were essentially invisible unless you read the source code.',
          'The release notes window now has a version selector along the left side so you can flip through every shipped release, not just the latest one. When the window opens it still lands on the newest version, and the existing one-shot "show on version bump" behavior is unchanged.',
          'The first time you open a tab, a small hint appears over the editor split: `Edit here or in the XML pane. Press Ctrl+Enter to sync`. It goes away the moment you sync successfully or close it, and you never see it again. New writers no longer have to guess at the two-pane model.',
        ],
      },
      {
        heading: 'Polish',
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
          'Keyboard shortcuts are now registered in a single source of truth (`constants/keyboard-shortcuts.ts`). Future shortcuts only need to be added once; the cheat sheet reads directly from the registry.',
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
        heading: 'New',
        items: [
          'Your content now sits on a visible "page" that floats on a contrasting "canvas" background, just like every modern writing tool. Light theme gets a soft drop shadow, the dark themes get a clean border. The two surfaces are tuned per theme so they always read clearly against each other.',
          'Prereq, context, result, and postreq sections now render as fully bordered boxes that are always visible. Hovering one lights up the left border in its accent color and fades in a small label chip at the top left. Because the border space is always reserved, the layout no longer jumps when you hover over a section. The old hover-reveal treatment had a small but irritating shift.',
          'The floating `SHORT DESCRIPTION` label is gone. When the short description is empty, a soft italic placeholder now appears right where you would start typing, and disappears the moment you do. Standard placeholder behavior, finally on the field that needed it most.',
          'Hover any block in the visual editor and a + button appears in the left margin, in the canvas gutter just outside the page. Click it to open a searchable menu: Paragraph, Bulleted list, Numbered list, Note, Code block, Table, Image, and Link. Type to filter, press Enter or click to insert, and the new block drops in right after the one you hovered. Table and Link open their usual dialogs. The rest insert in place.',
        ],
      },
      {
        heading: 'Improvements',
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
        heading: 'New',
        items: [
          'Drag the handle between the visual editor and the XML pane to set the split to whatever ratio your current task needs. It is clamped between 20% and 80% so neither side can disappear, and your chosen width is remembered across sessions. The old 50/50 split was fixed.',
          'A new word wrap button in the XML toolbar wraps long lines to the pane width instead of letting them run off the right edge. Toggling is immediate and your preference sticks. Deeply nested or attribute-heavy elements no longer require horizontal scrolling just to read a single tag.',
        ],
      },
      {
        heading: 'Polish',
        items: [
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
        heading: 'New',
        items: [
          '`File Options` now has a `Print / Export PDF` item. Click it and your topic opens in a clean print window with proper A4 layout, ready for the browser print dialog. Save as PDF from there. The output is a real document: Inter for body text, JetBrains Mono for code, colored note borders for Warning, Caution, Danger, and Tip, prereq/context/result blocks with their labeled left bars, and bordered tables. Steps render as a numbered list with substeps as a lettered sub-list. Before this, printing meant using the browser`s File then Print on the live editor, which rasterized fonts, Monaco internals, and the whole Lexical DOM into a 10MB+ file for a single page of text.',
          'The print serializer now handles the full DITA element set: CALS tables (`<tgroup>`, `<thead>`, `<tbody>`, `<row>`, `<entry>`), simple tables, definition lists, figures with captions, inline elements (`<uicontrol>` as `<kbd>`, `<filepath>`, `<varname>`, `<cmdname>` as monospace, `<xref>` as linked text), footnotes, and every note type. Unknown elements pass their children through transparently instead of dropping content silently.',
          'If your browser blocks the pop-up, you now see `Print blocked. Allow pop-ups for this site` instead of a silent failure.',
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
        heading: 'New',
        items: [
          '`<xref>` elements now render with an underline in the visual editor so they actually look like the cross-references they are. This sounds like a small CSS tweak, but it unblocked the whole validation layer. The broken-xref red wavy underline and the unresolved-keyref highlight both assumed you could already see where your cross-references were. You could not. The alarm system was built before the house.',
          'The default `Task title` and `Short description of the task.` text now renders muted and italic so it looks like a placeholder, not real content. Until now there was no visual cue that the field needed your attention.',
          'When you convert a new tab from one topic type to another, the template title and short description now swap to match the target type. `Task title` no longer survives a task to concept conversion. If you have already edited those fields, your text is left exactly as it is.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'The Heretto connected indicator was lying when your `~/heretto.json` was missing at startup. The Vite proxy never registered, so any request to `/heretto-api/…` quietly returned the SPA `index.html` at HTTP 200. The old check saw a 200 and lit the green dot. The new check also verifies the response carries an `application/xml` content-type, because an HTML body is never a valid Heretto reply. This was the first lie in a two-step failure: the status said `Connected`, and then the save fell apart.',
          'When a save failed and the server returned an HTML page, the toast used to read `Failed to save to Heretto: Failed to save (HTTP 500) <!DOCTYPE html>…`. You now see `Heretto returned an unexpected response. If you just added credentials, restart the dev server and try again.` That is the second lie fixed.',
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
        heading: 'New',
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
        heading: 'New',
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
          'Links in the visual editor now show a tooltip on hover: `Links open in published output, not in the editor.` so you understand why clicking a link in edit mode does not navigate. The pointer cursor was already telling you it was interactive. The reason it did not respond was missing.',
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
        heading: 'New',
        items: [
          'Images referenced with relative paths (like `../images/diagram.png`) now resolve and display as real images in the visual editor. You see a shimmer placeholder while the image loads, and the original relative href is preserved in the XML on save.',
          'Broken `<xref>` targets show a red wavy underline, and unresolved keyrefs get a yellow highlight. Validation runs automatically after each sync and updates in real time as you edit. Errors are tracked per tab with no impact on the XML source.',
        ],
      },
      {
        heading: 'Bug Fixes',
        items: [
          'Freshly opened topics used to show a false `Updated in Heretto` conflict warning that was actually just whitespace differences between your local beautified XML and the raw XML from Heretto. The check now normalizes whitespace before comparing.',
          'The status bar label `Conflict: updated in Heretto` now reads `Changes in both locations`, matching the writer-friendly vocabulary used elsewhere in the UI.',
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
        heading: 'New',
        items: [
          'Click the table icon in the toolbar to create a new DITA table. Pick rows (up to 50), columns (up to 10), and whether you want a header row. The output is valid DITA CALS with proper colspec elements.',
          'AI tools like Claude Code can now edit your content and trigger saves through the native API: `PUT /api/tabs/:id/content` (update the XML) and `POST /api/tabs/:id/save` (save to Heretto). This closes the read-write loop the read endpoints started.',
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
          'Native API bridge expanded with write callbacks for content update and save.',
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
        heading: 'New',
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
        heading: 'New',
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
        heading: 'New',
        items: [
          'Prereq, context, result, and postreq blocks now have color bars on the left edge and hover labels. You can tell which DITA element you are in without switching to the XML pane.',
          'The Light theme shifted from cool Slate to warmer Stone tones. Same clarity, easier on the eyes for long sessions.',
        ],
      },
      {
        heading: 'Polish',
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
        heading: 'New',
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
        heading: 'New',
        items: [
          'Edits in the visual editor no longer silently drop attributes, processing instructions, or comments. Round-trip fidelity is now guaranteed.',
          'Fixed a bug that caused false `unsaved changes` warnings after a successful save.',
          'Heretto saves preserve the remote formatting instead of re-serializing the topic from scratch.',
          'Import now does an integrity check. Topics are fetched twice and compared before opening so you do not start work on a corrupted load.',
          'A new Edit Mode. Click the pencil icon to isolate your changes before committing them to the document. Typed insertions are highlighted word-level, and deletions render inline with strikethrough so you can see exactly what you removed. Accept merges your changes into the XML source. Reject restores the snapshot from before you started editing.',
          'Full keyboard navigation across every dropdown menu: arrow keys, Escape, and proper focus management. All modals trap focus, respond to Escape, and carry the right aria-modal attributes.',
          'Multi-tab support. Open several topics side by side, each with its own undo history and sync state.',
          'The status bar shows word count, character count, readability score, encoding, and DITA version.',
          'File browser with breadcrumb navigation, folder-scoped search, and progress indicators. Save new topics to any Heretto folder, or overwrite existing files.',
          'Background polling detects remote changes and shows a change indicator.',
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
