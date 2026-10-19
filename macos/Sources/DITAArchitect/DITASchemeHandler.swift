import Foundation
import WebKit

final class DITASchemeHandler: NSObject, WKURLSchemeHandler {
    private let lock = NSLock()
    private var activeTasks = Set<ObjectIdentifier>()

    // MARK: – WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let id = ObjectIdentifier(urlSchemeTask)
        lock.lock(); activeTasks.insert(id); lock.unlock()

        guard let url = urlSchemeTask.request.url,
              let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.path
        else {
            fail(urlSchemeTask, id: id, with: URLError(.badURL))
            return
        }

        if path.hasPrefix("/heretto-api") {
            handleProxy(urlSchemeTask, id: id, originalURL: url, path: path)
        } else if path == "/heretto-credentials" {
            handleCredentials(urlSchemeTask, id: id, request: urlSchemeTask.request)
        } else if path.hasPrefix("/api/") {
            let data = Data(#"{"error":"not available in native app"}"#.utf8)
            respond(urlSchemeTask, id: id, url: url, status: 404,
                    headers: ["Content-Type": "application/json"], body: data)
        } else {
            handleStaticFile(urlSchemeTask, id: id, url: url, path: path)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        lock.lock(); activeTasks.remove(ObjectIdentifier(urlSchemeTask)); lock.unlock()
    }

    // MARK: – Static file serving

    private func handleStaticFile(_ task: any WKURLSchemeTask, id: ObjectIdentifier, url: URL, path: String) {
        guard let distURL = Bundle.main.resourceURL?.appendingPathComponent("dist") else {
            fail(task, id: id, with: URLError(.fileDoesNotExist))
            return
        }

        let distPath = distURL.standardizedFileURL.path

        let relative = path == "/" ? "index.html" : String(path.dropFirst())
        var fileURL = distURL.appendingPathComponent(relative).standardizedFileURL

        // Path-traversal guard: resolved path must stay inside dist/
        guard fileURL.path.hasPrefix(distPath + "/") || fileURL.path == distPath else {
            fail(task, id: id, with: URLError(.badURL))
            return
        }

        if !FileManager.default.fileExists(atPath: fileURL.path) {
            fileURL = distURL.appendingPathComponent("index.html").standardizedFileURL
        }

        guard let data = try? Data(contentsOf: fileURL) else {
            fail(task, id: id, with: URLError(.fileDoesNotExist))
            return
        }

        respond(task, id: id, url: url, status: 200,
                headers: ["Content-Type": mimeType(for: fileURL.pathExtension)], body: data)
    }

    // MARK: – Heretto proxy

    /// `host` is the Heretto instance hostname (e.g. "yourcompany.heretto.com").
    /// DITA Architect works with any Heretto CMS instance; nothing is hardcoded.
    private struct Credentials: Codable {
        var host: String?
        let email: String
        let token: String
    }

    private var credentialsFileURL: URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("heretto.json")
    }

    /// Strip scheme and trailing slashes so "https://x.heretto.com/" → "x.heretto.com".
    private func normalizeHerettoHost(_ value: String?) -> String? {
        guard var host = value?.trimmingCharacters(in: .whitespacesAndNewlines), !host.isEmpty else { return nil }
        for prefix in ["https://", "http://"] where host.lowercased().hasPrefix(prefix) {
            host = String(host.dropFirst(prefix.count))
        }
        while host.hasSuffix("/") { host.removeLast() }
        return host.isEmpty ? nil : host
    }

    private func loadCredentials() -> Credentials? {
        guard let data = try? Data(contentsOf: credentialsFileURL),
              var creds = try? JSONDecoder().decode(Credentials.self, from: data),
              !creds.email.isEmpty, !creds.token.isEmpty
        else { return nil }
        creds.host = normalizeHerettoHost(creds.host)
        return creds
    }

