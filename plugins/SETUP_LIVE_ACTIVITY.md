# Live Activity — one-time Xcode setup

After running `npx expo prebuild --clean`, you need to add the Widget Extension target manually in Xcode **once**. Subsequent prebuilds will preserve it.

## Steps

1. **Open the workspace** (not the .xcodeproj):
   ```
   open ios/RoundFit.xcworkspace
   ```

2. **Add the Widget Extension target:**
   - File → New → Target…
   - Pick **Widget Extension**, click Next
   - Product Name: `WorkoutLiveActivity`
   - Include Live Activity: **YES**
   - Embed in Application: **RoundFit**
   - Click Finish. When prompted to activate the scheme, click **Cancel** (we don't need a separate scheme).

3. **Replace the auto-generated stub files** with the real ones.
   Xcode created stub files inside `ios/WorkoutLiveActivity/`. The config plugin already overwrites them on every prebuild, but delete these from Xcode's project navigator (Right-click → Delete → **Remove Reference** only):
   - `WorkoutLiveActivity.swift` (the auto-generated stub)
   - `WorkoutLiveActivityLiveActivity.swift`
   - `WorkoutLiveActivityBundle.swift` (stub — we have our own)
   - `WorkoutLiveActivityAttributes.swift` (stub — we have our own)

4. **Add our real files to the target.** In Xcode's project navigator, right-click the `WorkoutLiveActivity` group → **Add Files to "RoundFit"…**. Select all of these from `ios/WorkoutLiveActivity/`:
   - `ActivityAttributes.swift`
   - `WorkoutLiveActivityWidget.swift`
   - `WorkoutLiveActivityBundle.swift`

   Make sure **only the WorkoutLiveActivity target** is checked (not the main RoundFit target).

5. **Add the same `ActivityAttributes.swift` to the main app target too** — Live Activities require both the app and the widget to know the type. In the Add Files dialog, also check the **RoundFit** target. Or after adding, select `ActivityAttributes.swift` in the navigator → File Inspector (right pane) → check both `RoundFit` and `WorkoutLiveActivity` under Target Membership.

6. **Set deployment target on the extension** to **16.1**. Select the project in the navigator → `WorkoutLiveActivity` target → General → Minimum Deployments → iOS 16.1.

7. **Build and run:** `npx expo run:ios`

## Verifying it works

Once running, tap **Start** on the Burn Coach Strip on the home screen. You should see:
- The strip switch to in-progress mode (timer + End button)
- A Lock Screen widget appear (lock the simulator with `Cmd+L` or device sleep)
- On iPhone 14 Pro+ simulators / devices, the Dynamic Island shows the activity

If nothing appears, check:
- iOS 16.1+ (simulator's OS version)
- Settings → Face ID & Passcode → Live Activities is enabled
- For frequent updates: Settings → RoundFit → Live Activities is enabled

## What to do after subsequent `prebuild --clean` runs

You'll need to repeat the manual Xcode steps **only** if you ran `expo prebuild --clean` (the destructive form). The plugin restores `ios/WorkoutLiveActivity/*.swift` files on every prebuild, but the Xcode target itself lives inside `ios/RoundFit.xcodeproj/project.pbxproj` which gets wiped on `--clean`. Avoid `--clean` unless absolutely necessary.

For non-destructive prebuild (just `npx expo prebuild`), the target persists.
