import Foundation

/// External knowledge Jarvis carries into every conversation — e.g. the
/// user's weekly/monthly schedule tracker artifacts. Share links are pasted
/// in Settings; content is fetched, de-HTML'd, cached, and injected into the
/// chat and briefing prompts. Refreshes every 30 minutes.
enum JarvisKnowledge {

    static let urlsKey = "knowledgeURLs"           // newline-separated share links
    private static let cacheKey = "knowledgeCache"
    private static let cacheDateKey = "knowledgeCacheDate"

    /// Injected into system prompts. Empty string when nothing is configured.
    static var scheduleContext: String {
        let cached = UserDefaults.standard.string(forKey: cacheKey) ?? ""
        guard !cached.isEmpty else { return "" }
        return """

        --- The user's schedule / work dashboard (auto-fetched, may be slightly stale) ---
        \(cached)
        --- end of dashboard ---
        Use this when the user asks about their schedule, week, month, or workload.
        """
    }

    static func refreshIfStale(maxAge: TimeInterval = 1800) async {
        let last = UserDefaults.standard.object(forKey: cacheDateKey) as? Date ?? .distantPast
        guard Date().timeIntervalSince(last) > maxAge else { return }
        await refresh()
    }

    static func refresh() async {
        let raw = UserDefaults.standard.string(forKey: urlsKey) ?? ""
        let urls = raw
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        guard !urls.isEmpty else {
            UserDefaults.standard.removeObject(forKey: cacheKey)
            return
        }

        var chunks: [String] = []
        for urlString in urls {
            guard let url = URL(string: urlString),
                  let (data, response) = try? await URLSession.shared.data(from: url),
                  (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                  let html = String(data: data, encoding: .utf8)
            else { continue }

            var text = plainText(from: html)
            if text.count < 200 {
                // Data likely lives inside scripts (common for dashboards) —
                // fall back to the raw page, capped.
                text = html
            }
            chunks.append(String(text.prefix(5000)))
        }

        guard !chunks.isEmpty else { return }
        UserDefaults.standard.set(chunks.joined(separator: "\n---\n"), forKey: cacheKey)
        UserDefaults.standard.set(Date(), forKey: cacheDateKey)
    }

    private static func plainText(from html: String) -> String {
        var text = html
        for pattern in ["<script[\\s\\S]*?</script>", "<style[\\s\\S]*?</style>", "<[^>]+>"] {
            text = text.replacingOccurrences(of: pattern, with: " ", options: .regularExpression)
        }
        return text
            .replacingOccurrences(of: "\\s{2,}", with: "\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