    private func handleProxy(_ task: any WKURLSchemeTask, id: ObjectIdentifier, originalURL: URL, path: String) {
        guard let creds = loadCredentials() else {
            let data = Data(#"{"error":"Heretto credentials not configured — open Settings"}"#.utf8)
            respond(task, id: id, url: originalURL, status: 401,
                    headers: ["Content-Type": "application/json"], body: data)
            return
        }
        guard let host = creds.host else {
            let data = Data(#"{"error":"Heretto host not configured — open Settings and enter your Heretto hostname"}"#.utf8)
            respond(task, id: id, url: originalURL, status: 400,
                    headers: ["Content-Type": "application/json"], body: data)
            return
        }

        // /heretto-api/SOMETHING → https://<host>/rest/SOMETHING
        let restPath = "/rest" + String(path.dropFirst("/heretto-api".count))
        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.path = restPath
        if let orig = URLComponents(url: originalURL, resolvingAgainstBaseURL: false) {
            components.queryItems = orig.queryItems
        }

        guard let targetURL = components.url else {
            fail(task, id: id, with: URLError(.badURL))
            return
        }

        var upstream = URLRequest(url: targetURL)
        upstream.httpMethod = task.request.httpMethod ?? "GET"

        // Forward original headers, skipping Host
        task.request.allHTTPHeaderFields?.forEach { key, value in
            if key.lowercased() != "host" { upstream.setValue(value, forHTTPHeaderField: key) }
        }

        // Inject auth — credentials are reloaded from disk each request so in-app updates apply
        let authToken = Data("\(creds.email):\(creds.token)".utf8).base64EncodedString()
        upstream.setValue("Basic \(authToken)", forHTTPHeaderField: "Authorization")

        // Forward request body (httpBodyStream for streaming bodies, httpBody for buffered)
        if let stream = task.request.httpBodyStream {
            var body = Data()
            let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
            defer { buf.deallocate() }
            stream.open()
            while stream.hasBytesAvailable {
                let n = stream.read(buf, maxLength: 4096)
                if n > 0 { body.append(buf, count: n) }
            }
            stream.close()
            upstream.httpBody = body
        } else {
            upstream.httpBody = task.request.httpBody
        }

        URLSession.shared.dataTask(with: upstream) { [weak self] data, response, error in
            guard let self else { return }

            if let error {
                self.fail(task, id: id, with: error)
                return
            }
            guard let http = response as? HTTPURLResponse, let data else {
                self.fail(task, id: id, with: URLError(.badServerResponse))
                return
            }

            var headers = [String: String]()
            http.allHeaderFields.forEach { key, value in
                if let k = key as? String, let v = value as? String { headers[k] = v }
            }
            self.respond(task, id: id, url: originalURL, status: http.statusCode,
                         headers: headers, body: data)
        }.resume()
    }

    // MARK: – Credentials endpoint

    private func handleCredentials(_ task: any WKURLSchemeTask, id: ObjectIdentifier, request: URLRequest) {
        let url = request.url!
        switch request.httpMethod?.uppercased() ?? "GET" {
        case "GET":
            // Return only host + email + presence flag; never return the token over the scheme handler.
            let result: [String: Any]
            if let creds = loadCredentials() {
                result = ["host": creds.host ?? "", "email": creds.email, "hasCredentials": true]
            } else {
                result = ["host": "", "email": "", "hasCredentials": false]
            }
            let data = (try? JSONSerialization.data(withJSONObject: result)) ?? Data("{}".utf8)
            respond(task, id: id, url: url, status: 200,
                    headers: ["Content-Type": "application/json"], body: data)

        case "PUT":
            guard let body = request.httpBody,
                  var creds = try? JSONDecoder().decode(Credentials.self, from: body)
            else {
                let data = Data(#"{"error":"Invalid JSON"}"#.utf8)
                respond(task, id: id, url: url, status: 400,
                        headers: ["Content-Type": "application/json"], body: data)
                return
            }
            // A PUT without a host keeps whatever host is already on disk,
            // so older callers that send only { email, token } don't wipe it.
            creds.host = normalizeHerettoHost(creds.host) ?? loadCredentials()?.host
            do {
                let out = try JSONEncoder().encode(creds)
                try out.write(to: credentialsFileURL, options: .atomic)
                let data = Data(#"{"ok":true}"#.utf8)
                respond(task, id: id, url: url, status: 200,
                        headers: ["Content-Type": "application/json"], body: data)
            } catch {
                fail(task, id: id, with: error)
            }

        default:
            let data = Data(#"{"error":"Method not allowed"}"#.utf8)
            respond(task, id: id, url: url, status: 405,
                    headers: ["Content-Type": "application/json"], body: data)
        }
    }

    // MARK: – Response helpers (thread-safe)

    private func respond(_ task: any WKURLSchemeTask, id: ObjectIdentifier,
                         url: URL, status: Int, headers: [String: String], body: Data) {
        lock.lock()
        let active = activeTasks.remove(id) != nil
        lock.unlock()
        guard active else { return }

        let response = HTTPURLResponse(url: url, statusCode: status,
                                       httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    private func fail(_ task: any WKURLSchemeTask, id: ObjectIdentifier, with error: Error) {
        lock.lock()
        let active = activeTasks.remove(id) != nil
        lock.unlock()
        guard active else { return }
        task.didFailWithError(error)
    }

    // MARK: – MIME types

    private func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html":         return "text/html; charset=utf-8"
        case "js", "mjs":   return "application/javascript"
        case "css":          return "text/css"
        case "json":         return "application/json"
        case "svg":          return "image/svg+xml"
        case "png":          return "image/png"
        case "jpg", "jpeg":  return "image/jpeg"
        case "gif":          return "image/gif"
        case "ico":          return "image/x-icon"
        case "woff":         return "font/woff"
        case "woff2":        return "font/woff2"
        case "ttf":          return "font/ttf"
        case "otf":          return "font/otf"
        case "webp":         return "image/webp"
        case "xml":          return "application/xml"
        default:             return "application/octet-stream"
        }
    }
}
