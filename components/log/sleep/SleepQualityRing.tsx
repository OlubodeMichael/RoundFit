import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { usePalette } from '@/lib/log-theme';
import { qualityPctFromUi, type SleepQualityUi } from '@/utils/sleep-quality';
import { sleepQualityRingColor } from '@/components/log/sleep/constants';

export interface SleepQualityRingProps {
  quality: SleepQualityUi;
  score?: number | null;
  size?: number;
  strokeWidth?: number;
}

export function SleepQualityRing({
  quality,
  score: scoreProp,
  size = 54,
  strokeWidth = 5,
}: SleepQualityRingProps) {
  const P     = usePalette();
  const score = scoreProp ?? qualityPctFromUi(quality);
  const color = sleepQualityRingColor(P, quality);
  const r      = (size - strokeWidth) / 2;
  const cx     = size / 2;
  const cy     = size / 2;
  const circ   = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={P.hair} strokeWidth={strokeWidth} />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color }}>{score}</Text>
        </View>
      </View>
    </View>
  );
}
