import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var apiKey: String = KeychainHelper.read(ClaudeService.keychainKey) ?? ""
    @AppStorage("briefingEnabled") private var briefingEnabled = false
    @AppStorage("briefingHour") private var briefingHour = 8
    @AppStorage("briefingMinute") private var briefingMinute = 0
    @AppStorage("keyboardShareKey") private var keyboardShareKey = false
    @AppStorage("autoSend") private var autoSend = true
    @AppStorage(JarvisKnowledge.urlsKey) private var knowledgeURLs = ""

    @State private var githubToken: String = KeychainHelper.read(MemoryStore.tokenKeychainKey) ?? ""
    @State private var elevenLabsKey: String = KeychainHelper.read(ElevenLabsService.keychainKey) ?? ""
    @AppStorage(ElevenLabsService.voiceIDDefaultsKey) private var elevenLabsVoiceID = ""

    @State private var gmailClientID: String = GmailService.shared.clientID ?? ""
    @State private var gmailConnected = GmailService.shared.isConnected
    @State private var gmailStatus: String?
    @State private var placeStatus: String?

    private let locationFetcher = LocationFetcher()

    var body: some View {
        NavigationStack {
            Form {
                claudeSection
                interactionSection
                memorySection
                knowledgeSection
                voiceSection
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

    private var interactionSection: some View {
        Section {
            Toggle("Auto-send when you stop talking", isOn: $autoSend)
        } header: {
            Text("Voice interaction")
        } footer: {
            Text("With auto-send on, tap the orb once, speak, and Jarvis replies when you pause — no second tap. The ∞ Hands-free button on the main screen keeps the whole conversation going with no taps at all.")
        }
    }

    private var memorySection: some View {
        Section {
            NavigationLink("View & edit memory") {
                MemoryView()
            }
            SecureField("GitHub token for backup (optional)", text: $githubToken)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.footnote)
            if MemoryStore.shared.isSyncing {
                Label("Backed up to a private GitHub Gist", systemImage: "checkmark.icloud")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }
        } header: {
            Text("Long-term memory")
        } footer: {
            Text("Say \"remember …\" and Jarvis stores it here, keeping it top of mind in every conversation. Memory works on-device out of the box. A GitHub token unlocks two extras: memory backup (survives reinstalls) and dispatching work to your Claude workspace (\"add X to my schedule tracker\"). Create one at github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token, ticking the \"repo\" and \"gist\" scopes, and paste it here.")
        }
    }

    private var knowledgeSection: some View {
        Section {
            TextField("Share links, one per line", text: $knowledgeURLs, axis: .vertical)
                .lineLimit(2...5)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.footnote)
        } header: {
            Text("Jarvis knowledge")
        } footer: {
            Text("Paste links to pages Jarvis should always know — like your schedule tracker artifacts. On claude.ai, open the artifact → Share → copy the link, then paste it here. Jarvis refetches every 30 minutes and uses them when you ask about your schedule, week, or workload.")
        }
    }

    private var voiceSection: some View {
        Section {
            SecureField("ElevenLabs API key (optional)", text: $elevenLabsKey)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Voice ID (blank = Daniel, British)", text: $elevenLabsVoiceID)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.footnote)
        } header: {
            Text("Jarvis voice")
        } footer: {
            Text("For a cinematic Jarvis voice, create a free account at elevenlabs.io and paste an API key — the default voice is Daniel, a deep British voice. Without a key, Jarvis uses the best British voice on your iPhone: download a premium one under Settings → Accessibility → Spoken Content → Voices → English (UK) for a big free upgrade.")
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
        KeychainHelper.save(elevenLabsKey.trimmingCharacters(in: .whitespacesAndNewlines),
                            for: ElevenLabsService.keychainKey)
        KeychainHelper.save(githubToken.trimmingCharacters(in: .whitespacesAndNewlines),
                            for: MemoryStore.tokenKeychainKey)
        Task { await MemoryStore.shared.syncUp() }
        // Opt-in mirror for the keyboard extension (app-group storage).
        AppGroup.defaults.set(keyboardShareKey ? trimmed : nil,
                              forKey: AppGroup.keyboardAPIKeyKey)

        Task { await JarvisKnowledge.refresh() }
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

/// Read and hand-edit everything Jarvis remembers.
struct MemoryView: View {
    @State private var text = MemoryStore.shared.memoryText
    @State private var saved = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if text.isEmpty {
                ContentUnavailableView(
                    "Nothing remembered yet",
                    systemImage: "brain",
                    description: Text("Say \"Jarvis, remember that…\" and it lands here.")
                )
            }
            TextEditor(text: $text)
                .font(.callout.monospaced())
                .padding(8)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            if saved {
                Label("Saved", systemImage: "checkmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }
        }
        .padding()
        .navigationTitle("Jarvis memory")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task {
                        await MemoryStore.shared.replaceMemory(with: text)
                        saved = true
                    }
                }
            }
        }
    }
}

#Preview {
    SettingsView()
}
