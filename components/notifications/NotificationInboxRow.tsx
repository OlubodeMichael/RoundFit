import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  formatInboxTimestamp,
  metaForNotificationScreen,
} from '@/components/notifications/notification-inbox-meta';
import type { InboxNotification } from '@/types/notification-inbox';

interface NotificationInboxPalette {
  card: string;
  edge: string;
  hi: string;
  mid: string;
  accent: string;
  unreadDot: string;
}

interface NotificationInboxRowProps {
  item: InboxNotification;
  P: NotificationInboxPalette;
  onPress: () => void;
  last?: boolean;
}

export function NotificationInboxRow({
  item,
  P,
  onPress,
  last,
}: NotificationInboxRowProps) {
  const meta = metaForNotificationScreen(item.screen);

  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowGap]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={[s.iconWrap, { backgroundColor: meta.iconBg }]}>
        <Ionicons name={meta.icon} size={18} color="#FFF" />
      </View>

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text
            style={[s.title, { color: P.hi }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!item.read && (
            <View style={[s.unreadDot, { backgroundColor: P.unreadDot }]} />
          )}
        </View>
        {item.body ? (
          <Text style={[s.bodyText, { color: P.mid }]} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={[s.time, { color: P.mid }]}>
          {formatInboxTimestamp(item.receivedAt)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={P.mid} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowGap: {
    marginBottom: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
