import ActivityKit
import SwiftUI
import WidgetKit
import AppIntents

// ── Live Activity App Intents ────────────────────────────────────────────────
// Defined inline (rather than a separate file) so they're guaranteed to compile
// into this widget extension target — the PBXFileSystemSynchronizedRootGroup
// auto-include behaviour is unreliable on objectVersion < 70.

@available(iOS 17.0, *)
private func currentWorkoutActivity() -> Activity<WorkoutActivityAttributes>? {
    return Activity<WorkoutActivityAttributes>.activities.first
}

@available(iOS 17.0, *)
struct PauseWorkoutIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause Workout"

    func perform() async throws -> some IntentResult {
        guard let activity = currentWorkoutActivity() else { return .result() }
        let prev = activity.contentState
        let newState = WorkoutActivityAttributes.ContentState(
            caloriesBurned: prev.caloriesBurned,
            heartRate:      prev.heartRate,
            isActive:       false,
            pausedAt:       Date()
        )
        await activity.update(using: newState)
        return .result()
    }
}

@available(iOS 17.0, *)
struct ResumeWorkoutIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Resume Workout"

    func perform() async throws -> some IntentResult {
        guard let activity = currentWorkoutActivity() else { return .result() }
        let prev = activity.contentState
        let newState = WorkoutActivityAttributes.ContentState(
            caloriesBurned: prev.caloriesBurned,
            heartRate:      prev.heartRate,
            isActive:       true,
            pausedAt:       nil
        )
        await activity.update(using: newState)
        return .result()
    }
}

@available(iOS 17.0, *)
struct EndWorkoutIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "End Workout"

    func perform() async throws -> some IntentResult {
        guard let activity = currentWorkoutActivity() else { return .result() }
        let prev = activity.contentState
        let finalState = WorkoutActivityAttributes.ContentState(
            caloriesBurned: prev.caloriesBurned,
            heartRate:      prev.heartRate,
            isActive:       false,
            pausedAt:       prev.pausedAt
        )
        await activity.end(using: finalState, dismissalPolicy: .immediate)
        return .result()
    }
}

private let orange = Color(red: 0.976, green: 0.451, blue: 0.086)
private let grey   = Color(red: 0.443, green: 0.443, blue: 0.475)
private let liveGreen = Color(red: 0.20, green: 0.85, blue: 0.36)
private let endRed    = Color(red: 0.62, green: 0.17, blue: 0.18)

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
                    Text(timerInterval: attributes.startTime...Date.distantFuture, countsDown: false)
                        .monospacedDigit()
                        .font(.system(size: 20, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
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

            // ── Bottom row: Pause/Resume (dark) | End (red) ──
            if #available(iOS 17.0, *) {
                HStack(spacing: 10) {
                    if state.pausedAt != nil {
                        Button(intent: ResumeWorkoutIntent()) {
                            HStack(spacing: 6) {
                                Image(systemName: "play.fill")
                                Text("Resume")
                            }
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    } else {
                        Button(intent: PauseWorkoutIntent()) {
                            HStack(spacing: 6) {
                                Image(systemName: "pause.fill")
                                Text("Pause")
                            }
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }

                    Button(intent: EndWorkoutIntent()) {
                        HStack(spacing: 6) {
                            Image(systemName: "stop.fill")
                            Text("End")
                        }
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(endRed)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
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
                    CompactTrailing(attributes: context.attributes)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        ExpandedView(attributes: context.attributes, state: context.state)
                        if #available(iOS 17.0, *) {
                            HStack(spacing: 10) {
                                if context.state.pausedAt != nil {
                                    Button(intent: ResumeWorkoutIntent()) {
                                        Image(systemName: "play.fill")
                                            .foregroundColor(.white)
                                            .frame(maxWidth: .infinity, minHeight: 32)
                                            .background(orange)
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    Button(intent: PauseWorkoutIntent()) {
                                        Image(systemName: "pause.fill")
                                            .foregroundColor(.white)
                                            .frame(maxWidth: .infinity, minHeight: 32)
                                            .background(Color.white.opacity(0.15))
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                                Button(intent: EndWorkoutIntent()) {
                                    Image(systemName: "stop.fill")
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity, minHeight: 32)
                                        .background(Color.white.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 8)
                        }
                    }
                }
            } compactLeading: {
                CompactLeading(attributes: context.attributes, state: context.state)
            } compactTrailing: {
                CompactTrailing(attributes: context.attributes)
            } minimal: {
                MinimalView(attributes: context.attributes, state: context.state)
            }
            .keylineTint(orange)
        }
    }
}
