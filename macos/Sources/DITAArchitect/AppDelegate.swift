import AppKit
import WebKit
import UniformTypeIdentifiers

// MARK: – Menu table (ADR-016 decision 2)

/// One row per bridge-backed menu item. The table is the contract that
/// `tests/native-menu-wiring.test.ts` reads: keep one row per line, in this
/// argument order — title, key, modifiers, method, args — and add nothing
/// before `method`. Every row shares one selector, `runMenuAction(_:)`.
struct MenuAction {
    enum Check { case none, theme(String), syntaxTheme(String) }
    enum Native { case bridge, openPanel }

    let title: String
    let key: String
    let modifiers: [NSEvent.ModifierFlags]
    let method: String
    /// Ordered — passed to the JS method in exactly this order (a dictionary would
    /// sort them; adversarial review, finding 2).
    let args: KeyValuePairs<String, String>
    var check: Check = .none
    var native: Native = .bridge
}

enum MenuEntry {
    case action(MenuAction)
    case separator
}

// MARK: – View state pushed by the web app (ADR-016 decision 5)

/// The last `{theme, syntaxTheme}` the web app pushed through the `ditaUi`
/// message. `menuNeedsUpdate` reads it synchronously to set check marks.
final class UiState {
    var theme: String = ""
    var syntaxTheme: String = ""
}

final class UiStateBridge: NSObject, WKScriptMessageHandler {
    private let state: UiState
    init(state: UiState) { self.state = state }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        if let theme = body["theme"] as? String { state.theme = theme }
        if let syntax = body["syntaxTheme"] as? String { state.syntaxTheme = syntax }
    }
}

