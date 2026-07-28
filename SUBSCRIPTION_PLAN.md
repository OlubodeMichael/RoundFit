# RoundFit — Subscription & Hard Paywall Plan

**Generated:** 2026-07-13 · Branch `subscription` · Implements `LAUNCH_CHECKLIST.md` §3 (and closes §2's webhook item).
**Status:** Phase 2 (frontend plumbing) + Phase 4 (the gate) implemented 2026-07-14, **behind `PAYWALL_ENABLED` (default OFF)** in `constants/subscription.ts`. Files: `lib/purchases.ts`, `context/subscription-context.tsx`, real `hooks/use-is-premium.ts`, `app/paywall.tsx`, gate + splash + provider in `app/_layout.tsx`. Typechecks; **not yet runtime-verified** (needs an iOS device build + Phase 0). Still TODO before flipping the flag ON: Phase 0 (App Store products + real iOS SDK key + legal pages hosted), reconcile RC entitlement to `premium` (dashboard — MCP key lacks scope), Phase 1 (backend webhook auth/events), §12.2 `billing_uid`, Phase 5/6 (reminders + analytics).

---

## 0. Decisions locked

| Decision | Choice |
|---|---|
| Paywall placement | End of onboarding, immediately after the plan reveal |
| Paywall hardness | **Hard.** Full lock — no free tier, no read-only mode |
| Trial | **7 days, card required** — an App Store *introductory offer*. Auto-charges on day 7 unless cancelled |
| Trial eligibility | "Has never made any purchase" (one trial per Apple ID, ever) |
| Trial reminders | Local notifications on day 5 and day 6 — *"you'll be charged $89.99, cancel anytime"* |
| After trial | Charged. If they cancelled → entitlement expires → hard paywall |
| Products | Monthly **$14.99** · Annual **$89.99** ($7.50/mo — *"Save 50%"*) |
| Trial attaches to | **Annual only.** Monthly is buy-now |
| Entitlement ID | `premium` (already assumed by `services/revenuecat.ts:40`) |

**What this buys us:** RevenueCat is the *single* source of truth for entitlement, including during the trial. There is no second "trial" code path to build or keep in sync — a trialling user looks exactly like a paying user to both client and server, because Apple has the card and RC knows it. `requirePremium` already handles this. Apple enforces one-trial-per-Apple-ID for us, so there's no trial-farming abuse surface to defend.

### ⚠️ One thing worth reconsidering: the day-7 charge is $89.99

Trial-on-annual-only means everyone who takes the trial gets hit with a **$89.99 charge** on day 7. That's a large, surprising number for someone who signed up 7 days ago, and it drives cancellations on day 6, refund requests on day 8, and occasionally chargebacks. The usual play is to attach the trial to **both** SKUs so the majority land on a $14.99 charge they barely notice, while annual stays pre-selected for the people who want it.

Keeping annual-only is a defensible bet (higher LTV per conversion, one-time churn), just know you're trading conversion rate for it. Flag if you want to change this — it's a one-line change in App Store Connect, not a code change.

---

## 1. What already exists (verified in code)

**Backend** (`roundfit-backend/`)
- `routes/subscriptions.ts` — `POST /webhook` (public), `POST /verify`, `GET /status` (authed).
- `controllers/subscriptions.controller.ts` — upserts a `subscriptions` row from RC webhook events. Already maps `TRIAL_STARTED → 'trial'`, `TRIAL_CONVERTED → 'active'`, `TRIAL_CANCELLED → 'cancelled'`, `EXPIRATION → 'expired'`.
- `services/revenuecat.ts` — RC REST v1 reads, keyed on `entitlements['premium']`.
- `middleware/requirePremium.ts` — accepts `status ∈ {active, trial}` **and** `current_period_end > now`. Fails closed on a missing row. **Already correct for this design — no change needed.**
- Gated routes today: `/insights/ai`, `/insights/ai/context`, `/insights/ai/persist`, `/insights/coaching/phrase`, `/insights/weekly-ai`, `/patterns/detect`.
- `subscriptions` table (`sql.md:341`) — has `revenuecat_id`, `plan`, `status`, `trial_end`, `current_period_end`, `unique(user_id)`.

**Frontend** (`roundfit/`)
- `react-native-purchases@^10.1.0` + `react-native-purchases-ui@^10.1.0` installed; Pods built.
- `Purchases.configure()` is **never called** anywhere.
- `app/(tabs)/profile/paywall.tsx` — placeholder text.
- `hooks/use-is-premium.ts` — **hardcoded `return false`**. Every premium gate reads this, so cloud coaching phrasing is off app-wide.
- `app/_layout.tsx:103-134` — `AppNavigator`'s routing effect. **This is the seam.** It already replaces to `/(tabs)` on `hasActiveUserSession`, and already renders a `showAuthSplash` overlay to prevent flashes.
- `utils/notifications.ts` — `scheduleReminder(id, …)` / `cancelReminder(id)` local helpers. No remote push anywhere.
- `utils/api.ts:221` — `apiFetch`, the single choke point for every authed request.

**Identity chain:** `authenticate` sets `req.user.id` = Supabase **auth uid**, and `resolveProfileForAuthUser` migrates `users.id` onto the auth uid. So `subscriptions.user_id` = auth uid = **the RevenueCat `app_user_id` we must use**.

---

## 2. Architecture

```
   App Store  ──purchase──►  RevenueCat  ──webhook (auth header)──►  subscriptions row
                                 │                                        │
                                 │ customerInfo                           ▼
                                 ▼                                  requirePremium ──► AI routes
                    SubscriptionProvider (client)
                                 │
                                 ├──► useIsPremium()      → every existing feature gate flips on
                                 └──► AppNavigator gate   → replace('/paywall') when locked
```

RevenueCat is the source of truth. The `subscriptions` table is a **cache** the webhook keeps warm, so `requirePremium` doesn't make a network call per request. The client trusts `customerInfo.entitlements.active['premium']`; the server trusts the row, with a live RC read as fallback when the row is missing.

The trial is not a special state. `TRIAL_STARTED` writes `status='trial'` with `current_period_end` = the trial end, and `requirePremium` lets them through exactly as if they'd paid. On day 7 Apple charges, RC fires `TRIAL_CONVERTED`, the row flips to `active`, and `current_period_end` moves out a year. If they cancelled instead, `EXPIRATION` fires, the date passes, and every gate closes at once.

---

## 3. Phase 0 — Dashboard setup (no code)

**App Store Connect**
- Subscription group: `RoundFit Premium`.
- `roundfit_premium_monthly` — $14.99/month, no offer.
- `roundfit_premium_annual` — $89.99/year, **+ introductory offer: 7 days free**, eligibility *"Has never made any purchase"* (the dropdown from your screenshot — strictest option, prevents re-trialling).
- Localised names/descriptions + the **subscription-group localisation** (Apple rejects on missing group metadata), and a review screenshot.
- Paid Apps agreement + banking must be active or the products stay in "Missing Metadata" and never load in sandbox.

**RevenueCat**
- Entitlement `premium` ← attach both products.
- Offering `default` with packages `$rc_monthly` + `$rc_annual`.
- **Webhook Authorization header** — set a shared secret (Project Settings → Webhooks). Phase 1.1 verifies it.
- iOS **public** SDK key (client) and **secret** REST key (server).

**Env**
- Client: `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.
- Server: `REVENUECAT_SECRET_KEY` (already read at `services/revenuecat.ts:3`), new `REVENUECAT_WEBHOOK_AUTH`.

---

## 4. Phase 1 — Backend (small — the design does most of the work)

### 1.1 Verify the webhook — *a live security hole today*
`controllers/subscriptions.controller.ts:56` trusts **any** POST body and upserts `subscriptions` keyed by an attacker-supplied `app_user_id`. Anyone who finds the URL can grant themselves premium forever.

RC authenticates webhooks with a static `Authorization` header (not an HMAC). So: compare against `REVENUECAT_WEBHOOK_AUTH` using `crypto.timingSafeEqual`, `401` on mismatch, and **fail closed if the env var is unset** — never silently accept.

### 1.2 Complete the webhook event map
The current map (`:69-78`) misses three events that matter:
- **`BILLING_ISSUE`** → card declined at conversion. Apple gives a ~16-day grace/retry window. Set `status='billing_retry'` and **keep access** — locking a user out over a temporarily declined card is how you turn a payment blip into a churned customer. `requirePremium` must accept this status.
- **`UNCANCELLATION`** → they cancelled, then changed their mind. Back to `active`.
- **`SUBSCRIBER_ALIAS` / `TRANSFER`** → entitlement moved between app_user_ids. Relevant to the identity-migration risk in §10.

Also: store `trial_end` on `TRIAL_STARTED` (the column exists and is unused), and map `event.product_id` → `'monthly' | 'annual'` rather than storing the raw SKU in `plan`, since the schema says `plan` is one of those two.

### 1.3 `requirePremium` — two small hardenings
- Accept `billing_retry` (see above).
- When the row is **missing** (webhook lost, or a race right after purchase), fall back to a live `getSubscriptionStatus(userId)` RC read and backfill the row, rather than 403-ing someone who genuinely just paid. Cache the negative result briefly so this can't be used to hammer RC.

### 1.4 `GET /subscriptions/status`
Return `{ status, plan, current_period_end, trial_end }` so the client can render "Trial — 3 days left" and the settings screen can show real state.

**That's the whole backend.** No new tables, no trial-grant endpoint, no abuse guard — Apple handles all of it.

---

## 5. Phase 2 — Frontend plumbing

- **`lib/purchases.ts`** (new) — `configurePurchases()`: `Purchases.configure({ apiKey: EXPO_PUBLIC_REVENUECAT_IOS_KEY })`, iOS-guarded, called once from `RootLayout` before the provider tree mounts.
- **`context/subscription-context.tsx`** (new) — mounted **inside** `AuthProvider` (needs the uid) and **above** `InsightsProvider`/`BurnCoachProvider` (they consume `useIsPremium`).
  - On auth → `Purchases.logIn(user.id)` (the **auth uid**, matching `subscriptions.user_id`). On sign-out → `Purchases.logOut()`.
  - `Purchases.addCustomerInfoUpdateListener` — this is what flips the app to locked the instant a trial expires mid-session.
  - Refresh on `AppState → active` (catches expiry that happened while backgrounded).
  - Exposes `{ status: 'loading'|'active'|'trial'|'billing_retry'|'locked', isPremium, isTrial, trialEndsAt, daysLeft, offerings, purchase(pkg), restore(), refresh() }`.
  - `isTrial` comes from the entitlement's `periodType === 'TRIAL'`, so the UI can say "Trial — 3 days left".
- **`hooks/use-is-premium.ts`** — replace `return false` with a context read. This one line turns on cloud coaching phrasing (`makeCoachingPhraser`) and every other gate already wired to it. Nothing downstream changes.
- **`utils/api.ts`** — in `apiFetch`, treat `403` + `body.upgrade_required` (the exact shape `requirePremium` returns) as a signal to refresh the entitlement and let the gate route to the paywall. The server's opinion beats a stale client cache.
- **Post-purchase** → call `POST /subscriptions/verify`, then `refresh()`. This is belt-and-braces so the entitlement lands even if the webhook is slow.

---

## 6. Phase 3 — The paywall screen

**One component, three states, two mount points.**

| State | Headline | Primary CTA | Secondary |
|---|---|---|---|
| Trial-eligible (post-onboarding) | "Your plan is ready." | **Start 7-day free trial** → then $89.99/yr | Monthly $14.99 — no trial |
| Expired / cancelled | "Your trial has ended." | **Annual $89.99** (pre-selected) | Monthly $14.99 |
| Upsell (from settings, dismissible) | "Go Premium" | Annual, pre-selected | Monthly |

- **`app/paywall.tsx`** (new, **root level — not inside `(tabs)`**) — the hard gate. No close button, `gestureEnabled: false`, not swipe-dismissible.
- **`app/(tabs)/profile/paywall.tsx`** — the same component in dismissible mode (rewrite of the placeholder).
- Prices come from `getOfferings()`, **never hardcoded** — the App Store localises them, and hardcoded prices are a routine rejection.

**Apple 3.1.2 — required on the purchase screen** (these are the usual rejection reasons):
- Plan name, price, duration, per plan.
- **The trial terms, stated plainly**: *"7 days free, then $89.99/year. Cancel anytime in Settings."* Apple is strict about trial-to-paid disclosure — burying the $89.99 is the single most likely rejection here.
- Auto-renew disclosure.
- **Restore Purchases** link.
- **Terms of Use + Privacy Policy** links. ⚠️ Currently dead `Text` nodes in auth/onboarding, and `roundfit.co/privacy` isn't hosted — both are open blockers in checklist §1. **The paywall cannot ship until those pages are live.**

**Escape hatches live in the paywall footer.** Because the lock is total, the paywall is the only reachable screen — so it must itself carry: Restore Purchases · Terms · Privacy · Sign out · **Delete account**. Delete-account is non-negotiable (guideline 5.1.1(v)); trapping a user behind a paywall with no way out gets rejected.

**Custom RN screen, not `react-native-purchases-ui`.** RC's remote paywall would let you A/B without shipping, but it can't match the Syne/orange design language. Design consistency matters more at launch than paywall A/B velocity; `react-native-purchases-ui` stays installed for later.

---

## 7. Phase 4 — The hard gate

Extend the existing effect in `app/_layout.tsx:103`. It already handles `needs-profile` and `unauthenticated`; premium is a third rung on the same ladder:

```
if (hasActiveUserSession && subscription.status !== 'loading' && !isPremium
    && top !== 'paywall') → router.replace('/paywall')

if (isPremium && top === 'paywall' && !dismissible) → router.replace('/(tabs)')
```

Two details that matter:
- **Extend `showAuthSplash`** to also cover `subscription.status === 'loading'`. Without it, a paying user cold-starting sees a flash of the paywall before RC's `customerInfo` resolves. This is the most likely visual bug in the whole feature.
- **Onboarding needs no special-casing.** `reveal.tsx:130` calls `setupOAuthProfile()` → status flips to `authenticated` → the gate fires → the user lands on `/paywall`. **The gate *is* the onboarding paywall.** No onboarding screen changes at all.

---

## 8. Phase 5 — Trial reminders

Apple does *not* reliably warn users before a free trial converts, and a surprise $89.99 charge is a refund request. Ours are local notifications (no remote push in this app), scheduled at `TRIAL_STARTED` via `scheduleReminder`, cancelled via `cancelReminder` if they cancel or convert early.

| When | Copy |
|---|---|
| Day 5 (T-2d) | "2 days left of your free trial. You'll be charged $89.99 on [date] — cancel anytime in Settings." |
| Day 6 (T-1d) | "Your free trial ends tomorrow." |

Plus an in-app banner on home from day 5 ("2 days left"), driven off `daysLeft`, with a "Manage subscription" link to `apps.apple.com/account/subscriptions` (already wired at `subscription.tsx:14`).

Being *loud* about the upcoming charge costs you a few cancellations and buys back refund rate, chargeback rate, and App Store review sentiment. It's the right trade at launch.

---

## 9. Phase 6 — Analytics

PostHog events, matching the existing `paywall_viewed` call:
`paywall_viewed { source: onboarding | settings | trial_expired }` · `trial_started` · `purchase_started { plan }` · `purchase_completed { plan, price }` · `purchase_failed { reason }` · `restore_completed { found }` · `trial_expired_locked` · `trial_cancelled`

The number that matters: **trial_started → trial_converted**. Under ~50% for a card-required trial means the day-7 price is the problem (see §0's note on the $89.99 charge).

---

## 10. Risks

1. **Server-side enforcement is partial.** With a hard paywall, the *client* gate is all that stops a modified client from logging food — only the AI routes carry `requirePremium`. Accept for v1 (the attack costs more effort than $14.99, and the expensive routes *are* gated), but know it's a client-side lock.
2. **Identity migration — designed out, see §12.** (Was: RC's `app_user_id` strands on the old auth uid when a profile migrates.) Fixed by billing against an immutable `users.billing_uid` rather than the mutable auth uid.
3. **Sandbox clocks are accelerated.** In sandbox, a 7-day trial elapses in ~3 minutes and a year renews in ~1 hour. Great for testing conversion — but it means you cannot test the day-5 *reminder* in sandbox. Test the reminder scheduler with a shortened offset behind a dev flag.
4. **Hard paywall + card-required trial = the reviewer must transact.** They will use a sandbox account, which works — but if the products aren't fully approved in App Store Connect, `getOfferings()` returns empty and the reviewer sees a paywall with **no buttons**. That's an instant rejection, and it's the most common way this exact feature fails review. The paywall must render a visible error + Restore + support path when offerings are empty, never a dead screen.

---

## 11. Order of work

1. **Phase 0** — dashboards + env. Blocks everything.
2. **Phase 1** — backend. Do the webhook auth first; it's a live hole today.
3. **Phase 2** — SDK config + `SubscriptionProvider` + real `useIsPremium`.
4. **Phase 3** — paywall UI. *Blocked on the legal pages being hosted (checklist §1).*
5. **Phase 4** — the gate + splash fix.
6. **Phase 5/6** — reminders + analytics.
7. **QA matrix (sandbox, real device):** fresh install → onboarding → paywall → start trial → premium on → trial converts (~3 min) → still on → cancel in Settings → expires → **locked** → buy annual → unlocked → delete app → reinstall → **Restore** → premium → **trial refused second time**. Plus: offerings-empty path, a declined card (`BILLING_ISSUE` keeps access), and the §12 identity test (subscribe via Google, sign out, sign in with Apple on the same email → still premium).

---

## 12. Billing identity must not ride on the auth uid

`resolveProfileForAuthUser` **updates `users.id`** onto a new auth uid when the same person arrives via a second provider (Google, then Apple). That is by design. Everything keyed to `users.id` therefore inherits a *mutable* key.

Inside our own DB that's handled: `supabase/migrations/users_id_on_update_cascade.sql` puts `ON UPDATE CASCADE` on every FK referencing `users(id)`, so **`subscriptions.user_id` follows the migration automatically** and `requirePremium` keeps working.

RevenueCat does not get that memo. Its `app_user_id` is still the *old* uid. The result is an asymmetric failure that is uniquely bad for a hard paywall:

> **The server thinks they're premium. The client thinks they're locked out. The §7 gate kicks a paying customer to the paywall.**

Three independent fixes. Do all three — each is cheap.

### 12.1 Prevent the second auth uid (root cause) — ✅ DONE
**Supabase identity linking for matching verified emails is enabled** (2026-07-13). A second provider now attaches an *identity* to the existing auth user instead of minting a new uid, so the migration path stops firing for the Google-then-Apple case.

Verified clean historically — `select email, count(*) from auth.users … having count(*) > 1` returns **no rows**, so no user has ever had two auth uids on the same email.

**But it does not cover Apple "Hide My Email"**, and that is not hypothetical here:

```
select id, email, created_at from auth.users where email like '%privaterelay.appleid.com';
→ 3 rows (2026-05-27, 2026-06-01, 2026-06-16)
```

Private-relay addresses (`…@privaterelay.appleid.com`) can never match a Google address, so Supabase has nothing to link on — a new auth uid is minted and `users.id` migrates. **~1 such user/month and rising**, since Hide My Email is a default-looking choice on the Apple sign-in sheet. 12.2 is therefore load-bearing, not insurance.

### 12.2 Bill against an immutable id (the real fix) — **required**
Add `users.billing_uid uuid not null default gen_random_uuid()` — **never updated, ever.** Use it as RevenueCat's `app_user_id` instead of the auth uid.
- Return `billing_uid` from `/auth/me`.
- Client: `Purchases.logIn(billing_uid)` (not `user.id`).
- Webhook: resolve `app_user_id → billing_uid → user_id` before upserting.

The auth uid can then migrate freely and the billing identity never moves.

**Do this before launch.** It's one column and one lookup while you have zero subscribers. Re-keying live RevenueCat subscribers after launch is a genuinely nasty migration.

### 12.3 Self-heal anyway (belt and braces)
- **OR-merge in `SubscriptionProvider`:** premium if RC says yes **OR** `GET /subscriptions/status` says yes. Because the DB row cascades correctly, the backend already holds the right answer in exactly this scenario — this alone downgrades the bug from "paying customer locked out" to "nothing visible happened."
- **Auto-restore on mismatch:** if the backend says premium and RC says nothing, silently call `Purchases.restorePurchases()`. The receipt is bound to the *Apple ID*, which never changed, so it re-posts; with RC's **Restore Behavior = "Transfer purchases to new App User ID"** (Project Settings), RC moves the entitlement to the current app_user_id and fires `TRANSFER`. Handle that webhook to re-point the row.

**Underlying safety net:** the App Store receipt lives with the Apple ID, so **Restore Purchases always works** — and the hard paywall carries that button by Apple's requirement. Even in total failure the user taps one button. 12.1–12.3 just mean they never have to.
