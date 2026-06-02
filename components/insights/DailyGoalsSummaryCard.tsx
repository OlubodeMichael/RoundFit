import { StyleSheet, Text, View } from 'react-native';

import { GradientCard } from '@/components/ui/GradientCard';

export interface MiniGoal {
  label: string;
  pct: number;
  met: boolean;
}

export interface DailyGoalsSummaryCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textFaint: string;
  sunken: string;
  calories: string;
  isDark: boolean;
}

export interface DailyGoalsSummaryCardProps {
  P: DailyGoalsSummaryCardPalette;
  delay?: number;
  dateLabel: string;
  goalsMetCount: number;
  miniGoals: MiniGoal[];
  large?: boolean;
}

export function DailyGoalsSummaryCard({
  P,
  delay = 0,
  dateLabel,
  goalsMetCount,
  miniGoals,
  large = false,
}: DailyGoalsSummaryCardProps) {
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <GradientCard
      variant="insightGrey"
      palette={palette}
      corner="top-right"
      delay={delay}
      contentStyle={{ padding: large ? 24 : 20 }}
    >
      <Text style={[s.dateLabel, { color: P.textFaint }]}>{dateLabel}</Text>

      <View style={s.goalsRow}>
        <Text style={[large ? s.goalsBigNumLarge : s.goalsBigNum, { color: P.text }]}>
          {goalsMetCount}
        </Text>
        <Text style={[large ? s.goalsOfTextLarge : s.goalsOfText, { color: P.text }]}>
          {' of 4 goals met'}
        </Text>
      </View>

      <View style={s.miniGoalsRow}>
        {miniGoals.map(g => (
          <View key={g.label} style={s.miniGoalCol}>
            <View style={[s.miniGoalTrack, { backgroundColor: P.sunken }]}>
              {g.pct > 0 && (
                <View
                  style={[
                    s.miniGoalFill,
                    { width: `${g.pct}%`, backgroundColor: g.met ? P.calories : P.text },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                s.miniGoalLabel,
                { color: g.met ? P.text : P.textFaint, fontWeight: g.met ? '700' : '400' },
              ]}
            >
              {g.label}
            </Text>
          </View>
        ))}
      </View>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  dateLabel: { fontSize: 15, fontWeight: '500', letterSpacing: 0.6, marginBottom: 16 },
  goalsRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 28 },
  goalsBigNum: {
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 66,
  },
  goalsOfText: {
    fontSize: 18,
    fontWeight: '500',
    paddingBottom: 10,
  },
  goalsBigNumLarge: {
    fontSize: 80,
    fontWeight: '800',
    letterSpacing: -3,
    lineHeight: 82,
  },
  goalsOfTextLarge: {
    fontSize: 20,
    fontWeight: '500',
    paddingBottom: 14,
  },
  miniGoalsRow: { flexDirection: 'row', gap: 12 },
  miniGoalCol: { flex: 1, gap: 8 },
  miniGoalTrack: { height: 5, borderRadius: 2, overflow: 'hidden' },
  miniGoalFill: { height: '100%', borderRadius: 2 },
  miniGoalLabel: { fontSize: 13, letterSpacing: 0.2 },
});
