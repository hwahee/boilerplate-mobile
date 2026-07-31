//
//  VoiceSupport.swift
//  Hand-written support code for the GENERATED App Intents
//  (VoiceIntents.generated.swift — run `bun run voice:generate`).
//
//  Injected into the Xcode project by ../../plugins/withVoiceAssistants.ts.
//  This file is the ONLY place iOS-specific voice plumbing lives; everything
//  intent-shaped is generated from src/shared/voice/catalog.ts.
//
//  Two execution paths, matching the catalog's two modes:
//
//    api       callServer(...) → POST <apiBaseUrl>/api/voice/<id> → spoken answer.
//              The app is never launched, so this works from the lock screen
//              and from a Watch/CarPlay context.
//
//    deeplink  openApp(...) → <scheme>://voice/<id>?<slots>, handled by
//              apps/mobile/src/voice. Requires openAppWhenRun = true.
//
//  ── Configuration ──────────────────────────────────────────────────────────
//  `apiBaseUrl` and `scheme` come from Info.plist, written by the config
//  plugin from app.config.ts. They are PUBLIC values — the app bundle is a
//  public artifact and no secret may be embedded in it.
//
//  ── The credential, and the one native gap ─────────────────────────────────
//  The voice token is deliberately NOT in Info.plist. It is read from a
//  Keychain access group shared between this target and the app, so it can be
//  minted at login and revoked independently (see
//  src/server/services/voice-token-service.ts).
//
//  The READER is implemented below. The WRITER is not shipped: expo-secure-store
//  does not expose a Keychain access group, so writing the token into the
//  shared group needs either a newer expo-secure-store that does, or a small
//  native module. Until then `api` intents answer "sign in first". This is the
//  remaining native work item — see docs/voice-assistant.md.
//

import AppIntents
import Foundation

enum VoiceConfig {
    /// Set by the config plugin from `extra.apiBaseUrl` in app.config.ts.
    static var apiBaseUrl: String {
        Bundle.main.object(forInfoDictionaryKey: "VoiceApiBaseUrl") as? String ?? ""
    }

    /// The env-specific custom scheme (`mobileboilerplate`, `-dev`, `-stg`).
    static var scheme: String {
        Bundle.main.object(forInfoDictionaryKey: "VoiceAppScheme") as? String ?? ""
    }

    /// Keychain access group holding the voice token, shared with the app.
    static var keychainAccessGroup: String {
        Bundle.main.object(forInfoDictionaryKey: "VoiceKeychainAccessGroup") as? String ?? ""
    }
}

/// Errors surfaced to the user as speech. Never leak transport detail into a
/// spoken message — the driver can act on "sign in" and on "try again", and on
/// nothing else.
enum VoiceError: LocalizedError {
    case notSignedIn
    case unavailable

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return String(localized: "Open the app and sign in first.")
        case .unavailable:
            return String(localized: "That didn't work. Please try again.")
        }
    }
}

enum VoiceKeychain {
    static let account = "voice.token"

    /// Reads the voice token from the shared access group. Returns nil when the
    /// user has not linked voice access yet.
    static func voiceToken() -> String? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        let group = VoiceConfig.keychainAccessGroup
        if !group.isEmpty {
            query[kSecAttrAccessGroup as String] = group
        }

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let token = String(data: data, encoding: .utf8),
              !token.isEmpty
        else { return nil }
        return token
    }
}

enum VoiceRunner {
    private struct VoiceResponse: Decodable {
        let speech: String
    }

    /// Executes an `api` intent server-side and returns the sentence to speak.
    ///
    /// `Accept-Language` carries the device language, so the server localizes
    /// the answer with the same catalog the app uses (@shared/i18n).
    static func callServer(intent: String, params: [String: String]) async throws -> String {
        guard let token = VoiceKeychain.voiceToken() else { throw VoiceError.notSignedIn }
        guard let url = URL(string: "\(VoiceConfig.apiBaseUrl)/api/voice/\(intent)") else {
            throw VoiceError.unavailable
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(Locale.preferredLanguages.first ?? "en", forHTTPHeaderField: "Accept-Language")
        request.httpBody = try JSONSerialization.data(withJSONObject: params)
        // A driver will not wait: fail fast and say so rather than hang on the
        // dead-zone request that a moving car inevitably produces.
        request.timeoutInterval = 10

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw VoiceError.unavailable }
        if http.statusCode == 401 { throw VoiceError.notSignedIn }
        guard (200..<300).contains(http.statusCode) else { throw VoiceError.unavailable }

        guard let decoded = try? JSONDecoder().decode(VoiceResponse.self, from: data) else {
            throw VoiceError.unavailable
        }
        return decoded.speech
    }

    /// Builds the deep link a `deeplink` intent opens.
    static func appURL(intent: String, params: [String: String]) -> URL? {
        var components = URLComponents()
        components.scheme = VoiceConfig.scheme
        components.host = "voice"
        components.path = "/\(intent)"
        if !params.isEmpty {
            components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        return components.url
    }
}
