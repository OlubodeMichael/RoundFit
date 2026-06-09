import { useRouter } from 'expo-router';

import { CycleTrackingScreen } from '@/components/cycle/CycleTrackingScreen';

export default function LogCycleRoute() {
  const router = useRouter();
  return <CycleTrackingScreen onBack={() => router.back()} />;
}