// MARK: – App delegate

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var mainWindow: NSWindow?
    private var jsBridge: JSBridge?
    private var httpServer: HttpServer?
    private let uiState = UiState()
    private let printExporter = PrintExporter()

    // The web app's method names below are registered by lib/native-menu-bridge.ts
    // (and loadContent by lib/native-api-bridge.ts, ADR-007).

    private let appMenuEntries: [MenuEntry] = [
        .action(MenuAction(title: "What's New…", key: "", modifiers: [], method: "openReleaseNotes", args: [:])),
        .action(MenuAction(title: "Keyboard Shortcuts…", key: "", modifiers: [], method: "openKeyboardShortcuts", args: [:])),
    ]

    private let fileMenuEntries: [MenuEntry] = [
        .action(MenuAction(title: "New Task", key: "n", modifiers: [.command], method: "newTopic", args: ["type": "task"])),
        .action(MenuAction(title: "New Concept", key: "n", modifiers: [.command, .shift], method: "newTopic", args: ["type": "concept"])),
        .action(MenuAction(title: "New Reference", key: "n", modifiers: [.command, .option], method: "newTopic", args: ["type": "reference"])),
        .separator,
        .action(MenuAction(title: "Open Local File…", key: "o", modifiers: [.command], method: "loadContent", args: [:], native: .openPanel)),
        .action(MenuAction(title: "Close Tab", key: "w", modifiers: [.command], method: "closeActiveTab", args: [:])),
        .separator,
        .action(MenuAction(title: "Save to Heretto", key: "s", modifiers: [.command], method: "saveActiveTab", args: [:])),
        .action(MenuAction(title: "Replace in Heretto…", key: "", modifiers: [], method: "openReplaceModal", args: [:])),
        .action(MenuAction(title: "Export as PDF…", key: "", modifiers: [], method: "openExportModal", args: [:])),
        .separator,
        .action(MenuAction(title: "Connect to Heretto…", key: "", modifiers: [], method: "openHerettoConnectModal", args: [:])),
        .action(MenuAction(title: "Open from Heretto…", key: "", modifiers: [], method: "openHerettoBrowserModal", args: [:])),
    ]

    private let viewMenuEntries: [MenuEntry] = [
        .action(MenuAction(title: "Toggle XML Pane", key: "\\", modifiers: [.command], method: "toggleXmlPane", args: [:])),
    ]

    // components/Toolbar.tsx THEME_OPTIONS, in the same order.
    private let themeEntries: [MenuEntry] = [
        .action(MenuAction(title: "Dark", key: "", modifiers: [], method: "setTheme", args: ["name": "dark"], check: .theme("dark"))),
        .action(MenuAction(title: "Light", key: "", modifiers: [], method: "setTheme", args: ["name": "light"], check: .theme("light"))),
        .action(MenuAction(title: "Claude", key: "", modifiers: [], method: "setTheme", args: ["name": "claude"], check: .theme("claude"))),
        .action(MenuAction(title: "Nord", key: "", modifiers: [], method: "setTheme", args: ["name": "nord"], check: .theme("nord"))),
        .action(MenuAction(title: "Solarized", key: "", modifiers: [], method: "setTheme", args: ["name": "solarized"], check: .theme("solarized"))),
        .action(MenuAction(title: "Navy", key: "", modifiers: [], method: "setTheme", args: ["name": "navy"], check: .theme("navy"))),
    ]

    // components/MonacoDitaEditor.tsx SYNTAX_THEME_OPTIONS, in the same order.
    private let syntaxThemeEntries: [MenuEntry] = [
        .action(MenuAction(title: "Material", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "material"], check: .syntaxTheme("material"))),
        .action(MenuAction(title: "GitHub", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "github"], check: .syntaxTheme("github"))),
        .action(MenuAction(title: "Monokai", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "monokai"], check: .syntaxTheme("monokai"))),
        .action(MenuAction(title: "Dracula", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "dracula"], check: .syntaxTheme("dracula"))),
        .action(MenuAction(title: "One Dark", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "one-dark"], check: .syntaxTheme("one-dark"))),
        .action(MenuAction(title: "Catppuccin", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "catppuccin"], check: .syntaxTheme("catppuccin"))),
        .action(MenuAction(title: "Daylight", key: "", modifiers: [], method: "setXmlTheme", args: ["name": "daylight"], check: .syntaxTheme("daylight"))),
    ]

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()

        let webView = WebViewController.makeWebView(uiState: uiState, printExporter: printExporter)

        // Start the local HTTP API server (port 3001)
        let bridge = JSBridge(webView: webView)
        let server = HttpServer(bridge: bridge, port: 3001)
        server.start()
        jsBridge = bridge
        httpServer = server
        printExporter.bridge = bridge

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "DITA Architect"
        window.contentView = webView
        window.center()
        mainWindow = window
        printExporter.hostWindow = window

        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    // MARK: – Menu construction

    private func setupMenu() {
        let mainMenu = NSMenu()

        // App menu: About (native), What's New / Keyboard Shortcuts (bridge), Quit
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(NSMenuItem(title: "About DITA Architect", action: #selector(showAbout(_:)), keyEquivalent: ""))
        appMenu.addItem(.separator())
        addEntries(appMenuEntries, to: appMenu)
        appMenu.addItem(.separator())
        appMenu.addItem(NSMenuItem(
            title: "Quit DITA Architect",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        ))

        // File menu (P2-39)
        let fileItem = NSMenuItem(title: "File", action: nil, keyEquivalent: "")
        mainMenu.addItem(fileItem)
        let fileMenu = NSMenu(title: "File")
        fileItem.submenu = fileMenu
        addEntries(fileMenuEntries, to: fileMenu)

        // Edit menu — enables Cut/Copy/Paste/Select All in text fields and WKWebView
        let editItem = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editItem.submenu = editMenu
        editMenu.addItem(NSMenuItem(title: "Cut",        action: #selector(NSText.cut(_:)),       keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Copy",       action: #selector(NSText.copy(_:)),      keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Paste",      action: #selector(NSText.paste(_:)),     keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        editMenu.addItem(.separator())
        editMenu.addItem(NSMenuItem(title: "Undo", action: Selector(("undo:")), keyEquivalent: "z"))
        editMenu.addItem(NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "Z"))

        // View menu (P2-40): Toggle XML Pane, Theme submenu, XML Syntax Theme submenu
        let viewItem = NSMenuItem(title: "View", action: nil, keyEquivalent: "")
        mainMenu.addItem(viewItem)
        let viewMenu = NSMenu(title: "View")
        viewItem.submenu = viewMenu
        addEntries(viewMenuEntries, to: viewMenu)
        viewMenu.addItem(.separator())

        let themeItem = NSMenuItem(title: "Theme", action: nil, keyEquivalent: "")
        let themeMenu = NSMenu(title: "Theme")
        themeMenu.delegate = self
        addEntries(themeEntries, to: themeMenu)
        themeItem.submenu = themeMenu
        viewMenu.addItem(themeItem)

        let syntaxItem = NSMenuItem(title: "XML Syntax Theme", action: nil, keyEquivalent: "")
        let syntaxMenu = NSMenu(title: "XML Syntax Theme")
        syntaxMenu.delegate = self
        addEntries(syntaxThemeEntries, to: syntaxMenu)
        syntaxItem.submenu = syntaxMenu
        viewMenu.addItem(syntaxItem)

        // Window menu
        let windowItem = NSMenuItem(title: "Window", action: nil, keyEquivalent: "")
        mainMenu.addItem(windowItem)
        let windowMenu = NSMenu(title: "Window")
        windowItem.submenu = windowMenu
        windowMenu.addItem(NSMenuItem(title: "Minimise", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m"))
        windowMenu.addItem(NSMenuItem(title: "Zoom",     action: #selector(NSWindow.zoom(_:)),        keyEquivalent: ""))
        NSApplication.shared.windowsMenu = windowMenu

        NSApplication.shared.mainMenu = mainMenu
    }

    private func addEntries(_ entries: [MenuEntry], to menu: NSMenu) {
        for entry in entries {
            switch entry {
            case .separator:
                menu.addItem(.separator())
            case .action(let action):
                let item = NSMenuItem(title: action.title, action: #selector(runMenuAction(_:)), keyEquivalent: action.key)
                item.keyEquivalentModifierMask = action.modifiers.reduce(NSEvent.ModifierFlags()) { $0.union($1) }
                item.target = self
                item.representedObject = action
                menu.addItem(item)
            }
        }
    }

    // MARK: – NSMenuDelegate: check marks from the pushed view state (decision 5)

    func menuNeedsUpdate(_ menu: NSMenu) {
        for item in menu.items {
            guard let action = item.representedObject as? MenuAction else { continue }
            switch action.check {
            case .none: break
            case .theme(let name): item.state = (name == uiState.theme) ? .on : .off
            case .syntaxTheme(let name): item.state = (name == uiState.syntaxTheme) ? .on : .off
            }
        }
    }

    // MARK: – Actions

    @objc private func runMenuAction(_ sender: NSMenuItem) {
        guard let action = sender.representedObject as? MenuAction else { return }
        switch action.native {
        case .openPanel:
            openLocalFile(action)
        case .bridge:
            callBridge(method: action.method, args: action.args)
        }
    }

    /// `window.__ditaApi.<method>(<args in declared order>)` through the one JS bridge.
    private func callBridge(method: String, args: KeyValuePairs<String, String>) {
        guard let bridge = jsBridge else { return }
        let names = args.map { $0.key }
        var jsArgs: [String: Any] = [:]
        for (name, value) in args { jsArgs[name] = value }
        let body = "return window.__ditaApi.\(method)(\(names.joined(separator: ", ")))"
        bridge.call("window.__ditaApi.\(method)", args: jsArgs, body: body) { result in
            switch result {
            case .success(let json):
                if let json, json.contains("\"success\":false") {
                    print("[Menu] \(method) answered: \(json)")
                }
            case .failure(let error):
                print("[Menu] \(method) failed: \(error.localizedDescription)")
            }
        }
    }

    /// ⌘O — native open panel, then the existing loader (ADR-016 decision 4).
    private func openLocalFile(_ action: MenuAction) {
        let panel = NSOpenPanel()
        panel.title = action.title.replacingOccurrences(of: "…", with: "")
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        var types: [UTType] = [.xml]
        if let dita = UTType(filenameExtension: "dita") { types.insert(dita, at: 0) }
        panel.allowedContentTypes = types

        let handler: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url, let self, let bridge = self.jsBridge else { return }
            guard let xml = try? String(contentsOf: url, encoding: .utf8) else {
                self.alert("Could not read \(url.lastPathComponent)", detail: "The file is not UTF-8 text.")
                return
            }
            bridge.call(
                "window.__ditaApi.loadContent",
                args: ["xml": xml, "fileName": url.lastPathComponent],
                body: "return window.__ditaApi.loadContent(xml, fileName)"
            ) { result in
                if case .failure(let error) = result {
                    print("[Menu] loadContent failed: \(error.localizedDescription)")
                }
            }
        }
        if let window = mainWindow {
            panel.beginSheetModal(for: window, completionHandler: handler)
        } else {
            handler(panel.runModal())
        }
    }

    /// About — version and build from the bundle (native, no bridge half).
    @objc private func showAbout(_ sender: Any?) {
        let info = Bundle.main.infoDictionary ?? [:]
        let version = info["CFBundleShortVersionString"] as? String ?? "?"
        let alert = NSAlert()
        alert.messageText = "DITA Architect"
        alert.informativeText = "Version \(version)\nA DITA editor for Heretto.\n\nAll rights reserved."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        if let window = mainWindow {
            alert.beginSheetModal(for: window)
        } else {
            alert.runModal()
        }
    }

    private func alert(_ message: String, detail: String) {
        let alert = NSAlert()
        alert.messageText = message
        alert.informativeText = detail
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        if let window = mainWindow {
            alert.beginSheetModal(for: window)
        } else {
            alert.runModal()
        }
    }
}
