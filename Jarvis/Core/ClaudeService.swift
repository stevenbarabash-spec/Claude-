import Foundation

/// Minimal Claude API client (https://docs.anthropic.com).
/// The API key is stored in the Keychain via SettingsView.
struct ClaudeService {

    static let keychainKey = "com.jarvis.claude-api-key"
    private static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    private static let model = "claude-sonnet-5"

    var hasAPIKey: Bool {
        !(KeychainHelper.read(Self.keychainKey) ?? "").isEmpty
    }

    enum ClaudeError: LocalizedError {
        case missingAPIKey
        case badResponse(status: Int, body: String)
        case emptyReply

        var errorDescription: String? {
            switch self {
            case .missingAPIKey:
                return "No Claude API key configured. Add one in Settings."
            case .badResponse(let status, let body):
                return "Claude API error \(status): \(body)"
            case .emptyReply:
                return "Claude returned an empty reply."
            }
        }
    }

    func complete(system: String, user: String, maxTokens: Int = 1024) async throws -> String {
        try await send(system: system,
                       content: [["type": "text", "text": user]],
                       maxTokens: maxTokens)
    }

    /// Vision: ask a question about a photo (JPEG data from the camera).
    func complete(system: String, user: String, imageJPEG: Data, maxTokens: Int = 1024) async throws -> String {
        try await send(system: system,
                       content: [
                           ["type": "image",
                            "source": ["type": "base64",
                                       "media_type": "image/jpeg",
                                       "data": imageJPEG.base64EncodedString()]],
                           ["type": "text", "text": user],
                       ],
                       maxTokens: maxTokens)
    }

    /// Multi-turn conversation with optional live web search (used for news,
    /// current events, anything time-sensitive). The server runs the searches
    /// itself and returns the final answer.
    func chat(system: String,
              history: [(role: String, content: String)],
              enableWebSearch: Bool = false,
              maxTokens: Int = 1024) async throws -> String {
        // The API rejects empty messages and requires the history to start
        // with a user turn — sanitize so a stray entry can't poison the chat.
        var cleaned = history.filter {
            !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        while cleaned.first?.role == "assistant" {
            cleaned.removeFirst()
        }
        let messages = cleaned.map { ["role": $0.role, "content": $0.content] }
        var extras: [String: Any] = [:]
        if enableWebSearch {
            extras["tools"] = [
                ["type": "web_search_20250305", "name": "web_search", "max_uses": 3]
            ]
        }
        do {
            return try await send(system: system, messages: messages, maxTokens: maxTokens, extras: extras)
        } catch ClaudeError.badResponse(let status, _) where status == 400 && enableWebSearch {
            // Some accounts have API web search disabled — degrade gracefully
            // and answer from knowledge instead of surfacing an error.
            return try await send(system: system, messages: messages, maxTokens: maxTokens, extras: [:])
        }
    }

    private func send(system: String, content: [[String: Any]], maxTokens: Int) async throws -> String {
        try await send(system: system,
                       messages: [["role": "user", "content": content]],
                       maxTokens: maxTokens,
                       extras: [:])
    }

    private func send(system: String, messages: [Any], maxTokens: Int,
                      extras: [String: Any]) async throws -> String {
        guard let apiKey = KeychainHelper.read(Self.keychainKey), !apiKey.isEmpty else {
            throw ClaudeError.missingAPIKey
        }

        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        var payload: [String: Any] = [
            "model": Self.model,
            "max_tokens": maxTokens,
            "system": system,
            "messages": messages,
        ]
        payload.merge(extras) { _, new in new }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw ClaudeError.badResponse(status: status,
                                          body: String(data: data, encoding: .utf8) ?? "")
        }

        struct MessagesResponse: Decodable {
            struct Content: Decodable {
                let type: String
                let text: String?
            }
            let content: [Content]
        }

        let decoded = try JSONDecoder().decode(MessagesResponse.self, from: data)
        let text = decoded.content.compactMap(\.text).joined()
        guard !text.isEmpty else { throw ClaudeError.emptyReply }
        return text
    }
}
