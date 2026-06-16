import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ExerciseOptionMode = 'single' | 'multi';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface ExerciseOptionRowProps {
  name: string;
  icon: IoniconName;
  iconAccent: string;
  selected: boolean;
  mode: ExerciseOptionMode;
  onPress: () => void;
  accentColor: string;
  accentSoft: string;
  textColor: string;
  textFaintColor: string;
  borderColor: string;
  surfaceColor: string;
  isLast?: boolean;
  isCustom?: boolean;
  onRemove?: () => void;
}

export function ExerciseOptionRow({
  name,
  icon,
  iconAccent,
  selected,
  mode,
  onPress,
  accentColor,
  accentSoft,
  textColor,
  textFaintColor,
  borderColor,
  surfaceColor,
  isLast = false,
  isCustom = false,
  onRemove,
}: ExerciseOptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: mode === 'multi' ? selected : undefined }}
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: selected ? accentSoft : surfaceColor,
          borderBottomColor: borderColor,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
        pressed && s.rowPressed,
      ]}
    >
      <View style={[s.accent, { backgroundColor: selected ? accentColor : 'transparent' }]} />
      <View style={[s.iconWrap, { backgroundColor: `${iconAccent}22` }]}>
        <Ionicons name={icon} size={16} color={iconAccent} />
      </View>
      <Text style={[s.name, { color: textColor }]} numberOfLines={2}>
        {name}
      </Text>
      {isCustom && onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityLabel={`Remove ${name}`}
          style={({ pressed }) => [s.removeBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="trash-outline" size={16} color={textFaintColor} />
        </Pressable>
      ) : null}
      {mode === 'multi' ? (
        <View
          style={[
            s.check,
            {
              borderColor: selected ? accentColor : borderColor,
              backgroundColor: selected ? accentColor : 'transparent',
            },
          ]}
        >
          {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
      ) : !isCustom ? (
        <Ionicons name="chevron-forward" size={16} color={textFaintColor} />
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingRight: 14,
    gap: 10,
  },
  rowPressed: { opacity: 0.88 },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
