import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { usePalette } from '@/lib/log-theme';
import { WaterCustomAmountModal } from '@/components/log/WaterCustomAmountModal';
import { waterIconForMl } from '@/utils/water-volume-icon';

const OZ_TO_ML = 29.5735;

const PRESETS = [
  { id: 'sip',    label: 'Sip',    oz: 5  },
  { id: 'glass',  label: 'Glass',  oz: 8  },
  { id: 'bottle', label: 'Bottle', oz: 16 },
] as const;

interface Props {













































































































  
  onAdd:    (ml: number) => void;
  usualMl?: number;
}

export function WaterQuickAdd({ onAdd, usualMl = 237 }: Props) {
  const P = usePalette();
  const acc = P.water;

  const [showCustom, setShowCustom] = useState(false);

  const press = (oz: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(Math.round(oz * OZ_TO_ML));
  };

  return (
    <>
      <Text style={[s.sectionLabel, { color: P.textFaint }]}>QUICK ADD</Text>

      <View style={s.row}>
        {PRESETS.map((preset) => {
          const presetMl = Math.round(preset.oz * OZ_TO_ML);
          const isUsual = Math.abs(presetMl - usualMl) < 30;
          const icon = waterIconForMl(presetMl);

          return (
            <Pressable
              key={preset.id}
              onPress={() => press(preset.oz)}
              style={({ pressed }) => [
                s.btn,
                {
                  backgroundColor: isUsual
                    ? (P.isDark ? '#0A1E32' : acc + '12')
                    : (P.isDark ? P.sunken : P.raised),
                  borderColor: isUsual ? acc + '60' : P.cardEdge,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {isUsual && (
                <View style={[s.usualBadge, { backgroundColor: acc }]}>
                  <Text style={s.usualText}>USUAL</Text>
                </View>
              )}
              <View
                style={[
                  s.iconBox,
                  {
                    backgroundColor: isUsual
                      ? acc + '20'
                      : P.isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Ionicons
                  name={icon}
                  size={22}
                  color={isUsual ? acc : P.textDim}
                />
              </View>
              <Text style={[s.btnName, { color: P.text }]}>{preset.label}</Text>
              <Text style={[s.btnAmt, { color: isUsual ? acc : P.textFaint }]}>
                +{preset.oz} oz
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setShowCustom(true)}
          style={({ pressed }) => [
            s.btn,
            s.customBtn,
            {
              backgroundColor: P.isDark ? P.sunken : P.raised,
              borderColor: P.cardEdge,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View
            style={[
              s.iconBox,
              {
                backgroundColor: P.isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <Ionicons name="add-circle-outline" size={22} color={P.textDim} />
          </View>
          <Text style={[s.btnName, { color: P.text }]}>Custom</Text>
          <Text style={[s.btnAmt, { color: P.textFaint }]}>any ml</Text>
        </Pressable>
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  row: { flexDirection: 'row', gap: 9 },

  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    overflow: 'visible',
  },
  customBtn: {
    borderStyle: 'dashed',
  },

  usualBadge: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },
  usualText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8, color: '#fff' },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnName: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  btnAmt: { fontSize: 11, fontWeight: '600' },
});
