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
 * ON while the App Store products sit in `WAITING_FOR_REVIEW`: StoreKit returns
 * no products for them yet, so `getOfferings()` fails with "None of the products
 * registered in the RevenueCat dashboard could be fetched from App Store Connect"
 * and the paywall has no plans to show. The Test Store serves the same offering
 * (`RoundFit Pro`, with `$rc_annual` + `$rc_monthly`) from RevenueCat's own
 * backend, so offerings load, purchases complete, and the `Roundfit Pro`
 * entitlement turns on, all without App Store Connect or a real device.
 *
 * ⚠️ MUST be `false` before any build that reaches real users. Test Store
 * purchases are simulated: they take no money and would hand every installer a
 * free entitlement. `configurePurchases()` logs a release-visible warning while
 * this is on, and SUBMISSION_CHECKLIST.md tracks flipping it back.
 *
 * Flip to `false` once the IAPs are approved in App Store Connect.
 */
export const USE_TEST_STORE = true;

/**
 * Master switch for the hard paywall gate.
 *
 * **OFF until Phase 0 of SUBSCRIPTION_PLAN.md is complete** — i.e. real App Store
 * Connect products are approved, a real iOS RevenueCat public SDK key is set in
 * `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, and the legal pages are hosted.
 *
 * While `false`:
 *  - `Purchases` still configures and the SubscriptionProvider still runs, so
 *    `useIsPremium()` reflects any real entitlement (keeps cloud AI paths honest).
 *  - The router gate in `app/_layout.tsx` does NOT force-redirect to `/paywall`,
 *    so the app is fully usable in dev/TestFlight without a subscription.
 *
 * Flipping this to `true` turns RoundFit into a hard-gated app: no entitlement →
 * every launch lands on `/paywall`. Do not enable until offerings load on device.
 */
export const PAYWALL_ENABLED = false;

/** Source key of a `paywall_viewed` / analytics event, per SUBSCRIPTION_PLAN §9. */
export type PaywallSource = "onboarding" | "settings" | "trial_expired";
