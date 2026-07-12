import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — one type scale, spacing, and header treatment for every section
// ─────────────────────────────────────────────────────────────────────────────

enum WatchMetrics {
    static let statHuge: CGFloat = 34   // primary numbers
    static let statRing: CGFloat = 30   // numbers centred in a ring
    static let hPad: CGFloat = 8
    static let vPad: CGFloat = 4
    static let sectionSpacing: CGFloat = 8
    static let corner: CGFloat = 14
    static let ring: CGFloat = 104
}

/// The tinted, tracked, uppercase label that tops every section.
struct SectionHeader: View {
    let text: String
    var tint: Color = .secondary

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .heavy))
            .tracking(1.4)
            .foregroundStyle(tint)
    }
}

extension View {
    /// The one rounded, tabular numeric treatment used for every stat.
    func statNumber(_ size: CGFloat = WatchMetrics.statHuge) -> some View {
        font(.system(size: size, weight: .bold, design: .rounded)).monospacedDigit()
    }

    /// Standard page insets so every section aligns to the same margins.
    func sectionPadding() -> some View {
        padding(.horizontal, WatchMetrics.hPad).padding(.vertical, WatchMetrics.vPad)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────────────────────────────────────

/// A circular progress ring — soft track, bright gradient fill, rounded cap.
struct ProgressRing: View {
    let progress: Double
    let tint: Color
    var lineWidth: CGFloat = 9

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.002, min(progress, 1)))
                .stroke(tint.gradient, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

/// A ring-centred stat page: header, ring with icon + number inside, footnote.
struct RingStatPage: View {
    let tint: Color
    let progress: Double
    let icon: String
    let centerValue: String
    let centerUnit: String
    let label: String
    var footnote: String? = nil

    var body: some View {
        VStack(spacing: WatchMetrics.sectionSpacing) {
            SectionHeader(text: label, tint: tint)
            ZStack {
                ProgressRing(progress: progress, tint: tint)
                VStack(spacing: 0) {
                    Image(systemName: icon).font(.footnote).foregroundStyle(tint)
                    Text(centerValue).statNumber(WatchMetrics.statRing)
                    Text(centerUnit).font(.system(size: 11)).foregroundStyle(.secondary)
                }
            }
            .frame(width: WatchMetrics.ring, height: WatchMetrics.ring)
            if let footnote {
                Text(footnote).font(.caption2).foregroundStyle(.tertiary).monospacedDigit()
            }
        }
        .sectionPadding()
    }
}

/// A big-number stat page for raw values with no 0–100 scale (HRV, HR, soreness).
struct MetricPage: View {
    let icon: String
    let tint: Color
    let value: String
    let unit: String
    let label: String
    var detail: String? = nil

    var body: some View {
        VStack(spacing: WatchMetrics.sectionSpacing) {
            SectionHeader(text: label, tint: tint)
            Image(systemName: icon).font(.title2).foregroundStyle(tint)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value).statNumber()
                Text(unit).font(.caption).foregroundStyle(.secondary)
            }
            if let detail {
                Text(detail).font(.caption2).foregroundStyle(.tertiary)
            }
        }
        .sectionPadding()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Readiness — score gauge, then swipe through the recovery detail metrics
// ─────────────────────────────────────────────────────────────────────────────

/// Recovery — shows just the score. Tap it to open the full, scrollable list of
/// underlying metrics (sleep, strain, soreness, HRV, resting HR).
struct RecoveryScoreView: View {
    let readiness: WatchSnapshot.Readiness
    let updatedAt: String
    private var scoreTint: Color { WatchTheme.scoreTint(readiness.score) }

    var body: some View {
        NavigationStack {
            NavigationLink {
                RecoveryDetailView(readiness: readiness, updatedAt: updatedAt)
            } label: {
                VStack(spacing: 8) {
                    SectionHeader(text: "Readiness")
                    ZStack {
                        ProgressRing(progress: Double(readiness.score ?? 0) / 100, tint: scoreTint)
                        Text(readiness.score.map(String.init) ?? "–").statNumber(WatchMetrics.statHuge)
                    }
                    .frame(width: WatchMetrics.ring, height: WatchMetrics.ring)
                    Text(readiness.label).font(.headline).foregroundStyle(readiness.moodColor)
                    HStack(spacing: 3) {
                        Text("Details")
                        Image(systemName: "chevron.right")
                    }
                    .font(.caption2).foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity)
                .sectionPadding()
            }
            .buttonStyle(.plain)
        }
    }
}

/// The full recovery breakdown, opened from the score — a scrollable list of every
/// metric. Each row drills further into its own detail (sleep graph, strain ring, …).
struct RecoveryDetailView: View {
    let readiness: WatchSnapshot.Readiness
    let updatedAt: String

    private var hasSleep: Bool {
        readiness.sleepScore != nil || (readiness.sleepHours ?? 0) > 0
    }
    private var sleepValue: String {
        if (readiness.sleepHours ?? 0) > 0 {
            return WatchTime.hoursMinutes(readiness.sleepHours ?? 0)
        }
        if let s = readiness.sleepScore { return "\(s)/100" }
        return "—"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                if hasSleep {
                    NavigationLink {
                        SleepView(readiness: readiness)
                    } label: {
                        MetricRow(icon: "bed.double.fill", tint: WatchTheme.sleep,
                                  label: "Sleep", value: sleepValue)
                    }.buttonStyle(.plain)
                }
                if let s = readiness.strainScore {
                    NavigationLink {
                        RingStatPage(tint: WatchTheme.strain, progress: Double(s) / 100,
                                     icon: "bolt.fill", centerValue: "\(s)",
                                     centerUnit: "/100", label: "Strain")
                    } label: {
                        MetricRow(icon: "bolt.fill", tint: WatchTheme.strain,
                                  label: "Strain", value: "\(s)")
                    }.buttonStyle(.plain)
                }
                if let s = readiness.soreness {
                    NavigationLink {
                        MetricPage(icon: "figure.strengthtraining.functional",
                                   tint: WatchTheme.soreness, value: "\(s)", unit: "/10",
                                   label: "Soreness")
                    } label: {
                        MetricRow(icon: "figure.strengthtraining.functional",
                                  tint: WatchTheme.soreness, label: "Soreness", value: "\(s)/10")
                    }.buttonStyle(.plain)
                }
                if let v = readiness.hrv {
                    NavigationLink {
                        MetricPage(icon: "waveform.path.ecg", tint: WatchTheme.hrv,
                                   value: "\(v)", unit: "ms", label: "HRV")
                    } label: {
                        MetricRow(icon: "waveform.path.ecg", tint: WatchTheme.hrv,
                                  label: "HRV", value: "\(v) ms")
                    }.buttonStyle(.plain)
                }
                if let v = readiness.restingHr {
                    NavigationLink {
                        MetricPage(icon: "heart.fill", tint: WatchTheme.heart,
                                   value: "\(v)", unit: "bpm", label: "Resting HR")
                    } label: {
                        MetricRow(icon: "heart.fill", tint: WatchTheme.heart,
                                  label: "Resting HR", value: "\(v) bpm")
                    }.buttonStyle(.plain)
                }

                Text(WatchTime.relative(updatedAt))
                    .font(.caption2).foregroundStyle(.tertiary).padding(.top, 2)
            }
            .padding(.horizontal, WatchMetrics.hPad)
        }
        .navigationTitle("Recovery")
    }
}

