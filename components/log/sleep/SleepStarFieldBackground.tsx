import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

export function SleepStarFieldBackground() {
  const { width, height } = useWindowDimensions();

  const stars = useMemo(() => {
    const count = 90;
    return Array.from({ length: count }, (_, i) => {
      const sx = Math.abs(Math.sin(i * 127.1) * 99991) % 1;
      const sy = Math.abs(Math.sin(i * 311.7) * 99991) % 1;
      const sr = Math.abs(Math.sin(i * 513.3) * 99991) % 1;
      const so = Math.abs(Math.sin(i * 719.9) * 99991) % 1;
      return {
        cx: sx * width,
        cy: sy * height,
        r:  sr < 0.7 ? 0.6 : sr < 0.92 ? 1.1 : 1.6,
        opacity: 0.15 + so * 0.55,
      };
    });
  }, [width, height]);

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 0 }} pointerEvents="none">
      <LinearGradient
        colors={['rgba(88,60,180,0.28)', 'rgba(60,40,130,0.10)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.52 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(100,60,200,0.14)', 'transparent']}
        style={{ position: 'absolute', top: 0, right: 0, width: width * 0.7, height: height * 0.35 }}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {stars.map((s, i) => (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.opacity} />
        ))}
      </Svg>
    </View>
  );
}
