import {
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
} from "@expo-google-fonts/barlow-condensed";
import {
    Syne_700Bold,
    Syne_800ExtraBold,
    useFonts,
} from "@expo-google-fonts/syne";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import {
    type Href,
    Stack,
    useGlobalSearchParams,
    usePathname,
    useRootNavigationState,
    useRouter,
    useSegments,
} from "expo-router";
import { routeForNotificationScreen } from "@/utils/notification-routes";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { configureForegroundBehaviour, setupNotificationChannel } from "@/utils/notifications";
import { PostHogProvider } from "posthog-react-native";
import { posthog } from "@/lib/posthog";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider, hasActiveUserSession } from "@/context/auth-context";
import { SubscriptionProvider, useSubscriptionOptional } from "@/context/subscription-context";
import { PAYWALL_ENABLED } from "@/constants/subscription";
import { configurePurchases } from "@/lib/purchases";
import { BurnCoachProvider } from "@/context/burn-coach-context";
import { CheckinProvider } from "@/context/checkin-context";
import { CycleProvider } from "@/context/cycle-context";
import { FoodProvider } from "@/context/food-context";
import { HealthProvider } from "@/context/health-context";
import { InsightsProvider } from "@/context/insights-context";
import { NotificationInboxProvider } from "@/context/notification-inbox-context";
import { ProfileProvider } from "@/context/profile-context";
import { RecoveryProvider } from "@/context/recovery-context";
import { SummaryProvider } from "@/context/summary-context";
import { ThemeProvider } from "@/context/theme-context";
import { WaterProvider } from "@/context/water-context";
import { WeightProvider } from "@/context/weight-context";
import { WorkoutProvider } from "@/context/workout-context";
import { WorkoutSessionProvider } from "@/context/workout-session-context";
import { WorkoutImportReviewProvider } from "@/context/workout-import-review-context";
import { WorkoutSessionLiveActivityProvider } from "@/hooks/use-workout-session-live-activity";
import { WorkoutLiveActivityProvider } from "@/hooks/use-workout-live-activity";
import { useWatchSync } from "@/hooks/use-watch-sync";

/** Mounts the Apple Watch snapshot/action sync. No-ops until the native bridge ships. */
function WatchSyncMount() {
  useWatchSync();
  return null;
}
import { useAuth } from "@/hooks/use-auth";
import { useDailyInsightNotification } from "@/hooks/use-daily-insight-notification";
import { useTheme } from "@/hooks/use-theme";

export const unstable_settings = {
  initialRouteName: "auth",
};

