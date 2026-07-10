import Foundation
import UserNotifications

/// Local notifications: voice-created reminders and an optional daily briefing.
final class NotificationManager {

    static let shared = NotificationManager()
    private init() {}

    private let center = UNUserNotificationCenter.current()
    private static let briefingIdentifier = "com.jarvis.daily-briefing"

    @discardableResult
    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    // MARK: - Reminders

    func scheduleReminder(_ text: String, at date: Date) async throws {
        let content = UNMutableNotificationContent()
        content.title = "Jarvis reminder"
        content.body = text
        content.sound = .default

        let fireDate = max(date, Date().addingTimeInterval(5))
        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(identifier: UUID().uuidString,
                                            content: content,
                                            trigger: trigger)
        try await center.add(request)
    }

    // MARK: - Daily briefing

    /// Schedules a repeating daily notification. Tapping it opens the app,
    /// where you can ask Jarvis for your briefing.
    func scheduleDailyBriefing(hour: Int, minute: Int) async throws {
        cancelDailyBriefing()

        let content = UNMutableNotificationContent()
        content.title = "Good morning ☀️"
        content.body = "Tap for your daily briefing from Jarvis."
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)

        let request = UNNotificationRequest(identifier: Self.briefingIdentifier,
                                            content: content,
                                            trigger: trigger)
        try await center.add(request)
    }

    func cancelDailyBriefing() {
        center.removePendingNotificationRequests(withIdentifiers: [Self.briefingIdentifier])
    }
}
