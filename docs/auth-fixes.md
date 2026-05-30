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

**Fix**

- [ ] Redesign reset flow: collect **email + code + new password** (or add a dedicated code-entry screen after forgot-password).
- [ ] Remove `access_token` deep-link assumption unless backend is changed to match.
- [ ] Update forgot-password copy to say “reset code”, not “link”.
- [ ] Align email template (`password-reset`) with whatever UX we ship.

**Files:** `app/auth/forgot-password.tsx`, `app/auth/reset-password.tsx`, `roundfit-backend/src/controllers/auth.controller.ts`, `roundfit-backend/src/emailTemplate/resetCode.ts`

---

### 2. Forgot / reset password omit API key (401 in production)

`apiFetch` sends `X-API-Key`; forgot/reset use raw `fetch` without it. Backend `requireApiKey` rejects unauthenticated requests in production.

**Fix**

- [ ] Route forgot-password and reset-password through `apiFetch` or a shared `publicApiFetch` helper that always attaches `X-API-Key`.
- [ ] Confirm env: `EXPO_PUBLIC_API_KEY` matches backend `API_KEY`.

**Files:** `app/auth/forgot-password.tsx`, `app/auth/reset-password.tsx`, `utils/api.ts`

---

### 3. `signIn` / `signUp` can set `authenticated` with no user

On `/auth/me` failure that is **not** `no_profile`, status becomes `authenticated` while `user` stays `null`. Navigator sends user to `/(tabs)` → empty/broken app state.

**Fix**

- [ ] On `/me` failure (except `no_profile`): set `unauthenticated`, clear tokens, or surface error — never `authenticated` without `user`.
- [ ] Guard navigation: only redirect to tabs when `hasActiveUserSession(status, user)` is true.

**Files:** `context/auth-context.tsx`, `app/_layout.tsx`

---

### 4. OAuth `/me` failure misclassified as `needs-profile`

After OAuth, network/server errors on `fetchMe` (after retry) set `needs-profile` instead of showing an error. Users with existing profiles can be sent back through onboarding.

**Fix**

- [ ] Only set `needs-profile` when error is explicitly `no_profile`.
- [ ] On other failures: keep tokens, show retry/error UI, do not call `oauth-setup` again.

**Files:** `context/auth-context.tsx`

---

### 5. Profile “migration” by updating `users.id` can break FKs

`resolveProfileForAuthUser` tries `UPDATE users SET id = new_auth_id` when the same email has another auth user with a profile. Child tables (e.g. `water_logs`) reference `users(id)` with `ON DELETE CASCADE` only — no `ON UPDATE CASCADE`. Migration fails when legacy user has data; fallback copy can duplicate/orphan rows.

**Fix**

