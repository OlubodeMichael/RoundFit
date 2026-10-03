import { PAYWALL_ENABLED } from '@/constants/subscription';
import { useSubscriptionOptional } from '@/context/subscription-context';

export interface ProAccess {
  /** Whether the user may use Pro surfaces right now. */
  isPro: boolean;
  /** False while RevenueCat is still resolving the entitlement. */
  ready: boolean;
  /** True once the fetch settled with nothing to sell (see `offeringsUnavailable`). */
  unsellable: boolean;
}

/**
 * The single gate every Pro surface asks.
 *
 * Three states matter and they are easy to conflate:
 *
 *  - **not ready** — RevenueCat has not answered yet. Render a skeleton, never a
 *    lock: flashing "upgrade" at a paying subscriber on every cold start is the
 *    most visible way this feature can look broken.
 *  - **unsellable** — offerings settled empty, so there is no purchase to offer.
 *    Locking a surface whose only exit is a paywall that cannot sell traps the
 *    user, so Pro surfaces open instead. This is the same release valve the
 *    router gate uses, and it is what carries the app through the window before
 *    Apple approves the IAPs.
 *  - **locked** — ready, sellable, no entitlement. Show the lock.
 *
 * `PAYWALL_ENABLED` short-circuits everything, so the whole paid tier can be
 * switched off without unpicking call sites.
 */
export function useProAccess(): ProAccess {
  const subscription = useSubscriptionOptional();

  if (!PAYWALL_ENABLED) return { isPro: true, ready: true, unsellable: false };

  const status = subscription?.status ?? 'disabled';
  const unsellable = subscription?.offeringsUnavailable ?? false;

  return {
    // `disabled` means the SDK never configured (non-iOS, missing key). Nothing
    // can be sold there either, so it opens up rather than locking everyone out.
    isPro: (subscription?.isPremium ?? false) || status === 'disabled' || unsellable,
    ready: status !== 'loading',
    unsellable,
  };
}
