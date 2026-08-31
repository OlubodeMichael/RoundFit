import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// RoundFit watch design language
//
// The signature element is the segmented dial, ported from the phone
// (`components/home/SegmentedDial.tsx`): a ring drawn as discrete ticks rather
// than a continuous stroke, where filled ticks grow and the leading tick carries
// a halo. Every fitness app on the wrist draws a plain stroke ring — the ticks
// are what make a RoundFit screenshot recognisable at a glance.
//
// Add this file to the watch app target (and the widget target if it reuses the
// components).
// ─────────────────────────────────────────────────────────────────────────────

enum WatchDial {
    /// Matches TICK_COUNT on the phone so both dials read as the same object.
    static let tickCount = 36
}

// MARK: - Segmented dial

/// The signature ring. `progress` is 0…1; ticks fill clockwise from 12 o'clock.
struct SegmentedDial<Content: View>: View {
    let progress: Double
    let tint: Color
    var size: CGFloat = 104
    var tickCount: Int = WatchDial.tickCount
    /// Scales tick geometry for the small 3-up dials on the Today page.
    var scale: CGFloat = 1
    @ViewBuilder var content: Content

    private var clamped: Double { min(max(progress, 0), 1) }
    private var filled: Int { Int((clamped * Double(tickCount)).rounded(.down)) }
    private var isComplete: Bool { clamped >= 1 }
    /// The tick at the growing edge — drawn largest, with a halo behind it.
    private var leading: Int { clamped > 0 && !isComplete ? filled : -1 }

    var body: some View {
        // One Canvas instead of 36 stacked Views — TabView used to instantiate
        // every page at launch and trip the 10s scene-update watchdog (0x8BADF00D).
        ZStack {
            Canvas { context, canvasSize in
                let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
                for index in 0..<tickCount {
                    let isLeadingTick = index == leading
                    let isFilled = index < filled || isComplete
                    let w = (isLeadingTick ? 6 : isFilled ? 5 : 3) * scale
                    let h = (isLeadingTick ? 13 : isFilled ? 11 : 8) * scale
                    let radians = CGFloat(Double(index) * (2 * Double.pi / Double(tickCount)))
                    let color = (isFilled || isLeadingTick) ? tint : tint.opacity(0.26)

                    var transform = CGAffineTransform.identity
                        .translatedBy(x: center.x, y: center.y)
                        .rotated(by: radians)
                        .translatedBy(x: -w / 2, y: -canvasSize.height / 2 + 3 * scale)

                    if isLeadingTick {
                        let halo = 16 * scale
                        let haloRect = CGRect(
                            x: (w - halo) / 2,
                            y: (h - halo) / 2,
                            width: halo,
                            height: halo
                        )
                        context.fill(
                            Path(ellipseIn: haloRect).applying(transform),
                            with: .color(tint.opacity(0.35))
                        )
                    }

                    let tickRect = CGRect(x: 0, y: 0, width: w, height: h)
                    context.fill(
                        Path(roundedRect: tickRect, cornerRadius: w / 2).applying(transform),
                        with: .color(color)
                    )
                }
            }
            content
        }
        .frame(width: size, height: size)
    }
}

extension SegmentedDial where Content == EmptyView {
    init(progress: Double, tint: Color, size: CGFloat = 104, tickCount: Int = WatchDial.tickCount, scale: CGFloat = 1) {
        self.init(progress: progress, tint: tint, size: size, tickCount: tickCount, scale: scale) { EmptyView() }
    }
}

// MARK: - Atmosphere

/// A soft radial wash behind a hero metric, tinted by its own colour. This is what
/// separates a "premium" watch screen from a flat one — the screen feels lit by
/// the metric rather than printed on black.
struct GlowBackdrop: View {
    let tint: Color
    var intensity: Double = 0.18

    var body: some View {
        // Deliberately no .blur(): a radial gradient is already smooth, and a
        // full-screen blur forces an offscreen pass every frame. On watchOS that
        // was slow enough to trip the 10s scene-update watchdog at launch.
        RadialGradient(
            colors: [tint.opacity(intensity), tint.opacity(intensity * 0.35), .clear],
            center: .center,
            startRadius: 2,
            endRadius: 120
        )
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

// MARK: - Type

/// Hero numeral — the one big number a page is about.
struct HeroNumber: View {
    let value: String
    var unit: String? = nil
    var size: CGFloat = 44
    var tint: Color = .white

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(value)
                .font(.system(size: size, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tint)
            if let unit {
                Text(unit)
                    .font(.system(size: size * 0.32, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .minimumScaleFactor(0.6)
        .lineLimit(1)
    }
}

/// The verdict pill under a hero number ("TRAIN HARD", "BACK OFF"). Carries the
/// directive — the thing RoundFit exists to deliver — rather than another stat.
struct VerdictChip: View {
    let text: String
    let tint: Color

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .heavy))
            .tracking(0.8)
            .foregroundStyle(tint)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(
                Capsule().fill(tint.opacity(0.18))
            )
            .overlay(
                Capsule().stroke(tint.opacity(0.35), lineWidth: 0.5)
            )
            .lineLimit(1)
            .minimumScaleFactor(0.75)
    }
}

// MARK: - Compact stats

/// A single supporting stat beneath a hero — icon, value, caption.
struct SupportStat: View {
    let icon: String
    let tint: Color
    let value: String
    let caption: String

    var body: some View {
        VStack(spacing: 1) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(tint)
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text(caption)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

/// One of the three dials on the Today page.
struct MiniDial: View {
    let progress: Double
    let tint: Color
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 3) {
            SegmentedDial(progress: progress, tint: tint, size: 44, tickCount: 24, scale: 0.5) {
                Text(value)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }
            Image(systemName: icon)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(tint)
        }
    }
}

// MARK: - Sleep stages

/// Stacked deep / REM / core bar. Uses the real stage hours from the snapshot —
/// no invented data — and degrades to a single bar when stages are missing.
struct SleepStagesBar: View {
    let totalHours: Double
    let deepHours: Double?
    let remHours: Double?

    private var deep: Double { max(0, deepHours ?? 0) }
    private var rem: Double { max(0, remHours ?? 0) }
    private var core: Double { max(0, totalHours - deep - rem) }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let total = max(totalHours, 0.01)

            HStack(spacing: 1.5) {
                segment(WatchTheme.sleepDeep, width: w * (deep / total))
                segment(WatchTheme.sleepRem, width: w * (rem / total))
                segment(WatchTheme.sleep, width: w * (core / total))
            }
        }
        .frame(height: 10)
    }

    @ViewBuilder
    private func segment(_ color: Color, width: CGFloat) -> some View {
        if width > 0.5 {
            Capsule().fill(color).frame(width: width)
        }
    }
}

/// Legend dot + label for the sleep stage bar.
struct StageKey: View {
    let color: Color
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
            Spacer(minLength: 2)
            Text(value)
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .monospacedDigit()
        }
    }
}
