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

const ACCENT  = '#F97316';
const HI      = '#111111';
const MID     = '#888';
const LO      = '#E8E3DC';
const SURF    = '#FFFFFF';
const ACCENT_BG      = 'rgba(249,115,22,0.08)';
const ACCENT_ICON_BG = 'rgba(249,115,22,0.12)';
const ICON_IDLE_BG   = '#F2EFE9';

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
              style={[s.card, {
                backgroundColor: active ? ACCENT_BG : SURF,
                borderColor:     active ? ACCENT    : LO,
                borderLeftWidth: active ? 4 : 1,
                borderWidth:     1,
              }]}
              onPress={() => onSelect(t.id)}
              activeOpacity={0.8}
            >
              <View style={[s.iconWrap, { backgroundColor: active ? ACCENT_ICON_BG : ICON_IDLE_BG }]}>
                <Ionicons name={t.icon} size={22} color={active ? ACCENT : MID} />
              </View>
              <Text style={[s.label, { color: active ? ACCENT : HI }]}>{t.label}</Text>
              <Text style={[s.desc, { color: MID }]}>{t.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  wrapper: { width: '47%' },
  card: {
    borderRadius: 16,
    padding:      18,
    gap:          10,
    minHeight:    140,
    overflow:     'hidden',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  desc:  { fontSize: 12, lineHeight: 17, fontWeight: '400' },
});
