//
//  GENERATED FILE — edit src/shared/voice/catalog.ts and run `bun run voice:generate`.
//
//  Support code (networking, keychain, URL building) is hand-written in
//  VoiceSupport.swift. Both files are injected into the Xcode project by
//  apps/mobile/plugins/withVoiceAssistants.ts.
//
//  Non-English phrases are NOT here: iOS localizes App Shortcut phrases
//  through AppShortcuts.<locale>.strings, also generated alongside this file.
//

import AppIntents
import Foundation
import SwiftUI

/// Add a todo
struct TodoCreateIntent: AppIntent {
    static let title: LocalizedStringResource = "Add a todo"
    // Runs without launching the app — works from the lock screen.
    static let openAppWhenRun: Bool = false
    @Parameter(title: "title", requestValueDialog: "What should I add?")
    var title: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        var params: [String: String] = [:]
        params["title"] = String(title)
        let speech = try await VoiceRunner.callServer(intent: "todo.create", params: params)
        return .result(dialog: IntentDialog(stringLiteral: speech))
    }
}

/// How many todos are open
struct TodoSummaryIntent: AppIntent {
    static let title: LocalizedStringResource = "How many todos are open"
    // Runs without launching the app — works from the lock screen.
    static let openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let params: [String: String] = [:]
        let speech = try await VoiceRunner.callServer(intent: "todo.summary", params: params)
        return .result(dialog: IntentDialog(stringLiteral: speech))
    }
}

/// Search todos  (not hands-free: the user still has to look)
struct TodosSearchIntent: AppIntent {
    static let title: LocalizedStringResource = "Search todos"
    // Must launch the app: the feature is client state (see the catalog).
    static let openAppWhenRun: Bool = true

    @Environment(\.openURL) private var openURL
    @Parameter(title: "query", requestValueDialog: "What should I search for?")
    var query: String

    func perform() async throws -> some IntentResult {
        var params: [String: String] = [:]
        params["query"] = String(query)
        if let url = VoiceRunner.appURL(intent: "todos.search", params: params) {
            await openURL(url)
        }
        return .result()
    }
}

/// Open todos  (not hands-free: the user still has to look)
struct TodosOpenIntent: AppIntent {
    static let title: LocalizedStringResource = "Open todos"
    // Must launch the app: the feature is client state (see the catalog).
    static let openAppWhenRun: Bool = true

    @Environment(\.openURL) private var openURL

    func perform() async throws -> some IntentResult {
        let params: [String: String] = [:]
        if let url = VoiceRunner.appURL(intent: "todos.open", params: params) {
            await openURL(url)
        }
        return .result()
    }
}

/// Registers the phrases with Siri and the Shortcuts app. iOS caps a provider
/// at 10 shortcuts; the catalog's own limit keeps us under it.
struct VoiceAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: TodoCreateIntent(),
            phrases: [
                "Add a todo in \(.applicationName)",
                "Remember something in \(.applicationName)"
            ],
            shortTitle: "Add a todo",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: TodoSummaryIntent(),
            phrases: [
                "What's left in \(.applicationName)",
                "How many todos in \(.applicationName)"
            ],
            shortTitle: "How many todos are open",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: TodosSearchIntent(),
            phrases: [
                "Search \(.applicationName)",
                "Find something in \(.applicationName)"
            ],
            shortTitle: "Search todos",
            systemImageName: "magnifyingglass"
        )
        AppShortcut(
            intent: TodosOpenIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Show my todos in \(.applicationName)"
            ],
            shortTitle: "Open todos",
            systemImageName: "magnifyingglass"
        )
    }
}
