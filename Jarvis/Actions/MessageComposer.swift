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
        // Only pre-fill recipients that look like phone numbers; spoken names
        // are typed into the To field by the user with Contacts autocomplete.
        let digits = draft.recipient.filter { $0.isNumber || $0 == "+" }
        if digits.count >= 7 {
            controller.recipients = [digits]
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
