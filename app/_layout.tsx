import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';

import { ThemeProvider } from '@/context/theme-context';
import { AuthProvider } from '@/context/auth-context';
import { ProfileProvider } from '@/context/profile-context';
import { FoodProvider } from '@/context/food-context';
import { WorkoutProvider } from '@/context/workout-context';
import { CycleProvider } from '@/context/cycle-context';
import { WeightProvider } from '@/context/weight-context';
import { HealthProvider } from '@/context/health-context';
import { RecoveryProvider } from '@/context/recovery-context';
import { CheckinProvider } from '@/context/checkin-context';
import { SummaryProvider } from '@/context/summary-context';
import { EngineProvider } from '@/context/engine-context';
import { InsightsProvider } from '@/context/insights-context';
import { ToastProvider } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';

export const unstable_settings = {
  initialRouteName: 'auth',
};

function AppNavigator() {
  const { isDark }    = useTheme();
  const { status }    = useAuth();
  const router        = useRouter();
  const segments      = useSegments();
  const navState      = useRootNavigationState();
  const navigatorReady = Boolean(navState?.key);

  useEffect(() => {
    if (!navigatorReady)     return;
    if (status === 'loading') return;

    const top = segments[0];
    const inPublicOnboarding = top === 'auth' || top === 'onboarding';

    if (status === 'authenticated' && top === 'auth') {
      router.replace('/(tabs)');
      return;
    }

    if (status === 'unauthenticated' && !inPublicOnboarding) {
      router.replace('/auth');
    }
  }, [navigatorReady, status, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = segments[0];
  // Hide auth UI until session is known, and while an authenticated user is still on `auth`
  // (replace to tabs runs in the same layout pass — avoids a flash of the auth landing screen).
  const showAuthSplash =
    status === 'loading'
    || (status === 'authenticated' && top === 'auth');

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <View style={styles.navRoot}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal"        options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        </Stack>
        {showAuthSplash && (
          <View
            style={[styles.authSplash, { backgroundColor: isDark ? '#0A0A0A' : '#FAFAF8' }]}
            pointerEvents="auto"
          />
        )}
      </View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ProfileProvider>
                <FoodProvider>
                  <WorkoutProvider>
                    <CycleProvider>
                      <WeightProvider>
                        <HealthProvider>
                          <RecoveryProvider>
                            <CheckinProvider>
                              <SummaryProvider>
                                <EngineProvider>
                                  <InsightsProvider>
                                    <AppNavigator />
                                  </InsightsProvider>
                                </EngineProvider>
                              </SummaryProvider>
                            </CheckinProvider>
                          </RecoveryProvider>
                        </HealthProvider>
                      </WeightProvider>
                    </CycleProvider>
                  </WorkoutProvider>
                </FoodProvider>
              </ProfileProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
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
