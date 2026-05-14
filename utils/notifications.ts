import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform, Linking } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface ReminderConfig {
  id:    string;
  title: string;
  body:  string;
  hour:  number;
  minute: number;
}

// ── Notification content by reminder type ──────────────────────────────────

const REMINDER_CONTENT: Record<string, { title: string; body: string }> = {
  morning: {
    title: 'Good morning ☀️',
    body:  'Time for your daily check-in — energy, mood, and plan.',
  },
  workout: {
    title: 'Time to move 💪',
    body:  'Your workout reminder is here. Let\'s go!',
  },
  sleep: {
    title: 'Wind down 🌙',
    body:  'Start your evening routine for better rest tonight.',
  },
  summary: {
    title: 'Day recap 📊',
    body:  'Check your daily progress before wrapping up.',
  },
};

const MEAL_CONTENT: Record<number, { title: string; body: string }> = {
  0: { title: 'Breakfast time 🍳', body: 'Don\'t forget to log your breakfast.' },
  1: { title: 'Lunch time 🥗',     body: 'Don\'t forget to log your lunch.' },
  2: { title: 'Dinner time 🍽️',   body: 'Don\'t forget to log your dinner.' },
  3: { title: 'Snack time 🍎',     body: 'Don\'t forget to log your snack.' },
};

// ── Channel setup (Android) ────────────────────────────────────────────────

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name:       'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F97316',
  });
}

// ── Foreground behaviour ───────────────────────────────────────────────────

export function configureForegroundBehaviour(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });
}

// ── Permissions ────────────────────────────────────────────────────────────

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionStatus;
}

export async function requestPermissions(): Promise<PermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

export function openNotificationSettings(): void {
  Linking.openSettings();
}

// ── Convert 12h → 24h ─────────────────────────────────────────────────────

function to24h(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

// ── Schedule / Cancel ──────────────────────────────────────────────────────

export async function scheduleReminder(
  id:     string,
  hour:   number,
  minute: number,
  period: 'AM' | 'PM',
): Promise<void> {
  const content = REMINDER_CONTENT[id];
  if (!content) return;

  await cancelReminder(id);

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: content.title,
      body:  content.body,
      data:  { screen: id },
      ...(Platform.OS === 'android' && { channelId: 'reminders' }),
    },
    trigger: {
      type:   SchedulableTriggerInputTypes.DAILY,
      hour:   to24h(hour, period),
      minute,
    },
  });
}

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

// ── Meal reminders (multiple slots) ────────────────────────────────────────

export async function scheduleMealReminders(
  mealTimes: { hour: number; minute: number; period: 'AM' | 'PM' }[],
): Promise<void> {
  await cancelMealReminders();

  for (let i = 0; i < mealTimes.length; i++) {
    const t = mealTimes[i];
    const fallback = { title: 'Meal time 🍽️', body: 'Don\'t forget to log your meal.' };
    const content = MEAL_CONTENT[i] ?? fallback;

    await Notifications.scheduleNotificationAsync({
      identifier: `meal-${i}`,
      content: {
        title: content.title,
        body:  content.body,
        data:  { screen: 'meal', mealIndex: i },
        ...(Platform.OS === 'android' && { channelId: 'reminders' }),
      },
      trigger: {
        type:   SchedulableTriggerInputTypes.DAILY,
        hour:   to24h(t.hour, t.period),
        minute: t.minute,
      },
    });
  }
}

export async function cancelMealReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const mealIds = all
    .map((n) => n.identifier)
    .filter((id) => id.startsWith('meal-'));

  await Promise.all(mealIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

// ── Bulk operations ────────────────────────────────────────────────────────

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledReminders(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}
