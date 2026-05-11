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
  onPress?:       () => void;
};

export function BurnCoachStrip({
  activity,
  isLive = true,
  onPress,
}: BurnCoachStripProps) {
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

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const pulseOpac  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress && { opacity: 0.88 },
      ]}
    >
      {/* Left: activity icon tile */}
      <View style={styles.iconTile}>
        <Ionicons
          name={(activity.icon as IoniconName) ?? 'walk'}
          size={22}
          color="#fff"
        />
      </View>

      {/* Center: live label + suggestion text */}
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

      {/* Right: Start button */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.82 }]}
        hitSlop={6}
      >
        <Text style={styles.startText}>Start </Text>
        <Ionicons name="play" size={11} color="#fff" />
      </Pressable>
    </Pressable>
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
});
