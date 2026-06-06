# Sleep log fix plan

Two distinct bugs in the manual sleep-log path (`hooks/use-sleep-log.ts` → `performSave`), both rooted in the same code doing too much:

1. **Date mismatch** — a manual sleep log for "today" is written under one date and read back under another, so it doesn't persist on the screen, the "log sleep" modal re-prompts, and it's missing from insights.
2. **Request explosion** — one save fires ~17 requests (≈3 full recovery refreshes + 2 health syncs) because three overlapping refresh mechanisms + a redundant POST all re-fetch data the save response already returned.

Follow-on to [`mutation-response-write-through-plan.md`](./mutation-response-write-through-plan.md) — same write-through principle applied to `/recovery/log`.

---

## Bug 1 — Date mismatch (data not persistent / modal re-prompts / missing from insights)

### Root cause

The sleep screen works in **sleep-date** space — `today = localSleepDateString()` (`utils/sleep-date.ts`), which rolls over at **06:00** (before 6 AM, "today" = previous calendar day). But the save sends **no date for today**:

```
// utils/sleep-log-calculations.ts:252,258
date: input.isToday ? undefined : input.activeDate
```

That `undefined` is then resolved **three different ways**, none of which use the sleep date:

| Place | Resolves to | Ref |
|---|---|---|
| Cache write | `input.date ?? getLocalDateString()` (calendar) | `recovery-context.tsx:552` |
| Invalidation | `notifyTodayDataChanged('recovery')` with no date → `getLocalDateString()` | `recovery-context.tsx:591`, `cache-invalidation.ts:63` |
| Backend | server stamps "today" via UTC | (backend, known UTC-date pitfall) |

The screen **reads** with `fetchRecoveryByDate(activeDate = sleepDate)` → key `recovery-today:<sleepDate>`. When sleep-date ≠ calendar-date (00:00–06:00, or any UTC offset), write and read keys diverge.

### Symptoms it explains

- **Not persistent** — read key `recovery-today:<sleepDate>` misses the value written under `<calendarDate>` → `recoveryForDate` empty → form resets.
- **Modal re-prompts** — `recoveryForDate` empty + `hkSleep` null → no-sleep modal re-fires (`use-sleep-log.ts:173-179`).
- **Missing from insights** — insights/weekly caches invalidated for the calendar week, not the sleep week; backend may store under the UTC date → wrong day.

### Fix ✅ Done (PR1)

1. ✅ **Always send the explicit sleep date.** `buildSleepSavePayload` now sends `input.activeDate` for both `recoveryBody.date` and `healthBody.date` (dropped the `isToday ? undefined`).
2. ✅ **Thread the date through invalidation.** `logRecovery` now calls `notifyTodayDataChanged(user.id, 'recovery', logDate)`.
3. ✅ **Harden the modal.** No-sleep modal now suppresses when `hkSleep` **or** a recovery log with `sleep_hours > 0` exists (`use-sleep-log.ts`).

### Done when
- [x] `buildSleepSavePayload` / `logRecovery` / modal updated; typechecks clean.
- [ ] (verify on device) Logging sleep before 6 AM persists after navigating away and back.
- [ ] (verify on device) The "log sleep" modal does not re-appear once sleep is logged.
- [ ] (verify on device) Logged sleep appears on the correct day in weekly insights.

---

## Bug 2 — Request explosion (~17 requests per save)

### Root cause

`performSave` (`hooks/use-sleep-log.ts:333-351`) runs four operations, three of which overlap:

```
1. logRecovery(..., { notifyListeners: true })   // POST /recovery/log + notify('recovery')
2. health.syncHealth(payload.healthBody)          // POST /health/sync  + notify('health')
3. health.refresh()                               // fetchToday(true) + syncFromDevice(true) → POST /health/sync #2
4. refreshRecovery({ force: true })               // explicit full recovery refresh
```

Each triggers force-refetches; the recovery trio (`recovery/today`, `recovery/readiness`, `recovery/readiness/history`) and `health/history` each fire ~3×, plus 2× `health/sync` and 1× `summary/daily`.

The redundancy:

1. **Triple refresh** — `logRecovery` already fires `notify('recovery')` (which makes the recovery context refresh itself). `performSave` *also* calls `refreshRecovery({force:true})` **and** `health.refresh()`; and `syncHealth`'s `notify('health')` triggers *another* recovery refresh. Same data, ~3×.
2. **Redundant health POST (for storage)** — `POST /recovery/log` **already mirrors sleep into `health_data`** on the backend (`use-sleep-log.ts:338`). And both the HealthKit path (`/health/sync`) and the manual path (`/recovery/log`) write sleep into `health_data` server-side — verified in the backend controllers. So the separate `health.syncHealth` POST is duplicate *storage* work; `health.refresh()` adds a second.
3. **It's unnecessary anyway** — `POST /recovery/log` **returns the saved log + readiness**, and `logRecovery` already **write-throughs** that into recovery state + cache (`recovery-context.tsx:554-587`). The ~16 follow-up GETs re-fetch data already in hand.

### ⚠️ Prerequisite — the health context is a client-side write-through dead end

Before dropping the `health.syncHealth` POST, understand *why it currently exists*:

