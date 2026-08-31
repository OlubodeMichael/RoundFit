import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// Hero pages — the two screens that carry the product's identity on the wrist.
// Built on WatchDesign.swift components. Every value here comes from the phone
// snapshot; nothing is synthesised.
// ─────────────────────────────────────────────────────────────────────────────

// MARK: - Today

/// The wrist-raise screen: date, three dials at a glance, and the one directive.
///
/// Deliberately leads with the directive rather than a grid of numbers — the
/// product's whole claim is that it tells you the one thing to do today, and the
/// watch is where that claim is easiest to prove.
struct TodayHeroView: View {
    let snapshot: WatchSnapshot

    private var r: WatchSnapshot.Readiness { snapshot.readiness }
    private var e: WatchSnapshot.Energy { snapshot.energy }
    private var scoreTint: Color { WatchTheme.scoreTint(r.score) }

    private var caloriesProgress: Double {
        e.calorieGoal > 0
            ? Double(e.calorieGoal - e.caloriesRemaining) / Double(e.calorieGoal)
            : 0
    }
    private var proteinProgress: Double {
        e.proteinGoal > 0
            ? Double(e.proteinGoal - e.proteinRemaining) / Double(e.proteinGoal)
            : 0
    }
    private var sleepProgress: Double {
        if let s = r.sleepScore { return Double(s) / 100 }
        guard let h = r.sleepHours else { return 0 }
        return min(h / 8, 1)
    }

    /// The single line the whole product is built around.
    private var directive: String? {
        if let d = r.directive, !d.isEmpty { return d }
        if let c = snapshot.coaching, !c.title.isEmpty { return c.title }
        return nil
    }

    var body: some View {
        ZStack {
            GlowBackdrop(tint: scoreTint, intensity: 0.14)

            VStack(spacing: 6) {
                Text(WatchTime.weekdayDate(snapshot.date))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 6) {
                    MiniDial(
                        progress: Double(r.score ?? 0) / 100,
                        tint: scoreTint,
                        value: r.score.map(String.init) ?? "–",
                        icon: "bolt.heart.fill"
                    )
                    MiniDial(
                        progress: caloriesProgress,
                        tint: WatchTheme.calories,
                        value: "\(abs(e.caloriesRemaining))",
                        icon: "flame.fill"
                    )
                    MiniDial(
                        progress: sleepProgress > 0 ? sleepProgress : proteinProgress,
                        tint: sleepProgress > 0 ? WatchTheme.sleep : WatchTheme.protein,
                        value: sleepProgress > 0
                            ? WatchTime.hoursCompact(r.sleepHours ?? 0)
                            : "\(abs(e.proteinRemaining))",
                        icon: sleepProgress > 0 ? "moon.fill" : "fork.knife"
                    )
                }

                if let directive {
                    Text(directive)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(3)
                        .minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(.top, 6)
            .sectionPadding()
        }
    }
}

// MARK: - Recovery hero

/// Readiness as the page's whole subject: lit backdrop, segmented dial, score,
/// the verdict, and the inputs that produced it.
struct RecoveryHeroView: View {
    let readiness: WatchSnapshot.Readiness
    let updatedAt: String

    private var scoreTint: Color { WatchTheme.scoreTint(readiness.score) }

    var body: some View {
        NavigationStack {
            NavigationLink {
                RecoveryDetailView(readiness: readiness, updatedAt: updatedAt)
            } label: {
                ZStack {
                    GlowBackdrop(tint: scoreTint)

                    VStack(spacing: 6) {
                        SectionHeader(text: "Readiness", tint: scoreTint)

                        SegmentedDial(
                            progress: Double(readiness.score ?? 0) / 100,
                            tint: scoreTint,
                            size: WatchMetrics.ring
                        ) {
                            VStack(spacing: -2) {
                                HeroNumber(
                                    value: readiness.score.map(String.init) ?? "–",
                                    size: 38,
                                    tint: .primary
                                )
                                Text("/100")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.tertiary)
                            }
                        }

                        VerdictChip(text: readiness.label, tint: scoreTint)

                        // The inputs behind the score, so it never reads as a
                        // number the app made up.
                        HStack(spacing: 0) {
                            if let hrv = readiness.hrv {
                                SupportStat(icon: "waveform.path.ecg", tint: WatchTheme.hrv,
                                            value: "\(hrv)", caption: "HRV")
                            }
                            if let hr = readiness.restingHr {
                                SupportStat(icon: "heart.fill", tint: WatchTheme.heart,
                                            value: "\(hr)", caption: "RHR")
                            }
                            if let h = readiness.sleepHours, h > 0 {
                                SupportStat(icon: "moon.fill", tint: WatchTheme.sleep,
                                            value: WatchTime.hoursCompact(h), caption: "SLEEP")
                            }
                        }
                        .padding(.top, 1)
                    }
                    .sectionPadding()
                }
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Sleep

/// Sleep with its stage breakdown — the one metric where a stacked bar says more
/// than a ring, since the split is the point.
struct SleepHeroView: View {
    let readiness: WatchSnapshot.Readiness

    private var total: Double { readiness.sleepHours ?? 0 }

    var body: some View {
        ZStack {
            GlowBackdrop(tint: WatchTheme.sleep, intensity: 0.15)

            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(text: "Sleep", tint: WatchTheme.sleep)

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    HeroNumber(value: WatchTime.hoursCompact(total), unit: "hrs", size: 36)
                    Spacer(minLength: 0)
                    if let score = readiness.sleepScore {
                        VerdictChip(text: "\(score)/100", tint: WatchTheme.sleep)
                    }
                }

                SleepStagesBar(
                    totalHours: total,
                    deepHours: readiness.deepSleepHours,
                    remHours: readiness.remSleepHours
                )

                VStack(spacing: 2) {
                    if let deep = readiness.deepSleepHours, deep > 0 {
                        StageKey(color: WatchTheme.sleepDeep, label: "Deep",
                                 value: WatchTime.hoursMinutes(deep))
                    }
                    if let rem = readiness.remSleepHours, rem > 0 {
                        StageKey(color: WatchTheme.sleepRem, label: "REM",
                                 value: WatchTime.hoursMinutes(rem))
                    }
                    let core = total - (readiness.deepSleepHours ?? 0) - (readiness.remSleepHours ?? 0)
                    if core > 0 {
                        StageKey(color: WatchTheme.sleep, label: "Core",
                                 value: WatchTime.hoursMinutes(core))
                    }
                }
            }
            .sectionPadding()
        }
    }
}
