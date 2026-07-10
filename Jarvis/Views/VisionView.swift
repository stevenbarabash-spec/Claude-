import SwiftUI
import UIKit

/// Point the camera at anything and ask Jarvis about it — menus, plants,
/// documents, error messages on other screens.
struct VisionView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var image: UIImage?
    @State private var showCamera = true
    @State private var question = ""
    @State private var answer = ""
    @State private var asking = false
    @State private var error: String?

    private let claude = ClaudeService()
    private let synthesizer = SpeechSynthesizer()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 320)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                        Button("Retake") { showCamera = true }
                            .buttonStyle(.bordered)

                        TextField("What do you want to know about this?", text: $question, axis: .vertical)
                            .textFieldStyle(.roundedBorder)

                        Button(asking ? "Thinking…" : "Ask Jarvis") { ask() }
                            .buttonStyle(.borderedProminent)
                            .disabled(asking)

                        if !answer.isEmpty {
                            Text(answer)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(.purple.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
                        }
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }
                    } else {
                        ContentUnavailableView("No photo yet",
                                               systemImage: "camera",
                                               description: Text("Take a photo and ask Jarvis about it."))
                        Button("Open camera") { showCamera = true }
                            .buttonStyle(.borderedProminent)
                    }
                }
                .padding()
            }
            .navigationTitle("Jarvis Vision")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker(image: $image)
                .ignoresSafeArea()
        }
    }

    private func ask() {
        guard let jpeg = image?.jpegData(compressionQuality: 0.6) else { return }
        asking = true
        error = nil
        answer = ""
        let prompt = question.isEmpty ? "Describe what's in this photo and anything notable about it." : question
        Task {
            do {
                let result = try await claude.complete(
                    system: "You are Jarvis, answering questions about a photo the user just took. Be concise and spoken-style.",
                    user: prompt,
                    imageJPEG: jpeg
                )
                answer = result
                synthesizer.speak(result)
            } catch {
                self.error = error.localizedDescription
            }
            asking = false
        }
    }
}

/// Camera capture (falls back to photo library in the simulator).
struct CameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = info[.originalImage] as? UIImage
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
