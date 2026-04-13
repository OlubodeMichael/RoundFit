import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Palette ──────────────────────────────────────────────────────────────────
const O = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';
const O35 = 'rgba(249,115,22,0.35)';

// ── Data (hardcoded) ──────────────────────────────────────────────────────────
const GOAL = 2100;
const EATEN = 1340;
const BURNED = 210;
const REMAINING = GOAL - EATEN + BURNED;

const MACROS = [
  { label: 'Protein', cur: 82,  goal: 140, color: O },
  { label: 'Carbs',   cur: 160, goal: 220, color: '#FB923C' },
  { label: 'Fat',     cur: 38,  goal: 65,  color: '#FDBA74' },
];

const MEALS = [
  { name: 'Oatmeal & Berries',      time: '8:12 AM',  cals: 320 },
  { name: 'Grilled Chicken Wrap',   time: '12:45 PM', cals: 510 },
  { name: 'Greek Yogurt + Granola', time: '3:30 PM',  cals: 150 },
];

// ── Ring helpers ──────────────────────────────────────────────────────────────
const RING = 180;
const THICKNESS = 14;
const INNER = RING - THICKNESS * 2;

/**
 * Pure-View donut ring using the two-half-clip technique.
 * Works without react-native-svg.
 */
function DonutRing({ progress, trackColor, fillColor, bgColor }: {
  progress: number;   // 0–1
  trackColor: string;
  fillColor: string;
  bgColor: string;
}) {
  const pct = Math.min(Math.max(progress, 0), 1);
  const deg = pct * 360;

  // We split into two 180° halves. Left half is always filled (if > 50%),
  // right half carries the partial fill.
  const rightDeg  = Math.min(deg, 180);
  const showLeft  = deg > 180;
  const leftDeg   = showLeft ? deg - 180 : 0;

  return (
    <View style={{ width: RING, height: RING }}>
      {/* Track */}
      <View style={[rs.ringBase, { borderColor: trackColor }]} />

      {/* Right half clip */}
      <View style={[rs.halfClip, rs.rightClip]}>
        <View style={[rs.halfFill, rs.rightFill, {
          borderColor: fillColor,
          transform: [{ rotate: `${rightDeg}deg` }],
        }]} />
      </View>

      {/* Left half clip — only shown when > 180° */}
      {showLeft && (
        <View style={[rs.halfClip, rs.leftClip]}>
          <View style={[rs.halfFill, rs.leftFill, {
            borderColor: fillColor,
            transform: [{ rotate: `${leftDeg}deg` }],
          }]} />
        </View>
      )}

      {/* Center hole */}
      <View style={[rs.centerHole, { backgroundColor: bgColor }]} />
    </View>
  );
}

const rs = StyleSheet.create({
  ringBase: {
    position: 'absolute',
    width: RING, height: RING,
    borderRadius: RING / 2,
    borderWidth: THICKNESS,
  },
  halfClip: {
    position: 'absolute',
    width: RING, height: RING,
    overflow: 'hidden',
  },
  rightClip: { left: RING / 2 },
  leftClip:  { right: RING / 2 },
  halfFill: {
    position: 'absolute',
    width: RING, height: RING,
    borderRadius: RING / 2,
    borderWidth: THICKNESS,
  },
  rightFill: { right: RING / 2 },
  leftFill:  { left: RING / 2 },
  centerHole: {
    position: 'absolute',
    top: THICKNESS, left: THICKNESS,
    width: INNER, height: INNER,
    borderRadius: INNER / 2,
  },
});

