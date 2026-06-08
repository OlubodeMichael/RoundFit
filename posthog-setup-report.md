<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into RoundFit. Here's a summary of every change made:

- **`app.config.js`** — Converted from `app.json` to a JS config to support dynamic env vars. Added `posthogProjectToken` and `posthogHost` extras sourced from `.env`.
- **`.env`** — Created with `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` (gitignore coverage ensured).
- **`lib/posthog.ts`** — New file. Singleton PostHog client configured via `expo-constants`, with app lifecycle capture, debug mode in dev, and graceful no-op when token is missing.
- **`app/_layout.tsx`** — Wrapped the entire app in `PostHogProvider`. Added manual screen tracking using `usePathname` + `useGlobalSearchParams` from Expo Router.
- **`app/auth/login.tsx`** — Captures `user_signed_in` and calls `posthog.identify()` on successful login.
- **`app/auth/sign-up.tsx`** — Captures `user_signed_up` with onboarding properties (goal, activity, sex). Calls `posthog.identify()` with `$set_once` for sign-up date. Error tracking on failure.
- **`app/onboarding/goal.tsx`** — Captures `onboarding_goal_selected` with the chosen goal when the user taps Continue.
- **`app/(tabs)/log/food/manual.tsx`** — Captures `food_logged_manual` with calorie count, meal label, and macro presence flags. Error tracking on failure.
- **`app/(tabs)/log/food/search.tsx`** — Captures `food_searched` with query text and result count on search submission.
- **`app/(tabs)/log/food/photo.tsx`** — Captures `food_photo_capture_started` when user taps "Open camera".
- **`app/(tabs)/log/sleep.tsx`** — Captures `sleep_logged` with hours, quality, source (healthkit/manual), and whether it's for today. Error tracking on failure.
- **`app/(tabs)/log/weight.tsx`** — Captures `weight_logged` with value in kg, unit, and delta from previous. Error tracking on failure.
- **`app/(tabs)/log/workout.tsx`** — Captures `workout_logged` with type, duration, intensity, exercise count, and estimated calories.
- **`app/(tabs)/profile/paywall.tsx`** — Captures `paywall_viewed` on mount.
- **`app/(tabs)/profile/index.tsx`** — Captures `health_connected` after Apple Health authorization. Captures `user_signed_out` and calls `posthog.reset()` before signing out.

## Events

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User completes account creation | `app/auth/sign-up.tsx` |
| `user_signed_in` | User logs in with email/password | `app/auth/login.tsx` |
| `onboarding_goal_selected` | User picks their fitness goal during onboarding | `app/onboarding/goal.tsx` |
| `food_logged_manual` | User logs a meal by entering name and calories manually | `app/(tabs)/log/food/manual.tsx` |
| `food_searched` | User submits a food search query | `app/(tabs)/log/food/search.tsx` |
| `food_photo_capture_started` | User opens the AI photo meal analysis camera | `app/(tabs)/log/food/photo.tsx` |
| `sleep_logged` | User saves a sleep entry | `app/(tabs)/log/sleep.tsx` |
| `weight_logged` | User saves a weight reading | `app/(tabs)/log/weight.tsx` |
| `workout_logged` | User saves a workout session | `app/(tabs)/log/workout.tsx` |
| `paywall_viewed` | User opens the premium paywall screen | `app/(tabs)/profile/paywall.tsx` |
| `health_connected` | User successfully connects Apple Health | `app/(tabs)/profile/index.tsx` |
| `user_signed_out` | User taps Sign Out | `app/(tabs)/profile/index.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/415860/dashboard/1562054
- **Signup → First Log (Conversion Funnel)**: https://us.posthog.com/project/415860/insights/9lfUK09y
- **Daily Active Loggers**: https://us.posthog.com/project/415860/insights/nfQYCjHH
- **New Users This Week**: https://us.posthog.com/project/415860/insights/t7xghpoJ
- **Paywall Views vs Sign Outs (Churn Signals)**: https://us.posthog.com/project/415860/insights/CFNVtA1n
- **Food Logging Methods**: https://us.posthog.com/project/415860/insights/9QYv4hFk

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
