import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { useEngine } from '@/hooks/use-engine';
import { useInsights } from '@/context/insights-context';

function InsightsDataLoader() {
  const { refreshPatterns } = useEngine();
  const { refresh: refreshInsights, history } = useInsights();
  const loadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      void refreshPatterns();
      if (history.length === 0) void refreshInsights();
    }, [refreshPatterns, refreshInsights, history.length]),
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
