import Foundation

struct EmailDraft: Identifiable, Equatable {
    let id = UUID()
    var recipient: String
    var subject: String
    var body: String
}

struct MessageDraft: Identifiable, Equatable {
    let id = UUID()
    var recipient: String
    var body: String
}

enum JarvisAction {
    case speak(String)
    case openSpotify(query: String)
    case composeEmail(EmailDraft)
    case composeMessage(MessageDraft)
    case scheduleReminder(text: String, date: Date)
}

/// Decides what to do with a transcript.
///
/// Strategy: ask Claude to classify the command into a small JSON action schema
/// (which also lets it draft the email/message body in the same call). If no
/// API key is configured, fall back to simple keyword matching so music and
/// reminders still work offline.
struct CommandRouter {

    private let claude = ClaudeService()

    func route(_ transcript: String) async throws -> JarvisAction {
        guard claude.hasAPIKey else {
            return fallbackRoute(transcript)
        }
        do {
            return try await claudeRoute(transcript)
        } catch {
            // If the model call fails, degrade gracefully to keyword matching.
            return fallbackRoute(transcript)
        }
    }

    // MARK: - Claude-powered routing

    private struct RoutedAction: Decodable {
        let action: String
        let query: String?
        let recipient: String?
        let subject: String?
        let body: String?
        let reminderText: String?
        let reminderISODate: String?
        let reply: String?
    }

    private func claudeRoute(_ transcript: String) async throws -> JarvisAction {
        let now = ISO8601DateFormatter().string(from: Date())
        let system = """
        You are Jarvis, a voice assistant on the user's iPhone. The current date-time is \(now) (device local time zone).
        Classify the user's spoken command and respond with ONLY a JSON object, no prose, matching one of:

        {"action":"play_music","query":"<song, artist or playlist to search on Spotify>"}
        {"action":"email","recipient":"<name or address if spoken, else empty>","subject":"<subject line>","body":"<a complete, well-written email body signed off appropriately>"}
        {"action":"message","recipient":"<name or number if spoken, else empty>","body":"<a natural text message>"}
        {"action":"reminder","reminderText":"<what to remind>","reminderISODate":"<ISO8601 date-time for the reminder>"}
        {"action":"answer","reply":"<a concise spoken-style answer to the user's question, 1-3 sentences>"}

        Rules: for email/message, write the full content yourself from the user's intent — do not include placeholders like [name].
        If the command doesn't fit the first four actions, use "answer".
        """

        let raw = try await claude.complete(system: system, user: transcript)
        let json = Self.extractJSON(from: raw)
        guard let data = json.data(using: .utf8),
              let routed = try? JSONDecoder().decode(RoutedAction.self, from: data)
        else {
            // Model didn't return valid JSON — treat its output as a spoken answer.
            return .speak(raw.trimmingCharacters(in: .whitespacesAndNewlines))
        }

        switch routed.action {
        case "play_music":
            return .openSpotify(query: routed.query ?? transcript)
        case "email":
            return .composeEmail(EmailDraft(
                recipient: routed.recipient ?? "",
                subject: routed.subject ?? "",
                body: routed.body ?? ""
            ))
        case "message":
            return .composeMessage(MessageDraft(
                recipient: routed.recipient ?? "",
                body: routed.body ?? ""
            ))
        case "reminder":
            let date = routed.reminderISODate.flatMap { ISO8601DateFormatter().date(from: $0) }
                ?? Date().addingTimeInterval(3600)
            return .scheduleReminder(text: routed.reminderText ?? transcript, date: date)
        default:
            return .speak(routed.reply ?? "I'm not sure how to help with that.")
        }
    }

    /// Models sometimes wrap JSON in markdown fences — strip anything around the outermost braces.
    private static func extractJSON(from text: String) -> String {
        guard let start = text.firstIndex(of: "{"),
              let end = text.lastIndex(of: "}")
        else { return text }
        return String(text[start...end])
    }

    // MARK: - Offline fallback

    private func fallbackRoute(_ transcript: String) -> JarvisAction {
        let lower = transcript.lowercased()

        if lower.hasPrefix("play ") || lower.contains("on spotify") {
            var query = transcript
            if let range = query.range(of: "play ", options: [.caseInsensitive, .anchored]) {
                query.removeSubrange(range)
            }
            query = query.replacingOccurrences(of: "on spotify", with: "", options: .caseInsensitive)
            return .openSpotify(query: query.trimmingCharacters(in: .whitespaces))
        }

        if lower.hasPrefix("remind me") {
            let text = String(transcript.dropFirst("remind me".count))
                .trimmingCharacters(in: CharacterSet(charactersIn: " to"))
            return .scheduleReminder(text: text.isEmpty ? transcript : text,
                                     date: Date().addingTimeInterval(3600))
        }

        if lower.hasPrefix("email ") {
            return .composeEmail(EmailDraft(recipient: "", subject: "", body: transcript))
        }

        if lower.hasPrefix("text ") || lower.hasPrefix("message ") {
            return .composeMessage(MessageDraft(recipient: "", body: transcript))
        }

        return .speak("Add your Claude API key in Settings and I can answer questions and draft emails and texts for you.")
    }
}
