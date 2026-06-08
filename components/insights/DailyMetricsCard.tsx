import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { GradientCard } from '@/components/ui/GradientCard';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface DailyMetric {
  key: string;
  label: string;
  icon: IoniconName;
  value: string;
  target: string;
  pct: number;
  met: boolean;
  noData: boolean;
}

export interface DailyMetricsCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textFaint: string;
  sunken: string;
  calories: string;
  hair: string;
  isDark: boolean;
}

export interface DailyMetricsCardProps {
  P: DailyMetricsCardPalette;
  delay?: number;
  metrics: DailyMetric[];
}

export function DailyMetricsCard({ P, delay = 0, metrics }: DailyMetricsCardProps) {
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <GradientCard
      variant="insightGrey"
      palette={palette}
      corner="top-right"
      delay={delay}
      contentStyle={{ padding: 0 }}
    >
      {metrics.map((m, i) => (
        <View key={m.key}>
          {i > 0 ? <View style={[s.divider, { backgroundColor: P.hair }]} /> : null}
          <View style={s.metricRow}>
            <View style={s.metricTopRow}>
              <View style={s.metricLabelRow}>
                <Ionicons name={m.icon} size={18} color={P.textFaint} />
                <Text style={[s.metricName, { color: P.text }]}>{m.label}</Text>
              </View>
              <Text style={[s.metricValueText, { color: P.text }]}>
                {m.value}
                {!m.noData ? (
                  <Text style={[s.metricTargetText, { color: P.textFaint }]}>
                    {' '}/ {m.target}
                  </Text>
                ) : null}
              </Text>
            </View>

            {!m.noData ? (
              <View style={s.metricBarRow}>
                <View style={[s.metricBarTrack, { backgroundColor: P.sunken }]}>
                  <View
                    style={[
                      s.metricBarFill,
                      {
                        width: `${m.pct}%`,
                        backgroundColor: m.met ? P.calories : P.text,
                      },
                    ]}
                  />
                </View>
                <Text style={[s.metricPct, { color: m.met ? P.calories : P.textFaint }]}>
                  {Math.round(m.pct)}%
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </GradientCard>
  );
}

const s = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth },
  metricRow: { paddingHorizontal: 22, paddingVertical: 20, gap: 10 },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricName: { fontSize: 18, fontWeight: '600' },
  metricValueText: { fontSize: 17, fontWeight: '700' },
  metricTargetText: { fontSize: 16, fontWeight: '400' },
  metricBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 3 },
  metricPct: { fontSize: 15, fontWeight: '600', minWidth: 42, textAlign: 'right' },
});
