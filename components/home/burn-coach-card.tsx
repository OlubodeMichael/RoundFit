import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── BurnCoachCard ──────────────────────────────────────────────────────────
// Home-screen prompt that appears when the user is trailing their calorie-burn
// target for the day. Surfaces the remaining deficit as a hero number and
// prescribes a concrete activity to close the gap.
//
// Designed to be reusable: every piece of copy + data is driven from props,
// palette colours come from the shared theme, and staggered entrance matches
// the rest of the home stack via `delay`.
//
// Visibility is the caller's responsibility — pass the component only when
// the user still has a deficit.
export type BurnCoachActivity = {
  label:     string;           // "Walk 40 minutes"
  icon?:     IoniconName;      // defaults to "arrow-forward"
  eyebrow?:  string;           // "Your move" — short caption above the label
};

export type BurnCoachCardProps = {
  /** Calories still to burn to hit today's goal. */
  caloriesToBurn:  number;
  /** Prescribed activity to close the gap. */
  activity:        BurnCoachActivity;
  /** Progress toward the burn goal as 0…1. */
  goalProgress:    number;
  /** Small eyebrow text. Defaults to "Today's coach". */
  eyebrow?:        string;
  /** Show a pulsing green "Live" pill. Defaults to true. */
  isLive?:         boolean;
  /** Staggered entrance delay (ms). */
  delay?:          number;
  /** Primary press target (e.g. open a details sheet or start the activity). */
  onPress?:        () => void;
  /** Secondary action — e.g. dismiss or pick another activity. */
  onActivityPress?:() => void;
};

