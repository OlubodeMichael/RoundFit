/**
 * Whether the current user has an active premium entitlement.
 *
 * ⚠️ INTERIM STUB. The RevenueCat frontend is not wired yet (see LAUNCH_CHECKLIST §3
 * and `app/(tabs)/profile/paywall.tsx`), so the client has no entitlement source of
 * truth. Returning `false` keeps every *cloud* (paid) AI path — e.g. OpenAI coaching
 * phrasing — off app-wide until entitlements exist. Free-forever paths are unaffected:
 * on-device Apple FM phrasing and the deterministic template still run for everyone.
 *
 * When RevenueCat lands, replace the body with the real `customerInfo` entitlement
 * check (e.g. `Purchases.getCustomerInfo()` → `entitlements.active['premium']`), and
 * every premium gate that reads this hook flips on automatically.
 */
export function useIsPremium(): boolean {
  return false;
}