/// A tappable metric summary row — icon chip, label, value, chevron.
struct MetricRow: View {
    let icon: String
    let tint: Color
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 26, height: 26)
                .background(tint.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(value)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .monospacedDigit().foregroundStyle(.secondary)
                .lineLimit(1)
                .fixedSize()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 7).padding(.horizontal, 9)
        .frame(maxWidth: .infinity)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: WatchMetrics.corner))
    }
}

/// Sleep detail — total, score, and a stacked stage graph (Deep / Core / REM).
struct SleepView: View {
    let readiness: WatchSnapshot.Readiness

    private var total: Double { readiness.sleepHours ?? 0 }
    private var deep: Double { readiness.deepSleepHours ?? 0 }
    private var rem: Double { readiness.remSleepHours ?? 0 }
    private var core: Double { max(total - deep - rem, 0) }
    private var hasStages: Bool { deep > 0 || rem > 0 }

    var body: some View {
        ScrollView {
            VStack(spacing: WatchMetrics.sectionSpacing) {
                SectionHeader(text: "Sleep", tint: WatchTheme.sleep)

                if total > 0 {
                    Text(WatchTime.hoursMinutes(total)).statNumber()
                    if let s = readiness.sleepScore {
                        Text("Score \(s)").font(.caption2).foregroundStyle(.secondary)
                    }
                    SleepStageBar(deep: deep, core: core, rem: rem)
                        .frame(height: 12)
                        .padding(.top, 2)
                    if hasStages {
                        VStack(spacing: 4) {
                            stageRow("Deep", deep, WatchTheme.sleepDeep)
                            stageRow("Core", core, WatchTheme.sleep)
                            stageRow("REM", rem, WatchTheme.sleepRem)
                        }
                        .padding(.top, 2)
                    }
                } else if let s = readiness.sleepScore {
                    // Have a sleep score but no duration — show the score, not "0h 0m".
                    Text("\(s)").statNumber()
                    Text("Sleep score").font(.caption2).foregroundStyle(.secondary)
                } else {
                    Text("No sleep data").font(.callout).foregroundStyle(.secondary)
                }
            }
            .sectionPadding()
        }
    }

