import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

const DAY_CELL_ASPECT = 0.85;
const PROGRESS_HEIGHT = 5;
const HEADER_ICON_SIZE = 30;

export interface ConsistencyDay {
  label: string;
  on: boolean;
  today: boolean;
}

export interface ProgressConsistencyCardProps {
  consistency: number;
  days: ConsistencyDay[];
  delay?: number;
}

export function ProgressConsistencyCard({
  consistency,
  days,
  delay = 220,
}: ProgressConsistencyCardProps) {
  const P = usePalette();
  const accent = getCardAccent('protein', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const daysOn = days.filter((d) => d.on).length;
  const scorePct = Math.min(Math.max(consistency, 0), 100);

  return (
    <GradientCard
      variant="protein"
      palette={palette}
      corner="bottom-left"
      delay={delay}
      contentStyle={[s.shell, { borderColor: accent.iconSoft }]}
    >
      <View style={s.header}>
        <View style={s.headerMain}>
          <Ionicons name="checkmark-done-outline" size={HEADER_ICON_SIZE} color={accent.iconBg} />
          <View style={s.headerCopy}>
            <Text style={[s.headerLabel, { color: P.textDim }]}>
              Consistency index
            </Text>
            <Text style={[s.headerMeta, { color: P.text }]}>
              {daysOn} of 7 days on target
            </Text>
          </View>
        </View>
        <View style={[s.scoreChip, { backgroundColor: accent.iconSoft }]}>
          <Ionicons name="checkmark-circle" size={11} color={accent.iconBg} />
          <Text style={[s.scoreText, { color: accent.iconBg }]}>{consistency}</Text>
          <Text style={[s.scoreSuffix, { color: P.textFaint }]}>/100</Text>
        </View>
      </View>

      <View style={[s.progressTrack, { backgroundColor: P.sunken }]}>
        <View
          style={[
            s.progressFill,
            { width: `${scorePct}%`, backgroundColor: accent.iconBg },
          ]}
        />
      </View>

      <View style={s.daysRow}>
        {days.map((d, i) => {
          const isToday = d.today;
          return (
            <View key={i} style={s.dayCol}>
              <View
                style={[
                  s.dayCell,
                  {
                    backgroundColor: d.on ? accent.iconBg : P.sunken,
                    borderColor: isToday ? P.calories : P.cardEdge,
                    borderWidth: isToday ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                {d.on ? (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                ) : null}
              </View>
              <Text
                style={[
                  s.dayLabel,
                  {
                    color: isToday ? P.calories : P.textFaint,
                    fontWeight: isToday ? '800' : '700',
                  },
                ]}
              >
                {d.label}
              </Text>
            </View>
          );
        })}
      </View>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  shell: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  headerCopy: { flex: 1, gap: 3, minWidth: 0 },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  headerMeta: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 21,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreSuffix: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressTrack: {
    height: PROGRESS_HEIGHT,
    borderRadius: PROGRESS_HEIGHT / 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: PROGRESS_HEIGHT / 2,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  dayCell: {
    width: '100%',
    aspectRatio: DAY_CELL_ASPECT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
