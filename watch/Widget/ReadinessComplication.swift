import SwiftUI
import WidgetKit

// Watch-face complication showing today's readiness. Reads the App Group snapshot the
// phone pushes, so it refreshes without the watch app being open. Add this file + the
// shared WatchSnapshotModels.swift to the Widget Extension target.

struct ReadinessEntry: TimelineEntry {
    let date: Date
    let score: Int?
    let label: String
    let tint: Color
}

struct ReadinessProvider: TimelineProvider {
    func placeholder(in context: Context) -> ReadinessEntry {
        ReadinessEntry(date: Date(), score: 72, label: "Train hard", tint: .orange)
    }

    func getSnapshot(in context: Context, completion: @escaping (ReadinessEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ReadinessEntry>) -> Void) {
        // Content changes only when the phone pushes; refresh hourly as a safety net.
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        completion(Timeline(entries: [currentEntry()], policy: .after(next)))
    }

    private func currentEntry() -> ReadinessEntry {
        let snap = WatchSnapshot.loadFromAppGroup()
        return ReadinessEntry(
            date: Date(),
            score: snap?.readiness.score,
            label: snap?.readiness.label ?? "Open app",
            tint: snap?.readiness.moodColor ?? .gray
        )
    }
}

struct ReadinessComplicationView: View {
    @Environment(\.widgetFamily) var family
    let entry: ReadinessEntry

    var scoreText: String { entry.score.map(String.init) ?? "–" }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(entry.score ?? 0), in: 0...100) {
                Text("RDY")
            } currentValueLabel: {
                Text(scoreText).monospacedDigit()
            }
            .gaugeStyle(.accessoryCircular)
            .tint(entry.tint)

        case .accessoryInline:
            Text("Readiness \(scoreText) · \(entry.label)")

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Readiness \(scoreText)").font(.headline).monospacedDigit()
                Text(entry.label).font(.caption).foregroundStyle(entry.tint)
            }

        case .accessoryCorner:
            Text(scoreText)
                .font(.title2.bold())
                .monospacedDigit()
                .widgetLabel(entry.label)

        default:
            Text(scoreText).monospacedDigit()
        }
    }
}

@main
struct ReadinessComplication: Widget {
    let kind = "ReadinessComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ReadinessProvider()) { entry in
            ReadinessComplicationView(entry: entry)
        }
        .configurationDisplayName("Readiness")
        .description("Today's RoundFit readiness at a glance.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryInline,
            .accessoryRectangular,
            .accessoryCorner,
        ])
    }
}
