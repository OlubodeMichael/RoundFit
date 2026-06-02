import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { useInsights } from '@/context/insights-context';

export interface InsightCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  isDark: boolean;
}

export interface InsightCardProps {
  P: InsightCardPalette;
  delay?: number;
  onPress: () => void;
}

/** Home-screen daily insight — subtle violet wash from the top-right. */
export function InsightCard({ P, delay = 0, onPress }: InsightCardProps) {
  const { todayInsight, claudeInsight } = useInsights();
  const insight = claudeInsight ?? todayInsight;

  if (!insight) return null;

  const isAi = insight.type === 'claude';
  const title = insight.title || insight.message.split('. ')[0];
  const label = isAi ? 'RIS insight' : 'Daily insight';
  const accent = getCardAccent('insight', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <GradientCard variant="insight" palette={palette} corner="top-right" delay={delay}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${title}`}
        style={({ pressed }) => [pressed && s.pressed]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
              <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
                <Ionicons name="sparkles" size={14} color="#FFF" />
              </View>
            </View>
            <View style={s.headerCopy}>
              <Text style={[s.headerLabel, { color: P.textDim }]}>{label}</Text>
              <Text style={[s.headerMeta, { color: P.textFaint }]}>
                Personalised for you
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
        </View>

        <Text
          style={[s.title, { color: P.text }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text style={[s.body, { color: P.textDim }]} numberOfLines={3}>
          {insight.message}
        </Text>

        <View style={s.cta}>
          <Text style={[s.ctaText, { color: P.textDim }]}>View daily insight</Text>
          <Ionicons name="arrow-forward" size={14} color={P.textFaint} />
        </View>
      </Pressable>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  pressed: {
    opacity: 0.88,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  iconRing: {
    padding: 3,
    borderRadius: 12,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  headerMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    letterSpacing: -0.1,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
