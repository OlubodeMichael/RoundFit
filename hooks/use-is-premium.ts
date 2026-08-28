import { useSubscriptionOptional } from "@/context/subscription-context";

/**
 * Whether the current user has an active premium entitlement (paying OR in the
 * 7-day free trial — both look identical here, by design).
 *
 * Reads the RevenueCat-backed `SubscriptionProvider`. Falls back to `false` when
 * rendered outside the provider or before the SDK is configured, so free-forever
 * paths (on-device Apple FM phrasing, deterministic templates) still run for
 * everyone while cloud (paid) paths stay gated.
 */
export function useIsPremium(): boolean {
  const subscription = useSubscriptionOptional();
  return subscription?.isPremium ?? false;
}
