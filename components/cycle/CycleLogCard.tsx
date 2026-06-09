import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Flower2, Minus, Plus } from 'lucide-react-native';

import type { Palette } from '@/lib/log-theme';

const MIN_CYCLE = 21;
const MAX_CYCLE = 45;

export interface CycleLogCardProps {
  P: Palette;
  accent: string;
  cycleLength: number;
  saving: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onLog: () => void;
}

export function CycleLogCard({
  P,
  accent,
  cycleLength,
  saving,
  onDecrease,
  onIncrease,
  onLog,
}: CycleLogCardProps) {
  return (
    <View style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={[s.lengthRow, { borderBottomColor: P.hair }]}>
        <View style={s.lengthCopy}>
          <Text style={[s.lengthLabel, { color: P.text }]}>Cycle length</Text>
          <Text style={[s.lengthSub, { color: P.textFaint }]}>Average days per cycle</Text>
        </View>
        <View style={s.stepper}>
          <Pressable
            onPress={onDecrease}
            disabled={cycleLength <= MIN_CYCLE}
            style={[
              s.stepBtn,
              { borderColor: P.cardEdge, backgroundColor: P.sunken },
              cycleLength <= MIN_CYCLE && { opacity: 0.35 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Decrease cycle length"
          >
            <Minus size={16} color={P.textDim} strokeWidth={2.4} />
          </Pressable>
          <Text style={[s.stepValue, { color: P.text }]}>{cycleLength}</Text>
          <Pressable
            onPress={onIncrease}
            disabled={cycleLength >= MAX_CYCLE}
            style={[
              s.stepBtn,
              { borderColor: P.cardEdge, backgroundColor: P.sunken },
              cycleLength >= MAX_CYCLE && { opacity: 0.35 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Increase cycle length"
          >
            <Plus size={16} color={P.textDim} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onLog}
        disabled={saving}
        style={({ pressed }) => [
          s.logBtn,
          { backgroundColor: accent, opacity: pressed || saving ? 0.88 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Log period"
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Flower2 size={17} color="#fff" strokeWidth={2.3} />
            <Text style={s.logBtnText}>Log period</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lengthCopy: { flex: 1 },
  lengthLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  lengthSub: { fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 26,
    letterSpacing: -0.5,
    minWidth: 32,
    textAlign: 'center',
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 14,
    borderRadius: 14,
    paddingVertical: 15,
  },
  logBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
});
