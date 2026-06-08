import { useContext } from 'react';

import { NotificationInboxContext } from '@/context/notification-inbox-context';

export function useNotificationInbox() {
  const ctx = useContext(NotificationInboxContext);
  if (!ctx) {
    throw new Error('useNotificationInbox must be used within NotificationInboxProvider');
  }
  return ctx;
}