- [ ] Prefer a safe linking strategy (e.g. merge metadata, re-point FKs, or document “one auth provider per email”).
- [ ] If keeping migration: add `ON UPDATE CASCADE` on FKs or migrate child rows in a transaction.
- [ ] Add logging/metrics when migration falls back to copy.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`, Supabase migrations

---

## P1 — Incorrect behavior or security

### 6. PostHog identifies users on failed login

`email-login.tsx` calls `posthog.identify` and `user_signed_in` after `await signIn()` even when `signIn` returned early without throwing.

**Fix**

- [ ] Only identify/capture after confirmed success (`status === 'authenticated'` and user loaded, or have `signIn` return `boolean`).

**Files:** `app/auth/email-login.tsx`, optionally `context/auth-context.tsx`

---

### 7. `PATCH /auth/profile` response shape mismatch

Backend returns `{ data: { profile } }`. Frontend reads `body.profile` → server recalculated `tdee` / `calorie_budget` never applied after PATCH.

**Fix**

- [ ] Read `body.data?.profile` (same as `profileFromAuthPayload` pattern).
- [ ] Add integration test or manual check after weight/goal change.

**Files:** `context/auth-context.tsx`

---

### 8. `updateProfile` mass-assignment on backend

`updateProfile` spreads full `req.body` into Supabase update. Authenticated clients could send unexpected columns.

**Fix**

- [ ] Whitelist allowed fields (mirror register/oauth-setup).
- [ ] Reject unknown keys.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 9. TDEE only recalculates when all body fields are present

Partial PATCH (e.g. only `weight_kg`) skips TDEE recalculation. Stale calorie targets on server.

**Fix**

- [ ] Load current profile, merge patch, recalc TDEE when any TDEE input changes.
- [ ] Return updated profile in response (already does; frontend must consume it — see #7).

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 10. Change password shown to OAuth-only users

Profile links to change password for everyone. `isStoredTokenOAuth` is imported in auth-context but unused. OAuth users without a password get misleading errors from `signInWithPassword` verification.

**Fix**

- [ ] Hide or disable “Change password” when token provider is not `email`.
- [ ] Optional: offer “Set password” for OAuth users via a dedicated flow.

**Files:** `app/(tabs)/profile/index.tsx`, `context/auth-context.tsx`, `utils/api.ts`

---

### 11. Password policy inconsistency

| Surface | Rule |
|---------|------|
| Sign-up UI | Min 6 characters |
| Reset / change (backend) | Min 8 characters |
| Change password UI | 8 + upper + lower + number + special |

**Fix**

- [ ] Single policy document and enforce consistently on frontend + backend.
- [ ] Sign-up should meet the same bar as change/reset (recommend min 8 everywhere).

**Files:** `app/auth/sign-up.tsx`, `app/auth/change-password.tsx`, `app/auth/reset-password.tsx`, backend auth controller

---

### 12. `logout` with missing token

`signOut(token!, 'global')` when Authorization and cookie are both absent.

**Fix**

- [ ] Guard: if no token, skip Supabase signOut and return 200 (client already clears local state).
- [ ] Or require token for logout route.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 13. Account deletion ordering

Deletes `users` row before `auth.admin.deleteUser`. Auth delete failure → orphaned auth user, no profile.

**Fix**

- [ ] Delete auth user first (if cascade handles profile), or wrap in transaction / compensating rollback.
- [ ] Return clear error if partial failure.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 14. Auth rate limit keyed by app API key

`authRateLimiter` uses API key as rate-limit key → **20 requests / 15 min shared across all users** of the app.

**Fix**

- [ ] Rate limit auth endpoints by IP or by user id (after token parse) for refresh/login, not only by API key.
- [ ] Keep stricter limits on unauthenticated routes (login, forgot-password).

**Files:** `roundfit-backend/src/middleware/rateLimit.ts`

---

## P2 — Edge cases and maintainability

### 15. `signIn` continues without storing new tokens

If login returns 200 but omits tokens, flow still calls `/me` and may use **stale** SecureStore tokens.

**Fix**

- [ ] Treat missing tokens on login/register success as error; do not proceed to authenticated state.

**Files:** `context/auth-context.tsx`

---

### 16. `parseApiError` over-maps to `INVALID_CREDENTIALS`

Any 401 or message containing `"invalid"` → invalid credentials.

**Fix**

- [ ] Narrow mapping; use backend `error` codes where possible.

**Files:** `context/auth-context.tsx`

---

### 17. Duplicate email registration status code

Frontend expects **409** for `EMAIL_IN_USE`; Supabase `createUser` often returns **400**.

**Fix**

- [ ] Map Supabase “already registered” messages to 409 on backend, or handle 400 + message on frontend.

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

**Fix**

- [ ] Verify against current Supabase admin API; fix pagination loop.

**Files:** `roundfit-backend/src/controllers/auth.controller.ts`

---

### 20. `oauthProfilePending` naming

Flag set for email `needs_profile_setup` too, not only OAuth.

**Fix**

- [ ] Rename to `profileSetupPending` (or split OAuth vs email flags) for clearer routing/analytics.

**Files:** `context/auth-context.tsx`, consumers in onboarding/auth screens

---

### 21. API key env var split

- `utils/api.ts` → `EXPO_PUBLIC_API_KEY`
- `utils/avatar.ts`, `health-context` → `EXPO_PUBLIC_API_SECRET_KEY`

**Fix**

- [ ] Consolidate to one public env var or document both must be set to the same value.

**Files:** `.env`, `utils/api.ts`, `utils/avatar.ts`, `MVP_TODO.md`

---

### 22. PII in oauth-setup console.log

Logs full profile body in production path.

**Fix**

- [ ] Remove or gate behind `__DEV__`.

**Files:** `context/auth-context.tsx`

---

### 23. Legacy `/me` 404 handling

Frontend still handles `404` + `PROFILE_NOT_FOUND`; backend now returns `200` + `needs_profile_setup`.

**Fix**

- [ ] Optional cleanup: rely only on `needs_profile_setup` in response body.

**Files:** `context/auth-context.tsx`

---

## P3 — UX / polish

### 24. Forgot-password success on silent API failure

Combined with missing API key, user may see “check inbox” while request failed.

**Fix**

- [ ] Fixed by #2; verify error paths show failure message.

---

### 25. `refreshUser` swallows errors

Silent failure leaves stale profile.

**Fix**

- [ ] Optional: expose error to callers or log in dev.

**Files:** `context/auth-context.tsx`

---

### 26. Misleading comments (cookies)

Comments refer to cookie-based session; mobile uses Bearer + SecureStore only.

**Fix**

- [ ] Update comments in auth-context / api utils.

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
