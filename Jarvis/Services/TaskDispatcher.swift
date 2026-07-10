import Foundation

/// Jarvis's line to headquarters.
///
/// Dispatched tasks are committed to `.jarvis/tasks.md` on the `jarvis-inbox`
/// branch of the user's repo. A scheduled Claude Code session checks that
/// inbox hourly, executes new tasks (updating schedule-tracker artifacts,
/// creating social posts, etc.), and marks them done with result notes.
enum TaskDispatcher {

    private static let repo = "stevenbarabash-spec/Claude-"
    private static let branch = "jarvis-inbox"
    private static let path = ".jarvis/tasks.md"

    enum DispatchError: LocalizedError {
        case missingToken
        case api(String)

        var errorDescription: String? {
            switch self {
            case .missingToken:
                return "I need a GitHub token with repo access to dispatch tasks — add one in Settings under Long-term memory."
            case .api(let detail):
                return "GitHub wouldn't take the task: \(detail)"
            }
        }
    }

    static func dispatch(_ task: String) async throws {
        guard let token = KeychainHelper.read(MemoryStore.tokenKeychainKey), !token.isEmpty else {
            throw DispatchError.missingToken
        }
        try await ensureBranch(token: token)

        // Read the current inbox (if any) so we can append.
        var existing = ""
        var sha: String?
        if let file = try? await getJSON(
            "https://api.github.com/repos/\(repo)/contents/\(path)?ref=\(branch)", token: token) {
            sha = file["sha"] as? String
            if let b64 = (file["content"] as? String)?
                .replacingOccurrences(of: "\n", with: ""),
               let data = Data(base64Encoded: b64) {
                existing = String(data: data, encoding: .utf8) ?? ""
            }
        }

        let stamp = ISO8601DateFormatter().string(from: Date())
        let entry = "- [ ] (\(stamp)) \(task.replacingOccurrences(of: "\n", with: " "))"
        let updated = existing.isEmpty
            ? "# Jarvis task inbox\n\n\(entry)\n"
            : existing.trimmingCharacters(in: .whitespacesAndNewlines) + "\n\(entry)\n"

        var body: [String: Any] = [
            "message": "Jarvis: dispatch task",
            "content": Data(updated.utf8).base64EncodedString(),
            "branch": branch,
        ]
        if let sha { body["sha"] = sha }

        let (data, response) = try await send(
            "https://api.github.com/repos/\(repo)/contents/\(path)",
            method: "PUT", token: token, json: body)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw DispatchError.api(String(data: data, encoding: .utf8) ?? "HTTP \(status)")
        }
    }

    // MARK: - Plumbing

    private static func ensureBranch(token: String) async throws {
        if (try? await getJSON(
            "https://api.github.com/repos/\(repo)/git/ref/heads/\(branch)", token: token)) != nil {
            return
        }
        // Branch off the default branch's current tip.
        guard let repoInfo = try? await getJSON("https://api.github.com/repos/\(repo)", token: token),
              let defaultBranch = repoInfo["default_branch"] as? String,
              let ref = try? await getJSON(
                "https://api.github.com/repos/\(repo)/git/ref/heads/\(defaultBranch)", token: token),
              let object = ref["object"] as? [String: Any],
              let sha = object["sha"] as? String
        else { throw DispatchError.api("couldn't resolve the default branch") }

        _ = try await send("https://api.github.com/repos/\(repo)/git/refs",
                           method: "POST", token: token,
                           json: ["ref": "refs/heads/\(branch)", "sha": sha])
    }

    private static func getJSON(_ url: String, token: String) async throws -> [String: Any] {
        let (data, response) = try await send(url, method: "GET", token: token, json: nil)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status),
              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw DispatchError.api("HTTP \(status) for \(url)") }
        return json
    }

    @discardableResult
    private static func send(_ url: String, method: String, token: String,
                             json: [String: Any]?) async throws -> (Data, URLResponse) {
        var request = URLRequest(url: URL(string: url)!)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        if let json {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: json)
        }
        return try await URLSession.shared.data(for: request)
    }
}
