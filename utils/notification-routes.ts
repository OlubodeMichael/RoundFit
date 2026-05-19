import type { NotificationScreenKey } from '@/types/notification-inbox';

export const NOTIFICATION_ROUTES: Record<NotificationScreenKey, string> = {
  morning:  '/(tabs)',
  meal:     '/(tabs)/log/food',
  workout:  '/(tabs)/log/workout',
  sleep:    '/(tabs)/log/sleep',
  summary:  '/(tabs)/insights',
};

export function routeForNotificationScreen(
  screen: string | undefined,
): string | null {
  if (!screen) return null;
  return NOTIFICATION_ROUTES[screen as NotificationScreenKey] ?? null;
}
