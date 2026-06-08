import { StyleSheet, Text, View } from 'react-native';

import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';
import { currentMonthShort } from '@/components/recovery/recovery-trend-utils';

export interface RecoveryMonthCalendarBackdropProps {
  cellSize: number;
  gridHeight: number;
  palette: TrendPalette;
}

/** Month name watermark only — day numbers render in the foreground cells. */
export function RecoveryMonthCalendarBackdrop({
  cellSize,
  gridHeight,
  palette,
}: RecoveryMonthCalendarBackdropProps) {
  const monthLabel = currentMonthShort();

  return (
    <View
      style={[styles.layer, { height: gridHeight }]}
      pointerEvents="none"
    >
      <Text
        style={[
          styles.watermark,
          {
            color: palette.textDim,
            opacity: palette.isDark ? 0.28 : 0.22,
            lineHeight: cellSize * 2.1,
          },
        ]}
      >
        {monthLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  watermark: {
    position:    'absolute',
    alignSelf:     'center',
    top:           '18%',
    fontSize:      72,
    fontWeight:    '800',
    letterSpacing: 4,
    textAlign:     'center',
  },
});
