import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { usePalette } from '@/lib/log-theme';

const DEFAULT_SIZE = 76;
const DEFAULT_STROKE = 6;

interface HydrationProgressRingProps {
  progress: number;
  percent: number;
  size?: number;
  strokeWidth?: number;
}

export function HydrationProgressRing({
  progress,
  percent,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
}: HydrationProgressRingProps) {
  const P = usePalette();
  const acc = P.water;
  const isComplete = progress >= 1;

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(Math.max(progress, 0), 1) * circumference;
  const trackColor = P.isDark ? 'rgba(255,255,255,0.10)' : P.waterSoft;
  const fillColor = isComplete ? P.sage : acc;

  return (
    <View
      style={[s.wrap, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${percent} percent of daily hydration goal`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center},${center}`}
        />
      </Svg>
      <View style={s.center} pointerEvents="none">
        <Text style={[s.pct, { color: P.text }]}>{percent}</Text>
        <Text style={[s.pctUnit, { color: P.textFaint }]}>%</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
    paddingTop: 2,
  },
  pct: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  pctUnit: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    includeFontPadding: false,
  },
});
