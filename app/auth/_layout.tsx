import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* "Have an account? Log in" opens a short sheet over the landing screen
            rather than pushing a page. `fitToContents` sizes the sheet to the
            content, so the screen must stay compact and free of flex spacers.
            Note: a native stack renders its *first* screen as a full-screen card
            regardless of `presentation`, so the `router.replace()` entry points
            (reset-password, OnboardingSignupAuth) still land here full-screen —
            `useSheetPresentation` restores the safe-area padding in that case. */}
        <Stack.Screen
          name="auth-options"
          options={{
            presentation:         'formSheet',
            animation:            'default',
            sheetAllowedDetents:  'fitToContents',
            sheetGrabberVisible:  true,
            sheetCornerRadius:    28,
          }}
        />
      </Stack>
    </>
  );
}
