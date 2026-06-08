# Recovery Algorithm v2 — Implementation Plan

Improvements to the readiness/recovery system. The goal is higher accuracy,
better data integrity, and more useful, context-aware messaging — without
changing the core "weighted multi-pillar, score 0–100" shape that already works.

**Status:** implemented (all 8 items). Pending: unit tests — no test runner is
configured in the project yet (no `jest`/`vitest`), so the suggested tests for
`ewmaBaseline`, `rejectOutliers`, the ACR curve, hydration, and luteal decay are
not yet added.

---

## Current architecture (v1) — reference

- **Core:** `utils/readiness.ts` (`computeReadiness` + per-pillar scorers)
- **Inputs:** `utils/build-readiness-input.ts` (`buildReadinessInput`)
- **Weights & types:** `types/readiness.ts` (`PILLAR_WEIGHTS`)
- **Sleep curve:** `utils/sleep-quality.ts` (`sleepDurationScore`)
- **Baselines:** `context/recovery-context.tsx` (`fetchHealthBaselines`)
- **Trend:** `buildReadinessTrend` in `utils/readiness.ts`

**Pillars & weights (v1):** sleep 0.30, hrv 0.20, training_load 0.20,
nutrition 0.10, soreness 0.10, cycle 0.10. Final score = weighted average over
**active** pillars only (renormalized by active weight sum); requires ≥ 2 active
pillars.

---

## Priority order

| # | Change | Impact | Effort | Backend? |
|---|--------|--------|--------|----------|
| 1 | EWMA baseline + outlier rejection | Highest accuracy | Med | No |
| 2 | 48-hour nutrition window | Meaningful, quick | Low | No* |
| 3 | Soreness inference pillar gating | Data integrity | Low | No |
| 4 | Readiness trend direction indicator | High UX value | Low | No |
| 5 | Consecutive hard-day penalty | Safety | Low | No |
| 6 | ACR sweet-spot tightening | Refinement | Low | No |
| 7 | Hydration pillar | Adds value | Med | No* |
| 8 | Cycle luteal linear decay | Female users | Med | No |

\* needs an extra day / field already available client-side; no new API required.

---

## 1. EWMA baseline with outlier rejection

**Why:** A flat 30-day mean weights a bad reading three weeks ago the same as
yesterday's. EWMA gives recent readings more influence; outlier rejection stops
one night of bad sensor contact from shifting the baseline.

**Current** — `context/recovery-context.tsx:315` (`fetchHealthBaselines`):
flat `average()` of HRV and resting HR over the last 30 days.

**Target:**
1. Fetch the ordered 30-day series (already done via `/health/history?days=30`).
2. Reject outliers: compute rolling mean + std; drop any reading
   `> 2σ` from the mean before feeding the series in.
3. Compute EWMA over the cleaned series, oldest → newest:

```typescript
// α between 0.1 (slow/stable) and 0.2 (faster response). Start at 0.15.
ewma = α * todayHRV + (1 - α) * previousEwma   // seed with first valid reading
```

Apply the same to resting HR.

**Files:** `context/recovery-context.tsx` (replace `average()` calls). Add a
helper `utils/baseline.ts` exporting `ewmaBaseline(series, alpha)` and
`rejectOutliers(series, sigma)` so it's unit-testable and reusable.

**Notes:** computable entirely client-side from the existing ordered series — no
schema change. Need ≥ ~5 valid readings before trusting EWMA; below that, fall
back to the simple mean.

---

## 2. Nutrition: 48-hour weighted window

**Why:** A single day is noisy. Someone who badly under-ate two days ago but ate
well yesterday currently looks fine.

**Current** — `build-readiness-input.ts:93`: nutrition uses **yesterday's**
summary only.

**Target:** weighted average of the two prior days, yesterday heavier:

```typescript
nutritionScore = 0.65 * yesterdayScore + 0.35 * dayBeforeScore
```

If only one day exists, use it at full weight (no penalty for missing history).

**Files:**
- `build-readiness-input.ts`: add `dayBeforeSummary` to `BuildReadinessSources`;
  build a second `NutritionScoreInput`.
- `utils/readiness.ts`: either score both inputs and blend in `computeReadiness`,
  or add `computeNutritionScore48h(yesterday, dayBefore)`.
- Source of `dayBeforeSummary`: `recovery-context` / `use-recovery` — fetch the
  day-2 summary alongside yesterday's (same cache pattern).

---

## 3. Soreness inference pillar gating

**Why:** Inferred soreness currently counts toward the ≥ 2-pillar minimum, so a
user with no wearable and no manual log can get a score partly driven by a number
they never provided.

**Current** — `build-readiness-input.ts:100` always fills `soreness_level`
(manual → inferred). `computeReadiness` treats it as a normal active pillar.

**Target (choose one, prefer A):**
- **A — soft pillar:** inferred soreness counts toward the minimum **only if ≥ 3
  other pillars are active**. Track an `inferred` flag through the input so
  `computeReadiness` can apply the gate.
- **B — reduced weight when inferred:** weight 0.05 instead of 0.10 when the value
  is inferred rather than logged.

**Files:**
- `types/readiness.ts`: add `soreness_inferred: boolean` to `SorenessScoreInput`
  (or a parallel flag on `ReadinessInput`).
- `build-readiness-input.ts`: set the flag when falling back to
  `inferSorenessFromWorkouts`.
- `utils/readiness.ts`: apply the gate / dynamic weight in `computeReadiness`.

---

## 4. Readiness trend direction indicator

