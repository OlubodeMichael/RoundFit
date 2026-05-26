import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type Tile = {
  id:    string;
  icon:  IoniconsName;
  label: string;
  desc:  string;
};

interface Props {
  tiles:    Tile[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Delay before the first card animates in (ms). Defaults to 150. */
  baseDelay?: number;
}

const HI   = '#111111';
const MID  = '#888';
const LO   = '#E8E3DC';
const SURF = '#FFFFFF';
const ICON_IDLE_BG = 'rgba(249,115,22,0.12)';

export function TileGrid({ tiles, selected, onSelect, baseDelay = 150 }: Props) {
  const fades = useRef(tiles.map(() => new Animated.Value(0))).current;
  const ys    = useRef(tiles.map(() => new Animated.Value(28))).current;

  useEffect(() => {
    fades.forEach((f, i) => {
      Animated.parallel([
        Animated.timing(f,     { toValue: 1, duration: 400, delay: baseDelay + i * 80, useNativeDriver: true }),
        Animated.timing(ys[i], { toValue: 0, duration: 360, delay: baseDelay + i * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.grid}>
      {tiles.map((t, i) => {
        const active = selected === t.id;
        return (
          <Animated.View
            key={t.id}
            style={[s.wrapper, { opacity: fades[i], transform: [{ translateY: ys[i] }] }]}
          >
            <TouchableOpacity
              style={[s.card, active && s.cardActive]}
              onPress={() => onSelect(t.id)}
              activeOpacity={0.82}
            >
              {active && (
                <View style={s.checkBadge}>
                  <Ionicons name="checkmark" size={11} color="#FFF" />
                </View>
              )}
              <View style={[s.iconWrap, active ? s.iconWrapActive : s.iconWrapIdle]}>
                <Ionicons name={t.icon} size={22} color="#F97316" />
              </View>
              <Text style={[s.label, active && s.labelActive]}>{t.label}</Text>
              <Text style={[s.desc,  active && s.descActive]}>{t.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  wrapper: { width: '47%' },

  card: {
    backgroundColor: SURF,
    borderRadius:    20,
    padding:         18,
    gap:             10,
    minHeight:       160,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     '#EBEBEB',
  },
  cardActive: {
    backgroundColor: HI,
    borderColor:     HI,
  },

  checkBadge: {
    position:        'absolute',
    top:             12,
    right:           12,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: '#F97316',
    alignItems:      'center',
    justifyContent:  'center',
  },

  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapIdle:   { backgroundColor: ICON_IDLE_BG },
  iconWrapActive: { backgroundColor: '#2A2A2A' },

  label:       { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: HI },
  labelActive: { color: '#FFFFFF' },

  desc:       { fontSize: 13, lineHeight: 18, fontWeight: '400', color: MID },
  descActive: { color: '#888888' },
});