- The **health context subscribes to nothing** — no `registerTodayDataSyncListener`, no reconcile/optimistic listener. So a `notify('recovery')` (or `notify('health')`) never reaches it.
- `logRecovery` only **invalidates** the health cache (`recovery-context.tsx:566`); it does **not** write the new sleep into the health context's in-memory `today`.
- So the **only** path that updates the client's `health.today.sleep_hours` after a manual log is the explicit `health.syncHealth` POST → `setToday`.

The backend `health_data` table *does* get the sleep via the `/recovery/log` mirror — this is purely a **client-state propagation gap**: HealthKit sleep flows through the health context (`syncFromDevice`/`syncHealth` → `setToday`), manual sleep flows through the recovery context, which never touches health state. That's why `hkSleep` reflects HealthKit but not manual logs.

**So removing the POST without adding a health write-through would leave `health.today.sleep_hours` permanently stale for manual logs.** The write-through must come first.

### Fix (write-through, mirrors the summary plan)

1. ✅ **(PR2) Health write-through.** Added `utils/today-health-reconcile.ts` (`applyHealthReconcile` / `registerHealthReconcileListener`). `logRecovery` emits the `data.health_data` row from the `/recovery/log` response on this channel (replacing the bare cache-invalidation); the health context subscribes and updates `today` (when the date is calendar-today) + the `health:<date>` cache. **No backend change needed** — `/recovery/log` already returns the full merged health row (`recovery.controller.ts:103`, `upsertHealthDataSleepForDate` preserves steps/calories).
2. ✅ **(PR3) Dropped the separate `health.syncHealth` POST.** Storage covered by the backend mirror; PR2 covers client state.
3. ✅ **(PR3) Dropped `refreshRecovery({ force: true })` and `health.refresh()` from `performSave`** (and the unused `refreshRecovery` destructure). Past-date edits now refresh the screen cache-first instead of force.
4. ✅ **(PR3) Lightened the listeners.** Removed `'recovery'` from both `shouldRefetchRecoveryAfterMutation` and `shouldRefetchSummaryAfterMutation` — it's self-emitted by `logRecovery` (already write-through) and doesn't change the daily summary. Cache correctness still handled by `invalidateAfterMutation`; weekly insights via its stale flag.

### Backend — not required after all
- `POST /recovery/log` **already returns** the saved recovery log + readiness **and** the updated health row (`data.health_data`). PR2 consumes the existing health row; no backend change was needed.

### Done when
- [x] Health write-through channel added; health context updates `today` + cache from the `/recovery/log` response (no `/health/sync` POST). ✅
- [x] Redundant refreshes + duplicate POST removed; listeners lightened; all files typecheck clean. ✅
- [ ] (verify on device) One manual sleep save produces ~1 request (the POST), not ~17 — confirm in server log.
- [ ] (verify on device) Screen + recovery + summary + insights still reflect the logged sleep (no regressions).

---

## Suggested order — ✅ all implemented

1. ✅ **PR1 — Bug 1 (date)**: `buildSleepSavePayload` sends `activeDate`; `logRecovery` threads the date into `notifyTodayDataChanged`; modal hardened.
2. ✅ **PR2 — health write-through**: `utils/today-health-reconcile.ts` channel; `logRecovery` emits the `/recovery/log` health row; health context subscribes and updates `today` + cache. (No backend change — the response already carried the health row.)
3. ✅ **PR3 — Bug 2 (volume)**: removed `refreshRecovery` / `health.refresh` / `health.syncHealth` from `performSave`; lightened the recovery + summary listeners.

All three landed and typecheck clean. Remaining: on-device verification (request count + no regressions). Backend (`roundfit-backend`) needed **no changes** — `/recovery/log` already returned the recovery log + readiness + health row.

## Files

- `hooks/use-sleep-log.ts` — `performSave` (both bugs converge here).
- `utils/sleep-log-calculations.ts` — `buildSleepSavePayload` date fields.
- `context/recovery-context.tsx` — `logRecovery` (write-through + notify date), `fetchRecoveryByDate`.
- `context/health-context.tsx` — **add a reconcile listener** so the health context updates `today.sleep_hours` + cache from the `/recovery/log` response (currently subscribes to nothing).
- `utils/cache-invalidation.ts` — `invalidateAfterMutation` (`recovery` domain date handling).
- `utils/sleep-date.ts` — `localSleepDateString` (the sleep-date convention to align on).
- Backend (separate repo): `recovery` controller — return a `today` block including the updated **health row** (already returns recovery log + readiness).

## What not to do
- Don't "fix" the volume by adding more dedup flags — remove the redundant calls instead.
- Don't drop the `health.syncHealth` POST *before* the health write-through (PR2) lands — the health context has no other path to learn the manual sleep, so its `sleep_hours` would go stale (the bug we're fixing).
- Don't try to "write sleep to the health table" on the client — it's already in `health_data` server-side via both paths. The gap is **client-state propagation**, not storage.
- Don't double-write via both `/recovery/log` mirror and a separate `/health/sync` — risks the cumulative-merge ratchet bugs seen elsewhere; let the recovery-log mirror be the source of truth.
