import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import type { Directive } from '@/types/daily-coaching';

export type MascotMood = 'calm' | 'alert' | 'energized' | 'recovery';

type MascotMotion = {
  duration: number;
  y: number;
  scale: number;
  rotate: string;
};

const MASCOT_IMAGES: Record<MascotMood, ImageSourcePropType> = {
  calm: require('../../assets/mascot/mascot-obsidian-token-calm.png'),
  alert: require('../../assets/mascot/mascot-obsidian-token-alert.png'),
  energized: require('../../assets/mascot/mascot-obsidian-token-energized.png'),
  recovery: require('../../assets/mascot/mascot-obsidian-token-recovery.png'),
};

const MOTION_BY_MOOD: Record<MascotMood, MascotMotion> = {
  calm: {
    duration: 2200,
    y: 2,
    scale: 0.015,
    rotate: '0deg',
  },
  alert: {
    duration: 1800,
    y: 3,
    scale: 0.02,
    rotate: '0deg',
  },
  energized: {
    duration: 860,
    y: 7,
    scale: 0.045,
    rotate: '-2deg',
  },
  recovery: {
    duration: 2100,
    y: 2,
    scale: 0.018,
    rotate: '2deg',
  },
};

export function moodFromDirective(directive: Directive): MascotMood {
  switch (directive) {
    case 'rest':
      return 'calm';
    case 'light':
      return 'recovery';
    case 'moderate':
      return 'alert';
    case 'train_hard':
      return 'energized';
  }
}

export function moodFromReadinessRecommendation(
  recommendation: string | null | undefined,
): MascotMood {
  switch (recommendation) {
    case 'Train hard':
      return 'energized';
    case 'Moderate':
      return 'alert';
    case 'Light workout':
      return 'recovery';
    case 'Rest':
      return 'calm';
    default:
      return 'alert';
  }
}

export interface AnimatedMascotProps {
  mood?: MascotMood;
  size?: number;
  style?: StyleProp<ViewStyle>;
  badgeSpace?: boolean;
}

export function AnimatedMascot({
  mood = 'alert',
  size = 72,
  style,
  badgeSpace = true,
}: AnimatedMascotProps) {
  const reduceMotion = useReduceMotion();
  const float = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const motion = MOTION_BY_MOOD[mood];

  useEffect(() => {
    float.stopAnimation();
    pop.stopAnimation();
    float.setValue(0);
    pop.setValue(0);

    if (reduceMotion) return;

    Animated.parallel([
      Animated.spring(pop, {
        toValue: 1,
        friction: 7,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, {
            toValue: 1,
            duration: motion.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(float, {
            toValue: 0,
            duration: motion.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    return () => {
      float.stopAnimation();
      pop.stopAnimation();
    };
  }, [float, motion.duration, pop, reduceMotion]);

  const animatedStyle = useMemo(() => {
    if (reduceMotion) return undefined;

    const translateY = float.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -motion.y],
    });
    const scale = Animated.add(
      pop.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
      }),
      float.interpolate({
        inputRange: [0, 1],
        outputRange: [0, motion.scale],
      }),
    );
    const rotate = float.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', motion.rotate],
    });

    return {
      transform: [{ translateY }, { scale }, { rotate }],
    };
  }, [float, motion.rotate, motion.scale, motion.y, pop, reduceMotion]);

  return (
    <View
      pointerEvents="none"
      style={[
        s.wrap,
        {
          width: size,
          height: badgeSpace ? Math.round(size * 1.14) : size,
          paddingTop: badgeSpace ? Math.round(size * 0.14) : 0,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Image
        source={MASCOT_IMAGES[mood]}
        resizeMode="contain"
        style={[
          s.image,
          {
            width: size,
            height: size,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    flexShrink: 0,
  },
});
