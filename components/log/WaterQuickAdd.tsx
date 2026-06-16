import * as Haptics from 'expo-haptics';
import {
  BottleWine,
  CupSoda,
  GlassWater,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { WaterCustomAmountModal } from '@/components/log/WaterCustomAmountModal';
import { usePalette } from '@/lib/log-theme';

const OZ_TO_ML = 29.5735;
const ICON_SIZE = 18;
const ICON_STROKE = 2.25;
const CHIP_MIN_HEIGHT = 76;

const PRESETS = [
  { id: 'sip', label: 'Sip', oz: 5, Icon: CupSoda },
  { id: 'glass', label: 'Glass', oz: 8, Icon: GlassWater },
  { id: 'bottle', label: 'Bottle', oz: 16, Icon: BottleWine },
] as const;

interface WaterQuickAddProps {
  onAdd: (ml: number) => void;
  usualMl?: number;
  variant?: 'inline' | 'dock';
  disabled?: boolean;
}

interface QuickAddChipProps {
  label: string;
  oz?: number;
  Icon: LucideIcon;
  isUsual: boolean;
  isCustom?: boolean;
  disabled: boolean;
  onPress: () => void;
}

function QuickAddChip({
  label,
  oz,
  Icon,
  isUsual,
  isCustom = false,
  disabled,
  onPress,
}: QuickAddChipProps) {
  const P = usePalette();
  const acc = P.water;

  const surface = P.isDark ? P.sunken : P.raised;
  const borderColor = isUsual
    ? acc
    : isCustom
      ? P.isDark
        ? 'rgba(56,189,248,0.35)'
        : 'rgba(14,165,233,0.28)'
      : P.cardEdge;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        isCustom ? 'Add custom amount' : `Add ${oz} fluid ounces, ${label}`
      }
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.chip,
        {
          backgroundColor: isUsual
            ? P.isDark
              ? 'rgba(56,189,248,0.12)'
              : 'rgba(14,165,233,0.08)'
            : surface,
          borderColor,
          borderWidth: isUsual ? 1.5 : StyleSheet.hairlineWidth,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
        },
      ]}
    >
      <View
        style={[
          s.iconWell,
          {
            backgroundColor: isCustom
              ? P.isDark
                ? 'rgba(56,189,248,0.14)'
                : P.waterSoft
              : P.isDark
                ? 'rgba(56,189,248,0.18)'
                : P.waterSoft,
          },
        ]}
      >
        <Icon
          size={ICON_SIZE}
          color={isCustom ? acc : acc}
          strokeWidth={ICON_STROKE}
        />
      </View>

      {isCustom ? (
        <Text style={[s.chipLabel, { color: P.textDim }]} numberOfLines={1}>
          {label}
        </Text>
      ) : (
        <>
          <Text style={[s.chipAmount, { color: P.text }]} numberOfLines={1}>
            {oz}
            <Text style={[s.chipUnit, { color: P.textDim }]}> oz</Text>
          </Text>
          <Text style={[s.chipMeta, { color: P.textFaint }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}

      {isUsual ? (
        <View
          style={[
            s.usualBadge,
            {
              backgroundColor: P.isDark
                ? 'rgba(56,189,248,0.22)'
                : 'rgba(14,165,233,0.14)',
            },
          ]}
        >
          <Text style={[s.usualBadgeText, { color: acc }]}>Usual</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function WaterQuickAdd({
  onAdd,
  usualMl = 237,
  variant = 'inline',
  disabled = false,
}: WaterQuickAddProps) {
  const P = usePalette();
  const isDock = variant === 'dock';
  const [showCustom, setShowCustom] = useState(false);

  const press = (oz: number) => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(Math.round(oz * OZ_TO_ML));
  };

  const openCustom = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCustom(true);
  };

  return (
    <>
      {isDock ? (
        <Text style={[s.sectionLabel, { color: P.textFaint }]}>Quick add</Text>
      ) : (
        <Text style={[s.sectionLabelInline, { color: P.textFaint }]}>
          QUICK ADD
        </Text>
      )}

      <View
        style={[
          isDock ? s.dockTray : s.inlineTray,
          isDock && {
            backgroundColor: P.card,
            borderColor: P.cardEdge,
            shadowOpacity: P.isDark ? 0.35 : 0.08,
          },
          isDock && Platform.OS === 'android' && { elevation: P.isDark ? 0 : 2 },
        ]}
      >
        <View style={s.chipRow}>
          {PRESETS.map((preset) => {
            const presetMl = Math.round(preset.oz * OZ_TO_ML);
            const isUsual = Math.abs(presetMl - usualMl) < 30;

            return (
              <QuickAddChip
                key={preset.id}
                label={preset.label}
                oz={preset.oz}
                Icon={preset.Icon}
                isUsual={isUsual}
                disabled={disabled}
                onPress={() => press(preset.oz)}
              />
            );
          })}
          <QuickAddChip
            label="Custom"
            Icon={Plus}
            isUsual={false}
            isCustom
            disabled={disabled}
            onPress={openCustom}
          />
        </View>
      </View>

      <WaterCustomAmountModal
        visible={showCustom}
        onClose={() => setShowCustom(false)}
        onAdd={onAdd}
      />
    </>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.08,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  sectionLabelInline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  inlineTray: {
    gap: 0,
  },
  dockTray: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: CHIP_MIN_HEIGHT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 4,
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAmount: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  chipUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipMeta: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.15,
    textTransform: 'uppercase',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  usualBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  usualBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
