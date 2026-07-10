import SwiftUI
import MessageUI

/// Presents the system mail sheet pre-filled with Jarvis's draft.
/// iOS requires the user to tap Send — apps cannot send mail silently.
struct EmailComposer: UIViewControllerRepresentable {

    let draft: EmailDraft
    @Environment(\.dismiss) private var dismiss

    static var canSendMail: Bool { MFMailComposeViewController.canSendMail() }

    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let controller = MFMailComposeViewController()
        controller.mailComposeDelegate = context.coordinator
        // Recipient may be a spoken name ("Sarah") rather than an address —
        // leave it in the To field so autocomplete against Contacts kicks in.
        if draft.recipient.contains("@") {
            controller.setToRecipients([draft.recipient])
        }
        controller.setSubject(draft.subject)
        controller.setMessageBody(draft.body, isHTML: false)
        return controller
    }

    func updateUIViewController(_ uiViewController: MFMailComposeViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(dismiss: dismiss) }

    final class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let dismiss: DismissAction
        init(dismiss: DismissAction) { self.dismiss = dismiss }

        func mailComposeController(_ controller: MFMailComposeViewController,
                                   didFinishWith result: MFMailComposeResult,
                                   error: Error?) {
            dismiss()
        }
    }
}

/// Fallback for devices without Apple Mail configured (e.g. Gmail-only users):
/// opens the default mail app via a mailto: URL.
enum MailtoFallback {
    static func open(_ draft: EmailDraft) {
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = draft.recipient.contains("@") ? draft.recipient : ""
        components.queryItems = [
            URLQueryItem(name: "subject", value: draft.subject),
            URLQueryItem(name: "body", value: draft.body),
        ]
        if let url = components.url {
            UIApplication.shared.open(url)
        }
    }
}
