import SwiftUI

@main
struct JarvisApp: App {
    @StateObject private var viewModel = JarvisViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
                .task {
                    await NotificationManager.shared.requestAuthorization()
                    await MemoryStore.shared.syncDown()
                    await JarvisKnowledge.refreshIfStale()
                    // Keep the lock-screen widget's agenda fresh on every launch.
                    if await CalendarService.shared.requestAccess() {
                        CalendarService.shared.refreshWidgetCache()
                    }
                }
                .onOpenURL { url in
                    // jarvis://ask?q=... — used by the Siri App Intent to hand off a question.
                    guard url.scheme == "jarvis",
                          let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                          let query = components.queryItems?.first(where: { $0.name == "q" })?.value,
                          !query.isEmpty
                    else { return }
                    viewModel.submit(query)
                }
        }
    }
}
