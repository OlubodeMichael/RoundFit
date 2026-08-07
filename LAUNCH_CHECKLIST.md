# RoundFit — Launch Checklist (Paid v1)

**Scope decided:** Paid launch (RevenueCat wired) + crash reporting before release.
**Generated:** 2026-07-06 — verified against current code, supersedes the stale `MVP_TODO.md` / `TODO.md`.

Legend: 🔴 blocker · 🟡 needed for paid scope · 🟢 recommended · ⚪ post-launch

---

## 0. Already done / working (no action)
- Cycle feature disabled behind `CYCLE_ENABLED` (see `CYCLE_FEATURE_REMOVAL_PLAN.md`).
- Auth, onboarding, food/workout/sleep/weight logging, home, readiness, insights, HealthKit sync.
- Badges (12-badge system) live.
- Notifications installed **and** wired (`utils/notifications.ts`, daily-insight delivery).
- Bundle IDs set (`co.roundfit.app`), version `1.0.0`.
- Backend RevenueCat scaffolding exists: `POST /subscriptions/webhook`, `POST /subscriptions/verify`, `GET /subscriptions/status` + `services/revenuecat.ts`.

---

## 1. 🔴 Hard blockers (independent of monetization)

- [ ] **Host legal pages.** Profile links to `https://roundfit.co/privacy` and `/terms` (`profile/index.tsx:38-39`). These must be live before App Review.
- [ ] **Wire legal links in auth + onboarding.** "Terms"/"Privacy Policy" are dead `Text` (no `onPress`):
      `app/auth/auth-options.tsx:160-162`, `components/onboarding/OnboardingSignupAuth.tsx:197-199`. Apple checks the signup consent flow.
- [ ] **Set iOS `buildNumber`** in `app.json` (currently undefined) — EAS submit / App Store requires it.
- [ ] **Production `.env`:** confirm `EXPO_PUBLIC_API_URL` points to prod backend (not ngrok) and `EXPO_PUBLIC_API_SECRET_KEY` is set.
- [ ] **App Store Connect listing:** screenshots (6.7" + 6.5" required), description, keywords, privacy nutrition labels, support URL, age rating.

---

## 2. 🔴 Backend security hardening (pre-launch, from security review)
- [ ] **RLS:** service-role key bypasses row-level security everywhere. Move user-scoped reads/writes to per-user auth or add explicit ownership checks.
  - [x] **Boot guard added** (`config/supabase.ts`): rejects `sb_publishable_` keys and cross-project/wrong-role service JWTs so a misconfigured key fails loudly at startup instead of silently downgrading to `anon` (which caused the `user_badge_awards` RLS insert error). **Action:** verify the *deployed* backend's `SUPABASE_SERVICE_ROLE_KEY` is this project's service_role secret.
