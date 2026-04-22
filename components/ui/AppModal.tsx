import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableWithoutFeedback,
  Animated, StyleSheet, PanResponder, Dimensions, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

const { height: SCREEN_H } = Dimensions.get('window');
const DISMISS_THRESHOLD = 72;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AppModalProps {
  visible:      boolean;
  onClose:      () => void;
  children:     React.ReactNode;
  /** Text shown in the modal header. Omit for a header-less sheet. */
  title?:       string;
  /**
   * Height of the sheet.
   * - number 0–1 → fraction of screen height (default 0.55)
   * - 'full'     → 92 % of screen height
   */
  sheetHeight?: number | 'full';
  /** Use "ease" for smooth bottom-up timing animation instead of spring. */
  openAnimation?: 'spring' | 'ease';
}

// ── Component ──────────────────────────────────────────────────────────────

export function AppModal({
  visible,
  onClose,
  children,
  title,
  sheetHeight = 0.55,
  openAnimation = 'ease',
}: AppModalProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const resolvedH = sheetHeight === 'full' ? SCREEN_H * 0.92 : SCREEN_H * (sheetHeight as number);

  // ── Animation values ──────────────────────────────────────────────────
  const slideY      = useRef(new Animated.Value(resolvedH)).current;
  const backdropOp  = useRef(new Animated.Value(0)).current;
  const dragY       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      const openSheetAnim = openAnimation === 'ease'
        ? Animated.timing(slideY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(slideY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 220,
            mass: 0.9,
          });
      Animated.parallel([
        openSheetAnim,
        Animated.timing(backdropOp, {
          toValue: 1, duration: 280, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: resolvedH, duration: 240, useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [openAnimation, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag to dismiss ────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > Math.abs(dx) && dy > 4,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) dragY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > 1.2) {
          onClose();
          dragY.setValue(0);
        } else {
          Animated.spring(dragY, {
            toValue: 0, useNativeDriver: true,
            damping: 20, stiffness: 300,
          }).start();
        }
      },
    })
  ).current;

  // ── Theme ──────────────────────────────────────────────────────────────
  const bg   = isDark ? '#1C1D23' : '#FAFAF8';
  const hi   = isDark ? '#F4F4F5' : '#111111';
  const lo   = isDark ? '#2A2A32' : '#EBEBEB';
  const mid  = isDark ? '#707078' : '#BBBBBB';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>

        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[s.backdrop, { opacity: backdropOp }]} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: bg,
              height: resolvedH,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: Animated.add(slideY, dragY) }],
            },
          ]}
        >
          {/* ── Drag handle ── */}
          <View {...pan.panHandlers} style={s.handleZone}>
            <View style={[s.handle, { backgroundColor: mid }]} />
          </View>

          {/* ── Header ── */}
          {title ? (
            <View style={[s.header, { borderBottomColor: lo }]}>
              <View style={[s.headerAccent, { backgroundColor: '#F97316' }]} />
              <Text style={[s.headerTitle, { color: hi }]}>{title}</Text>
            </View>
          ) : null}

          {/* ── Content ── */}
          {children}
        </Animated.View>

      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    // Subtle top shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },

  handleZone: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    letterSpacing: 0.1,
  },
});
