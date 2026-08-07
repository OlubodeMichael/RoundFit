import Foundation
import SwiftUI

// Add this file to BOTH the watch app target and the widget extension target.
// Keys are camelCase to match the phone's WatchSnapshot JSON exactly (no key strategy).

// MARK: - App Group / WCSession keys (keep in sync with WatchBridgeModule.swift)

enum WatchConstants {
    static let appGroup = "group.co.roundfit.app"
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
    let coaching: Coaching?
    let energy: Energy
    let water: Water
    var activity: Activity?
    let workout: Workout
    let quickPicks: [QuickPick]

    struct Readiness: Codable, Equatable {
        let score: Int?
        let directive: String?
        let label: String
        let mood: String
        var reason: String?
        var sleepScore: Int?
        var sleepHours: Double?
        var deepSleepHours: Double?
        var remSleepHours: Double?
        var strainScore: Int?
        var soreness: Int?
        var hrv: Int?
        var restingHr: Int?
    }

    struct Coaching: Codable, Equatable {
        let title: String
        let message: String
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

    struct Activity: Codable, Equatable {
        var steps: Int?
        var caloriesBurned: Int?
    }

    struct Workout: Codable, Equatable {
        let active: Bool
        var paused: Bool?
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

// MARK: - Design system (mirrors constants in lib/log-theme.tsx)

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        self.init(
            red: Double((int >> 16) & 0xFF) / 255,
            green: Double((int >> 8) & 0xFF) / 255,
            blue: Double(int & 0xFF) / 255
        )
    }
}

enum WatchTheme {
    static let calories  = Color(hex: "FF7849")
    static let protein   = Color(hex: "34D399")
    static let carbs     = Color(hex: "FBBF24")
    static let water     = Color(hex: "38BDF8")
    static let sleep     = Color(hex: "818CF8")
    static let sleepDeep = Color(hex: "4338CA")   // deep sleep
    static let sleepRem  = Color(hex: "C4B5FD")   // REM
    static let strain    = Color(hex: "22D3EE")
    static let soreness  = Color(hex: "FB7185")
    static let hrv       = Color(hex: "34D399")
    static let heart     = Color(hex: "F97066")
    static let steps     = Color(hex: "60A5FA")
    static let faint     = Color(hex: "909096")

    /// Readiness ring tint by score band — matches the app's scoreTint.
    static func scoreTint(_ score: Int?) -> Color {
        guard let s = score else { return faint }
        if s >= 67 { return protein }   // green
        if s >= 34 { return carbs }     // amber
        return heart                    // red
    }
}

// MARK: - Mood → color (mirrors the phone's directive accents)

extension WatchSnapshot.Readiness {
    var moodColor: Color {
        switch mood {
        case "energized": return WatchTheme.calories // train_hard → coral
        case "alert":     return WatchTheme.carbs     // moderate → amber
        case "recovery":  return WatchTheme.water      // light → sky
        case "calm":      return WatchTheme.sleep      // rest → indigo
        default:          return WatchTheme.faint
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
