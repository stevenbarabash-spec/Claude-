import Foundation

/// Jarvis's long-term memory.
///
/// Facts live locally (instantly available, works offline) and sync to a
/// **private GitHub Gist** when a token is configured — so memory survives
/// reinstalls and can be shared by Jarvis on other devices later. Every
/// conversation, routing decision, and briefing gets the memory injected.
final class MemoryStore {

    static let shared = MemoryStore()
    private init() {}

    static let tokenKeychainKey = "com.jarvis.github-token"
    private let memoryKey = "jarvisMemory"
    private let gistIDKey = "memoryGistID"
    private let fileName = "jarvis-memory.md"

    var memoryText: String {
        get { UserDefaults.standard.string(forKey: memoryKey) ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: memoryKey) }
    }

    var hasToken: Bool {
        !(KeychainHelper.read(Self.tokenKeychainKey) ?? "").isEmpty
    }

    var isSyncing: Bool {
        hasToken && UserDefaults.standard.string(forKey: gistIDKey) != nil
    }

    /// Injected into every prompt so remembered facts stay top of mind.
    var contextBlock: String {
        let memory = memoryText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !memory.isEmpty else { return "" }
        return """

        --- Long-term memory (facts the user told you to remember — treat as always true) ---
        \(memory)
        --- end of memory ---
        """
    }

    func remember(_ fact: String) async {
        let stamp = Date().formatted(date: .abbreviated, time: .omitted)
        memoryText += (memoryText.isEmpty ? "" : "\n") + "- \(fact) (noted \(stamp))"
        await syncUp()
    }

    func replaceMemory(with text: String) async {
        memoryText = text
        await syncUp()
    }

    // MARK: - GitHub Gist sync

    /// Pulls remote memory at launch when local is empty (fresh install).
    func syncDown() async {
        guard hasToken,
              let gistID = UserDefaults.standard.string(forKey: gistIDKey),
              memoryText.isEmpty
        else { return }

        var request = URLRequest(url: URL(string: "https://api.github.com/gists/\(gistID)")!)
        authorize(&request)
        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return }

        struct Gist: Decodable {
            struct File: Decodable { let content: String? }
            let files: [String: File]
        }
        if let gist = try? JSONDecoder().decode(Gist.self, from: data),
           let content = gist.files[fileName]?.content,
           content != "(empty)" {
            memoryText = content
        }
    }

    func syncUp() async {
        guard let token = KeychainHelper.read(Self.tokenKeychainKey), !token.isEmpty else { return }

        let body: [String: Any] = [
            "description": "Jarvis long-term memory",
            "public": false,
            "files": [fileName: ["content": memoryText.isEmpty ? "(empty)" : memoryText]],
        ]

        if let gistID = UserDefaults.standard.string(forKey: gistIDKey) {
            var request = URLRequest(url: URL(string: "https://api.github.com/gists/\(gistID)")!)
            request.httpMethod = "PATCH"
            authorize(&request)
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            _ = try? await URLSession.shared.data(for: request)
        } else {
            var request = URLRequest(url: URL(string: "https://api.github.com/gists")!)
            request.httpMethod = "POST"
            authorize(&request)
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            if let (data, _) = try? await URLSession.shared.data(for: request),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let id = json["id"] as? String {
                UserDefaults.standard.set(id, forKey: gistIDKey)
            }
        }
    }

    private func authorize(_ request: inout URLRequest) {
        if let token = KeychainHelper.read(Self.tokenKeychainKey), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
}
