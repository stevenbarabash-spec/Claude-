import Foundation
import AVFoundation

/// Jarvis talks back using on-device text-to-speech.
final class SpeechSynthesizer: NSObject, AVSpeechSynthesizerDelegate {

    private let synthesizer = AVSpeechSynthesizer()
    private var completion: (() -> Void)?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String, completion: (() -> Void)? = nil) {
        self.completion = completion
        synthesizer.stopSpeaking(at: .immediate)

        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true)

        let utterance = AVSpeechUtterance(string: text)
        // Prefer an enhanced-quality voice when one is downloaded (Settings →
        // Accessibility → Spoken Content → Voices).
        let language = Locale.preferredLanguages.first ?? "en-US"
        let enhanced = AVSpeechSynthesisVoice.speechVoices().first {
            $0.language == language && $0.quality != .default
        }
        utterance.voice = enhanced ?? AVSpeechSynthesisVoice(language: language)
        utterance.rate = 0.5
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: - AVSpeechSynthesizerDelegate

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        completion?()
        completion = nil
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        completion?()
        completion = nil
    }
}
