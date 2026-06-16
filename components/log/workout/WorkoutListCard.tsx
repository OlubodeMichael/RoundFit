import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WorkoutActivityIcon } from '@/components/log/workout/WorkoutActivityIcon';
import { APPLE_FITNESS_HEART_COLOR } from '@/components/log/workout/workout-display';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { usePalette } from '@/lib/log-theme';

export interface WorkoutListStat {
  label: string;
  value: string;
}

export interface WorkoutListCardProps {
  iconEntry: Pick<WorkoutCatalogEntry, 'icon' | 'sfSymbol'>;
  title: string;
  /** Clock time shown between the header and title (e.g. `12:57 PM – 1:19 PM`). */
  timeRange?: string | null;
  eyebrow?: string | null;
  stats: WorkoutListStat[];
  calories?: number | null;
  isNew?: boolean;
  delay?: number;
  onPress?: () => void;
}

export function WorkoutListCard({
  iconEntry,
  title,
  timeRange,
  eyebrow,
  stats,
  calories,
  isNew = false,
  delay = 0,
  onPress,
}: WorkoutListCardProps) {
  const P = usePalette();
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const interactive = onPress != null;

  const hero = stats[0];
  const chips = stats.slice(1);

  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.wrap,
        interactive && pressed && styles.pressed,
      ]}
    >
      <GradientCard
        variant="workouts"
        palette={palette}
        layout="metric"
        corner="top-right"
        delay={delay}
        animated={delay > 0}
        style={styles.cardShell}
        contentStyle={styles.cardInner}
      >
        {(eyebrow != null && eyebrow.length > 0) || isNew ? (
          <View style={styles.header}>
            <View style={styles.headerRight}>
              {eyebrow != null && eyebrow.length > 0 ? (
                <View style={[styles.sourceBadge, { backgroundColor: P.sunken }]}>
                  <Ionicons name="heart" size={10} color={APPLE_FITNESS_HEART_COLOR} />
                  <Text style={[styles.sourceText, { color: P.textFaint }]} numberOfLines={1}>
                    {eyebrow}
                  </Text>
                </View>
              ) : null}
              {isNew ? (
                <View style={[styles.newPill, { backgroundColor: accent.iconBg }]}>
                  <Text style={styles.newText}>NEW</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {timeRange != null && timeRange.length > 0 ? (
          <Text style={[styles.timeRange, { color: P.textFaint }]} numberOfLines={1}>
            {timeRange}
          </Text>
        ) : null}

        <View style={styles.titleRow}>
          <WorkoutActivityIcon entry={iconEntry} />
          <Text style={[styles.title, { color: P.text }]} numberOfLines={2}>
            {title}
          </Text>
        </View>

        {hero != null && (
          <View style={styles.heroBlock}>
            <Text
              style={[styles.heroValue, { color: P.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {hero.value}
            </Text>
            <Text style={[styles.heroLabel, { color: P.textDim }]}>{hero.label}</Text>
          </View>
        )}

        <View style={styles.chipRow}>
          {calories != null && calories > 0 && (
            <View style={[styles.chip, { backgroundColor: accent.iconSoft }]}>
              <Text style={[styles.chipValue, { color: P.text }]}>
                {Math.round(calories)}
              </Text>
              <Text style={[styles.chipLabel, { color: accent.iconBg }]}>kcal</Text>
            </View>
          )}
          {chips.map((chip) => (
            <View key={chip.label} style={[styles.chip, { backgroundColor: P.sunken }]}>
              <Text style={[styles.chipValue, { color: P.text }]} numberOfLines={1}>
                {chip.value}
              </Text>
              <Text style={[styles.chipLabel, { color: P.textFaint }]}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </GradientCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 152,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardShell: {
    flex: 1,
    width: '100%',
  },
  cardInner: {
    minHeight: 152,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    justifyContent: 'flex-start',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 1,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  newPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  newText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  heroBlock: {
    marginTop: 2,
    gap: 1,
  },
  timeRange: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginTop: 2,
  },
  heroValue: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 28,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: '100%',
  },
  chipValue: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
});
