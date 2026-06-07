import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatInboxTimestamp } from '@/components/notifications/notification-inbox-meta';
import type { InboxNotification } from '@/types/notification-inbox';

export interface NotificationInboxPalette {
  hi: string;
  mid: string;
  faint: string;
  accent: string;
  unreadDot: string;
}

export interface NotificationInboxRowProps {
  item: InboxNotification;
  P: NotificationInboxPalette;
  onPress: () => void;
}

export function NotificationInboxRow({ item, P, onPress }: NotificationInboxRowProps) {
  const unread = !item.read;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View style={[s.icon, { backgroundColor: P.accent }]}>
        <Ionicons name="notifications-outline" size={17} color="#FFF" />
      </View>

      <View style={s.copy}>
        <View style={s.titleRow}>
          <Text
            style={[s.title, { color: P.hi, fontWeight: unread ? '700' : '600' }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {unread ? (
            <View style={[s.dot, { backgroundColor: P.unreadDot }]} />
          ) : null}
        </View>
        {item.body ? (
          <Text style={[s.body, { color: P.mid }]} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={[s.time, { color: P.faint }]}>
          {formatInboxTimestamp(item.receivedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.65,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
});
