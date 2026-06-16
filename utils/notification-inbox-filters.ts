import type { InboxNotification, NotificationScreenKey } from '@/types/notification-inbox';

export type NotificationInboxChip =
  | 'all'
  | 'unread'
  | NotificationScreenKey;

export type NotificationInboxSort = 'newest' | 'oldest';

export interface NotificationInboxFilters {
  chip: NotificationInboxChip;
  sort: NotificationInboxSort;
}

export const DEFAULT_NOTIFICATION_INBOX_FILTERS: NotificationInboxFilters = {
  chip: 'all',
  sort: 'newest',
};

export const NOTIFICATION_INBOX_CHIP_OPTIONS: {
  value: NotificationInboxChip;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'insight', label: 'Insights' },
  { value: 'workout', label: 'Workouts' },
  { value: 'meal', label: 'Meals' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'water', label: 'Water' },
  { value: 'morning', label: 'Morning' },
  { value: 'summary', label: 'Summary' },
];

export const NOTIFICATION_INBOX_SORT_OPTIONS: {
  value: NotificationInboxSort;
  label: string;
}[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

export function isNotificationInboxFilterActive(
  filters: NotificationInboxFilters,
): boolean {
  return (
    filters.chip !== DEFAULT_NOTIFICATION_INBOX_FILTERS.chip ||
    filters.sort !== DEFAULT_NOTIFICATION_INBOX_FILTERS.sort
  );
}

export function filterInboxNotifications(
  items: InboxNotification[],
  filters: NotificationInboxFilters,
): InboxNotification[] {
  let result = items;

  if (filters.chip === 'unread') {
    result = result.filter((item) => !item.read);
  } else if (filters.chip !== 'all') {
    result = result.filter((item) => item.screen === filters.chip);
  }

  return [...result].sort((a, b) => {
    const cmp =
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    return filters.sort === 'newest' ? cmp : -cmp;
  });
}

export function inboxChipLabel(chip: NotificationInboxChip): string {
  return (
    NOTIFICATION_INBOX_CHIP_OPTIONS.find((o) => o.value === chip)?.label ?? 'All'
  );
}
