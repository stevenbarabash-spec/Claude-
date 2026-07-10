import WidgetKit
import SwiftUI

/// Home/lock-screen widget showing your next events (cached by the main app)
/// with a tap-through that asks Jarvis for the full briefing.
struct AgendaEntry: TimelineEntry {
    let date: Date
    let events: [(title: String, start: Date)]
}

struct AgendaProvider: TimelineProvider {

    func placeholder(in context: Context) -> AgendaEntry {
        AgendaEntry(date: Date(), events: [("Team standup", Date().addingTimeInterval(3600))])
    }

    func getSnapshot(in context: Context, completion: @escaping (AgendaEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AgendaEntry>) -> Void) {
        let entry = loadEntry()
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func loadEntry() -> AgendaEntry {
        let raw = AppGroup.defaults.array(forKey: AppGroup.widgetEventsKey) as? [[String: String]] ?? []
        let iso = ISO8601DateFormatter()
        let events: [(title: String, start: Date)] = raw.compactMap { dict in
            guard let title = dict["title"],
                  let startISO = dict["startISO"],
                  let start = iso.date(from: startISO)
            else { return nil }
            return (title, start)
        }.filter { $0.1 > Date() }
        return AgendaEntry(date: Date(), events: events)
    }
}

struct JarvisWidgetView: View {
    var entry: AgendaEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "waveform.circle.fill")
                Text("Jarvis")
                    .font(.caption.weight(.bold))
            }
            .foregroundStyle(.purple)

            if entry.events.isEmpty {
                Text("Nothing coming up.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(entry.events.prefix(family == .systemSmall ? 2 : 3).enumerated()),
                        id: \.offset) { _, event in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(event.start, format: .dateTime.hour().minute())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(event.title)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { Color.clear }
        .widgetURL(URL(string: "jarvis://ask?q=Give%20me%20my%20briefing"))
    }
}

@main
struct JarvisWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "JarvisAgenda", provider: AgendaProvider()) { entry in
            JarvisWidgetView(entry: entry)
        }
        .configurationDisplayName("Jarvis Agenda")
        .description("Your next events — tap for a spoken briefing.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
