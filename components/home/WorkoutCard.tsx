import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { pendingWorkoutDurationMinutes } from '@/components/log/workout/workout-display';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { Workout } from '@/context/workout-context';
import type { WorkoutImportReviewItem } from '@/services/workout-import';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ROW_ICON_SIZE = 28;

const WORKOUT_CONFIG: Record<string, { icon: IoniconName; label: string }> = {
  gym: { icon: 'barbell', label: 'Strength' },
  running: { icon: 'footsteps', label: 'Run' },
  cycling: { icon: 'bicycle', label: 'Cycling' },
  hiit: { icon: 'flash', label: 'HIIT' },
  yoga: { icon: 'leaf', label: 'Yoga' },
  swimming: { icon: 'water', label: 'Swimming' },
  walking: { icon: 'footsteps', label: 'Walking' },
  rowing: { icon: 'boat', label: 'Rowing' },
  elliptical: { icon: 'reload', label: 'Elliptical' },
  other: { icon: 'apps', label: 'Workout' },
};

const INTENSITY_DOTS: Record<string, number> = {
  light: 1,
  moderate: 2,
  hard: 3,
};

const ROW_ACCENTS = ['protein', 'water', 'carbs', 'calories', 'fat'] as const;

export interface WorkoutCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  hair: string;
  sunken: string;
  protein: string;
  proteinSoft: string;
  water: string;
  waterSoft: string;
  carbs: string;
  carbsSoft: string;
  calories: string;
  caloriesSoft: string;
  fat: string;
  fatSoft: string;
  isDark: boolean;
}

