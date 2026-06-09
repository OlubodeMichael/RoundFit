import { StyleSheet, Text, View } from 'react-native';

import type { CycleLog } from '@/context/cycle-context';
import type { Palette } from '@/lib/log-theme';

export interface CycleHistoryCardProps {
  P: Palette;
  accent: string;
  history: CycleLog[];
}

export function CycleHistoryCard({ P, accent, history }: CycleHistoryCardProps) {
  if (history.length === 0) return null;

  return (
    <View style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={[s.header, { borderBottomColor: P.hair }]}>
        <Text style={[s.title, { color: P.text }]}>Period history</Text>
        <View style={[s.badge, { backgroundColor: P.sunken }]}>
          <Text style={[s.badgeText, { color: P.textFaint }]}>{history.length}</Text>
        </View>
      </View>

      {history.map((log, index) => {
        const start = new Date(log.period_start_date);
        const nextLabel = log.predicted_next_period
          ? new Date(log.predicted_next_period).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : null;

        return (
          <View
            key={log.id}
            style={[
              s.row,
              {
                borderBottomColor: P.hair,
                borderBottomWidth: index < history.length - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
          >
            <View style={[s.dotWrap, { backgroundColor: `${accent}22` }]}>
              <View style={[s.dot, { backgroundColor: accent }]} />
            </View>
            <View style={s.copy}>
              <Text style={[s.date, { color: P.text }]}>
                {start.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={[s.meta, { color: P.textFaint }]}>
                {log.cycle_length} days{nextLabel ? ` · next ~${nextLabel}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dotWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  copy: { flex: 1 },
  date: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1, marginBottom: 2 },
  meta: { fontSize: 11 },
});
