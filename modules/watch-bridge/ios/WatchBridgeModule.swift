import ExpoModulesCore
import Foundation
import WatchConnectivity

// Shared with the watchOS app + widget. Keep in sync with the JS/Swift constants.
private let kAppGroup = "group.co.roundfit.app"
private let kSnapshotKey = "watch.snapshot"
private let kSnapshotContextKey = "snapshot" // WCSession application-context key
private let kActionKey = "action"            // WCSession message/userInfo key

public class WatchBridgeModule: Module {
    private var bridge: WatchConnectivityBridge?

    public func definition() -> ModuleDefinition {
        Name("WatchBridge")

        // Emitted when the watch sends up a WatchAction (log water, start/end workout).
        Events("onAction")

        OnCreate {
            self.bridge = WatchConnectivityBridge { [weak self] json in
                self?.sendEvent("onAction", ["json": json])
            }
        }

        Function("isPaired") { () -> Bool in
            self.bridge?.isPaired() ?? false
        }

        Function("isReachable") { () -> Bool in
            self.bridge?.isReachable() ?? false
        }

        // Latest-wins push: stash in the App Group (so complications read it even when
        // the watch app is closed) AND set the WCSession application context.
        Function("pushSnapshot") { (json: String) in
            self.bridge?.pushSnapshot(json)
        }
    }
}

/// WCSession lives on an NSObject delegate; the Expo `Module` only forwards to it.
final class WatchConnectivityBridge: NSObject, WCSessionDelegate {
    private let onAction: (String) -> Void

    init(onAction: @escaping (String) -> Void) {
        self.onAction = onAction
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func isPaired() -> Bool {
        guard WCSession.isSupported() else { return false }
        return WCSession.default.isPaired
    }

    func isReachable() -> Bool {
        guard WCSession.isSupported() else { return false }
        return WCSession.default.isReachable
    }

    func pushSnapshot(_ json: String) {
        // App Group: durable, read by the watch app + complications without a live session.
        UserDefaults(suiteName: kAppGroup)?.set(json, forKey: kSnapshotKey)

        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        try? session.updateApplicationContext([kSnapshotContextKey: json])
    }

    // MARK: inbound actions (both delivery modes)

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let json = message[kActionKey] as? String { onAction(json) }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        if let json = userInfo[kActionKey] as? String { onAction(json) }
    }

    // MARK: required delegate lifecycle (iOS)

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate so a switched watch keeps working.
        WCSession.default.activate()
    }
}
