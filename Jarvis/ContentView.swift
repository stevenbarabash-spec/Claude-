import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var viewModel: JarvisViewModel
    @State private var showSettings = false
    @State private var showVision = false
    @State private var showShared = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                statusHeader

                if !viewModel.transcript.isEmpty {
                    bubble(text: viewModel.transcript, label: "You", tint: .blue)
                }

                if !viewModel.response.isEmpty {
                    bubble(text: viewModel.response, label: "Jarvis", tint: .purple)
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                micButton

                Text(viewModel.isListening ? "Listening… tap to finish" : "Tap and speak")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 8)
            }
            .padding()
            .navigationTitle("Jarvis")
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button {
                        showVision = true
                    } label: {
                        Image(systemName: "camera")
                    }
                    Button {
                        showShared = true
                    } label: {
                        Image(systemName: "tray.and.arrow.down")
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        Task { await viewModel.handle(transcript: "check my email") }
                    } label: {
                        Image(systemName: "envelope")
                    }
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showVision) {
            VisionView()
        }
        .sheet(isPresented: $showShared) {
            SharedItemsView()
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

    private var statusHeader: some View {
        VStack(spacing: 8) {
            Image(systemName: "waveform.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.purple.gradient)
                .symbolEffect(.pulse, isActive: viewModel.state == .thinking)
            Text(statusText)
                .font(.headline)
                .foregroundStyle(.secondary)
        }
    }

    private var statusText: String {
        switch viewModel.state {
        case .idle: return "At your service."
        case .listening: return "Listening…"
        case .thinking: return "Thinking…"
        case .speaking: return "Speaking"
        }
    }

    private var micButton: some View {
        Button {
            viewModel.toggleListening()
        } label: {
            ZStack {
                Circle()
                    .fill(viewModel.isListening ? Color.red.gradient : Color.purple.gradient)
                    .frame(width: 88, height: 88)
                    .shadow(radius: 8)
                Image(systemName: viewModel.isListening ? "stop.fill" : "mic.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(.white)
            }
        }
        .disabled(viewModel.state == .thinking)
        .accessibilityLabel(viewModel.isListening ? "Stop listening" : "Start listening")
    }

    private func bubble(text: String, label: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(tint)
            Text(text)
                .font(.body)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
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
