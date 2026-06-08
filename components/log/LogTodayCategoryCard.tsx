import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  GradientCard,
  getCardAccent,
  type CardAccentVariant,
} from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICON_SIZE = 34;

export interface LogTodayCategoryCardProps {
  variant: CardAccentVariant;
  icon: IoniconName;
  title: string;
  value: string;
  valueUnit?: string;
  caption: string;
  progress?: number;
  onPress: () => void;
}

export function LogTodayCategoryCard({
  variant,
  icon,
  title,
  value,
  valueUnit,
  caption,
  progress,
  onPress,
}: LogTodayCategoryCardProps) {
  const P = usePalette();
  const accent = getCardAccent(variant, P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const hasValue = value !== '—' && value !== '0' && value.length > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${caption}`}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <GradientCard
        variant={variant}
        palette={palette}
        layout="metric"
        corner="top-left"
        animated={false}
        style={styles.card}
        contentStyle={[styles.inner, { borderColor: accent.iconSoft }]}
      >
        <View style={styles.iconSlot}>
          <Ionicons name={icon} size={CATEGORY_ICON_SIZE} color={accent.iconBg} />
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: P.text }]}>{title}</Text>
          <Text style={[styles.caption, { color: P.textFaint }]} numberOfLines={2}>
            {caption}
          </Text>
          {typeof progress === 'number' && (
            <View style={[styles.track, { backgroundColor: P.sunken }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(progress, 1) * 100}%`,
                    backgroundColor: accent.iconBg,
                  },
                ]}
              />
            </View>
          )}
        </View>

        <View style={styles.valueCol}>
          <Text
            style={[
              styles.value,
              { color: hasValue ? P.text : P.textFaint },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
          {valueUnit != null && valueUnit.length > 0 && (
            <Text style={[styles.valueUnit, { color: P.textFaint }]}>{valueUnit}</Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
      </GradientCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  card: { width: '100%' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 76,
  },
  iconSlot: {
    width: CATEGORY_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%' },
  valueCol: { alignItems: 'flex-end', minWidth: 52 },
  value: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  valueUnit: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },
});