function AppNavigator() {
  const { isDark } = useTheme();
  const { status, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);
  const navigatorReady = Boolean(navState?.key);
  const subscription = useSubscriptionOptional();

  // Daily insight notification: sleep background delivery + generic fallback.
  useDailyInsightNotification();

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      posthog.screen(pathname, { previous_screen: previousPathname.current ?? null, ...params });
      previousPathname.current = pathname;
    }
  }, [pathname, params]);

  // ── Notification tap handler ────────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      const route = routeForNotificationScreen(screen);
      if (route) router.push(route as never);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!navigatorReady) return;
    if (status === "loading") return;

    const top = segments[0];
    // `paywall` is public: it must be reachable before sign-up (pre-signup paywall
    // placement) and while signed out, otherwise the unauthenticated redirect
    // below bounces it to /auth and it can never be seen.
    const inPublicOnboarding =
      top === "auth" || top === "onboarding" || (top as string) === "paywall";

    const authScreen = segments[1];

    // Valid session but no RoundFit profile row yet — finish onboarding to create one.
    if (status === "needs-profile" && top !== "onboarding") {
      router.replace("/onboarding/complete-profile");
      return;
    }

    // ── Hard paywall gate (SUBSCRIPTION_PLAN §7) ──────────────────────────────
    // Inert unless PAYWALL_ENABLED. When on, a signed-in user with no active
    // entitlement can only be on `/paywall`. `reveal.tsx` → setupOAuthProfile →
    // status flips to authenticated → this gate fires → the paywall IS the
    // onboarding paywall (no onboarding screen changes needed).
    if (PAYWALL_ENABLED && hasActiveUserSession(status, user)) {
      const subStatus = subscription?.status ?? "disabled";
      const isPremium = subscription?.isPremium ?? false;
      if (subStatus !== "loading" && !isPremium && (top as string) !== "paywall") {
        router.replace("/paywall" as Href);
        return;
      }
      if (isPremium && (top as string) === "paywall") {
        router.replace("/(tabs)");
        return;
      }
    }

    const passwordScreen =
      authScreen === "forgot-password" ||
      authScreen === "reset-password";
    // Only redirect into the tabs when status is authenticated AND a profile
    // is actually loaded (`hasActiveUserSession`). Status alone can briefly be
    // "authenticated" with `user === null` between sign-in and /me hydration.
    if (hasActiveUserSession(status, user) && (top === "auth" || top === "onboarding")) {
      if (!passwordScreen) {
        router.replace("/(tabs)");
        return;
      }
    }

    if (status === "unauthenticated" && !inPublicOnboarding) {
      router.replace("/auth");
    }
  }, [navigatorReady, status, user, segments, subscription?.status, subscription?.isPremium]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = segments[0];
  // Hide auth UI until session is known, and while an authenticated user is still on `auth`
  // (replace to tabs runs in the same layout pass — avoids a flash of the auth landing screen).
  const passwordScreen = segments[1] === "forgot-password" || segments[1] === "reset-password";
  const showAuthSplash =
    status === "loading" ||
    (status === "needs-profile" && top !== "onboarding") ||
    (status === "authenticated" && top === "auth" && !passwordScreen) ||
    // Hold the splash while RevenueCat's customerInfo resolves, so a paying user
    // cold-starting never sees a flash of the paywall before the gate settles.
    (PAYWALL_ENABLED &&
      status === "authenticated" &&
      (subscription?.status ?? "disabled") === "loading");

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <View style={styles.navRoot}>
        {status === "authenticated" && <WatchSyncMount />}
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: status !== "authenticated" }} />
          {/* Hard paywall: not swipe-dismissible — the only exits are purchase or
              the escape hatches in the screen footer (Restore/Sign out/Delete). */}
          <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="edit-profile"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="notifications"
            options={{ animation: "slide_from_right" }}
          />
        </Stack>
        {showAuthSplash && (
          <View
            style={[
              styles.authSplash,
              { backgroundColor: isDark ? "#0A0B0F" : "#FAFAF8" },
            ]}
            pointerEvents="auto"
          />
        )}
      </View>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

configureForegroundBehaviour();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });

  useEffect(() => {
    setupNotificationChannel();
    // Configure RevenueCat once, before the provider tree needs it. No-ops on
    // non-iOS or when EXPO_PUBLIC_REVENUECAT_IOS_KEY is unset.
    configurePurchases();
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#FAFAF8' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PostHogProvider client={posthog} autocapture={{ captureScreens: false, captureTouches: true }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <SubscriptionProvider>
              <ProfileProvider>
                <FoodProvider>
                  <WorkoutProvider>
                    <WorkoutImportReviewProvider>
                    <CycleProvider>
                      <WeightProvider>
                        <WaterProvider>
                        <HealthProvider>
                          <WorkoutSessionProvider>
                          <WorkoutSessionLiveActivityProvider>
                          <CheckinProvider>
                            <SummaryProvider>
                              <RecoveryProvider>
                                {/* EngineProvider unmounted: no screen consumes useEngine();
                                    it only generated unused /engine/daily + /engine/patterns
                                    requests. Context/hook kept for when engine UI is wired. */}
                                <WorkoutLiveActivityProvider>
                                  <InsightsProvider>
                                    <NotificationInboxProvider>
                                      <BurnCoachProvider>
                                        <AppNavigator />
                                      </BurnCoachProvider>
                                    </NotificationInboxProvider>
                                  </InsightsProvider>
                                </WorkoutLiveActivityProvider>
                              </RecoveryProvider>
                            </SummaryProvider>
                          </CheckinProvider>
                          </WorkoutSessionLiveActivityProvider>
                          </WorkoutSessionProvider>
                        </HealthProvider>
                        </WaterProvider>
                      </WeightProvider>
                    </CycleProvider>
                    </WorkoutImportReviewProvider>
                  </WorkoutProvider>
                </FoodProvider>
              </ProfileProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
        </PostHogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  navRoot: { flex: 1 },
  authSplash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