export interface WorkoutCardProps {
  P: WorkoutCardPalette;
  delay?: number;
  workouts: Workout[];
  /** Unsaved Apple Fitness workouts for the displayed day. */
  pendingWorkouts?: WorkoutImportReviewItem[];
  totalCaloriesBurned: number;
  onLogMore?: () => void;
  onOpenPending?: (healthkitUuid: string) => void;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function WorkoutCard({
  P,
  delay = 0,
  workouts,
  pendingWorkouts = [],
  totalCaloriesBurned,
  onLogMore,
  onOpenPending,
}: WorkoutCardProps) {
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const sessionCount = workouts.length + pendingWorkouts.length;
  const hasAny = sessionCount > 0;
  const caption =
    sessionCount === 0
      ? 'Nothing logged yet'
      : `${sessionCount} session${sessionCount !== 1 ? 's' : ''} · ${totalCaloriesBurned.toLocaleString()} kcal burned`;

  return (
    <GradientCard variant="workouts" palette={palette} corner="top-right" delay={delay}>
      <Pressable
        onPress={onLogMore}
        disabled={!onLogMore}
        style={({ pressed }) => [onLogMore && pressed && s.pressed]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <Text style={[s.headerTitle, { color: P.text }]}>Workouts</Text>
            <Text style={[s.headerCaption, { color: P.textDim }]} numberOfLines={1}>
              {caption}
            </Text>
          </View>
          {onLogMore ? (
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          ) : null}
        </View>
      </Pressable>

      <View style={[s.divider, { backgroundColor: P.hair }]} />

      {!hasAny ? (
        <EmptyBlock
          P={P}
          message={
            onLogMore ? 'Log your first workout' : 'No workouts logged this day'
          }
          onPress={onLogMore}
        />
      ) : (
        <View>
          {workouts.map((w, i) => {
            const cfg = WORKOUT_CONFIG[w.type] ?? WORKOUT_CONFIG.other;
            const tintKey = ROW_ACCENTS[i % ROW_ACCENTS.length];
            const fill = P[tintKey];
            const dots = INTENSITY_DOTS[w.intensity ?? 'moderate'] ?? 2;
            const hasSets = w.sets && w.sets.length > 0;

            return (
              <View key={w.id}>
                {i > 0 ? (
                  <View style={[s.rowDivider, { backgroundColor: P.hair }]} />
                ) : null}
                <Pressable
                  onPress={onLogMore}
                  disabled={!onLogMore}
                  style={({ pressed }) => [
                    s.row,
                    onLogMore && pressed && { backgroundColor: P.sunken },
                  ]}
                >
                  <View style={s.rowIconSlot}>
                    <Ionicons name={cfg.icon} size={ROW_ICON_SIZE} color={fill} />
                  </View>
                  <View style={s.rowCopy}>
                    <Text style={[s.rowTitle, { color: P.text }]}>
                      {cfg.label}
                    </Text>
                    <View style={s.meta}>
                      <Text style={[s.metaText, { color: P.textFaint }]}>
                        {fmtDuration(w.duration_mins)}
                      </Text>
                      {w.intensity ? (
                        <>
                          <View
                            style={[s.metaDot, { backgroundColor: P.textFaint }]}
                          />
                          <View style={s.intensityDots}>
                            {[1, 2, 3].map((d) => (
                              <View
                                key={d}
                                style={[
                                  s.dot,
                                  {
                                    backgroundColor:
                                      d <= dots ? fill : P.cardEdge,
                                  },
                                ]}
                              />
                            ))}
                          </View>
                        </>
                      ) : null}
                      {hasSets ? (
                        <>
                          <View
                            style={[s.metaDot, { backgroundColor: P.textFaint }]}
                          />
                          <Text style={[s.metaText, { color: P.textFaint }]}>
                            {w.sets!.length} set{w.sets!.length !== 1 ? 's' : ''}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View style={s.rowStat}>
                    <Text style={[s.rowValue, { color: P.text }]}>
                      {Math.round(w.calories_burned)}
                    </Text>
                    <Text style={[s.rowUnit, { color: P.textFaint }]}>kcal</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
          {pendingWorkouts.map((item, i) => {
            const rowIndex = workouts.length + i;
            const tintKey = ROW_ACCENTS[rowIndex % ROW_ACCENTS.length];
            const fill = P[tintKey];
            const durationMins = pendingWorkoutDurationMinutes(item);
            const canOpen = onOpenPending != null;

            return (
              <View key={item.sample.uuid}>
                {rowIndex > 0 ? (
                  <View style={[s.rowDivider, { backgroundColor: P.hair }]} />
                ) : null}
                <Pressable
                  onPress={
                    canOpen ? () => onOpenPending(item.sample.uuid) : undefined
                  }
                  disabled={!canOpen}
                  style={({ pressed }) => [
                    s.row,
                    canOpen && pressed && { backgroundColor: P.sunken },
                  ]}
                >
                  <View style={s.rowIconSlot}>
                    <Ionicons
                      name={item.catalogEntry.icon}
                      size={ROW_ICON_SIZE}
                      color={fill}
                    />
                  </View>
                  <View style={s.rowCopy}>
                    <Text style={[s.rowTitle, { color: P.text }]}>
                      {item.label}
                    </Text>
                    <View style={s.meta}>
                      <Text style={[s.metaText, { color: P.textFaint }]}>
                        Apple Fitness
                      </Text>
                      <View
                        style={[s.metaDot, { backgroundColor: P.textFaint }]}
                      />
                      <Text style={[s.metaText, { color: P.textFaint }]}>
                        {fmtDuration(durationMins)}
                      </Text>
                    </View>
                  </View>
                  <View style={s.rowStat}>
                    <Text style={[s.rowValue, { color: P.text }]}>
                      {Math.round(item.caloriesBurned ?? 0)}
                    </Text>
                    <Text style={[s.rowUnit, { color: P.textFaint }]}>kcal</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {onLogMore && hasAny ? (
        <>
          <View style={[s.divider, { backgroundColor: P.hair }]} />
          <TouchableOpacity
            onPress={onLogMore}
            activeOpacity={0.7}
            style={s.footer}
          >
            <Ionicons name="add" size={ROW_ICON_SIZE} color={accent.iconBg} />
            <Text style={[s.footerLabel, { color: P.text }]}>Log a workout</Text>
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          </TouchableOpacity>
        </>
      ) : null}
    </GradientCard>
  );
}

function EmptyBlock({
  P,
  message,
  onPress,
}: {
  P: WorkoutCardPalette;
  message: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={s.empty}>
      <Ionicons
        name={onPress ? 'add-circle' : 'barbell'}
        size={ROW_ICON_SIZE}
        color={P.textFaint}
      />
      <Text style={[s.emptyText, { color: P.textFaint }]}>{message}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && s.pressed]}
    >
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.88 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  headerMain: {
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  rowIconSlot: {
    width: ROW_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.5,
  },
  intensityDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  rowStat: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  rowUnit: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
