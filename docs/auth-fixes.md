# Auth flow — fixes needed

Audit of frontend (`roundfit`) and backend (`roundfit-backend`). Auth model: **Supabase JWT** + **RoundFit `public.users` profile**, with tokens in SecureStore and `/api/auth/*` on the backend.

---

## P0 — Broken or unsafe (fix first)

### 1. Password reset UI does not match the API

| Layer | Current behavior |
|-------|------------------|
| **Backend** | `POST /auth/reset-password` expects `{ email, code, new_password }`. Sends a 6-digit code via email. |
| **Frontend** | `app/auth/reset-password.tsx` expects deep-link `access_token` and sends `{ access_token, new_password }`. |
| **Copy** | Forgot-password says “reset link”; backend sends a **code**. |

**Fix** ✅

- [x] Redesign reset flow: collect **email + code + new password** (or add a dedicated code-entry screen after forgot-password).
- [x] Remove `access_token` deep-link assumption unless backend is changed to match.
- [x] Update forgot-password copy to say “reset code”, not “link”.
- [ ] Align email template (`password-reset`) with whatever UX we ship.  *(email template unchanged — code-based UI already matches resetCode template)*

**Files:** `app/auth/forgot-password.tsx`, `app/auth/reset-password.tsx`, `roundfit-backend/src/controllers/auth.controller.ts`, `roundfit-backend/src/emailTemplate/resetCode.ts`

---

### 2. Forgot / reset password omit API key (401 in production)

`apiFetch` sends `X-API-Key`; forgot/reset use raw `fetch` without it. Backend `requireApiKey` rejects unauthenticated requests in production.

**Fix** ✅

- [x] Route forgot-password and reset-password through `apiFetch` or a shared `publicApiFetch` helper that always attaches `X-API-Key`.  *(new `publicApiFetch` helper in `utils/api.ts`)*
- [ ] Confirm env: `EXPO_PUBLIC_API_KEY` matches backend `API_KEY`.  *(env verification left to you)*

**Files:** `app/auth/forgot-password.tsx`, `app/auth/reset-password.tsx`, `utils/api.ts`

---

### 3. `signIn` / `signUp` can set `authenticated` with no user

On `/auth/me` failure that is **not** `no_profile`, status becomes `authenticated` while `user` stays `null`. Navigator sends user to `/(tabs)` → empty/broken app state.

**Fix** ✅

- [x] On `/me` failure (except `no_profile`): set `unauthenticated`, clear tokens, or surface error — never `authenticated` without `user`.
- [x] `_layout.tsx` now gates the tabs redirect on `hasActiveUserSession(status, user)` and adds `user` to the effect deps.

**Files:** `context/auth-context.tsx`, `app/_layout.tsx`

---

### 4. OAuth `/me` failure misclassified as `needs-profile`

After OAuth, network/server errors on `fetchMe` (after retry) set `needs-profile` instead of showing an error. Users with existing profiles can be sent back through onboarding.

**Fix** ✅

- [x] Only set `needs-profile` when error is explicitly `no_profile`.
- [x] On other failures: clear tokens, surface `OAUTH_FAILED` error, do not push into onboarding.

**Files:** `context/auth-context.tsx`

---

### 5. Profile “migration” by updating `users.id` can break FKs

`resolveProfileForAuthUser` tries `UPDATE users SET id = new_auth_id` when the same email has another auth user with a profile. Child tables (e.g. `water_logs`) reference `users(id)` with `ON DELETE CASCADE` only — no `ON UPDATE CASCADE`. Migration fails when legacy user has data; fallback copy can duplicate/orphan rows.

**Fix** ✅

