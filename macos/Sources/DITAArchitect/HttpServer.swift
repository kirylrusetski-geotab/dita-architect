import Foundation
import Network

/// Minimal HTTP/1.1 server on localhost that exposes the DITA Architect API
/// to external tools (Claude Code skills, curl). Each request is handled on a
/// background queue; JS calls are dispatched to the main thread via JSBridge.
final class HttpServer {
    private let bridge: JSBridge
    private let port: UInt16
    private var listener: NWListener?

    init(bridge: JSBridge, port: UInt16 = 3001) {
        self.bridge = bridge
        self.port = port
    }

    func start() {
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            let listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
            listener.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                switch state {
                case .ready:
                    print("[DITA API] HTTP server listening on localhost:\(self.port)")
                case .failed(let error):
                    print("[DITA API] HTTP server failed: \(error) — editor works without API")
                default:
                    break
                }
            }
            listener.newConnectionHandler = { [weak self] conn in
                self?.handleConnection(conn)
            }
            listener.start(queue: .global(qos: .background))
            self.listener = listener
        } catch {
            print("[DITA API] Could not create HTTP server: \(error) — editor works without API")
        }
    }

    // MARK: – Connection lifecycle

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .background))
        receiveRequest(connection: connection, accumulated: Data())
    }

    private func receiveRequest(connection: NWConnection, accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self, error == nil else { connection.cancel(); return }

            var buffer = accumulated
            if let data { buffer.append(data) }

            let headerDelimiter = Data("\r\n\r\n".utf8)
            guard let headerEndRange = buffer.range(of: headerDelimiter) else {
                if isComplete { connection.cancel(); return }
                self.receiveRequest(connection: connection, accumulated: buffer)
                return
            }

            let headerData = buffer[..<headerEndRange.lowerBound]
            guard let headerString = String(data: headerData, encoding: .utf8) else {
                self.sendError(connection: connection, status: 400, message: "Invalid request encoding")
                return
            }

            let headerLines = headerString.components(separatedBy: "\r\n")
            let requestLineParts = headerLines.first?.split(separator: " ", maxSplits: 2).map(String.init) ?? []
            guard requestLineParts.count >= 2 else {
                self.sendError(connection: connection, status: 400, message: "Malformed request line")
                return
            }

            let method = requestLineParts[0].uppercased()
            let path = requestLineParts[1].components(separatedBy: "?").first ?? requestLineParts[1]

            var contentLength = 0
            for line in headerLines.dropFirst() {
                if line.lowercased().hasPrefix("content-length:") {
                    contentLength = Int(line.dropFirst("content-length:".count).trimmingCharacters(in: .whitespaces)) ?? 0
                    break
                }
            }

            let bodyStart = headerEndRange.upperBound
            let available = buffer[bodyStart...]
            if available.count >= contentLength {
                let body = contentLength > 0 ? Data(available.prefix(contentLength)) : Data()
                self.routeRequest(connection: connection, method: method, path: path, body: body)
            } else {
                self.receiveRequest(connection: connection, accumulated: buffer)
            }
        }
    }

    // MARK: – Routing

    private func routeRequest(connection: NWConnection, method: String, path: String, body: Data) {
        let parts = path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)

        if method == "OPTIONS" {
            sendResponse(connection: connection, status: 200, body: Data("{}".utf8))
        } else if method == "GET" && parts == ["api", "status"] {
            handleGetStatus(connection: connection)
        } else if method == "GET" && parts == ["api", "tabs"] {
            handleGetTabs(connection: connection)
        } else if method == "GET" && parts.count == 4 && parts[0] == "api" && parts[1] == "tabs" && parts[3] == "content" {
            handleGetTabContent(connection: connection, tabId: parts[2])
        } else if method == "PUT" && parts.count == 4 && parts[0] == "api" && parts[1] == "tabs" && parts[3] == "content" {
            handlePutTabContent(connection: connection, tabId: parts[2], body: body)
        } else if method == "POST" && parts.count == 4 && parts[0] == "api" && parts[1] == "tabs" && parts[3] == "save" {
            handlePostTabSave(connection: connection, tabId: parts[2])
        } else if method == "POST" && parts.count == 4 && parts[0] == "api" && parts[1] == "tabs" && parts[3] == "insert-section" {
            handlePostInsertSection(connection: connection, tabId: parts[2], body: body)
        } else if method == "POST" && parts == ["api", "load-content"] {
            handlePostLoadContent(connection: connection, body: body)
        } else if method == "GET" && parts == ["api", "pending-loads"] {
            // In native mode content is delivered immediately via the JS bridge — the queue is always empty
            sendResponse(connection: connection, status: 200, body: Data(#"{"success":true,"loads":[]}"#.utf8))
        } else {
            sendError(connection: connection, status: 404, message: "Not found")
        }
    }

    // MARK: – Endpoint handlers

    private func handleGetStatus(connection: NWConnection) {
        bridge.call("window.__ditaApi.getStatus") { [weak self] (result: Result<String?, Error>) in
            self?.dispatchResult(result, to: connection)
        }
    }

    private func handleGetTabs(connection: NWConnection) {
        bridge.call("window.__ditaApi.getTabs") { [weak self] (result: Result<String?, Error>) in
            self?.dispatchResult(result, to: connection)
        }
    }

    private func handleGetTabContent(connection: NWConnection, tabId: String) {
        bridge.call(
            "window.__ditaApi.getTabContent",
            args: ["tabId": tabId],
            body: "return window.__ditaApi.getTabContent(tabId)"
        ) { [weak self] (result: Result<String?, Error>) in
            guard let self else { return }
            switch result {
            case .success(let json):
                let bodyStr = json ?? #"{"error":"Bridge unavailable"}"#
                // Error responses have "success":false; success responses have an "xml" field
                let status = bodyStr.contains("\"success\":false") ? 404 : 200
                self.sendResponse(connection: connection, status: status, body: Data(bodyStr.utf8))
            case .failure(let error):
                self.sendError(connection: connection, status: 500, message: error.localizedDescription)
            }
        }
    }

    private func handlePutTabContent(connection: NWConnection, tabId: String, body: Data) {
        guard
            let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
            let xml = json["xml"] as? String
        else {
            sendError(connection: connection, status: 400, message: "Missing or invalid 'xml' field")
            return
        }

        bridge.call(
            "window.__ditaApi.updateTabContent",
            args: ["tabId": tabId, "xml": xml],
            body: "return window.__ditaApi.updateTabContent(tabId, xml)"
        ) { [weak self] (result: Result<String?, Error>) in
            guard let self else { return }
            switch result {
            case .success(let json):
                let bodyStr = json ?? #"{"success":false}"#
                let status: Int
                if bodyStr.contains("not found") { status = 404 }
                else if bodyStr.contains("\"error\"") { status = 400 }
                else { status = 200 }
                self.sendResponse(connection: connection, status: status, body: Data(bodyStr.utf8))
            case .failure(let error):
                self.sendError(connection: connection, status: 500, message: error.localizedDescription)
            }
        }
    }

    private func handlePostTabSave(connection: NWConnection, tabId: String) {
        bridge.call(
            "window.__ditaApi.saveTab",
            args: ["tabId": tabId],
            body: "return window.__ditaApi.saveTab(tabId)"
        ) { [weak self] (result: Result<String?, Error>) in
            guard let self else { return }
            switch result {
            case .success(let json):
                let bodyStr = json ?? #"{"success":false}"#
                let status: Int
                if bodyStr.contains("\"success\":true") { status = 200 }
                else if bodyStr.contains("not found") { status = 404 }
                else { status = 400 }
                self.sendResponse(connection: connection, status: status, body: Data(bodyStr.utf8))
            case .failure(let error):
                self.sendError(connection: connection, status: 500, message: error.localizedDescription)
            }
        }
    }

    private func handlePostInsertSection(connection: NWConnection, tabId: String, body: Data) {
        guard
            let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
            let sectionXml = json["xml"] as? String
        else {
            sendError(connection: connection, status: 400, message: "Missing 'xml' field")
            return
        }
        bridge.call(
            "window.__ditaApi.insertSection",
            args: ["tabId": tabId, "sectionXml": sectionXml],
            body: "return window.__ditaApi.insertSection(tabId, sectionXml)"
        ) { [weak self] result in
            self?.dispatchWriteResult(result, to: connection)
        }
    }

    private func handlePostLoadContent(connection: NWConnection, body: Data) {
        guard
            let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
            let xml = json["xml"] as? String,
            let fileName = json["fileName"] as? String
        else {
            sendError(connection: connection, status: 400, message: "Missing 'xml' or 'fileName' field")
            return
        }

        let fnBody: String
        var args: [String: Any] = ["xml": xml, "fileName": fileName]

        if let uuid = json["herettoTargetUuid"] as? String {
            args["herettoTargetUuid"] = uuid
            fnBody = "return window.__ditaApi.loadContent(xml, fileName, herettoTargetUuid)"
        } else {
            fnBody = "return window.__ditaApi.loadContent(xml, fileName)"
        }

        bridge.call(
            "window.__ditaApi.loadContent",
            args: args,
            body: fnBody
        ) { [weak self] (result: Result<String?, Error>) in
            self?.dispatchWriteResult(result, to: connection)
        }
    }

    // MARK: – Response helpers

    private func dispatchResult(_ result: Result<String?, Error>, to connection: NWConnection) {
        switch result {
        case .success(let json):
            sendResponse(connection: connection, status: 200, body: Data((json ?? "{}").utf8))
        case .failure(let error):
            sendError(connection: connection, status: 500, message: error.localizedDescription)
        }
    }

    private func dispatchWriteResult(_ result: Result<String?, Error>, to connection: NWConnection) {
        switch result {
        case .success(let json):
            let bodyStr = json ?? #"{"success":false}"#
            let status = bodyStr.contains("\"success\":true") ? 200 : 400
            sendResponse(connection: connection, status: status, body: Data(bodyStr.utf8))
        case .failure(let error):
            sendError(connection: connection, status: 500, message: error.localizedDescription)
        }
    }

    private func sendResponse(connection: NWConnection, status: Int, body: Data) {
        let statusText: String
        switch status {
        case 200: statusText = "OK"
        case 400: statusText = "Bad Request"
        case 404: statusText = "Not Found"
        case 405: statusText = "Method Not Allowed"
        default:  statusText = "Internal Server Error"
        }

        let header = [
            "HTTP/1.1 \(status) \(statusText)",
            "Content-Type: application/json; charset=utf-8",
            "Content-Length: \(body.count)",
            "Access-Control-Allow-Origin: *",
            "Connection: close",
            "",
            "",
        ].joined(separator: "\r\n")

        var response = Data(header.utf8)
        response.append(body)

        connection.send(content: response, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private func sendError(connection: NWConnection, status: Int, message: String) {
        guard let bodyData = try? JSONSerialization.data(withJSONObject: ["error": message]) else {
            connection.cancel()
            return
        }
        sendResponse(connection: connection, status: status, body: bodyData)
    }
}
