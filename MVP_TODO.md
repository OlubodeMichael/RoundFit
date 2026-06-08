# RoundFit — MVP / TestFlight Readiness

---

## HARD BLOCKERS (must fix before TestFlight)

- [ ] Replace ngrok URL in `.env` (`EXPO_PUBLIC_API_URL`) with production backend URL
- [ ] Add missing `EXPO_PUBLIC_API_SECRET_KEY` to `.env`
- [ ] Add a Privacy Policy screen (Apple requires it for App Store / TestFlight)
- [ ] Add a Terms of Service screen
- [ ] Set proper version number and build number in `app.json`
- [ ] Hide or label "Coming Soon" on broken features (photo food analysis, barcode scan, food search)

---

## STUBBED / INCOMPLETE (broken in current state)

### Food Logging
- [ ] `app/(tabs)/log/food/search.tsx` — wire real food database API (e.g. Open Food Facts); currently shows 10 hardcoded mock items
- [x] `app/(tabs)/log/food/photo.tsx` — camera capture → persist to disk → API call → disk-cached result via `utils/photo-cache.ts`
- [ ] `app/(tabs)/log/food/scan.tsx` — scanner UI exists but no barcode decoder library installed (`expo-barcode-scanner` or similar)

### Profile
- [ ] `app/(tabs)/profile/notifications.tsx` — UI and time picker work, but `expo-notifications` not installed so reminders never actually fire
- [x] `app/(tabs)/profile/wearable.tsx` — removed from profile navigation (HealthKit status shown inline on profile screen)
- [ ] `app/(tabs)/profile/targets.tsx` — read-only placeholder, needs full goal editing form + API integration
- [ ] `app/(tabs)/profile/index.tsx` — two dead buttons: "Export Data" and "Help & Support" (`onPress={() => {}}`)

### Insights
- [ ] `app/(tabs)/insights/weekly.tsx` — empty skeleton, needs data aggregation + weekly summary UI

---

## COMPLETELY MISSING

- [ ] **Subscription / Paywall** — `paywall.tsx` and `subscription.tsx` are empty stubs; `react-native-purchases` (RevenueCat) not installed; no free vs premium feature gating
- [ ] **Push Notifications** — `expo-notifications` not in dependencies; install + wire up scheduled reminders
- [ ] **Account Deletion** — mentioned in profile but no UI or API call exists
- [ ] **Food Search Database** — no real search endpoint; users limited to manual entry

---

## ENGAGEMENT / DELIGHT

- [ ] **Goal celebration screen** — full-screen branded celebration when a daily target (steps, calories, protein) is first reached for the day.
  - **Trigger:** detect threshold crossing in home/summary context (value goes from below → at/above target in the same render cycle)
  - **Local storage guard:** `AsyncStorage` key `roundfit:celebrated:<userId>:<YYYY-MM-DD>:<goalType>` — write on first trigger, read on mount to skip re-firing after app restart. Clear stale keys on sign-out.
  - **Design (branded, not generic):** RoundFit orange + dark palette, large bold metric ("10,000 STEPS"), animated number count-up, custom particle burst using `react-native-reanimated` (no third-party confetti lib — keep it ours). Dismissable by tap anywhere or auto-dismiss after 4s.
  - Goals to celebrate: `calories`, `steps`, `protein` (each fires independently)

- [ ] **Badge reward system** — persistent badges users earn and keep, displayed in profile.
  - **Architecture:** `badges` table in Supabase (`user_id`, `badge_id`, `earned_at`). Badge definitions live in a config file (not DB) so new badges ship with app updates. Frontend fetches earned badge IDs and maps them to the local config for display.
  - **Display:** trophy/badge shelf in the profile tab — locked badges shown as greyed-out silhouettes, earned ones lit up with earn date.
  - **Business logic:** TBD — define trigger conditions per badge before implementing the award engine (server-side vs. client-side evaluation TBD).
  - **Celebration hook:** earning a badge triggers the goal celebration screen with a special badge variant.

---

## POST-LAUNCH (phase 2)

- [ ] Barcode food scan — full implementation
- [x] Photo food analysis — camera capture → base64 → API → meal creation (+ disk cache)
- [ ] Claude AI insights — `@anthropic-ai/sdk` not installed, premium feature
- [ ] Weekly insight reports — data aggregation + report generation
- [ ] Pattern detection — personalized correlation insights (sleep → energy, protein → muscle, etc.)
- [ ] Wearable settings — granular HealthKit permission management
- [ ] Data export (GDPR)
- [ ] Crash reporting / analytics (Firebase Crashlytics)
- [ ] Android Health Connect integration (currently returns null on Android)
- [ ] Offline sync / request queue for failed API calls

---

## WHAT IS FULLY WORKING

- Auth — sign in, sign up, forgot password, reset password, change password, token refresh, session persistence
- Onboarding — full multi-step flow (age, sex, height, weight, goal, activity, cycle, HealthKit)
- Manual food logging — all macros, meal labels, real API, optimistic UI
- Workout logging — full exercise library, sets/reps/weight, duration, calorie burn
- Sleep logging — bedtime/wake pickers, quality rating, HealthKit hypnogram sync
- Weight & body measurement logging — unit toggle, delta display, real API
- Home dashboard — calorie ring, macros, meal sections, water tracker, steps, check-in modal
- Cycle tracking — phase visualization, period logging, tips (female users)
- Progress tab — weight chart, steps counter, mirror/photo UI skeleton
- Insights — rule-based insights, dismiss, history
- Profile — avatar upload, edit profile, dark/light mode, HealthKit connect
- HealthKit — steps, calories, sleep stages, heart rate, weight all syncing
