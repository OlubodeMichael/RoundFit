# Codebase Review — Security & Logic Findings

> Reviewed: 2026-06-10. Scope: auth/token handling, OAuth, caching (cross-user leakage),
> HealthKit/date logic, storage, and data export. Issues ordered by severity.

---

## Security Issues

### 1. Logout never revokes the session server-side (race condition)

**File:** `context/auth-context.tsx:1186`
**Severity:** High

```ts
apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
await clearTokens();
```

`apiFetch` reads the access token from SecureStore **asynchronously**, while
`clearTokens()` runs immediately. The token is almost always deleted before
`apiFetch` gets to read it, so the logout request goes out with no
`Authorization` header → backend can't identify the session → **the refresh
token stays valid server-side after "logout."** If a device is compromised or a
token leaked, logout gives false comfort.

**Fix:** Read the token first and pass it explicitly, or `await` the logout
call (with its existing 10s timeout) before clearing tokens.

- [x] Fixed — `signOut` now captures the token via `getStoredAccessToken()`
  before `clearTokens()` and passes it explicitly as the `Authorization`
  header (fire-and-forget UX preserved).

---

### 2. OAuth implicit flow + token fragment in logs

**Files:** `lib/supabase.ts:16`, `context/auth-context.tsx:1056`
**Severity:** Medium

`flowType: 'implicit'` was chosen deliberately, which puts the **access and
refresh tokens in the redirect URL**. That's a known weaker posture (URLs can
land in logs/history); PKCE is the recommended pre-launch upgrade — Supabase
supports it with a small storage adapter.

More immediately: `auth-context.tsx:1056` logs `result.url.substring(0, 120)`
in the missing-token branch. If `access_token` is present but `refresh_token`
is missing, that log line contains a chunk of a live access token.

**Fix:** Log only the param **names**, not the URL. Plan migration to PKCE
before launch.

- [x] Fixed — log now reports only present/missing flags per param, never the
  URL. **PKCE migration is still deferred to the pre-launch list** (tracked
  separately; needs a storage adapter + code-exchange step).

---

### 3. Health data logged to console in production

**File:** `utils/healthkit.ts` (throughout)
**Severity:** Medium

`logHealthKitRawSamples`, the full summary `JSON.stringify` at line 564,
HRV/sleep/HR previews — all via unconditional `console.log`. In release builds
these end up in OS device logs and any log-collection tooling. This is health
PII.

**Fix:** Gate every HealthKit log behind `__DEV__` (or a debug flag like the
existing `setResourceCacheDebug` pattern).

- [x] Fixed — added `hkLog()` (`__DEV__`-gated) and routed every
  `console.log` in `healthkit.ts` through it. The one remaining
  `console.warn` (distance permission denied) carries no health data and is
  kept as a prod diagnostic.

---

### 4. Notification inbox leaks across accounts

**Files:** `utils/notification-inbox-storage.ts:6`, `utils/clear-user-caches.ts:11`
**Severity:** Medium

`roundfit:notification-inbox` is not user-scoped and isn't in
`clearUserCachesOnLogout`'s key list. The context resets React state on logout
(`notification-inbox-context.tsx:65`), but the AsyncStorage payload survives —
the **next account on the same device hydrates the previous user's
notifications**. Low sensitivity (reminder titles/bodies), but it's wrong data
shown to the wrong user.

**Fix:** Add the key to `EXACT_LOGOUT_KEYS` or scope the storage key by userId.

- [x] Fixed — exported `NOTIFICATION_INBOX_STORAGE_KEY` and added it to
  `EXACT_LOGOUT_KEYS`, so `clearUserCachesOnLogout` now wipes the inbox.

---

### 5. Silent insecure fallback API URL

**File:** `utils/api.ts:5`
**Severity:** Low

`API_BASE` falls back to `http://localhost:8000/api` (plain HTTP) when
`API_URL` is missing from the build env. A missing `API_KEY` fails **loudly**
right below it (lines 12–20), but a missing `apiUrl` fails silently — and
produces the same "everything broken" symptom.

**Fix:** Add the same loud startup warning for a missing/empty `apiUrl`.

- [x] Fixed — startup warning added in `utils/api.ts`, mirroring the
  existing `API_KEY` warning.

---

### 6. Weak-entropy Apple Sign-In nonce fallback

**File:** `utils/apple-sign-in-nonce.ts:13`
**Severity:** Low

The `Math.random()` fallback produces a predictable Apple Sign-In nonce.
Hermes ships `getRandomValues`, so it likely never triggers — but the safe
behavior is to **throw** rather than degrade silently (or use `expo-crypto`'s
`getRandomBytes`).

- [x] Fixed — fallback removed; `generateRandomNonce` now throws when
  `crypto.getRandomValues` is unavailable. The Apple sign-in flow already
  catches this and surfaces `OAUTH_FAILED`.

---

### 7. Exported user data persists unencrypted (informational)

**File:** `services/data-export.ts`
**Severity:** Informational

