import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
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

import { NotificationDetailModal } from '@/components/notifications/NotificationDetailModal';
import { NotificationInboxEmpty } from '@/components/notifications/NotificationInboxEmpty';
import { NotificationInboxFilterBar } from '@/components/notifications/NotificationInboxFilterBar';
import { NotificationInboxRow } from '@/components/notifications/NotificationInboxRow';
import {
  groupInboxBySection,
  INBOX_SECTION_LABELS,
  INBOX_SECTION_ORDER,
} from '@/components/notifications/notification-inbox-meta';
import { useSettingsPalette } from '@/components/profile/settings-ui';
import { useNotificationInbox } from '@/hooks/use-notification-inbox';
import { routeForInboxNotification } from '@/utils/notification-routes';
import type { InboxNotification } from '@/types/notification-inbox';
import {
  DEFAULT_NOTIFICATION_INBOX_FILTERS,
  filterInboxNotifications,
  isNotificationInboxFilterActive,
  type NotificationInboxFilters,
} from '@/utils/notification-inbox-filters';

export default function NotificationsInboxScreen() {
  const P = useSettingsPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, unreadCount, hydrated, markRead, markAllRead, clearAll } =
    useNotificationInbox();
  const [filters, setFilters] = useState<NotificationInboxFilters>(
    DEFAULT_NOTIFICATION_INBOX_FILTERS,
  );
  const [selected, setSelected] = useState<InboxNotification | null>(null);

  const filteredItems = useMemo(
    () => filterInboxNotifications(items, filters),
    [items, filters],
  );
  const sections = groupInboxBySection(filteredItems);
  const filtersActive = isNotificationInboxFilterActive(filters);
  const filteredUnreadCount = useMemo(
    () => filteredItems.filter((item) => !item.read).length,
    [filteredItems],
  );

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

  function handlePress(item: InboxNotification) {
    void markRead(item.id);
    setSelected(item);
  }

  function handleModalAction() {
    if (!selected) return;
    const route = routeForInboxNotification(selected);
    setSelected(null);
    if (route) router.push(route as never);
  }

  function closeModal() {
    setSelected(null);
  }

  return (
    <View style={[s.screen, { backgroundColor: P.bg }]}>
      <View
        style={[
          s.nav,
          {
            paddingTop: insets.top + 4,
            backgroundColor: P.bg,
          },
        ]}
      >
        <TouchableOpacity
          style={[s.navBtn, { backgroundColor: P.card, borderColor: P.edge }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={P.text} strokeWidth={2.6} />
        </TouchableOpacity>

        <Text style={[s.navTitle, { color: P.text }]}>Notifications</Text>

        {unreadCount > 0 ? (
          <TouchableOpacity
            style={s.navAction}
            onPress={() => void markAllRead()}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={[s.navActionText, { color: P.accent }]}>Read all</Text>
          </TouchableOpacity>
        ) : items.length > 0 ? (
          <TouchableOpacity
            style={s.navAction}
            onPress={confirmClearAll}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={[s.navActionText, { color: P.dim }]}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.navActionSpacer} />
        )}
      </View>

      <NotificationInboxFilterBar
        P={P}
        filters={filters}
        onChange={setFilters}
        unreadCount={unreadCount}
        anchorTop={insets.top}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {filteredUnreadCount > 0 && (
          <View
            style={[
              s.unreadBanner,
              {
                backgroundColor: P.isDark ? P.card : P.sunken,
                borderColor: P.edge,
              },
            ]}
          >
            <View style={[s.unreadDot, { backgroundColor: P.accent }]} />
            <Text style={[s.unreadText, { color: P.dim }]}>
              {filteredUnreadCount} unread in this view
            </Text>
          </View>
        )}

        {!hydrated ? (
          <ActivityIndicator color={P.accent} style={s.loader} />
        ) : items.length === 0 ? (
          <NotificationInboxEmpty P={P} />
        ) : filteredItems.length === 0 ? (
          <NotificationInboxEmpty P={P} filtered />
        ) : (
          INBOX_SECTION_ORDER.map((key) => {
            const sectionItems = sections[key];
            if (sectionItems.length === 0) return null;

            return (
              <View key={key} style={s.section}>
                <Text style={[s.sectionLabel, { color: P.dim }]}>
                  {INBOX_SECTION_LABELS[key].toUpperCase()}
                </Text>
                <View>
                  {sectionItems.map((item) => (
                    <NotificationInboxRow
                      key={item.id}
                      item={item}
                      P={P}
                      onPress={() => handlePress(item)}
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}

        {hydrated && items.length > 0 && unreadCount === 0 && !filtersActive && (
          <TouchableOpacity
            style={s.clearFooter}
            onPress={confirmClearAll}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={[s.clearFooterText, { color: P.dim }]}>
              Clear notification history
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <NotificationDetailModal
        item={selected}
        visible={selected != null}
        P={P}
        onClose={closeModal}
        onAction={handleModalAction}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  navAction: {
    minWidth: 62,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navActionSpacer: {
    width: 62,
  },
  navActionText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  scroll: {
    flex: 1,
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unreadText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  loader: {
    marginTop: 48,
  },
  section: {
    marginTop: 20,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 20,
    marginBottom: 2,
  },
  clearFooter: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 8,
  },
  clearFooterText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
