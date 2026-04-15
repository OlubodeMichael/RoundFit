import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useFonts, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';

import { ThemeProvider } from '@/context/theme-context';
import { AuthProvider } from '@/context/auth-context';
import { ProfileProvider } from '@/context/profile-context';
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

  useEffect(() => {
    if (status === 'loading') return;

    const top = segments[0];
    const inPublicOnboarding = top === 'auth' || top === 'onboarding';

    if (status === 'unauthenticated' && !inPublicOnboarding) {
      router.replace('/auth');
    }
  }, [status, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth"       options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
        <Stack.Screen name="modal"          options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="edit-profile"   options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
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
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
