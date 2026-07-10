import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var apiKey: String = KeychainHelper.read(ClaudeService.keychainKey) ?? ""
    @AppStorage("briefingEnabled") private var briefingEnabled = false
    @AppStorage("briefingHour") private var briefingHour = 8
    @AppStorage("briefingMinute") private var briefingMinute = 0

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("sk-ant-…", text: $apiKey)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Claude API key")
                } footer: {
                    Text("Stored in the iOS Keychain, only on this device. Get a key at console.anthropic.com. Without a key, Jarvis can still play music and set reminders, but can't answer questions or draft emails and texts.")
                }

                Section {
                    Toggle("Daily briefing notification", isOn: $briefingEnabled)
                    if briefingEnabled {
                        DatePicker("Time", selection: briefingTime, displayedComponents: .hourAndMinute)
                    }
                } footer: {
                    Text("A daily notification that opens Jarvis so you can ask for your briefing.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        save()
                        dismiss()
                    }
                }
            }
        }
    }

    private var briefingTime: Binding<Date> {
        Binding {
            Calendar.current.date(
                from: DateComponents(hour: briefingHour, minute: briefingMinute)) ?? Date()
        } set: { date in
            let components = Calendar.current.dateComponents([.hour, .minute], from: date)
            briefingHour = components.hour ?? 8
            briefingMinute = components.minute ?? 0
        }
    }

    private func save() {
        KeychainHelper.save(apiKey.trimmingCharacters(in: .whitespacesAndNewlines),
                            for: ClaudeService.keychainKey)
        Task {
            if briefingEnabled {
                try? await NotificationManager.shared.scheduleDailyBriefing(
                    hour: briefingHour, minute: briefingMinute)
            } else {
                NotificationManager.shared.cancelDailyBriefing()
            }
        }
    }
}

#Preview {
    SettingsView()
}
