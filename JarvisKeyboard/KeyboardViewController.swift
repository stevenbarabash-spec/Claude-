import UIKit

/// The Jarvis Keyboard — the legal workaround for "reply to texts anywhere."
///
/// Works inside iMessage, WhatsApp, Slack, anything with a text field:
/// 1. Copy the message you want to answer (long-press → Copy).
/// 2. Switch to the Jarvis keyboard and tap "✨ Draft replies".
/// 3. Claude reads the clipboard and offers three replies — tap one to insert.
///
/// Requires: Settings → General → Keyboard → Keyboards → Add Jarvis, then
/// enable **Allow Full Access** (needed for clipboard + network), and turn on
/// "Share API key with Jarvis Keyboard" in the app's settings.
final class KeyboardViewController: UIInputViewController {

    private let stack = UIStackView()
    private let statusLabel = UILabel()
    private var suggestionButtons: [UIButton] = []

    override func viewDidLoad() {
        super.viewDidLoad()

        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -8),
        ])

        let topRow = UIStackView()
        topRow.axis = .horizontal
        topRow.spacing = 8

        let nextKeyboard = makeButton(title: "🌐", background: .systemGray5)
        nextKeyboard.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        nextKeyboard.widthAnchor.constraint(equalToConstant: 44).isActive = true

        let draft = makeButton(title: "✨ Draft replies from copied text", background: .systemPurple)
        draft.setTitleColor(.white, for: .normal)
        draft.addTarget(self, action: #selector(draftTapped), for: .touchUpInside)

        topRow.addArrangedSubview(nextKeyboard)
        topRow.addArrangedSubview(draft)
        stack.addArrangedSubview(topRow)

        statusLabel.font = .preferredFont(forTextStyle: .footnote)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 2
        statusLabel.text = "Copy a message, then tap ✨"
        stack.addArrangedSubview(statusLabel)

        for _ in 0..<3 {
            let button = makeButton(title: "", background: .systemGray6)
            button.titleLabel?.numberOfLines = 2
            button.contentHorizontalAlignment = .leading
            button.isHidden = true
            button.addTarget(self, action: #selector(suggestionTapped(_:)), for: .touchUpInside)
            suggestionButtons.append(button)
            stack.addArrangedSubview(button)
        }
    }

    private func makeButton(title: String, background: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.backgroundColor = background
        button.layer.cornerRadius = 10
        button.contentEdgeInsets = UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        return button
    }

    @objc private func draftTapped() {
        guard hasFullAccess else {
            statusLabel.text = "Enable Full Access for the Jarvis keyboard in Settings → General → Keyboard."
            return
        }
        guard let apiKey = AppGroup.defaults.string(forKey: AppGroup.keyboardAPIKeyKey), !apiKey.isEmpty else {
            statusLabel.text = "Turn on \"Share API key with Jarvis Keyboard\" in the Jarvis app settings."
            return
        }
        guard let copied = UIPasteboard.general.string, !copied.isEmpty else {
            statusLabel.text = "Clipboard is empty — copy the message you want to answer first."
            return
        }

        statusLabel.text = "Drafting…"
        suggestionButtons.forEach { $0.isHidden = true }

        Task {
            do {
                let replies = try await fetchReplies(for: copied, apiKey: apiKey)
                await MainActor.run {
                    statusLabel.text = "Tap a reply to insert it:"
                    for (index, button) in suggestionButtons.enumerated() {
                        if index < replies.count {
                            button.setTitle(replies[index], for: .normal)
                            button.isHidden = false
                        }
                    }
                }
            } catch {
                await MainActor.run { statusLabel.text = "Error: \(error.localizedDescription)" }
            }
        }
    }

    @objc private func suggestionTapped(_ sender: UIButton) {
        guard let text = sender.title(for: .normal) else { return }
        textDocumentProxy.insertText(text)
    }

    /// Minimal Claude client — the extension can't share the app's Keychain,
    /// so the key comes from opt-in app-group storage.
    private func fetchReplies(for message: String, apiKey: String) async throws -> [String] {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let system = """
        The user copied a message they received. Write 3 possible replies in their voice:
        one brief/casual, one warm, one detailed. Respond with ONLY a JSON array of 3 strings.
        Each reply under 200 characters.
        """
        let payload: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 512,
            "system": system,
            "messages": [["role": "user", "content": message]],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, _) = try await URLSession.shared.data(for: request)
        struct Response: Decodable {
            struct Content: Decodable { let text: String? }
            let content: [Content]
        }
        let text = try JSONDecoder().decode(Response.self, from: data).content.compactMap(\.text).joined()
        guard let start = text.firstIndex(of: "["), let end = text.lastIndex(of: "]"),
              let replies = try? JSONDecoder().decode([String].self, from: Data(String(text[start...end]).utf8))
        else { return [text] }
        return replies
    }
}
