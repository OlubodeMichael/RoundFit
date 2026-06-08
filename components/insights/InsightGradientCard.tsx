import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface InsightGradientCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  hair: string;
  isDark: boolean;
}

export interface InsightGradientCardProps {
  P: InsightGradientCardPalette;
  delay?: number;
  onPress?: () => void;
  eyebrow: string;
  title: string;
  body: string;
  icon?: IoniconName;
  compact?: boolean;
  footer?: ReactNode;
}

export function InsightGradientCard({
  P,
  delay = 0,
  onPress,
  eyebrow,
  title,
  body,
  icon = 'sparkles',
  compact = false,
  footer,
}: InsightGradientCardProps) {
  const accent = getCardAccent('insightGrey', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  const content = (
    <>
      <View style={s.header}>
        <View style={s.headerMain}>
          <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
            <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
              <Ionicons name={icon} size={18} color="#FFF" />
            </View>
          </View>
          <View style={s.headerCopy}>
            <Text style={[s.eyebrow, { color: P.textFaint }]} numberOfLines={1}>
              {eyebrow}
            </Text>
          </View>
        </View>
        {onPress ? (
          <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
        ) : null}
      </View>

      <Text
        style={[compact ? s.titleCompact : s.title, { color: P.text }]}
        numberOfLines={compact ? 2 : 3}
      >
        {title}
      </Text>
      <Text
        style={[compact ? s.bodyCompact : s.body, { color: P.textDim }]}
        numberOfLines={compact ? 2 : 5}
      >
        {body}
      </Text>

      {footer ? (
        <View style={[s.footer, { borderTopColor: P.hair }]}>{footer}</View>
      ) : null}
    </>
  );

  return (
    <GradientCard
      variant="insightGrey"
      palette={palette}
      corner="top-right"
      delay={delay}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [pressed && s.pressed]}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
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
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerCopy: { flex: 1, gap: 3, minWidth: 0 },
  iconRing: { padding: 4, borderRadius: 14 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  titleCompact: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 23,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  body: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  bodyCompact: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
});