    private func stageRow(_ name: String, _ hours: Double, _ color: Color) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(name).font(.caption2)
            Spacer()
            Text(WatchTime.hoursMinutes(hours))
                .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
        }
    }
}

/// Horizontal stacked bar of sleep stages, sized by each stage's share of the night.
struct SleepStageBar: View {
    let deep: Double
    let core: Double
    let rem: Double

    private var total: Double { max(deep + core + rem, 0.001) }

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 1.5) {
                segment(deep, WatchTheme.sleepDeep, geo.size.width)
                segment(core, WatchTheme.sleep, geo.size.width)
                segment(rem, WatchTheme.sleepRem, geo.size.width)
            }
        }
        .clipShape(Capsule())
    }

    private func segment(_ hours: Double, _ color: Color, _ width: CGFloat) -> some View {
        color.frame(width: max(0, CGFloat(hours / total) * width))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coach — mirrors the iPhone home coach card
// ─────────────────────────────────────────────────────────────────────────────

struct CoachView: View {
    let coaching: WatchSnapshot.Coaching
    let tint: Color

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WatchMetrics.sectionSpacing) {
                SectionHeader(text: "Coach", tint: tint)
                Text(coaching.title)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(tint)
                Text(coaching.message)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .sectionPadding()
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity — steps + total calories burned today
// ─────────────────────────────────────────────────────────────────────────────

struct ActivityView: View {
    let activity: WatchSnapshot.Activity

    var body: some View {
        VStack(spacing: 14) {
            SectionHeader(text: "Activity", tint: WatchTheme.steps)
            if let s = activity.steps {
                ActivityStat(icon: "shoeprints.fill", tint: WatchTheme.steps,
                             value: s.formatted(), label: "Steps")
            }
            if let c = activity.caloriesBurned {
                ActivityStat(icon: "flame.fill", tint: WatchTheme.calories,
                             value: "\(c)", label: "Cal Burned")
            }
        }
        .sectionPadding()
    }
}

private struct ActivityStat: View {
    let icon: String
    let tint: Color
    let value: String
    let label: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title3).foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(0.18), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 0) {
                Text(value).statNumber(24)
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .bold)).tracking(1)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Water — a filling jar with a live wave, plus a Log Water screen
// ─────────────────────────────────────────────────────────────────────────────

struct WaterView: View {
    @EnvironmentObject var store: WatchConnectivityStore

