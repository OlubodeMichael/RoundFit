import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationInboxEmpty } from '@/components/notifications/NotificationInboxEmpty';
import { NotificationInboxRow } from '@/components/notifications/NotificationInboxRow';
import { useNotificationInbox } from '@/hooks/use-notification-inbox';
import { useTheme } from '@/hooks/use-theme';
import { routeForNotificationScreen } from '@/utils/notification-routes';

function usePalette() {
  const { isDark } = useTheme();
  return isDark
    ? {
        bg: '#0A0B0F',
        card: '#1C1D23',
        edge: 'rgba(255,255,255,0.08)',
        hair: 'rgba(255,255,255,0.07)',
        hi: '#F4F4F5',
        mid: '#909096',
        accent: '#F97316',
        unreadDot: '#F97316',
      }
    : {
        bg: '#F2F2F6',
        card: '#FFFFFF',
        edge: 'rgba(0,0,0,0.06)',
        hair: 'rgba(0,0,0,0.06)',
        hi: '#09090B',
        mid: '#6B7280',
        accent: '#F97316',
        unreadDot: '#F97316',
      };
}

export default function NotificationsInboxScreen() {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, unreadCount, hydrated, markRead, markAllRead, clearAll } =
    useNotificationInbox();

  function confirmClearAll() {
    if (items.length === 0) return;
    Alert.alert(
      'Clear all notifications?',
      'This removes your notification history from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => void clearAll() },
      ],
    );
  }

  function handlePress(id: string, screen: string | undefined) {
    void markRead(id);
    const route = routeForNotificationScreen(screen);
    if (route) router.push(route as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: P.card, borderColor: P.edge }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={P.hi} />
          </TouchableOpacity>

          <View style={s.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={() => void markAllRead()}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={[s.actionText, { color: P.accent }]}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            )}
            {items.length > 0 && (
              <TouchableOpacity
                onPress={confirmClearAll}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={[s.actionText, { color: P.mid }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Text style={[s.eyebrow, { color: P.mid }]}>INBOX</Text>
          <Text style={[s.title, { color: P.hi }]}>Notifications</Text>
          <Text style={[s.sub, { color: P.mid }]}>
            {unreadCount > 0
              ? `${unreadCount} unread`
              : 'Everything you have received recently'}
          </Text>
        </View>

        {!hydrated ? (
          <ActivityIndicator color={P.accent} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <NotificationInboxEmpty hi={P.hi} mid={P.mid} accent={P.accent} />
        ) : (
          <View
            style={[
              s.card,
              { backgroundColor: P.card, borderColor: P.edge, marginHorizontal: 20 },
            ]}
          >
            {items.map((item, index) => (
              <View key={item.id}>
                {index > 0 && (
                  <View style={[s.divider, { backgroundColor: P.hair }]} />
                )}
                <NotificationInboxRow
                  item={item}
                  P={P}
                  last={index === items.length - 1}
                  onPress={() => handlePress(item.id, item.screen)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
});
