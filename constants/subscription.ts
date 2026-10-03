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
 * Master switch for the hard paywall gate.
 *
 * ON. RoundFit is a hard-gated app: a signed-in user with no active entitlement
 * is redirected to `/paywall` on every launch, and the gate in `app/_layout.tsx`
 * sends them straight back if they dismiss it.
 *
 * That makes the paywall a single point of failure. If `getOfferings()` returns
 * nothing, the purchase button is disabled and there is no way past the screen
 * except Restore, so the whole app is unreachable. Offerings loading on a real
 * device is therefore a release blocker, not a nice-to-have: verify it in
 * TestFlight before every submission. See `app/paywall.tsx` for the
 * `plansUnavailable` state and SUBSCRIPTION_PLAN.md §7 for the gate itself.
 *
 * Requires the real `appl_…` key (`REVENUECAT_IOS_KEY`, reaching the app through
 * `app.config.js` → `extra.revenueCatIosKey`) and the hosted legal pages.
 */
export const PAYWALL_ENABLED = true;

/** Source key of a `paywall_viewed` / analytics event, per SUBSCRIPTION_PLAN §9. */
export type PaywallSource = "onboarding" | "settings" | "trial_expired";
