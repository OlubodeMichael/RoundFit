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
    /// Defer the heavy pager one beat so the initial scene commit stays under the
    /// 10s FrontBoard watchdog (watchOS kills us with 0x8BADF00D otherwise).
    @State private var showPager = false

    var body: some View {
        Group {
            if let snapshot = store.snapshot, showPager {
                RootPager(snapshot: snapshot)
            } else {
                ColdStartView()
            }
        }
        .onAppear {
            guard store.snapshot != nil else { return }
            DispatchQueue.main.async { showPager = true }
        }
        .onChange(of: store.snapshot != nil) { _, hasSnapshot in
            if hasSnapshot {
                DispatchQueue.main.async { showPager = true }
            } else {
                showPager = false
            }
        }
    }
}

private enum WatchPagerPage: Hashable {
    case today
    case recovery
    case sleep
    case coach
    case calories
    case protein
    case activity
    case water
    case workout
}

/// A single vertical pager for every section. Flattened (no nested horizontal paging)
/// so a Digital Crown / vertical swipe always moves between pages — the nested layout
/// used to trap the vertical gesture once you swiped into a detail page.
struct RootPager: View {
    let snapshot: WatchSnapshot
    @State private var page = 0

    private var r: WatchSnapshot.Readiness { snapshot.readiness }
    private var e: WatchSnapshot.Energy { snapshot.energy }

    private func frac(_ a: Int, _ b: Int) -> Double { b > 0 ? Double(a) / Double(b) : 0 }

    private var pages: [WatchPagerPage] {
        var list: [WatchPagerPage] = [.today, .recovery]
        if (r.sleepHours ?? 0) > 0 { list.append(.sleep) }
        if snapshot.coaching != nil { list.append(.coach) }
        list.append(contentsOf: [.calories, .protein])
        if let activity = snapshot.activity,
           activity.steps != nil || activity.caloriesBurned != nil {
            list.append(.activity)
        }
        list.append(contentsOf: [.water, .workout])
        return list
    }

    var body: some View {
        TabView(selection: $page) {
            ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
                // Only mount the current page and its neighbours — mounting every
                // dial / NavigationStack / water wave at once was blowing the budget.
                Group {
                    if abs(index - page) <= 1 {
                        pageView(item)
                    } else {
                        Color.clear
                    }
                }
                .tag(index)
            }
        }
        .tabViewStyle(.verticalPage)
    }

    @ViewBuilder
    private func pageView(_ item: WatchPagerPage) -> some View {
        switch item {
        case .today:
            TodayHeroView(snapshot: snapshot)
        case .recovery:
            RecoveryHeroView(readiness: r, updatedAt: snapshot.updatedAt)
        case .sleep:
            SleepHeroView(readiness: r)
        case .coach:
            if let coaching = snapshot.coaching {
                CoachView(coaching: coaching, tint: r.moodColor)
            }
        case .calories:
            RingStatPage(
                tint: WatchTheme.calories,
                progress: frac(e.calorieGoal - e.caloriesRemaining, e.calorieGoal),
                icon: "flame.fill",
                centerValue: "\(abs(e.caloriesRemaining))",
                centerUnit: e.caloriesRemaining >= 0 ? "cal left" : "cal over",
                label: "Calories",
                footnote: "\(e.calorieGoal - e.caloriesRemaining) / \(e.calorieGoal)"
            )
        case .protein:
            RingStatPage(
                tint: WatchTheme.protein,
                progress: frac(e.proteinGoal - e.proteinRemaining, e.proteinGoal),
                icon: "fork.knife",
                centerValue: "\(abs(e.proteinRemaining))",
                centerUnit: e.proteinRemaining >= 0 ? "g left" : "g over",
                label: "Protein",
                footnote: "\(e.proteinGoal - e.proteinRemaining) / \(e.proteinGoal)g"
            )
        case .activity:
            if let activity = snapshot.activity {
                ActivityView(activity: activity)
            }
        case .water:
            WaterView()
        case .workout:
            WorkoutView()
        }
    }
}

struct ColdStartView: View {
    var body: some View {
        ZStack {
            GlowBackdrop(tint: WatchTheme.calories, intensity: 0.12)

            VStack(spacing: 10) {
                // An empty dial, so even the waiting state is recognisably RoundFit.
                SegmentedDial(progress: 0, tint: WatchTheme.calories, size: 62) {
                    Image(systemName: "iphone.and.arrow.forward")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(WatchTheme.calories)
                }
                Text("Open RoundFit\non your iPhone")
                    .font(.system(size: 13, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