The full account export JSON is written to the cache dir and never explicitly
deleted after the share sheet. Consider deleting it post-share. Same family:
meal photos live in cache for 7 days (`utils/photo-cache.ts`) — fine, just be
aware for the privacy policy.

- [x] Fixed — `writeExportToCacheFile` now prunes all previous exports before
  writing, and `useDataExport` deletes the file on `reset()` and on unmount
  (kept alive only while the flow is open, so re-share still works). Photo
  cache left as-is (privacy-policy item).

---

## Logic Bugs

### 8. Distance unit heuristic can report meters as kilometers

**File:** `utils/healthkit-stats.ts:63-67`
**Severity:** High

```ts
if (!u && qty >= 100) { /* metres → km */ }
return { value: ..., unit: 'km' };  // ← raw qty passed through as km
```

With an empty unit and `qty < 100`, the raw quantity is returned **as km** — a
50 m sample becomes 50 km. Unknown unit strings also fall through as km
unconverted. HealthKit's SI default for distance is meters — so when the unit
is empty, treat it as meters unconditionally; drop the `>= 100` guess.

This is the same family of bug as the 11M-steps incident, and the backend's
`Math.max` merge would ratchet a bad value in permanently.

**Fix:** Empty unit → always meters → km. Unknown unit → return 0 (treat as
"no value") rather than passing through as km.

- [x] Fixed — `normaliseDistanceQuantity` now always treats an empty unit as
  meters and unknown units as "no value" (0). `distanceFromWorkout` omits
  distance instead of recording 0. Tests updated to lock in the new behavior.

---

### 9. Sample-summing distance fallback can double-count

**File:** `utils/healthkit.ts:304` (`queryDistanceFromSamples`)
**Severity:** Medium

The fallback sums raw samples across sources. The comment at
`queryCumulativeStat` (line 257) explains why the stats API exists: it dedupes
overlapping iPhone+Watch samples. The fallback doesn't, so when it's hit,
distance can be ~2×. Last-resort path, but combined with the backend's
`Math.max` merge, an inflated value sticks.

**Fix:** When summing raw samples, keep only the highest-priority source
(e.g. Watch) instead of summing all sources.

- [x] Fixed — samples are now totalled per source (bundle id / name / device)
  and the largest single-source total wins, mirroring how the stats API
  avoids cross-source double-counting.

---

### 10. Bedtime/wakeup/efficiency only computed from `inBed` samples

**File:** `utils/healthkit.ts:739-756` (`summariseSleep`)
**Severity:** Medium

Many sleep sources (third-party trackers, some Watch flows) write only
`asleep*` stage samples, never `inBed`. In that case `bedtime_iso`,
`wakeup_iso` come back `null` and `sleep_efficiency` is `null` even though
full stage data exists.

**Fix:** Fall back to min-start/max-end of asleep segments when no `inBed`
samples exist.

- [x] Fixed — `summariseSleep` now tracks asleep-segment bounds as fallback
  for bedtime/wakeup, and approximates efficiency from the asleep span
  (capped at 100) when no `inBed` samples exist.

---

### 11. Minor items

**Severity:** Low

- `utils/api.ts:288-292` — `hasStoredAccessToken`'s JSDoc describes the
  OAuth-provider check (copy-pasted from `isStoredTokenOAuth` below it).
- `utils/checkin-storage.ts:16-21` — the legacy `checkin_completed_date` key
  is only deleted when it equals today; a stale legacy value lingers forever.
  Delete it on any migration read.
- `utils/healthkit.ts:282` — `queryCumulativeStat` tries all 3 option variants
  even when the first legitimately returns 0, so a zero-steps morning costs 3
  native queries per metric. Distinguish "query succeeded with 0" from "query
  failed" to short-circuit.
- `utils/notification-inbox-storage.ts:71-79` — in `dedupeInboxRows`, the
  newest duplicate wins wholesale including its `read` flag, so an older
  *unread* row's state can be overwritten by a newer read one (the
  unread-resurrection branch only fires when the existing entry is newer).

- [x] Fixed — all four:
  - `hasStoredAccessToken` JSDoc corrected; OAuth doc moved to
    `isStoredTokenOAuth`.
  - Legacy check-in key now deleted on any migration read.
  - Added `extractCumulativeOrNull` (null = unrecognised shape, 0 = genuine
    zero); `queryCumulativeStat` short-circuits on a real zero.
  - `dedupeInboxRows` keeps newest content but only marks read when every
    duplicate is read.

---

## What Looked Good

- The refresh mutex with single-flight + transient/definitive failure split in
  `utils/api.ts` is genuinely well done.
- The sub-mismatch guard against cross-account token storage is a nice touch.
- Cache keys are consistently user-scoped through `buildResourceKey`.
- The daily-summary cache correctly shares the one engine so logout clears
  memory too, not just disk.
- `getRequestStatusForAuthorization`-based HealthKit auth gating is the right
  pattern.

## Recommended Priority

The highest-leverage fixes are **#1** (logout revocation — small change, real
security gap) and **#8** (distance unit fallthrough — same class as the past
11M-steps bug and it ratchets via the backend merge).
