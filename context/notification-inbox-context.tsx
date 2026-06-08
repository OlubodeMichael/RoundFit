import * as Notifications from 'expo-notifications';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { InboxNotification } from '@/types/notification-inbox';
import {
  appendInboxNotification,
  clearInboxNotifications,
  inboxDedupeId,
  inboxItemFromRequest,
  loadInboxNotifications,
  markAllInboxRead,
  markInboxItemRead,
} from '@/utils/notification-inbox-storage';

export interface NotificationInboxContextValue {
  items: InboxNotification[];
  unreadCount: number;
  hydrated: boolean;
  recordFromRequest: (request: Notifications.NotificationRequest) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export const NotificationInboxContext =
  createContext<NotificationInboxContextValue | null>(null);

export function NotificationInboxProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useAuth();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const recordedIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const recordFromRequest = useCallback(
    async (request: Notifications.NotificationRequest) => {
      const dedupeId = inboxDedupeId(request);
      if (recordedIdsRef.current.has(dedupeId)) return;

      const item = inboxItemFromRequest(request);
      recordedIdsRef.current.add(dedupeId);
      const next = await appendInboxNotification(item);
      setItems(next);
    },
    [],
  );

  useEffect(() => {
    if (status !== 'authenticated') {
      setItems([]);
      setHydrated(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const stored = await loadInboxNotifications();
      if (cancelled) return;
      recordedIdsRef.current = new Set(stored.map((row) => row.id));
      setItems(stored);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        void recordFromRequest(notification.request);
      },
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void recordFromRequest(response.notification.request);
      },
    );

    void (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;
      await recordFromRequest(response.notification.request);
    })();

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [status, recordFromRequest]);

  const markRead = useCallback(async (id: string) => {
    const next = await markInboxItemRead(id);
    setItems(next);
  }, []);

  const markAllRead = useCallback(async () => {
    const next = await markAllInboxRead();
    setItems(next);
  }, []);

  const clearAll = useCallback(async () => {
    await clearInboxNotifications();
    recordedIdsRef.current = new Set();
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      hydrated,
      recordFromRequest,
      markRead,
      markAllRead,
      clearAll,
    }),
    [items, unreadCount, hydrated, recordFromRequest, markRead, markAllRead, clearAll],
  );

  return (
    <NotificationInboxContext.Provider value={value}>
      {children}
    </NotificationInboxContext.Provider>
  );
}

export function useNotificationInboxContext(): NotificationInboxContextValue {
  const ctx = useContext(NotificationInboxContext);
  if (!ctx) {
    throw new Error(
      'useNotificationInboxContext must be used within NotificationInboxProvider',
    );
  }
  return ctx;
}
