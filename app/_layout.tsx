import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { useFonts, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';

import { ThemeProvider } from '@/context/theme-context';
import { AuthProvider } from '@/context/auth-context';
import { ProfileProvider } from '@/context/profile-context';
import { FoodProvider } from '@/context/food-context';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';

export const unstable_settings = {
  initialRouteName: 'auth',
};

function AppNavigator() {
  const { isDark } = useTheme();
  const { status } = useAuth();
  const router     = useRouter();
  const segments   = useSegments();

  useLayoutEffect(() => {
    if (status === 'loading') return;

    const top = segments[0];
    const inPublicOnboarding = top === 'auth' || top === 'onboarding';

    // Valid session (cookie) → skip login and land on main app
    if (status === 'authenticated' && top === 'auth') {
      router.replace('/(tabs)');
      return;
    }

    if (status === 'unauthenticated' && !inPublicOnboarding) {
      router.replace('/auth');
    }
  }, [status, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = segments[0];
  // Hide auth UI until session is known, and while an authenticated user is still on `auth`
  // (replace to tabs runs in the same layout pass — avoids a flash of the auth landing screen).
  const showAuthSplash =
    status === 'loading'
    || (status === 'authenticated' && top === 'auth');

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <View style={styles.navRoot}>
        <Stack>
          <Stack.Screen name="auth"       options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
          <Stack.Screen name="modal"          options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="edit-profile"   options={{ presentation: 'modal', headerShown: false }} />
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
  const [fontsLoaded] = useFonts({ Syne_700Bold, Syne_800ExtraBold });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <ProfileProvider>
        <FoodProvider>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </FoodProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  navRoot: { flex: 1 },
  authSplash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
