import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { SegmentedDial } from '@/components/home/SegmentedDial';

const MACRO_DIAL_SIZE = 94;

export type MacroAccentKey = 'protein' | 'carbs' | 'fat';

export interface MacroItem {
  key: string;
  label: string;
  cur: number;
  goal: number;
  accent: MacroAccentKey;
}

export interface MacrosCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  hair: string;
  protein: string;
  proteinSoft: string;
  proteinTrack: string;
  carbs: string;
  carbsSoft: string;
  carbsTrack: string;
  fat: string;
  fatSoft: string;
  fatTrack: string;
  isDark: boolean;
}

export interface MacrosCardProps {
  P: MacrosCardPalette;
  delay?: number;
  macros: MacroItem[];
}

export function MacrosCard({ P, delay = 0, macros }: MacrosCardProps) {
  const accent = getCardAccent('macros', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const totalGrams = macros.reduce((sum, m) => sum + m.cur, 0);

  return (
    <GradientCard variant="macros" palette={palette} delay={delay}>
      <View style={s.header}>
        <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
          <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
            <Ionicons name="nutrition" size={16} color="#FFF" />
          </View>
        </View>
        <View style={s.headerCopy}>
          <Text style={[s.headerTitle, { color: P.text }]}>Macros</Text>
          <Text style={[s.headerCaption, { color: P.textDim }]}>
            Grams today
          </Text>
        </View>
        <View style={[s.totalChip, { backgroundColor: accent.iconSoft }]}>
          <View style={s.totalRow}>
            <Text style={[s.totalValue, { color: P.text }]}>
              {totalGrams.toLocaleString()}
            </Text>
            <Text style={[s.totalGram, { color: accent.iconBg }]}>g</Text>
          </View>
          <Text style={[s.totalMeta, { color: P.textDim }]}>logged today</Text>
        </View>
      </View>

      <View style={[s.divider, { backgroundColor: P.hair }]} />

      <View style={s.macrosRow}>
        {macros.map((m, i) => (
          <MacroCell
            key={m.key}
            label={m.label}
            cur={m.cur}
            goal={m.goal}
            accent={m.accent}
            P={P}
            animDelay={delay + 120 + i * 80}
          />
        ))}
      </View>
    </GradientCard>
  );
}

interface MacroCellProps {
  label: string;
  cur: number;
  goal: number;
  accent: MacroAccentKey;
  P: MacrosCardPalette;
  animDelay: number;
}

function MacroCell({
  label,
  cur,
  goal,
  accent,
  P,
  animDelay,
}: MacroCellProps) {
  const fill = P[accent];
  const track = P[`${accent}Track`];
  const soft = P[`${accent}Soft`];

  const target = goal > 0 ? Math.min(cur / goal, 1) : 0;
  const animated = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setProgress(value));
    Animated.timing(animated, {
      toValue: target,
      duration: 900,
      delay: animDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
  }, [animated, target, animDelay]);

  const pctLabel = Math.round(progress * 100);

  return (
    <View style={s.macroCell}>
      <SegmentedDial
        size={MACRO_DIAL_SIZE}
        progress={progress}
        trackColor={track}
        fillColor={fill}
        haloColor={soft}
      >
        <Text style={[s.macroCur, { color: P.text }]}>{cur}</Text>
        <Text style={[s.macroOf, { color: P.textFaint }]}>/{goal}g</Text>
      </SegmentedDial>

      <View style={s.macroFoot}>
        <View style={[s.macroDot, { backgroundColor: fill }]} />
        <Text style={[s.macroLabel, { color: P.text }]}>{label}</Text>
        <Text style={[s.macroPct, { color: fill }]}>{pctLabel}%</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  iconRing: {
    padding: 4,
    borderRadius: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.45,
    lineHeight: 24,
  },
  headerCaption: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 18,
  },
  totalChip: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  totalGram: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  totalMeta: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 18,
  },
  macroCell: {
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  macroCur: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  macroOf: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  macroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  macroPct: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
