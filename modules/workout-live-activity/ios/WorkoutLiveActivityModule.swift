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
        // Effective start used by the widget timer. Differs from
        // `attributes.startTime` after resume (shifted forward by pause
        // duration) so the elapsed time picks up where it left off.
        public var startTime: Date?

        public init(caloriesBurned: Double, heartRate: Int? = nil, isActive: Bool = true, pausedAt: Date? = nil, startTime: Date? = nil) {
            self.caloriesBurned = caloriesBurned
            self.heartRate = heartRate
            self.isActive = isActive
            self.pausedAt = pausedAt
            self.startTime = startTime
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

// ─── Workout session (set tracker) Live Activity ─────────────────────────────
// Independent from the burn-coach activity above. Both can run at the same time
// (iOS allows multiple Live Activities) — they're distinguished by attribute
// type, so iOS routes updates correctly.
public struct WorkoutSessionAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Number of sets logged so far this session.
        public var setCount: Int
        /// Name of the most recently logged exercise (e.g. "Bench Press").
        public var lastExercise: String?
        /// Reps in the most recently logged set.
        public var lastSetReps: Int?
        /// Weight (kg) in the most recently logged set.
        public var lastSetWeightKg: Double?
        /// Cumulative volume in kg (sum of weight × reps across logged sets).
        public var totalVolumeKg: Double
        public var caloriesBurned: Double
        public var heartRate: Int?
        public var isActive: Bool
        public var pausedAt: Date?
        /// Effective start used by the widget timer; resumes use this to skip
        /// over paused time without mutating `attributes.startTime`.
        public var startTime: Date?

        public init(
            setCount: Int = 0,
            lastExercise: String? = nil,
            lastSetReps: Int? = nil,
            lastSetWeightKg: Double? = nil,
            totalVolumeKg: Double = 0,
            caloriesBurned: Double = 0,
            heartRate: Int? = nil,
            isActive: Bool = true,
            pausedAt: Date? = nil,
            startTime: Date? = nil
        ) {
            self.setCount = setCount
            self.lastExercise = lastExercise
            self.lastSetReps = lastSetReps
            self.lastSetWeightKg = lastSetWeightKg
            self.totalVolumeKg = totalVolumeKg
            self.caloriesBurned = caloriesBurned
            self.heartRate = heartRate
            self.isActive = isActive
            self.pausedAt = pausedAt
            self.startTime = startTime
        }
    }
    public var workoutType: String
    public var workoutName: String
    public var workoutIcon: String
    public var startTime: Date

    public init(workoutType: String, workoutName: String, workoutIcon: String, startTime: Date) {
        self.workoutType = workoutType
        self.workoutName = workoutName
        self.workoutIcon = workoutIcon
        self.startTime = startTime
    }
}

public class WorkoutLiveActivityModule: Module {

    // Stored as `Any?` so the class can compile on iOS < 16.1; cast at use sites.
    // Burn-coach activity (existing).
    private var activity: Any?
    // Workout-session activity (new — set tracker).
    private var sessionActivity: Any?

