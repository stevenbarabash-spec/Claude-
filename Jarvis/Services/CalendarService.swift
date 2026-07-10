import Foundation
import EventKit
import WidgetKit

/// Read-only calendar access for briefings and the lock-screen widget.
final class CalendarService {

    static let shared = CalendarService()
    private let store = EKEventStore()

    func requestAccess() async -> Bool {
        (try? await store.requestFullAccessToEvents()) ?? false
    }

    func events(forDaysAhead days: Int = 1) -> [EKEvent] {
        let start = Calendar.current.startOfDay(for: Date())
        guard let end = Calendar.current.date(byAdding: .day, value: days, to: start) else { return [] }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        return store.events(matching: predicate).sorted { $0.startDate < $1.startDate }
    }

    /// A plain-text agenda Claude can turn into a spoken briefing.
    func agendaText() -> String {
        let events = events(forDaysAhead: 2)
        guard !events.isEmpty else { return "No calendar events in the next two days." }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE h:mm a"
        return events.map { event in
            let time = event.isAllDay ? "All day" : formatter.string(from: event.startDate)
            let location = (event.location?.isEmpty == false) ? " @ \(event.location!)" : ""
            return "- \(time): \(event.title ?? "Untitled")\(location)"
        }.joined(separator: "\n")
    }

    /// Caches upcoming events where the widget can read them, then refreshes it.
    func refreshWidgetCache() {
        let upcoming = events(forDaysAhead: 2)
            .filter { $0.endDate > Date() }
            .prefix(4)
        let iso = ISO8601DateFormatter()
        let payload: [[String: String]] = upcoming.map {
            ["title": $0.title ?? "Untitled", "startISO": iso.string(from: $0.startDate)]
        }
        AppGroup.defaults.set(payload, forKey: AppGroup.widgetEventsKey)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
