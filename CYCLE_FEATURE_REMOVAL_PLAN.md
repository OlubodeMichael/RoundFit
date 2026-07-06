# Cycle Feature — Disable-for-Launch Plan

**Status:** ✅ Implemented (pre-launch) — all code edits (Sections 3.A–G) applied behind `CYCLE_ENABLED = false`. Manual female-account QA still pending.
**Decision:** Ship without the menstrual-cycle feature. **Do not delete any code or components.**
We are *unwiring* the feature behind a single flag so it can be turned back on later with a one-line flip.

---

## 1. Goal & Principle

- Users should see **no trace** of cycle tracking anywhere in the app (onboarding, home, log, profile, readiness).
- All cycle code, components, context, utils, types, and backend calls **stay in the tree**, untouched except for the gate.
- Re-enabling later must be a **single flag flip** (plus verifying nothing drifted).

**Mechanism (chosen):** one central feature flag `CYCLE_ENABLED = false`, referenced at every entry point.
**Onboarding (chosen):** female users skip cycle **and** life-stage entirely → same flow as male (`Activity → Units`).

---

## 2. The Flag

Create `constants/features.ts` (new, tiny — this is config, not feature code):

```ts
// Master switches for features that are code-complete but intentionally
// not shipped yet. Flip to `true` to re-enable; see CYCLE_FEATURE_REMOVAL_PLAN.md.
export const CYCLE_ENABLED = false;
```

Everything below gates on `CYCLE_ENABLED`. Where an entry point already calls
`isCycleTrackingEnabled(sex)`, combine them: `CYCLE_ENABLED && isCycleTrackingEnabled(sex)`.

> Note: `isCycleTrackingEnabled()` in `context/cycle-context.tsx:146` stays as-is (it encodes the
> *female-only* rule, which we still want when the feature returns). We do **not** hollow it out.

---

## 3. Touch-Point Inventory & Tasks

### A. Onboarding — remove the cycle & life-stage steps from the flow — ✅ DONE

Female flow today: `activity → cycle-length → cycle-phase → life-stage → units`.
Target female flow: `activity → units` (identical to male).

| File | Change |
|---|---|
| `app/onboarding/activity.tsx:115` | Route Continue to `/onboarding/units` for **all** sexes (drop the `sex === 'female' ? cycle-length` branch). |
| `app/onboarding/activity.tsx:20` | `total` → constant `9` (was `female ? 12 : 9`). |
| `app/onboarding/goal.tsx:23` | `total` → `9`. |
| `app/onboarding/height-weight.tsx:36` | `total` → `9`. |
| `app/onboarding/units.tsx:71-74` | `step` → `7`, `total` → `9`, back route → `/onboarding/activity` for all sexes. |
| `app/onboarding/cycle-length.tsx` | **Leave file in place.** No longer reachable (routing bypasses it). |
| `app/onboarding/cycle-phase.tsx` | **Leave file in place.** No longer reachable. |
| `app/onboarding/life-stage.tsx` | **Leave file in place.** No longer reachable. |

Notes:
- These three screens stay registered/importable; they're simply unrouted.
- `cycleLength` / `cyclePhase` / `lifeStage` params are **not** sent to the backend at onboarding
  (verified: `reveal.tsx` only submits sex/age/height/weight/goal/activity). So dropping the steps
  has no payload impact.
- To re-enable: restore the two routing branches + the `female ? 12 : 9` totals, and the
  `units.tsx` back-route. (Keep these diffs small/greppable to make that easy.)

### B. Home screen — hide the cycle phase card — ✅ DONE

| File | Change |
|---|---|
| `app/(tabs)/index.tsx:897` | Gate render: `{CYCLE_ENABLED && isToday && isFemale && <CyclePhaseCard .../>}`. |

`CyclePhaseCard` (defined in the same file ~L415) and its styles stay as dead-but-present code.
`import { useCycle }` at L17 stays (still referenced by the gated card).

### C. Log tab — hide the Cycle log card + its screen — ✅ DONE

| File | Change |
|---|---|
| `app/(tabs)/log/index.tsx:49` | `const showCycleLog = CYCLE_ENABLED && isCycleTrackingEnabled(profile?.sex);` |

That single edit already gates: the refresh calls (L55, L81), the `buildCycleLogCardCopy` memo
consumption, and the card render (L250). No other change needed here.

