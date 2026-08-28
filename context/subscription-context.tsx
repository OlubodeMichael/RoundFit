/**
 * Subscription / entitlement state — the client's view of RevenueCat.
 *
 * See `SUBSCRIPTION_PLAN.md` §5. RevenueCat is the source of truth; this provider
 * mirrors `customerInfo.entitlements.active[ENTITLEMENT_ID]` into React state and
 * exposes it to (a) `useIsPremium()` — every existing feature gate — and (b) the
 * hard-paywall router gate in `app/_layout.tsx`.
 *
 * Mount rules: INSIDE `AuthProvider` (needs the auth uid to `logIn`) and ABOVE
 * `InsightsProvider` / `BurnCoachProvider` (they consume `useIsPremium`).
 *
 * The trial is not a special path: during a 7-day free trial the entitlement is
 * active with `periodType === 'TRIAL'`, so `isPremium` is already `true`.
 */
import { configurePurchases, isPurchasesConfigured } from "@/lib/purchases";
import { ENTITLEMENT_ID } from "@/constants/subscription";
import { hasActiveUserSession, useAuth } from "@/context/auth-context";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";

/**
 * `loading`  — configured, awaiting the first `customerInfo`.
 * `premium`  — entitlement active (paying OR trialling).
 * `locked`   — configured, no active entitlement.
 * `disabled` — SDK not configured (non-iOS, or no key yet). Never gates.
 */
export type SubscriptionStatus = "loading" | "premium" | "locked" | "disabled";

export interface SubscriptionValue {
  status: SubscriptionStatus;
  isPremium: boolean;
  /** Active entitlement is in its free-trial period. */
  isTrial: boolean;
  /** ISO date the current entitlement (trial or paid) ends, if known. */
  currentPeriodEnd: string | null;
  /** Whole days left until `currentPeriodEnd` (>= 0), or null. */
  daysLeft: number | null;
  offerings: PurchasesOfferings | null;
  /** Buy a package. Resolves true when the entitlement is active afterwards. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Restore prior purchases (required on the hard paywall by Apple). */
  restore: () => Promise<boolean>;
  /** Force a fresh `customerInfo` read from RevenueCat. */
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

function entitlementFrom(info: CustomerInfo | null) {
  return info?.entitlements.active[ENTITLEMENT_ID] ?? null;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, user } = useAuth();

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [ready, setReady] = useState(false);
  const configuredRef = useRef(false);
  const loggedInUidRef = useRef<string | null>(null);

  // Configure once on mount. No-ops on non-iOS / missing key.
  useEffect(() => {
    configuredRef.current = configurePurchases();
  }, []);

  const loadOfferings = useCallback(async () => {
    if (!isPurchasesConfigured()) return;
    try {
      setOfferings(await Purchases.getOfferings());
    } catch (err) {
      if (__DEV__) console.warn("[subscription] getOfferings failed:", err);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isPurchasesConfigured()) return;
    try {
      setCustomerInfo(await Purchases.getCustomerInfo());
    } catch (err) {
      if (__DEV__) console.warn("[subscription] getCustomerInfo failed:", err);
    }
  }, []);

  // Live updates — flips the app to locked the instant a trial expires mid-session.
  useEffect(() => {
    if (!configuredRef.current) return;
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  // Identity: RevenueCat app_user_id follows the signed-in user.
  // NOTE: uses the auth uid today. SUBSCRIPTION_PLAN §12.2 requires switching to
  // an immutable `users.billing_uid` before launch so the billing identity never
  // moves when a profile migrates across auth providers.
  useEffect(() => {
    if (!configuredRef.current) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (hasActiveUserSession(authStatus, user)) {
          if (loggedInUidRef.current !== user.id) {
            const { customerInfo: info } = await Purchases.logIn(user.id);
            loggedInUidRef.current = user.id;
            if (!cancelled) setCustomerInfo(info);
          }
          await loadOfferings();
        } else if (authStatus === "unauthenticated") {
          if (loggedInUidRef.current !== null) {
            await Purchases.logOut();
            loggedInUidRef.current = null;
          }
          if (!cancelled) setCustomerInfo(null);
        }
      } catch (err) {
        if (__DEV__) console.warn("[subscription] identity sync failed:", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, user, loadOfferings]);

  // Catch expiry that happened while backgrounded.
  useEffect(() => {
    if (!configuredRef.current) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return !!entitlementFrom(info);
    },
    [],
  );

  const restore = useCallback(async (): Promise<boolean> => {
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
    return !!entitlementFrom(info);
  }, []);

  const entitlement = entitlementFrom(customerInfo);
  const configured = configuredRef.current || isPurchasesConfigured();

  let status: SubscriptionStatus;
  if (!configured || Platform.OS !== "ios") status = "disabled";
  else if (!ready) status = "loading";
  else if (entitlement) status = "premium";
  else status = "locked";

  const currentPeriodEnd = entitlement?.expirationDate ?? null;

  const value: SubscriptionValue = {
    status,
    isPremium: status === "premium",
    isTrial: entitlement?.periodType === "TRIAL",
    currentPeriodEnd,
    daysLeft: daysUntil(currentPeriodEnd),
    offerings,
    purchase,
    restore,
    refresh,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/** Throws if used outside the provider. */
export function useSubscription(): SubscriptionValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used inside <SubscriptionProvider>");
  return ctx;
}

/** Non-throwing variant for code that may render outside the provider. */
export function useSubscriptionOptional(): SubscriptionValue | null {
  return useContext(SubscriptionContext);
}
