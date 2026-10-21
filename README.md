# DITA Architect

A lightweight DITA editor. Write in a visual editor on the left, see the XML source on the right — changes sync between both sides as you work.

Available in two forms: a **browser app** you run with Node.js, and a **native macOS app** built from the Swift shell in `macos/`. Both use the same web frontend.

## What You Can Do

**Write visually.** The left pane is a rich text editor. Bold, italic, lists, tables, notes, code blocks — they all render the way your readers will see them. You don't need to think about XML tags while you're writing.

**See the XML when you need it.** The right pane shows the raw DITA source with syntax highlighting, auto-completion, and one-click formatting. Edits in either pane sync to the other automatically, or press Ctrl+Enter to sync manually.

**Work with tables without touching XML.** Right-click any table cell to insert or delete rows and columns. Works for both CALS tables and simpletables.

**Open topics from Heretto.** Browse your Heretto CMS folders, search for topics, open them in the editor, and save changes back. The editor detects when someone else edits the same topic while you're working.

**Replace topics in Heretto.** Draft a new version of a topic, preview a side-by-side diff against the live version, and replace it when you're ready.

**Mark up inline elements.** Select text and wrap it in a UI control, code phrase, phrase, term, file path, window title, or cross-reference from the tag-icon menu in the toolbar, or press Ctrl/⌘+Shift+U (`<uicontrol>`) or Ctrl/⌘+Shift+C (`<codeph>`). `Remove inline element` takes one off again. Only the element you add changes in the XML; everything else in the paragraph is written back byte-for-byte.

**Track your changes.** Switch the document mode control between Viewing (read-only), Suggesting (your edits become tracked insertions and deletions you can accept or reject one by one, or all at once), and Editing (direct edits).

**Know when a sync loses something.** If the XML ever ends up with fewer links, notes, lists, tables, or inline elements than the visual editor shows, a warning tells you to check the source pane.

**Work with multiple topics.** Open several topics in tabs. Each tab has its own undo history and sync state.

**See where you are in the structure.** Hover over a paragraph in the visual editor to see which DITA element it belongs to — `CONTEXT`, `RESULT`, `PREREQUISITE`, `POSTREQUISITE` — with color-coded left-edge bars.

**Spot unresolved references.** Conkeyrefs, keyrefs, and conrefs that can't be resolved show up as labeled chips (e.g., `[conkeyref: glossary/term]`) instead of blank space.

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
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl/⌘+Shift+U | Wrap the selection in `<uicontrol>` |
| Ctrl/⌘+Shift+C | Wrap the selection in `<codeph>` |
| Ctrl+Enter | Sync XML to visual editor |
| Shift+Alt+F | Format (beautify) XML |
| Ctrl+S | Save to Heretto (when connected) |
| ? or Ctrl+/ | Open keyboard shortcut reference |
| Escape | Close modal or dismiss menu |

## Supported DITA Elements

The visual editor renders these elements as formatted content:

- **Headings:** `<title>`, `<shortdesc>`
- **Body:** `<p>`, `<note>`, `<section>`, `<prereq>`, `<context>`, `<result>`, `<postreq>`
- **Lists:** `<ol>`, `<ul>`, `<li>`, `<steps>`, `<step>`, `<cmd>`
- **Tables:** `<table>` (CALS), `<simpletable>`
- **Media:** `<fig>`, `<image>`, `<codeblock>`
- **Inline:** `<b>`, `<i>`, `<codeph>`, `<uicontrol>`, `<wintitle>`, `<xref>`, `<ph>`, `<term>`, `<filepath>`, and any other leaf inline element (preserved with its attributes). `<term>`, `<filepath>`, and `<ph>` have no visual style yet (FR-068).

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
