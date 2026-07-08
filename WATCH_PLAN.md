# Apple Watch — Implementation Plan

Status: **Planning.** Nothing built yet. This is the scoped, phased plan for a RoundFit watchOS
companion covering **readiness glance, water quick-log, workout selection + logging, and
calories/protein remaining**, plus a few additions worth shipping.

---

## 0. Principles (read this first, it decides everything below)

1. **watchOS cannot run React Native.** The watch app is **native SwiftUI**, the same skill your
   Live Activity (`modules/workout-live-activity`) already uses. There is no JS on the watch.
2. **Don't rebuild Apple.** The watch face already shows move/exercise/stand rings + HR. We show only
   what Apple *doesn't*: **readiness**, **calories/protein remaining**, **water**, and the **coach's
   directive**. Anything Apple already surfaces is noise.
3. **The phone is the source of truth.** The watch renders a small **snapshot** the phone pushes, and
   sends back **action messages** (log water, start workout). No business logic on the watch, no
   duplicate decision engine — it mirrors what `useDailyCoaching`, the nutrition plan, and
   `water-context` already compute.
4. **No auth on the watch (for launch).** Every write is relayed through the phone, which already
   holds the Bearer token. A standalone watch that talks to the backend directly (phone left at home)
   is a deliberate later phase — it needs a token on the watch and its own security review.
5. **HealthKit already ingests watch workouts.** If a user tracks with Apple's Workout app, it lands
   in RoundFit today via the existing HealthKit import. Our on-watch workout is about *branded,
   in-context* tracking + control, not data capture.

---

## 1. Architecture

```
┌─────────────────────────── iPhone (React Native) ───────────────────────────┐
│                                                                              │
│  useDailyCoaching ─┐                                                         │
│  useRecovery       ├─► useWatchSync ──► WatchBridge (Expo module) ──► WCSession
│  nutrition plan    │      (debounced push of WatchSnapshot)          │  App Group
│  water-context ────┘                                                 │  (shared defaults)
│                                                                       │
│  WatchBridge listener ◄── WCSession ◄── WatchAction (logWater / startWorkout / …)
│      └─► logWater() / startLiveWorkout() / logWorkout()  (existing paths, dedup by id)
└──────────────────────────────────────────────────────────────────────────────┘
                                  ▲  snapshot down / actions up
┌──────────────────────────── Apple Watch (SwiftUI) ───────────────────────────┐
│  Complications (WidgetKit) ─ read snapshot from App Group                     │
│  Glance app       ─ Readiness · Energy · Water(+1) · Workout                  │
│  Smart Stack widget ─ readiness + calories remaining                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Watch target:** added with **`@bacons/apple-targets`** (config plugin) + `expo prebuild`. This creates
a real watchOS app + WidgetKit extension target in the Xcode project, in the same bare/native lane your
`apple-llm` and `workout-live-activity` modules already live in.

**Transport:** a custom Expo module **`modules/watch-bridge`** wrapping `WCSession` (mirror the structure
of `modules/workout-live-activity`). Chosen over `react-native-watch-connectivity` for consistency with
the existing hand-rolled modules and to avoid an unmaintained dependency. (The library is a viable
faster path if we want it.)

**Shared storage:** an **App Group** container. WCSession writes the latest snapshot into shared
UserDefaults; the app, complications, and Smart Stack widget all read from there — identical to how
Live Activities share state. This is what lets complications refresh without the app being open.

---

## 2. Data contracts

### 2.1 `WatchSnapshot` — phone → watch (latest-wins, `WCSession.updateApplicationContext`)

```ts
interface WatchSnapshot {
  schema: 1;
  updatedAt: string;            // ISO — for staleness / "as of" label
  date: string;                 // YYYY-MM-DD, client-local day

  readiness: {
    score: number | null;       // 0–100, null at cold start
    directive: 'rest' | 'light' | 'moderate' | 'train_hard' | null;
    label: string;              // "Train hard" | "Rest up" — from the decision
    mood: 'calm' | 'alert' | 'energized' | 'recovery'; // moodFromDirective()
  };

  energy: {
    caloriesRemaining: number;  // budget − eaten
    calorieGoal: number;
    proteinRemaining: number;   // target − consumed (floored at 0 for display)
    proteinGoal: number;
  };

  water: {
    currentMl: number;
    goalMl: number;
    cupMl: number;              // increment step for the +1 button (user's cup size)
  };

  workout: {
    active: boolean;            // is a phone-tracked session live right now
    activityId?: string;
    label?: string;
    startedAt?: string;         // ISO
    caloriesBurned?: number;
  };