| `app/(tabs)/log/_layout.tsx:20` | `<Stack.Screen name="cycle" />` — leave registered (harmless; route just isn't linked to). |
| `app/(tabs)/log/cycle.tsx` | Leave in place; unreachable via UI. |

### D. Profile tab — hide the Cycle Tracking row + its screen — ✅ DONE

| File | Change |
|---|---|
| `app/(tabs)/profile/index.tsx:144-145` | Wrap the `Cycle Tracking` `ProfileRow` in `{CYCLE_ENABLED && ( ... )}`. |
| `app/(tabs)/profile/_layout.tsx:14` | `<Stack.Screen name="cycle" />` — leave registered. |
| `app/(tabs)/profile/cycle.tsx` | Leave in place; unreachable via UI. |

### E. Readiness — stop applying cycle adjustments — ✅ DONE

The readiness engine adjusts HRV baseline and adds a cycle sub-score. Kill it at the **input builder**
so downstream math naturally drops it (single choke point):

| File | Change |
|---|---|
| `utils/build-readiness-input.ts:137-140` | Force `include_cycle: false` (e.g. `CYCLE_ENABLED && userSex === 'female' && cycle?.phase != null`). |

With `include_cycle === false`:
- `utils/readiness.ts:796` `cycleAdjustedBaseline` falls through to the raw baseline (no adjustment).
- `utils/readiness.ts:827` `cycleScore` becomes `null` and is excluded from the active-signal set/weighting.
- The `'cycle'` contributor row (L734, L848) won't surface because its score is null.

Leave `computeCycleScore`, `adjustHrvBaselineForCycle`, and the `CYCLE_HRV_FACTOR` table intact.
Update `__tests__/readiness.test.ts` only if a test asserts cycle-on behavior with the default input —
otherwise leave tests untouched (they document the still-present code path).

### F. Context / Provider — stop fetching cycle data — ✅ DONE

`CycleProvider` (`app/_layout.tsx:196`) stays mounted so `useCycle()` consumers don't crash, but it
should not hit the network when disabled.

| File | Change |
|---|---|
| `context/cycle-context.tsx:156` | `const isEnabled = CYCLE_ENABLED && isCycleTrackingEnabled(user?.sex);` |

Because L165/254/277/330 all branch on `isCycleTrackingEnabled(user?.sex)`, either:
- (preferred) also `&& CYCLE_ENABLED` in the local `isEnabled`/guards, **or**
- gate them via the same `isEnabled` value.

Net effect: no `/cycle/*` requests fire, `current/history/stats` stay empty, gated UI never renders.
`updateLifeStage` / `logPeriod` / `updateCycleLength` remain defined but unreachable from the UI.

### G. Cache invalidation — no action needed — ✅ DONE (no change)

`utils/cache-invalidation.ts:31,104` keep the `'cycle'` resource case. It's inert once nothing
enqueues cycle invalidations. Leaving it avoids a needless diff.

---

## 4. Explicitly Left Intact (do NOT touch)

- `context/cycle-context.tsx` (provider, hooks, API methods) — except the one `isEnabled` gate.
- `components/cycle/*` (all cards, screens, config).
- `components/home/CyclePhaseCard.tsx`, `components/home/WorkoutCard.tsx` cycle refs.
- `app/(tabs)/{log,profile}/cycle.tsx` route screens.
- `app/onboarding/{cycle-length,cycle-phase,life-stage}.tsx`.
- `utils/{cycle-phase,cycle-log-card-copy}.ts`, cycle logic in `utils/readiness.ts`.
- `hooks/use-cycle.ts`, `types/*` cycle types, `lib/posthog.ts` cycle events.
- Backend `/cycle/*` endpoints.

These stay compiling and shipping in the bundle (dead code), which is the intended trade-off for a
clean, reversible re-enable.

---

## 5. Verification Checklist

Manual, on a **female** test account (the only sex that ever saw cycle):
- [ ] Onboarding: `Activity → Units` directly; no cycle-length / cycle-phase / life-stage screens; progress bar reads `/9` and counts correctly with working back buttons.
- [ ] Home: no cycle phase card for female accounts.
- [ ] Log tab: no "Cycle" card; `/log/cycle` not linked anywhere.
- [ ] Profile: no "Cycle Tracking" row; `/profile/cycle` not linked anywhere.
- [ ] Readiness detail: no "Cycle phase" contributor; score composed only of sleep/HRV/training/nutrition/hydration.
- [ ] Network: no `/cycle/*` calls on login/home/log (check logs).
- [ ] Deep-link guard (optional): confirm nothing auto-navigates to a cycle route.
- [x] `npm test` green (136/136, 14 suites); no new `tsc` errors introduced by the flag edits (pre-existing errors in badges tests / style arrays / route types are unrelated). Manual runtime checks above still pending a female-account walkthrough.

---

## 6. Re-enabling Later

1. Set `CYCLE_ENABLED = true` in `constants/features.ts`.
2. Restore onboarding routing + progress totals (Section 3.A) — the only edits the flag can't cover, since they're structural navigation changes.
3. Re-run the Section 5 checklist to confirm no drift accumulated while the code sat dormant.
4. Re-validate backend `/cycle/*` (auth, RLS, adjusted-targets) before exposing.

---

## 7. Risks / Notes

- **Dormant code rot:** cycle code won't be exercised while off. Keep the touch-point edits small and greppable (search `CYCLE_ENABLED`) so re-enable is mechanical. Consider keeping the cycle unit tests running so the logic stays covered.
- **Life-stage data:** skipped in onboarding. It only ever fed the cycle adjusted-targets path (`/cycle/life-stage`), so no other feature loses input. If energy/BMR later wants menopause status, that's a fresh decision at re-enable time.
- **Bundle size:** dead cycle code still ships. Negligible for launch; acceptable per the "don't delete" decision.
