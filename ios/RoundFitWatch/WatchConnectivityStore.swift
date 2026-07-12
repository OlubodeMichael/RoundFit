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
    /// Optimistic "a workout is starting" flag so the live view appears on the wrist
    /// instantly, before the phone's snapshot round-trips back.
    @Published var pendingWorkoutStart = false
    /// Optimistic pause/resume override — reflects the tap immediately, cleared once the
    /// phone's snapshot confirms the same state.
    @Published var pendingPaused: Bool? = nil
    /// Optimistic "ending" flag so End dismisses the live view instantly.
    @Published var pendingWorkoutEnd = false

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

    /// Show the live-workout view when the phone confirms one is active OR we optimistically
    /// just started one — but hide it instantly once the user taps End.
    var showWorkoutLive: Bool {
        if pendingWorkoutEnd { return false }
        return snapshot?.workout.active == true || pendingWorkoutStart
    }

    /// Paused state to render — the optimistic override if the user just tapped, else the
    /// phone's authoritative value.
    var displayPaused: Bool {
        pendingPaused ?? (snapshot?.workout.paused == true)
    }

    // MARK: actions

    func logWater(_ amountMl: Int) {
        pendingWaterMl += amountMl                  // optimistic — feels instant
        var action = WatchAction.now(type: "logWater")
        action.amountMl = amountMl
        send(action)
    }

    func startWorkout(_ pick: WatchSnapshot.QuickPick) {
        // One live session at a time — ignore taps while a workout is starting or running.
        guard !showWorkoutLive else { return }
        pendingWorkoutStart = true
        // Safety timeout: if the phone never confirms, drop the optimistic view.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            if self?.snapshot?.workout.active != true { self?.pendingWorkoutStart = false }
        }
        var action = WatchAction.now(type: "startWorkout")
        action.activityId = pick.id
        send(action)
    }

    func pauseWorkout() {
        pendingPaused = true                        // optimistic — reacts instantly
        send(WatchAction.now(type: "pauseWorkout"))
    }

    func resumeWorkout() {
        pendingPaused = false                       // optimistic
        send(WatchAction.now(type: "resumeWorkout"))
    }

    func endWorkout() {
        pendingWorkoutEnd = true                    // optimistic — dismisses the live view now
        pendingWorkoutStart = false
        pendingPaused = nil
        send(WatchAction.now(type: "endWorkout"))
        // Safety: if the phone never confirms the end, allow the live view back.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            if self?.snapshot?.workout.active == true { self?.pendingWorkoutEnd = false }
        }
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
            if next.workout.active {
                self.pendingWorkoutStart = false // real live state now drives the view
            } else {
                self.pendingWorkoutEnd = false   // workout ended — optimistic end resolved
            }
            // Clear the pause/resume override once the phone confirms the same state.
            if let pending = self.pendingPaused, next.workout.paused == pending {
                self.pendingPaused = nil
            }
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}
}
