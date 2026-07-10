import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

/// Gmail integration — the real "Jarvis handles my email" unlock.
///
/// Unlike iMessage, Google exposes a full API, so Jarvis can genuinely read
/// your inbox, triage it, and SEND replies when you approve them — no compose
/// sheet required.
///
/// One-time setup (5 minutes, free):
/// 1. console.cloud.google.com → create a project → enable the Gmail API.
/// 2. Credentials → Create OAuth client ID → type **iOS** → your bundle ID.
/// 3. Paste the client ID into Jarvis Settings and tap Connect.
struct GmailMessage: Identifiable {
    let id: String
    let threadId: String
    let from: String
    let subject: String
    let snippet: String
    let messageIdHeader: String?
}

final class GmailService: NSObject {

    static let shared = GmailService()

    private static let clientIDKey = "gmailClientID"
    private static let refreshTokenKey = "com.jarvis.gmail-refresh-token"
    private var accessToken: String?
    private var accessTokenExpiry: Date = .distantPast
    private var authSession: ASWebAuthenticationSession?

    enum GmailError: LocalizedError {
        case notConnected
        case badClientID
        case authFailed(String)
        case apiError(Int, String)

        var errorDescription: String? {
            switch self {
            case .notConnected: return "Gmail isn't connected. Add your OAuth client ID in Settings and tap Connect."
            case .badClientID: return "That doesn't look like an iOS OAuth client ID (…apps.googleusercontent.com)."
            case .authFailed(let reason): return "Google sign-in failed: \(reason)"
            case .apiError(let status, let body): return "Gmail API error \(status): \(body)"
            }
        }
    }

    var isConnected: Bool {
        KeychainHelper.read(Self.refreshTokenKey) != nil
    }

    var clientID: String? {
        UserDefaults.standard.string(forKey: Self.clientIDKey)
    }

    func setClientID(_ id: String) {
        UserDefaults.standard.set(id.trimmingCharacters(in: .whitespacesAndNewlines),
                                  forKey: Self.clientIDKey)
    }

    func disconnect() {
        KeychainHelper.delete(Self.refreshTokenKey)
        accessToken = nil
    }

    // MARK: - OAuth (PKCE, no client secret needed for iOS clients)

    @MainActor
    func connect() async throws {
        guard let clientID, clientID.hasSuffix(".apps.googleusercontent.com") else {
            throw GmailError.badClientID
        }
        // iOS OAuth clients use a reversed-client-ID redirect scheme.
        let scheme = clientID.split(separator: ".").reversed().joined(separator: ".")
        let redirectURI = "\(scheme):/oauth2redirect"

        let verifier = Self.randomURLSafeString(length: 64)
        let challenge = Self.codeChallenge(for: verifier)

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent"),
        ]

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: components.url!,
                                                     callbackURLScheme: scheme) { url, error in
                if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: GmailError.authFailed(error?.localizedDescription ?? "cancelled")) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            session.start()
        }

        guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "code" })?.value
        else { throw GmailError.authFailed("no authorization code returned") }

        try await exchangeCode(code, clientID: clientID, redirectURI: redirectURI, verifier: verifier)
    }

    private func exchangeCode(_ code: String, clientID: String,
                              redirectURI: String, verifier: String) async throws {
        let body = [
            "client_id": clientID,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirectURI,
        ]
        let token = try await postToken(body)
        if let refresh = token.refreshToken {
            KeychainHelper.save(refresh, for: Self.refreshTokenKey)
        }
        accessToken = token.accessToken
        accessTokenExpiry = Date().addingTimeInterval(TimeInterval(token.expiresIn - 60))
    }

    private struct TokenResponse: Decodable {
        let accessToken: String
        let expiresIn: Int
        let refreshToken: String?

        enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case expiresIn = "expires_in"
            case refreshToken = "refresh_token"
        }
    }

    private func postToken(_ form: [String: String]) async throws -> TokenResponse {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = form
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw GmailError.apiError(status, String(data: data, encoding: .utf8) ?? "")
        }
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    private func validAccessToken() async throws -> String {
        if let accessToken, Date() < accessTokenExpiry { return accessToken }
        guard let refresh = KeychainHelper.read(Self.refreshTokenKey), let clientID else {
            throw GmailError.notConnected
        }
        let token = try await postToken([
            "client_id": clientID,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        ])
        accessToken = token.accessToken
        accessTokenExpiry = Date().addingTimeInterval(TimeInterval(token.expiresIn - 60))
        return token.accessToken
    }

    // MARK: - Gmail API

    private func apiGET(_ path: String) async throws -> Data {
        let token = try await validAccessToken()
        var request = URLRequest(url: URL(string: "https://gmail.googleapis.com/gmail/v1/users/me/\(path)")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw GmailError.apiError(status, String(data: data, encoding: .utf8) ?? "")
        }
        return data
    }

    func fetchUnread(max: Int = 8) async throws -> [GmailMessage] {
        struct MessageList: Decodable {
            struct Ref: Decodable { let id: String; let threadId: String }
            let messages: [Ref]?
        }
        struct Detail: Decodable {
            struct Payload: Decodable {
                struct Header: Decodable { let name: String; let value: String }
                let headers: [Header]?
            }
            let id: String
            let threadId: String
            let snippet: String?
            let payload: Payload?
        }

        let listData = try await apiGET("messages?q=is:unread%20category:primary&maxResults=\(max)")
        let list = try JSONDecoder().decode(MessageList.self, from: listData)
        guard let refs = list.messages, !refs.isEmpty else { return [] }

        var messages: [GmailMessage] = []
        for ref in refs {
            let data = try await apiGET("messages/\(ref.id)?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID")
            let detail = try JSONDecoder().decode(Detail.self, from: data)
            func header(_ name: String) -> String? {
                detail.payload?.headers?.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }?.value
            }
            messages.append(GmailMessage(
                id: detail.id,
                threadId: detail.threadId,
                from: header("From") ?? "Unknown sender",
                subject: header("Subject") ?? "(no subject)",
                snippet: detail.snippet ?? "",
                messageIdHeader: header("Message-ID")
            ))
        }
        return messages
    }

    /// Actually sends an email — no compose sheet. `original` threads the
    /// reply into the existing conversation when provided.
    func send(to: String, subject: String, body: String, replyingTo original: GmailMessage? = nil) async throws {
        var headers = "To: \(to)\r\nSubject: \(subject)\r\n"
        if let messageID = original?.messageIdHeader {
            headers += "In-Reply-To: \(messageID)\r\nReferences: \(messageID)\r\n"
        }
        headers += "Content-Type: text/plain; charset=utf-8\r\n"
        let raw = headers + "\r\n" + body

        let base64url = Data(raw.utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        var payload: [String: Any] = ["raw": base64url]
        if let threadId = original?.threadId { payload["threadId"] = threadId }

        let token = try await validAccessToken()
        var request = URLRequest(url: URL(string: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw GmailError.apiError(status, String(data: data, encoding: .utf8) ?? "")
        }
    }

    func markRead(_ message: GmailMessage) async throws {
        let token = try await validAccessToken()
        var request = URLRequest(url: URL(string: "https://gmail.googleapis.com/gmail/v1/users/me/messages/\(message.id)/modify")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["removeLabelIds": ["UNREAD"]])
        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - PKCE helpers

    private static func randomURLSafeString(length: Int) -> String {
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
        return String((0..<length).compactMap { _ in chars.randomElement() })
    }

    private static func codeChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

extension GmailService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }
}
