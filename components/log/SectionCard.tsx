import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── SectionCard ────────────────────────────────────────────────────────────
// Navigation tile used on the Daily Log hub. Presents a section (Food, Sleep,
// Workout, ...) with its leading value, a caption, and an optional progress
// bar. Staggers in on mount via the `delay` prop.
export function SectionCard({
  delay = 0,
  accent,
  accentSoft,
  icon,
  title,
  eyebrow,
  valueBig,
  valueSmall,
  caption,
  progress,
  onPress,
}: {
  delay?:      number;
  accent:      string;
  accentSoft:  string;
  icon:        IoniconName;
  title:       string;
  eyebrow:     string;
  valueBig:    string;
  valueSmall:  string;
  caption:     string;
  /** 0..1. When provided, renders a thin progress bar under the caption. */
  progress?:   number;
  onPress:     () => void;
}) {
  const P    = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         1,
      duration:        560,
      delay,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.card,
          { backgroundColor: P.card, borderColor: P.cardEdge },
          pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
        ]}
      >
        <View style={[s.icon, { backgroundColor: accentSoft }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.eyebrow, { color: P.textFaint }]}>{eyebrow}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={[s.title, { color: P.text }]} numberOfLines={1}>
              {title}
            </Text>
            {valueBig !== '—' && (
              <Text style={[s.value, { color: accent }]} numberOfLines={1}>
                · {valueBig}{valueSmall ? ` ${valueSmall}` : ''}
              </Text>
            )}
          </View>
          <Text style={[s.caption, { color: P.textFaint }]} numberOfLines={1}>
            {caption}
          </Text>

          {typeof progress === 'number' && (
            <View style={[s.track, { backgroundColor: P.sunken }]}>
              <View
                style={[
                  s.fill,
                  { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: accent },
                ]}
              />
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    padding:       16,
    borderRadius:  22,
    borderWidth:   StyleSheet.hairlineWidth,
  },
  icon: {
    width:          44, height: 44, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  title: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  value: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  caption: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.1,
  },
  track: {
    marginTop:    8,
    height:       4,
    borderRadius: 2,
    overflow:     'hidden',
  },
  fill: {
    height: '100%',
  },
});
