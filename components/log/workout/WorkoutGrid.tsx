import React, { isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export interface WorkoutGridProps {
  children: ReactNode;
}

/** Two-column grid for workout summary tiles. */
export function WorkoutGrid({ children }: WorkoutGridProps) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.grid}>
      {items.map((child, index) => {
        if (!isValidElement(child)) return null;
        return (
          <View key={child.key ?? `workout-grid-${index}`} style={styles.cell}>
            {child}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '48%',
    minWidth: 0,
  },
});
