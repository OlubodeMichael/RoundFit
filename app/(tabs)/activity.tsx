import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useSteps } from '@/hooks/use-steps';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';
const O35 = 'rgba(249,115,22,0.35)';

const STEP_GOAL = 10_000;

const WORKOUTS = [
  { id: '1', name: 'Morning Run',  type: 'Outdoor Run', duration: '32 min', cals: 310, icon: 'walk-outline'    as IoniconsName },
  { id: '2', name: 'Upper Body',   type: 'Strength',    duration: '45 min', cals: 240, icon: 'barbell-outline' as IoniconsName },
];

export default function ActivityScreen() {
  const { isDark } = useTheme();
  const insets     = useSafeAreaInsets();
  const { days, todaySteps, weekTotal, isLoading, isConnected, refetch } = useSteps();

  const bg      = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface = isDark ? '#161616' : '#FFFFFF';
  const hi      = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid     = isDark ? '#888'    : '#888';
  const lo      = isDark ? '#2A2A2A' : '#F0EDE8';
  const green   = '#22C55E';
  const blue    = '#3B82F6';

  const stepProgress  = Math.min(todaySteps / STEP_GOAL, 1);
  const stepsLeft     = Math.max(STEP_GOAL - todaySteps, 0);
  const stepsDisplay  = isConnected ? todaySteps.toLocaleString() : '—';
  const barMax        = Math.max(...days.map(d => d.steps), STEP_GOAL, 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 20, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={[s.eyebrow, { color: mid }]}>Today</Text>
          <Text style={[s.pageTitle, { color: hi }]}>Activity</Text>
        </View>
        {isConnected && (
          <TouchableOpacity
            style={[s.syncBtn, { backgroundColor: O10, borderColor: O35 }]}
            onPress={refetch}
            activeOpacity={0.7}
          >
            <Ionicons name={isLoading ? 'sync-outline' : 'refresh-outline'} size={14} color={O} />
            <Text style={[s.syncLabel, { color: O }]}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ring stats row */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <RingStat label="Calories"  value="550"          unit="kcal"  icon="flame-outline"     color={O}     bg={O10}                           borderColor={O35}                    hi={hi} mid={mid} surface={surface} lo={lo} />
        <RingStat label="Steps"     value={stepsDisplay} unit="steps" icon="footsteps-outline" color={green} bg="rgba(34,197,94,0.10)"          borderColor="rgba(34,197,94,0.35)"   hi={hi} mid={mid} surface={surface} lo={lo} />
        <RingStat label="Active"    value="48"           unit="min"   icon="timer-outline"     color={blue}  bg="rgba(59,130,246,0.10)"         borderColor="rgba(59,130,246,0.35)"  hi={hi} mid={mid} surface={surface} lo={lo} />
      </View>

      {/* Step goal card */}
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={[s.cardLabel, { color: hi }]}>Step Goal</Text>
          <Text style={[s.cardSub, { color: mid }]}>
            {isConnected ? `${todaySteps.toLocaleString()} / ${STEP_GOAL.toLocaleString()}` : '— / 10,000'}
          </Text>
        </View>
        <View style={[s.track, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
          <View style={[s.fill, { width: `${Math.round(stepProgress * 100)}%`, backgroundColor: green }]} />
        </View>
        {isConnected
          ? <Text style={[s.trackNote, { color: mid }]}>
              {stepsLeft === 0
                ? 'Daily goal reached!'
                : `${stepsLeft.toLocaleString()} steps to your daily goal`}
            </Text>
          : <Text style={[s.trackNote, { color: mid }]}>Connect Apple Health to track steps</Text>
        }
      </View>

      {/* Weekly steps chart */}
      {Platform.OS === 'ios' && (
        <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={[s.cardLabel, { color: hi }]}>This Week</Text>
              {isConnected && (
                <Text style={[s.cardSub, { color: mid, marginTop: 2 }]}>
                  {weekTotal.toLocaleString()} total steps
                </Text>
              )}
            </View>
            {!isConnected && (
              <View style={[s.connectPill, { borderColor: O35, backgroundColor: O10 }]}>
                <Ionicons name="heart-outline" size={12} color={O} />
                <Text style={[s.connectPillText, { color: O }]}>Connect Health</Text>
              </View>
            )}
          </View>

          {isConnected && days.length > 0 ? (
            <View style={s.barChart}>
              {days.map((day) => {
                const pct   = day.steps / barMax;
                const color = day.isToday ? green : day.steps >= STEP_GOAL ? green : O;
                const alpha = day.isToday ? 1 : 0.55;
                return (
                  <View key={day.date} style={s.barCol}>
                    <Text style={[s.barSteps, { color: day.isToday ? green : mid }]}>
                      {day.steps > 0 ? (day.steps >= 1000 ? `${(day.steps / 1000).toFixed(1)}k` : `${day.steps}`) : ''}
                    </Text>
                    <View style={[s.barTrack, { backgroundColor: isDark ? '#2A2A2A' : '#F0EDE8' }]}>
                      <View
                        style={[
                          s.barFill,
                          {
                            height: `${Math.max(pct * 100, day.steps > 0 ? 4 : 0)}%`,
                            backgroundColor: color,
                            opacity: alpha,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.barLabel, { color: day.isToday ? green : mid, fontWeight: day.isToday ? '700' : '500' }]}>
                      {day.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.barChart}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <View key={d} style={s.barCol}>
                  <Text style={[s.barSteps, { color: 'transparent' }]}>0</Text>
                  <View style={[s.barTrack, { backgroundColor: isDark ? '#2A2A2A' : '#F0EDE8' }]}>
                    <View style={[s.barFill, { height: '0%', backgroundColor: green }]} />
                  </View>
                  <Text style={[s.barLabel, { color: mid }]}>{d}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Goal line label */}
          {isConnected && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <View style={{ width: 16, height: 1.5, backgroundColor: green, opacity: 0.5 }} />
              <Text style={{ fontSize: 11, color: mid }}>10,000 step goal</Text>
            </View>
          )}
        </View>
      )}

      {/* Heart rate */}
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.cardLabel, { color: hi }]}>Heart Rate</Text>
          <View style={[s.livePill, { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.3)' }]}>
            <View style={[s.liveDot, { backgroundColor: '#EF4444' }]} />
            <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>Live</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
          <Text style={[s.bigNum, { color: hi }]}>74</Text>
          <Text style={[s.bigNumUnit, { color: mid }]}>bpm</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
          <HRStat label="Resting" value="58 bpm"  color={mid}      textColor={hi} />
          <HRStat label="Peak"    value="142 bpm"  color="#EF4444"  textColor={hi} />
          <HRStat label="Zone"    value="Fat Burn" color={green}    textColor={hi} />
        </View>
      </View>

      {/* Workouts */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[s.sectionTitle, { color: hi }]}>Workouts</Text>
          <TouchableOpacity style={[s.logBtn, { backgroundColor: O }]}>
            <Ionicons name="add" size={14} color="#FFF" />
            <Text style={s.logBtnLabel}>Log</Text>
          </TouchableOpacity>
        </View>

        {WORKOUTS.map((w) => (
          <View key={w.id} style={[s.workoutRow, { backgroundColor: surface, borderColor: lo }]}>
            <View style={[s.workoutIcon, { backgroundColor: O10, borderColor: O20 }]}>
              <Ionicons name={w.icon} size={20} color={O} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.workoutName, { color: hi }]}>{w.name}</Text>
              <Text style={[s.workoutType, { color: mid }]}>{w.type}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={[s.workoutCals, { color: O }]}>{w.cals} cal</Text>
              <Text style={[s.workoutDur, { color: mid }]}>{w.duration}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function RingStat({ label, value, unit, icon, color, bg, borderColor, hi, mid, surface, lo }: {
  label: string; value: string; unit: string; icon: IoniconsName;
  color: string; bg: string; borderColor: string; hi: string; mid: string; surface: string; lo: string;
}) {
  return (
    <View style={[s.ringStat, { backgroundColor: surface, borderColor: lo }]}>
      <View style={[s.ringStatIcon, { backgroundColor: bg, borderColor }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.ringStatVal, { color: hi }]}>{value}</Text>
      <Text style={[s.ringStatUnit, { color: mid }]}>{unit}</Text>
      <Text style={[s.ringStatLabel, { color: mid }]}>{label}</Text>
    </View>
  );
}

function HRStat({ label, value, color, textColor }: { label: string; value: string; color: string; textColor: string }) {
  return (
    <View style={{ gap: 3 }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: textColor }}>{value}</Text>
      <Text style={{ fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  eyebrow:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  pageTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },

  syncBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  syncLabel: { fontSize: 12, fontWeight: '600' },

  ringStat:      { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 5, borderWidth: 1 },
  ringStatIcon:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 2 },
  ringStatVal:   { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  ringStatUnit:  { fontSize: 10, fontWeight: '600', marginTop: -3 },
  ringStatLabel: { fontSize: 11, fontWeight: '500' },

  card:      { borderRadius: 18, padding: 18, borderWidth: 1 },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  cardSub:   { fontSize: 13 },
  track:     { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill:      { height: 7, borderRadius: 4 },
  trackNote: { fontSize: 12, marginTop: 8 },

  connectPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  connectPillText: { fontSize: 11, fontWeight: '700' },

  // Weekly bar chart
  barChart: { flexDirection: 'row', height: 120, gap: 6, alignItems: 'flex-end' },
  barCol:   { flex: 1, alignItems: 'center', gap: 4 },
  barSteps: { fontSize: 9, fontWeight: '700', letterSpacing: -0.2 },
  barTrack: { flex: 1, width: '100%', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:  { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, letterSpacing: 0.2 },

  livePill:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  liveDot:    { width: 6, height: 6, borderRadius: 3 },
  bigNum:     { fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  bigNumUnit: { fontSize: 16, fontWeight: '600' },

  sectionTitle: { fontSize: 17, fontWeight: '700' },
  logBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  logBtnLabel:  { fontSize: 12, fontWeight: '700', color: '#FFF' },

  workoutRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  workoutIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  workoutName: { fontSize: 14, fontWeight: '700' },
  workoutType: { fontSize: 12, marginTop: 2 },
  workoutCals: { fontSize: 13, fontWeight: '700' },
  workoutDur:  { fontSize: 12 },
});
