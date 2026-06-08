import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

const CHART_HEIGHT = 128;
const BAR_GAP = 6;
const HEADER_ICON_SIZE = 30;

export interface CaloriesWeekDay {
  day: string;
  cals: number;
  today: boolean;
}

export interface ProgressCaloriesCardProps {
  avgCals: number;
  calsGoal: number;
  days: CaloriesWeekDay[];
  maxCals: number;
  delay?: number;
}

export function ProgressCaloriesCard({
  avgCals,
  calsGoal,
  days,
  maxCals,
  delay = 340,
}: ProgressCaloriesCardProps) {
  const P = usePalette();
  const accent = getCardAccent('calories', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const hasData = avgCals > 0;
  const goalPct = maxCals > 0 ? calsGoal / maxCals : 0;

  return (
    <GradientCard
      variant="calories"
      palette={palette}
      corner="top-right"
      delay={delay}
      contentStyle={[s.shell, { borderColor: accent.iconSoft }]}
    >
      <View style={s.header}>
        <View style={s.headerMain}>
          <Ionicons name="flame" size={HEADER_ICON_SIZE} color={accent.iconBg} />
          <View style={s.headerCopy}>
            <Text style={[s.headerLabel, { color: P.textDim }]}>Calories</Text>
            <Text style={[s.headerMeta, { color: P.text }]}>
              {hasData ? `Avg ${avgCals.toLocaleString()}` : 'No data yet'}
            </Text>
          </View>
        </View>
        <View style={s.goalLegend}>
          <View style={[s.dashLine, { borderColor: accent.iconBg }]} />
          <Text style={[s.goalLegendText, { color: P.textFaint }]}>
            Goal {calsGoal.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={s.barChart}>
        {days.map((d, i) => {
          const pct = d.cals > 0 && maxCals > 0 ? d.cals / maxCals : 0;
          const isToday = d.today;
          const over = d.cals > calsGoal;
          const color = isToday
            ? accent.iconBg
            : over
              ? P.danger
              : P.protein;

          return (
            <View key={i} style={s.barCol}>
              <View style={s.barWrap}>
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    s.bar,
                    { backgroundColor: P.sunken, opacity: 0.7 },
                  ]}
                />
                <View
                  style={[
                    s.goalLine,
                    {
                      bottom: `${goalPct * 100}%`,
                      borderColor: accent.iconBg,
                      opacity: 0.45,
                    },
                  ]}
                />
                {d.cals > 0 && (
                  <View
                    style={[
                      s.bar,
                      {
                        height: `${pct * 100}%`,
                        backgroundColor: color,
                      },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  s.barDay,
                  {
                    color: isToday ? accent.iconBg : P.textFaint,
                    fontWeight: isToday ? '800' : '600',
                  },
                ]}
              >
                {d.day}
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
  goalLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  dashLine: {
    width: 16,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  goalLegendText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  barChart: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
    gap: BAR_GAP,
    alignItems: 'flex-end',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: 5,
    minHeight: 4,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  barDay: {
    fontSize: 11,
    fontWeight: '600',
  },
});
