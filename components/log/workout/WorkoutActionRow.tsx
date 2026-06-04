import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  GradientCard,
  getCardAccent,
  type CardAccentVariant,
  type GradientCardCorner,
} from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ACTION_GAP = 10;

interface WorkoutActionTileProps {
  title: string;
  subtitle: string;
  icon: IoniconName;
  variant: CardAccentVariant;
  corner: GradientCardCorner;
  onPress: () => void;
}

function WorkoutActionTile({
  title,
  subtitle,
  icon,
  variant,
  corner,
  onPress,
}: WorkoutActionTileProps) {
  const P = usePalette();
  const accent = getCardAccent(variant, P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tilePressable, pressed && styles.pressed]}
    >
      <GradientCard
        variant={variant}
        palette={palette}
        layout="metric"
        corner={corner}
        animated={false}
        style={styles.tileCard}
        contentStyle={[styles.tileInner, { borderColor: accent.iconSoft }]}
      >
        <View style={[styles.iconRing, { backgroundColor: accent.iconSoft }]}>
          <View style={[styles.iconBox, { backgroundColor: accent.iconBg }]}>
            <Ionicons name={icon} size={17} color="#FFFFFF" />
          </View>
        </View>
        <Text style={[styles.title, { color: P.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: accent.iconBg }]}>{subtitle}</Text>
      </GradientCard>
    </Pressable>
  );
}

export interface WorkoutActionRowProps {
  onStartWorkout: () => void;
  onLogWorkout: () => void;
  showStart?: boolean;
}

export function WorkoutActionRow({
  onStartWorkout,
  onLogWorkout,
  showStart = true,
}: WorkoutActionRowProps) {
  const P = usePalette();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: P.textFaint }]}>Actions</Text>
      <View style={styles.row}>
        {showStart && (
          <WorkoutActionTile
            title="Start workout"
            subtitle="Live track"
            icon="play"
            variant="workouts"
            corner="top-left"
            onPress={onStartWorkout}
          />
        )}
        <WorkoutActionTile
          title="Log workout"
          subtitle="Manual entry"
          icon="create-outline"
          variant="calories"
          corner="bottom-right"
          onPress={onLogWorkout}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: ACTION_GAP,
  },
  tilePressable: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  tileCard: {
    flex: 1,
    width: '100%',
  },
  tileInner: {
    minHeight: 112,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'flex-start',
    gap: 8,
  },
  iconRing: {
    padding: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
  },
});
