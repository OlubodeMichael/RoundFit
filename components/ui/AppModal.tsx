import React, { useEffect, useRef } from 'react';
import {
  Modal, Pressable, View, Text, TouchableWithoutFeedback,
  Animated, StyleSheet, PanResponder, Dimensions, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Context that lets nested ScrollViews report their scroll position back to
 * AppModal so swipe-to-dismiss only captures when the list is at the top.
 */
export const ModalScrollContext = React.createContext<{
  onScroll: (y: number) => void;
}>({ onScroll: () => {} });

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
  /** Where users can start swipe-to-dismiss gesture. */
  dismissGestureArea?: 'handle' | 'sheet';
}

// ── Component ──────────────────────────────────────────────────────────────

export function AppModal({
  visible,
  onClose,
  children,
  title,
  sheetHeight = 0.55,
  openAnimation = 'ease',
  dismissGestureArea = 'handle',
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
          toValue: resolvedH,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [openAnimation, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll tracking (used by sheet-mode dismiss gate) ─────────────────
  const sheetScrollY = useRef(0);

  // Stable refs so the PanResponder closure (created once) always calls
  // the current onClose and reads the current dismissGestureArea prop.
  const onCloseRef             = useRef(onClose);
  const dismissGestureAreaRef  = useRef(dismissGestureArea);
  onCloseRef.current            = onClose;
  dismissGestureAreaRef.current = dismissGestureArea;

  // ── Drag to dismiss ────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      // Handle mode: normal negotiation — wins if more vertical than horizontal.
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dismissGestureAreaRef.current === 'handle' &&
        Math.abs(dy) > Math.abs(dx) && dy > 4,

      // Sheet mode: use the capture phase so we win over a nested ScrollView,
      // but only when the list is scrolled to the very top (y ≤ 0) and the
      // user is pulling down — otherwise normal ScrollView scrolling applies.
      onMoveShouldSetPanResponderCapture: (_, { dy, dx }) =>
        dismissGestureAreaRef.current === 'sheet' &&
        Math.abs(dy) > Math.abs(dx) &&
        dy > 6 &&
        sheetScrollY.current <= 0,

      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) dragY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > 1.2) {
          onCloseRef.current();
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
          {...(dismissGestureArea === 'sheet' ? pan.panHandlers : {})}
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
          {/* ── Drag handle — always swipeable regardless of dismissGestureArea ── */}
          <View {...pan.panHandlers} style={s.handleZone}>
            <View style={[s.handle, { backgroundColor: mid }]} />
          </View>

          {/* ── Header ── */}
          {title ? (
            <View style={[s.header, { borderBottomColor: lo }]}>
              <View style={[s.headerAccent, { backgroundColor: '#F97316' }]} />
              <Text style={[s.headerTitle, { color: hi }]}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={[s.closeBtn, { backgroundColor: lo }]}
              >
                <Text style={[s.closeBtnText, { color: mid }]}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Content ── */}
          <ModalScrollContext.Provider value={{ onScroll: (y) => { sheetScrollY.current = y; } }}>
            {children}
          </ModalScrollContext.Provider>
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
    flex: 1,
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    letterSpacing: 0.1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
