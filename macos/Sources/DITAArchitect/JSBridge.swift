import Foundation
import WebKit

/// Bridges Swift HTTP server handlers to JavaScript functions running inside the WKWebView.
/// All JS calls are dispatched to the main thread (WKWebView requirement).
/// Uses callAsyncJavaScript for all calls — it automatically awaits Promises,
/// so async JS functions (like saveTab) are handled transparently.
final class JSBridge {
    weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    /// Call a JavaScript function by name with positional arguments.
    /// Arguments are passed via the safe `arguments` dictionary — no string interpolation needed.
    /// The function body is `return fnName(arg0, arg1, ...)`.
    /// If the function returns a Promise, callAsyncJavaScript awaits it automatically.
    func call(
        _ fnName: String,
        args: [String: Any] = [:],
        body: String? = nil,
        completion: @escaping (Result<String?, Error>) -> Void
    ) {
        guard let webView = webView else {
            completion(.failure(BridgeError.webViewDeallocated))
            return
        }

        let functionBody = body ?? "return \(fnName)()"
        DispatchQueue.main.async {
            webView.callAsyncJavaScript(
                functionBody,
                arguments: args,
                in: nil,
                in: .page
            ) { result in
                switch result {
                case .success(let value):
                    completion(.success(value as? String))
                case .failure(let error):
                    completion(.failure(error))
                }
            }
        }
    }

    enum BridgeError: LocalizedError {
        case webViewDeallocated
        var errorDescription: String? { "WebView was deallocated" }
    }
}
