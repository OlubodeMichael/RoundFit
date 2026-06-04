import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WorkoutCatalogIcon } from '@/components/log/workout/WorkoutCatalogIcon';
import { getCatalogEntryById } from '@/config/workout-catalog';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

const LIVE_COLOR = '#34D399';

export interface WorkoutContinueCardProps {
  workoutType: string;
  workoutName: string;
  elapsedMs: number;
  setCount: number;
  isPaused: boolean;
  onPress: () => void;
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function WorkoutContinueCard({
  workoutType,
  workoutName,
  elapsedMs,
  setCount,
  isPaused,
  onPress,
}: WorkoutContinueCardProps) {
  const P = usePalette();
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const catalogEntry = getCatalogEntryById(workoutType);
  const iconEntry = catalogEntry
    ? { icon: catalogEntry.icon, sfSymbol: catalogEntry.sfSymbol }
    : { icon: 'barbell' as const, sfSymbol: 'figure.strengthtraining.traditional' };
  const setsLabel = setCount === 1 ? '1 set' : `${setCount} sets`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${workoutName}, ${formatElapsed(elapsedMs)} elapsed`}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <GradientCard
        variant="workouts"
        palette={palette}
        layout="metric"
        corner="top-left"
        animated={false}
        style={styles.card}
        contentStyle={[styles.inner, { borderColor: accent.iconSoft }]}
      >
        <View style={styles.topRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isPaused ? P.sunken : 'rgba(52,211,153,0.14)',
                borderColor: isPaused ? P.cardEdge : 'rgba(52,211,153,0.35)',
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isPaused ? P.textFaint : LIVE_COLOR },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isPaused ? P.textFaint : LIVE_COLOR },
              ]}
            >
              {isPaused ? 'Paused' : 'Live'}
            </Text>
          </View>

          <WorkoutCatalogIcon
            entry={iconEntry}
            size={36}
            color={accent.iconBg}
            weight="semibold"
          />
        </View>

        <Text style={[styles.timer, { color: P.text }]}>{formatElapsed(elapsedMs)}</Text>

        <Text style={[styles.workoutName, { color: P.text }]} numberOfLines={1}>
          {workoutName}
        </Text>

        <View style={styles.footer}>
          <View style={[styles.setsChip, { backgroundColor: P.sunken }]}>
            <Text style={[styles.setsText, { color: P.textFaint }]}>{setsLabel}</Text>
          </View>
          <View style={styles.ctaRow}>
            <Text style={[styles.ctaText, { color: accent.iconBg }]}>Continue</Text>
            <Ionicons name="chevron-forward" size={16} color={accent.iconBg} />
          </View>
        </View>
      </GradientCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  card: {
    width: '100%',
  },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  timer: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 40,
    letterSpacing: -0.5,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  workoutName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  setsChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  setsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
