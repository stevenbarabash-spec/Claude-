import Foundation

/// Connection to the user's JARVIS Life OS dashboard (Next.js + Supabase).
///
/// The dashboard has its own capture pipeline (files tasks / meals /
/// receivables / income / notes) and a memory layer. When configured, the
/// phone routes file-able statements and personal-data questions here, so
/// both Jarvises share one brain.
struct LifeOSService {

    static let urlDefaultsKey = "lifeOSURL"
    static let secretKeychainKey = "com.jarvis.lifeos-secret"

    enum LifeOSError: LocalizedError {
        case notConfigured
        case unreachable(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "The dashboard isn't connected. Add its URL and API secret in Settings."
            case .unreachable(let detail):
                return "I couldn't reach the dashboard. \(detail)"
            }
        }
    }

    var isConfigured: Bool {
        baseURL != nil && !(KeychainHelper.read(Self.secretKeychainKey) ?? "").isEmpty
    }

    private var baseURL: URL? {
        guard var raw = UserDefaults.standard.string(forKey: Self.urlDefaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !raw.isEmpty
        else { return nil }
        if !raw.hasPrefix("http") { raw = "https://" + raw }
        while raw.hasSuffix("/") { raw.removeLast() }
        return URL(string: raw)
    }

    struct ChatResponse: Decodable {
        struct Action: Decodable {
            let type: String?
            let routed_to: String?
        }
        let reply: String
        let action: Action?
    }

    /// Sends messages to the dashboard's Jarvis. Prefix content with
    /// "capture:" to force filing or "ask:" to force a memory answer.
    func chat(messages: [(role: String, content: String)]) async throws -> ChatResponse {
        guard let baseURL,
              let secret = KeychainHelper.read(Self.secretKeychainKey), !secret.isEmpty
        else { throw LifeOSError.notConfigured }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/jarvis/chat"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(secret, forHTTPHeaderField: "x-api-secret")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "messages": messages.map { ["role": $0.role, "content": $0.content] }
        ])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else {
                throw LifeOSError.unreachable("It answered with HTTP \(status).")
            }
            return try JSONDecoder().decode(ChatResponse.self, from: data)
        } catch let error as LifeOSError {
            throw error
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw error
        } catch {
            throw LifeOSError.unreachable(error.localizedDescription)
        }
    }
}
