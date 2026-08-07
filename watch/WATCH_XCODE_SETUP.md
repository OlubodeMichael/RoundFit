# Apple Watch — Xcode setup

App Group used throughout: **`group.co.roundfit.app`**. Native watch sources live in
**`ios/RoundFitWatch/`** (this is the canonical location the Xcode target compiles from).

## ✅ Done (automated via the `xcodeproj` gem + verified with `xcodebuild`)
- App Group added to **both** iOS entitlements (`RoundFit.entitlements` Debug + `RoundFitRelease.entitlements`) — they were missing/empty.
- `WatchBridge` native module installed (`pod install`).
- Cleaned up the duplicate/legacy watch targets the New-Target dialog left behind.
- Created the modern single-target watchOS app **`RoundFitWatch`**:
  - bundle id `co.roundfit.app.watchkitapp`, team set, `WKApplication=YES`, `WKCompanionAppBundleIdentifier=co.roundfit.app`, App Group entitlement, watchOS 10 deployment.
  - Source files added: `WatchSnapshotModels`, `RoundFitWatchApp`, `WatchConnectivityStore`, `WatchViews`.
  - Embedded in the RoundFit iOS app ("Embed Watch Content") + build dependency.
  - **`xcodebuild ... RoundFitWatch ... BUILD SUCCEEDED`** — compiles clean.
- `useWatchSync()` mounted at the app root (`app/_layout.tsx`, gated on authenticated).

## ✅ Widget Extension (readiness complication) — DONE (scripted)
`RoundFitWatchWidget` app-extension target created: `ios/RoundFitWatchWidget/` (`ReadinessComplication.swift`
+ shared `WatchSnapshotModels.swift` membership + `Info.plist` widgetkit-extension point + App Group
entitlement), embedded in the **RoundFitWatch** app. Builds clean alongside the watch app.

## ⏳ Remaining

### B. Build & test (needs a physically paired Apple Watch)
1. Run the iOS app on the paired iPhone; open the home screen so `useWatchSync` pushes a snapshot.
2. Run the **RoundFitWatch** scheme on the watch.
3. **Readiness** page shows the score/mood; **Water** page → **+1** increments optimistically and the iPhone water total updates (via `water-context.logWater`).
4. Add the **Readiness** complication to a watch face (after step A).
5. Offline check: iPhone in Airplane mode, tap **+1** twice, restore → exactly one net delta per tap (phone dedups by action id).

## Notes
- Workout **start/end** actions reach the phone but are **stubbed** in `hooks/use-watch-sync.ts` (Phase 2) — wire to the burn Live Activity when you pick that up.
- Don't run `expo prebuild --clean` — it would drop the hand-added targets. The watch target now lives in the committed `ios/` project.
