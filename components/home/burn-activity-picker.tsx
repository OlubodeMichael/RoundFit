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
// MET values are the standard Compendium-of-Physical-Activities averages used
// by HealthKit's fallback burn estimator. Duration-to-burn-X-calories is
// computed as `cals / (MET × weightKg) × 60` minutes — exactly the formula in
// the Week-1 Day-3 TODO line for MET table + calorie burn source priority.
export type BurnActivity = {
  id:    string;
  label: string;
  /** Imperative verb form used in prescriptions: "Run 20 minutes". */
  verb:  string;
  met:   number;
  icon:  IoniconName;
  tint:  'calories' | 'protein' | 'carbs' | 'fat' | 'water' | 'workout';
};

export const BURN_ACTIVITIES: BurnActivity[] = [
  { id: 'walk',     label: 'Walking (brisk)', verb: 'Walk',       met: 4.3, icon: 'walk',          tint: 'calories' },
  { id: 'run',      label: 'Running',         verb: 'Run',        met: 8.0, icon: 'speedometer',   tint: 'protein'  },
  { id: 'cycle',    label: 'Cycling',         verb: 'Cycle',      met: 7.5, icon: 'bicycle',       tint: 'workout'  },
  { id: 'swim',     label: 'Swimming',        verb: 'Swim',       met: 7.0, icon: 'water',         tint: 'water'    },
  { id: 'rowing',   label: 'Rowing',          verb: 'Row',        met: 7.0, icon: 'boat',          tint: 'workout'  },
  { id: 'hiit',     label: 'HIIT',            verb: 'HIIT',       met: 9.0, icon: 'flash',         tint: 'calories' },
  { id: 'strength', label: 'Strength',        verb: 'Lift',       met: 6.0, icon: 'barbell',       tint: 'fat'      },
  { id: 'hike',     label: 'Hiking',          verb: 'Hike',       met: 6.0, icon: 'trail-sign',    tint: 'carbs'    },
  { id: 'dance',    label: 'Dancing',         verb: 'Dance',      met: 5.0, icon: 'musical-notes', tint: 'fat'      },
  { id: 'yoga',     label: 'Yoga',            verb: 'Yoga',       met: 3.0, icon: 'leaf',          tint: 'protein'  },
];

// Convenience: turn an activity + computed minutes into the one-line
// prescription used by the home burn-coach card.
export function formatActivityPrescription(activity: BurnActivity, minutes: number) {
  return `${activity.verb} ${formatDurationLabel(minutes)}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
export function computeDurationMinutes(met: number, weightKg: number, caloriesToBurn: number) {
  if (!isFinite(met) || met <= 0) return 0;
  if (!isFinite(weightKg) || weightKg <= 0) return 0;
  if (!isFinite(caloriesToBurn) || caloriesToBurn <= 0) return 0;
  const minutes = (caloriesToBurn / (met * weightKg)) * 60;
  // Round to nearest 5 min for a friendlier prescription.
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function formatDurationLabel(mins: number) {
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

// ─── BurnActivityPicker ─────────────────────────────────────────────────────
// Bottom-sheet list of exercise alternatives. Each row recomputes how long
// the user would have to sustain that activity to close `caloriesToBurn`.
export type BurnActivityPickerProps = {
  visible:         boolean;
  onClose:         () => void;
  caloriesToBurn:  number;
  weightKg:        number;
  /** Currently selected activity id (highlighted in the list). */
  currentId?:      string;
  /** Which activities to show. Defaults to the full catalogue. */
  activities?:     BurnActivity[];
  onSelect:        (activity: BurnActivity, durationMinutes: number) => void;
};

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
    () =>
      activities.map(a => ({
        ...a,
        minutes: computeDurationMinutes(a.met, weightKg, caloriesToBurn),
      })),
    [activities, caloriesToBurn, weightKg],
  );

  return (
    <AppModal visible={visible} onClose={onClose} title="Choose your move" sheetHeight={0.68}>
      <View style={[styles.summary, { borderBottomColor: P.hair }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryLabel, { color: P.textFaint }]}>REMAINING BURN</Text>
          <Text style={[styles.summaryValue, { color: P.text }]}>
            {Math.round(caloriesToBurn).toLocaleString()}
            <Text style={[styles.summaryUnit, { color: P.textFaint }]}> cal</Text>
          </Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: P.caloriesSoft }]}>
          <Ionicons name="flame" size={12} color={P.calories} />
          <Text style={[styles.summaryPillText, { color: P.calories }]}>
            {weightKg ? `${Math.round(weightKg)} kg` : 'No weight set'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((a, i) => {
          const tint    = P[a.tint];
          const soft    = P[`${a.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;
          const active  = a.id === currentId;
          const disabled= a.minutes === 0;
          return (
            <Pressable
              key={a.id}
              disabled={disabled}
              onPress={() => {
                onSelect(a, a.minutes);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: P.hair },
                active && { backgroundColor: P.sunken },
                pressed && !disabled && { backgroundColor: P.sunken },
                i === rows.length - 1 && { borderBottomWidth: 0 },
                disabled && { opacity: 0.5 },
              ]}
            >
              <View style={[styles.iconTile, { backgroundColor: soft }]}>
                <Ionicons name={a.icon} size={18} color={tint} />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.rowLabel, { color: P.text }]}>{a.label}</Text>
                <Text style={[styles.rowMeta,  { color: P.textFaint }]}>
                  MET {a.met.toFixed(1)}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.rowMinutes, { color: P.text }]}>
                  {a.minutes}
                  <Text style={[styles.rowMinutesUnit, { color: P.textFaint }]}> min</Text>
                </Text>
                {active ? (
                  <View style={styles.activeRow}>
                    <Ionicons name="checkmark-circle" size={13} color={P.calories} />
                    <Text style={[styles.activeText, { color: P.calories }]}>Current</Text>
                  </View>
                ) : (
                  <Text style={[styles.rowCalories, { color: P.textFaint }]}>
                    {formatDurationLabel(a.minutes)}
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

const styles = StyleSheet.create({
  summary: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
    marginBottom:  4,
  },
  summaryValue: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -1,
  },
  summaryUnit: {
    fontSize:   14,
    fontWeight: '600',
  },
  summaryPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
  },
  summaryPillText: {
    fontSize:   11,
    fontWeight: '800',
  },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconTile: {
    width: 42, height: 42, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize:   11,
    fontWeight: '600',
  },
  rowMinutes: {
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  rowMinutesUnit: {
    fontSize:   12,
    fontWeight: '600',
  },
  rowCalories: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  2,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     3,
  },
  activeText: {
    fontSize:   11,
    fontWeight: '800',
  },
});
