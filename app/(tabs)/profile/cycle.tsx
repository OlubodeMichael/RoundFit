import { Redirect, useRouter } from 'expo-router';

import { CycleTrackingScreen } from '@/components/cycle/CycleTrackingScreen';
import { CYCLE_ENABLED } from '@/constants/features';

export default function ProfileCycleRoute() {
  // Held back from launch. The screen is intact but must not be reachable —
  // including by deep link or a typed-route jump, which the entry-point gate
  // alone does not cover. See CYCLE_FEATURE_REMOVAL_PLAN.md.
  if (!CYCLE_ENABLED) return <Redirect href="/(tabs)/profile" />;

  const router = useRouter();
  return <CycleTrackingScreen onBack={() => router.back()} />;
}
