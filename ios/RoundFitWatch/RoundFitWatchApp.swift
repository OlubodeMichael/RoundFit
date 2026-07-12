import SwiftUI

@main
struct RoundFitWatchApp: App {
    @StateObject private var store = WatchConnectivityStore()

    var body: some Scene {
        WindowGroup {
            WatchRootView().environmentObject(store)
        }
    }
}

struct WatchRootView: View {
    @EnvironmentObject var store: WatchConnectivityStore

    var body: some View {
        if let snapshot = store.snapshot {
            RootPager(snapshot: snapshot)
        } else {
            ColdStartView()
        }
    }
}

/// A single vertical pager for every section. Flattened (no nested horizontal paging)
/// so a Digital Crown / vertical swipe always moves between pages — the nested layout
/// used to trap the vertical gesture once you swiped into a detail page.
struct RootPager: View {
    let snapshot: WatchSnapshot
    private var r: WatchSnapshot.Readiness { snapshot.readiness }
    private var e: WatchSnapshot.Energy { snapshot.energy }

    private func frac(_ a: Int, _ b: Int) -> Double { b > 0 ? Double(a) / Double(b) : 0 }

    var body: some View {
        TabView {
            // ── Recovery (score; tap it for the full metric breakdown) ──
            RecoveryScoreView(readiness: r, updatedAt: snapshot.updatedAt)

            // ── Coach ──
            if let coaching = snapshot.coaching {
                CoachView(coaching: coaching, tint: r.moodColor)
            }

            // ── Energy ──
            RingStatPage(
                tint: WatchTheme.calories,
                progress: frac(e.calorieGoal - e.caloriesRemaining, e.calorieGoal),
                icon: "flame.fill",
                centerValue: "\(abs(e.caloriesRemaining))",
                centerUnit: e.caloriesRemaining >= 0 ? "cal left" : "cal over",
                label: "Calories",
                footnote: "\(e.calorieGoal - e.caloriesRemaining) / \(e.calorieGoal)"
            )
            RingStatPage(
                tint: WatchTheme.protein,
                progress: frac(e.proteinGoal - e.proteinRemaining, e.proteinGoal),
                icon: "fork.knife",
                centerValue: "\(abs(e.proteinRemaining))",
                centerUnit: e.proteinRemaining >= 0 ? "g left" : "g over",
                label: "Protein",
                footnote: "\(e.proteinGoal - e.proteinRemaining) / \(e.proteinGoal)g"
            )

            // ── Activity (steps + calories burned) ──
            if let activity = snapshot.activity,
               activity.steps != nil || activity.caloriesBurned != nil {
                ActivityView(activity: activity)
            }

            // ── Water ──
            WaterView()

            // ── Workout ──
            WorkoutView()
        }
        .tabViewStyle(.verticalPage)
    }
}

struct ColdStartView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "iphone.and.arrow.forward")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Open RoundFit on your iPhone")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
