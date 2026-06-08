import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="you" />
      <Stack.Screen name="health" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="theme" />
      <Stack.Screen name="security" />
      <Stack.Screen name="account" />
      <Stack.Screen name="cycle" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="help" />
      <Stack.Screen name="wearable" />
    </Stack>
  );
}