    @available(iOS 16.1, *)
    private func endAllBurnActivities() async {
        for existing in Activity<WorkoutActivityAttributes>.activities {
            let prev = existing.contentState
            let finalState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: prev.caloriesBurned,
                heartRate:      prev.heartRate,
                isActive:       false,
                pausedAt:       prev.pausedAt,
                startTime:      prev.startTime
            )
            await existing.end(using: finalState, dismissalPolicy: .immediate)
        }
        self.activity = nil
    }

    @available(iOS 16.1, *)
    private func endAllSessionActivities() async {
        for existing in Activity<WorkoutSessionAttributes>.activities {
            let prev = existing.contentState
            let finalState = WorkoutSessionAttributes.ContentState(
                setCount:        prev.setCount,
                lastExercise:    prev.lastExercise,
                lastSetReps:     prev.lastSetReps,
                lastSetWeightKg: prev.lastSetWeightKg,
                totalVolumeKg:   prev.totalVolumeKg,
                caloriesBurned: prev.caloriesBurned,
                heartRate:       prev.heartRate,
                isActive:        false,
                pausedAt:        prev.pausedAt,
                startTime:       prev.startTime
            )
            await existing.end(using: finalState, dismissalPolicy: .immediate)
        }
        self.sessionActivity = nil
    }

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
                pausedAt:       nil,
                startTime:      startTime
            )

            Task {
                await self.endAllBurnActivities()

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

            let calories  = (params["caloriesBurned"] as? NSNumber)?.doubleValue ?? prev.caloriesBurned
            let heartRate = (params["heartRate"]      as? NSNumber)?.intValue    ?? prev.heartRate
            let isActive  = (params["isActive"]       as? Bool)                  ?? prev.isActive

            // `pausedAt` / `startTime` semantics:
            //   key present + number  → set to that ms timestamp
            //   key present + NSNull  → clear (only for pausedAt)
            //   key absent            → preserve previous value
            // NSNumber casting is used so we accept both JS integers and floats.
            let pausedAt: Date? = {
                if !params.keys.contains("pausedAt") { return prev.pausedAt }
                if let ms = (params["pausedAt"] as? NSNumber)?.doubleValue {
                    return Date(timeIntervalSince1970: ms / 1000)
                }
                return nil
            }()
            let startTime: Date? = {
                if !params.keys.contains("startTime") { return prev.startTime }
                if let ms = (params["startTime"] as? NSNumber)?.doubleValue {
                    return Date(timeIntervalSince1970: ms / 1000)
                }
                return prev.startTime
            }()

            let newState = WorkoutActivityAttributes.ContentState(
                caloriesBurned: calories,
                heartRate:      heartRate,
                isActive:       isActive,
                pausedAt:       pausedAt,
                startTime:      startTime
            )

            Task {
                await activity.update(using: newState)
                promise.resolve(nil)
            }
        }

        AsyncFunction("endActivity") {
            (_: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }

            Task {
                await self.endAllBurnActivities()
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

        // ── Workout-session (set tracker) lifecycle ──────────────────────
        // Parallel to startActivity / updateActivity / endActivity, but for
        // the WorkoutSessionAttributes type. Both Live Activities can run
        // simultaneously — iOS keys them by attribute type.

        AsyncFunction("startSessionActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.reject("UNSUPPORTED", "Live Activities require iOS 16.1+")
                return
            }

            let workoutType = params["workoutType"] as? String ?? "other"
            let workoutName = params["workoutName"] as? String ?? "Workout"
            let workoutIcon = params["workoutIcon"] as? String ?? "dumbbell"
            let startMs     = (params["startTime"] as? NSNumber)?.doubleValue
            let startTime   = startMs != nil
                ? Date(timeIntervalSince1970: startMs! / 1000)
                : Date()

            let attributes = WorkoutSessionAttributes(
                workoutType: workoutType,
                workoutName: workoutName,
                workoutIcon: workoutIcon,
                startTime:   startTime
            )
            let initialState = WorkoutSessionAttributes.ContentState(
                setCount:        0,
                lastExercise:    nil,
                lastSetReps:     nil,
                lastSetWeightKg: nil,
                totalVolumeKg:   0,
                isActive:        true,
                pausedAt:        nil,
                startTime:       startTime
            )

            Task {
                await self.endAllSessionActivities()

                do {
                    let activity = try Activity.request(
                        attributes:    attributes,
                        contentState:  initialState,
                        pushType:      nil
                    )
                    self.sessionActivity = activity
                    promise.resolve(["activityId": activity.id])
                } catch {
                    promise.reject("START_FAILED", error.localizedDescription)
                }
            }
        }

        AsyncFunction("updateSessionActivity") {
            (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }
            guard let activity = self.sessionActivity as? Activity<WorkoutSessionAttributes> else {
                promise.reject("NO_ACTIVITY", "No active workout session")
                return
            }

            let prev = activity.contentState

            // `setCount` / `totalVolumeKg`: if the key is present, set it;
            // otherwise preserve previous. Same NSNumber-coercion pattern as
            // the burn-coach update so JS ints and floats both bridge cleanly.
            let setCount: Int = (params["setCount"] as? NSNumber)?.intValue ?? prev.setCount
            let totalVolumeKg: Double =
                (params["totalVolumeKg"] as? NSNumber)?.doubleValue ?? prev.totalVolumeKg
            let calories  = (params["caloriesBurned"] as? NSNumber)?.doubleValue ?? prev.caloriesBurned
            let heartRate = (params["heartRate"]      as? NSNumber)?.intValue    ?? prev.heartRate

            // Last-set fields: key present + string/number → set it.
            //                  key present + NSNull       → clear it.
            //                  key absent                 → preserve previous.
            let lastExercise: String? = {
                if !params.keys.contains("lastExercise") { return prev.lastExercise }
                return params["lastExercise"] as? String
            }()
            let lastSetReps: Int? = {
                if !params.keys.contains("lastSetReps") { return prev.lastSetReps }
                return (params["lastSetReps"] as? NSNumber)?.intValue
            }()
            let lastSetWeightKg: Double? = {
                if !params.keys.contains("lastSetWeightKg") { return prev.lastSetWeightKg }
                return (params["lastSetWeightKg"] as? NSNumber)?.doubleValue
            }()

            let isActive = (params["isActive"] as? Bool) ?? prev.isActive

            let pausedAt: Date? = {
                if !params.keys.contains("pausedAt") { return prev.pausedAt }
                if let ms = (params["pausedAt"] as? NSNumber)?.doubleValue {
                    return Date(timeIntervalSince1970: ms / 1000)
                }
                return nil
            }()
            let startTime: Date? = {
                if !params.keys.contains("startTime") { return prev.startTime }
                if let ms = (params["startTime"] as? NSNumber)?.doubleValue {
                    return Date(timeIntervalSince1970: ms / 1000)
                }
                return prev.startTime
            }()

            let newState = WorkoutSessionAttributes.ContentState(
                setCount:        setCount,
                lastExercise:    lastExercise,
                lastSetReps:     lastSetReps,
                lastSetWeightKg: lastSetWeightKg,
                totalVolumeKg:   totalVolumeKg,
                caloriesBurned: calories,
                heartRate:       heartRate,
                isActive:        isActive,
                pausedAt:        pausedAt,
                startTime:       startTime
            )

            Task {
                await activity.update(using: newState)
                promise.resolve(nil)
            }
        }

        AsyncFunction("endSessionActivity") {
            (_: [String: Any], promise: Promise) in
            guard #available(iOS 16.1, *) else {
                promise.resolve(nil); return
            }

            Task {
                await self.endAllSessionActivities()
                promise.resolve(nil)
            }
        }

        Function("hasActiveSessionActivity") { () -> Bool in
            guard #available(iOS 16.1, *) else { return false }
            if self.sessionActivity == nil {
                self.sessionActivity = Activity<WorkoutSessionAttributes>.activities.first
            }
            return self.sessionActivity != nil
        }

        Function("getCurrentSessionState") { () -> [String: Any]? in
            guard #available(iOS 16.1, *) else { return nil }
            if self.sessionActivity == nil {
                self.sessionActivity = Activity<WorkoutSessionAttributes>.activities.first
            }
            guard let activity = self.sessionActivity as? Activity<WorkoutSessionAttributes> else { return nil }
            let s = activity.contentState
            var dict: [String: Any] = [
                "setCount":      s.setCount,
                "totalVolumeKg": s.totalVolumeKg,
                "isActive":      s.isActive,
            ]
            if let n = s.lastExercise    { dict["lastExercise"]    = n }
            if let r = s.lastSetReps     { dict["lastSetReps"]     = r }
            if let w = s.lastSetWeightKg { dict["lastSetWeightKg"] = w }
            if let p = s.pausedAt        { dict["pausedAt"]        = p.timeIntervalSince1970 * 1000 }
            if let t = s.startTime       { dict["startTime"]       = t.timeIntervalSince1970 * 1000 }
            return dict
        }
    }
}
