import * as Haptics from "expo-haptics";
import {
  BottleWine,
  CupSoda,
  GlassWater,
  Plus,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { WaterCustomAmountModal } from "@/components/log/WaterCustomAmountModal";
import { usePalette } from "@/lib/log-theme";

const OZ_TO_ML = 29.5735;
const CARD_RADIUS = 16;
const ICON_SIZE = 20;
const ICON_STROKE = 2;

const PRESETS = [
  { id: "sip", label: "Sip", oz: 5, Icon: CupSoda },
  { id: "glass", label: "Glass", oz: 8, Icon: GlassWater },
  { id: "bottle", label: "Bottle", oz: 16, Icon: BottleWine },
] as const;

interface Props {
  onAdd: (ml: number) => void;
  usualMl?: number;
  variant?: "inline" | "dock";
  disabled?: boolean;
}

interface PresetButtonProps {
  label: string;
  oz?: number;
  Icon: LucideIcon;
  isUsual: boolean;
  isCustom?: boolean;
  disabled: boolean;
  onPress: () => void;
}

function PresetButton({
  label,
  oz,
  Icon,
  isUsual,
  isCustom = false,
  disabled,
  onPress,
}: PresetButtonProps) {
  const P = usePalette();
  const acc = P.water;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        isCustom ? "Add custom amount" : `Add ${oz} fluid ounces, ${label}`
      }
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.btn,
        isUsual && {
          backgroundColor: P.isDark ? "rgba(56,189,248,0.08)" : acc + "0A",
        },
        pressed &&
          !disabled && {
            backgroundColor: P.isDark ? P.sunken : "rgba(15,23,42,0.05)",
          },
        disabled && s.btnDisabled,
      ]}
    >
      <View style={[s.iconWell, { backgroundColor: P.waterSoft }]}>
        <Icon size={ICON_SIZE} color={acc} strokeWidth={ICON_STROKE} />
      </View>
      {isCustom ? (
        <Text style={[s.btnLabel, { color: P.textDim }]}>{label}</Text>
      ) : (
        <>
          <Text style={[s.btnAmount, { color: P.text }]}>
            {oz}
            <Text style={[s.btnUnit, { color: P.textDim }]}> oz</Text>
          </Text>
          <Text style={[s.btnLabel, { color: P.textFaint }]}>{label}</Text>
        </>
      )}
      {isUsual && <View style={[s.usualDot, { backgroundColor: acc }]} />}
    </Pressable>
  );
}

export function WaterQuickAdd({
  onAdd,
  usualMl = 237,
  variant = "inline",
  disabled = false,
}: Props) {
  const P = usePalette();
  const isDock = variant === "dock";
  const [showCustom, setShowCustom] = useState(false);

  const press = (oz: number) => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(Math.round(oz * OZ_TO_ML));
  };

  const presetTiles = PRESETS.map((p) => {
    const presetMl = Math.round(p.oz * OZ_TO_ML);
    return {
      ...p,
      isUsual: Math.abs(presetMl - usualMl) < 30,
      onPress: () => press(p.oz),
    };
  });

  return (
    <>
      {isDock && (
        <Text style={[s.sectionLabel, { color: P.textFaint }]}>Quick add</Text>
      )}

      <View
        style={[
          s.card,
          {
            backgroundColor: P.card,
            borderColor: P.cardEdge,
            shadowOpacity: P.isDark ? 0.35 : 0.06,
          },
          Platform.OS === "android" && { elevation: P.isDark ? 0 : 2 },
        ]}
      >
        <View style={s.row}>
          {presetTiles.map((tile, index) => (
            <View key={tile.id} style={s.cellWrap}>
              {index > 0 && (
                <View style={[s.divider, { backgroundColor: P.hair }]} />
              )}
              <PresetButton
                label={tile.label}
                oz={tile.oz}
                Icon={tile.Icon}
                isUsual={tile.isUsual}
                disabled={disabled}
                onPress={tile.onPress}
              />
            </View>
          ))}
          <View style={s.cellWrap}>
            <View style={[s.divider, { backgroundColor: P.hair }]} />
            <PresetButton
              label="Custom"
              Icon={Plus}
              isUsual={false}
              isCustom
              disabled={disabled}
              onPress={() => !disabled && setShowCustom(true)}
            />
          </View>
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
    fontWeight: "600",
    letterSpacing: -0.08,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  cellWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    minWidth: 0,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 5,
    minHeight: 76,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnAmount: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  btnUnit: {
    fontSize: 13,
    fontWeight: "600",
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.05,
  },
  usualDot: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
