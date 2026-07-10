import Foundation
import SwiftUI

/// One triaged inbox email, ready for the InboxView.
struct TriagedEmail: Identifiable {
    let id: String
    let message: GmailMessage
    let category: String
    let summary: String
    let needsReply: Bool
    var suggestedReply: String?
}

/// Orchestrates the whole loop: listen → transcribe → route → act → speak.
@MainActor
final class JarvisViewModel: ObservableObject {

    enum State: Equatable {
        case idle
        case listening
        case thinking
        case speaking
    }

    @Published var state: State = .idle
    @Published var transcript: String = ""
    @Published var response: String = ""
    @Published var errorMessage: String?

    // Compose sheets the UI presents when Jarvis has drafted something.
    @Published var emailDraft: EmailDraft?
    @Published var messageDraft: MessageDraft?

    // Gmail triage results.
    @Published var inbox: [TriagedEmail] = []
    @Published var showInbox = false

    private let recognizer = SpeechRecognizer()
    private let synthesizer = SpeechSynthesizer()
    private let router = CommandRouter()
    private let claude = ClaudeService()

    var isListening: Bool { state == .listening }

    func toggleListening() {
        if isListening {
            stopListeningAndHandle()
        } else {
            startListening()
        }
    }

    private func startListening() {
        errorMessage = nil
        response = ""
        transcript = ""
        do {
            try recognizer.start { [weak self] text in
                self?.transcript = text
            }
            state = .listening
        } catch {
            errorMessage = error.localizedDescription
            state = .idle
        }
    }

    private func stopListeningAndHandle() {
        recognizer.stop()
        let heard = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !heard.isEmpty else {
            state = .idle
            return
        }
        Task { await handle(transcript: heard) }
    }

    /// Entry point for both spoken commands and Siri App Intent handoffs.
    func handle(transcript: String) async {
        self.transcript = transcript
        state = .thinking
        do {
            let action = try await router.route(transcript)
            try await perform(action)
        } catch {
            errorMessage = error.localizedDescription
            say("Sorry, something went wrong. \(error.localizedDescription)")
        }
    }

    private func perform(_ action: JarvisAction) async throws {
        switch action {
        case .speak(let text):
            say(text)

        case .playMusic(let query):
            await playMusic(query: query)

        case .composeEmail(var draft):
            // Resolve a spoken name to a real address from Contacts.
            if let match = await ContactsService.resolve(name: draft.recipient), let email = match.email {
                draft.recipient = email
            }
            say("I've drafted that email. Review it and hit send.")
            emailDraft = draft

        case .composeMessage(var draft):
            if let match = await ContactsService.resolve(name: draft.recipient), let phone = match.phone {
                draft.recipient = phone
            }
            say("Your message is ready. Review it and hit send.")
            messageDraft = draft

        case .scheduleReminder(let text, let date):
            try await NotificationManager.shared.scheduleReminder(text, at: date)
            let formatted = date.formatted(date: .abbreviated, time: .shortened)
            say("Done. I'll remind you to \(text) at \(formatted).")

        case .scheduleLocationReminder(let text, let placeName, let onArrive):
            guard let place = PlacesStore.place(named: placeName) else {
                say("I don't have a location saved for \(placeName). Save it in Settings first.")
                return
            }
            try await NotificationManager.shared.scheduleLocationReminder(text, place: place, onArrive: onArrive)
            say("Done. I'll remind you to \(text) when you \(onArrive ? "arrive at" : "leave") \(placeName).")

        case .briefing:
            await deliverBriefing()

        case .checkEmail:
            await triageInbox()

        case .home(let command):
            let result = await HomeController.shared.execute(command)
            say(result)

        case .healthDigest:
            await deliverHealthDigest()
        }
    }

    // MARK: - Music

    private func playMusic(query: String) async {
        let provider = UserDefaults.standard.string(forKey: "musicProvider") ?? "spotify"
        if provider == "apple" {
            do {
                let confirmation = try await MusicController.play(query: query)
                say(confirmation)
            } catch {
                say("Apple Music didn't work — trying Spotify. \(error.localizedDescription)")
                SpotifyController.play(query: query)
            }
        } else {
            say("Opening Spotify for \(query).")
            SpotifyController.play(query: query)
        }
    }

