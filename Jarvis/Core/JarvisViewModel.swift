import Foundation
import SwiftUI

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

    private let recognizer = SpeechRecognizer()
    private let synthesizer = SpeechSynthesizer()
    private let router = CommandRouter()

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

        case .openSpotify(let query):
            say("Opening Spotify for \(query).")
            SpotifyController.play(query: query)

        case .composeEmail(let draft):
            say("I've drafted that email. Review it and hit send.")
            emailDraft = draft

        case .composeMessage(let draft):
            say("Your message is ready. Review it and hit send.")
            messageDraft = draft

        case .scheduleReminder(let text, let date):
            try await NotificationManager.shared.scheduleReminder(text, at: date)
            let formatted = date.formatted(date: .abbreviated, time: .shortened)
            say("Done. I'll remind you to \(text) at \(formatted).")
        }
    }

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
