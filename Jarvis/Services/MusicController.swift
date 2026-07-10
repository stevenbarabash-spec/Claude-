import Foundation
import MusicKit

/// Native Apple Music playback via MusicKit — real in-app control (play a
/// specific song, no app switching), unlike the Spotify deep link.
///
/// Requires the MusicKit app service to be enabled for your App ID in the
/// Apple Developer portal (paid developer account). If you're on a free
/// account, keep the music provider set to Spotify in Settings.
enum MusicController {

    enum MusicError: LocalizedError {
        case notAuthorized
        case noResults(String)

        var errorDescription: String? {
            switch self {
            case .notAuthorized:
                return "Apple Music access wasn't authorized."
            case .noResults(let query):
                return "Couldn't find \"\(query)\" on Apple Music."
            }
        }
    }

    /// Searches the Apple Music catalog and starts playing the best match.
    static func play(query: String) async throws -> String {
        let status = await MusicAuthorization.request()
        guard status == .authorized else { throw MusicError.notAuthorized }

        var request = MusicCatalogSearchRequest(term: query, types: [Song.self])
        request.limit = 1
        let response = try await request.response()
        guard let song = response.songs.first else { throw MusicError.noResults(query) }

        let player = ApplicationMusicPlayer.shared
        player.queue = ApplicationMusicPlayer.Queue(for: [song])
        try await player.play()
        return "Now playing \(song.title) by \(song.artistName)."
    }

    static func pause() {
        ApplicationMusicPlayer.shared.pause()
    }

    static func skip() async throws {
        try await ApplicationMusicPlayer.shared.skipToNextEntry()
    }
}
