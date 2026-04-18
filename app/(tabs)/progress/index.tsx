import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';
const O35 = 'rgba(249,115,22,0.35)';

const WEEK = [
  { day: 'M', cals: 1980 },
  { day: 'T', cals: 2200 },
  { day: 'W', cals: 1750 },
  { day: 'T', cals: 2050 },
  { day: 'F', cals: 1900 },
  { day: 'S', cals: 2310 },
  { day: 'S', cals: 1340 },
];
const MAX_CALS = Math.max(...WEEK.map(d => d.cals));
const GOAL     = 2100;

const WEIGHT_LOG = [
  { date: 'Apr 6',  kg: 82.4 },
  { date: 'Apr 7',  kg: 82.1 },
  { date: 'Apr 8',  kg: 81.9 },
  { date: 'Apr 9',  kg: 82.0 },
  { date: 'Apr 10', kg: 81.7 },
  { date: 'Apr 11', kg: 81.5 },
  { date: 'Apr 12', kg: 81.3 },
];

export default function ProgressScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bg      = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface = isDark ? '#161616' : '#FFFFFF';
  const hi      = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid     = isDark ? '#888'    : '#888';
  const lo      = isDark ? '#2A2A2A' : '#F0EDE8';
  const green   = '#22C55E';

  const weightMin = Math.min(...WEIGHT_LOG.map(d => d.kg));
  const weightMax = Math.max(...WEIGHT_LOG.map(d => d.kg));
  const weightRange = weightMax - weightMin || 1;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 20, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={[s.eyebrow, { color: mid }]}>This Week</Text>
        <Text style={[s.pageTitle, { color: hi }]}>Progress</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[s.scoreCard, { backgroundColor: O, flex: 1 }]}>
          <Ionicons name="flame" size={22} color="rgba(255,255,255,0.9)" />
          <Text style={s.scoreNum}>12</Text>
          <Text style={s.scoreLabel}>Day Streak</Text>
        </View>
        <View style={[s.scoreCard, { backgroundColor: surface, borderColor: lo, borderWidth: 1, flex: 1 }]}>
          <Ionicons name="star-outline" size={22} color={O} />
          <Text style={[s.scoreNum, { color: hi }]}>84</Text>
          <Text style={[s.scoreLabel, { color: mid }]}>Weekly Score</Text>
        </View>
        <View style={[s.scoreCard, { backgroundColor: surface, borderColor: lo, borderWidth: 1, flex: 1 }]}>
          <Ionicons name="trophy-outline" size={22} color="#FBBF24" />
          <Text style={[s.scoreNum, { color: hi }]}>5</Text>
          <Text style={[s.scoreLabel, { color: mid }]}>Goals Met</Text>
        </View>
      </View>

      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={[s.cardTitle, { color: hi }]}>Calories This Week</Text>
          <Text style={[s.cardSub, { color: mid }]}>Avg 2,047</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <View style={[s.dash, { backgroundColor: O35 }]} />
          <Text style={[{ fontSize: 10, color: mid, fontWeight: '600' }]}>Goal {GOAL}</Text>
        </View>

        <View style={s.barChart}>
          {WEEK.map((d, i) => {
            const pct       = d.cals / MAX_CALS;
            const goalPct   = GOAL  / MAX_CALS;
            const isToday   = i === WEEK.length - 1;
            const overGoal  = d.cals > GOAL;
            const barColor  = isToday ? O : overGoal ? '#EF4444' : green;
            return (
              <View key={i} style={s.barCol}>
                <View style={s.barWrap}>
                  <View style={[s.goalLine, { bottom: `${goalPct * 100}%`, borderColor: O35 }]} />
                  <View style={[s.bar, { height: `${pct * 100}%`, backgroundColor: barColor, opacity: isToday ? 1 : 0.7 }]} />
                </View>
                <Text style={[s.barDay, { color: isToday ? O : mid, fontWeight: isToday ? '700' : '500' }]}>{d.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[s.card, { backgroundColor: surface, borderColor: lo }]}
        activeOpacity={0.75}
        onPress={() => router.push('/(tabs)/progress/weight')}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[s.cardTitle, { color: hi }]}>Weight</Text>
          <View style={[s.trendPill, { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.3)' }]}>
            <Ionicons name="trending-down-outline" size={12} color={green} />
            <Text style={[s.trendLabel, { color: green }]}>−1.1 kg</Text>
          </View>
        </View>

        <View style={s.dotChart}>
          {WEIGHT_LOG.map((w, i) => {
            const normalized = (w.kg - weightMin) / weightRange;
            const bottom = 8 + normalized * 44;
            return (
              <View key={i} style={[s.dotCol, { justifyContent: 'flex-end' }]}>
                <View style={[s.dotPoint, {
                  marginBottom: bottom,
                  backgroundColor: i === WEIGHT_LOG.length - 1 ? O : mid,
                  width: i === WEIGHT_LOG.length - 1 ? 10 : 7,
                  height: i === WEIGHT_LOG.length - 1 ? 10 : 7,
                  borderRadius: 5,
                }]} />
                <Text style={[s.dotDate, { color: mid }]}>{w.date.split(' ')[1]}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text style={[s.weightNum, { color: hi }]}>81.3 <Text style={[s.weightUnit, { color: mid }]}>kg</Text></Text>
            <Text style={[s.weightNote, { color: mid }]}>Current</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.weightNum, { color: hi }]}>78.0 <Text style={[s.weightUnit, { color: mid }]}>kg</Text></Text>
            <Text style={[s.weightNote, { color: mid }]}>Goal</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.card, { backgroundColor: O10, borderColor: O35 }]}
        activeOpacity={0.8}
        onPress={() => router.push('/(tabs)/progress/mirror')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[s.predIcon, { backgroundColor: O20 }]}>
            <Ionicons name="analytics-outline" size={20} color={O} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.predTitle, { color: hi }]}>30-day mirror</Text>
            <Text style={[s.predSub, { color: mid }]}>Premium report of your habits, correlations, and biggest wins.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={mid} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  eyebrow:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  pageTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },

  scoreCard:  { borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  scoreNum:   { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  scoreLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  card:      { borderRadius: 18, padding: 18, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub:   { fontSize: 12 },
  dash:      { flex: 1, height: 1, borderStyle: 'dashed' },

  barChart: { flexDirection: 'row', height: 110, gap: 6, alignItems: 'flex-end' },
  barCol:   { flex: 1, alignItems: 'center', gap: 6 },
  barWrap:  { flex: 1, width: '100%', justifyContent: 'flex-end', position: 'relative' },
  bar:      { width: '100%', borderRadius: 4, minHeight: 4 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  barDay:   { fontSize: 11 },

  trendPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  trendLabel: { fontSize: 11, fontWeight: '700' },

  dotChart: { flexDirection: 'row', height: 70, alignItems: 'flex-end', gap: 4 },
  dotCol:   { flex: 1, alignItems: 'center', height: 70 },
  dotPoint: { position: 'absolute' },
  dotDate:  { fontSize: 9, fontWeight: '500', position: 'absolute', bottom: 0 },

  weightNum:  { fontSize: 22, fontWeight: '800' },
  weightUnit: { fontSize: 14, fontWeight: '500' },
  weightNote: { fontSize: 11, marginTop: 2 },

  predIcon:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  predTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  predSub:   { fontSize: 13, lineHeight: 18 },
});
