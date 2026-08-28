/**
 * Subscription / hard-paywall configuration.
 *
 * See `SUBSCRIPTION_PLAN.md`. RevenueCat is the single source of truth for
 * entitlement; the client trusts `customerInfo.entitlements.active[ENTITLEMENT_ID]`.
 */

/**
 * The RevenueCat entitlement identifier that grants premium access.
 *
 * ⚠️ Must match the entitlement `lookup_key` in the RevenueCat dashboard AND the
 * backend (`services/revenuecat.ts` reads `entitlements['premium']`). Reconciled
 * to `premium` on 2026-07-14 (the dashboard previously only had `Roundfit Pro`).
 */
export const ENTITLEMENT_ID = "premium";

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
