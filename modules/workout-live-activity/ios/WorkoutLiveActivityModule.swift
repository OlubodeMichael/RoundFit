import ActivityKit
import ExpoModulesCore
import Foundation

// Must match ios/WorkoutLiveActivity/ActivityAttributes.swift exactly.
// Public so the App Intents file in the main app target can import this pod's
// type and address the same activity instance.
public struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var caloriesBurned: Double
        public var heartRate: Int?
        public var isActive: Bool
        public var pausedAt: Date?

        public init(caloriesBurned: Double, heartRate: Int? = nil, isActive: Bool = true, pausedAt: Date? = nil) {
            self.caloriesBurned = caloriesBurned
            self.heartRate = heartRate
            self.isActive = isActive
            self.pausedAt = pausedAt
        }
    }
    public var workoutType: String
    public var workoutName: String
    public var workoutIcon: String
    public var goalCalories: Double
    public var startTime: Date

    public init(workoutType: String, workoutName: String, workoutIcon: String, goalCalories: Double, startTime: Date) {
        self.workoutType = workoutType
        self.workoutName = workoutName
        self.workoutIcon = workoutIcon
        self.goalCalories = goalCalories
        self.startTime = startTime
    }
}

public class WorkoutLiveActivityModule: Module {

    // Stored as `Any?` so the class can compile on iOS < 16.1; cast at use sites.
    private var activity: Any?

    public func definition() -> ModuleDefinition {
        Name("WorkoutLiveActivity")

        Function("isSupported") { () -> Bool in
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

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
                isActive:       true,
                pausedAt:       nil
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

        AsyncFunction("updateActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }
            guard let activity = self.activity as? Activity<WorkoutActivityAttributes> else {
                promise.reject("NO_ACTIVITY", "No active workout activity")
                return
            }

            let prev = activity.contentState

            let calories  = params["caloriesBurned"] as? Double ?? prev.caloriesBurned
            let heartRate = (params["heartRate"]    as? Int)  ?? prev.heartRate
            let isActive  = (params["isActive"]     as? Bool) ?? prev.isActive

            // `pausedAt` semantics:
            //   key present + number  → set paused
            //   key present + NSNull  → clear paused
            //   key absent            → preserve previous value
            let pausedAt: Date? = {
                if !params.keys.contains("pausedAt") { return prev.pausedAt }
                if let ms = params["pausedAt"] as? Double { return Date(timeIntervalSince1970: ms / 1000) }
                return nil
            }()

            let newState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: calories,
                heartRate:      heartRate,
                isActive:       isActive,
                pausedAt:       pausedAt
            )

            Task {
                await activity.update(using: newState)
                promise.resolve(nil)
            }
        }

        AsyncFunction("endActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }
            guard let activity = self.activity as? Activity<WorkoutActivityAttributes> else {
                promise.resolve(nil); return
            }

            let prev = activity.contentState
            let calories  = params["caloriesBurned"] as? Double ?? prev.caloriesBurned
            let heartRate = (params["heartRate"]    as? Int)  ?? prev.heartRate
            let finalState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: calories,
                heartRate:      heartRate,
                isActive:       false,
                pausedAt:       prev.pausedAt
            )

            Task {
                await activity.end(
                    using:           finalState,
                    dismissalPolicy: .immediate
                )
                self.activity = nil
                promise.resolve(nil)
            }
        }

        Function("hasActiveActivity") { () -> Bool in
            guard #available(iOS 16.1, *) else { return false }
            return self.activity != nil
        }

        // Returns the current activity's state, or nil if none.
        // Used by JS to resync after lock-screen Pause/Resume/End taps.
        Function("getCurrentState") { () -> [String: Any]? in
            guard #available(iOS 16.1, *) else { return nil }
            // Reattach to a system-managed activity in case the in-process
            // reference was lost (e.g. ended via App Intent from lock screen).
            if self.activity == nil {
                self.activity = Activity<WorkoutActivityAttributes>.activities.first
            }
            guard let activity = self.activity as? Activity<WorkoutActivityAttributes> else { return nil }
            let s = activity.contentState
            var dict: [String: Any] = [
                "caloriesBurned": s.caloriesBurned,
                "isActive":       s.isActive,
            ]
            if let hr = s.heartRate { dict["heartRate"] = hr }
            if let p  = s.pausedAt  { dict["pausedAt"]  = p.timeIntervalSince1970 * 1000 }
            return dict
        }
    }
}
