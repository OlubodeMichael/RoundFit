import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationRequest } from 'expo-notifications';

import type { InboxNotification, NotificationScreenKey } from '@/types/notification-inbox';

const STORAGE_KEY = 'roundfit:notification-inbox';
const MAX_ITEMS = 100;

function parseScreen(data: Record<string, unknown> | undefined): NotificationScreenKey | undefined {
  const screen = data?.screen;
  if (
    screen === 'morning' ||
    screen === 'meal' ||
    screen === 'workout' ||
    screen === 'sleep' ||
    screen === 'summary'
  ) {
    return screen;
  }
  return undefined;
}

export function inboxItemFromRequest(
  request: NotificationRequest,
  read = false,
): InboxNotification {
  const { content, identifier } = request;
  const receivedAt = new Date().toISOString();

  return {
    id: `${identifier}-${receivedAt}`,
    title: content.title?.trim() || 'Notification',
    body: content.body?.trim() || '',
    screen: parseScreen(content.data as Record<string, unknown> | undefined),
    receivedAt,
    read,
  };
}

export async function loadInboxNotifications(): Promise<InboxNotification[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as InboxNotification[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id && item?.receivedAt)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  } catch {
    return [];
  }
}

async function persistInbox(items: InboxNotification[]): Promise<void> {
  const trimmed = items.slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export async function appendInboxNotification(
  item: InboxNotification,
): Promise<InboxNotification[]> {
  const existing = await loadInboxNotifications();
  const next = [item, ...existing].slice(0, MAX_ITEMS);
  await persistInbox(next);
  return next;
}

export async function markInboxItemRead(id: string): Promise<InboxNotification[]> {
  const existing = await loadInboxNotifications();
  const next = existing.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  await persistInbox(next);
  return next;
}

export async function markAllInboxRead(): Promise<InboxNotification[]> {
  const existing = await loadInboxNotifications();
  const next = existing.map((item) => ({ ...item, read: true }));
  await persistInbox(next);
  return next;
}

export async function clearInboxNotifications(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
