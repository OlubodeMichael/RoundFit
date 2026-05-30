import ActivityKit
import SwiftUI
import WidgetKit

private let orange = Color(red: 0.976, green: 0.451, blue: 0.086)

private func sfSymbol(for workoutIcon: String) -> String {
    let known = [
        "figure.run", "figure.walk", "figure.outdoor.cycle", "figure.pool.swim",
        "figure.rowing", "figure.yoga", "figure.highintensity.intervaltraining",
        "figure.strengthtraining.traditional", "dumbbell", "bolt.heart",
        "figure.mixed.cardio", "map",
    ]
    return known.contains(workoutIcon) ? workoutIcon : "figure.mixed.cardio"
}

struct CompactLeading: View {
    let attributes: WorkoutActivityAttributes
    var body: some View {
        Image(systemName: sfSymbol(for: attributes.workoutIcon))
            .foregroundColor(orange)
            .font(.system(size: 14, weight: .semibold))
    }
}

struct CompactTrailing: View {
    let attributes: WorkoutActivityAttributes
    var body: some View {
        Text(timerInterval: attributes.startTime...Date.distantFuture, countsDown: false)
            .monospacedDigit()
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(.white)
            .frame(minWidth: 44)
    }
}

struct MinimalView: View {
    let attributes: WorkoutActivityAttributes
    var body: some View {
        Image(systemName: sfSymbol(for: attributes.workoutIcon))
            .foregroundColor(orange)
            .font(.system(size: 12, weight: .semibold))
    }
}

struct ExpandedView: View {
    let attributes: WorkoutActivityAttributes
    let state:      WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(orange.opacity(0.18))
                    .frame(width: 44, height: 44)
                Image(systemName: sfSymbol(for: attributes.workoutIcon))
                    .foregroundColor(orange)
                    .font(.system(size: 20, weight: .semibold))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(attributes.workoutName.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.55))
                    .kerning(1.2)
                Text(timerInterval: attributes.startTime...Date.distantFuture, countsDown: false)
                    .monospacedDigit()
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(orange)
                        .font(.system(size: 11))
                    Text("\(Int(state.caloriesBurned)) kcal")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }
                if let hr = state.heartRate {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.pink)
                            .font(.system(size: 11))
                        Text("\(hr) bpm")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white.opacity(0.75))
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

struct LockScreenView: View {
    let attributes: WorkoutActivityAttributes
    let state:      WorkoutActivityAttributes.ContentState

    var calProgress: Double {
        guard attributes.goalCalories > 0 else { return 0 }
        return min(state.caloriesBurned / attributes.goalCalories, 1)
    }

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.12), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: calProgress)
                    .stroke(orange, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Image(systemName: sfSymbol(for: attributes.workoutIcon))
                    .foregroundColor(.white)
                    .font(.system(size: 16, weight: .semibold))
            }
            .frame(width: 52, height: 52)

            VStack(alignment: .leading, spacing: 3) {
                Text(attributes.workoutName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                Text(timerInterval: attributes.startTime...Date.distantFuture, countsDown: false)
                    .monospacedDigit()
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.7))
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 3) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(orange)
                        .font(.system(size: 12))
                    Text("\(Int(state.caloriesBurned))")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundColor(.white)
                }
                Text("of \(Int(attributes.goalCalories)) kcal goal")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white.opacity(0.5))
                if let hr = state.heartRate {
                    HStack(spacing: 3) {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.pink)
                            .font(.system(size: 10))
                        Text("\(hr) bpm")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white.opacity(0.65))
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(red: 0.07, green: 0.07, blue: 0.09))
    }
}

struct WorkoutLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(.black)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    CompactLeading(attributes: context.attributes)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CompactTrailing(attributes: context.attributes)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedView(attributes: context.attributes, state: context.state)
                }
            } compactLeading: {
                CompactLeading(attributes: context.attributes)
            } compactTrailing: {
                CompactTrailing(attributes: context.attributes)
            } minimal: {
                MinimalView(attributes: context.attributes)
            }
            .keylineTint(orange)
        }
    }
}
