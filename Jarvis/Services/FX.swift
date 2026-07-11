import AVFoundation
import UIKit

/// Jarvis's sensory layer: synthesized sci-fi tones + haptics.
/// All sounds are generated in code (pure sine sweeps with smooth envelopes),
/// so there are no audio assets to bundle. Toggle lives in Settings.
final class FX {

    static let shared = FX()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format: AVAudioFormat

    var enabled: Bool {
        UserDefaults.standard.object(forKey: "fxEnabled") == nil
            ? true
            : UserDefaults.standard.bool(forKey: "fxEnabled")
    }

    private init() {
        format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 0.35
    }

    // MARK: - Cues

    /// Ascending boot chime — very "systems online, sir."
    func boot() {
        tone([(392, 0.09), (523.25, 0.09), (659.25, 0.09), (1046.5, 0.22)], gain: 0.4)
        impact(.medium)
    }

    func listenStart() {
        tone([(880, 0.06), (1320, 0.10)], gain: 0.35)
        impact(.light)
    }

    func sendOff() {
        tone([(1320, 0.05), (880, 0.08)], gain: 0.3)
        impact(.soft)
    }

    func responseReady() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    func failure() {
        tone([(220, 0.18), (185, 0.22)], gain: 0.35)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    /// Triple rising blip for tasks dispatched to headquarters.
    func dispatch() {
        tone([(660, 0.06), (990, 0.06), (1480, 0.12)], gain: 0.35)
        impact(.rigid)
    }

    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    // MARK: - Tone synthesis

    private func tone(_ steps: [(freq: Double, dur: Double)], gain: Float) {
        guard enabled else { return }
        if !engine.isRunning { try? engine.start() }
        guard engine.isRunning else { return }

        let sampleRate = format.sampleRate
        let totalFrames = AVAudioFrameCount(steps.reduce(0) { $0 + sampleRate * $1.dur })
        guard totalFrames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: totalFrames),
              let data = buffer.floatChannelData?[0]
        else { return }
        buffer.frameLength = totalFrames

        var index = 0
        for step in steps {
            let frames = Int(sampleRate * step.dur)
            for i in 0..<frames where index < Int(totalFrames) {
                let t = Double(i) / sampleRate
                // Half-sine envelope: smooth attack and decay, no clicks.
                let envelope = sin(.pi * Double(i) / Double(frames))
                data[index] = Float(sin(2 * .pi * step.freq * t) * envelope) * gain
                index += 1
            }
        }

        player.scheduleBuffer(buffer, at: nil, options: .interrupts)
        player.play()
    }
}
