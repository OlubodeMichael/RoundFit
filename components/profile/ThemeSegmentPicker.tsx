import { Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemePreference } from '@/hooks/use-theme';
import type { SettingsPalette } from '@/components/profile/settings-ui';

const SEG_PAD = 4;

const OPTIONS: { value: ThemePreference; Icon: LucideIcon; label: string }[] = [
  { value: 'light',  Icon: Sun,        label: 'Light'  },
  { value: 'dark',   Icon: Moon,       label: 'Dark'   },
  { value: 'system', Icon: Smartphone, label: 'System' },
];

function toIndex(p: ThemePreference): number {
  if (p === 'light') return 0;
  if (p === 'dark') return 1;
  return 2;
}

export function ThemeSegmentPicker({
  value,
  onChange,
  P,
}: {
  value:    ThemePreference;
  onChange: (next: ThemePreference) => void;
  P:        SettingsPalette;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const anim = useRef(new Animated.Value(toIndex(value))).current;
  const pillW = trackWidth > 0 ? (trackWidth - SEG_PAD * 2) / 3 : 0;

  useEffect(() => {
    Animated.spring(anim, { toValue: toIndex(value), useNativeDriver: true, tension: 240, friction: 22 }).start();
  }, [anim, value]);

  const translateX = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, pillW, pillW * 2] });

  function select(next: ThemePreference) {
    if (next === value) return;
    Animated.spring(anim, { toValue: toIndex(next), useNativeDriver: true, tension: 240, friction: 22 }).start();
    onChange(next);
  }

  return (
    <View style={[s.seg, { backgroundColor: P.sunken }]} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      {pillW > 0 && (
        <Animated.View
          style={[
            s.pill,
            {
              width: pillW,
              backgroundColor: P.card,
              shadowColor: '#000',
              shadowOpacity: P.isDark ? 0.42 : 0.1,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => select(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={({ pressed }) => [s.cell, pressed && { opacity: 0.88 }]}
          >
            <opt.Icon size={20} color={active ? P.accent : P.dim} strokeWidth={active ? 2.6 : 2.2} />
            <Text style={[s.label, { color: active ? P.text : P.dim, fontWeight: active ? '800' : '600' }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: 'row', margin: 12, padding: SEG_PAD, borderRadius: 14, position: 'relative' },
  pill: { position: 'absolute', top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD, borderRadius: 10 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 7, zIndex: 1 },
  label: { fontSize: 15, letterSpacing: -0.2 },
});