- [x] Added SQL migration `users_id_on_update_cascade.sql` that introspects every FK referencing `public.users(id)` and recreates it with `ON UPDATE CASCADE`. Run it once before deploying.
- [x] Removed the silent copy fallback — if the migration UPDATE fails after that SQL is applied, the controller now throws `profile_link_blocked` instead of orphaning child data.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`, `roundfit-backend/supabase/migrations/users_id_on_update_cascade.sql`

---

## P1 — Incorrect behavior or security

### 6. PostHog identifies users on failed login

`email-login.tsx` calls `posthog.identify` and `user_signed_in` after `await signIn()` even when `signIn` returned early without throwing.

**Fix** ✅

- [x] `signIn` now returns `Promise<boolean>` (true only on confirmed authenticated + profile loaded). Login screen gates `posthog.identify`/`capture` on the result.

**Files:** `app/auth/email-login.tsx`, optionally `context/auth-context.tsx`

---

### 7. `PATCH /auth/profile` response shape mismatch

Backend returns `{ data: { profile } }`. Frontend reads `body.profile` → server recalculated `tdee` / `calorie_budget` never applied after PATCH.

**Fix** ✅

- [x] `updateProfile` now reads `body.data?.profile` (falls back to legacy `body.profile`).
- [ ] Add integration test or manual check after weight/goal change.  *(test left to you)*

**Files:** `context/auth-context.tsx`

---

### 8. `updateProfile` mass-assignment on backend

`updateProfile` spreads full `req.body` into Supabase update. Authenticated clients could send unexpected columns.

**Fix** ✅

- [x] Whitelist via `PROFILE_UPDATABLE_FIELDS` constant in `updateProfile`.
- [x] Unknown keys are silently dropped; empty patch returns 400.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 9. TDEE only recalculates when all body fields are present

Partial PATCH (e.g. only `weight_kg`) skips TDEE recalculation. Stale calorie targets on server.

**Fix** ✅

- [x] On any `TDEE_INPUT_FIELDS` change, load current profile, merge with patch, then recompute. Partial PATCH (e.g. weight only) now produces correct targets.
- [x] Frontend consumes the recomputed profile via #7.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 10. Change password shown to OAuth-only users

Profile links to change password for everyone. `isStoredTokenOAuth` is imported in auth-context but unused. OAuth users without a password get misleading errors from `signInWithPassword` verification.

**Fix** ✅

- [x] `profile/index.tsx` calls `isStoredTokenOAuth()` on mount and hides the Change Password row (plus its trailing divider) when the user signed in via Apple/Google.
- [ ] Optional: offer “Set password” for OAuth users via a dedicated flow.  *(not implemented)*

**Files:** `app/(tabs)/profile/index.tsx`, `context/auth-context.tsx`, `utils/api.ts`

---

### 11. Password policy inconsistency

| Surface | Rule |
|---------|------|
| Sign-up UI | Min 6 characters |
| Reset / change (backend) | Min 8 characters |
| Change password UI | 8 + upper + lower + number + special |

**Fix** ✅

- [x] Sign-up now requires min 8 characters (`canSubmit`, placeholder, error label all updated in both `app/auth/sign-up.tsx` and `components/onboarding/OnboardingSignupAuth.tsx`).
- [x] Reset password screen uses `MIN_PASSWORD_LEN = 8` constant matching the backend.
- [ ] Change-password's stricter complexity rules (upper/lower/number/special) are left in place — frontend can be stricter than backend. Document if you want to relax.

**Files:** `app/auth/sign-up.tsx`, `app/auth/change-password.tsx`, `app/auth/reset-password.tsx`, backend auth controller

---

### 12. `logout` with missing token

`signOut(token!, 'global')` when Authorization and cookie are both absent.

**Fix** ✅

- [x] Guard added — if no token, skip Supabase signOut and return 200 with cookie cleared.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 13. Account deletion ordering

Deletes `users` row before `auth.admin.deleteUser`. Auth delete failure → orphaned auth user, no profile.

**Fix** ✅

- [x] Reordered: delete auth user first, then the profile row as a safety net. If auth delete fails, the profile row is still intact so the account is recoverable.
- [x] Auth-delete failure returns 500 with the error message; profile-delete is best-effort after.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 14. Auth rate limit keyed by app API key

`authRateLimiter` uses API key as rate-limit key → **20 requests / 15 min shared across all users** of the app.

**Fix** ✅

- [x] `apiRateLimiter` now keys by user id (decoded from Bearer JWT sub) when authenticated, falling back to IP. API key is no longer a rate-limit bucket.
- [x] `authRateLimiter` keys purely by IP — appropriate for login / forgot / reset / refresh where the caller may not have a valid token.

**Files:** `roundfit-backend/src/middleware/rateLimit.ts`

---

## P2 — Edge cases and maintainability

### 15. `signIn` continues without storing new tokens

If login returns 200 but omits tokens, flow still calls `/me` and may use **stale** SecureStore tokens.

**Fix** ✅

- [x] `signIn` now bails with `UNKNOWN` error when the 200 body lacks `access_token` / `refresh_token` (matches what `signUp` already did).

**Files:** `context/auth-context.tsx`

---

### 16. `parseApiError` over-maps to `INVALID_CREDENTIALS`

Any 401 or message containing `"invalid"` → invalid credentials.

**Fix** ✅

- [x] Tightened to specific phrases (`invalid credentials`, `invalid login`, `incorrect/wrong password`) plus 401. Same for `EMAIL_IN_USE` (`already registered/exists/in use`), `WEAK_PASSWORD`, `INVALID_EMAIL`. Generic `"invalid"` no longer collapses everything.

**Files:** `context/auth-context.tsx`

---

### 17. Duplicate email registration status code

Frontend expects **409** for `EMAIL_IN_USE`; Supabase `createUser` often returns **400**.

**Fix** ✅

- [x] Backend `register` now inspects the Supabase error message (`already`, `registered`, `exists`, `in use`) and returns 409 for duplicates. Frontend's message-based detection in `parseApiError` remains as a belt-and-braces.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`, `context/auth-context.tsx`

