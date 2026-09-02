import { ProgressBar } from '@/components/onboarding/progress-bar';
import { OnboardingFooter, OnboardingFooterProvider } from '@/components/onboarding/primary-cta';
import { CYCLE_ENABLED } from '@/constants/features';
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ProgressConfig = { step: number; total: number };

export default function OnboardingLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const sex = Array.isArray(params.sex) ? params.sex[0] : params.sex;
  const extendedPath = CYCLE_ENABLED && sex === 'female';
  const total = extendedPath ? 11 : 8;

  const progressByPath: Record<string, ProgressConfig> = {
    '/onboarding/age-sex': {
      step: 2,
      total: 8,
    },
    '/onboarding/height-weight': { step: 3, total },
    '/onboarding/goal': {
      step: 4,
      total,
    },
    '/onboarding/activity': {
      step: 5,
      total,
    },
    '/onboarding/cycle-length': {
      step: 6,
      total: 11,
    },
    '/onboarding/cycle-phase': {
      step: 7,
      total: 11,
    },
    '/onboarding/life-stage': {
      step: 8,
      total: 11,
    },
    '/onboarding/units': {
      step: extendedPath ? 9 : 6,
      total,
    },
    '/onboarding/name': {
      step: extendedPath ? 10 : 7,
      total,
    },
    '/onboarding/health-connect': {
      step: extendedPath ? 11 : 8,
      total,
    },
  };

  const progress = progressByPath[pathname];

  return (
    <OnboardingFooterProvider>
      <View style={s.root}>
        <StatusBar style="dark" />
        {progress && (
          <View style={[s.progressShell, { paddingTop: insets.top }]}>
            <ProgressBar {...progress} isDark={false} />
          </View>
        )}
        <View style={s.content}>
          <Stack
            screenOptions={{
              headerShown: false,
              presentation: 'card',
              animation: 'fade_from_bottom',
              gestureEnabled: true,
              contentStyle: { backgroundColor: '#FAFAF8' },
            }}
          />
        </View>
        <OnboardingFooter />
      </View>
    </OnboardingFooterProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  progressShell: { paddingHorizontal: 24, paddingBottom: 6 },
  content: { flex: 1 },
});
