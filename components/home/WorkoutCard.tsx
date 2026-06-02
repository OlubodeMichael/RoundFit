import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { Workout } from '@/context/workout-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const WORKOUT_CONFIG: Record<string, { icon: IoniconName; label: string }> = {
  gym: { icon: 'barbell-outline', label: 'Strength' },
  running: { icon: 'footsteps-outline', label: 'Run' },
  cycling: { icon: 'bicycle-outline', label: 'Cycling' },
  hiit: { icon: 'flash-outline', label: 'HIIT' },
  yoga: { icon: 'leaf-outline', label: 'Yoga' },
  swimming: { icon: 'water-outline', label: 'Swimming' },
  walking: { icon: 'footsteps-outline', label: 'Walking' },
  rowing: { icon: 'boat-outline', label: 'Rowing' },
  elliptical: { icon: 'reload-outline', label: 'Elliptical' },
  other: { icon: 'apps-outline', label: 'Workout' },
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
  totalCaloriesBurned: number;
  onLogMore?: () => void;
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
  totalCaloriesBurned,
  onLogMore,
}: WorkoutCardProps) {
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const caption =
    workouts.length === 0
      ? 'Nothing logged yet'
      : `${workouts.length} session${workouts.length !== 1 ? 's' : ''} · ${totalCaloriesBurned.toLocaleString()} kcal burned`;

  return (
    <GradientCard variant="workouts" palette={palette} corner="top-right" delay={delay}>
      <Pressable
        onPress={onLogMore}
        disabled={!onLogMore}
        style={({ pressed }) => [onLogMore && pressed && s.pressed]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
              <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
                <Ionicons name="barbell" size={16} color="#FFF" />
              </View>
            </View>
            <View style={s.headerCopy}>
              <Text style={[s.headerTitle, { color: P.text }]}>Workouts</Text>
              <Text style={[s.headerCaption, { color: P.textDim }]} numberOfLines={1}>
                {caption}
              </Text>
            </View>
          </View>
          {onLogMore ? (
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          ) : null}
        </View>
      </Pressable>

      <View style={[s.divider, { backgroundColor: P.hair }]} />

      {workouts.length === 0 ? (
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
            const soft = P[`${tintKey}Soft`];
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
                  <View style={[s.rowIcon, { backgroundColor: soft }]}>
                    <Ionicons name={cfg.icon} size={18} color={fill} />
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
        </View>
      )}

      {onLogMore && workouts.length > 0 ? (
        <>
          <View style={[s.divider, { backgroundColor: P.hair }]} />
          <TouchableOpacity
            onPress={onLogMore}
            activeOpacity={0.7}
            style={s.footer}
          >
            <View style={[s.footerIcon, { backgroundColor: accent.iconSoft }]}>
              <Ionicons name="add" size={16} color={accent.iconBg} />
            </View>
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
        name={onPress ? 'add-circle-outline' : 'barbell-outline'}
        size={18}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
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
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
  footerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