    // MARK: - Briefing

    private func deliverBriefing() async {
        guard await CalendarService.shared.requestAccess() else {
            say("I need calendar access for briefings. You can grant it in Settings, Privacy, Calendars.")
            return
        }
        let agenda = CalendarService.shared.agendaText()
        CalendarService.shared.refreshWidgetCache()

        guard claude.hasAPIKey else {
            say(agenda)
            return
        }
        do {
            let system = """
            You are Jarvis, a witty but efficient personal assistant. Turn the user's agenda into a spoken
            morning briefing: 2-4 sentences, natural speech, note conflicts or tight transitions, no markdown.
            Today is \(Date().formatted(date: .complete, time: .shortened)).
            """
            let briefing = try await claude.complete(system: system, user: agenda)
            say(briefing)
        } catch {
            say(agenda)
        }
    }

    // MARK: - Gmail triage

    private func triageInbox() async {
        guard GmailService.shared.isConnected else {
            say("Gmail isn't connected yet. Add your Google client ID in Settings and tap Connect.")
            return
        }
        do {
            let messages = try await GmailService.shared.fetchUnread()
            guard !messages.isEmpty else {
                say("Inbox zero. Nothing unread.")
                return
            }

            let serialized = messages
                .map { "id:\($0.id)\nfrom:\($0.from)\nsubject:\($0.subject)\nsnippet:\($0.snippet)" }
                .joined(separator: "\n---\n")

            let system = """
            You triage the user's email. For each message respond with a JSON array of objects:
            [{"id":"<id>","category":"urgent|personal|work|newsletter|spam","summary":"<one short sentence>","needsReply":true|false,"suggestedReply":"<a complete reply in the user's casual-professional voice, or null>"}]
            Respond with ONLY the JSON array.
            """
            let raw = try await claude.complete(system: system, user: serialized, maxTokens: 2048)

            struct Triage: Decodable {
                let id: String
                let category: String
                let summary: String
                let needsReply: Bool
                let suggestedReply: String?
            }
            let json = Self.extractJSONArray(from: raw)
            let triage = (try? JSONDecoder().decode([Triage].self, from: Data(json.utf8))) ?? []

            inbox = messages.map { message in
                let t = triage.first { $0.id == message.id }
                return TriagedEmail(
                    id: message.id,
                    message: message,
                    category: t?.category ?? "unsorted",
                    summary: t?.summary ?? message.snippet,
                    needsReply: t?.needsReply ?? false,
                    suggestedReply: t?.suggestedReply
                )
            }

            let needing = inbox.filter(\.needsReply).count
            showInbox = true
            say("You have \(messages.count) unread emails. \(needing) look like they need replies — I've drafted them.")
        } catch {
            say("I couldn't check your email. \(error.localizedDescription)")
        }
    }

    private static func extractJSONArray(from text: String) -> String {
        guard let start = text.firstIndex(of: "["),
              let end = text.lastIndex(of: "]")
        else { return text }
        return String(text[start...end])
    }

    // MARK: - Health

    private func deliverHealthDigest() async {
        do {
            let summary = try await HealthService.shared.weeklySummaryText()
            guard claude.hasAPIKey else {
                say(summary)
                return
            }
            let system = """
            You are Jarvis, a supportive personal assistant. Turn these health stats into a spoken 2-3
            sentence weekly digest: encouraging, note one trend worth acting on, no markdown, no medical advice.
            """
            let digest = try await claude.complete(system: system, user: summary)
            say(digest)
        } catch {
            say("I couldn't read your health data. \(error.localizedDescription)")
        }
    }

    // MARK: - Speech

    private func say(_ text: String) {
        response = text
        state = .speaking
        synthesizer.speak(text) { [weak self] in
            Task { @MainActor in
                if self?.state == .speaking { self?.state = .idle }
            }
        }
    }
}
