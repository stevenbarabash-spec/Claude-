import AppIntents
import Foundation

extension Notification.Name {
    /// Posted by the Siri App Intent with the spoken question as the object.
    static let jarvisAsk = Notification.Name("com.jarvis.ask")
}

/// "Hey Siri, ask Jarvis <something>" — opens the app and runs the command
/// through the normal Jarvis pipeline. Also works from the Shortcuts app and
/// the iPhone Action Button.
struct AskJarvisIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Jarvis"
    static var description = IntentDescription("Ask Jarvis to answer a question, draft an email or text, set a reminder, or play music.")
    static var openAppWhenRun = true

    @Parameter(title: "Question or command")
    var question: String

    @MainActor
    func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(name: .jarvisAsk, object: question)
        return .result()
    }
}

/// "Hey Siri, Jarvis play <song>" — jumps straight into Spotify.
struct JarvisPlayMusicIntent: AppIntent {
    static var title: LocalizedStringResource = "Jarvis Play Music"
    static var description = IntentDescription("Have Jarvis open Spotify and search for a song, artist, or playlist.")
    static var openAppWhenRun = true

    @Parameter(title: "Song, artist, or playlist")
    var query: String

    @MainActor
    func perform() async throws -> some IntentResult {
        SpotifyController.play(query: query)
        return .result()
    }
}

/// "Hey Siri, Jarvis briefing" — calendar-aware morning briefing. Pair it with
/// a Shortcuts personal automation (time of day → run this) for a hands-free
/// spoken briefing every morning.
struct JarvisBriefingIntent: AppIntent {
    static var title: LocalizedStringResource = "Jarvis Briefing"
    static var description = IntentDescription("Get your calendar-aware daily briefing, spoken aloud.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(name: .jarvisAsk, object: "Give me my briefing")
        return .result()
    }
}

struct JarvisShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskJarvisIntent(),
            // Free-form String parameters can't appear inside Siri phrases, so
            // Siri asks "What's your question?" after you say "Ask Jarvis".
            phrases: [
                "Ask \(.applicationName)",
                "Talk to \(.applicationName)",
            ],
            shortTitle: "Ask Jarvis",
            systemImageName: "waveform.circle"
        )
        AppShortcut(
            intent: JarvisPlayMusicIntent(),
            phrases: [
                "Play music with \(.applicationName)",
            ],
            shortTitle: "Play Music",
            systemImageName: "music.note"
        )
        AppShortcut(
            intent: JarvisBriefingIntent(),
            phrases: [
                "\(.applicationName) briefing",
                "Get my briefing from \(.applicationName)",
            ],
            shortTitle: "Briefing",
            systemImageName: "sun.max"
        )
    }
}
