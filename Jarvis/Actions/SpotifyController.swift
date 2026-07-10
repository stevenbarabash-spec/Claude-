import Foundation
import UIKit

/// Opens Spotify via deep link. If the Spotify app isn't installed the search
/// falls back to the web player.
///
/// This "open into search results" approach needs no Spotify developer account.
/// For true in-app playback control (play/pause/skip a specific track), add the
/// Spotify iOS SDK and swap this out — the call site in JarvisViewModel stays
/// the same.
enum SpotifyController {

    static func play(query: String) {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query

        if let appURL = URL(string: "spotify:search:\(encoded)"),
           UIApplication.shared.canOpenURL(appURL) {
            UIApplication.shared.open(appURL)
        } else if let webURL = URL(string: "https://open.spotify.com/search/\(encoded)") {
            UIApplication.shared.open(webURL)
        }
    }
}
