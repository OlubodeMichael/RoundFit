import React from 'react';
import { StyleSheet, View } from 'react-native';

const GUTTER = 14;

interface SleepHypnogramChartOverlayProps {
  hairColor:  string;
  rowHeight:  number;
  ticks:      Date[];
  tickToX:    (d: Date) => number;
  hairWidth:  number;
}

export function SleepHypnogramChartOverlay({
  hairColor,
  rowHeight,
  ticks,
  tickToX,
  hairWidth,
}: SleepHypnogramChartOverlayProps) {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {[1, 2, 3].map((n) => (
        <View
          key={`h-${n}`}
          style={{
            position:        'absolute',
            left:            0,
            right:           0,
            top:             GUTTER + n * rowHeight - hairWidth / 2,
            height:          hairWidth,
            backgroundColor: hairColor,
          }}
        />
      ))}
      {ticks.map((tick, i) => (
        <View
          key={i}
          style={{
            position:        'absolute',
            top:             0,
            bottom:          0,
            left:            tickToX(tick) - hairWidth / 2,
            width:           hairWidth,
            backgroundColor: hairColor,
          }}
        />
      ))}
    </View>
  );
}
