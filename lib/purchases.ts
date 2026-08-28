/**
 * RevenueCat SDK configuration.
 *
 * `configurePurchases()` is called once from `RootLayout` before the provider
 * tree mounts (see `app/_layout.tsx`). iOS-only for now — RoundFit sells through
 * the App Store; Android/web return early.
 *
 * The public SDK key comes from `extra.revenueCatIosKey` (fed by `REVENUECAT_IOS_KEY`
 * in `app.config.js`), matching how every other secret reaches the client here.
 * It must be an App Store key (`appl_…`); a Test Store key cannot validate real
 * StoreKit purchases. Configuration is a no-op when the key is missing.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

const IOS_KEY = Constants.expoConfig?.extra?.revenueCatIosKey as string | undefined;

let configured = false;

/** True once `Purchases.configure` has run with a usable key. */
export function isPurchasesConfigured(): boolean {
  return configured;
}

/**
 * Configure RevenueCat exactly once. Safe to call on every launch; subsequent
 * calls no-op. Returns whether the SDK is now usable.
 */
export function configurePurchases(): boolean {
  if (configured) return true;
  if (Platform.OS !== "ios") return false;
  if (!IOS_KEY) {
    if (__DEV__) {
      console.warn(
        "[purchases] extra.revenueCatIosKey is not set — RevenueCat is disabled. " +
          "Set REVENUECAT_IOS_KEY to the App Store public SDK key (appl_…).",
      );
    }
    return false;
  }

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: IOS_KEY });
  configured = true;
  return true;
}
