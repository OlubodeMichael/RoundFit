import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { usePalette } from '@/lib/log-theme';

const ARC_START = 225;
const ARC_TOTAL = 270;
const ARC_MS = 2400;
const CENTER_MS = 900;
const CENTER_DELAY = 400;

function degToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = deg * (Math.PI / 180);
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, spanDeg: number): string {
  if (spanDeg <= 0) return '';
  const s = degToXY(cx, cy, r, startDeg);
  const e = degToXY(cx, cy, r, startDeg + spanDeg);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${spanDeg > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export interface RecoveryArcGaugeProps {
  score: number | null;
  gaugeLabel: string;
  tint: string;
  size: number;
  delta?: number | null;
}

export function RecoveryArcGauge({ score, gaugeLabel, tint, size, delta }: RecoveryArcGaugeProps) {
  const P = usePalette();
  const progress = useRef(new Animated.Value(0)).current;
  const centerFade = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.85)).current;
  // Tip ripple: scale and opacity for the expanding pulse ring
  const tipRippleScale = useRef(new Animated.Value(1)).current;
  const tipRippleOpacity = useRef(new Animated.Value(0)).current;

  const [filledSpan, setFilledSpan] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [showTip, setShowTip] = useState(false);

  const SW = Math.max(11, size * 0.054);
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - SW / 2 - 2;
  const height = Math.round(size * 0.78);

  const trackClr  = P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const tipDeg    = ARC_START + filledSpan;
  const tip       = degToXY(cx, cy, r, tipDeg);
  const tipDotR   = SW / 2 + 3;
  const gradientId     = 'recovery-arc-glow';
  const arcGradientId  = 'recovery-arc-fill';

  const runAnimation = useCallback(() => {
    const target = score ?? 0;
    progress.stopAnimation();
    centerFade.setValue(0);
    setShowTip(false);

    const listenerId = progress.addListener(({ value }) => {
      const span = Math.max(value > 0 ? 4 : 0, (value / 100) * ARC_TOTAL);
      setFilledSpan(span);
      setDisplayScore(Math.round(value));
      setShowTip(value > 0.5);
    });

    Animated.parallel([
      Animated.timing(progress, {
        toValue:         target,
        duration:        ARC_MS,
        easing:          Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(centerFade, {
        toValue:         1,
        duration:        CENTER_MS,
        delay:           CENTER_DELAY,
        easing:          Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) progress.removeListener(listenerId);
    });

    return () => progress.removeListener(listenerId);
  }, [score, progress, centerFade]);

  useEffect(() => {
    const cleanup = runAnimation();
    return cleanup;
  }, [runAnimation]);

  // Dark mode: subtle opacity glow pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue:         1,
          duration:        3600,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue:         0.88,
          duration:        3600,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowPulse]);

  // Light mode: expanding ripple ring at the arc tip
  useEffect(() => {
    if (P.isDark) return;

    const ripple = Animated.loop(
      Animated.sequence([
        // pause before each ripple
        Animated.delay(1800),
        Animated.parallel([
          Animated.timing(tipRippleScale, {
            toValue:         2.8,
            duration:        900,
            easing:          Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(tipRippleOpacity, {
              toValue:         0.65,
              duration:        80,
              useNativeDriver: true,
            }),
            Animated.timing(tipRippleOpacity, {
              toValue:         0,
              duration:        820,
              easing:          Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
        // reset scale instantly
        Animated.timing(tipRippleScale, {
          toValue:         1,
          duration:        0,
          useNativeDriver: true,
        }),
      ]),
    );
    ripple.start();
    return () => ripple.stop();
  }, [P.isDark, tipRippleScale, tipRippleOpacity]);

  const centerStyle = {
    opacity: centerFade,
    transform: [{
      scale: centerFade.interpolate({
        inputRange:  [0, 1],
        outputRange: [0.96, 1],
      }),
    }],
  };

  // Tip ripple: absolute positioned View that scales from the tip dot position
  const rippleSize = tipDotR * 2;

  return (
    <View style={{ width: size, height, overflow: 'hidden' }}>
      <Animated.View style={{ opacity: glowPulse }}>
        <Svg width={size} height={size} style={styles.svg}>
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={tint} stopOpacity={P.isDark ? 0.28 : 0.14} />
              <Stop offset="70%"  stopColor={tint} stopOpacity={P.isDark ? 0.07 : 0.04} />
              <Stop offset="100%" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={arcGradientId} x1="0%" y1="100%" x2="100%" y2="15%">
              <Stop offset="0%"   stopColor={tint} stopOpacity={0.18} />
              <Stop offset="45%"  stopColor={tint} stopOpacity={0.72} />
              <Stop offset="100%" stopColor={tint} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={r * 0.8} fill={`url(#${gradientId})`} />
          <Path
            d={arcPath(cx, cy, r, ARC_START, ARC_TOTAL)}
            stroke={trackClr}
            strokeWidth={SW}
            strokeLinecap="round"
            fill="none"
          />
          {filledSpan > 0 && (
            <Path
              d={arcPath(cx, cy, r, ARC_START, filledSpan)}
              stroke={`url(#${arcGradientId})`}
              strokeWidth={SW}
              strokeLinecap="round"
              fill="none"
            />
          )}
          {showTip && filledSpan > 0 && (
            <Circle cx={tip.x} cy={tip.y} r={tipDotR} fill="#ffffff" />
          )}
        </Svg>
      </Animated.View>

      {/* Tip ripple — only visible on light theme, positioned at tip dot */}
      {!P.isDark && showTip && filledSpan > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tipRipple,
            {
              width:        rippleSize,
              height:       rippleSize,
              borderRadius: rippleSize / 2,
              borderColor:  tint,
              left:         tip.x - rippleSize / 2,
              top:          tip.y - rippleSize / 2,
              opacity:      tipRippleOpacity,
              transform:    [{ scale: tipRippleScale }],
            },
          ]}
        />
      )}

      <Animated.View style={[StyleSheet.absoluteFill, styles.center, centerStyle]}>
        {gaugeLabel.length > 0 && (
          <Text style={[styles.label, { color: tint }]}>{gaugeLabel}</Text>
        )}
        <Text style={[styles.score, { color: P.text }]}>
          {score !== null ? displayScore : '—'}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.of, { color: P.textFaint }]}>recovery score</Text>
          {delta != null && (
            <Text style={[styles.delta, { color: delta >= 0 ? tint : P.calories }]}>
              {delta >= 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  tipRipple: {
    position:    'absolute',
    borderWidth: 2,
  },
  center: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 2,
    marginBottom:  2,
  },
  score: {
    fontFamily:    'Syne_700Bold',
    fontSize:      64,
    fontWeight:    '800',
    letterSpacing: -2.5,
    lineHeight:    66,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginTop:     1,
  },
  of: {
    fontSize:   12,
    fontWeight: '600',
  },
  delta: {
    fontSize:   11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
