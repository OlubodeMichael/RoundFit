import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';

const HEADER_ICON_SIZE = 26;

export interface MirrorPromoCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  isDark: boolean;
}

export interface MirrorPromoCardProps {
  P: MirrorPromoCardPalette;
  delay?: number;
}

export function MirrorPromoCard({ P, delay = 480 }: MirrorPromoCardProps) {
  const router = useRouter();
  const accent = getCardAccent('insight', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <GradientCard variant="insight" palette={palette} corner="top-right" delay={delay}>
      <Pressable
        onPress={() => router.push('/(tabs)/progress/mirror')}
        accessibilityRole="button"
        accessibilityLabel="Open 30-day mirror"
        style={({ pressed }) => [pressed && s.pressed]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <Ionicons name="sparkles" size={HEADER_ICON_SIZE} color={accent.iconBg} />
            <View style={s.headerCopy}>
              <Text style={[s.headerLabel, { color: P.textDim }]}>Premium report</Text>
              <Text style={[s.headerMeta, { color: P.textFaint }]}>30-day mirror</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
        </View>

        <Text style={[s.title, { color: P.text }]}>
          Your month at a glance
        </Text>
        <Text style={[s.body, { color: P.textDim }]}>
          Optimal sleep, protein, training days, and the strongest correlations from
          your last 30 days — synthesised by RIS.
        </Text>

        <View style={s.footer}>
          <View style={s.tag}>
            <Ionicons name="analytics-outline" size={13} color={accent.iconBg} />
            <Text style={[s.tagText, { color: P.textDim }]}>4 correlations</Text>
          </View>
          <View style={s.tag}>
            <Ionicons name="sparkles-outline" size={13} color={accent.iconBg} />
            <Text style={[s.tagText, { color: P.textDim }]}>AI synthesis</Text>
          </View>
        </View>
      </Pressable>
    </GradientCard>
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
    paddingBottom: 4,
    gap: 8,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerCopy: { flex: 1, gap: 3, minWidth: 0 },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  headerMeta: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.45,
    lineHeight: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
