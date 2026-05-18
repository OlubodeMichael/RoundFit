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
  textFaint:    string;
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
  textFaint:    '#A1A1AA',
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

// ── EarnedBonusRow ────────────────────────────────────────────────────────────
function EarnedBonusRow({ P, earnedFromActivity }: { P: CalorieBudgetPalette; earnedFromActivity: number }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slideY      = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.30, 0.65] });
  const rightBg     = P.isDark ? 'rgba(52,211,153,0.16)' : 'rgba(16,185,129,0.12)';

  return (
    <Animated.View style={[es.wrap, { opacity: slideAnim, transform: [{ translateY: slideY }], marginTop: 16 }]}>
      <View style={[es.left, { backgroundColor: P.sunken }]}>
        <View style={[es.badge, { borderColor: P.protein, backgroundColor: P.proteinSoft }]}>
          <Ionicons name="flash" size={14} color={P.protein} />
        </View>
        <View style={es.leftLabels}>
          <Text style={[es.eyebrow, { color: P.textFaint }]}>ACTIVITY</Text>
          <Text style={[es.bonusWord, { color: P.text }]}>BONUS</Text>
        </View>
      </View>
      <View pointerEvents="none" style={[es.diagonal, { backgroundColor: P.card }]} />
      <View style={[es.right, { backgroundColor: rightBg, overflow: 'hidden' }]}>
        <Animated.View style={[es.glowOrb, { backgroundColor: P.protein, opacity: glowOpacity }]} />
        <Animated.Text style={[es.bigNum, { color: P.isDark ? '#FFFFFF' : P.protein, transform: [{ scale: scaleAnim }] }]}>
          +{earnedFromActivity.toLocaleString()}
        </Animated.Text>
        <Text style={[es.calWord, { color: P.isDark ? 'rgba(255,255,255,0.60)' : '#52525B' }]}>cal</Text>
      </View>
    </Animated.View>
  );
}

const es = StyleSheet.create({
  wrap:       { height: 66, borderRadius: 16, overflow: 'hidden', flexDirection: 'row' },
  left:       { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 10 },
  badge:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  leftLabels: { gap: 1 },
  eyebrow:    { fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  bonusWord:  { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  diagonal:   { position: 'absolute', width: 26, height: 140, top: -37, right: 118, zIndex: 1, transform: [{ rotate: '7deg' }] },
  right:      { width: 132, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingRight: 16, gap: 4 },
  glowOrb:    { position: 'absolute', width: 90, height: 90, borderRadius: 45, right: 0 },
  bigNum:     { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 38, lineHeight: 40, letterSpacing: -1.5 },
  calWord:    { fontSize: 13, fontWeight: '700', marginTop: 7, letterSpacing: 0.2 },
});

// ── CalorieBudgetCard ─────────────────────────────────────────────────────────
export function CalorieBudgetCard({
  P,
  delay = 0,
  eaten,
  goal,
  burned,
  stepsToday,
  remaining,
  earnedFromActivity = 0,
  dateLabel,
}: {
  P: CalorieBudgetPalette;
  delay?: number;
  eaten: number;
  goal: number;
  burned: number;
  stepsToday?: number;
  remaining: number;
  earnedFromActivity?: number;
  dateLabel?: string;
}) {
  const isOver   = eaten > goal;
  const eatenPct = Math.min(eaten / Math.max(goal, 1), 1);

  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const id = countAnim.addListener(({ value }) => setDisplayed(Math.round(value)));
    Animated.timing(countAnim, { toValue: Math.max(remaining, 0), duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
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

        {earnedFromActivity > 0 && <EarnedBonusRow P={P} earnedFromActivity={earnedFromActivity} />}

        {/* Stats */}
        <View style={[hs.statsPanel, { backgroundColor: P.sunken, marginTop: 14, marginBottom: 14 }]}>
          <View style={hs.statsRow}>

            <View style={hs.statCell}>
              <View style={[hs.statIcon, { backgroundColor: P.proteinSoft }]}>
                <Ionicons name="restaurant" size={14} color={P.protein} />
              </View>
              <View>
                <Text style={[hs.statNum, { color: P.text }]}>{eaten.toLocaleString()}</Text>
                <Text style={[hs.statLbl, { color: P.textFaint }]}>eaten</Text>
              </View>
            </View>

            <View style={hs.statCell}>
              <View style={[hs.statIcon, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name="flame" size={14} color={P.calories} />
              </View>
              <View>
                <Text style={[hs.statNum, { color: P.text }]}>{burned.toLocaleString()}</Text>
                <Text style={[hs.statLbl, { color: P.textFaint }]}>burned</Text>
              </View>
            </View>

            {stepsToday !== undefined ? (
              <View style={hs.statCell}>
                <View style={[hs.statIcon, { backgroundColor: P.waterSoft }]}>
                  <Ionicons name="footsteps" size={14} color={P.water} />
                </View>
                <View>
                  <Text style={[hs.statNum, { color: P.text }]}>{stepsToday.toLocaleString()}</Text>
                  <Text style={[hs.statLbl, { color: P.textFaint }]}>steps</Text>
                </View>
              </View>
            ) : (
              <View style={hs.statCell}>
                <View style={[hs.statIcon, { backgroundColor: isOver ? P.caloriesSoft : P.waterSoft }]}>
                  <Ionicons name="trending-up" size={14} color={isOver ? P.calories : P.water} />
                </View>
                <View>
                  <Text style={[hs.statNum, { color: P.text }]}>{(eaten - burned).toLocaleString()}</Text>
                  <Text style={[hs.statLbl, { color: P.textFaint }]}>net</Text>
                </View>
              </View>
            )}

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
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dateLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  heroNum:      { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 62, lineHeight: 62, letterSpacing: -2, textAlign: 'center', marginTop: 2 },
  heroSub:      { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, textAlign: 'center', marginTop: 3 },
  goalPill:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  goalPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  statsPanel:   { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  statsRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statCell:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statNum:      { fontSize: 16, fontWeight: '800', letterSpacing: -0.5, lineHeight: 18 },
  statLbl:      { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});
