import Ionicons from '@expo/vector-icons/Ionicons';

import type { NotificationScreenKey } from '@/types/notification-inbox';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface NotificationMeta {
  icon: IoniconsName;
  iconBg: string;
}

export const NOTIFICATION_INBOX_META: Record<NotificationScreenKey, NotificationMeta> = {
  morning:  { icon: 'sunny-outline',       iconBg: '#FBBF24' },
  meal:     { icon: 'restaurant-outline',  iconBg: '#F97316' },
  workout:  { icon: 'barbell-outline',     iconBg: '#34D399' },
  sleep:    { icon: 'moon-outline',        iconBg: '#818CF8' },
  summary:  { icon: 'stats-chart-outline', iconBg: '#60A5FA' },
};

export const DEFAULT_NOTIFICATION_META: NotificationMeta = {
  icon: 'notifications-outline',
  iconBg: '#F97316',
};

export function metaForNotificationScreen(
  screen: NotificationScreenKey | undefined,
): NotificationMeta {
  if (!screen) return DEFAULT_NOTIFICATION_META;
  return NOTIFICATION_INBOX_META[screen] ?? DEFAULT_NOTIFICATION_META;
}

export function formatInboxTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (date >= startOfToday) return `Today · ${time}`;
  if (date >= startOfYesterday) return `Yesterday · ${time}`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
