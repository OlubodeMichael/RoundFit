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
  water: {
    title: 'Stay hydrated 💧',
    body:  'Time for a glass of water — log it in RoundFit.',
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

async function cancelOrphanRemindersForScreen(screen: string, keepId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((req) => {
        if (req.identifier === keepId) return false;
        const data = req.content.data as Record<string, unknown> | undefined;
        return data?.screen === screen;
      })
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier)),
  );
}

export async function scheduleReminder(
  id:     string,
  hour:   number,
  minute: number,
  period: 'AM' | 'PM',
): Promise<void> {
  const content = REMINDER_CONTENT[id];
  if (!content) return;

  await cancelReminder(id);
  await cancelOrphanRemindersForScreen(id, id);

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

// ── Water reminders (interval or fixed times) ──────────────────────────────

export interface WaterReminderConfig {
  mode:          'interval' | 'times';
  intervalHours: number;
  windowStart:   { hour: number; minute: number; period: 'AM' | 'PM' };
  windowEnd:     { hour: number; minute: number; period: 'AM' | 'PM' };
  times:         { hour: number; minute: number; period: 'AM' | 'PM' }[];
}

export const DEFAULT_WATER_CONFIG: WaterReminderConfig = {
  mode:          'interval',
  intervalHours: 2,
  windowStart:   { hour: 8,  minute: 0, period: 'AM' },
  windowEnd:     { hour: 10, minute: 0, period: 'PM' },
  times:         [{ hour: 9, minute: 0, period: 'AM' }],
};

export function computeIntervalTimes(
  intervalHours: number,
  start: { hour: number; minute: number; period: 'AM' | 'PM' },
  end:   { hour: number; minute: number; period: 'AM' | 'PM' },
): { hour: number; minute: number; period: 'AM' | 'PM' }[] {
  const startMin = to24h(start.hour, start.period) * 60 + start.minute;
  const endMin   = to24h(end.hour,   end.period)   * 60 + end.minute;
  const stepMin  = Math.round(intervalHours * 60);
  const result: { hour: number; minute: number; period: 'AM' | 'PM' }[] = [];
  for (let m = startMin; m <= endMin; m += stepMin) {
    const h24    = Math.floor(m / 60) % 24;
    const minute = m % 60;
    const period = h24 < 12 ? 'AM' : 'PM';
    const hour   = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    result.push({ hour, minute, period });
  }
  return result;
}

export async function scheduleWaterReminders(config: WaterReminderConfig): Promise<void> {
  await cancelWaterReminders();
  const slots = config.mode === 'interval'
    ? computeIntervalTimes(config.intervalHours, config.windowStart, config.windowEnd)
    : config.times;
  for (let i = 0; i < slots.length; i++) {
    const t = slots[i];
    await Notifications.scheduleNotificationAsync({
      identifier: `water-${i}`,
      content: {
        title: REMINDER_CONTENT.water.title,
        body:  REMINDER_CONTENT.water.body,
        data:  { screen: 'water' },
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

export async function cancelWaterReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ids = all
    .map(n => n.identifier)
    .filter(id => id === 'water' || id.startsWith('water-'));
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
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
