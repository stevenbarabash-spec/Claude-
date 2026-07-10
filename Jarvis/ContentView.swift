import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var viewModel: JarvisViewModel
    @State private var showSettings = false
    @State private var showVision = false
    @State private var showShared = false
    @State private var showAbilities = false
    @State private var booted = false

    var body: some View {
        NavigationStack {
            ZStack {
                background

                VStack(spacing: 18) {
                    Spacer(minLength: 12)

                    JarvisOrb(state: viewModel.state, audioLevel: viewModel.audioLevel)
                        .frame(width: 270, height: 270)
                        .scaleEffect(booted ? 1 : 0.4)
                        .opacity(booted ? 1 : 0)
                        .contentShape(Circle())
                        .onTapGesture { viewModel.toggleListening() }
                        .accessibilityLabel(viewModel.isListening ? "Stop listening" : "Start listening")
                        .accessibilityAddTraits(.isButton)

                    Text(statusText)
                        .font(.footnote.weight(.semibold))
                        .tracking(3)
                        .textCase(.uppercase)
                        .foregroundStyle(.cyan.opacity(0.85))
                        .animation(.easeInOut(duration: 0.25), value: viewModel.state)

                    Spacer(minLength: 8)

                    conversationPanel

                    modeSwitcher
                        .padding(.top, 6)
                }
                .padding()
            }
            .navigationTitle("JARVIS")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .toolbarBackground(.hidden, for: .navigationBar)
            .onAppear {
                guard !booted else { return }
                FX.shared.boot()
                withAnimation(.spring(duration: 0.9, bounce: 0.35)) {
                    booted = true
                }
                // Let the boot chime land, then speak.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                    viewModel.greet()
                }
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showVision) {
            VisionView()
        }
        .sheet(isPresented: $showShared) {
            SharedItemsView()
        }
        .sheet(isPresented: $showAbilities) {
            CapabilitiesView()
        }
        .sheet(isPresented: $viewModel.showInbox) {
            InboxView()
                .environmentObject(viewModel)
        }
        .sheet(item: $viewModel.emailDraft) { draft in
            if EmailComposer.canSendMail {
                EmailComposer(draft: draft)
                    .ignoresSafeArea()
            } else {
                mailFallback(draft)
            }
        }
        .sheet(item: $viewModel.messageDraft) { draft in
            if MessageComposer.canSendText {
                MessageComposer(draft: draft)
                    .ignoresSafeArea()
            } else {
                Text("This device can't send messages.")
                    .padding()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .jarvisAsk)) { note in
            guard let question = note.object as? String else { return }
            Task { await viewModel.handle(transcript: question) }
        }
    }

    // MARK: - Pieces

    private var background: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.01, green: 0.02, blue: 0.06),
                                    Color(red: 0.02, green: 0.05, blue: 0.12),
                                    .black],
                           startPoint: .top, endPoint: .bottom)
            MatrixRainView(intensity: 0.38)
            // Faint ambient halo behind the orb.
            RadialGradient(colors: [.cyan.opacity(0.08), .clear],
                           center: UnitPoint(x: 0.5, y: 0.38),
                           startRadius: 40, endRadius: 320)
        }
        .ignoresSafeArea()
    }

    private var statusText: String {
        switch viewModel.state {
        case .idle: return viewModel.conversationMode ? "Waiting" : "Tap to speak"
        case .listening: return "Listening — just talk"
        case .thinking: return "Processing"
        case .speaking: return "Speaking"
        }
    }

    private var conversationPanel: some View {
        VStack(spacing: 10) {
            if !viewModel.transcript.isEmpty {
                bubble(text: viewModel.transcript, label: "YOU", tint: .blue)
            }
            if !viewModel.response.isEmpty {
                bubble(text: viewModel.response, label: "JARVIS", tint: .cyan)
            }
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red.opacity(0.9))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
        }
        .frame(maxHeight: 240, alignment: .bottom)
    }

    private func bubble(text: String, label: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.bold))
                .tracking(2)
                .foregroundStyle(tint.opacity(0.9))
            Text(text)
                .font(.callout)
                .foregroundStyle(.white.opacity(0.92))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .strokeBorder(tint.opacity(0.25), lineWidth: 1)
        )
    }

    /// Bottom mode picker: classic tap-to-speak, or Auto (hands-free loop).
    private var modeSwitcher: some View {
        HStack(spacing: 4) {
            modeButton("Tap to speak", icon: "hand.tap", active: !viewModel.conversationMode) {
                if viewModel.conversationMode { viewModel.toggleConversationMode() }
            }
            modeButton("Auto", icon: "infinity", active: viewModel.conversationMode) {
                if !viewModel.conversationMode { viewModel.toggleConversationMode() }
            }
        }
        .padding(4)
        .background(Capsule().fill(.white.opacity(0.05)))
        .overlay(Capsule().strokeBorder(.white.opacity(0.15), lineWidth: 1))
    }

    private func modeButton(_ title: String, icon: String, active: Bool,
                            action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Capsule().fill(active ? Color.cyan.opacity(0.22) : .clear))
                .foregroundStyle(active ? .cyan : .white.opacity(0.6))
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarLeading) {
            Button { showVision = true } label: {
                Image(systemName: "camera")
            }
            Button { showShared = true } label: {
                Image(systemName: "tray.and.arrow.down")
            }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { showAbilities = true } label: {
                Image(systemName: "sparkles")
            }
            Button {
                Task { await viewModel.handle(transcript: "check my email") }
            } label: {
                Image(systemName: "envelope")
            }
            Button { showSettings = true } label: {
                Image(systemName: "gearshape")
            }
        }
    }

    private func mailFallback(_ draft: EmailDraft) -> some View {
        VStack(spacing: 16) {
            Text("Apple Mail isn't set up on this device.")
                .font(.headline)
            Button("Open in default mail app") {
                MailtoFallback.open(draft)
                viewModel.emailDraft = nil
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

#Preview {
    ContentView()
        .environmentObject(JarvisViewModel())
}
