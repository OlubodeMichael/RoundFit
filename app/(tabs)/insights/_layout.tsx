import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useInsights } from '@/context/insights-context';

function InsightsDataLoader() {
  const { ensureLoaded } = useInsights();

  useFocusEffect(
    useCallback(() => {
      void ensureLoaded();
    }, [ensureLoaded]),
  );

  return null;
}

export default function InsightsLayout() {
  return (
    <>
      <InsightsDataLoader />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="weekly" />
        <Stack.Screen name="daily" />
      </Stack>
    </>
  );
}
