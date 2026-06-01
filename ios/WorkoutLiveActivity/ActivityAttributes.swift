import ActivityKit
import Foundation

public struct WorkoutActivityAttributes: ActivityAttributes {

    public struct ContentState: Codable, Hashable {
        public var caloriesBurned: Double
        public var heartRate: Int?
        public var isActive: Bool
        public var pausedAt: Date?
        public var startTime: Date?

        public init(
            caloriesBurned: Double,
            heartRate: Int? = nil,
            isActive: Bool = true,
            pausedAt: Date? = nil,
            startTime: Date? = nil
        ) {
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

    public init(
        workoutType: String,
        workoutName: String,
        workoutIcon: String,
        goalCalories: Double,
        startTime: Date
    ) {
        self.workoutType = workoutType
        self.workoutName = workoutName
        self.workoutIcon = workoutIcon
        self.goalCalories = goalCalories
        self.startTime = startTime
    }
}

// MARK: - Workout session (set tracker) Live Activity
// Mirror of the pod's WorkoutSessionAttributes. Both targets need byte-
// identical struct definitions for the system to route updates correctly.

public struct WorkoutSessionAttributes: ActivityAttributes {

    public struct ContentState: Codable, Hashable {
        public var setCount: Int
        public var lastExercise: String?
        public var lastSetReps: Int?
        public var lastSetWeightKg: Double?
        public var totalVolumeKg: Double
        public var isActive: Bool
        public var pausedAt: Date?
        public var startTime: Date?

        public init(
            setCount: Int = 0,
            lastExercise: String? = nil,
            lastSetReps: Int? = nil,
            lastSetWeightKg: Double? = nil,
            totalVolumeKg: Double = 0,
            isActive: Bool = true,
            pausedAt: Date? = nil,
            startTime: Date? = nil
        ) {
            self.setCount = setCount
            self.lastExercise = lastExercise
            self.lastSetReps = lastSetReps
            self.lastSetWeightKg = lastSetWeightKg
            self.totalVolumeKg = totalVolumeKg
            self.isActive = isActive
            self.pausedAt = pausedAt
            self.startTime = startTime
        }
    }

    public var workoutType: String
    public var workoutName: String
    public var workoutIcon: String
    public var startTime: Date

    public init(
        workoutType: String,
        workoutName: String,
        workoutIcon: String,
        startTime: Date
    ) {
        self.workoutType = workoutType
        self.workoutName = workoutName
        self.workoutIcon = workoutIcon
        self.startTime = startTime
    }
}
