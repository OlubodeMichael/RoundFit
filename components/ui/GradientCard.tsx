import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  getCardAccent,
  type CardAccent,
  type CardAccentOptions,
  type CardAccentVariant,
} from '@/components/ui/gradient-card-theme';

export type GradientCardLayout = 'metric' | 'full';
export type GradientCardCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNER_GRADIENT: Record<
  GradientCardCorner,
  { start: { x: number; y: number }; end: { x: number; y: number } }
> = {
  'top-left': { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  'top-right': { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  'bottom-left': { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  'bottom-right': { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
};

export interface GradientCardPalette {
  card: string;
  cardEdge: string;
  isDark: boolean;
}

export interface GradientCardProps {
  children: React.ReactNode;
  /**
   * Preset accent (gradient + icon colors). Use `accent` instead for a custom CardAccent.
   */
  variant?: CardAccentVariant;
  /** Custom accent — overrides `variant`. */
  accent?: CardAccent;
  palette: GradientCardPalette;
  accentOptions?: CardAccentOptions;
  layout?: GradientCardLayout;
  corner?: GradientCardCorner;
  delay?: number;
  animated?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/**
 * Subtle corner gradient card shell — profile Daily Targets style.
 *
 * @example
 * <GradientCard variant="meals" palette={P} delay={200}>
 *   <YourContent />
 * </GradientCard>
 */
export function GradientCard({
  children,
  variant = 'macros',
  accent: accentProp,
  palette,
  accentOptions,
  layout = 'full',
  corner = 'top-left',
  delay = 0,
  animated = true,
  style,
  contentStyle,
}: GradientCardProps) {
  const accent =
    accentProp ?? getCardAccent(variant, palette.isDark, accentOptions);
  const { start, end } = CORNER_GRADIENT[corner];
  const anim = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 620,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay, animated]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const isMetric = layout === 'metric';
  const shellStyle = isMetric ? s.shellMetric : s.shellFull;
  const gradientStyle = isMetric ? s.gradientMetric : s.gradientFull;

  return (
    <Animated.View
      style={[
        isMetric ? s.wrapMetric : s.wrapFull,
        style,
        s.shadow,
        animated && { opacity: anim, transform: [{ translateY }] },
      ]}
    >
      <LinearGradient
        colors={[...accent.gradient]}
        start={start}
        end={end}
        style={[
          gradientStyle,
          contentStyle,
          { backgroundColor: palette.card, borderColor: palette.cardEdge },
        ]}
      >
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrapMetric: {
    flex: 1,
    minWidth: 0,
  },
  wrapFull: {
    width: '100%',
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  shellMetric: {},
  shellFull: {},
  gradientMetric: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 118,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  gradientFull: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});

// Re-export theme helpers for consumers that need icon colors without the card shell.
export {
  getCardAccent,
  type CardAccent,
  type CardAccentVariant,
  type CardAccentOptions,
} from '@/components/ui/gradient-card-theme';