  quickPicks: Array<{           // top activities for on-watch selection
    id: string;                 // workout-catalog id
    label: string;
    sfSymbol: string;           // watch uses SF Symbols, not Ionicons
    mode: 'strength' | 'cardio';
  }>;
}
```

Sourced entirely from existing state: `useDailyCoaching().decision` (readiness/directive/mood),
`mealGoal − totalCalories` and the nutrition plan (energy), `water-context` (`totalMl`/`goalMl`),
`use-workout-live-activity` (workout.active), and `getBurnCatalogEntries()` (quickPicks).

### 2.2 `WatchAction` — watch → phone (`sendMessage` if reachable, else `transferUserInfo` queued)

```ts
type WatchAction =
  | { id: string; ts: string; type: 'logWater'; amountMl: number }
  | { id: string; ts: string; type: 'startWorkout'; activityId: string; calorieGoal?: number }
  | { id: string; ts: string; type: 'endWorkout' }
  | { id: string; ts: string; type: 'logWorkout';   // retroactive quick-log of a finished activity
      activityId: string; durationMin: number };
```

- **`id`** is a UUID minted on the watch. The phone keeps a **persisted `processedIds` set** (capped,
  e.g. last 200 in AsyncStorage) and **ignores duplicates** — so a `transferUserInfo` replay after
  reconnect never double-logs.
- **`ts`** lets the phone drop actions older than "today" on delivery (a queued water tap from
  yesterday shouldn't land on today's total).

---

## 3. Surfaces (what the user sees)

| Surface | Content | Tech |
|---|---|---|
| **Complication — Readiness** (primary) | `72` + mood color + directive word | WidgetKit timeline, reads App Group |
| **Complication — Calories left** (alt) | `1,240 left` | WidgetKit |
| **Smart Stack widget** | readiness + calories remaining | WidgetKit |
| **App: Readiness view** | score, directive label, mascot mood glyph, "as of" time | SwiftUI |
| **App: Energy view** | calories remaining ring, protein remaining | SwiftUI |
| **App: Water view** | `5 / 8 cups`, big **+1** button, optimistic | SwiftUI + WatchAction |
| **App: Workout view** | quick-pick list → **Start**; live state + **End** when active | SwiftUI + WatchAction |

Watch uses **SF Symbols** (not your Ionicons) — `quickPicks.sfSymbol` carries the mapped symbol name.
Mascot on the watch is a **static per-mood glyph/asset**, not the animated component (battery + no RN).

---

## 4. Phases

### Phase 0 — Foundation + Readiness glance (read-only) 🟡 phone side DONE
The whole spine. Everything else is incremental after this.
- [x] **Contracts** — `types/watch.ts` (`WatchSnapshot` / `WatchAction`).
- [x] **Pure snapshot builder** — `utils/watch-snapshot.ts` (`buildWatchSnapshot`, mood/label/SF-symbol maps, `watchSnapshotFingerprint`). Tested (`__tests__/watch-snapshot.test.ts`).
- [x] **Idempotency guard** — `utils/watch-action-dedup.ts` (id dedup + stale-day drop, capped window). Tested.
- [x] **JS bridge interface** — `modules/watch-bridge/src/index.ts` (`pushWatchSnapshot`, `addWatchActionListener`, `isWatchPaired/Reachable`), no-ops until the native module exists.
- [x] **Sync hook** — `hooks/use-watch-sync.ts` builds + fingerprint-gates the snapshot push and applies inbound actions (water wired; workout stubbed for Phase 2). Includes **calories + protein remaining + water** from day one. *Not yet mounted at root.*
- [x] **Native code written** (hand-add-in-Xcode path): Swift `WatchBridge` WCSession module (`modules/watch-bridge/ios/`), watchOS app (`watch/WatchApp/*` — Readiness/Energy/Water/Workout), shared Codable model (`watch/Shared/`), **Readiness complication** (`watch/Widget/`).
- [ ] **Xcode wiring (needs Mac):** App Group `group.com.michaelolu.roundfit`, add watch app + widget targets, `pod install`, file target membership — full steps in `watch/WATCH_XCODE_SETUP.md`.
- [ ] Mount `useWatchSync()` once at the app root (step 5 of the setup doc).
- **Exit:** raise wrist → readiness + calories + protein + water render, refreshing within seconds of a phone change.

### Phase 1 — Water quick-log (first write path) ⏳
- [ ] Watch **+1** button → `WatchAction{logWater, amountMl: cupMl, id}`. **Optimistic** local increment.
- [ ] Phone listener maps → existing `water-context.logWater(amountMl)`; **dedup by id**; push fresh snapshot back so the watch reconciles to the authoritative total.
- [ ] Offline: `transferUserInfo` queue + FIFO delivery on reconnect; drop stale-day actions by `ts`.
- **Exit:** tapping +1 on the watch (phone in pocket *and* phone asleep) reliably logs exactly once and reflects on both devices.

### Phase 2 — Workout selection + start/stop (remote-control the phone) ⏳
Reuses the **existing iPhone burn Live Activity** — the watch is a remote, not an independent tracker.
- [ ] Snapshot carries `quickPicks` (from `getBurnCatalogEntries()`), and live `workout.active` state.
- [ ] Watch workout view: pick an activity → `WatchAction{startWorkout, activityId, calorieGoal}` → phone calls the existing `handleBurnLiveStart` path (starts the Live Activity + workout session).
- [ ] Watch shows the live session (label, elapsed, calories) from the snapshot; **End** → `WatchAction{endWorkout}` → phone `handleBurnEnd`.
- [ ] Retroactive **`logWorkout`** action for a finished activity (duration picker on watch) → existing `useWorkouts.logWorkout`.
- **Caveat:** because the *phone* tracks, the session needs the phone present (gym/home use). True phone-free tracking is Phase 3.
- **Exit:** start/stop a burn workout entirely from the wrist; it appears on the phone home + logs on end.

### Phase 3 — Standalone on-watch workout (`HKWorkoutSession`) 🔮 post-launch
The heavy, genuinely-native piece. Justified only by the **"leave phone at home"** use case.
- [ ] watchOS `HKWorkoutSession` + `HKLiveWorkoutBuilder`: live HR / calories / duration on the wrist, in-progress state, water-lock, background execution.
- [ ] Save `HKWorkout` on end; reconcile back into RoundFit via the existing HealthKit import when reconnected.
- [ ] Optional: stream live to the **iPhone Live Activity** you already have.
- **Note:** highest-stakes feature — must be data-loss-proof and battery-safe or users revert to Apple's. Do it only when phone-free tracking is a proven priority.

### Phase 4 — Polish 🔮
- [ ] Complication families (corner/circular/rectangular) + **Always-On Display** dimmed variants.
- [ ] Smart Stack widget relevance hints (surface readiness in the morning, water in the afternoon).
- [ ] Accessibility (VoiceOver labels, Dynamic Type), reduce-motion.
- [ ] Snapshot staleness handling ("as of 2h ago" when the phone hasn't pushed recently).

---

## 5. Additions worth shipping (the "whatever you think" part)

- **Morning coaching haptic.** When the daily coaching directive is ready, fire a **wrist haptic +
  short glance** ("Rest up today") — reuse the existing daily-insight delivery. High delight, low cost;
  it's the reason to keep the watch app on the face.
- **Streak complication (optional).** A small `🔥 12` complication from the existing streak — cheap,
  motivating, and uniquely yours.
- **Complication tap → deep-link** into the matching app view (readiness complication opens readiness).
- **Explicitly NOT on the watch:** food logging / calorie entry (needs search — too heavy for the
  wrist), macros charts, history/trends. Calories & protein stay **read-only** on the watch.

---

## 6. Cross-cutting concerns

- **Consistency:** optimistic UI on the watch + authoritative reconcile from the next snapshot; never
  make a tap wait for the round-trip.
- **Dedup / idempotency:** every write action carries a UUID; phone keeps a capped processed-id set.
- **Staleness:** snapshot `updatedAt` drives an "as of" label; complications show last-known, never blank.
- **Battery:** static mascot glyphs (no animation), debounced snapshot pushes, WidgetKit timelines (not polling).
- **Security:** no token on the watch for launch; all writes relayed through the authenticated phone.
  Phase 3 standalone networking gets its own review (token storage in Keychain, scope-limited).
- **Testing:** needs a **physically paired Apple Watch** — the simulator's WCSession + HealthKit
  coverage is partial and unreliable for workout sessions.
- **App Store:** the watch app ships **inside the same iOS submission** (no separate review), but adds
  its own privacy-usage strings (HealthKit on watch for Phase 3) and screenshots.

---

## 7. Recommended launch cut

**Ship Phase 0 + Phase 1** for v1 (readiness glance + calories/protein + water quick-log), plus the
**morning coaching haptic**. That's a coherent, genuinely useful watch app — *one thing to look at, one
thing to tap* — built almost entirely from data and paths you already have.

**Phase 2** (workout remote-control) is a strong fast-follow if the watch-target foundation lands
comfortably before the launch freeze. **Phase 3** (standalone `HKWorkoutSession`) is explicitly
post-launch. Do **not** let the watch delay the existing launch blockers (RevenueCat, legal, RLS,
crash reporting).

---

## 8. New files / targets (inventory)

**Phone (RN):**
- `modules/watch-bridge/` — Expo module wrapping WCSession (clone `workout-live-activity` structure).
- `hooks/use-watch-sync.ts` — builds + debounces `WatchSnapshot`, registers the action listener.
- `utils/watch-snapshot.ts` — pure builder `buildWatchSnapshot(sources): WatchSnapshot` (unit-testable).
- `utils/watch-action-dedup.ts` — processed-id set (AsyncStorage), pure + tested.
- `types/watch.ts` — `WatchSnapshot` / `WatchAction`.

**Watch (SwiftUI, via `@bacons/apple-targets`):**
- watchOS app target: Readiness / Energy / Water / Workout views + `WCSessionDelegate`.
- WidgetKit extension: Readiness + Calories complications, Smart Stack widget.
- App Group shared-defaults reader/writer.

---

## 9. Open questions
1. Cup size for the water **+1** — fixed 250 ml, or the user's configured cup (`cupMl` in snapshot)?
2. Phase 2 workout list — top N burn activities only, or the full catalog scrolled on the watch?
3. Is **phone-free workout tracking** (Phase 3) a real target user for RoundFit, or is remote-control
   (Phase 2) enough? This decides whether Phase 3 ever happens.
4. Watch mascot — a static per-mood glyph, or skip the mascot on the watch and lead with the number?
