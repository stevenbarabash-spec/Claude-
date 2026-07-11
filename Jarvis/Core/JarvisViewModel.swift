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
    /// Live mic level (0…1) driving the orb while listening.
    @Published var audioLevel: CGFloat = 0
    /// Hands-free conversation loop: listen → answer → listen again.
    @Published var conversationMode = false

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

    private var silenceMonitor: Task<Void, Never>?
    private var lastSpeechActivity = Date()
    private var heardAnything = false

    /// Rolling conversation memory so chat feels continuous, capped to keep
    /// token costs flat.
    private var chatHistory: [(role: String, content: String)] = []

    var isListening: Bool { state == .listening }

    /// Auto-send after the user stops talking (Settings toggle, default on).
    private var autoSendEnabled: Bool {
        UserDefaults.standard.object(forKey: "autoSend") == nil
            ? true
            : UserDefaults.standard.bool(forKey: "autoSend")
    }

    /// Spoken greeting on launch — time-of-day aware, lightly varied.
    func greet() {
        guard state == .idle else { return }
        let hour = Calendar.current.component(.hour, from: Date())
        let salutation: String
        switch hour {
        case 5..<12: salutation = "Good morning, sir."
        case 12..<17: salutation = "Good afternoon, sir."
        default: salutation = "Good evening, sir."
        }
        let tails = [
            "All systems online.",
            "How can I help today?",
            "What are we up to today?",
            "At your service.",
            "Ready when you are.",
        ]
        say("\(salutation) \(tails.randomElement() ?? "")")
    }

    func toggleConversationMode() {
        conversationMode.toggle()
        if conversationMode {
            if state == .idle { startListening() }
        } else if isListening {
            cancelListening()
        }
    }

    func toggleListening() {
        guard state != .thinking else { return }
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
        heardAnything = false
        lastSpeechActivity = Date()
        do {
            try recognizer.start(
                onTranscript: { [weak self] text in
                    guard let self else { return }
                    self.transcript = text
                    if !text.isEmpty {
                        self.heardAnything = true
                        self.lastSpeechActivity = Date()
                    }
                },
                onLevel: { [weak self] level in
                    // Smooth, and only publish meaningful changes — tiny deltas
                    // at 40Hz just burn the GPU re-rendering the whole screen.
                    guard let self else { return }
                    let smoothed = self.audioLevel * 0.7 + level * 0.3
                    if abs(smoothed - self.audioLevel) > 0.02 {
                        self.audioLevel = smoothed
                    }
                }
            )
            state = .listening
            FX.shared.listenStart()
            if autoSendEnabled || conversationMode {
                startSilenceMonitor()
            }
        } catch {
            errorMessage = error.localizedDescription
            state = .idle
        }
    }

    /// Watches for a pause in speech and auto-sends, so there's no second tap.
    private func startSilenceMonitor() {
        silenceMonitor?.cancel()
        silenceMonitor = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 250_000_000)
                guard let self, self.state == .listening else { return }
                let quietFor = Date().timeIntervalSince(self.lastSpeechActivity)
                if self.heardAnything && quietFor > 1.6 {
                    self.stopListeningAndHandle()
                    return
                }
                if !self.heardAnything && quietFor > 10 {
                    // Ten seconds of nothing — stand down instead of looping forever.
                    self.cancelListening()
                    self.conversationMode = false
                    return
                }
            }
        }
    }

    private func cancelListening() {
        silenceMonitor?.cancel()
        recognizer.stop()
        audioLevel = 0
        transcript = ""
        state = .idle
    }

    private func stopListeningAndHandle() {
        silenceMonitor?.cancel()
        recognizer.stop()
        audioLevel = 0
        let heard = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !heard.isEmpty else {
            state = .idle
            return
        }
        FX.shared.sendOff()
        Task { await handle(transcript: heard) }
    }

    /// Entry point for both spoken commands and Siri App Intent handoffs.
    func handle(transcript: String) async {
        self.transcript = transcript
        state = .thinking
        FX.shared.startThinking()
        do {
            let action = try await router.route(transcript)
            try await perform(action, originalText: transcript)
        } catch {
            errorMessage = error.localizedDescription
            FX.shared.stopThinking()
            FX.shared.failure()
            say("Sorry, something went wrong. \(error.localizedDescription)")
        }
    }

    private func perform(_ action: JarvisAction, originalText: String) async throws {
        switch action {
        case .speak(let text):
            say(text)

        case .chatAnswer:
            await chatAnswer(question: originalText)

        case .remember(let fact):
            await MemoryStore.shared.remember(fact)
            say("Noted, sir. Committed to memory.")

        case .delegateTask(let task):
            do {
                try await TaskDispatcher.dispatch(task)
                FX.shared.dispatch()
                say("Dispatched to headquarters, sir. It'll be picked up within the hour.")
            } catch {
                say(error.localizedDescription)
            }

        case .featureRequest(let feature):
            Wishlist.add(feature)
            try? await TaskDispatcher.addToWishlist(feature)
            say("That's beyond my current abilities, sir — I've added it to the feature wishlist for your next build session.")

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

    // MARK: - Conversation

    /// Free-form chat with memory and live web search — Jarvis's direct line
    /// to Claude, including news and current events.
    private func chatAnswer(question: String) async {
        let question = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else {
            state = .idle
            return
        }
        chatHistory.append((role: "user", content: question))
        if chatHistory.count > 24 {
            chatHistory.removeFirst(chatHistory.count - 24)
        }
        do {
            let system = """
            You are JARVIS: the user's personal AI — composed, precise, dryly witty, with the understated \
            manner of an impeccable British butler. Address the user as "sir" occasionally, never every sentence. \
            Your replies are spoken aloud, so answer in natural speech: 1-4 sentences for most things, longer \
            only when genuinely needed, never markdown, never lists read as bullets. \
            You have live web search — use it for news, current events, weather, sports, prices, or anything \
            time-sensitive, and mention when information is fresh from the web. \
            Today is \(Date().formatted(date: .complete, time: .shortened)).
            \(MemoryStore.shared.contextBlock)
            \(JarvisCapabilities.promptSummary)
            \(JarvisKnowledge.scheduleContext)
            """
            let reply = try await claude.chat(system: system,
                                              history: chatHistory,
                                              enableWebSearch: true)
            chatHistory.append((role: "assistant", content: reply))
            say(reply)
        } catch {
            chatHistory.removeLast()
            say("I couldn't reach Claude just now. \(error.localizedDescription)")
        }
    }

    // MARK: - Music

    private func playMusic(query: String) async {
        say("Opening Spotify for \(query).")
        SpotifyController.play(query: query)
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
            You are JARVIS — composed, dryly witty, impeccably British. Turn the user's agenda into a spoken
            morning briefing: 2-4 sentences, natural speech, note conflicts or tight transitions, address the
            user as "sir" once at most, no markdown. Today is \(Date().formatted(date: .complete, time: .shortened)).
            """
            let briefing = try await claude.complete(
                system: system,
                user: agenda + MemoryStore.shared.contextBlock + JarvisKnowledge.scheduleContext)
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
            You are JARVIS — composed, dryly witty, impeccably British. Turn these health stats into a spoken
            2-3 sentence weekly digest: encouraging with a hint of wit, note one trend worth acting on,
            no markdown, no medical advice.
            """
            let digest = try await claude.complete(system: system, user: summary)
            say(digest)
        } catch {
            say("I couldn't read your health data. \(error.localizedDescription)")
        }
    }

    // MARK: - Speech

    private func say(_ text: String) {
        FX.shared.stopThinking()
        FX.shared.responseReady()
        response = text
        state = .speaking
        synthesizer.speak(text) { [weak self] in
            Task { @MainActor in
                guard let self, self.state == .speaking else { return }
                self.state = .idle
                // Hands-free loop: go straight back to listening, unless a
                // compose sheet needs the user's attention first.
                if self.conversationMode,
                   self.emailDraft == nil, self.messageDraft == nil, !self.showInbox {
                    self.startListening()
                }
            }
        }
    }
}
