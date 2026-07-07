import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
  Text,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  PanResponder,
  Dimensions,
  Easing,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalGlassSurface } from '@/components/ui/ModalGlassSurface';
import { MODAL_GLASS, modalGlassColors } from '@/components/ui/modal-glass-theme';
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

export type AppModalVariant = 'floating' | 'full';

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Text shown in the modal header. Omit for a header-less sheet. */
  title?: string;
  /**
   * Height of the sheet.
   * - number 0–1 → fraction of screen height (default 0.55)
   * - 'full'     → nearly full-screen floating card
   */
  sheetHeight?: number | 'full';
  /**
   * `floating` — inset card with glass blur (default).
   * `full`     — taller floating card; inferred when sheetHeight is `"full"`.
   */
  variant?: AppModalVariant;
  /** Use "ease" for smooth bottom-up timing animation instead of spring. */
  openAnimation?: 'spring' | 'ease';
  /** Where users can start swipe-to-dismiss gesture. */
  dismissGestureArea?: 'handle' | 'sheet';
  /** Shifts the sheet when the software keyboard is visible. */
  keyboardAvoiding?: boolean;
}

function resolveVariant(
  variant: AppModalVariant | undefined,
  sheetHeight: number | 'full',
): AppModalVariant {
  if (variant) return variant;
  return sheetHeight === 'full' ? 'full' : 'floating';
}

function resolveHeight(
  sheetHeight: number | 'full',
  variant: AppModalVariant,
  insets: { top: number; bottom: number },
): number {
  const verticalGutter =
    insets.top +
    insets.bottom +
    MODAL_GLASS.FLOATING_BOTTOM_GAP +
    (variant === 'full' ? MODAL_GLASS.FULL_TOP_GAP : 0);

  if (sheetHeight === 'full') {
    return SCREEN_H - verticalGutter;
  }

  const fractionHeight = SCREEN_H * sheetHeight;
  const maxHeight = SCREEN_H - verticalGutter - MODAL_GLASS.FLOATING_H_MARGIN * 2;
  return Math.min(fractionHeight, maxHeight);
}

export function AppModal({
  visible,
  onClose,
  children,
  title,
  sheetHeight = 0.55,
  variant: variantProp,
  openAnimation = 'ease',
  dismissGestureArea = 'handle',
  keyboardAvoiding = false,
}: AppModalProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = modalGlassColors(isDark);

  const variant = resolveVariant(variantProp, sheetHeight);
  const resolvedH = useMemo(
    () => resolveHeight(sheetHeight, variant, insets),
    [sheetHeight, variant, insets.top, insets.bottom],
  );

  const slideY = useRef(new Animated.Value(resolvedH)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  // Keep the native Modal (and its BlurView) mounted until the close animation
  // finishes. Tearing a `UIVisualEffectView` down in the same frame that
  // `visible` flips to false leaves a frozen blurred snapshot over the whole app
  // on iOS (cleared only by the next touch), so we defer the unmount.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (!mounted) slideY.setValue(resolvedH);
  }, [resolvedH, slideY, mounted]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.setValue(0);
      slideY.setValue(resolvedH);
      const openSheetAnim =
        openAnimation === 'ease'
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
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
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
      ]).start(({ finished }) => {
        // Only unmount when the close animation ran to completion. A reopen
        // interrupts it (finished === false), so we keep the Modal mounted.
        if (finished) setMounted(false);
      });
    }
  }, [openAnimation, visible, resolvedH]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheetScrollY = useRef(0);

  const onCloseRef = useRef(onClose);
  const dismissGestureAreaRef = useRef(dismissGestureArea);
  onCloseRef.current = onClose;
  dismissGestureAreaRef.current = dismissGestureArea;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dismissGestureAreaRef.current === 'handle' &&
        Math.abs(dy) > Math.abs(dx) &&
        dy > 4,

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
          Keyboard.dismiss();
          dragY.setValue(0);
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 300,
          }).start();
        }
      },
    }),
  ).current;

  const dismissModal = () => {
    onClose();
    Keyboard.dismiss();
  };

  const modalBody = (
    <ModalScrollContext.Provider
      value={{
        onScroll: (y) => {
          sheetScrollY.current = y;
        },
      }}
    >
      {children}
    </ModalScrollContext.Provider>
  );

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={dismissModal}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <TouchableWithoutFeedback onPress={dismissModal}>
          <Animated.View
            style={[s.backdrop, { backgroundColor: colors.backdrop, opacity: backdropOp }]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          {...(dismissGestureArea === 'sheet' ? pan.panHandlers : {})}
          style={[
            s.sheetOuter,
            {
              height: resolvedH,
              marginHorizontal: MODAL_GLASS.FLOATING_H_MARGIN,
              marginBottom: insets.bottom + MODAL_GLASS.FLOATING_BOTTOM_GAP,
              transform: [{ translateY: Animated.add(slideY, dragY) }],
            },
          ]}
        >
          <ModalGlassSurface isDark={isDark} style={s.glass}>
            <View {...pan.panHandlers} style={s.handleZone}>
              <View style={[s.handle, { backgroundColor: colors.mid }]} />
            </View>

            {title ? (
              <View style={s.header}>
                <Text style={[s.headerTitle, { color: colors.hi }]}>{title}</Text>
                <Pressable
                  onPress={dismissModal}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={[s.closeBtn, { backgroundColor: colors.lo }]}
                >
                  <Ionicons name="close" size={16} color={colors.mid} />
                </Pressable>
              </View>
            ) : null}

            {keyboardAvoiding ? (
              <KeyboardAvoidingView
                style={s.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
              >
                {modalBody}
              </KeyboardAvoidingView>
            ) : (
              <View style={s.content}>{modalBody}</View>
            )}
          </ModalGlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  sheetOuter: {
    borderRadius: MODAL_GLASS.SHEET_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 24,
  },

  glass: {
    flex: 1,
  },

  handleZone: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.55,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    letterSpacing: 0.1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    paddingBottom: 4,
  },
});
