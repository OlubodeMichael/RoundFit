import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatInboxRowTime,
  iconColorsForNotification,
  INBOX_ROW_DIVIDER_INSET,
  metaForNotificationScreen,
} from '@/components/notifications/notification-inbox-meta';
import type { SettingsPalette } from '@/components/profile/settings-ui';
import type { InboxNotification } from '@/types/notification-inbox';
import { resolveInboxNotificationScreen } from '@/utils/notification-routes';

export interface NotificationInboxRowProps {
  item: InboxNotification;
  P: SettingsPalette;
  onPress: () => void;
}

export function NotificationInboxRow({
  item,
  P,
  onPress,
}: NotificationInboxRowProps) {
  const unread = !item.read;
  const screen = resolveInboxNotificationScreen(item);
  const meta = metaForNotificationScreen(screen);
  const { circleBg, iconColor } = iconColorsForNotification(screen, P.isDark);

  return (
    <View style={s.rowWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.body ?? ''}. ${unread ? 'Unread.' : ''}`}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
      >
        <View style={[s.iconCircle, { backgroundColor: circleBg }]}>
          <Ionicons name={meta.icon} size={22} color={iconColor} />
        </View>

        <View style={s.content}>
          <Text
            style={[
              s.title,
              { color: P.text, fontWeight: unread ? '700' : '600' },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.body ? (
            <Text style={[s.body, { color: P.dim }]} numberOfLines={1}>
              {item.body}
            </Text>
          ) : null}
        </View>

        <View style={s.meta}>
          {unread ? (
            <View style={[s.unreadDot, { backgroundColor: P.accent }]} />
          ) : (
            <View style={s.dotPlaceholder} />
          )}
          <Text style={[s.time, { color: P.faint }]}>
            {formatInboxRowTime(item.receivedAt)}
          </Text>
        </View>
      </Pressable>

      <View
        style={[
          s.divider,
          { backgroundColor: P.edge, marginLeft: INBOX_ROW_DIVIDER_INSET },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  rowWrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  pressed: {
    opacity: 0.65,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: 4,
  },
  title: {
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  meta: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    minWidth: 56,
    paddingVertical: 2,
    gap: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPlaceholder: {
    width: 8,
    height: 8,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginRight: 16,
  },
});
