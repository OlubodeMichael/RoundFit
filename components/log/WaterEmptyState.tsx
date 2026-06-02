import { StyleSheet, Text, View } from 'react-native';
import { Droplet } from 'lucide-react-native';

import { usePalette } from '@/lib/log-theme';

interface WaterEmptyStateProps {
  isToday: boolean;
  variant?: 'full' | 'column' | 'embedded';
}

export function WaterEmptyState({ isToday, variant = 'full' }: WaterEmptyStateProps) {
  const P = usePalette();
  const acc = P.water;

  const isEmbedded = variant === 'embedded';
  const isColumn = variant === 'column' || isEmbedded;

  if (isEmbedded) {
    return (
      <View style={s.embeddedWrap}>
        <View style={s.embeddedHeader}>
          <Text style={[s.embeddedTitle, { color: P.text }]}>Log</Text>
          <View style={[s.countPill, { backgroundColor: P.isDark ? P.sunken : P.raised }]}>
            <Text style={[s.countPillMuted, { color: P.textFaint }]}>0</Text>
          </View>
        </View>

        <View
          style={[
            s.embeddedEmpty,
            {
              backgroundColor: P.isDark ? P.sunken : '#F8FAFC',
              borderColor: P.hair,
            },
          ]}
        >
          <View style={[s.emptyIcon, { backgroundColor: P.waterSoft }]}>
            <Droplet size={20} color={acc} strokeWidth={2} fill={acc} fillOpacity={0.15} />
          </View>
          <Text style={[s.emptyHead, { color: P.text }]}>
            {isToday ? 'No sips yet' : 'Nothing logged'}
          </Text>
          <Text style={[s.emptySub, { color: P.textDim }]}>
            {isToday ? 'Quick add below' : 'No entries this day'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        isColumn ? s.cardColumn : s.card,
        { backgroundColor: P.card, borderColor: P.cardEdge },
      ]}
    >
      <View style={[isColumn ? s.iconColumn : s.icon, { backgroundColor: P.waterSoft }]}>
        <Droplet size={isColumn ? 24 : 32} color={acc} strokeWidth={2} fill={acc} fillOpacity={0.15} />
      </View>
      <Text style={[isColumn ? s.headColumn : s.head, { color: P.text }]}>
        {isToday ? (isColumn ? 'No sips yet' : 'Your reservoir is empty') : 'Nothing logged'}
      </Text>
      <Text style={[isColumn ? s.subColumn : s.sub, { color: P.textDim }]}>
        {isToday
          ? (isColumn ? 'Use quick add below' : 'Tap a droplet below to log your first sip')
          : 'No water was recorded for this day'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  embeddedWrap: {
    flex: 1,
    gap: 10,
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  embeddedTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  countPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillMuted: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  embeddedEmpty: {
    flex: 1,
    minHeight: 160,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHead: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 17,
  },

  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 36,
    alignItems: 'center',
    gap: 10,
  },
  cardColumn: {
    flex: 1,
    minHeight: 200,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconColumn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 4 },
  headColumn: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  sub: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  subColumn: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },
});