- [ ] **Stop leaking DB errors** to clients — return generic messages, log details server-side.
- [ ] **Verify the RevenueCat webhook** signature in `POST /subscriptions/webhook` (currently unverified — now in scope since we're shipping paid).

---

## 3. 🟡 Monetization — wire RevenueCat (frontend)
Backend endpoints exist; the frontend is a stub (`Purchases.configure()` is never called, `paywall.tsx`/`subscription.tsx` upgrade path is placeholder, no feature gating).

- [ ] **Configure SDK** on launch: `Purchases.configure({ apiKey })` in `app/_layout.tsx`, keyed per platform. Identify user (`Purchases.logIn(userId)`) after auth.
- [ ] **App Store Connect products:** monthly ($9.99) + annual ($79) with 7-day free trial; mirror as a RevenueCat Offering/entitlement.
- [ ] **Subscription context/hook** (new): fetch `GET /subscriptions/status` (or RC `getCustomerInfo`) → expose `isPremium`. Refresh on app foreground and after purchase.
- [ ] **Real paywall UI** (`paywall.tsx`): free-vs-premium comparison, offerings from `getOfferings()`, purchase buttons, **Restore Purchases** link (Apple-required), links to Terms/Privacy.
- [ ] **Post-purchase:** call `POST /subscriptions/verify`, then refresh entitlement.
- [ ] **Feature gating:** decide the premium set (likely Claude/AI insights, weekly/30-day reports, pattern detection) and gate them via the `isPremium` flag with soft-sell upgrade prompts.
- [ ] **Sandbox test:** purchase, restore, trial→paid, expiry — on a real device with an iOS sandbox account.

---

## 4. 🟢 Crash reporting (decided: include)
- [ ] Install + configure error reporting (`@sentry/react-native` or `expo-insights`/Crashlytics). Not currently installed; PostHog covers product analytics but not crashes.
- [ ] Wrap root in error boundary; verify a forced test crash appears in the dashboard.
- [ ] Enable source maps upload in the EAS build so stack traces symbolicate.

---

## 5. 🟡 Feature completeness / "coming soon" hygiene
- [ ] **Barcode scan** (`log/food/scan.tsx`): UI exists, no decoder installed. Either implement (`expo-camera` barcode support is available) or hide the entry point for v1.
- [ ] **Food search** (`log/food/search.tsx`): confirm it hits a real DB (Edamam/Open Food Facts) or is hidden. (TODO.md lists it as unfinished — verify current state.)
- [ ] Sweep for any remaining dead buttons / placeholder screens and hide or finish them.

---

## 6. 🟢 On-device AI daily coaching — OpenAI cost cut (full plan: `ONDEVICE_LLM_PLAN.md`)

Route the **in-app foreground daily summary + suggestion** to Apple's on-device LLM on capable devices, OpenAI otherwise.
Cost optimization, not a submission blocker — **can ship as a fast-follow** if timelines are tight. Decisions locked:
everyone routes by device; EAS is on Xcode 26 (no toolchain blocker).

**Scope guard:** on-device applies ONLY to the in-app `claudeInsight` on `app/(tabs)/insights/daily.tsx:182` + the home
insight card. The **background daily-insight notification** (`utils/daily-insight-delivery.ts`) and **weekly/30-day
reports** STAY on OpenAI (Foundation Models can't run in a background window).

**6.0 — Quality gate (do first, before any Swift):** ✅ DONE → `DAILY_COACHING_TEMPLATE.md` + runnable harness
- [x] Coaching **template + `@Generable` schema** (`title` + `message` + `focus` enum), mirroring the existing coach voice.
- [x] 6-scenario **eval set** with facts → acceptable output + scoring rubric.
- [x] **Executable harness:** `roundfit-backend/src/scripts/eval-{scenarios,daily-coaching}.ts` + `npm run eval:coaching`; shared `generateDailyInsightFromPrompt()` so the gpt-4o baseline uses the app's exact prompt. Emits `eval-results.json` scoring sheet (tsc clean).
- [ ] **Run it:** `npm run eval:coaching` for the gpt-4o baseline, paste on-device outputs, score. (Needs `OPENAI_API_KEY`; on-device half needs an iOS 26 device.)

**6.A — Backend split (`insights.controller.ts` + `openai.ts`), non-breaking:** ✅ DONE (backend tsc clean)
- [x] `GET /insights/ai/context` (`requirePremium`) → returns `{ systemPrompt, userPrompt }` from `buildDailyInsightPrompt`, **no OpenAI call** (this is the saving).
- [x] `POST /insights/ai/persist` → saves an on-device insight via shared `saveDailyAIInsight(...)` refactored out of `getAIInsight`.
- [x] Exported `DAILY_INSIGHT_SYSTEM_PROMPT` (shared voice); tags `context.generated_by`/`model`. On-device path calls `/persist` directly → never hits the 3/day cap (D2: unmetered). *Note: cap query counts `type='claude'` rows, so a rare same-day OpenAI fallback still counts on-device rows — acceptable edge case.*

**6.B — Expo native module `modules/apple-llm` (clone `modules/workout-live-activity`):** ✅ CODE-COMPLETE (needs EAS build to compile/run)
- [x] `isAvailable()` → maps `SystemLanguageModel.default.availability` (`deviceNotEligible`/`appleIntelligenceNotEnabled`/`modelNotReady`/`unsupportedOS`) to JS; Android/absent module → `moduleMissing`.
- [x] `generate(systemPrompt, userPrompt)` with **guided generation** (`@Generable DailyCoaching` = title/message/focus enum), behind `@available(iOS 26)` + `#if canImport(FoundationModels)` guards (deploy target stays 15.1).
- [x] `prewarm()` (best-effort). Token **streaming** deferred (single response for v1).
- [x] TS interface + autolink symlink (`node_modules/apple-llm`); isolated `tsc` clean.
- [ ] **Run a new EAS dev build (not Expo Go) on an iOS 26 device** — confirm the Swift compiles against the iOS 26 SDK, the module autolinks, and `isAvailable()`/`generate()` work on-device. *(Swift can't be compiled here; `ExpoModulesCore` resolves only after `pod install` during prebuild.)*

**6.C — Frontend routing (`context/insights-context.tsx`):** ✅ DONE (tsc clean, 136 tests pass)
- [x] `isAppleLLMAvailable()` checked at fetch time (always current — implicitly handles the foreground re-check).
- [x] `fetchClaudeInsight` routes: available → `/insights/ai/context` → on-device `generateDailyCoaching` → `/insights/ai/persist`; else → existing `/insights/ai`. Split into `fetchClaudeInsightOnDevice` + `fetchClaudeInsightViaOpenAI` with a shared `applyClaudeInsight`.
- [x] Graceful fallback: on-device returning null OR throwing falls through to OpenAI. Best-effort `prewarmAppleLLM()` on tab load.
- [x] `InsightType 'apple'` **not needed** — backend persists on-device rows as `type='claude'` (identical display); the path is distinguished by `context.generated_by='apple_fm'` for analytics only.

**6.D — Verify savings:** ✅ TOOLING READY → `docs/insight-cost-savings.md` (numbers need live traffic)
- [x] Cost-savings SQL report: savings rate (`pct_on_device`), est. USD avoided (grounded in real avg tokens), daily trend, per-path adoption, and an anomaly cross-check on `generation_model` vs `context->>'generated_by'`.
- [ ] Run post-deploy once eligible devices are generating; confirm `pct_on_device` climbs (OpenAI calls drop).

---

## 6.5 🟢 Coach re-architecture — rules decide, LLM phrases (Phases 1–3 DONE)

Non-negotiable principle: a deterministic engine picks the directive + actions; the LLM (Apple FM/OpenAI) only
rephrases the finished decision; a template renderer always produces a valid message if the LLM fails. Reuses the
§6 Apple FM/OpenAI infra as the **phrasing** layer.

**Phase 1 — Deterministic decision engine (pure, fully tested):** ✅ DONE (23 tests, 159 total; tsc clean)
- [x] `types/daily-coaching.ts` — `DailyCoachingInput` / `DailyCoachingDecision` (directive, safety_override, primary_reason, secondary_action, habit_nudge, dropped[], confidence, nutrition_gap, assembled_at).
- [x] `utils/nutrition-gap-ranker.ts` — `gap_score` over **logged days only**, weighted by logging completeness; never reports more days-under than logged.
- [x] `utils/coaching-duration.ts` — directive → duration with late-luteal cap.
- [x] `utils/daily-coaching.ts` — `assembleDailyCoachingDecision`: priority ladder (Slot 0 safety [2-of-3 illness OR 3 hard days force rest; 1 signal caps to light], Slot 1 readiness directive, Slot 2 nutrition gap, Slot 3 hydration nudge only if no gap). Confidence reshapes copy (minimal → "go by feel"); explicit cold-start path.
- [x] `utils/coaching-template.ts` — deterministic renderer covering every field combo (incl. ugly ones) + `coachingTitle`.
- [x] `__tests__/daily-coaching.test.ts` — safety ordering, 2-signal illness, protein beats hydration, luteal cap, minimal-confidence copy, drop-on-safety, ranker ignores unlogged days, template renders every combo.

**Phase 1b — Repoint the LLM to phrasing (critical fix):** ✅ DONE (161 tests, both packages tsc clean)
- [x] Phrasing prompt `DAILY_COACHING_PHRASING_PROMPT` (backend) — input is the decision only, use numbers exactly, directive first, 2–3 sentences, safety rules kept. Old `DAILY_INSIGHT_SYSTEM_PROMPT` (author) retained only for legacy `/insights/ai` until Phase 2 removes it.
- [x] `utils/coaching-prompt.ts` `buildPhrasingPrompt(decision)` (frontend serializer, tested) — the sole model input; raw data never reaches the LLM.
- [x] `generateCoachingFromPrompt()` (backend) — gpt-4o under the phrasing prompt (OpenAI path + eval baseline).
- [x] Eval rewritten to feed **decisions**: `eval-scenarios.ts` = 6 serialized `decisionPrompt`s + gold `reference`s (E4 = safety "eat closer to target"); runner uses `generateCoachingFromPrompt`.

**Phase 2 — Data hook:** ✅ DONE (41 coaching tests; tsc clean)
- [x] `hooks/use-daily-coaching.ts` — assembles input from existing contexts (recovery/summary/cycle/checkin/water/workout/health), caches the decision per day by fingerprint, recomputes on check-in/sleep/nutrition/workout/water mutations via `today-sync`.
- [x] Fallback chain **Apple FM → OpenAI → `renderCoachingTemplate`** (never a blank card, even offline) in `resolve-coaching-message.ts`. Single response, not streaming.

**Phase 3 — Mascot + honest badge + card:** ✅ DONE (Lottie art separate — ships with Obsidian PNG moods)
- [x] `components/mascot/AnimatedMascot.tsx` (native breathing/float/bounce/sway per mood; reduce-motion aware; `moodFromDirective` / `moodFromReadinessRecommendation`). Wired into `ReadinessWidget` (readiness-driven) **and** `CoachingCard` (directive-driven).
- [x] Honest badge (`utils/coaching-badge.ts` + `hooks/use-coaching-badge.ts`): count = distinct fresh events (directive +nutrition +hydration), capped at 3, never padded; clears on open by fingerprint; re-badges only on genuinely new info; yesterday's unread expires (decision is always today's). 7 tests.
- [x] `components/home/CoachingCard.tsx` — mounts the Phase-2 hook, broadcasts the real directive through the mascot, "Why this?" slide-up (primary_reason + nutrition-gap numbers + `dropped` "also considered" + honest source attribution). Mounted on the home screen above the readiness widget.
- [x] **Cloud phrasing gated to premium client-side** (`hooks/use-is-premium.ts` → `makeCoachingPhraser`): free users skip the OpenAI leg entirely (no wasted 403) and get Apple FM / template; the `/insights/coaching/phrase` route stays `requirePremium`. ⚠️ `useIsPremium` is a **stub returning false** until RevenueCat frontend (§3) lands, so cloud coaching phrasing is off app-wide until then — flip it on by wiring the entitlement check in that one hook.

---

## 7. 🟢 Pre-submit QA pass
- [ ] Full new-user flow on a real device: onboarding → log → check-in → insight → paywall → sandbox purchase → premium unlock.
- [ ] Restore purchases works on a fresh install.
- [ ] Free tier is useful stand-alone; all premium features correctly gated.
- [ ] Layout pass: iPhone SE (small) + Pro Max (large).
- [ ] Dark-mode pass on all screens.
- [ ] HealthKit on a real device with real data.
- [ ] `npm test` green; no new type errors.

---

## 8. ⚪ Post-launch (phase 2)
- Barcode scan (if deferred), weekly/30-day AI reports, pattern detection.
- Extend on-device LLM to weekly reports (once daily coaching is proven — see `ONDEVICE_LLM_PLAN.md` §7).
- Android Health Connect (returns null today).
- GDPR data export.
- Offline request queue.
- Re-enable cycle feature (flip `CYCLE_ENABLED`; see its plan).
- Apple Watch companion — readiness glance, water quick-log, workout remote-control (full phased plan: `WATCH_PLAN.md`). Launch cut = Phase 0+1 only *if* pursued in v1; Phase 3 (standalone `HKWorkoutSession`) is post-launch.

---

## Suggested order
1. Security hardening (#2) + hard blockers (#1) — these gate *any* submission.
2. RevenueCat frontend (#3) — the long pole for paid scope.
3. Crash reporting (#4) — quick, do before TestFlight so beta crashes are captured.
4. Feature hygiene (#5) → QA (#7) → submit.
5. On-device AI coaching (#6) — cost optimization; **fast-follow** unless you want the savings in v1. Start with the
   quality gate (#6.0) and backend split (#6.A), which are non-breaking and can land independently of the native module.
