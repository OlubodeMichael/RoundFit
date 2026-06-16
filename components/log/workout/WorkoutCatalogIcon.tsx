import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SymbolViewProps, type SymbolWeight } from 'expo-symbols';

import type { WorkoutCatalogEntry } from '@/config/workout-catalog';

export interface WorkoutCatalogIconProps {
  entry: Pick<WorkoutCatalogEntry, 'icon' | 'sfSymbol'>;
  size: number;
  color: string;
  weight?: SymbolWeight;
  /** Hierarchical rendering matches Apple Fitness on iOS (default on). */
  hierarchical?: boolean;
}

/**
 * Workout activity icon.
 * iOS: Apple's SF Symbols (`figure.run`, `figure.basketball`, …) — same system
 * glyphs Apple Fitness uses. HealthKit only exposes activity type IDs, not images.
 * Android / web: Ionicons fallback.
 */
export function WorkoutCatalogIcon({
  entry,
  size,
  color,
  weight = 'semibold',
  hierarchical = true,
}: WorkoutCatalogIconProps) {
  if (Platform.OS === 'ios') {
    const symbolProps: SymbolViewProps = {
      name: entry.sfSymbol,
      tintColor: color,
      weight,
      resizeMode: 'scaleAspectFit',
      style: { width: size, height: size },
    };

    if (hierarchical) {
      symbolProps.type = 'hierarchical';
    }

    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <SymbolView {...symbolProps} />
      </View>
    );
  }

  return <Ionicons name={entry.icon} size={size} color={color} />;
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
