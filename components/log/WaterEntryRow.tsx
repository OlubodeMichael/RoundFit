import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { usePalette } from '@/lib/log-theme';
import type { WaterEntry } from '@/context/water-context';
import { waterIconForMl, waterIconSizeForMl } from '@/utils/water-volume-icon';

const ML_PER_OZ = 29.5735;

interface Props {
  entry:    WaterEntry;
  unit:     'ml' | 'oz';
  onDelete: (id: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toDisplay(ml: number, unit: 'ml' | 'oz'): { value: string; label: string } {
  if (unit === 'oz') {
    return { value: (ml / ML_PER_OZ).toFixed(1), label: 'oz' };
  }
  return { value: String(ml), label: 'ml' };
}

export function WaterEntryRow({ entry, unit, onDelete }: Props) {
  const P = usePalette();
  const { value, label } = toDisplay(entry.amount_ml, unit);
  const icon = waterIconForMl(entry.amount_ml);
  const iconSize = waterIconSizeForMl(entry.amount_ml);

  const handleDelete = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(entry.id);
  };

  return (
    <View style={s.row}>

      {/* Left: icon */}
      <View style={[s.iconWrap, { backgroundColor: P.isDark ? 'rgba(56,189,248,0.12)' : P.waterSoft }]}>
        <Ionicons name={icon} size={iconSize} color={P.water} />
      </View>

      {/* Center: amount + time */}
      <View style={s.body}>
        <View style={s.amountRow}>
          <Text style={[s.amount, { color: P.text }]}>{value}</Text>
          <Text style={[s.unit, { color: P.water }]}>{label}</Text>
        </View>
        <Text style={[s.time, { color: P.textFaint }]}>{formatTime(entry.logged_at)}</Text>
      </View>

      {/* Right: delete */}
      <Pressable
        onPress={handleDelete}
        hitSlop={12}
        style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.4 }]}
      >
        <Ionicons name="trash-outline" size={15} color={P.textFaint} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   13,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  amountRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
  },
  amount: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing:  0.3,
  },
  time: {
    fontSize:      11,
    fontWeight:    '500',
    marginTop:     2,
    letterSpacing: 0.1,
  },
  deleteBtn: { padding: 4 },
});