---

### 18. `getAuthUserByEmail` uses first match only

Multiple auth users can share an email (email + Apple + Google). Forgot/reset attach to `matches[0]` only.

**Fix**

- [ ] Document behavior or merge/deduplicate auth users by email.
- [ ] Reset code should apply to the account the user intends (email login vs OAuth).

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 19. `listAuthUsersByEmail` pagination

Relies on `nextPage` on listUsers response; may not match Supabase admin API shape.

**Fix** ✅

- [x] Pagination now stops when a page returns fewer than `perPage` users (documented Supabase signal) instead of relying on a `nextPage` field. Hard cap of 100 pages (20k users) as a safety net.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 20. `oauthProfilePending` naming

Flag set for email `needs_profile_setup` too, not only OAuth.

**Fix** ✅

- [x] Renamed to `profileSetupPending` across `auth-context.tsx`, `sign-up.tsx`, `auth-options.tsx`, `reveal.tsx`, `OnboardingSignupAuth.tsx`. Setter renamed too.

**Files:** `context/auth-context.tsx`, consumers in onboarding/auth screens

---

### 21. API key env var split

- `utils/api.ts` → `EXPO_PUBLIC_API_KEY`
- `utils/avatar.ts`, `health-context` → `EXPO_PUBLIC_API_SECRET_KEY`

**Fix** ✅

- [x] `health-context` now reads `EXPO_PUBLIC_API_KEY` first, falling back to `EXPO_PUBLIC_API_SECRET_KEY` for compatibility. `utils/avatar.ts` was already on `EXPO_PUBLIC_API_KEY` — the doc was slightly out of date. Single env var going forward.

**Files:** `.env`, `utils/api.ts`, `utils/avatar.ts`, `MVP_TODO.md`

---

### 22. PII in oauth-setup console.log

Logs full profile body in production path.

**Fix** ✅

- [x] Gated behind `if (__DEV__)`.

**Files:** `context/auth-context.tsx`

---

### 23. Legacy `/me` 404 handling

