# DITA Architect Release Notes Style Guide

**Maintainer:** Maya Chen  
**Last updated:** 2026-07-20  
**Applies to:** All entries in `constants/version.ts` → `RELEASE_NOTES`

---

## Purpose

This guide governs the voice, structure, and formatting of DITA Architect release notes. Release notes are Maya Chen's domain. She authors every entry and owns the final wording. This guide captures the standards she writes to, so the voice stays consistent across versions and any review or handoff has a clear reference.

---

## Who Maya Chen is

Maya Chen is a UX engineer at Cybergymnastics Inc. and a former technical writer. She brings four years of documentation experience to every release entry — but she reads the world through a UX lens now, which means she cares as much about the sentence a user reads as the feature it describes.

Her background shapes how she writes release notes:

- She was a technical writer before she was an engineer. She knows what authors need to understand a change, not just what developers want to announce.
- She is obsessive about microcopy: error messages, empty states, tooltips, modal button labels. When a release note mentions a UI string, she quotes it exactly and explains why the wording matters.
- She writes for the person sitting at the editor, not for the person who built it. Technical details belong in **Under the Hood**. Everything else is addressed to the author opening a topic.
- She has used DITA Architect as a writer herself, including a full authoring session against a live Heretto topic. She knows which friction points matter and which are just growing pains.

When in doubt, ask: would Maya — a former tech writer who cares deeply about author experience — find this useful, clear, and respectful of the reader's time? If not, rewrite it.

---

## Maya's voice

Maya's entries have a recognizable character beyond second-person active voice. These qualities distinguish her writing:

**She describes what the user experiences, then explains why.** She does not lead with the root cause. A bug fix starts with what was broken from the author's point of view, then traces it back to the underlying issue only if that context helps the reader understand the scope.

**She names the old behavior before the new one.** The reader is upgrading from the old behavior. Acknowledging what used to happen — and why it was a problem — gives the fix meaning. A bare "X now works correctly" is less useful than "X used to do Y, which caused Z. It now does W."

**She is specific about UI copy.** When a change affects something the user reads or clicks, she quotes it exactly in backticks. She does not paraphrase UI strings — she reproduces them.

**She uses contrast to clarify.** "Before, the status bar stayed on `Unsaved changes` after a successful save. It now updates immediately." The before/after structure is one of her most frequent patterns. It earns its length because the reader immediately understands the delta.

**She is warm but not chatty.** Her sentences are friendly and direct. She does not pad with phrases like "we're excited to announce" or "this powerful new feature." She trusts the change to speak for itself once it's explained clearly.

**She writes short paragraphs.** A bullet that runs to four or five sentences is a sign that something either needs to be split or belongs in a different section.

**Examples of Maya's voice in practice:**

- `The Clear Contents button now uses the standard confirm modal instead of \`window.confirm\`, which was silently returning false in the native app (WKWebView has no \`WKUIDelegate\` wired up, so \`window.confirm\` always cancels). The button now works in the native app.`
- `The "Last update" indicator in the header now correctly shows "API" (with a green dot) when content was last written by the insert-section API. Before, it showed "Source Code" for all non-editor sources.`
- `Drag the handle between the visual editor and the XML pane to set the split to whatever ratio your current task needs. It is clamped between 20% and 80% so neither side can disappear, and your chosen width is remembered across sessions. The old 50/50 split was fixed.`

---

## Voice and tone

Write in **second person, present tense, active voice**. Address the reader as "you" — the person using the app.

- **Do:** `The editor now renders definition lists correctly.`
- **Do:** `You can now resize the split between the visual editor and the XML pane.`
- **Don't:** `Definition lists have been rendered correctly.` (passive)
- **Don't:** `The developer fixed a bug where definition lists did not render.` (third person, past tense)

Keep sentences direct. If a sentence runs long, split it rather than patching it with punctuation.

---

## Em-dashes — prohibited

**Do not use em-dashes (—) anywhere in release notes.** This rule applies to current and future entries.

The Geotab Written Style Guide states: *"Avoid using the Em-Dash in our documentation as it is associated with AI-generated content."*

**Replacements by use case:**

| What the em-dash was doing | Replace with |
| :--- | :--- |
| Introducing a list or elaboration | Colon (`:`) |
| Joining two independent clauses | Period. Start a new sentence. |
| Wrapping a parenthetical aside | Parentheses `()` |
| Connecting a cause to its effect | Semicolon (`;`) or period |
| Appending a consequence | Period or comma |

**Examples:**

- Before: `Changes are durable data — not pixels recomputed from a diff.`
- After: `Changes are durable data, not pixels recomputed from a diff.`

- Before: `The diff — reliable, validated, byte-exact — is what you review.`
- After: `The diff (reliable, validated, and byte-exact) is what you review.`

En-dashes (–) are also prohibited per the Geotab style guide. Use a hyphen for ranges.

---

## Punctuation

Follow the Geotab Written Style Guide:

- **Serial comma:** Always use it. `Accept, reject, or skip.`
- **Hyphens:** Use for compound modifiers. `byte-for-byte`, `read-only`, `well-formed`.
- **Contractions:** Acceptable for a warm, approachable tone. `you'll`, `it's`, `doesn't`.
- **Ellipsis:** Avoid in prose. Acceptable inside backtick-quoted UI strings only when the UI itself uses it.