**Why:** A 72 trending down toward 55 should read differently than a 72 trending
up from 60. The trend series already exists; surface it.

**Target:**

```typescript
trendDirection = todayScore - avg(last5Days)
if (trendDirection < -8) append "Your readiness has been declining this week."
if (trendDirection >  8) append "You're recovering well this week."
```

**Files:**
- `utils/readiness.ts`: add `computeTrendDirection(history, todayScore)` returning
  `'rising' | 'falling' | 'steady'` + a message. Feed it the series from
  `buildReadinessTrend`.
- Surface in `components/recovery/*` (e.g. `RecoveryTrendHero` /
  `ReadinessWidget`) and append to `reason`/tips where the history is in scope
  (recovery screen / `use-recovery`).

**Notes:** `computeReadiness` itself has no history; either pass recent history in
or compute the indicator one level up where the trend is assembled.

---

## 5. Consecutive hard-day penalty

**Why:** The current `+1` inferred-soreness bump for back-to-back hard days is
barely detectable. Two hard days in a row is a real recovery risk.

**Current** — `build-readiness-input.ts:54`: `consecutiveBonus` of `+1` for a
hard day two days ago.

**Target:**

```typescript
if (consecutiveHardDays >= 2) sorenessInferred += 3
if (consecutiveHardDays >= 3) sorenessInferred += 5   // not additive with the +3
```

Count consecutive hard days ending yesterday. After **3** consecutive hard days,
the recommendation should bias toward **Rest** regardless of other pillars.

**Files:** `build-readiness-input.ts` (`inferSorenessFromWorkouts` → count the
streak instead of a single 2-days-ago check). Optional hard override in
`computeReadiness` / `recommendationFromScore`.

---

## 6. Training-load ACR sweet-spot tightening

**Why:** The current 0.8–1.3 band scoring 80–100 is wide; the score is
insensitive to meaningful load changes.

**Current** — `computeTrainingLoadScore` in `utils/readiness.ts:178`.

**Target:**

```
0.85–1.15 → 90–100 (optimal, peak at ~1.0)
0.70–0.85 → 70–89  (slightly undertrained)
1.15–1.30 → 65–79  (slightly overreaching)
< 0.70    → 55     (detraining)
> 1.30    → 20     (overreaching)
```

**Files:** `utils/readiness.ts` (`computeTrainingLoadScore` branch logic). Keep
the existing "+10 if rested yesterday and ACR > 1.3" nuance.

---

## 7. Hydration pillar (7th pillar)

**Why:** Water is already tracked. Dehydration affects HRV, energy, and
performance. Natural lightweight pillar.

**Target:** new pillar `hydration`, weight **0.05**, with the other weights
reduced to keep the total at 1.00. Proposed weights:

| pillar | v1 | v2 |
|--------|-----|-----|
| sleep | 0.30 | 0.28 |
| hrv | 0.20 | 0.20 |
| training_load | 0.20 | 0.18 |
| nutrition | 0.10 | 0.10 |
| soreness | 0.10 | 0.09 |
| cycle | 0.10 | 0.10 |
| **hydration** | — | **0.05** |

> Exact redistribution TBD; total must equal 1.00. (Active-pillar renormalization
> means this only matters when most pillars are present.)

**Scoring:**

```typescript
// ratio = logged_water / daily_target
ratio >= 0.9 → 100
ratio >= 0.7 → 70
ratio >= 0.5 → 45
else         → 20
```

**Files:**
- `types/readiness.ts`: add `'hydration'` to `ReadinessPillarId`, add weight,
  add `HydrationScoreInput`, labels/icons.
- `utils/readiness.ts`: `computeHydrationScore`, wire into `computeReadiness`,
  `buildFactors`, `buildTips`.
- `build-readiness-input.ts`: source logged water + `waterGoalMl` (profile).

**Notes:** uses **today's** water (intra-day), unlike yesterday-based nutrition.
Returns `null` until there's enough logging history to be meaningful.

---

## 8. Cycle pillar — luteal linear decay

**Why:** Luteal at a flat 70 dropping to 50 only in the last 7 days misses the
gradual PMS progression across the full luteal phase.

**Current** — `computeCycleScore` in `utils/readiness.ts:301`: luteal returns
`daysRemaining <= 7 ? 50 : 70`.

**Target:** linear decline across the luteal phase (typically 12–14 days):

```typescript
// daysIntoLuteal = currentDay - lutealStart
score = 70 - (daysIntoLuteal * 1.5)   // gradual decline
// floor at 45 in the final 3 days
```

Other phases unchanged: follicular 90, ovulation 85, menstrual 55.

**Files:**
- `utils/readiness.ts` (`computeCycleScore`): needs `daysIntoLuteal` (or derive
  from cycle length / `days_remaining`).
- `build-readiness-input.ts` / `cycle-context`: provide days-into-phase if not
  already available.

---

## Cross-cutting / rollout notes

- **Tests:** add `utils/__tests__` coverage for `ewmaBaseline`, `rejectOutliers`,
  the new ACR curve, hydration scoring, and luteal decay — these are pure
  functions and cheap to test.
- **Backward compatibility:** server-stored historical scores remain valid;
  v2 only changes how *new* scores are computed. Consider tagging stored scores
  with an `algo_version` so the trend can note a methodology change.
- **No required backend changes** for items 1–6 and 8 (all derivable from data
  already fetched). Item 7 needs the water figures wired into the input builder.
- **Phasing:** ship 1 → 2 → 3 → 4 first (accuracy + integrity + UX), then 5 → 6,
  then 7 → 8.
