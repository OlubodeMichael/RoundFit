/**
 * Hard paywall — renders the RevenueCat-hosted paywall (see SUBSCRIPTION_PLAN.md §6).
 *
 * The paywall design lives in the RevenueCat dashboard and is attached to the
 * **current offering** (`RoundFit Pro` → paywall `pw4dc9a9e35bf64396`), so the
 * layout, copy and prices are all remote-configurable without shipping a build.
 *
 * NOTE: this supersedes SUBSCRIPTION_PLAN §6's "custom RN screen, not
 * react-native-purchases-ui" decision — the RC paywall was designed to match the
 * brand, so the A/B-without-shipping upside now wins.
 *
 * Two mount points, two exits:
 *  - Pre-signup (from onboarding `reveal`, no account yet) → on to sign-up,
 *    forwarding the collected onboarding params.
 *  - Post-auth hard gate (signed in, entitlement lapsed) → back into the app.
 *
 * Apple 3.1.2 items (prices, trial terms, auto-renew, Restore, Terms, Privacy)
 * are the responsibility of the *dashboard* paywall design — verify them there.
 */
import { hasActiveUserSession, useAuth } from "@/context/auth-context";
import { useSubscription } from "@/context/subscription-context";
import { isPurchasesConfigured } from "@/lib/purchases";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

export default function HardPaywallScreen() {
  const router = useRouter();
  const posthog = usePostHog();
  const params = useLocalSearchParams();
  const { status: authStatus, user } = useAuth();
  const { refresh } = useSubscription();

  const signedIn = hasActiveUserSession(authStatus, user);
  const configured = isPurchasesConfigured();

  const proceed = () => {
    if (signedIn) router.replace("/(tabs)");
    else router.push({ pathname: "/auth/sign-up-options", params } as never);
  };

  useEffect(() => {
    posthog.capture("paywall_viewed", {
      source: signedIn ? "trial_expired" : "onboarding",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // No SDK key (or non-iOS) → RevenueCatUI cannot render. Never a dead screen
  // (SUBSCRIPTION_PLAN §10.4): give an explicit state and a way forward.
  if (!configured) {
    return (
      <View style={s.fallback}>
        <Text style={s.fallbackTitle}>Plans are unavailable</Text>
        <Text style={s.fallbackBody}>
          Subscriptions aren&apos;t configured on this build. Set
          EXPO_PUBLIC_REVENUECAT_IOS_KEY to load the paywall.
        </Text>
        <TouchableOpacity style={s.fallbackCta} onPress={proceed} activeOpacity={0.9}>
          <Text style={s.fallbackCtaText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RevenueCatUI.Paywall
      onPurchaseCompleted={async () => {
        posthog.capture("purchase_completed");
        await refresh();
        proceed();
      }}
      onPurchaseError={({ error }) => {
        posthog.capture("purchase_failed", { reason: error?.message ?? "unknown" });
      }}
      onRestoreCompleted={async () => {
        posthog.capture("restore_completed");
        await refresh();
        proceed();
      }}
      // The dashboard paywall carries a close (X) — Apple 3.1.2 requires an exit.
      // Pre-signup that continues to account creation; once PAYWALL_ENABLED is on,
      // the router gate re-asserts the lock for a signed-in user with no entitlement.
      onDismiss={proceed}
    />
  );
}

const s = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#FAF7F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  fallbackTitle: { color: "#0C0C0C", fontSize: 20, fontWeight: "800" },
  fallbackBody: { color: "#6B6B6B", fontSize: 14, lineHeight: 20, textAlign: "center" },
  fallbackCta: {
    marginTop: 12,
    backgroundColor: "#0C0C0C",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  fallbackCtaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
