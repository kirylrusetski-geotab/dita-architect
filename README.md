# DITA Architect

A daily-driver DITA editor. Write in a visual editor on the left, see the XML source on the right — changes sync between both sides as you work. Create a topic from a template, mark it up, connect a map for variables, and save to Heretto, without opening Heretto's own editor or hand-writing XML.

Available in two forms: a **browser app** you run with Node.js, and a **native macOS app** built from the Swift shell in `macos/`, with a menu bar (New/Open/Save/Export shortcuts, themes) and native PDF export. Both use the same web frontend.

## What You Can Do

**Write visually.** The left pane is a rich text editor. Bold, italic, lists, tables, notes, code blocks — they all render the way your readers will see them. You don't need to think about XML tags while you're writing.

**See the XML when you need it.** The right pane shows the raw DITA source with syntax highlighting, auto-completion, and one-click formatting. Edits in either pane sync to the other automatically, or press Ctrl+Enter to sync manually.

**Work with tables without touching XML.** Right-click any table cell to insert or delete rows and columns. Works for both CALS tables and simpletables. Notes, definition lists, figures, lists, and code blocks inside a cell show and edit just as they do in the body.

**Open topics from Heretto.** Browse your Heretto CMS folders, search for topics, open them in the editor, and save changes back. The editor detects when someone else edits the same topic while you're working.

**Replace topics in Heretto.** Draft a new version of a topic, preview a side-by-side diff against the live version, and replace it when you're ready.

**Mark up inline elements.** Select text and wrap it in a UI control, code phrase, phrase, term, file path, window title, or cross-reference from the tag-icon menu in the toolbar, or press Ctrl/⌘+Shift+U (`<uicontrol>`) or Ctrl/⌘+Shift+C (`<codeph>`). `Remove inline element` takes one off again. Only the element you add changes in the XML; everything else in the paragraph is written back byte-for-byte.

**Connect a map and insert variables.** Connect a Heretto map from the Heretto menu to load its key registry — chips for existing `conkeyref`/`keyref` references turn solid when they resolve, and the `{}` toolbar button inserts a new variable reference by picking a topic and one of its elements from the connected map.

**Track your changes.** Switch the document mode control between Viewing (read-only), Suggesting (your edits become tracked insertions and deletions you can accept or reject one by one, or all at once), and Editing (direct edits).

**Know when a sync loses something.** If the XML ever ends up with fewer links, notes, lists, tables, or inline elements than the visual editor shows, a warning tells you to check the source pane.

**Work with multiple topics.** Open several topics in tabs. Each tab has its own undo history and sync state.

**See where you are in the structure.** Hover over a paragraph in the visual editor to see which DITA element it belongs to — `CONTEXT`, `RESULT`, `PREREQUISITE`, `POSTREQUISITE` — with color-coded left-edge bars.

**Spot unresolved references.** Conkeyrefs, keyrefs, and conrefs that can't be resolved show up as labeled chips (e.g., `[conkeyref: glossary/term]`) instead of blank space.

**Catch a structural mistake before it reaches Heretto.** Saving, replacing, or an AI-drafted document that puts an element somewhere the DITA 1.3 content model doesn't allow — a `<fig>` inside a `<cmd>`, say — is blocked with the exact element, its parent, and the line it's on, not a guess.

**Choose your theme.** 6 app themes (Dark, Light, Claude, Nord, Solarized, Navy) and 7 syntax themes for the XML pane.

## Setup — Browser App

You'll need **Node.js** and **Git** installed. Clone the stable branch and start the dev server:

```
git clone https://github.com/kirylrusetski-geotab/dita-architect-stable.git
cd dita-architect-stable
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). That's it.

To update to the latest version:

```
cd dita-architect-stable
git pull
npm install
npm run dev
```

## Setup — Native macOS App

See [`macos/README.md`](macos/README.md) for build instructions. The native app runs the same frontend inside a WKWebView, adds a local HTTP API on port 3001, and proxies Heretto requests natively — no browser needed.

## Connecting to Heretto

DITA Architect works with any Heretto CMS instance. You'll need your instance hostname and a Heretto API token — generate one in your Heretto instance under Token Management (`https://<your-heretto-host>/tools/token-management/tokens.xql`, log in first).

Connect in two ways:

1. **From the app:** Click the Heretto icon in the toolbar and enter your Heretto host, email, and API token.

2. **From a file:** Create `~/heretto.json` with your credentials:

```json
{
  "host": "yourcompany.heretto.com",
  "rootUuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "email": "your.name@example.com",
  "token": "your-heretto-api-token"
}
```

