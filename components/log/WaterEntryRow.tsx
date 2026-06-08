import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { usePalette } from '@/lib/log-theme';
import type { WaterEntry } from '@/context/water-context';
import { waterIconForMl, waterIconSizeForMl, waterVolumeLabelForMl } from '@/utils/water-volume-icon';

const ML_PER_OZ = 29.5735;

interface Props {
  entry: WaterEntry;
  unit: 'ml' | 'oz';
  onDelete: (id: string) => void;
  density?: 'default' | 'compact';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
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

export function WaterEntryRow({ entry, unit, onDelete, density = 'default' }: Props) {
  const P = usePalette();
  const acc = P.water;
  const compact = density === 'compact';
  const { value, label } = toDisplay(entry.amount_ml, unit);
  const icon = waterIconForMl(entry.amount_ml);
  const iconSize = compact
    ? Math.min(waterIconSizeForMl(entry.amount_ml), 16)
    : waterIconSizeForMl(entry.amount_ml);
  const volumeLabel = waterVolumeLabelForMl(entry.amount_ml);
  const time = formatTime(entry.logged_at);

  const handleDelete = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(entry.id);
  };

  if (compact) {
    return (
      <View style={s.rowCompact}>
        <View style={[s.iconCompact, { backgroundColor: P.isDark ? 'rgba(56,189,248,0.14)' : P.waterSoft }]}>
          <Ionicons name={icon} size={iconSize} color={acc} />
        </View>

        <View style={s.bodyCompact}>
          <View style={s.topLine}>
            <Text style={[s.amountCompact, { color: P.text }]} numberOfLines={1}>
              {value}
              <Text style={[s.unitCompact, { color: acc }]}> {label}</Text>
            </Text>
            <Text style={[s.timeCompact, { color: P.textFaint }]}>{time}</Text>
          </View>
          <Text style={[s.kindCompact, { color: P.textDim }]}>{volumeLabel}</Text>
        </View>

        <Pressable
          onPress={handleDelete}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${value} ${label} at ${time}`}
          style={({ pressed }) => [
            s.deleteCompact,
            { backgroundColor: P.isDark ? 'rgba(255,255,255,0.06)' : P.sunken },
            pressed && { opacity: 0.55 },
          ]}
        >
          <Ionicons name="close" size={13} color={P.textFaint} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.row}>
      <View style={[s.iconWrap, { backgroundColor: P.isDark ? 'rgba(56,189,248,0.12)' : P.waterSoft }]}>
        <Ionicons name={icon} size={iconSize} color={acc} />
      </View>

      <View style={s.body}>
        <View style={s.amountRow}>
          <Text style={[s.amount, { color: P.text }]}>{value}</Text>
          <Text style={[s.unit, { color: acc }]}>{label}</Text>
        </View>
        <Text style={[s.time, { color: P.textFaint }]}>{time}</Text>
      </View>

      <Pressable
        onPress={handleDelete}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${value} ${label} logged at ${time}`}
        style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.4 }]}
      >
        <Ionicons name="trash-outline" size={15} color={P.textFaint} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  deleteBtn: { padding: 4 },

  rowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  iconCompact: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyCompact: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
  },
  amountCompact: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  unitCompact: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeCompact: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  kindCompact: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.05,
  },
  deleteCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
