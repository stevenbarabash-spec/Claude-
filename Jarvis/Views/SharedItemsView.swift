import SwiftUI

/// Content shared into Jarvis from other apps via the share sheet
/// (articles, emails, screenshots-as-text). Summarize or act on each item.
struct SharedItemsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var items: [SharedItem] = []
    @State private var summaries: [String: String] = [:]
    @State private var busyID: String?

    private let claude = ClaudeService()
    private let synthesizer = SpeechSynthesizer()

    struct SharedItem: Identifiable {
        let id: String
        let text: String
        let date: String
    }

    var body: some View {
        NavigationStack {
            Group {
                if items.isEmpty {
                    ContentUnavailableView(
                        "Nothing shared yet",
                        systemImage: "square.and.arrow.down",
                        description: Text("Use the share sheet in any app and pick Jarvis to send text or links here.")
                    )
                } else {
                    List {
                        ForEach(items) { item in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(item.text)
                                    .font(.subheadline)
                                    .lineLimit(4)
                                if let summary = summaries[item.id] {
                                    Text(summary)
                                        .font(.footnote)
                                        .padding(8)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(.purple.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                                } else {
                                    Button(busyID == item.id ? "Summarizing…" : "Summarize") {
                                        summarize(item)
                                    }
                                    .font(.footnote.weight(.semibold))
                                    .buttonStyle(.bordered)
                                    .disabled(busyID != nil)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Shared with Jarvis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        let raw = AppGroup.defaults.array(forKey: AppGroup.sharedItemsKey) as? [[String: String]] ?? []
        items = raw.enumerated().map { index, dict in
            SharedItem(id: "\(index)-\(dict["date"] ?? "")",
                       text: dict["text"] ?? "",
                       date: dict["date"] ?? "")
        }.reversed()
    }

    private func delete(at offsets: IndexSet) {
        var raw = AppGroup.defaults.array(forKey: AppGroup.sharedItemsKey) as? [[String: String]] ?? []
        // Items are displayed newest-first; map back to storage order.
        let storageIndices = offsets.map { raw.count - 1 - $0 }.sorted(by: >)
        for index in storageIndices where raw.indices.contains(index) {
            raw.remove(at: index)
        }
        AppGroup.defaults.set(raw, forKey: AppGroup.sharedItemsKey)
        load()
    }

    private func summarize(_ item: SharedItem) {
        busyID = item.id
        Task {
            defer { busyID = nil }
            do {
                let summary = try await claude.complete(
                    system: "Summarize the shared content in 2-3 spoken-style sentences. If it contains action items, list them.",
                    user: item.text
                )
                summaries[item.id] = summary
                synthesizer.speak(summary)
            } catch {
                summaries[item.id] = "Couldn't summarize: \(error.localizedDescription)"
            }
        }
    }
}
