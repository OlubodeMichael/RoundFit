import Foundation
import SwiftUI
import WatchConnectivity

/// The watch app's single source of truth. Reads the latest snapshot (App Group on
/// launch, live via WCSession application context), and sends actions back up —
/// `sendMessage` when the phone is reachable, otherwise a queued `transferUserInfo`
/// that delivers on reconnect. The phone dedups by action id, so a queued replay is safe.
final class WatchConnectivityStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published var snapshot: WatchSnapshot?
    /// Optimistic local water delta, cleared when the phone's authoritative total arrives.
    @Published var pendingWaterMl: Int = 0

    override init() {
        super.init()
        snapshot = WatchSnapshot.loadFromAppGroup()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    // MARK: derived display

    var displayWaterMl: Int {
        (snapshot?.water.currentMl ?? 0) + pendingWaterMl
    }

    // MARK: actions

    func logWater() {
        let cup = snapshot?.water.cupMl ?? 250
        pendingWaterMl += cup                       // optimistic — feels instant
        var action = WatchAction.now(type: "logWater")
        action.amountMl = cup
        send(action)
    }

    func startWorkout(_ pick: WatchSnapshot.QuickPick) {
        var action = WatchAction.now(type: "startWorkout")
        action.activityId = pick.id
        send(action)
    }

    func endWorkout() {
        send(WatchAction.now(type: "endWorkout"))
    }

    private func send(_ action: WatchAction) {
        guard let json = action.jsonString() else { return }
        let payload = [WatchConstants.actionKey: json]
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { [weak self] _ in
                // Delivery failed while "reachable" — fall back to the durable queue.
                self?.queue(payload)
            }
        } else {
            queue(payload)
        }
    }

    private func queue(_ payload: [String: Any]) {
        WCSession.default.transferUserInfo(payload)
    }

    // MARK: inbound snapshot

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        guard let json = applicationContext[WatchConstants.snapshotContextKey] as? String,
              let next = WatchSnapshot.decode(from: json) else { return }
        UserDefaults(suiteName: WatchConstants.appGroup)?.set(json, forKey: WatchConstants.snapshotKey)
        DispatchQueue.main.async {
            self.snapshot = next
            self.pendingWaterMl = 0 // authoritative total arrived — drop the optimistic delta
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}
}
