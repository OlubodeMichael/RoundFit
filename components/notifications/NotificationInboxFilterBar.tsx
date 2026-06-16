import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  metaForNotificationScreen,
  NOTIFICATION_INBOX_META,
} from '@/components/notifications/notification-inbox-meta';
import type { SettingsPalette } from '@/components/profile/settings-ui';
import type { NotificationScreenKey } from '@/types/notification-inbox';
import {
  DEFAULT_NOTIFICATION_INBOX_FILTERS,
  NOTIFICATION_INBOX_CHIP_OPTIONS,
  NOTIFICATION_INBOX_SORT_OPTIONS,
  type NotificationInboxChip,
  type NotificationInboxFilters,
  isNotificationInboxFilterActive,
} from '@/utils/notification-inbox-filters';

interface NotificationInboxFilterBarProps {
  P: SettingsPalette;
  filters: NotificationInboxFilters;
  onChange: (filters: NotificationInboxFilters) => void;
  unreadCount: number;
  anchorTop: number;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const VISIBLE_CHIPS: NotificationInboxChip[] = ['all', 'unread'];

const CHIP_ICONS: Partial<Record<NotificationInboxChip, IoniconsName>> = {
  all: 'apps-outline',
  unread: 'mail-unread-outline',
};

function chipAccentColor(
  chip: NotificationInboxChip,
  isDark: boolean,
): string | undefined {
  if (chip === 'all' || chip === 'unread') return undefined;
  const meta = metaForNotificationScreen(chip as NotificationScreenKey);
  return isDark ? meta.iconColorDark : meta.iconColor;
}

function chipIcon(chip: NotificationInboxChip): IoniconsName | undefined {
  if (chip in CHIP_ICONS) return CHIP_ICONS[chip];
  if (chip in NOTIFICATION_INBOX_META) {
    return NOTIFICATION_INBOX_META[chip as NotificationScreenKey].icon;
  }
  return undefined;
}

function selectedChipColors(P: SettingsPalette): {
  bg: string;
  text: string;
  icon: string;
} {
  if (P.isDark) {
    return { bg: '#F4F4F5', text: '#18181B', icon: '#18181B' };
  }
  return { bg: '#18181B', text: '#FFFFFF', icon: '#FFFFFF' };
}

export function NotificationInboxFilterBar({
  P,
  filters,
  onChange,
  unreadCount,
  anchorTop,
}: NotificationInboxFilterBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedColors = selectedChipColors(P);

  const menuActive = useMemo(
    () =>
      isNotificationInboxFilterActive(filters) &&
      !VISIBLE_CHIPS.includes(filters.chip),
    [filters],
  );

  const sortActive = filters.sort !== DEFAULT_NOTIFICATION_INBOX_FILTERS.sort;

  function patch(partial: Partial<NotificationInboxFilters>) {
    onChange({ ...filters, ...partial });
  }

  function selectChip(chip: NotificationInboxChip) {
    onChange({ ...filters, chip });
  }

  return (
    <View style={s.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {VISIBLE_CHIPS.map((chip) => {
          const option = NOTIFICATION_INBOX_CHIP_OPTIONS.find(
            (o) => o.value === chip,
          );
          if (!option) return null;

          const selected = filters.chip === chip;
          const icon = chipIcon(chip);
          const accent = chipAccentColor(chip, P.isDark);
          const showBadge = chip === 'unread' && unreadCount > 0;

          return (
            <Pressable
              key={chip}
              onPress={() => selectChip(chip)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [
                s.chip,
                selected
                  ? { backgroundColor: selectedColors.bg }
                  : {
                      backgroundColor: P.isDark
                        ? 'rgba(255,255,255,0.07)'
                        : 'rgba(0,0,0,0.05)',
                    },
                pressed && s.chipPressed,
              ]}
            >
              {icon ? (
                <Ionicons
                  name={icon}
                  size={15}
                  color={
                    selected
                      ? selectedColors.icon
                      : accent ?? P.dim
                  }
                />
              ) : null}
              <Text
                style={[
                  s.chipText,
                  {
                    color: selected ? selectedColors.text : P.dim,
                    fontWeight: selected ? '700' : '600',
                  },
                ]}
              >
                {option.label}
              </Text>
              {showBadge ? (
                <View
                  style={[
                    s.badge,
                    {
                      backgroundColor: selected
                        ? P.isDark
                          ? 'rgba(24,24,27,0.14)'
                          : 'rgba(255,255,255,0.22)'
                        : P.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.badgeText,
                      {
                        color: selected ? selectedColors.text : '#FFFFFF',
                      },
                    ]}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Filter and sort notifications"
        style={({ pressed }) => [
          s.menuBtn,
          {
            backgroundColor: P.isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(0,0,0,0.05)',
          },
          (menuActive || sortActive) && {
            backgroundColor: P.isDark
              ? 'rgba(249,115,22,0.16)'
              : 'rgba(249,115,22,0.1)',
          },
          pressed && s.chipPressed,
        ]}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={menuActive || sortActive ? P.accent : P.dim}
        />
        {menuActive || sortActive ? (
          <View style={[s.menuDot, { backgroundColor: P.accent }]} />
        ) : null}
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={[s.modalRoot, { paddingTop: anchorTop + 96 }]}>
          <Pressable
            style={s.backdrop}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Close filter menu"
          />
          <View
            style={[
              s.menu,
              {
                backgroundColor: P.card,
                borderColor: P.edge,
                shadowOpacity: P.isDark ? 0.45 : 0.1,
              },
            ]}
          >
            <Text style={[s.menuHeading, { color: P.text }]}>Filter</Text>

            <Text style={[s.menuLabel, { color: P.faint }]}>Category</Text>
            {NOTIFICATION_INBOX_CHIP_OPTIONS.map((option) => {
              const selected = filters.chip === option.value;
              const icon = chipIcon(option.value);
              const accent = chipAccentColor(option.value, P.isDark);
              return (
                <FilterRow
                  key={option.value}
                  label={option.label}
                  icon={icon}
                  iconColor={selected ? P.accent : accent ?? P.dim}
                  selected={selected}
                  P={P}
                  onPress={() => patch({ chip: option.value })}
                />
              );
            })}

            <View style={[s.menuDivider, { backgroundColor: P.hair }]} />

            <Text style={[s.menuLabel, { color: P.faint }]}>Sort</Text>
            {NOTIFICATION_INBOX_SORT_OPTIONS.map((option) => {
              const selected = filters.sort === option.value;
              return (
                <FilterRow
                  key={option.value}
                  label={option.label}
                  icon={
                    option.value === 'newest'
                      ? 'arrow-down-outline'
                      : 'arrow-up-outline'
                  }
                  iconColor={selected ? P.accent : P.dim}
                  selected={selected}
                  P={P}
                  onPress={() => patch({ sort: option.value })}
                />
              );
            })}

            {isNotificationInboxFilterActive(filters) ? (
              <Pressable
                onPress={() => {
                  onChange(DEFAULT_NOTIFICATION_INBOX_FILTERS);
                  setMenuOpen(false);
                }}
                style={({ pressed }) => [
                  s.resetBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.resetText, { color: P.dim }]}>Reset filters</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterRow({
  label,
  icon,
  iconColor,
  selected,
  P,
  onPress,
}: {
  label: string;
  icon?: IoniconsName;
  iconColor: string;
  selected: boolean;
  P: SettingsPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        pressed && { opacity: 0.7 },
        selected && {
          backgroundColor: P.isDark
            ? 'rgba(249,115,22,0.12)'
            : 'rgba(249,115,22,0.08)',
        },
      ]}
    >
      <View style={s.rowLeft}>
        {icon ? (
          <View
            style={[
              s.rowIcon,
              {
                backgroundColor: P.isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
        ) : null}
        <Text
          style={[
            s.rowText,
            { color: selected ? P.text : P.dim, fontWeight: selected ? '700' : '600' },
          ]}
        >
          {label}
        </Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={P.accent} />
      ) : (
        <View style={s.rowCheckPlaceholder} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
    minHeight: 36,
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    fontSize: 14,
    letterSpacing: -0.25,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  menu: {
    width: 264,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  menuHeading: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.35,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 15,
    letterSpacing: -0.25,
  },
  rowCheckPlaceholder: {
    width: 20,
    height: 20,
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
});
