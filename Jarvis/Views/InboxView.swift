import SwiftUI

/// Triaged Gmail inbox: category, one-line summary, and a ready-to-send reply
/// for anything that needs one. Sending goes through the Gmail API directly.
struct InboxView: View {
    @EnvironmentObject private var viewModel: JarvisViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var replying: TriagedEmail?

    var body: some View {
        NavigationStack {
            List(viewModel.inbox) { item in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(categoryEmoji(item.category))
                        Text(item.message.from)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                    }
                    Text(item.message.subject)
                        .font(.subheadline)
                        .lineLimit(1)
                    Text(item.summary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if item.needsReply, item.suggestedReply != nil {
                        Button("Review Jarvis's reply") {
                            replying = item
                        }
                        .font(.footnote.weight(.semibold))
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.vertical, 4)
            }
            .navigationTitle("Inbox triage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .sheet(item: $replying) { item in
            GmailReplySheet(item: item)
        }
    }

    private func categoryEmoji(_ category: String) -> String {
        switch category {
        case "urgent": return "🔴"
        case "personal": return "💬"
        case "work": return "💼"
        case "newsletter": return "📰"
        case "spam": return "🗑️"
        default: return "✉️"
        }
    }
}

/// Editable reply that sends through the Gmail API — this one actually sends
/// with a single tap, because Gmail (unlike iMessage) allows it.
struct GmailReplySheet: View {
    let item: TriagedEmail
    @Environment(\.dismiss) private var dismiss
    @State private var body_: String
    @State private var sending = false
    @State private var error: String?

    init(item: TriagedEmail) {
        self.item = item
        _body_ = State(initialValue: item.suggestedReply ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Re: \(item.message.subject)")
                    .font(.headline)
                Text("To: \(item.message.from)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextEditor(text: $body_)
                    .frame(minHeight: 200)
                    .padding(8)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("Reply")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Sending…" : "Send") { send() }
                        .disabled(sending || body_.isEmpty)
                }
            }
        }
    }

    private func send() {
        sending = true
        error = nil
        Task {
            do {
                try await GmailService.shared.send(
                    to: item.message.from,
                    subject: "Re: \(item.message.subject)",
                    body: body_,
                    replyingTo: item.message
                )
                try? await GmailService.shared.markRead(item.message)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            sending = false
        }
    }
}
