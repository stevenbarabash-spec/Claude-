import Foundation
import AVFoundation
import Speech

/// Live speech-to-text using SFSpeechRecognizer + AVAudioEngine.
final class SpeechRecognizer {

    enum RecognizerError: LocalizedError {
        case notAuthorized
        case unavailable

        var errorDescription: String? {
            switch self {
            case .notAuthorized:
                return "Speech recognition permission was denied. Enable it in Settings → Privacy."
            case .unavailable:
                return "Speech recognition isn't available on this device right now."
            }
        }
    }

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: Locale.preferredLanguages.first ?? "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    /// Starts transcribing; `onTranscript` is called on the main thread with the
    /// best transcription so far, and `onLevel` with the mic level (0…1) so the
    /// UI can react to the user's voice.
    func start(onTranscript: @escaping (String) -> Void,
               onLevel: @escaping (CGFloat) -> Void = { _ in }) throws {
        stop()

        // Permissions are requested lazily on first use; iOS shows the system prompts.
        SFSpeechRecognizer.requestAuthorization { _ in }
        AVAudioApplication.requestRecordPermission { _ in }

        guard SFSpeechRecognizer.authorizationStatus() != .denied else {
            throw RecognizerError.notAuthorized
        }
        guard let recognizer, recognizer.isAvailable else {
            throw RecognizerError.unavailable
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
            let level = Self.normalizedLevel(of: buffer)
            DispatchQueue.main.async { onLevel(level) }
        }

        audioEngine.prepare()
        try audioEngine.start()

        task = recognizer.recognitionTask(with: request) { result, _ in
            guard let result else { return }
            let text = result.bestTranscription.formattedString
            DispatchQueue.main.async { onTranscript(text) }
        }
    }

    /// Root-mean-square of the buffer mapped to a UI-friendly 0…1 range.
    private static func normalizedLevel(of buffer: AVAudioPCMBuffer) -> CGFloat {
        guard let channelData = buffer.floatChannelData?[0] else { return 0 }
        let frames = Int(buffer.frameLength)
        guard frames > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<frames { sum += channelData[i] * channelData[i] }
        let rms = sqrt(sum / Float(frames))
        let db = 20 * log10(max(rms, 0.000_01))
        // Map roughly -50 dB (quiet room) … -10 dB (speaking close) to 0…1.
        return CGFloat(min(max((db + 50) / 40, 0), 1))
    }

    func stop() {
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
    }
}
