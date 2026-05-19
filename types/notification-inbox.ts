export type NotificationScreenKey =
  | 'morning'
  | 'meal'
  | 'workout'
  | 'sleep'
  | 'summary';

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  screen?: NotificationScreenKey;
  receivedAt: string;
  read: boolean;
}
