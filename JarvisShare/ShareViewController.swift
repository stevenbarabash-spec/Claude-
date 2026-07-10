import UIKit
import Social
import UniformTypeIdentifiers

/// Share-sheet extension: send text, links, or selections from any app to
/// Jarvis. Items land in the "Shared with Jarvis" tray in the main app, where
/// Claude can summarize them or pull out action items.
final class ShareViewController: SLComposeServiceViewController {

    override func isContentValid() -> Bool { true }

    override func didSelectPost() {
        let group = DispatchGroup()
        var collected: [String] = []
        if let note = contentText, !note.isEmpty {
            collected.append(note)
        }

        let attachments = (extensionContext?.inputItems.first as? NSExtensionItem)?.attachments ?? []
        for provider in attachments {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier) { item, _ in
                    if let url = item as? URL { collected.append(url.absoluteString) }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                    if let text = item as? String { collected.append(text) }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            if !collected.isEmpty {
                let iso = ISO8601DateFormatter().string(from: Date())
                var items = AppGroup.defaults.array(forKey: AppGroup.sharedItemsKey) as? [[String: String]] ?? []
                items.append(["text": collected.joined(separator: "\n"), "date": iso])
                // Keep the tray from growing without bound.
                if items.count > 50 { items.removeFirst(items.count - 50) }
                AppGroup.defaults.set(items, forKey: AppGroup.sharedItemsKey)
            }
            self?.extensionContext?.completeRequest(returningItems: [])
        }
    }

    override func configurationItems() -> [Any]! { [] }
}
