import ActivityKit
import ExpoModulesCore
import Foundation

// Must match ios/WorkoutLiveActivity/ActivityAttributes.swift exactly.
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var caloriesBurned: Double
        var heartRate: Int?
        var isActive: Bool
    }
    var workoutType: String
    var workoutName: String
    var workoutIcon: String
    var goalCalories: Double
    var startTime: Date
}

public class WorkoutLiveActivityModule: Module {

    // The single active workout activity (only one at a time).
    private var activity: Activity<WorkoutActivityAttributes>?

    public func definition() -> ModuleDefinition {
        Name("WorkoutLiveActivity")

        // MARK: - isSupported
        Function("isSupported") { () -> Bool in
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        // MARK: - startActivity
        AsyncFunction("startActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.reject("UNSUPPORTED", "Live Activities require iOS 16.1+")
                return
            }

            let workoutType  = params["workoutType"]  as? String ?? "other"
            let workoutName  = params["workoutName"]  as? String ?? "Workout"
            let workoutIcon  = params["workoutIcon"]  as? String ?? "figure.mixed.cardio"
            let goalCalories = params["goalCalories"] as? Double ?? 0
            let startMs      = params["startTime"]    as? Double
            let startTime    = startMs != nil
                ? Date(timeIntervalSince1970: startMs! / 1000)
                : Date()

            let attributes = WorkoutActivityAttributes(
                workoutType:  workoutType,
                workoutName:  workoutName,
                workoutIcon:  workoutIcon,
                goalCalories: goalCalories,
                startTime:    startTime
            )
            let initialState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: 0,
                heartRate:      nil,
                isActive:       true
            )

            do {
                let activity = try Activity.request(
                    attributes:    attributes,
                    contentState:  initialState,
                    pushType:      nil
                )
                self.activity = activity
                promise.resolve(["activityId": activity.id])
            } catch {
                promise.reject("START_FAILED", error.localizedDescription)
            }
        }

        // MARK: - updateActivity
        AsyncFunction("updateActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }
            guard let activity = self.activity else {
                promise.reject("NO_ACTIVITY", "No active workout activity")
                return
            }

            let calories  = params["caloriesBurned"] as? Double ?? 0
            let heartRate = params["heartRate"]      as? Int
            let isActive  = params["isActive"]       as? Bool ?? true

            let newState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: calories,
                heartRate:      heartRate,
                isActive:       isActive
            )

            Task {
                await activity.update(using: newState)
                promise.resolve(nil)
            }
        }

        // MARK: - endActivity
        AsyncFunction("endActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }
            guard let activity = self.activity else {
                promise.resolve(nil); return
            }

            let calories  = params["caloriesBurned"] as? Double ?? 0
            let heartRate = params["heartRate"]       as? Int
            let finalState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: calories,
                heartRate:      heartRate,
                isActive:       false
            )

            Task {
                // Keep the final summary visible for ~5 min before auto-dismiss
                await activity.end(
                    using:           finalState,
                    dismissalPolicy: .after(Date.now.addingTimeInterval(300))
                )
                self.activity = nil
                promise.resolve(nil)
            }
        }

        // MARK: - hasActiveActivity
        Function("hasActiveActivity") { () -> Bool in
            guard #available(iOS 16.1, *) else { return false }
            return self.activity != nil
        }
    }
}