---

## Note types

Notes in release notes have a specific purpose: to surface information the reader must not miss, or that would otherwise be buried in prose. Use them sparingly.

### Available types

| Type | When to use |
| :--- | :--- |
| **NOTE** | Neutral information that adds context but is not urgent. A caveat, a side effect, a current limitation that the reader should be aware of. |
| **WARNING** | Behavior that could cause data loss, a broken workflow, or an irreversible action. |
| **TIP** | A shortcut, a power-user pattern, or an alternative path that saves time. |
| **IMPORTANT** | A prerequisite or a step the reader must not skip. Use for setup requirements or migration steps. |

### Rules for using notes

1. **Do not use NOTE as a catch-all.** If the information fits naturally in the prose, put it in the prose. Reserve NOTE for things that would be missed if buried.

2. **One note per release entry.** If you find yourself writing two notes for a single bullet, the bullet is probably trying to do too much.

3. **No note-only bullets.** A note should supplement a prose bullet, not replace it. If the entire bullet is a NOTE, fold it into the preceding sentence.

4. **Match the type to the stakes.** Reserve WARNING for real risk. Overusing WARNING dilutes it.

### Formatting

Notes in release notes use a simple inline label, consistent with how they appear in the rendered modal:

```
NOTE: Tracked changes are session-only. Resolve them before saving to Heretto.
```

```
WARNING: Accepting all suggestions is irreversible within a session. Save a copy first.
```

The label is uppercase, followed by a colon, followed by the note text. No bullet, no box — the renderer handles the visual treatment.

---

## Section headings

Section headings group bullets within a release version. Use the following set consistently:

| Heading | What belongs here |
| :--- | :--- |
| **New** | Net-new features and capabilities. |
| **Improvements** | Enhancements to existing features. Use when the change makes something meaningfully better but does not add a new capability. |
| **Bug Fixes** | Defects that were corrected. |
| **Security** | Hardening, credential handling, access control, path traversal fixes. |
| **API** | Changes to the HTTP API surface: new endpoints, parameter changes, response changes. |
| **Under the Hood** | Refactors, test additions, dead code removal, infrastructure changes. Nothing visible to the user. |
| **Polish** | Copy improvements, layout tweaks, tooltip clarifications, empty state text. No behavior change. |

**Rules:**

- Use **New**, not **New Features** or **What's New**.
- Use **Bug Fixes**, not **Fixes** or **Fixed**.
- Do not invent new headings unless none of the above fit. If you must, keep it to one or two words.
- Do not repeat a heading within a single version entry.

---

## Version titles

The title is a single sentence that names the most significant thing shipped. It appears in the version selector and as the first thing a reader sees.

- Write in past tense or as a declarative statement. `Tracked changes are now real data.`
- Lead with the user benefit, not the implementation. `The editor now renders definition lists correctly.` not `dl rendering fixed in Lexical parser.`
- Keep it under 120 characters.
- No em-dashes, no exclamation marks.

---

## Bullet length and structure

Each bullet should cover one change. If a bullet requires more than three sentences to explain, consider whether the change warrants its own section heading.

A good bullet:

1. States what changed (one sentence).
2. Explains why it matters or what the old behavior was (one or two sentences, only if necessary to understand the fix).
3. Optionally, names the scope (e.g., "in the visual editor", "for API callers").

Avoid developer-internal framing unless the entry is in **Under the Hood**. A bug fix bullet should describe the author experience, not the code path.

- **Do:** `The Clear Contents button now uses the standard confirm modal instead of \`window.confirm\`, which was silently returning false in the native app.`
- **Don't:** `Fixed WKWebView-incompatible \`window.confirm\` call in ClearContentsHandler by routing through native Swift delegate.`

---

## Capitalization

- Sentence case for bullets. Capitalize the first word only, plus proper nouns.
- **UI element names** exactly as they appear in the app: `Accept All`, `Reject All`, `Save to Heretto`, `File Options`.
- **DITA element names** in backticks: `` `<note>` ``, `` `<xref>` ``, `` `<info>` ``.
- **API endpoints** in backticks: `` `POST /api/tabs/:id/insert-section` ``.
- **File names and code identifiers** in backticks: `` `constants/version.ts` ``, `` `OnChangePlugin` ``.

---

## What not to include

- Internal ticket numbers (BUG-xx, P2-xx, ADR-xx) in user-visible bullets. Use them in **Under the Hood** only.
- Agent pipeline details. `9-agent workflow` is not reader-relevant outside of **Under the Hood**.
- Version numbers of dependencies. If a library update matters to users, describe the effect, not the semver bump.
- Speculation about future work. Mention planned follow-ups only in **Known limits** or **Under the Hood** sections.

---

## Alignment with Geotab Written Style Guide

This guide extends the [Geotab Written Style Guide](https://docs.google.com/document/d/1NNJcLMaqFqsx0ZqYwdyI6aHziX73gNSSARLY-MdeWyk/edit) (v7.1, April 2025). Where this guide is silent, defer to Geotab's guide. Key rules carried over:

- American English spelling (`color`, not `colour`).
- Active voice preferred over passive.
- Avoid "please" and "simply".
- Avoid Latin abbreviations (`e.g.` → `for example`, `i.e.` → `that is`).
- Avoid `click here` as link text — but link text is rare in release notes prose.
- No numbered headings.
