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
    /// Free-form conversation — handled with chat history + live web search.
    case chatAnswer
    case playMusic(query: String)
    case composeEmail(EmailDraft)
    case composeMessage(MessageDraft)
    case scheduleReminder(text: String, date: Date)
    case scheduleLocationReminder(text: String, placeName: String, onArrive: Bool)
    case briefing
    case checkEmail
    case home(command: String)
    case healthDigest
}

/// Decides what to do with a transcript.
///
/// Strategy: ask Claude to classify the command into a small JSON action schema
/// (which also lets it draft the email/message body in the same call). If no
/// API key is configured, fall back to simple keyword matching so music,
/// reminders, and home control still work offline.
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
        let place: String?
        let trigger: String?
        let command: String?
        let reply: String?
    }

    private func claudeRoute(_ transcript: String) async throws -> JarvisAction {
        let now = ISO8601DateFormatter().string(from: Date())
        let places = PlacesStore.all().map(\.name).joined(separator: ", ")
        let system = """
        You are JARVIS: the user's personal AI — composed, precise, dryly witty, with the understated manner of an impeccable British butler. Address the user as "sir" occasionally (not every sentence). Never break character.
        You run on the user's iPhone. The current date-time is \(now) (device local time zone).
        The user's saved places are: [\(places)].
        Classify the user's spoken command and respond with ONLY a JSON object, no prose, matching one of:

        {"action":"play_music","query":"<song, artist or playlist>"}
        {"action":"email","recipient":"<name or address if spoken, else empty>","subject":"<subject line>","body":"<a complete, well-written email body signed off appropriately>"}
        {"action":"message","recipient":"<name or number if spoken, else empty>","body":"<a natural text message>"}
        {"action":"reminder","reminderText":"<what to remind>","reminderISODate":"<ISO8601 date-time>"}
        {"action":"location_reminder","reminderText":"<what to remind>","place":"<one of the saved places>","trigger":"arrive|leave"}
        {"action":"briefing"}  // "what's my day look like", "morning briefing", "what's on my calendar"
        {"action":"check_email"}  // "check my email", "any new emails", "triage my inbox"
        {"action":"home","command":"<the home command verbatim>"}  // lights, scenes, thermostat, smart home
        {"action":"health"}  // "how did I sleep", "health summary", "how active was I"
        {"action":"answer","reply":"<a concise spoken-style answer in JARVIS's voice, 1-3 sentences>"}

        Rules: for email/message, write the full content yourself from the user's intent — no placeholders like [name].
        Use location_reminder only when the reminder is tied to a saved place; otherwise use reminder.
        If nothing else fits, use "answer".
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
            return .playMusic(query: routed.query ?? transcript)
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
        case "location_reminder":
            return .scheduleLocationReminder(
                text: routed.reminderText ?? transcript,
                placeName: routed.place ?? "home",
                onArrive: routed.trigger != "leave"
            )
        case "briefing":
            return .briefing
        case "check_email":
            return .checkEmail
        case "home":
            return .home(command: routed.command ?? transcript)
        case "health":
            return .healthDigest
        default:
            // Questions, chat, news — answered conversationally with history
            // and web search rather than the one-shot routing reply.
            return .chatAnswer
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
            return .playMusic(query: query.trimmingCharacters(in: .whitespaces))
        }

        if lower.contains("briefing") || lower.contains("my day") || lower.contains("calendar") {
            return .briefing
        }

        if lower.contains("email") && (lower.contains("check") || lower.contains("inbox") || lower.contains("new")) {
            return .checkEmail
        }

        if lower.contains("light") || lower.contains("thermostat") || lower.contains("scene") {
            return .home(command: transcript)
        }

        if lower.contains("sleep") || lower.contains("health") || lower.contains("workout") {
            return .healthDigest
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
