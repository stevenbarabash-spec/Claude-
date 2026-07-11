import SwiftUI
import MessageUI

/// Presents the system iMessage/SMS sheet pre-filled with Jarvis's draft.
/// iOS requires the user to tap Send — apps cannot read or send texts silently.
struct MessageComposer: UIViewControllerRepresentable {

    let draft: MessageDraft
    @Environment(\.dismiss) private var dismiss

    static var canSendText: Bool { MFMessageComposeViewController.canSendText() }

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.messageComposeDelegate = context.coordinator
        // Recipients arrive pre-resolved to numbers where Contacts matched;
        // anything unresolved is passed through for the To field to match.
        controller.recipients = draft.recipients.map { recipient in
            let digits = recipient.filter { $0.isNumber || $0 == "+" }
            return digits.count >= 7 ? digits : recipient
        }
        controller.body = draft.body
        return controller
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(dismiss: dismiss) }

    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let dismiss: DismissAction
        init(dismiss: DismissAction) { self.dismiss = dismiss }

        func messageComposeViewController(_ controller: MFMessageComposeViewController,
                                          didFinishWith result: MessageComposeResult) {
            dismiss()
        }
    }
}
