import { Stack } from 'expo-router';

export default function LogLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {/* Hub */}
      <Stack.Screen name="index" />

      {/* Food sub-stack */}
      <Stack.Screen name="food/index" />
      <Stack.Screen name="food/search" />
      <Stack.Screen name="food/[id]" />
      <Stack.Screen name="food/scan" />
      <Stack.Screen name="food/manual" />
      <Stack.Screen name="food/photo" />

      {/* Activity logs */}
      <Stack.Screen name="workout" />
      <Stack.Screen name="sleep" />
      <Stack.Screen name="weight" />
      <Stack.Screen name="body" />
    </Stack>
  );
}
