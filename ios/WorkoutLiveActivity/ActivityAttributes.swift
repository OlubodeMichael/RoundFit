import ActivityKit
import Foundation

public struct WorkoutActivityAttributes: ActivityAttributes {

    public struct ContentState: Codable, Hashable {
        public var caloriesBurned: Double
        public var heartRate: Int?
        public var isActive: Bool

        public init(caloriesBurned: Double, heartRate: Int? = nil, isActive: Bool = true) {
            self.caloriesBurned = caloriesBurned
            self.heartRate = heartRate
            self.isActive = isActive
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
