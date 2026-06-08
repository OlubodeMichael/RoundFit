import { useEffect, useId, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {
  buildWaterBodyPath,
  fillLevelY,
  JAR_CLIP_PATH,
  JAR_INTERIOR_BOTTOM_Y,
  JAR_LID_PATH,
  JAR_OUTLINE_PATH,
  JAR_DISPLAY_SCALE_COMPACT,
  JAR_DISPLAY_SCALE_DEFAULT,
  JAR_VIEW_H,
  JAR_VIEW_W,
} from '@/components/log/water-jar-paths';
import { usePalette } from '@/lib/log-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useWaterSlosh } from '@/hooks/use-water-slosh';

const WAVE_AMP = 3.8;

export interface WaterJarVisualProps {
  progress: number;
  isComplete: boolean;
  bumpToken?: number;
  scale?: number;
}

export function WaterJarVisual({
  progress,
  isComplete,
  bumpToken = 0,
  scale = JAR_DISPLAY_SCALE_DEFAULT,
}: WaterJarVisualProps) {
  const P = usePalette();
  const reduceMotion = useReduceMotion();
  const clipId = useId().replace(/:/g, '');
  const fillGradId = useId().replace(/:/g, '');

  const hasWater = progress > 0.01;
  const sloshActive = !reduceMotion && hasWater;
  const { tiltX, wavePhase } = useWaterSlosh(sloshActive);

  const fillAnim = useRef(new Animated.Value(progress)).current;
  const bumpAnim = useRef(new Animated.Value(1)).current;
  const [renderProgress, setRenderProgress] = useState(progress);

  const displayW = JAR_VIEW_W * scale;
  const displayH = JAR_VIEW_H * scale;

  useEffect(() => {
    const target = Math.min(Math.max(progress, 0), 1);
    if (reduceMotion) {
      fillAnim.setValue(target);
      setRenderProgress(target);
      return;
    }
    Animated.spring(fillAnim, {
      toValue: target,
      friction: 10,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [progress, fillAnim, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const id = fillAnim.addListener(({ value }) => setRenderProgress(value));
    return () => fillAnim.removeListener(id);
  }, [fillAnim, reduceMotion]);

  useEffect(() => {
    if (bumpToken === 0 || reduceMotion) return;
    bumpAnim.setValue(1);
    Animated.sequence([
      Animated.spring(bumpAnim, { toValue: 1.04, friction: 4, useNativeDriver: true }),
      Animated.spring(bumpAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [bumpToken, bumpAnim, reduceMotion]);

  const level = Math.min(Math.max(renderProgress, 0), 1);
  const currentFillY = fillLevelY(level);
  const waterPath =
    level > 0.005
      ? buildWaterBodyPath(currentFillY, sloshActive ? wavePhase : 0, WAVE_AMP)
      : '';

  const fillStops = isComplete
    ? P.isDark
      ? [
          { offset: '0%', color: '#065F46' },
          { offset: '55%', color: '#059669' },
          { offset: '100%', color: '#34D399' },
        ]
      : [
          { offset: '0%', color: '#A7F3D0' },
          { offset: '55%', color: '#34D399' },
          { offset: '100%', color: '#10B981' },
        ]
    : P.isDark
      ? [
          { offset: '0%', color: '#0C4A6E' },
          { offset: '50%', color: '#0284C7' },
          { offset: '100%', color: '#38BDF8' },
        ]
      : [
          { offset: '0%', color: '#E0F2FE' },
          { offset: '50%', color: '#7DD3FC' },
          { offset: '100%', color: '#0EA5E9' },
        ];

  const glassStroke = P.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.14)';
  const glassFill = P.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)';
  const lidFill = P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(241,245,249,0.95)';

  return (
    <Animated.View style={[s.jarWrap, { transform: [{ scale: bumpAnim }] }]}>
      <Svg width={displayW} height={displayH} viewBox={`0 0 ${JAR_VIEW_W} ${JAR_VIEW_H}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={JAR_CLIP_PATH} />
          </ClipPath>
          <LinearGradient
            id={fillGradId}
            x1="0"
            y1={String(JAR_INTERIOR_BOTTOM_Y)}
            x2="0"
            y2="24"
          >
            {fillStops.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </LinearGradient>
        </Defs>

        <Path d={JAR_CLIP_PATH} fill={P.isDark ? '#0E1218' : '#F8FAFC'} />

        {waterPath ? (
          <G clipPath={`url(#${clipId})`}>
            <G transform={`translate(${sloshActive ? tiltX.toFixed(1) : 0}, 0)`}>
              <Path d={waterPath} fill={`url(#${fillGradId})`} />
            </G>
          </G>
        ) : null}

        <Path d={JAR_OUTLINE_PATH} fill={glassFill} stroke={glassStroke} strokeWidth={1.8} />
        <Path d={JAR_LID_PATH} fill={lidFill} stroke={glassStroke} strokeWidth={1.2} />
        <Path
          d="M 28 52 C 26 90 24 130 26 168"
          stroke={P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)'}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  jarWrap: {
    alignSelf: 'center',
    alignItems: 'center',
  },
});
