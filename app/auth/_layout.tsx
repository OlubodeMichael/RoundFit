import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* The login chooser owns its content-height sheet UI. A transparent modal
            keeps the landing screen visible without native detent sizing issues.
            Note: a native stack renders its *first* screen as a full-screen card
            regardless of `presentation`, so the `router.replace()` entry points
            (reset-password, OnboardingSignupAuth) still land here full-screen —
            `useSheetPresentation` restores the safe-area padding in that case. */}
        <Stack.Screen
          name="auth-options"
          options={{
            presentation: 'transparentModal',
            animation: 'fade_from_bottom',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />

        {/* The email path off "Choose how to continue" opens over the options
            screen rather than replacing it, so backing out returns the user to
            Apple/Google without re-running the onboarding push. */}
        <Stack.Screen
          name="sign-up"
          options={{
            presentation: 'modal',
            animation:    'slide_from_bottom',
          }}
        />

        {/* Same for the log-in form. It still arrives via `replace` from the
            options sheet above, so it presents over the landing screen rather
            than stacking a second card on top of a sheet. */}
        <Stack.Screen
          name="email-login"
          options={{
            presentation: 'modal',
            animation:    'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}
