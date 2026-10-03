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
 * `USE_TEST_STORE` in `constants/subscription.ts` picks between them, and is
 * `__DEV__`, so the Test Store can only ever be reached from a debug build. The
 * RevenueCat SDK kills any release build configured with a `test_…` key, so a
 * TestFlight or App Review build must use the App Store key; there it transacts
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

  // Test Store first when the flag is on. Falling back to the App Store key
  // rather than disabling purchases keeps a build usable if the test key is
  // missing from the environment, which is what happens on EAS builds until
  // REVENUECAT_TEST_STORE_KEY is added there.
  const store: PurchasesStore =
    USE_TEST_STORE && TEST_STORE_KEY ? "test_store" : "app_store";
  const apiKey = store === "test_store" ? TEST_STORE_KEY : APP_STORE_KEY;

  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        "[purchases] no RevenueCat key configured, RevenueCat is disabled. " +
          "Set REVENUECAT_IOS_KEY (appl_…) or, with USE_TEST_STORE on, " +
          "REVENUECAT_TEST_STORE_KEY (test_…).",
      );
    }
    return false;
  }

  if (USE_TEST_STORE && !TEST_STORE_KEY && __DEV__) {
    console.warn(
      "[purchases] USE_TEST_STORE is on but extra.revenueCatTestStoreKey is " +
        "unset, falling back to the App Store key.",
    );
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