// ── Greeting ──────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function themeIconName(pref: string): IoniconsName {
  if (pref === 'light') return 'sunny-outline';
  if (pref === 'dark')  return 'moon-outline';
  return 'settings-outline';
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { isDark, preference, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const bg       = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface  = isDark ? '#161616' : '#FFFFFF';
  const surf2    = isDark ? '#1D1D1D' : '#F0EDE8';
  const hi       = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid      = isDark ? '#888'    : '#888';
  const lo       = isDark ? '#333'    : '#E8E4DF';
  const track    = isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.12)';

  const progress = EATEN / GOAL;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 48,
        paddingHorizontal: 20,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <View style={s.row}>
        <View style={{ gap: 3 }}>
          <Text style={[s.greet, { color: mid }]}>{greeting()}</Text>
          <Text style={[s.name, { color: hi }]}>Michael</Text>
        </View>

        <View style={s.row}>
          {/* Theme toggle */}
          <TouchableOpacity
            onPress={cycleTheme}
            style={[s.themePill, { backgroundColor: surf2, borderColor: lo }]}
            activeOpacity={0.7}
          >
            <Ionicons name={themeIconName(preference)} size={14} color={mid} />
            <Text style={[s.themePillLabel, { color: mid }]}>
              {preference === 'system' ? 'Auto' : preference === 'dark' ? 'Dark' : 'Light'}
            </Text>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={[s.avatar, { backgroundColor: O20, borderColor: O35 }]}>
            <Text style={[s.avatarLetter, { color: O }]}>M</Text>
          </View>
        </View>
      </View>

      {/* ── CALORIE RING CARD ───────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <Text style={[s.cardEyebrow, { color: mid }]}>Daily Calories</Text>

        {/* Ring + center text */}
        <View style={[s.row, { justifyContent: 'center', marginTop: 8 }]}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <DonutRing progress={progress} trackColor={track} fillColor={O} bgColor={bg} />

            {/* Center label overlay */}
            <View style={[s.ringCenter, { width: INNER, height: INNER }]}>
              <Text style={[s.ringNum, { color: hi }]}>{REMAINING}</Text>
              <Text style={[s.ringLabel, { color: mid }]}>remaining</Text>
            </View>
          </View>
        </View>

        {/* Stats trio */}
        <View style={[s.statRow, { borderTopColor: lo }]}>
          <StatCell label="Eaten"  value={EATEN.toLocaleString()}  textColor={hi} subColor={mid} />
          <View style={[s.divider, { backgroundColor: lo }]} />
          <StatCell label="Goal"   value={GOAL.toLocaleString()}   textColor={hi} subColor={mid} />
          <View style={[s.divider, { backgroundColor: lo }]} />
          <StatCell label="Burned" value={`+${BURNED}`}            textColor={hi} subColor={mid} />
        </View>
      </View>

      {/* ── MACROS ─────────────────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <Text style={[s.cardEyebrow, { color: mid }]}>Macronutrients</Text>
        <View style={{ gap: 18, marginTop: 4 }}>
          {MACROS.map((m) => {
            const pct = Math.min(m.cur / m.goal, 1);
            return (
              <View key={m.label} style={{ gap: 8 }}>
                <View style={s.row}>
                  <Text style={[s.macroName, { color: hi }]}>{m.label}</Text>
                  <Text style={[s.macroVal, { color: mid }]}>
                    <Text style={{ color: m.color, fontWeight: '700' }}>{m.cur}g</Text>
                    {'  /  '}{m.goal}g
                  </Text>
                </View>
                <View style={[s.track, { backgroundColor: O10 }]}>
                  <View style={[s.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── QUICK LOG ──────────────────────────────────────────────── */}
      <View style={s.quickRow}>
        {([
          { icon: 'restaurant-outline' as IoniconsName, label: 'Log Meal' },
          { icon: 'water-outline'      as IoniconsName, label: 'Water' },
          { icon: 'barbell-outline'    as IoniconsName, label: 'Exercise' },
        ]).map(({ icon, label }) => (
          <TouchableOpacity
            key={label}
            style={[s.quickCard, { backgroundColor: O10, borderColor: O20 }]}
            activeOpacity={0.7}
          >
            <Ionicons name={icon} size={26} color={O} />
            <Text style={[s.quickLabel, { color: hi }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── RECENT MEALS ───────────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <View style={[s.row, { marginBottom: 4 }]}>
          <Text style={[s.cardEyebrow, { color: mid }]}>Recent Meals</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[s.seeAll, { color: O }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {MEALS.map((meal, i) => (
          <View
            key={meal.name}
            style={[
              s.mealRow,
              i < MEALS.length - 1 && { borderBottomWidth: 1, borderBottomColor: lo },
            ]}
          >
            <View style={[s.mealDot, { backgroundColor: O20, borderColor: O35 }]}>
              <View style={[s.mealDotCore, { backgroundColor: O }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.mealName, { color: hi }]} numberOfLines={1}>{meal.name}</Text>
              <Text style={[s.mealTime, { color: mid }]}>{meal.time}</Text>
            </View>
            <View style={[s.calBadge, { backgroundColor: O10, borderColor: O35 }]}>
              <Text style={[s.calBadgeText, { color: O }]}>{meal.cals}</Text>
              <Text style={[s.calBadgeUnit, { color: O }]}> cal</Text>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCell({ label, value, textColor, subColor }: {
  label: string; value: string; textColor: string; subColor: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={[s.statVal, { color: textColor }]}>{value}</Text>
      <Text style={[s.statLabel, { color: subColor }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Header
  greet:      { fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },
  name:       { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  themePill:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, marginRight: 10,
  },
  themePillLabel: { fontSize: 12, fontWeight: '600' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  avatarLetter: { fontSize: 17, fontWeight: '800' },

  // Card
  card: {
    borderRadius: 20, padding: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    gap: 12,
  },
  cardEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },

  // Ring center overlay
  ringCenter: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  ringNum:   { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  ringLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Stat row
  statRow: {
    flexDirection: 'row', borderTopWidth: 1,
    paddingTop: 16, marginTop: 4,
  },
  divider:   { width: 1, height: 40, alignSelf: 'center' },
  accentDot: { width: 6, height: 6, borderRadius: 3 },
  statVal:   { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: '500' },

  // Macros
  macroName: { fontSize: 14, fontWeight: '600' },
  macroVal:  { fontSize: 13 },
  track:     { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill:      { height: 7, borderRadius: 4 },

  // Quick log
  quickRow:  { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', gap: 8, borderWidth: 1,
  },
  quickLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  // Meals
  seeAll:     { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  mealRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  mealDot:    {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  mealDotCore: { width: 10, height: 10, borderRadius: 5 },
  mealName:   { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  mealTime:   { fontSize: 12 },
  calBadge:   {
    flexDirection: 'row', alignItems: 'baseline',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  calBadgeText: { fontSize: 14, fontWeight: '800' },
  calBadgeUnit: { fontSize: 11, fontWeight: '600' },
});
