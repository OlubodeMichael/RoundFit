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

/// Paged glance: Readiness → Energy → Water → Workout. Readiness leads because it's
/// the one number Apple doesn't already show.
struct WatchRootView: View {
    @EnvironmentObject var store: WatchConnectivityStore

    var body: some View {
        if let snapshot = store.snapshot {
            TabView {
                ReadinessView(readiness: snapshot.readiness, updatedAt: snapshot.updatedAt)
                EnergyView(energy: snapshot.energy)
                WaterView()
                WorkoutView(snapshot: snapshot)
            }
            .tabViewStyle(.verticalPage)
        } else {
            // Cold start: no snapshot has ever been pushed from the phone.
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
}
