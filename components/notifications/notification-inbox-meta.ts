import type { NotificationScreenKey } from '@/types/notification-inbox';

type NotificationIconName =
  | 'sunny-outline'
  | 'restaurant-outline'
  | 'barbell-outline'
  | 'moon-outline'
  | 'stats-chart-outline'
  | 'water-outline'
  | 'sparkles-outline'
  | 'notifications-outline';

interface NotificationMeta {
  icon: NotificationIconName;
  label: string;
  circleBg: string;
  circleBgDark: string;
  iconColor: string;
  iconColorDark: string;
}

export const NOTIFICATION_INBOX_META: Record<NotificationScreenKey, NotificationMeta> = {
  morning: {
    icon: 'sunny-outline',
    label: 'Morning',
    circleBg: '#FEF3C7',
    circleBgDark: 'rgba(251,191,36,0.16)',
    iconColor: '#D97706',
    iconColorDark: '#FCD34D',
  },
  meal: {
    icon: 'restaurant-outline',
    label: 'Nutrition',
    circleBg: '#FFEDD5',
    circleBgDark: 'rgba(249,115,22,0.16)',
    iconColor: '#EA580C',
    iconColorDark: '#FB923C',
  },
  workout: {
    icon: 'barbell-outline',
    label: 'Workout',
    circleBg: '#D1FAE5',
    circleBgDark: 'rgba(52,211,153,0.14)',
    iconColor: '#059669',
    iconColorDark: '#34D399',
  },
  sleep: {
    icon: 'moon-outline',
    label: 'Sleep',
    circleBg: '#E0E7FF',
    circleBgDark: 'rgba(129,140,248,0.16)',
    iconColor: '#4F46E5',
    iconColorDark: '#A5B4FC',
  },
  summary: {
    icon: 'stats-chart-outline',
    label: 'Summary',
    circleBg: '#DBEAFE',
    circleBgDark: 'rgba(96,165,250,0.16)',
    iconColor: '#2563EB',
    iconColorDark: '#93C5FD',
  },
  water: {
    icon: 'water-outline',
    label: 'Hydration',
    circleBg: '#CFFAFE',
    circleBgDark: 'rgba(14,165,233,0.14)',
    iconColor: '#0891B2',
    iconColorDark: '#67E8F9',
  },
  insight: {
    icon: 'sparkles-outline',
    label: 'Insight',
    circleBg: '#F3E8FF',
    circleBgDark: 'rgba(168,85,247,0.16)',
    iconColor: '#9333EA',
    iconColorDark: '#C4B5FD',
  },
};

export const DEFAULT_NOTIFICATION_META: NotificationMeta = {
  icon: 'notifications-outline',
  label: 'Update',
  circleBg: '#FFEDD5',
  circleBgDark: 'rgba(249,115,22,0.16)',
  iconColor: '#EA580C',
  iconColorDark: '#FB923C',
};

export function metaForNotificationScreen(
  screen: NotificationScreenKey | undefined,
): NotificationMeta {
  if (!screen) return DEFAULT_NOTIFICATION_META;
  return NOTIFICATION_INBOX_META[screen] ?? DEFAULT_NOTIFICATION_META;
}

export function iconColorsForNotification(
  screen: NotificationScreenKey | undefined,
  isDark: boolean,
): { circleBg: string; iconColor: string } {
  const meta = metaForNotificationScreen(screen);
  return isDark
    ? { circleBg: meta.circleBgDark, iconColor: meta.iconColorDark }
    : { circleBg: meta.circleBg, iconColor: meta.iconColor };
}

export type InboxSectionKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

export const INBOX_SECTION_LABELS: Record<InboxSectionKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  earlier: 'Earlier',
};

export const INBOX_SECTION_ORDER: InboxSectionKey[] = [
  'today',
  'yesterday',
  'thisWeek',
  'earlier',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const weekday = day.getDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - diff);
  return day;
}

export function inboxSectionForDate(iso: string): InboxSectionKey {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'earlier';

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = startOfWeek(now);

  if (date >= today) return 'today';
  if (date >= yesterday) return 'yesterday';
  if (date >= weekStart) return 'thisWeek';
  return 'earlier';
}

export function groupInboxBySection<T extends { receivedAt: string }>(
  items: T[],
): Record<InboxSectionKey, T[]> {
  const groups: Record<InboxSectionKey, T[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  for (const item of items) {
    groups[inboxSectionForDate(item.receivedAt)].push(item);
  }

  return groups;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Friendly relative time for the bottom-right of each row. */
export function formatInboxRowTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) {
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) {
      return `${diffMin} ${pluralize(diffMin, 'min', 'mins')} ago`;
    }
    if (diffHr < 24) {
      return `${diffHr} ${pluralize(diffHr, 'hour', 'hours')} ago`;
    }
  }

  if (date >= yesterday) return 'Yesterday';

  const weekStart = startOfWeek(new Date());
  if (date >= weekStart) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatInboxTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = startOfDay(now);
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

/** Left inset for hairline dividers (past the icon column). */
export const INBOX_ROW_DIVIDER_INSET = 80;
