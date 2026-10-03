/**
 * Subscription / hard-paywall configuration.
 *
 * See `SUBSCRIPTION_PLAN.md`. RevenueCat is the single source of truth for
 * entitlement; the client trusts `customerInfo.entitlements.active[ENTITLEMENT_ID]`.
 */

/**
 * The RevenueCat entitlement identifier that grants premium access.
 *
 * ⚠️ CASE- AND SPACE-SENSITIVE. This is the `lookup_key` of entitlement
 * `entl74256771c7` verbatim: capital R, **lowercase f**, one space. RevenueCat
 * looks it up as a plain object key, so `"RoundFit Pro"` — the way the brand is
 * spelled everywhere else in this codebase, and the way the RevenueCat *product*
 * names are spelled — silently returns `undefined` and reports every paying user
 * as unsubscribed. No error, no warning.
 *
 * The backend must match exactly: `roundfit-backend/src/services/revenuecat.ts`.
 * Changed from `premium` to the dashboard's existing key on 2026-08-31 (decision:
 * keep the dashboard as-is rather than rename the entitlement).
 */
export const ENTITLEMENT_ID = "Roundfit Pro";

/**
 * Use RevenueCat's simulated **Test Store** instead of the real App Store.
 *
 * Tied to `__DEV__` on purpose, never hand-flipped. The RevenueCat SDK refuses a
 * `test_…` key in any release build: it shows a "Wrong API Key" alert and then
 * terminates the app. TestFlight and App Review both run release builds, so a
 * Test Store key there is not "a key that works until Apple approves the IAPs",
 * it is a guaranteed launch crash and an automatic review rejection.
 *
 * Debug builds (simulator, `expo run:ios`, dev client) therefore get the Test
 * Store, where offerings load and purchases complete without App Store Connect.
 * Every release build gets the real `appl_…` key, which in TestFlight and review
 * transacts against the **StoreKit sandbox**: free simulated purchases against
 * the real products, which is the behaviour the Test Store was standing in for.
 *
 * This needs the products to be fetchable from App Store Connect. They are so
 * long as the Paid Applications Agreement is active, including while they sit in
 * `WAITING_FOR_REVIEW`. "None of the products registered in the RevenueCat
 * dashboard could be fetched" almost always means the agreement, not the review
 * state.
 */
export const USE_TEST_STORE = __DEV__;

/**
 * Master switch for the whole paid tier.
 *
 * ON. RoundFit gates **individual Pro surfaces**, not the app. There is no hard
 * launch gate: everyone can log food, workouts, sleep and water, see today's
 * numbers, and keep a streak. Pro buys the AI and analysis layer on top.
 *
 * Pro surfaces, each asking `useProAccess()` and rendering `ProLock` when locked:
 *  - AI daily insight, AI weekly insight (`app/(tabs)/insights/*`)
 *  - Progress detail: recovery, stress, weight trends (`app/(tabs)/progress/*`)
 *  - Food AI photo, barcode scan, food search (`app/(tabs)/log/food/*`)
 *  - LLM coaching phrasing (`hooks/use-daily-coaching.ts`, silent downgrade to
 *    the deterministic template rather than a lock)
 *
 * The backend enforces the same set through `requirePremium`, so a modified
 * client gains nothing but a 403. See SUBSCRIPTION_PLAN.md §3.
 *
 * Setting this to `false` opens every surface to everyone, which is the fastest
 * way to neutralise the paid tier without unpicking call sites.
 *
 * Requires the real `appl_…` key (`REVENUECAT_IOS_KEY`, reaching the app through
 * `app.config.js` → `extra.revenueCatIosKey`) and the hosted legal pages.
 */
export const PAYWALL_ENABLED = true;

/** Source key of a `paywall_viewed` / analytics event, per SUBSCRIPTION_PLAN §9. */
export type PaywallSource = "onboarding" | "settings" | "trial_expired";
