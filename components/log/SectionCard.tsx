import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export function SectionCard({
  delay = 0,
  accent,
  accentSoft,
  icon,
  title,
  eyebrow: _eyebrow,
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
  progress?:   number;
  onPress:     () => void;
}) {
  const P      = usePalette();
  const anim   = useRef(new Animated.Value(0)).current;
  const hasVal = valueBig !== '—';

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         1,
      duration:        500,
      delay,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={{
        opacity:   anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.card,
          {
            backgroundColor: P.card,
            borderColor:     P.cardEdge,
            shadowColor:     '#000',
            shadowOpacity:   P.isDark ? 0.25 : 0.05,
            shadowRadius:    12,
            shadowOffset:    { width: 0, height: 3 },
          },
          pressed && { opacity: 0.82, transform: [{ scale: 0.988 }] },
          Platform.OS === 'android' && { elevation: 2 },
        ]}
      >
        {/* Icon */}
        <View style={[s.iconWrap, { backgroundColor: accentSoft }]}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>

        {/* Content */}
        <View style={s.content}>
          {/* Title row + value */}
          <View style={s.titleRow}>
            <Text style={[s.title, { color: P.text }]}>{title}</Text>
            <View style={s.valueWrap}>
              <Text
                style={[s.value, { color: hasVal ? accent : P.textFaint }]}
                numberOfLines={1}
              >
                {valueBig}
              </Text>
              {hasVal && !!valueSmall && (
                <Text style={[s.unit, { color: P.textFaint }]}> {valueSmall}</Text>
              )}
            </View>
          </View>

          {/* Caption */}
          <Text style={[s.caption, { color: P.textFaint }]} numberOfLines={1}>
            {caption}
          </Text>

          {/* Progress bar — food only */}
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

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={15} color={P.textFaint} />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 16,
    paddingVertical:   16,
    borderRadius:      18,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width:          46,
    height:         46,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap:  5,
  },
  titleRow: {
    flexDirection:  'row',
    alignItems:     'baseline',
    justifyContent: 'space-between',
    gap:            8,
  },
  title: {
    fontSize:      15,
    fontWeight:    '600',
    letterSpacing: -0.2,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems:    'baseline',
    flexShrink:    0,
  },
  value: {
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.3,
  },
  unit: {
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 0,
  },
  caption: {
    fontSize:      12,
    fontWeight:    '400',
    letterSpacing: 0.1,
    lineHeight:    16,
  },
  track: {
    height:       3,
    borderRadius: 2,
    overflow:     'hidden',
    marginTop:    2,
  },
  fill: {
    height: '100%',
  },
});
