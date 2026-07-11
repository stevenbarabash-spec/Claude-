import SwiftUI

/// Everything Jarvis can do, in one self-aware catalog.
/// The same data feeds the prompts, so asking "what can you do?" out loud
/// gets an accurate spoken answer.
enum JarvisCapabilities {

    struct Capability: Identifiable {
        let id = UUID()
        let icon: String
        let title: String
        let examples: [String]
    }

    static let all: [Capability] = [
        .init(icon: "bubble.left.and.bubble.right", title: "Chat with Claude (with memory)",
              examples: ["What's the capital of Mongolia?", "Explain that again more simply"]),
        .init(icon: "newspaper", title: "Live news & web search",
              examples: ["What's happening in the news today?", "What's the weather this weekend?"]),
        .init(icon: "sun.max", title: "Daily briefing",
              examples: ["What's my day look like?", "Give me my briefing"]),
        .init(icon: "envelope", title: "Email drafting & Gmail autopilot",
              examples: ["Email Sarah about moving the meeting", "Check my email"]),
        .init(icon: "message", title: "Text drafting",
              examples: ["Text Mike that I'm running 15 minutes late"]),
        .init(icon: "music.note", title: "Spotify",
              examples: ["Play Daft Punk"]),
        .init(icon: "lightbulb", title: "Smart home (HomeKit)",
              examples: ["Turn off the living room lights", "Movie night"]),
        .init(icon: "bell", title: "Reminders & location reminders",
              examples: ["Remind me to call the dentist at 3", "Remind me to water the plants when I get home"]),
        .init(icon: "heart", title: "Health digest",
              examples: ["How did I sleep this week?"]),
        .init(icon: "camera", title: "Vision (camera button)",
              examples: ["What plant is this?", "Summarize this document"]),
        .init(icon: "brain", title: "Long-term memory",
              examples: ["Remember that my name is Steve", "Remember I built you"]),
        .init(icon: "paperplane", title: "Dispatch work to Claude HQ",
              examples: ["Add the dentist appointment to my schedule tracker", "Kick off Bytox social media posts"]),
        .init(icon: "rectangle.grid.2x2", title: "Life OS dashboard",
              examples: ["I need to call the accountant", "I ate a chicken burrito", "Acme owes me $2,000 due Friday", "What's owed to me?"]),
        .init(icon: "square.and.arrow.down", title: "Share sheet & summaries (tray button)",
              examples: ["Share any article to Jarvis, then tap Summarize"]),
        .init(icon: "waveform", title: "Hands-free conversation",
              examples: ["Switch to Auto at the bottom and just talk"]),
    ]

    /// Compact summary injected into prompts so Jarvis knows itself.
    static var promptSummary: String {
        let lines = all.map { "• \($0.title) — e.g. \"\($0.examples.first ?? "")\"" }
        return """

        --- Your capabilities (answer "what can you do" from this; suggest relevant ones in passing) ---
        \(lines.joined(separator: "\n"))
        If the user asks for something NOT covered here, tell them it's been added to the feature wishlist.
        """
    }
}

/// The in-app catalog + the feature wishlist.
struct CapabilitiesView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var wishlist: [String] = Wishlist.items

    var body: some View {
        NavigationStack {
            List {
                Section("What Jarvis can do") {
                    ForEach(JarvisCapabilities.all) { capability in
                        VStack(alignment: .leading, spacing: 4) {
                            Label(capability.title, systemImage: capability.icon)
                                .font(.subheadline.weight(.semibold))
                            ForEach(capability.examples, id: \.self) { example in
                                Text("“\(example)”")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }

                Section {
                    if wishlist.isEmpty {
                        Text("Empty — ask Jarvis for something it can't do yet, and it lands here.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(wishlist, id: \.self) { item in
                            Text(item).font(.footnote)
                        }
                        .onDelete { offsets in
                            Wishlist.remove(at: offsets)
                            wishlist = Wishlist.items
                        }
                    }
                } header: {
                    Text("Feature wishlist")
                } footer: {
                    Text("Synced to your repo (.jarvis/feature-wishlist.md) when a GitHub token is set — review it with Claude Code in your weekly build session.")
                }
            }
            .navigationTitle("Jarvis abilities")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// Local wishlist store (mirrored to the repo when possible).
enum Wishlist {
    private static let key = "featureWishlist"

    static var items: [String] {
        UserDefaults.standard.stringArray(forKey: key) ?? []
    }

    static func add(_ feature: String) {
        var list = items
        let stamp = Date().formatted(date: .abbreviated, time: .omitted)
        list.append("\(feature) (\(stamp))")
        UserDefaults.standard.set(list, forKey: key)
    }

    static func remove(at offsets: IndexSet) {
        var list = items
        for index in offsets.sorted(by: >) where list.indices.contains(index) {
            list.remove(at: index)
        }
        UserDefaults.standard.set(list, forKey: key)
    }
}
