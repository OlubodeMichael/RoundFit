import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── BurnCoachStrip ─────────────────────────────────────────────────────────
// Compact horizontal variant of the burn coach designed to slot *inside*
// another card — specifically the home hero so today's budget and today's
// coach share a single surface above the fold.
//
// It intentionally renders no outer card chrome: padding, radius and its own
// recessed background form a secondary "module" inside the host. Paired with
// `BurnCoachCard` for the full standalone prompt.
export type BurnCoachStripActivity = {
  /** The prescription line, e.g. "Walk 40 minutes". */
  label: string;
  icon?: IoniconName;
};

export type BurnCoachStripProps = {
  /** Remaining calorie burn to close the daily goal. */
  caloriesToBurn: number;
  /** Prescribed activity + duration (already formatted). */
  activity:       BurnCoachStripActivity;
  /** Burn progress toward the goal, 0…1. */
  goalProgress:   number;
  /** Pulsing green status pill. Defaults to true. */
  isLive?:        boolean;
  /** Opens the activity picker. Whole strip is pressable. */
  onPress?:       () => void;
};

export function BurnCoachStrip({
  caloriesToBurn,
  activity,
  goalProgress,
  isLive = true,
  onPress,
}: BurnCoachStripProps) {
  const P = usePalette();

  // Live-dot pulse — synced with the BurnCoachCard so both modules feel alive.
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

  // Progress bar fill animates on mount and when target changes.
  const target = Math.min(Math.max(goalProgress, 0), 1);
  const fill   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue:         target,
      duration:        900,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, target]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const pulseOpac  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const fillPct    = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const pct = Math.round(target * 100);

  // In dark mode use a surface that sits clearly above the page bg (#0A0B0F).
  // '#222328' is ~2 stops lighter than the card (#1C1D23) so the strip reads
  // as a recessed module inside the hero card without blending into either.
  const panelBg   = P.isDark ? '#222328' : '#1C1C1E';
  // Lifted from 0.08 → 0.12 so dividers and the chevron border are visible.
  const panelHair = P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.frame,
        { backgroundColor: panelBg },
        pressed && onPress && { opacity: 0.88 },
      ]}
    >
      {/* ── Header row ───────────────────────────────────────── */}
      <View style={styles.headerRow}>
        {isLive && (
          <View style={styles.livePill}>
            <View style={styles.liveDotWrap}>
              <Animated.View
                style={[
                  styles.liveDotPulse,
                  { backgroundColor: P.protein, transform: [{ scale: pulseScale }], opacity: pulseOpac },
                ]}
              />
              <View style={[styles.liveDot, { backgroundColor: P.protein }]} />
            </View>
            <Text style={[styles.liveText, { color: P.protein }]}>LIVE</Text>
          </View>
        )}
        <Text style={[styles.eyebrow, { color: 'rgba(255,255,255,0.80)' }]}>BURN COACH</Text>
        <View style={{ flex: 1 }} />
        {onPress && (
          <View style={[styles.chevCircle, { borderColor: panelHair }]}>
            <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.80)" />
          </View>
        )}
      </View>

      {/* ── Main row: icon tile + activity + calories ────────── */}
      <View style={styles.mainRow}>
        {/* Activity icon */}
        <View style={[styles.activityTile, { backgroundColor: P.calories }]}>
          {activity.icon && (
            <Ionicons name={activity.icon} size={24} color="#fff" />
          )}
        </View>

        {/* Activity label — immediately right of icon */}
        <View style={styles.moveBlock}>
          <Text style={[styles.moveEyebrow, { color: 'rgba(255,255,255,0.80)' }]}>YOUR MOVE</Text>
          <Text style={styles.moveLabel} numberOfLines={2}>
            {activity.label}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.vDivider, { backgroundColor: panelHair }]} />

        {/* Cal to burn — far right */}
        <View style={styles.calBlock}>
          <Text style={styles.calNum} numberOfLines={1}>
            {Math.round(caloriesToBurn).toLocaleString()}
          </Text>
          <Text style={[styles.calSub, { color: 'rgba(255,255,255,0.70)' }]}>cal to burn</Text>
        </View>
      </View>

      {/* ── Progress bar ─────────────────────────────────────── */}
      <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: P.calories, width: fillPct }]}
        />
        <Text style={[styles.pctLabel, { color: P.calories }]}>{pct}%</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderBottomLeftRadius:  24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop:   16,
    paddingBottom: 18,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  14,
  },
  livePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   'rgba(52,211,153,0.22)',
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      999,
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
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },
  chevCircle: {
    width:  28,
    height: 28,
    borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },

  mainRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    marginBottom:  16,
  },
  activityTile: {
    width:        52,
    height:       52,
    borderRadius: 16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  calBlock: {
    gap: 2,
    alignItems: 'flex-end',
  },
  calNum: {
    fontFamily:    'Syne_800ExtraBold',
    fontSize:      34,
    letterSpacing: -1.8,
    lineHeight:    36,
    color:         '#FFFFFF',
  },
  calSub: {
    fontSize:   11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  vDivider: {
    width:  StyleSheet.hairlineWidth,
    height: 36,
  },
  moveBlock: {
    flex: 1,
    gap:  4,
  },
  moveEyebrow: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  moveLabel: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
    color:         '#FFFFFF',
    lineHeight:    20,
  },

  track: {
    height:       6,
    borderRadius: 3,
    overflow:     'hidden',
    position:     'relative',
  },
  fill: {
    height:       '100%',
    borderRadius: 3,
  },
  pctLabel: {
    position:   'absolute',
    right:      0,
    top:        -18,
    fontSize:   10,
    fontWeight: '800',
  },
});
