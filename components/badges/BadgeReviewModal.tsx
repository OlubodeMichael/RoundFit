import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { BadgeArt } from '@/components/badges/BadgeArt';
import { ModalGlassSurface } from '@/components/ui/ModalGlassSurface';
import { MODAL_GLASS, modalGlassColors } from '@/components/ui/modal-glass-theme';
import { useSettingsPalette } from '@/components/profile/settings-ui';
import { useTheme } from '@/hooks/use-theme';
import type { UserBadge } from '@/hooks/use-badges';

const REVIEW_ART_SIZE = 248;
const BADGE_EASE_IN_MS = 680;
const BADGE_EASE_OFFSET_Y = 32;

interface BadgeReviewModalProps {
  badge: UserBadge | null;
  visible: boolean;
  onClose: () => void;
  /** Unlock celebration — shows "Badge unlocked" instead of generic earned copy. */
  celebration?: boolean;
}

function formatEarnedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function BadgeReviewModal({
  badge,
  visible,
  onClose,
  celebration = false,
}: BadgeReviewModalProps) {
  const P = useSettingsPalette();
  const { isDark } = useTheme();
  const colors = modalGlassColors(isDark);
  const backdropOp = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const badgeProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      badgeProgress.setValue(0);

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const midHaptic = setTimeout(
        () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        Math.round(BADGE_EASE_IN_MS * 0.45),
      );
      const endHaptic = setTimeout(
        () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        BADGE_EASE_IN_MS,
      );

      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(badgeProgress, {
          toValue: 1,
          duration: BADGE_EASE_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      return () => {
        clearTimeout(midHaptic);
        clearTimeout(endHaptic);
      };
    }

    badgeProgress.setValue(0);

    Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
  }, [visible, badge?.id, backdropOp, badgeProgress, opacity, scale]);

  if (!badge) return null;

  const earnedDate = badge.earned ? formatEarnedDate(badge.earned_at) : null;
  const statusLabel = celebration
    ? earnedDate
      ? `Badge unlocked · ${earnedDate}`
      : 'Badge unlocked'
    : earnedDate
      ? badge.times_earned > 1
        ? `Earned ${badge.times_earned} times · latest ${earnedDate}`
        : `Earned ${earnedDate}`
      : 'Not earned yet';
  const badgeScale = badgeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const badgeOpacity = badgeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const badgeTranslateY = badgeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [BADGE_EASE_OFFSET_Y, 0],
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[s.backdrop, { backgroundColor: colors.backdrop, opacity: backdropOp }]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            s.cardOuter,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <ModalGlassSurface isDark={isDark} style={s.glass}>
            <View style={s.cardBody}>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[s.closeBtn, { backgroundColor: colors.lo }]}
              >
                <Ionicons name="close" size={16} color={colors.mid} />
              </Pressable>

              <Animated.View
                style={{
                  opacity: badgeOpacity,
                  transform: [{ translateY: badgeTranslateY }, { scale: badgeScale }],
                }}
              >
                <BadgeArt
                  badgeId={badge.id}
                  icon={badge.icon}
                  earned
                  size={REVIEW_ART_SIZE}
                  backgroundColor={P.sunken}
                  imageFillRatio={1}
                />
              </Animated.View>

              {celebration ? (
                <Text style={[s.celebrationEyebrow, { color: P.accent }]}>
                  BADGE UNLOCKED
                </Text>
              ) : null}
              <Text style={[s.name, { color: P.text, marginTop: celebration ? 12 : 24 }]}>
                {badge.name}
              </Text>
              <Text style={[s.description, { color: P.dim }]}>{badge.description}</Text>

              <Text style={[s.status, { color: badge.earned ? P.accent : P.faint }]}>
                {statusLabel}
              </Text>
            </View>
          </ModalGlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  cardOuter: {
    width: '100%',
    borderRadius: MODAL_GLASS.SHEET_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 16,
  },
  glass: {
    width: '100%',
  },
  cardBody: {
    paddingTop: 52,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationEyebrow: {
    marginTop: 24,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  status: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
