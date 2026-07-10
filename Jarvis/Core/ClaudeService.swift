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
        guard let apiKey = KeychainHelper.read(Self.keychainKey), !apiKey.isEmpty else {
            throw ClaudeError.missingAPIKey
        }

        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let payload: [String: Any] = [
            "model": Self.model,
            "max_tokens": maxTokens,
            "system": system,
            "messages": [["role": "user", "content": user]],
        ]
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