    var body: some View {
        let goal = store.snapshot?.water.goalMl ?? 2000
        let current = store.displayWaterMl
        let progress = goal > 0 ? Double(current) / Double(goal) : 0

        NavigationStack {
            VStack(spacing: WatchMetrics.sectionSpacing) {
                SectionHeader(text: "Water", tint: WatchTheme.water)
                WaterJar(progress: progress).frame(width: 62, height: 82)
                Text("\(current) / \(goal) ml").statNumber(16)
                NavigationLink {
                    WaterLogOptionsView()
                } label: {
                    Label("Log Water", systemImage: "drop.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .tint(WatchTheme.water)
            }
            .sectionPadding()
        }
    }
}

/// A glass that fills to `progress` with an animated water surface.
struct WaterJar: View {
    let progress: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: Double = 0

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: WatchMetrics.corner)
                .fill(WatchTheme.water.opacity(0.08))
            WaterWave(progress: min(max(progress, 0), 1), phase: phase)
                .fill(WatchTheme.water.gradient)
                .clipShape(RoundedRectangle(cornerRadius: WatchMetrics.corner))
            RoundedRectangle(cornerRadius: WatchMetrics.corner)
                .stroke(WatchTheme.water.opacity(0.55), lineWidth: 2.5)
            Text("\(Int((min(max(progress, 0), 1)) * 100))%")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.35), radius: 1, y: 0.5)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 2.2).repeatForever(autoreverses: false)) {
                phase = 2 * .pi
            }
        }
    }
}

/// The water surface — a sine wave whose baseline sits at the fill level.
struct WaterWave: Shape {
    var progress: Double
    var phase: Double

    var animatableData: Double {
        get { phase }
        set { phase = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let waveHeight = 3.0
        let yBase = rect.height * (1 - progress)
        p.move(to: CGPoint(x: 0, y: yBase))
        for x in stride(from: 0.0, through: rect.width, by: 1.0) {
            let rel = x / rect.width
            let y = yBase + sin(rel * .pi * 2 + phase) * waveHeight
            p.addLine(to: CGPoint(x: x, y: y))
        }
        p.addLine(to: CGPoint(x: rect.width, y: rect.height))
        p.addLine(to: CGPoint(x: 0, y: rect.height))
        p.closeSubpath()
        return p
    }
}

/// Log-water screen — the user's configured cup size leads, then common presets.
struct WaterLogOptionsView: View {
    @EnvironmentObject var store: WatchConnectivityStore
    @Environment(\.dismiss) private var dismiss

    private struct Option: Identifiable {
        let id = UUID()
        let ml: Int
        let label: String
        let icon: String
    }

    private var options: [Option] {
        let cup = store.snapshot?.water.cupMl ?? 250
        var opts = [Option(ml: cup, label: "Cup", icon: "cup.and.saucer.fill")]
        for (ml, label, icon) in [
            (250, "Glass", "waterbottle"),
            (500, "Bottle", "waterbottle.fill"),
            (750, "Large", "drop.fill"),
        ] where ml != cup {
            opts.append(Option(ml: ml, label: label, icon: icon))
        }
        return opts
    }

    var body: some View {
        List {
            ForEach(options) { opt in
                Button {
                    store.logWater(opt.ml)
                    dismiss()
                } label: {
                    HStack {
                        Label(opt.label, systemImage: opt.icon)
                            .foregroundStyle(WatchTheme.water)
                        Spacer()
                        Text("\(opt.ml) ml").foregroundStyle(.secondary).monospacedDigit()
                    }
                }
            }
        }
        .navigationTitle("Log Water")
        .tint(WatchTheme.water)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workout — select + start, or control the live one
// ─────────────────────────────────────────────────────────────────────────────

struct WorkoutView: View {
    @EnvironmentObject var store: WatchConnectivityStore

    var body: some View {
        if store.showWorkoutLive {
            LiveWorkoutView(workout: store.snapshot?.workout)
        } else {
            NavigationStack {
                NavigationLink {
                    WorkoutListView()
                } label: {
                    WorkoutLandingCard()
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Workout landing — a single focal card you tap to choose an activity.
struct WorkoutLandingCard: View {
    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(WatchTheme.protein.opacity(0.15))
                Image(systemName: "figure.run")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(WatchTheme.protein)
            }
            .frame(width: WatchMetrics.ring, height: WatchMetrics.ring)
            Text("Workout").font(.title3.weight(.bold))
            HStack(spacing: 3) {
                Text("Choose activity")
                Image(systemName: "chevron.right")
            }
            .font(.caption2).foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .sectionPadding()
    }
}

/// The scrollable list of activities, opened from the workout landing.
struct WorkoutListView: View {
    @EnvironmentObject var store: WatchConnectivityStore

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                ForEach(store.snapshot?.quickPicks ?? []) { pick in
                    NavigationLink {
                        WorkoutPrepView(pick: pick)
                    } label: {
                        WorkoutPickRow(pick: pick)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, WatchMetrics.hPad)
            .padding(.top, 2)
        }
        .navigationTitle("Workout")
    }
}

/// A tappable activity tile — icon chip + label, consistent with the app's row style.
struct WorkoutPickRow: View {
    let pick: WatchSnapshot.QuickPick

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: pick.sfSymbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(WatchTheme.protein)
                .frame(width: 26, height: 26)
                .background(WatchTheme.protein.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
            Text(pick.label).font(.system(size: 13, weight: .semibold)).lineLimit(1)
            Spacer()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 7)
        .padding(.horizontal, 9)
        .frame(maxWidth: .infinity)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: WatchMetrics.corner))
    }
}

/// Prep screen for a picked activity — a big Start button, then a 3-2-1 countdown
/// before the workout actually begins (so a tap can't accidentally start it).
struct WorkoutPrepView: View {
    @EnvironmentObject var store: WatchConnectivityStore
    let pick: WatchSnapshot.QuickPick
    @State private var countdown: Int? = nil

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: pick.sfSymbol)
                .font(.largeTitle)
                .foregroundStyle(WatchTheme.protein)
            Text(pick.label).font(.headline)

