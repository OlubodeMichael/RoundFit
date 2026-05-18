import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useRecovery } from '@/context/recovery-context';
import { useWeight } from '@/context/weight-context';

function ProgressDataLoader() {
  const { initialized: recoveryInit, refresh: refreshRecovery } = useRecovery();
  const { initialized: weightInit,   refresh: refreshWeight }   = useWeight();

  useFocusEffect(
    useCallback(() => {
      if (!recoveryInit) void refreshRecovery();
      if (!weightInit)   void refreshWeight();
    }, [recoveryInit, weightInit, refreshRecovery, refreshWeight]),
  );

  return null;
}

export default function ProgressLayout() {
  return (
    <>
      <ProgressDataLoader />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="weight" />
        <Stack.Screen name="mirror" />
        <Stack.Screen name="recovery" />
      </Stack>
    </>
  );
}
