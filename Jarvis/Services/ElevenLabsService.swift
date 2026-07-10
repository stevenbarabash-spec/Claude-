import Foundation

/// Optional cinematic voice via ElevenLabs (elevenlabs.io — free tier works).
/// When a key is configured, Jarvis speaks with this voice; otherwise it falls
/// back to the best on-device British voice.
struct ElevenLabsService {

    static let keychainKey = "com.jarvis.elevenlabs-key"
    static let voiceIDDefaultsKey = "elevenLabsVoiceID"
    /// ElevenLabs' premade "Daniel" — a deep, calm British voice, very Jarvis.
    static let defaultVoiceID = "onwK4e9ZLuTAKqWW03F9"

    var isConfigured: Bool {
        !(KeychainHelper.read(Self.keychainKey) ?? "").isEmpty
    }

    enum VoiceError: LocalizedError {
        case missingKey
        case apiError(Int, String)

        var errorDescription: String? {
            switch self {
            case .missingKey: return "No ElevenLabs API key configured."
            case .apiError(let status, let body): return "ElevenLabs error \(status): \(body)"
            }
        }
    }

    /// Returns MP3 audio for the given text.
    func synthesize(_ text: String) async throws -> Data {
        guard let apiKey = KeychainHelper.read(Self.keychainKey), !apiKey.isEmpty else {
            throw VoiceError.missingKey
        }
        let voiceID = UserDefaults.standard.string(forKey: Self.voiceIDDefaultsKey)
            .flatMap { $0.isEmpty ? nil : $0 } ?? Self.defaultVoiceID

        var request = URLRequest(
            url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voiceID)?output_format=mp3_44100_128")!
        )
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            // Lower stability = more expressive delivery; style adds gravitas;
            // speaker boost sharpens presence on small phone speakers.
            "voice_settings": [
                "stability": 0.4,
                "similarity_boost": 0.8,
                "style": 0.3,
                "use_speaker_boost": true,
            ],
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw VoiceError.apiError(status, String(data: data, encoding: .utf8) ?? "")
        }
        return data
    }
}
