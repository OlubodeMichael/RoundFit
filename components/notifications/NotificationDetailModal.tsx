import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatInboxTimestamp,
  iconColorsForNotification,
  metaForNotificationScreen,
} from '@/components/notifications/notification-inbox-meta';
import type { SettingsPalette } from '@/components/profile/settings-ui';
import { AppModal } from '@/components/ui/AppModal';
import type { InboxNotification } from '@/types/notification-inbox';
import { ctaLabelForInboxNotification, resolveInboxNotificationScreen } from '@/utils/notification-routes';

interface NotificationDetailModalProps {
  item: InboxNotification | null;
  visible: boolean;
  P: SettingsPalette;
  onClose: () => void;
  onAction?: () => void;
}

function sheetHeightFor(item: InboxNotification, hasAction: boolean): number {
  const hasBody = Boolean(item.body?.trim());
  if (hasAction) return hasBody ? 0.54 : 0.47;
  return hasBody ? 0.43 : 0.37;
}

/** Darker copy on the light glass sheet — backgrounds stay unchanged. */
function modalTextColors(P: SettingsPalette): {
  text: string;
  dim: string;
  faint: string;
  accent: string;
} {
  if (P.isDark) {
    return { text: P.text, dim: P.dim, faint: P.faint, accent: P.accent };
  }
  return {
    text: '#111111',
    dim: '#374151',
    faint: '#6B7280',
    accent: P.accent,
  };
}

function dismissButtonColors(P: SettingsPalette): {
  bg: string;
  text: string;
} {
  if (P.isDark) {
    return { bg: '#F4F4F5', text: '#18181B' };
  }
  return { bg: '#18181B', text: '#FFFFFF' };
}

const EMPTY_BODY = 'No additional details were included with this notification.';

export function NotificationDetailModal({
  item,
  visible,
  P,
  onClose,
  onAction,
}: NotificationDetailModalProps) {
  if (!item) return null;

  const T = modalTextColors(P);
  const screen = resolveInboxNotificationScreen(item);
  const meta = metaForNotificationScreen(screen);
  const { circleBg, iconColor } = iconColorsForNotification(screen, P.isDark);
  const ctaLabel = ctaLabelForInboxNotification(item);
  const hasAction = ctaLabel != null && onAction != null;
  const dismissColors = dismissButtonColors(P);
  const bodyText = item.body?.trim() || EMPTY_BODY;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title={meta.label}
      sheetHeight={sheetHeightFor(item, hasAction)}
      dismissGestureArea="sheet"
    >
      <View style={s.shell}>
        <View style={s.content}>
          <View style={s.heroRow}>
            <View style={[s.iconWrap, { backgroundColor: circleBg }]}>
              <Ionicons name={meta.icon} size={24} color={iconColor} />
            </View>

            <View style={s.heroCopy}>
              <View
                style={[
                  s.statusPill,
                  {
                    backgroundColor: hasAction
                      ? P.isDark
                        ? 'rgba(249,115,22,0.14)'
                        : 'rgba(249,115,22,0.10)'
                      : P.isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <Text
                  style={[
                    s.statusText,
                    { color: hasAction ? T.accent : T.dim },
                  ]}
                >
                  {hasAction ? 'Action needed' : 'For your info'}
                </Text>
              </View>
              <Text style={[s.time, { color: T.faint }]}>
                {formatInboxTimestamp(item.receivedAt)}
              </Text>
            </View>
          </View>

          <Text style={[s.title, { color: T.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          <View
            style={[
              s.messageCard,
              {
                backgroundColor: P.isDark ? P.sunken : '#F3F4F6',
                borderColor: P.edge,
              },
            ]}
          >
            <Text style={[s.body, { color: T.dim }]} numberOfLines={3}>
              {bodyText}
            </Text>
          </View>
        </View>

        <View style={[s.footer, { borderTopColor: P.edge }]}>
          {hasAction ? (
            <>
              <Pressable
                onPress={onAction}
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.btn,
                  { backgroundColor: P.accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={s.btnLabelLight}>{ctaLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.btn,
                  s.secondaryBtn,
                  {
                    backgroundColor: P.isDark ? P.sunken : '#ECECEF',
                    borderColor: P.edge,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Text style={[s.secondaryLabel, { color: T.text }]}>Not now</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.btn,
                {
                  backgroundColor: dismissColors.bg,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[s.btnLabelDark, { color: dismissColors.text }]}>
                Got it
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 4,
    flexShrink: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  time: {
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 24,
    marginBottom: 10,
  },
  messageCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    justifyContent: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    flexShrink: 0,
  },
  btn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnLabelLight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  btnLabelDark: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
