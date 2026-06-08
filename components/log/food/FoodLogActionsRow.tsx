import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  GradientCard,
  getCardAccent,
  type CardAccent,
  type CardAccentVariant,
  type GradientCardCorner,
} from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ACTION_GAP = 10;
const PRIMARY_ICON_SIZE = 32;
const SECONDARY_ICON_SIZE = 28;
const STAGGER_MS = 55;

interface FoodLogActionTileProps {
  title: string;
  subtitle: string;
  icon: IoniconName;
  variant: CardAccentVariant;
  corner: GradientCardCorner;
  delay: number;
  layout: 'primary' | 'secondary';
  onPress: () => void;
}

function FoodLogActionTile({
  title,
  subtitle,
  icon,
  variant,
  corner,
  delay,
  layout,
  onPress,
}: FoodLogActionTileProps) {
  const P = usePalette();
  const accent = getCardAccent(variant, P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const isPrimary = layout === 'primary';
  const iconSize = isPrimary ? PRIMARY_ICON_SIZE : SECONDARY_ICON_SIZE;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [
        isPrimary ? styles.primaryPressable : styles.secondaryPressable,
        pressed && styles.pressed,
      ]}
    >
      <GradientCard
        variant={variant}
        palette={palette}
        layout="full"
        corner={corner}
        delay={delay}
        animated
        style={isPrimary ? styles.primaryCard : styles.secondaryCard}
        contentStyle={[
          isPrimary ? styles.primaryInner : styles.secondaryInner,
          { borderColor: accent.iconSoft },
        ]}
      >
        <ActionTileBody
          title={title}
          subtitle={subtitle}
          icon={icon}
          iconSize={iconSize}
          accent={accent}
          isPrimary={isPrimary}
        />
      </GradientCard>
    </Pressable>
  );
}

function ActionTileBody({
  title,
  subtitle,
  icon,
  iconSize,
  accent,
  isPrimary,
}: {
  title: string;
  subtitle: string;
  icon: IoniconName;
  iconSize: number;
  accent: CardAccent;
  isPrimary: boolean;
}) {
  const P = usePalette();

  return (
    <View style={isPrimary ? styles.primaryBody : styles.secondaryBody}>
      <Ionicons name={icon} size={iconSize} color={accent.iconBg} />
      <View style={styles.copy}>
        <Text
          style={[
            isPrimary ? styles.primaryTitle : styles.secondaryTitle,
            { color: P.text },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.subtitle, { color: accent.iconBg }]}
          numberOfLines={isPrimary ? 2 : 1}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export interface FoodLogActionsRowProps {
  onPhoto: () => void;
  onManual: () => void;
  onSearch: () => void;
  baseDelay?: number;
}

export function FoodLogActionsRow({
  onPhoto,
  onManual,
  onSearch,
  baseDelay = 160,
}: FoodLogActionsRowProps) {
  const P = usePalette();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: P.textFaint }]}>Quick add</Text>

      <FoodLogActionTile
        title="AI Photo"
        subtitle="Snap a meal — estimates calories"
        icon="camera"
        variant="calories"
        corner="top-right"
        delay={baseDelay}
        layout="primary"
        onPress={onPhoto}
      />

      <View style={styles.secondaryRow}>
        <FoodLogActionTile
          title="Manual"
          subtitle="Type it in"
          icon="create"
          variant="protein"
          corner="top-left"
          delay={baseDelay + STAGGER_MS}
          layout="secondary"
          onPress={onManual}
        />
        <FoodLogActionTile
          title="Search"
          subtitle="Food database"
          icon="search"
          variant="fat"
          corner="bottom-right"
          delay={baseDelay + STAGGER_MS * 2}
          layout="secondary"
          onPress={onSearch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: ACTION_GAP,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  primaryPressable: {
    width: '100%',
  },
  secondaryPressable: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryCard: {
    width: '100%',
  },
  secondaryCard: {
    flex: 1,
    width: '100%',
  },
  primaryInner: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryInner: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
    justifyContent: 'center',
  },
  primaryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  secondaryBody: {
    flex: 1,
    gap: 8,
    justifyContent: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  primaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  secondaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: ACTION_GAP,
  },
});
