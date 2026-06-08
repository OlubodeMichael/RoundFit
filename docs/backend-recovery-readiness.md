# Backend: Recovery & Readiness (RIS)

The mobile app computes readiness client-side from HealthKit, check-ins, workouts, nutrition, and cycle data. The API should persist the same scores when handling recovery routes.

## Canonical algorithm

Import from the shared modules (copy into your API repo if needed):

- `utils/readiness.ts` — scoring engine (`computeReadiness`, pillar helpers)
- `types/readiness.ts` — `ReadinessInput`, `ComputedReadiness`, and related types
- `utils/build-readiness-input.ts` — merges DB rows into `ReadinessInput`

## Endpoints

### `POST /recovery/log`

1. Upsert `recovery_logs` for the user/date.
2. Load inputs for `buildReadinessInput`:
   - Today's `recovery_logs` + `health_data`
   - Today's `check_ins`
   - Yesterday's `daily_summary` (nutrition pillar)
   - Last 7 days `workouts`
   - `cycle_logs` / user cycle fields (female users)
   - 30-day HRV / resting HR averages from `health_data`
3. Call `computeReadiness(input)`.
4. If result is non-null, insert into `readiness_scores`:

```json
{
  "score": 74,
  "recommendation": "Moderate",
  "reason": "Sleep was short (5.5h) and HRV is below your baseline."
}
```

5. Return `{ data: { ...recoveryLog, readiness: { score, recommendation, reason, created_at } } }`.

### `GET /recovery/readiness`

Return the latest `readiness_scores` row for today (or most recent).

### `GET /recovery/readiness/history?days=7`

Return `{ data: [{ date, score }, ...] }` for the trend chart.

### `GET /health/history?days=30`

Return `{ data: [{ date, hrv, resting_heart_rate, sleep_hours, ... }] }` for client-side baselines.

## Recommendation thresholds

| Score | `recommendation` |
|-------|------------------|
| 85–100 | Train hard |
| 65–84 | Moderate |
| 40–64 | Light workout |
| 0–39 | Rest |

## Minimum data

`computeReadiness` returns `null` when fewer than **2 pillars** have data. Do not write a `readiness_scores` row in that case.

## Pillar weights

| Pillar | Weight |
|--------|--------|
| Sleep | 30% |
| HRV | 20% |
| Training load | 20% |
| Nutrition | 10% |
| Soreness / energy | 10% |
| Cycle (female only) | 10% |

Inactive pillars have their weight redistributed proportionally among active pillars.
