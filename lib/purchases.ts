/**
 * RevenueCat SDK configuration.
 *
 * `configurePurchases()` is called once from `RootLayout` before the provider
 * tree mounts (see `app/_layout.tsx`). iOS-only for now, RoundFit sells through
 * the App Store; Android/web return early.
 *
 * Two stores are wired:
 *
 *  - **App Store** (`extra.revenueCatIosKey`, from `REVENUECAT_IOS_KEY`, an
 *    `appl_…` key). Real StoreKit purchases. Requires the products to be
 *    fetchable from App Store Connect, which needs an approved (or at least
 *    submitted) IAP, an active Paid Applications Agreement, and a real device.
 *  - **Test Store** (`extra.revenueCatTestStoreKey`, from
 *    `REVENUECAT_TEST_STORE_KEY`, a `test_…` key). RevenueCat's simulated store:
 *    offerings load and purchases complete without App Store Connect, so the
 *    paywall and every entitlement path are testable in the simulator and in
 *    dev builds while Apple review is pending.
 *
 * `USE_TEST_STORE` in `constants/subscription.ts` picks exactly one of them and
 * is `__DEV__`, so the Test Store can only be reached from a debug build. The
 * RevenueCat SDK kills any release build configured with a `test_…` key, so a
 * TestFlight or App Review build always uses the App Store key and transacts
 * against the StoreKit sandbox. Configuration is a no-op when the selected key
 * is missing.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

import { USE_TEST_STORE } from "@/constants/subscription";

const APP_STORE_KEY = Constants.expoConfig?.extra?.revenueCatIosKey as string | undefined;
const TEST_STORE_KEY = Constants.expoConfig?.extra?.revenueCatTestStoreKey as
  | string
  | undefined;

/** Which RevenueCat store the SDK is talking to, once configured. */
export type PurchasesStore = "app_store" | "test_store";

let configured = false;
let activeStore: PurchasesStore | null = null;

/** True once `Purchases.configure` has run with a usable key. */
export function isPurchasesConfigured(): boolean {
  return configured;
}

/** The store the SDK was configured against, or null before configuration. */
export function purchasesStore(): PurchasesStore | null {
  return activeStore;
}

/** True when the SDK is running against the simulated Test Store. */
export function isTestStore(): boolean {
  return activeStore === "test_store";
}

/**
 * Configure RevenueCat exactly once. Safe to call on every launch; subsequent
 * calls no-op. Returns whether the SDK is now usable.
 */
export function configurePurchases(): boolean {
  if (configured) return true;
  if (Platform.OS !== "ios") return false;

  const store: PurchasesStore = USE_TEST_STORE ? "test_store" : "app_store";
  const apiKey = USE_TEST_STORE ? TEST_STORE_KEY : APP_STORE_KEY;

  if (!apiKey) {
    console.warn(
      `[purchases] no RevenueCat key for the ${store}, RevenueCat is disabled. Set ` +
        (USE_TEST_STORE ? "REVENUECAT_TEST_STORE_KEY (test_…)." : "REVENUECAT_IOS_KEY (appl_…)."),
    );
    return false;
  }

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  configured = true;
  activeStore = store;

  // Loud on purpose, including in release builds: a Test Store binary takes no
  // real money and grants entitlements to anyone, so it must never ship quietly.
  if (store === "test_store") {
    console.warn(
      "[purchases] RevenueCat is running against the TEST STORE. " +
        "Purchases are simulated. Debug builds only: the SDK terminates a " +
          "release build configured this way.",
    );
  }

  return true;
}
