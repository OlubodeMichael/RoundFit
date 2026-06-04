import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SymbolWeight } from 'expo-symbols';

import type { WorkoutCatalogEntry } from '@/config/workout-catalog';

export interface WorkoutCatalogIconProps {
  entry: Pick<WorkoutCatalogEntry, 'icon' | 'sfSymbol'>;
  size: number;
  color: string;
  weight?: SymbolWeight;
}

/** Activity icon — SF Symbol on iOS (Apple Fitness style), Ionicons elsewhere. */
export function WorkoutCatalogIcon({
  entry,
  size,
  color,
  weight = 'semibold',
}: WorkoutCatalogIconProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <SymbolView
          name={entry.sfSymbol}
          tintColor={color}
          weight={weight}
          resizeMode="scaleAspectFit"
          style={{ width: size, height: size }}
        />
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
