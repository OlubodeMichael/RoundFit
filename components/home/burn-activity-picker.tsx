import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { AppModal } from '@/components/ui/AppModal';
import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Exercise catalogue ─────────────────────────────────────────────────────
export type BurnActivity = {
  id:    string;
  label: string;
  verb:  string;
  met:   number;
  icon:  IoniconName;
  tint:  'calories' | 'protein' | 'carbs' | 'fat' | 'water' | 'workout';
};

export const BURN_ACTIVITIES: BurnActivity[] = [
  { id: 'walk',     label: 'Walking (brisk)', verb: 'Walk',  met: 4.3, icon: 'walk',          tint: 'calories' },
  { id: 'run',      label: 'Running',         verb: 'Run',   met: 8.0, icon: 'speedometer',   tint: 'protein'  },
  { id: 'cycle',    label: 'Cycling',         verb: 'Cycle', met: 7.5, icon: 'bicycle',       tint: 'workout'  },
  { id: 'swim',     label: 'Swimming',        verb: 'Swim',  met: 7.0, icon: 'water',         tint: 'water'    },
  { id: 'rowing',   label: 'Rowing',          verb: 'Row',   met: 7.0, icon: 'boat',          tint: 'fat'      },
  { id: 'hiit',     label: 'HIIT',            verb: 'HIIT',  met: 9.0, icon: 'flash',         tint: 'calories' },
  { id: 'strength', label: 'Strength',        verb: 'Lift',  met: 6.0, icon: 'barbell',       tint: 'carbs'    },
  { id: 'hike',     label: 'Hiking',          verb: 'Hike',  met: 6.0, icon: 'trail-sign',    tint: 'carbs'    },
  { id: 'dance',    label: 'Dancing',         verb: 'Dance', met: 5.0, icon: 'musical-notes', tint: 'fat'      },
  { id: 'yoga',     label: 'Yoga',            verb: 'Yoga',  met: 3.0, icon: 'leaf',          tint: 'protein'  },
];

export function formatActivityPrescription(activity: BurnActivity, minutes: number) {
  return `${activity.verb} ${formatDurationLabel(minutes)}`;
}