export function BurnCoachCard({
  caloriesToBurn,
  activity,
  goalProgress,
  eyebrow = "Today's coach",
  isLive = true,
  delay = 0,
  onPress,
  onActivityPress,
}: BurnCoachCardProps) {
  const P = usePalette();

  // Entrance: fade + translate-Y to match AnimatedCard cadence.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue:        1,
      duration:       620,
      delay,
      easing:         Easing.out(Easing.cubic),
      useNativeDriver:true,
    }).start();
  }, [enter, delay]);

  // Live dot pulse — softly breathing to suggest real-time status.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulse]);

  // Progress bar fills to its target over ~900ms on mount.
  const target = Math.min(Math.max(goalProgress, 0), 1);
  const fill   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue:         target,
      duration:        900,
      delay:           delay + 200,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, target, delay]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const pulseOpac  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const fillPct    = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const pct = Math.round(target * 100);

  const CardOuter: any = onPress ? Pressable : View;
  const outerProps     = onPress
    ? { onPress, style: ({ pressed }: { pressed: boolean }) => [pressed && { opacity: 0.96, transform: [{ scale: 0.995 }] }] }
    : {};

  return (
    <Animated.View
      style={{
        opacity:    enter,
        transform:  [{ translateY }],
      }}
    >
      <CardOuter {...outerProps}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: P.card,
              borderColor:     P.cardEdge,
              shadowOpacity:   P.isDark ? 0.35 : 0.06,
              shadowRadius:    P.isDark ? 18 : 12,
            },
          ]}
        >
          {/* Ambient glow behind the hero number */}
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                backgroundColor: P.caloriesSoft,
                opacity:         P.isDark ? 0.75 : 1,
              },
            ]}
          />

          {/* ── Top row: eyebrow + live pill ─────────────────── */}
          <View style={styles.topRow}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>
              {eyebrow.toUpperCase()}
            </Text>

            {isLive && (
              <View style={[styles.livePill, { backgroundColor: P.proteinSoft }]}>
                <View style={styles.liveDotWrap}>
                  <Animated.View
                    style={[
                      styles.liveDotPulse,
                      { backgroundColor: P.protein, transform: [{ scale: pulseScale }], opacity: pulseOpac },
                    ]}
                  />
                  <View style={[styles.liveDot, { backgroundColor: P.protein }]} />
                </View>
                <Text style={[styles.liveText, { color: P.protein }]}>Live</Text>
              </View>
            )}
          </View>

          {/* ── Hero number ──────────────────────────────────── */}
          <View style={styles.heroBlock}>
            <Text style={[styles.heroLead, { color: P.textDim }]}>
              You need to burn
            </Text>
            <Text
              style={[styles.heroNum, { color: P.calories }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {Math.round(caloriesToBurn).toLocaleString()}
            </Text>
            <Text style={[styles.heroUnit, { color: P.textDim }]}>calories</Text>
          </View>

          {/* ── Divider ──────────────────────────────────────── */}
          <View style={[styles.divider, { backgroundColor: P.hair }]} />

          {/* ── Activity prescription ─────────────────────────── */}
          <Pressable
            onPress={onActivityPress}
            disabled={!onActivityPress}
            style={({ pressed }) => [
              styles.moveRow,
              pressed && onActivityPress && { opacity: 0.85 },
            ]}
            hitSlop={8}
          >
            <View style={[styles.moveIcon, { backgroundColor: P.caloriesSoft }]}>
              <Ionicons
                name={activity.icon ?? 'arrow-forward'}
                size={18}
                color={P.calories}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.moveEyebrow, { color: P.textFaint }]}>
                {(activity.eyebrow ?? 'Your move').toUpperCase()}
              </Text>
              <Text style={[styles.moveLabel, { color: P.text }]} numberOfLines={2}>
                {activity.label}
              </Text>
            </View>
            {onActivityPress && (
              <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
            )}
          </Pressable>

          {/* ── Progress strip ───────────────────────────────── */}
          <View style={styles.progressHead}>
            <Text style={[styles.progressLabel, { color: P.textDim }]}>
              Daily goal
            </Text>
            <Text style={[styles.progressValue, { color: P.calories }]}>
              {pct}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: P.sunken }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: P.calories, width: fillPct },
              ]}
            />
          </View>
        </View>
      </CardOuter>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:    24,
    borderWidth:     StyleSheet.hairlineWidth,
    padding:         22,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 6 },
    ...Platform.select({ android: { elevation: 2 } }),
  },

  glow: {
    position:     'absolute',
    top:          -100,
    right:        -100,
    width:        280,
    height:       280,
    borderRadius: 140,
  },

  // ── Top row
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  14,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.6,
  },
  livePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      999,
    marginLeft:        'auto',
  },
  liveDotWrap: {
    width:  8,
    height: 8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  liveDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  liveDotPulse: {
    position:     'absolute',
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  liveText: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 0.2,
  },

  // ── Hero
  heroBlock: {
    alignItems:   'center',
    marginTop:    6,
    marginBottom: 18,
  },
  heroLead: {
    fontSize:      13,
    fontWeight:    '600',
    letterSpacing: -0.1,
    marginBottom:  2,
  },
  heroNum: {
    fontFamily:    'Syne_800ExtraBold',
    fontSize:      88,
    letterSpacing: -4.5,
    lineHeight:    92,
    textAlign:     'center',
  },
  heroUnit: {
    fontSize:      14,
    fontWeight:    '600',
    letterSpacing: -0.1,
    marginTop:     -2,
  },

  // ── Divider
  divider: {
    height:       StyleSheet.hairlineWidth,
    marginBottom: 16,
  },

  // ── Move row
  moveRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    marginBottom:  18,
  },
  moveIcon: {
    width:          44,
    height:         44,
    borderRadius:   22,
    alignItems:     'center',
    justifyContent: 'center',
  },
  moveEyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.2,
    marginBottom:  3,
  },
  moveLabel: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.4,
    lineHeight:    23,
  },

  // ── Progress
  progressHead: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   8,
  },
  progressLabel: {
    fontSize:   12,
    fontWeight: '600',
  },
  progressValue: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  progressTrack: {
    height:       8,
    borderRadius: 4,
    overflow:     'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 4,
  },
});
