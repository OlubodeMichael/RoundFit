/**
 * RevenueCat SDK configuration.
 *
 * `configurePurchases()` is called once from `RootLayout` before the provider
 * tree mounts (see `app/_layout.tsx`). iOS-only for now — RoundFit sells through
 * the App Store; Android/web return early.
 *
 * The public SDK key comes from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (Expo inlines
 * `EXPO_PUBLIC_*` at build). Until a real App Store app exists in RevenueCat the
 * only key available is the Test Store key, which cannot validate real StoreKit
 * purchases — so configuration is a no-op when the key is missing.
 */
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

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
        "[purchases] EXPO_PUBLIC_REVENUECAT_IOS_KEY is not set — RevenueCat is disabled. " +
          "Set a real iOS public SDK key once the App Store app exists in RevenueCat.",
      );
    }
    return false;
  }

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: IOS_KEY });
  configured = true;
  return true;
}