export function computeDurationMinutes(met: number, weightKg: number, caloriesToBurn: number) {
  if (!isFinite(met) || met <= 0) return 0;
  if (!isFinite(weightKg) || weightKg <= 0) return 0;
  if (!isFinite(caloriesToBurn) || caloriesToBurn <= 0) return 0;
  const minutes = (caloriesToBurn / (met * weightKg)) * 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function formatDurationLabel(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
  return `${h}h ${m}m`;
}

// ─── BurnActivityPicker ─────────────────────────────────────────────────────

export type BurnActivityPickerProps = {
  visible:        boolean;
  onClose:        () => void;
  caloriesToBurn: number;
  weightKg:       number;
  currentId?:     string;
  activities?:    BurnActivity[];
  onSelect:       (activity: BurnActivity, durationMinutes: number) => void;
};

const O = '#F97316';

export function BurnActivityPicker({
  visible,
  onClose,
  caloriesToBurn,
  weightKg,
  currentId,
  activities = BURN_ACTIVITIES,
  onSelect,
}: BurnActivityPickerProps) {
  const P = usePalette();

  const rows = useMemo(
    () => activities.map(a => ({
      ...a,
      minutes: computeDurationMinutes(a.met, weightKg, caloriesToBurn),
    })),
    [activities, caloriesToBurn, weightKg],
  );

  const calLabel = Math.round(caloriesToBurn).toLocaleString();

  return (
    <AppModal visible={visible} onClose={onClose} sheetHeight={0.74}>

      {/* ── Dark header card ─────────────────────────────────────────────── */}
      <View style={s.header}>
        {/* Badge */}
        <View style={s.headerBadge}>
          <View style={s.headerBadgeDot} />
          <Text style={s.headerBadgeText}>REMAINING BURN</Text>
        </View>

        <View style={s.headerRow}>
          {/* Calorie hero */}
          <View style={s.heroWrap}>
            <Text style={s.heroNum}>{calLabel}</Text>
            <Text style={s.heroUnit}>kcal</Text>
          </View>

          {/* Weight pill */}
          <View style={s.weightPill}>
            <Ionicons name="flame" size={13} color={O} />
            <Text style={s.weightPillText}>
              {weightKg ? `${Math.round(weightKg)} kg` : 'No weight'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Activity list ─────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((a, i) => {
          const tint    = P[a.tint] as string;
          const soft    = P[`${a.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;
          const active  = a.id === currentId;
          const disabled = a.minutes === 0;
          const isLast  = i === rows.length - 1;

          return (
            <Pressable
              key={a.id}
              disabled={disabled}
              onPress={() => { onSelect(a, a.minutes); onClose(); }}
              style={({ pressed }) => [
                s.row,
                active && [s.rowActive, { backgroundColor: P.isDark ? 'rgba(249,115,22,0.10)' : 'rgba(249,115,22,0.07)' }],
                pressed && !disabled && !active && { backgroundColor: P.sunken },
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.hair },
                disabled && { opacity: 0.4 },
              ]}
            >
              {/* Icon tile */}
              <View style={[s.iconTile, { backgroundColor: soft }]}>
                <Ionicons name={a.icon} size={19} color={tint} />
              </View>

              {/* Name + MET */}
              <View style={s.rowMeta}>
                <Text style={[s.rowLabel, { color: P.text }]}>{a.label}</Text>
                <Text style={[s.rowMetValue, { color: P.textFaint }]}>MET {a.met.toFixed(1)}</Text>
              </View>

              {/* Duration + status */}
              <View style={s.rowRight}>
                <Text style={[s.rowMins, { color: P.text }]}>
                  {a.minutes}
                  <Text style={[s.rowMinsUnit, { color: P.textFaint }]}> min</Text>
                </Text>
                {active ? (
                  <View style={s.currentPill}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                    <Text style={s.currentPillText}>CURRENT</Text>
                  </View>
                ) : (
                  <Text style={[s.rowBurnLabel, { color: P.textFaint }]}>
                    to burn {calLabel} cal
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </AppModal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header card (always dark)
  header: {
    marginHorizontal: 16,
    marginTop:        4,
    marginBottom:     12,
    backgroundColor:  '#1C1C1E',
    borderRadius:     20,
    paddingHorizontal: 20,
    paddingVertical:   18,
  },
  headerBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    marginBottom:   12,
  },
  headerBadgeDot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: O,
  },
  headerBadgeText: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
    color:         O,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
  },
  heroWrap: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           6,
  },
  heroNum: {
    fontSize:      52,
    fontWeight:    '800',
    letterSpacing: -2,
    color:         '#FFFFFF',
    lineHeight:    56,
  },
  heroUnit: {
    fontSize:   16,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  weightPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      99,
    marginBottom:      4,
  },
  weightPillText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom:     20,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius:   16,
  },
  rowActive: {
    borderRadius: 16,
  },
  iconTile: {
    width:           46,
    height:          46,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rowMeta: {
    flex: 1,
    gap:  3,
  },
  rowLabel: {
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.2,
  },
  rowMetValue: {
    fontSize:   11,
    fontWeight: '600',
  },
  rowRight: {
    alignItems: 'flex-end',
    gap:         4,
  },
  rowMins: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  rowMinsUnit: {
    fontSize:   13,
    fontWeight: '600',
  },
  rowBurnLabel: {
    fontSize:   11,
    fontWeight: '500',
  },
  currentPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   O,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      99,
  },
  currentPillText: {
    fontSize:      10,
    fontWeight:    '800',
    color:         '#FFFFFF',
    letterSpacing: 0.4,
  },
});
