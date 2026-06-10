import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';

// ── Palette subset required by this card ─────────────────────────────────────
export interface CalorieBudgetPalette {
  card:         string;
  cardEdge:     string;
  sunken:       string;
  text:         string;
  textDim:      string;
  textFaint:    string;
  hair:         string;
  calories:     string;
  caloriesSoft: string;
  protein:      string;
  proteinSoft:  string;
  water:        string;
  waterSoft:    string;
  isDark:       boolean;
}

// Light palette — used by the auth screen preview
export const LIGHT_CALORIE_PALETTE: CalorieBudgetPalette = {
  card:         '#FFFFFF',
  cardEdge:     'rgba(15,23,42,0.06)',
  sunken:       '#F1F1F4',
  text:         '#09090B',
  textDim:      '#52525B',
  textFaint:    '#A1A1AA',
  hair:         'rgba(15,23,42,0.08)',
  calories:     '#EA580C',
  caloriesSoft: 'rgba(234,88,12,0.10)',
  protein:      '#10B981',
  proteinSoft:  'rgba(16,185,129,0.10)',
  water:        '#0EA5E9',
  waterSoft:    'rgba(14,165,233,0.10)',
  isDark:       false,
};

// ── Gauge constants (pre-computed at module level) ───────────────────────────
const SEMI_N  = 65;
const SEMI_D  = 280;
const SEMI_R  = 116;
const SEMI_TW = 2.5;
const SEMI_TH = 14;
const SEMI_CX = SEMI_D / 2;
const SEMI_CY = SEMI_D / 2;
const SEMI_VH = SEMI_CY + SEMI_TH / 2 + 10;

const GAUGE_TICKS = Array.from({ length: SEMI_N }).map((_, i) => {
  const deg = 180 + i * (180 / (SEMI_N - 1));
  const rad = (deg * Math.PI) / 180;
  return {
    x:   SEMI_CX + SEMI_R * Math.cos(rad),
    y:   SEMI_CY + SEMI_R * Math.sin(rad),
    rot: `${deg + 90}deg`,
  };
});

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// NOTE: the old "ACTIVITY BONUS +X cal" row was removed deliberately. The
// calorie budget is TDEE × activity multiplier + goal delta — daily activity
// is already priced in, and `remaining` (goal − eaten) never added the burn
// back. Showing active calories as "earned bonus" promised calories the math
// never granted (and double-counted activity for HealthKit users). Burn is
// surfaced honestly in the Burn metric card below this one.

// ── CalorieBudgetCard ─────────────────────────────────────────────────────────
export function CalorieBudgetCard({
  P,
  delay = 0,
  eaten,
  goal,
  remaining,
  dateLabel,
}: {
  P: CalorieBudgetPalette;
  delay?: number;
  eaten: number;
  goal: number;
  remaining: number;
  dateLabel?: string;
}) {
  const isOver   = eaten > goal;
  const eatenPct = Math.min(eaten / Math.max(goal, 1), 1);

  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const id = countAnim.addListener(({ value }) => setDisplayed(Math.round(value)));
    // Math.abs: when over budget the hero shows the overage ("300 over
    // budget"), not a clamped 0.
    Animated.timing(countAnim, { toValue: Math.abs(remaining), duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => countAnim.removeListener(id);
  }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillAnim = useRef(new Animated.Value(0)).current;
  const [gaugeProgress, setGaugeProgress] = useState(0);
  useEffect(() => {
    const id = fillAnim.addListener(({ value }) => setGaugeProgress(value));
    Animated.timing(fillAnim, { toValue: eatenPct, duration: 1300, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => fillAnim.removeListener(id);
  }, [eatenPct]); // eslint-disable-line react-hooks/exhaustive-deps

  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 620, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateY   = entrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const filledCount  = Math.round(gaugeProgress * SEMI_N);
  const trackColor   = P.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const centerY      = SEMI_VH - SEMI_CY;

  const now    = useMemo(() => new Date(), []);
  const stamp  = dateLabel ?? `${DAYS_SHORT[now.getDay()]}, ${MONTHS_SHORT[now.getMonth()]} ${now.getDate()}`;

  return (
    <Animated.View
      style={[
        hs.card,
        {
          backgroundColor: P.card,
          borderColor:     P.cardEdge,
          opacity:         entrance,
          transform:       [{ translateY }],
          shadowColor:     '#000',
          shadowOpacity:   P.isDark ? 0.35 : 0.07,
          shadowRadius:    P.isDark ? 18 : 14,
          shadowOffset:    { width: 0, height: 6 },
        },
      ]}
    >
      <View style={hs.body}>

        {/* Date + menu */}
        <View style={hs.topRow}>
          <Text style={[hs.dateLabel, { color: P.textFaint }]}>{stamp.toUpperCase()}</Text>
          <TouchableOpacity hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={16} color={P.textFaint} />
          </TouchableOpacity>
        </View>

        {/* Gauge */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: SEMI_D, height: SEMI_VH, overflow: 'hidden' }}>
            {GAUGE_TICKS.map(({ x, y, rot }, i) => (
              <View
                key={i}
                style={{
                  position:        'absolute',
                  width:           SEMI_TW,
                  height:          SEMI_TH,
                  borderRadius:    SEMI_TH / 2,
                  backgroundColor: i < filledCount ? P.calories : trackColor,
                  left:            x - SEMI_TW / 2,
                  top:             y - SEMI_TH / 2,
                  transform:       [{ rotate: rot }],
                }}
              />
            ))}
            <View style={{ position: 'absolute', bottom: centerY, left: 0, right: 0, alignItems: 'center' }}>
              <Ionicons name="flame" size={26} color={P.calories} />
              <Text style={[hs.heroNum, { color: isOver ? P.calories : P.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {displayed.toLocaleString()}
              </Text>
              <Text style={[hs.heroSub, { color: P.textFaint }]}>{isOver ? 'over budget' : 'remaining'}</Text>
            </View>
          </View>

          <View style={[hs.goalPill, { backgroundColor: P.caloriesSoft, marginTop: 10 }]}>
            <Text style={[hs.goalPillText, { color: P.calories }]}>{goal.toLocaleString()} daily goal</Text>
          </View>
        </View>

      </View>
    </Animated.View>
  );
}

const hs = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth:  StyleSheet.hairlineWidth,
    overflow:     'hidden',
    ...Platform.select({ android: { elevation: 3 } }),
  },
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dateLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  heroNum:      { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 62, lineHeight: 62, letterSpacing: -2, textAlign: 'center', marginTop: 2 },
  heroSub:      { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, textAlign: 'center', marginTop: 3 },
  goalPill:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  goalPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});
