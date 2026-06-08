import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePalette } from '@/lib/log-theme';

const PRESETS_ML = [
  { label: 'Sip',    ml: 100  },
  { label: 'Glass',  ml: 250  },
  { label: 'Bottle', ml: 500  },
  { label: 'Large',  ml: 750  },
  { label: '1 L',    ml: 1000 },
] as const;

const ML_PER_OZ = 29.5735;

interface Props {
  unit:    'ml' | 'oz';
  onPress: (ml: number) => void;
}

export function WaterPresetGrid({ unit, onPress }: Props) {
  const P = usePalette();

  return (
    <View style={s.row}>
      {PRESETS_ML.map(({ label, ml }) => {
        const display = unit === 'oz'
          ? `${(ml / ML_PER_OZ).toFixed(0)} oz`
          : `${ml} ml`;

        return (
          <Pressable
            key={ml}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPress(ml);
            }}
            style={({ pressed }) => [
              s.pill,
              {
                backgroundColor: pressed ? P.water + '33' : P.waterSoft,
                borderColor:     P.water + '55',
              },
            ]}
          >
            <Text style={[s.label, { color: P.water }]}>{label}</Text>
            <Text style={[s.amount, { color: P.textFaint }]}>{display}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  pill: {
    flex:              1,
    minWidth:          56,
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 8,
    borderRadius:      14,
    borderWidth:       StyleSheet.hairlineWidth,
    gap:               4,
  },
  label: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  amount: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.2,
  },
});