            if let c = countdown {
                Text("\(c)")
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .foregroundStyle(WatchTheme.protein)
                    .contentTransition(.numericText(countsDown: true))
            } else {
                Button {
                    beginCountdown()
                } label: {
                    Label("Start", systemImage: "play.fill").frame(maxWidth: .infinity)
                }
                .tint(WatchTheme.protein)
            }
        }
        .padding()
        .navigationTitle(pick.label)
    }

    private func beginCountdown() {
        countdown = 3
        scheduleTick()
    }

    private func scheduleTick() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            guard let c = countdown else { return }
            if c <= 1 {
                store.startWorkout(pick) // flips showWorkoutLive → view swaps to the live controls
            } else {
                withAnimation { countdown = c - 1 }
                scheduleTick()
            }
        }
    }
}

/// Live workout controls on the wrist — elapsed timer, pause/resume, end.
struct LiveWorkoutView: View {
    @EnvironmentObject var store: WatchConnectivityStore
    let workout: WatchSnapshot.Workout?

    private var isPaused: Bool { store.displayPaused }
    private var accent: Color { isPaused ? WatchTheme.carbs : WatchTheme.protein }

    var body: some View {
        VStack(spacing: WatchMetrics.sectionSpacing) {
            SectionHeader(text: "Workout", tint: accent)

            Image(systemName: "figure.run.circle.fill")
                .font(.title)
                .foregroundStyle(accent)

            Text(workout?.label ?? "Workout").font(.headline)

            if let iso = workout?.startedAt, let start = WatchTime.date(iso), !isPaused {
                Text(start, style: .timer).statNumber(24)
            } else if isPaused {
                Text("Paused").font(.callout).foregroundStyle(.secondary)
            } else {
                Text("Starting…").font(.callout).foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                if isPaused {
                    Button { store.resumeWorkout() } label: {
                        Image(systemName: "play.fill").frame(maxWidth: .infinity)
                    }
                    .tint(WatchTheme.protein)
                } else {
                    Button { store.pauseWorkout() } label: {
                        Image(systemName: "pause.fill").frame(maxWidth: .infinity)
                    }
                    .tint(WatchTheme.carbs)
                }
                Button(role: .destructive) { store.endWorkout() } label: {
                    Image(systemName: "stop.fill").frame(maxWidth: .infinity)
                }
            }
        }
        .sectionPadding()
    }
}

// ─────────────────────────────────────────────────────────────────────────────

enum WatchTime {
    static func hoursMinutes(_ h: Double) -> String {
        let total = Int((h * 60).rounded())
        return "\(total / 60)h \(total % 60)m"
    }

    static func date(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    static func relative(_ iso: String) -> String {
        guard let date = date(iso) else { return "" }
        let mins = Int(Date().timeIntervalSince(date) / 60)
        if mins < 1 { return "just now" }
        if mins < 60 { return "\(mins)m ago" }
        return "\(mins / 60)h ago"
    }
}
