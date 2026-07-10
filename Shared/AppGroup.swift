import Foundation

/// Shared storage between the main app and its extensions (widget, share
/// sheet, keyboard). The app group ID must match project.yml and your
/// bundle-ID prefix.
enum AppGroup {
    static let id = "group.com.yourname.jarvis"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: id) ?? .standard
    }

    // Keys
    static let widgetEventsKey = "widget.events"        // [[String: String]] title/startISO
    static let sharedItemsKey = "shared.items"          // [[String: String]] text/date
    static let keyboardAPIKeyKey = "keyboard.apiKey"    // opt-in mirror of the Claude key
}
