import ActivityKit
import SwiftUI
import WidgetKit

private let orange    = Color(red: 0.976, green: 0.451, blue: 0.086)
private let grey      = Color(red: 0.443, green: 0.443, blue: 0.475)
private let liveGreen = Color(red: 0.20, green: 0.85, blue: 0.36)

// Effective timer start: `state.startTime` if set (shifted on resume), else
// the immutable `attributes.startTime`.
private func effectiveStart(
    attributes: WorkoutActivityAttributes,
    state:      WorkoutActivityAttributes.ContentState
) -> Date {
    return state.startTime ?? attributes.startTime
}

// When paused, format the frozen elapsed interval as a static string so the
// timer stops ticking. When running, use the auto-ticking system timer.
private func timerView(
    attributes: WorkoutActivityAttributes,
    state:      WorkoutActivityAttributes.ContentState
) -> Text {
    let start = effectiveStart(attributes: attributes, state: state)
    if let pausedAt = state.pausedAt {
        let secs = max(0, Int(pausedAt.timeIntervalSince(start)))
        let h = secs / 3600
        let m = (secs % 3600) / 60
        let s = secs % 60
        return Text(h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%d:%02d", m, s))
    }
    return Text(timerInterval: start...Date.distantFuture, countsDown: false)
}

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
    let state:      WorkoutActivityAttributes.ContentState
    var body: some View {
        Image(systemName: state.pausedAt != nil ? "pause.fill" : sfSymbol(for: attributes.workoutIcon))
            .foregroundColor(state.pausedAt != nil ? grey : orange)
            .font(.system(size: 14, weight: .semibold))
    }
}

struct CompactTrailing: View {
    let attributes: WorkoutActivityAttributes
    let state:      WorkoutActivityAttributes.ContentState
    var body: some View {
        timerView(attributes: attributes, state: state)
            .monospacedDigit()
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(state.pausedAt != nil ? grey : .white)
            .frame(minWidth: 44)
    }
}

struct MinimalView: View {
    let attributes: WorkoutActivityAttributes
    let state:      WorkoutActivityAttributes.ContentState
    var body: some View {
        Image(systemName: state.pausedAt != nil ? "pause.fill" : sfSymbol(for: attributes.workoutIcon))
            .foregroundColor(state.pausedAt != nil ? grey : orange)
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
                    .fill((state.pausedAt != nil ? grey : orange).opacity(0.18))
                    .frame(width: 44, height: 44)
                Image(systemName: sfSymbol(for: attributes.workoutIcon))
                    .foregroundColor(state.pausedAt != nil ? grey : orange)
                    .font(.system(size: 20, weight: .semibold))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text((state.pausedAt != nil ? "PAUSED · " : "") + attributes.workoutName.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.55))
                    .kerning(1.2)
                timerView(attributes: attributes, state: state)
                    .monospacedDigit()
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(state.pausedAt != nil ? grey : .white)
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
        VStack(spacing: 14) {
            // ── Top row: icon | LIVE pill + name | timer + ELAPSED ──
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.10), lineWidth: 2.5)
                    Circle()
                        .trim(from: 0, to: calProgress)
                        .stroke(state.pausedAt != nil ? grey : orange,
                                style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: state.pausedAt != nil ? "pause.fill" : sfSymbol(for: attributes.workoutIcon))
                        .foregroundColor(orange)
                        .font(.system(size: 18, weight: .semibold))
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 5) {
                        Circle()
                            .fill(state.pausedAt != nil ? grey : liveGreen)
                            .frame(width: 6, height: 6)
                        Text(state.pausedAt != nil ? "PAUSED" : "LIVE")
                            .font(.system(size: 10, weight: .heavy))
                            .kerning(0.8)
                            .foregroundColor(state.pausedAt != nil ? grey : liveGreen)
                    }
                    Text(attributes.workoutName)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 2) {
                    timerView(attributes: attributes, state: state)
                        .monospacedDigit()
                        .font(.system(size: 20, weight: .heavy, design: .rounded))
                        .foregroundColor(state.pausedAt != nil ? grey : .white)
                    Text("ELAPSED")
                        .font(.system(size: 9, weight: .heavy))
                        .kerning(1.0)
                        .foregroundColor(.white.opacity(0.45))
                }
            }

            // ── Metric row: calories + horizontal bar | heart rate ──
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                            .foregroundColor(orange)
                            .font(.system(size: 12))
                        Text("\(Int(state.caloriesBurned))")
                            .font(.system(size: 18, weight: .heavy))
                            .foregroundColor(.white)
                        Text(" / \(Int(attributes.goalCalories)) kcal")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.white.opacity(0.5))
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.10))
                            Capsule()
                                .fill(state.pausedAt != nil ? grey : orange)
                                .frame(width: geo.size.width * calProgress)
                        }
                    }
                    .frame(height: 4)
                }

                if let hr = state.heartRate {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.pink)
                            .font(.system(size: 12))
                        Text("\(hr)")
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundColor(.white)
                        Text(" bpm")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.white.opacity(0.5))
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
                    CompactLeading(attributes: context.attributes, state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CompactTrailing(attributes: context.attributes, state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedView(attributes: context.attributes, state: context.state)
                }
            } compactLeading: {
                CompactLeading(attributes: context.attributes, state: context.state)
            } compactTrailing: {
                CompactTrailing(attributes: context.attributes, state: context.state)
            } minimal: {
                MinimalView(attributes: context.attributes, state: context.state)
            }
            .keylineTint(orange)
        }
    }
}
