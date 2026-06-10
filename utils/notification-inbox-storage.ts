import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationRequest } from 'expo-notifications';

import type { InboxNotification, NotificationScreenKey } from '@/types/notification-inbox';

/** Exported so clearUserCachesOnLogout can wipe the inbox on sign-out —
 * the key is device-global, so a leftover payload would leak the previous
 * account's notifications to the next user on this device. */
export const NOTIFICATION_INBOX_STORAGE_KEY = 'roundfit:notification-inbox';
const STORAGE_KEY = NOTIFICATION_INBOX_STORAGE_KEY;
const MAX_ITEMS = 100;

/** One inbox row per scheduled reminder (or title/body) per local calendar day. */
function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function inboxDedupeId(request: NotificationRequest): string {
  const { identifier, content } = request;
  const day = localDateKey();

  if (identifier) {
    return `${identifier}-${day}`;
  }

  const title = content.title?.trim() || 'notification';
  const body = content.body?.trim() || '';
  return `${title}-${body}-${day}`;
}

function parseScreen(data: Record<string, unknown> | undefined): NotificationScreenKey | undefined {
  const screen = data?.screen;
  if (
    screen === 'morning' ||
    screen === 'meal' ||
    screen === 'workout' ||
    screen === 'sleep' ||
    screen === 'summary' ||
    screen === 'water'
  ) {
    return screen;
  }
  return undefined;
}

export function inboxItemFromRequest(
  request: NotificationRequest,
  read = false,
): InboxNotification {
  const { content } = request;
  const receivedAt = new Date().toISOString();

  return {
    id: inboxDedupeId(request),
    title: content.title?.trim() || 'Notification',
    body: content.body?.trim() || '',
    screen: parseScreen(content.data as Record<string, unknown> | undefined),
    receivedAt,
    read,
  };
}

function inboxRowDedupeKey(item: InboxNotification): string {
  const day = localDateKey(new Date(item.receivedAt));
  if (item.screen) return `${item.screen}-${day}`;
  return `${item.title}-${item.body}-${day}`;
}

function dedupeInboxRows(items: InboxNotification[]): InboxNotification[] {
  const byKey = new Map<string, InboxNotification>();

  for (const item of items) {
    const key = inboxRowDedupeKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, id: key });
      continue;
    }
    // Keep the newest row's content, but a row only counts as read when EVERY
    // duplicate is read — otherwise a newer read copy would silently swallow
    // an older unread one.
    const newest =
      item.receivedAt.localeCompare(existing.receivedAt) > 0 ? item : existing;
    byKey.set(key, { ...newest, id: key, read: existing.read && item.read });
  }

  return [...byKey.values()].sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  );
}

export async function loadInboxNotifications(): Promise<InboxNotification[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as InboxNotification[];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((item) => item?.id && item?.receivedAt);
    const deduped = dedupeInboxRows(valid);

    if (deduped.length !== valid.length) {
      await persistInbox(deduped);
    }

    return deduped;
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
  const duplicateIdx = existing.findIndex((row) => row.id === item.id);

  let next: InboxNotification[];
  if (duplicateIdx >= 0) {
    const previous = existing[duplicateIdx];
    const merged: InboxNotification = {
      ...item,
      read: previous.read,
      receivedAt: item.receivedAt,
    };
    next = [
      merged,
      ...existing.filter((_, index) => index !== duplicateIdx),
    ];
  } else {
    next = [item, ...existing];
  }

  next = next.slice(0, MAX_ITEMS);
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
