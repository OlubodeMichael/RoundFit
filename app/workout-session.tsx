import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { useWorkoutSessionLiveActivity } from '@/hooks/use-workout-session-live-activity';

/**
 * Deep-link target for the Live Activity (`roundfit://workout-session`).
 * Set as `widgetURL(...)` on the SwiftUI views inside the widget extension,
 * so tapping the Dynamic Island / lock-screen card opens the app here.
 *
 * The route never actually renders anything: it bumps the
 * `openSheetSignal` on the session context and hops to the workout-log
 * tab. The workout-log screen watches for that signal and opens the
 * live-session sheet, restoring the user to where they left off.
 */
export default function WorkoutSessionDeepLinkRoute() {
  const router  = useRouter();
  const session = useWorkoutSessionLiveActivity();

  useEffect(() => {
    session.requestOpenSheet();
    // `replace` so this page doesn't end up in the back stack. The user
    // expects to be back where they started after dismissing the sheet.
    router.replace('/(tabs)/log/workout');
  }, [router, session]);

  // Render nothing while routing.
  return <View />;
}