| Key | What it is |
|---|---|
| `host` | Your Heretto instance's bare hostname. A leading `https://` or trailing `/` is tolerated and stripped. In dev-server mode the proxy target is read at startup, so restart `npm run dev` after changing it. |
| `rootUuid` | The UUID of the content folder the Heretto browser opens on. It is also what the connection check probes. Get it from your Heretto administrator or from the `id` attribute returned by `GET https://<host>/rest/all-files/<any-folder-uuid>` (walk `parent-folder-id` upward to reach the top). |
| `email`, `token` | Your Heretto login email and an API token. |

Without `rootUuid` the editor still works, but the Heretto browser and the connection indicator are disabled until you set one.

Without a Heretto connection the editor still works — create topics from templates, open local `.dita` files by dragging them into the browser, and save files locally.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl/⌘+B | Bold |
| Ctrl/⌘+I | Italic |
| Ctrl/⌘+Shift+U | Wrap the selection in `<uicontrol>` |
| Ctrl/⌘+Shift+C | Wrap the selection in `<codeph>` |
| Ctrl/⌘+Enter | Sync XML to visual editor |
| Shift+Alt+F | Format (beautify) XML |
| ? or Ctrl/⌘+/ | Open keyboard shortcut reference |
| Escape | Close modal or dismiss menu |

On macOS the modifier is ⌘; elsewhere it is Ctrl.

**The native macOS app also has a menu bar** (File, View, and the app menu), each item doing exactly what its in-app equivalent does:

| Shortcut | Action |
|---|---|
| ⌘N / ⇧⌘N / ⌥⌘N | New Task / Concept / Reference topic |
| ⌘O | Open a local `.dita`/`.xml` file |
| ⌘W | Close the active tab |
| ⌘S | Save to Heretto (opens the Save browser for a tab without a Heretto file) |
| ⌘\\ | Show/hide the XML pane |

File also has Replace in Heretto…, Export as PDF… (a real paginated PDF with page numbers, via a native save panel), Connect to Heretto…, and Open from Heretto…; View has Theme and XML Syntax Theme submenus with a check on the active one. New Troubleshooting topics and Convert Topic Type are reached through the in-app `New`/`Convert` dialogs, which list all four topic types (Convert intentionally does not offer Troubleshooting as a target — see `TopicTypeModal`'s `types` prop).

## Supported DITA Elements

The editor opens and saves **task**, **concept**, **reference**, **troubleshooting**, and generic **topic** files. `New Topic` creates all four of task, concept, reference, and troubleshooting from templates — each with a truly empty title and short description (the prompt you see is a visual hint, never saved text) and, for troubleshooting, a condition and a cause-and-remedy pair shaped like a real Heretto troubleshooting topic.

The visual editor renders these elements as formatted content:

- **Headings:** `<title>`, `<shortdesc>`
- **Body:** `<p>`, `<note>`, `<section>`, `<prereq>`, `<context>`, `<result>`, `<postreq>`
- **Lists:** `<ol>`, `<ul>`, `<li>`, `<steps>`, `<step>`, `<cmd>`, `<dl>` (definition lists)
- **Troubleshooting:** `<condition>`, `<troubleSolution>`, `<cause>`, `<remedy>` (each labeled in the editor), with `<steps>`, `<steps-unordered>`, or `<steps-informal>` in a remedy
- **Tables:** `<table>` (CALS), `<simpletable>`; a cell can hold paragraphs, lists, notes, definition lists, figures, code blocks, and nested tables.
- **Media:** `<fig>`, `<image>`, `<codeblock>`
- **Inline:** `<b>`, `<i>`, `<codeph>`, `<uicontrol>`, `<wintitle>`, `<xref>`, `<ph>`, `<term>`, `<filepath>`, and any other leaf inline element (preserved with its attributes). A menu path (`<menucascade>`) shows a separator between its steps. `<term>`, `<filepath>`, and a refless `<ph>` have no visual style yet (FR-068) — the XML pane always shows what's there.
- **Tracked changes:** suggestions made in Suggesting mode are Heretto's own review markup — they survive Save, Close, and Reopen, show in Heretto's editor as inline suggestions, and a suggestion made in Heretto opens here as a tracked mark you can accept or reject.

Elements the editor doesn't recognize are shown as labeled read-only blocks — they won't be lost or changed when you save.

## Repository Layout

```
/                        Web app source (React + TypeScript + Vite)
├── components/          UI components
├── constants/           DITA templates, keyboard shortcuts, release notes
├── hooks/               Editor state and UI hooks
├── sync/                XML ↔ Lexical serialization/deserialization
├── tests/               Vitest unit tests
├── macos/               Native macOS app (Swift)
│   ├── build.sh         One-command build script
│   └── Sources/         Swift source files
└── assets/              App icons and static resources
```

## Questions or Issues

Reach out to Kiryl Rusetski on Google Chat or file an issue in this repository.
