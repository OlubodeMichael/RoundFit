import Foundation
import SwiftUI

// Add this file to BOTH the watch app target and the widget extension target.
// Keys are camelCase to match the phone's WatchSnapshot JSON exactly (no key strategy).

// MARK: - App Group / WCSession keys (keep in sync with WatchBridgeModule.swift)

enum WatchConstants {
    static let appGroup = "group.com.michaelolu.roundfit"
    static let snapshotKey = "watch.snapshot"
    static let snapshotContextKey = "snapshot"
    static let actionKey = "action"
}

// MARK: - Snapshot (phone → watch)

struct WatchSnapshot: Codable, Equatable {
    let schema: Int
    let updatedAt: String
    let date: String
    let readiness: Readiness
    let energy: Energy
    let water: Water
    let workout: Workout
    let quickPicks: [QuickPick]

    struct Readiness: Codable, Equatable {
        let score: Int?
        let directive: String?
        let label: String
        let mood: String
    }

    struct Energy: Codable, Equatable {
        let caloriesRemaining: Int
        let calorieGoal: Int
        let proteinRemaining: Int
        let proteinGoal: Int
    }

    struct Water: Codable, Equatable {
        let currentMl: Int
        let goalMl: Int
        let cupMl: Int
    }

    struct Workout: Codable, Equatable {
        let active: Bool
        var activityId: String?
        var label: String?
        var startedAt: String?
        var caloriesBurned: Int?
    }

    struct QuickPick: Codable, Equatable, Identifiable {
        let id: String
        let label: String
        let sfSymbol: String
        let mode: String
    }
}

extension WatchSnapshot {
    static func decode(from json: String) -> WatchSnapshot? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WatchSnapshot.self, from: data)
    }

    /// Latest snapshot persisted by the phone into the App Group. Read by the app on
    /// launch and by the complication timeline — never nil-crashes, just returns nil.
    static func loadFromAppGroup() -> WatchSnapshot? {
        guard
            let defaults = UserDefaults(suiteName: WatchConstants.appGroup),
            let json = defaults.string(forKey: WatchConstants.snapshotKey)
        else { return nil }
        return decode(from: json)
    }
}

// MARK: - Mood → color (mirrors the phone's directive accents)

extension WatchSnapshot.Readiness {
    var moodColor: Color {
        switch mood {
        case "energized": return Color.orange      // train_hard
        case "alert":     return Color.yellow       // moderate
        case "recovery":  return Color.blue         // light
        case "calm":      return Color.indigo       // rest
        default:          return Color.gray
        }
    }
}

// MARK: - Action (watch → phone)

struct WatchAction: Codable {
    let id: String
    let ts: String
    let type: String
    var amountMl: Int?
    var activityId: String?
    var calorieGoal: Int?
    var durationMin: Int?

    static func now(type: String) -> WatchAction {
        WatchAction(
            id: UUID().uuidString,
            ts: ISO8601DateFormatter().string(from: Date()),
            type: type
        )
    }

    func jsonString() -> String? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
