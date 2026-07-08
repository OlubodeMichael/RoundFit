# Apple Watch — Xcode setup (hand-add)

The RN/phone side is already written and tested. This wires the **native** half: the
`WatchBridge` Expo module (phone), the watchOS app, and the readiness complication. Do
these in order on your Mac with Xcode. App Group id used throughout:
**`group.com.michaelolu.roundfit`**.

---

## 1. App Group (once, in the Apple Developer portal + Xcode)
1. developer.apple.com → Identifiers → App Groups → **+** → `group.com.michaelolu.roundfit`.
2. In Xcode, select the **main app target** (RoundFit) → Signing & Capabilities → **+ Capability → App Groups** → check `group.com.michaelolu.roundfit`.
   - This edits `ios/RoundFit/RoundFit.entitlements` + `project.pbxproj` — **commit those**.

## 2. Install the WatchBridge native module (phone side)
The Swift module already exists at `modules/watch-bridge/`. Expo autolinks local modules on pod install:
```bash
npx pod-install        # or: cd ios && pod install
```
Verify `WatchBridgeModule` appears in the Pods. (SourceKit's "No such module 'ExpoModulesCore'"
warnings disappear after this — same as `apple-llm`.)

## 3. Add the watchOS App target
1. Xcode → **File → New → Target → watchOS → App**.
   - Product name: **RoundFit Watch** · Interface: **SwiftUI** · Language: **Swift**.
   - Bundle id: `com.michaelolu.roundfit.watchkitapp` · Embed in the RoundFit iOS app when prompted.
2. **Delete the auto-generated `@main` App file** Xcode created for the watch target — we provide our own (`RoundFitWatchApp.swift`). Keep only one `@main` per target.
3. Add these files to the **watch app target** (drag in, "Copy items if needed" off — reference in place):
   - `watch/Shared/WatchSnapshotModels.swift`
   - `watch/WatchApp/RoundFitWatchApp.swift`
   - `watch/WatchApp/WatchConnectivityStore.swift`
   - `watch/WatchApp/WatchViews.swift`
4. Watch app target → Signing & Capabilities → **+ App Groups** → `group.com.michaelolu.roundfit`.

## 4. Add the Widget Extension (complication)
1. **File → New → Target → watchOS → Widget Extension**.
   - Product name: **RoundFit Watch Widget** · uncheck "Include Live Activity" · bundle id `com.michaelolu.roundfit.watchkitapp.widget`.
2. **Delete the template's `@main` widget file** — `ReadinessComplication.swift` is our `@main`.
3. Add to the **widget target**:
   - `watch/Widget/ReadinessComplication.swift`
   - `watch/Shared/WatchSnapshotModels.swift`  ← same shared file, also a member of this target.
4. Widget target → Signing & Capabilities → **+ App Groups** → `group.com.michaelolu.roundfit`.

## 5. Mount the sync hook (phone)
Add `useWatchSync()` once, high in the tree (inside the data providers), e.g. in `app/_layout.tsx`
or a small mounted component:
```tsx
import { useWatchSync } from '@/hooks/use-watch-sync';
function WatchSyncMount() { useWatchSync(); return null; }
// …render <WatchSyncMount /> inside the providers.
```

## 6. Build & test (needs a physically paired Apple Watch)
- Run the iOS app on the paired iPhone; open the home screen so `useWatchSync` pushes a snapshot.
- Run the **RoundFit Watch** scheme on the watch.
- **Readiness** page shows the score/mood; **Water** page → **+1** increments optimistically and
  the phone's `water-context.logWater` fires (check the iPhone water total updates).
- Add the **Readiness** complication to a watch face → it shows the score from the App Group.
- Offline check: put the phone in Airplane mode, tap **+1** twice, restore → exactly one net delta
  per tap lands (phone dedups by action id).

---

## Notes / gotchas
- **One `@main` per target.** The most common build error here is two `@main` types because the
  Xcode templates ship their own — delete them (steps 3.2 and 4.2).
- **Shared file membership.** `WatchSnapshotModels.swift` must belong to *both* the watch app and
  the widget target (target membership checkboxes in the File inspector).
- **App Group on all three targets** (iOS app, watch app, widget) — if the id differs anywhere, the
  complication reads nothing.
- **Committed `ios/`.** Adding targets + capabilities rewrites `project.pbxproj` and entitlements;
  that's expected — commit it. Avoid `expo prebuild --clean` afterward (it would drop the hand-added
  targets).
- Workout **start/end** actions reach the phone but are **stubbed** in `use-watch-sync.ts`
  (Phase 2) — wire them to the burn Live Activity when you pick that up.
