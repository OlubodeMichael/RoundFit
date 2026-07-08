import SwiftUI

// MARK: - Readiness (the hero)

struct ReadinessView: View {
    let readiness: WatchSnapshot.Readiness
    let updatedAt: String

    var body: some View {
        VStack(spacing: 4) {
            Text("READINESS")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.secondary)
                .tracking(1.5)

            ZStack {
                Circle()
                    .stroke(readiness.moodColor.opacity(0.25), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: CGFloat(readiness.score ?? 0) / 100)
                    .stroke(readiness.moodColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(readiness.score.map(String.init) ?? "–")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
            .frame(width: 92, height: 92)

            Text(readiness.label)
                .font(.headline)
                .foregroundStyle(readiness.moodColor)

            Text(WatchTime.relative(updatedAt))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Energy (calories + protein remaining)

struct EnergyView: View {
    let energy: WatchSnapshot.Energy

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            metric(
                icon: "flame.fill",
                tint: .orange,
                value: energy.caloriesRemaining,
                unit: energy.caloriesRemaining >= 0 ? "cal left" : "cal over",
                goal: "of \(energy.calorieGoal)"
            )
            Divider()
            metric(
                icon: "fork.knife",
                tint: .green,
                value: energy.proteinRemaining,
                unit: energy.proteinRemaining >= 0 ? "g protein left" : "g over target",
                goal: "of \(energy.proteinGoal)g"
            )
        }
        .padding(.horizontal, 6)
    }

    private func metric(icon: String, tint: Color, value: Int, unit: String, goal: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(tint).font(.title3)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(abs(value))")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text(unit).font(.caption2).foregroundStyle(.secondary)
                Text(goal).font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }
}

// MARK: - Water (+1 quick-log)

struct WaterView: View {
    @EnvironmentObject var store: WatchConnectivityStore

    var body: some View {
        let water = store.snapshot?.water
        let goal = water?.goalMl ?? 2000
        let current = store.displayWaterMl

        VStack(spacing: 8) {
            Text("WATER")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.secondary)
                .tracking(1.5)

            Text("\(current) / \(goal) ml")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .monospacedDigit()

            ProgressView(value: Double(min(current, goal)), total: Double(max(goal, 1)))
                .tint(.cyan)

            Button {
                store.logWater()
            } label: {
                Label("+\(water?.cupMl ?? 250) ml", systemImage: "plus")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .tint(.cyan)
        }
        .padding(.horizontal, 8)
    }
}

// MARK: - Workout (select + start, or end the live one)

struct WorkoutView: View {
    @EnvironmentObject var store: WatchConnectivityStore
    let snapshot: WatchSnapshot

    var body: some View {
        if snapshot.workout.active {
            VStack(spacing: 10) {
                Image(systemName: "figure.run.circle.fill").font(.largeTitle).foregroundStyle(.green)
                Text(snapshot.workout.label ?? "Workout")
                    .font(.headline)
                Text("In progress").font(.caption).foregroundStyle(.secondary)
                Button(role: .destructive) {
                    store.endWorkout()
                } label: {
                    Label("End", systemImage: "stop.fill").frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 8)
        } else {
            List {
                Section("Start a workout") {
                    ForEach(snapshot.quickPicks) { pick in
                        Button {
                            store.startWorkout(pick)
                        } label: {
                            Label(pick.label, systemImage: pick.sfSymbol)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - helpers

enum WatchTime {
    static func relative(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return "" }
        let mins = Int(Date().timeIntervalSince(date) / 60)
        if mins < 1 { return "just now" }
        if mins < 60 { return "\(mins)m ago" }
        return "\(mins / 60)h ago"
    }
}
