import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
  step:   number;
  total:  number;
  onBack: () => void;
  isDark: boolean;
}

export function ProgressBar({ step, total, onBack, isDark }: Props) {
  const hi  = isDark ? '#F5F5F5' : '#111111';
  const mid = isDark ? '#444'    : '#CCC';
  const lo  = isDark ? '#2A2A2A' : '#E8E3DC';
  const pct = ((step - 1) / (total - 1)) * 100;

  return (
    <View style={s.root}>
      <TouchableOpacity
        style={s.back}
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="chevron-back" size={20} color={hi} />
      </TouchableOpacity>

      <View style={[s.track, { backgroundColor: lo }]}>
        <View style={[s.fill, { width: `${pct}%` }]} />
      </View>

      <Text style={[s.fraction, { color: mid }]}>
        {step - 1}<Text style={{ color: mid }}>/{total - 1}</Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flexDirection: 'row', alignItems: 'center', gap: 16, height: 44 },
  back:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  track:    { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden' },
  fill:     { height: 2, borderRadius: 1, backgroundColor: '#F97316' },
  fraction: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, minWidth: 24, textAlign: 'right' },
});
