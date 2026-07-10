import Foundation
import AVFoundation

/// Jarvis's voice. Uses ElevenLabs when configured (cinematic, Jarvis-like);
/// otherwise the best British voice installed on the device — download a
/// premium one under Settings → Accessibility → Spoken Content → Voices →
/// English (UK) for a big free upgrade.
final class SpeechSynthesizer: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {

    private let synthesizer = AVSpeechSynthesizer()
    private let elevenLabs = ElevenLabsService()
    private var player: AVAudioPlayer?
    private var completion: (() -> Void)?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String, completion: (() -> Void)? = nil) {
        stop()
        self.completion = completion

        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true)

        guard elevenLabs.isConfigured else {
            speakOnDevice(text)
            return
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                let audio = try await elevenLabs.synthesize(text)
                let player = try AVAudioPlayer(data: audio)
                player.delegate = self
                self.player = player
                player.play()
            } catch {
                // Network/quota hiccup — fall back to the on-device voice.
                await MainActor.run { self.speakOnDevice(text) }
            }
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        player?.stop()
        player = nil
        completion = nil
    }

    // MARK: - On-device fallback

    private func speakOnDevice(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.bestVoice()
        utterance.rate = 0.5
        synthesizer.speak(utterance)
    }

    /// Prefers a premium/enhanced British voice (Jarvis is British, after
    /// all), then any British voice, then the best voice for the user's locale.
    private static func bestVoice() -> AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices()
        let byQuality: (AVSpeechSynthesisVoice, AVSpeechSynthesisVoice) -> Bool = {
            $0.quality.rawValue > $1.quality.rawValue
        }
        if let british = voices.filter({ $0.language == "en-GB" }).sorted(by: byQuality).first {
            return british
        }
        let language = Locale.preferredLanguages.first ?? "en-US"
        return voices.filter { $0.language == language }.sorted(by: byQuality).first
            ?? AVSpeechSynthesisVoice(language: language)
    }

    // MARK: - Delegates

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finish()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finish()
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        finish()
    }

    private func finish() {
        completion?()
        completion = nil
        player = nil
    }
}
