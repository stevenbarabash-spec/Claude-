import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var apiKey: String = KeychainHelper.read(ClaudeService.keychainKey) ?? ""
    @AppStorage("briefingEnabled") private var briefingEnabled = false
    @AppStorage("briefingHour") private var briefingHour = 8
    @AppStorage("briefingMinute") private var briefingMinute = 0
    @AppStorage("musicProvider") private var musicProvider = "spotify"
    @AppStorage("keyboardShareKey") private var keyboardShareKey = false

    @State private var gmailClientID: String = GmailService.shared.clientID ?? ""
    @State private var gmailConnected = GmailService.shared.isConnected
    @State private var gmailStatus: String?
    @State private var placeStatus: String?

    private let locationFetcher = LocationFetcher()

    var body: some View {
        NavigationStack {
            Form {
                claudeSection
                musicSection
                gmailSection
                placesSection
                briefingSection
                keyboardSection
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

    // MARK: - Sections

    private var claudeSection: some View {
        Section {
            SecureField("sk-ant-…", text: $apiKey)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        } header: {
            Text("Claude API key")
        } footer: {
            Text("Stored in the iOS Keychain, only on this device. Get a key at console.anthropic.com.")
        }
    }

    private var musicSection: some View {
        Section {
            Picker("Provider", selection: $musicProvider) {
                Text("Spotify").tag("spotify")
                Text("Apple Music").tag("apple")
            }
        } header: {
            Text("Music")
        } footer: {
            Text("Spotify opens into search results. Apple Music plays songs natively inside Jarvis, but needs MusicKit enabled for your App ID (paid developer account).")
        }
    }

    private var gmailSection: some View {
        Section {
            TextField("OAuth client ID (…apps.googleusercontent.com)", text: $gmailClientID)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.footnote)
            if gmailConnected {
                Label("Connected", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Button("Disconnect", role: .destructive) {
                    GmailService.shared.disconnect()
                    gmailConnected = false
                }
            } else {
                Button("Connect Gmail") { connectGmail() }
                    .disabled(gmailClientID.isEmpty)
            }
            if let gmailStatus {
                Text(gmailStatus).font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text("Gmail autopilot")
        } footer: {
            Text("Lets Jarvis read, triage, and actually send email. Create a free iOS OAuth client at console.cloud.google.com (enable the Gmail API), paste the client ID here, then Connect — see README for the 5-minute walkthrough.")
        }
    }

    private var placesSection: some View {
        Section {
            Button("Save current location as Home") { savePlace("home") }
            Button("Save current location as Work") { savePlace("work") }
            if !PlacesStore.all().isEmpty {
                Text("Saved: \(PlacesStore.all().map(\.name).joined(separator: ", "))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let placeStatus {
                Text(placeStatus).font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text("Places")
        } footer: {
            Text("Enables location reminders like \"remind me to water the plants when I get home.\"")
        }
    }

    private var briefingSection: some View {
        Section {
            Toggle("Daily briefing notification", isOn: $briefingEnabled)
            if briefingEnabled {
                DatePicker("Time", selection: briefingTime, displayedComponents: .hourAndMinute)
            }
        } footer: {
            Text("A daily notification that opens Jarvis for your calendar-aware briefing.")
        }
    }

    private var keyboardSection: some View {
        Section {
            Toggle("Share API key with Jarvis Keyboard", isOn: $keyboardShareKey)
        } header: {
            Text("Jarvis Keyboard")
        } footer: {
            Text("The keyboard extension drafts replies inside any app (enable it in Settings → General → Keyboard → Keyboards, and allow Full Access). It needs the API key mirrored to shared app-group storage, which is slightly less protected than the Keychain — leave this off if you don't use the keyboard.")
        }
    }

    // MARK: - Actions

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

    private func connectGmail() {
        GmailService.shared.setClientID(gmailClientID)
        gmailStatus = "Opening Google sign-in…"
        Task {
            do {
                try await GmailService.shared.connect()
                gmailConnected = true
                gmailStatus = nil
            } catch {
                gmailStatus = error.localizedDescription
            }
        }
    }

    private func savePlace(_ name: String) {
        placeStatus = "Getting location…"
        Task {
            do {
                let coordinate = try await locationFetcher.currentLocation()
                PlacesStore.save(name: name, coordinate: coordinate)
                placeStatus = "Saved \(name)."
            } catch {
                placeStatus = error.localizedDescription
            }
        }
    }

    private func save() {
        let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        KeychainHelper.save(trimmed, for: ClaudeService.keychainKey)
        // Opt-in mirror for the keyboard extension (app-group storage).
        AppGroup.defaults.set(keyboardShareKey ? trimmed : nil,
                              forKey: AppGroup.keyboardAPIKeyKey)

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
