import { useEffect, useRef, useState } from 'react';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type BurnCoachStripActivity = {
  label: string;
  icon?: IoniconName;
};

export type BurnCoachStripProps = {
  caloriesToBurn: number;
  activity:       BurnCoachStripActivity;
  goalProgress:   number;
  isLive?:        boolean;
  /** When set, the strip swaps to an "in progress" state showing live timer + End button. */
  activeStartedAt?: number | null;
  activeCaloriesBurned?: number;
  /** Tap the activity area (icon + label) to change the activity (opens picker). */
  onPress?:       () => void;
  /** Tap the Start button — fires the live workout immediately. */
  onStart?:       () => void;
  onEnd?:         () => void;
};

function formatElapsed(ms: number): string {
  const sec   = Math.max(0, Math.floor(ms / 1000));
  const h     = Math.floor(sec / 3600);
  const m     = Math.floor((sec % 3600) / 60);
  const s     = sec % 60;
  const pad   = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function BurnCoachStrip({
  activity,
  isLive = true,
  activeStartedAt = null,
  activeCaloriesBurned = 0,
  onPress,
  onStart,
  onEnd,
}: BurnCoachStripProps) {
  const inProgress = activeStartedAt != null;

  // Local ticker for the elapsed timer — only runs while in progress
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!inProgress || activeStartedAt == null) return;
    const tick = () => setElapsed(Date.now() - activeStartedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [inProgress, activeStartedAt]);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isLive && !inProgress) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, inProgress, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const pulseOpac  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  // ─── In-progress state: timer + calories + End button ────────────────────
  if (inProgress) {
    return (
      <View style={[styles.card, { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(249,115,22,0.35)' }]}>
        <View style={styles.iconTile}>
          <Ionicons
            name={(activity.icon as IoniconName) ?? 'walk'}
            size={22}
            color="#fff"
          />
        </View>

        <View style={styles.center}>
          <View style={styles.liveRow}>
            <View style={styles.liveDotWrap}>
              <Animated.View
                style={[
                  styles.liveDotPulse,
                  { transform: [{ scale: pulseScale }], opacity: pulseOpac, backgroundColor: ORANGE },
                ]}
              />
              <View style={[styles.liveDot, { backgroundColor: ORANGE }]} />
            </View>
            <Text style={[styles.liveLabel, { color: 'rgba(255,255,255,0.85)' }]}>
              {activity.label.toUpperCase()}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.calorieText}>
              {Math.round(activeCaloriesBurned)} kcal
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onEnd}
          style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.82 }]}
          hitSlop={6}
        >
          <Ionicons name="stop" size={11} color="#fff" />
          <Text style={styles.endText}> End</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Idle state: suggestion + Start button ───────────────────────────────
  return (
    <View style={styles.card}>
      {/* Activity area — tap to change activity (opens picker) */}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
          pressed && onPress && { opacity: 0.7 },
        ]}
      >
        <View style={styles.iconTile}>
          <Ionicons
            name={(activity.icon as IoniconName) ?? 'walk'}
            size={22}
            color="#fff"
          />
        </View>

        <View style={styles.center}>
          <View style={styles.liveRow}>
            {isLive && (
              <View style={styles.liveDotWrap}>
                <Animated.View
                  style={[
                    styles.liveDotPulse,
                    { transform: [{ scale: pulseScale }], opacity: pulseOpac },
                  ]}
                />
                <View style={styles.liveDot} />
              </View>
            )}
            <Text style={styles.liveLabel}>
              {isLive ? 'LIVE · ' : ''}BURN COACH
            </Text>
          </View>
          <Text style={styles.suggestion} numberOfLines={1}>
            {activity.label}
          </Text>
        </View>
      </Pressable>

      {/* Start button — fires the live workout immediately */}
      <Pressable
        onPress={onStart ?? onPress}
        style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.82 }]}
        hitSlop={10}
      >
        <Text style={styles.startText}>Start </Text>
        <Ionicons name="play" size={11} color="#fff" />
      </Pressable>
    </View>
  );
}

const ORANGE = '#F97316';
const GREEN  = '#34D399';

const styles = StyleSheet.create({
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: '#111113',
    borderRadius:    22,
    paddingVertical:  14,
    paddingLeft:      14,
    paddingRight:     12,
    gap:              12,
  },

  iconTile: {
    width:          46,
    height:         46,
    borderRadius:   14,
    backgroundColor: ORANGE,
    alignItems:     'center',
    justifyContent: 'center',
  },

  center: {
    flex: 1,
    gap:  4,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  liveDotWrap: {
    width:          8,
    height:         8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  liveDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: GREEN,
  },
  liveDotPulse: {
    position:        'absolute',
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: GREEN,
  },
  liveLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.2,
    color:         'rgba(255,255,255,0.65)',
  },
  suggestion: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
    color:         '#fff',
    lineHeight:    20,
  },

  startBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   ORANGE,
    borderRadius:      999,
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  startText: {
    fontSize:   14,
    fontWeight: '800',
    color:      '#fff',
  },

  // In-progress state
  timerText: {
    fontSize:        18,
    fontWeight:      '800',
    color:           '#fff',
    fontVariant:     ['tabular-nums'],
    letterSpacing:   -0.3,
  },
  calorieText: {
    fontSize:    12,
    fontWeight:  '700',
    color:       ORANGE,
  },
  endBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#27272A',
    borderRadius:      999,
    paddingHorizontal: 14,
    paddingVertical:   10,
  },
  endText: {
    fontSize:   14,
    fontWeight: '800',
    color:      '#fff',
  },
});
