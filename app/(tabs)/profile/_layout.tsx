import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="cycle" />
      <Stack.Screen name="wearable" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