Frontend still handles `404` + `PROFILE_NOT_FOUND`; backend now returns `200` + `needs_profile_setup`.

**Fix** ✅

- [x] Removed the 404 + `PROFILE_NOT_FOUND` branch from `fetchMe`. Any non-OK response now throws `fetch_me_failed`; profile-missing is detected from the 200 body via `needs_profile_setup` / missing profile row.

**Files:** `context/auth-context.tsx`

---

## P3 — UX / polish

### 24. Forgot-password success on silent API failure

Combined with missing API key, user may see “check inbox” while request failed.

**Fix** ✅

- [x] `forgot-password.tsx` now uses `publicApiFetch` and only navigates to the reset-code screen on `ok`. Non-ok responses surface the server error message inline.

---

### 25. `refreshUser` swallows errors

Silent failure leaves stale profile.

**Fix** ✅

- [x] Now logs a warning in `__DEV__` so the failure surfaces during development. Production behavior unchanged (keep stale data rather than crash).

**Files:** `context/auth-context.tsx`

---

### 26. Misleading comments (cookies)

Comments refer to cookie-based session; mobile uses Bearer + SecureStore only.

**Fix** ✅

- [x] `signOut` JSDoc updated to "invalidates Supabase session" instead of "clears cookie". (Backend still issues cookies for web clients; mobile path ignores them.)

---

## Profile linking — prevent auth/users mismatch (deploy once)

Run these in **Supabase SQL Editor** on the project your API uses (in order):

1. `roundfit-backend/supabase/migrations/users_email_column.sql`
2. `roundfit-backend/supabase/migrations/users_id_on_update_cascade.sql`
3. `roundfit-backend/supabase/migrations/users_profile_link_rpc.sql`

The RPC `link_profile_for_auth_user` runs on every `/auth/me`, login, and oauth-setup:

- Backfills `public.users.email` when missing but `users.id` matches `auth.users.id`
- Re-links a profile row when another auth id or stored email matches (OAuth / email on same address)

**Supabase Dashboard → Authentication → Providers / Settings:** enable linking identities that share the same email so Apple/Google/email do not create unrelated auth UUIDs when possible.

**Still manual / edge cases:** profile with `users.email` NULL and a deleted auth user (no email to match); Apple “Hide My Email” vs original signup email.

---

## Test plan (after fixes)

- [ ] Email sign-up → lands in tabs with profile and correct TDEE.
- [ ] Email login with bad password → no PostHog identify; stays on login with error.
- [ ] Email login with good password → tabs, `/me` loads.
- [ ] Google OAuth new user → `needs-profile` → oauth-setup → tabs.
- [ ] Google OAuth returning user → tabs directly.
- [ ] OAuth with backend down → error/retry, not forced onboarding.
- [ ] Forgot password → email received → code entry → reset → login with new password (production API key).
- [ ] Change password (email user) → success; recalc targets if applicable.
- [ ] OAuth user → change password hidden or appropriate alternative.
- [ ] Sign out → re-open app → unauthenticated.
- [ ] Token refresh on foreground → session persists.
- [ ] Partial profile update (weight only) → TDEE/budget update in UI after PATCH.
- [ ] Delete account → fully removed; cannot log in again.

---

## Reference — main files

| Area | Path |
|------|------|
| Auth state | `context/auth-context.tsx` |
| API client | `utils/api.ts` |
| Navigation guards | `app/_layout.tsx` |
| Login | `app/auth/email-login.tsx` |
| Sign-up | `app/auth/sign-up.tsx`, `components/onboarding/OnboardingSignupAuth.tsx` |
| Forgot / reset | `app/auth/forgot-password.tsx`, `app/auth/reset-password.tsx` |
| Change password | `app/auth/change-password.tsx` |
| Backend routes | `roundfit-backend/src/routes/auth.ts` |
| Backend controller | `roundfit-backend/src/controllers/auth.controller.ts` |
| Auth middleware | `roundfit-backend/src/middleware/auth.ts` |
