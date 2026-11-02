import AppKit
import WebKit
import PDFKit
import UniformTypeIdentifiers

/// Export as PDF — ADR-016 decision 6 / FR-050 slice 1.
///
/// The web app posts `{html, title}` to the `ditaPrint` script message. This class
/// then: runs the native save panel; renders the HTML in a dedicated hidden
/// WKWebView inside an off-screen window (never the shell's own web view — that
/// is the recorded blank-page failure); prints it with `printOperation(with:)`
/// to a temporary PDF (`jobDisposition = .save`, no panels); redraws every page
/// into the chosen file with a "Page N of M" footer (PDFKit); and reports the
/// outcome to the web app through `window.__ditaApi.exportFinished(status,
/// message)` — `saved` (the path), `cancelled`, or `failed` (the reason) — so the
/// web app never shows a success toast before the file exists.
final class PrintExporter: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    weak var bridge: JSBridge?
    weak var hostWindow: NSWindow?

    private final class Job {
        let destination: URL
        var window: NSWindow?
        var webView: WKWebView?
        var tempURL: URL?
        init(destination: URL) { self.destination = destination }
    }

    private var current: Job?
    /// True from the moment a request is accepted (save panel up) until `finish` —
    /// `current` alone is set only after the panel returns, which left a gap in
    /// which a second request could queue a second sheet (adversarial review, finding 1).
    private var busy = false

    enum ExportError: LocalizedError {
        case noHtml
        case busy
        case noPages
        case cannotWrite(URL)

        var errorDescription: String? {
            switch self {
            case .noHtml: return "The print request carried no HTML."
            case .busy: return "An export is already in progress."
            case .noPages: return "The print operation produced no pages."
            case .cannotWrite(let url): return "Could not write \(url.lastPathComponent)."
            }
        }
    }

    // MARK: – Script message: the request

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let html = body["html"] as? String, !html.isEmpty else {
            report(status: "failed", message: ExportError.noHtml.localizedDescription)
            return
        }
        let title = (body["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "DITA Topic"
        DispatchQueue.main.async { [weak self] in
            self?.start(html: html, title: title)
        }
    }

    // MARK: – Save panel

    private func start(html: String, title: String) {
        if busy {
            report(status: "failed", message: ExportError.busy.localizedDescription)
            return
        }
        busy = true
        let panel = NSSavePanel()
        panel.title = "Export as PDF"
        panel.allowedContentTypes = [.pdf]
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        panel.nameFieldStringValue = PrintExporter.safeFileName(title) + ".pdf"

        let handler: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard let self else { return }
            guard response == .OK, let url = panel.url else {
                self.busy = false
                self.report(status: "cancelled", message: "")
                return
            }
            self.render(html: html, to: url)
        }
        if let host = hostWindow {
            panel.beginSheetModal(for: host, completionHandler: handler)
        } else {
            handler(panel.runModal())
        }
    }

    // MARK: – Dedicated print web view

    private func render(html: String, to destination: URL) {
        let job = Job(destination: destination)
        // US Letter at 96 dpi; the print operation paginates from NSPrintInfo, not from this frame.
        let frame = NSRect(x: -20_000, y: -20_000, width: 816, height: 1056)
        let window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.isExcludedFromWindowsMenu = true
        let webView = WKWebView(frame: NSRect(origin: .zero, size: frame.size), configuration: WKWebViewConfiguration())
        webView.navigationDelegate = self
        window.contentView = webView
        // Ordered into the window list (off-screen). Kept defensively: the review
        // harness printed fine without it on this macOS, but FR-050's recorded
        // blank pages came from a web view WebKit had never painted.
        window.orderBack(nil)

        job.window = window
        job.webView = webView
        current = job
        webView.loadHTMLString(html, baseURL: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // A short settle delay after the load commits (web fonts, layout). Kept
        // defensively — the review harness paginated correctly without it.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            self?.print(webView)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finish(status: "failed", message: error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finish(status: "failed", message: error.localizedDescription)
    }

    // MARK: – Print to a temporary PDF

    private func print(_ webView: WKWebView) {
        guard let job = current, let window = job.window, job.webView === webView else { return }

        guard let info = NSPrintInfo.shared.copy() as? NSPrintInfo else {
            finish(status: "failed", message: "Could not create print settings.")
            return
        }
        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("dita-export-\(UUID().uuidString).pdf")
        info.jobDisposition = .save
        info.dictionary()[NSPrintInfo.AttributeKey.jobSavingURL] = temp
        info.horizontalPagination = .fit
        info.verticalPagination = .automatic
        info.isHorizontallyCentered = false
        info.isVerticallyCentered = false
        info.topMargin = 54
        info.bottomMargin = 54
        info.leftMargin = 54
        info.rightMargin = 54
        job.tempURL = temp

        let operation = webView.printOperation(with: info)
        operation.showsPrintPanel = false
        operation.showsProgressPanel = false
        // Give WebKit's print view the paper size up front. Kept defensively — the
        // review harness laid out all pages without it on this macOS.
        operation.view?.frame = NSRect(origin: .zero, size: info.paperSize)
        operation.runModal(
            for: window,
            delegate: self,
            didRun: #selector(printOperationDidRun(_:success:contextInfo:)),
            contextInfo: nil
        )
    }

    @objc private func printOperationDidRun(_ operation: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
        guard let job = current, let temp = job.tempURL else { return }
        guard success, FileManager.default.fileExists(atPath: temp.path) else {
            finish(status: "failed", message: ExportError.noPages.localizedDescription)
            return
        }
        do {
            try PrintExporter.stampPageNumbers(from: temp, to: job.destination)
            finish(status: "saved", message: job.destination.path)
        } catch {
            finish(status: "failed", message: error.localizedDescription)
        }
    }

    // MARK: – Page-number footers (PDFKit)

    /// Redraws every page of `source` into `destination` with a centred
    /// "Page N of M" footer flattened into the page (not an annotation).
    ///
    /// Known limit: the input is assumed to be WebKit's own print output — unrotated
    /// pages with an origin-anchored media box, which is all `printOperation(with:)`
    /// produces. A page carrying `/Rotate 90` would be drawn into an unrotated box
    /// and clipped (adversarial review, finding 3); not reachable from this path.
    static func stampPageNumbers(from source: URL, to destination: URL) throws {
        guard let document = PDFDocument(url: source), document.pageCount > 0 else {
            throw ExportError.noPages
        }
        guard let context = CGContext(destination as CFURL, mediaBox: nil, nil) else {
            throw ExportError.cannotWrite(destination)
        }
        let total = document.pageCount
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 9),
            .foregroundColor: NSColor(white: 0.4, alpha: 1),
        ]
        for index in 0..<total {
            guard let page = document.page(at: index) else { continue }
            var box = page.bounds(for: .mediaBox)
            context.beginPage(mediaBox: &box)
            context.saveGState()
            page.draw(with: .mediaBox, to: context)
            context.restoreGState()

            let label = NSAttributedString(string: "Page \(index + 1) of \(total)", attributes: attributes)
            let size = label.size()
            let graphics = NSGraphicsContext(cgContext: context, flipped: false)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = graphics
            label.draw(at: NSPoint(x: box.midX - size.width / 2, y: box.minY + 24))
            NSGraphicsContext.restoreGraphicsState()
            context.endPage()
        }
        context.closePDF()
    }

    // MARK: – Completion

    private func finish(status: String, message: String) {
        if let job = current {
            job.webView?.navigationDelegate = nil
            job.webView?.stopLoading()
            job.window?.orderOut(nil)
            job.window?.contentView = nil
            job.window?.close()
            if let temp = job.tempURL { try? FileManager.default.removeItem(at: temp) }
        }
        current = nil
        busy = false
        report(status: status, message: message)
    }

    private func report(status: String, message: String) {
        bridge?.call(
            "window.__ditaApi.exportFinished",
            args: ["status": status, "message": message],
            body: "return window.__ditaApi.exportFinished(status, message)"
        ) { result in
            if case .failure(let error) = result {
                Swift.print("[PrintExporter] exportFinished(\(status)) could not reach the web app: \(error.localizedDescription)")
            }
        }
    }

    static func safeFileName(_ title: String) -> String {
        let forbidden = CharacterSet(charactersIn: "/:\\")
        let cleaned = title.unicodeScalars.map { forbidden.contains($0) ? "-" : String($0) }.joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let base = cleaned.isEmpty ? "DITA Topic" : cleaned
        return String(base.prefix(100))
    }
}
