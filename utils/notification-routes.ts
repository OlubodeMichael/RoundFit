import type { InboxNotification, NotificationScreenKey } from '@/types/notification-inbox';

export const NOTIFICATION_ROUTES: Record<NotificationScreenKey, string> = {
  morning:  '/(tabs)',
  meal:     '/(tabs)/log/food',
  workout:  '/(tabs)/log/workout',
  sleep:    '/(tabs)/log/sleep',
  summary:  '/(tabs)/insights',
  water:    '/(tabs)/log/water',
  insight:  '/(tabs)/insights/daily',
};

export const NOTIFICATION_CTA_LABELS: Record<NotificationScreenKey, string> = {
  morning:  'Go to Home',
  meal:     'Log food',
  workout:  'Log workout',
  sleep:    'Log sleep',
  summary:  'View insights',
  water:    'Log water',
  insight:  "Read today's insight",
};

export function routeForNotificationScreen(
  screen: string | undefined,
): string | null {
  if (!screen) return null;
  return NOTIFICATION_ROUTES[screen as NotificationScreenKey] ?? null;
}

export function ctaLabelForNotificationScreen(
  screen: string | undefined,
): string | null {
  if (!screen) return null;
  return NOTIFICATION_CTA_LABELS[screen as NotificationScreenKey] ?? null;
}

const INSIGHT_INBOX_MARKERS = [
  'your daily insight is ready',
  'daily insight',
];

/** Resolve screen for inbox rows — handles legacy items saved before insight was parsed. */
export function resolveInboxNotificationScreen(
  item: Pick<InboxNotification, 'screen' | 'title' | 'body' | 'id'>,
): NotificationScreenKey | undefined {
  if (item.screen) return item.screen;

  const id = item.id.toLowerCase();
  if (id.startsWith('insight-')) return 'insight';

  const title = item.title.toLowerCase();
  if (INSIGHT_INBOX_MARKERS.some((marker) => title.includes(marker))) {
    return 'insight';
  }

  return undefined;
}

export function routeForInboxNotification(
  item: Pick<InboxNotification, 'screen' | 'title' | 'body' | 'id'>,
): string | null {
  return routeForNotificationScreen(resolveInboxNotificationScreen(item));
}

export function ctaLabelForInboxNotification(
  item: Pick<InboxNotification, 'screen' | 'title' | 'body' | 'id'>,
): string | null {
  return ctaLabelForNotificationScreen(resolveInboxNotificationScreen(item));
}
