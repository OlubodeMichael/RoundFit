import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const O     = '#F97316';
const O10   = 'rgba(249,115,22,0.10)';
const O20   = 'rgba(249,115,22,0.20)';
const O35   = 'rgba(249,115,22,0.35)';

const MEALS = [
  { id: '1', meal: 'Breakfast', name: 'Oatmeal & Berries',      cals: 320, protein: 12, carbs: 54, fat: 6,  time: '8:12 AM' },
  { id: '2', meal: 'Lunch',     name: 'Grilled Chicken Wrap',   cals: 510, protein: 38, carbs: 42, fat: 14, time: '12:45 PM' },
  { id: '3', meal: 'Snack',     name: 'Greek Yogurt + Granola', cals: 150, protein: 10, carbs: 18, fat: 4,  time: '3:30 PM' },
];

const MEAL_CALS  = MEALS.reduce((s, m) => s + m.cals, 0);
const MEAL_GOAL  = 2100;
const REMAINING  = MEAL_GOAL - MEAL_CALS;

export default function LogScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bg      = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface = isDark ? '#161616' : '#FFFFFF';
  const hi      = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid     = isDark ? '#888'    : '#888';
  const lo      = isDark ? '#2A2A2A' : '#F0EDE8';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 20, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View>
        <Text style={[s.eyebrow, { color: mid }]}>Today</Text>
        <Text style={[s.pageTitle, { color: hi }]}>Food Log</Text>
      </View>

      {/* Calorie summary strip */}
      <View style={[s.strip, { backgroundColor: surface, borderColor: lo }]}>
        <StripStat label="Eaten"     value={`${MEAL_CALS}`}  color={O}         textColor={hi} sub={mid} />
        <View style={[s.stripDiv, { backgroundColor: lo }]} />
        <StripStat label="Remaining" value={`${REMAINING}`}  color="#22C55E"   textColor={hi} sub={mid} />
        <View style={[s.stripDiv, { backgroundColor: lo }]} />
        <StripStat label="Goal"      value={`${MEAL_GOAL}`}  color={mid}       textColor={hi} sub={mid} />
      </View>

      {/* Add buttons */}
      <View style={s.addRow}>
        <AddButton icon="camera-outline"  label="Photo"  bg={O} onPress={() => {}} />
        <AddButton icon="search-outline"  label="Search" bg={isDark ? '#1D1D1D' : '#ECEAE6'} onPress={() => {}} textColor={hi} />
        <AddButton icon="barcode-outline" label="Scan"   bg={isDark ? '#1D1D1D' : '#ECEAE6'} onPress={() => {}} textColor={hi} />
      </View>

      {/* Meals list */}
      {MEALS.map((item, i) => (
        <View key={item.id} style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
          <View style={s.mealHeader}>
            <View>
              <Text style={[s.mealTag, { color: O }]}>{item.meal}</Text>
              <Text style={[s.mealName, { color: hi }]}>{item.name}</Text>
              <Text style={[s.mealTime, { color: mid }]}>{item.time}</Text>
            </View>
            <View style={[s.calPill, { backgroundColor: O10, borderColor: O35 }]}>
              <Text style={[s.calPillNum, { color: O }]}>{item.cals}</Text>
              <Text style={[s.calPillUnit, { color: O }]}> cal</Text>
            </View>
          </View>

          <View style={[s.macroRow, { borderTopColor: lo }]}>
            <MacroChip label="P" value={`${item.protein}g`} color={O} bg={O10} />
            <MacroChip label="C" value={`${item.carbs}g`}   color="#FB923C" bg="rgba(251,146,60,0.10)" />
            <MacroChip label="F" value={`${item.fat}g`}     color="#FDBA74" bg="rgba(253,186,116,0.10)" />
            <TouchableOpacity style={s.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={mid} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Add meal CTA */}
      <TouchableOpacity style={[s.addMealBtn, { borderColor: O35, backgroundColor: O10 }]} activeOpacity={0.75}>
        <Ionicons name="add-circle-outline" size={20} color={O} />
        <Text style={[s.addMealLabel, { color: O }]}>Add another meal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StripStat({ label, value, color, textColor, sub }: { label: string; value: string; color: string; textColor: string; sub: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={[s.stripVal, { color: textColor }]}>{value}</Text>
      <Text style={[s.stripLabel, { color: sub }]}>{label}</Text>
      <View style={[s.stripDot, { backgroundColor: color }]} />
    </View>
  );
}

function AddButton({ icon, label, bg, onPress, textColor }: { icon: IoniconsName; label: string; bg: string; onPress: () => void; textColor?: string }) {
  const labelColor = textColor ?? '#FFF';
  const iconColor  = textColor ?? '#FFF';
  return (
    <TouchableOpacity style={[s.addBtn, { backgroundColor: bg }]} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={[s.addBtnLabel, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MacroChip({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipLabel, { color }]}>{label}</Text>
      <Text style={[s.chipVal, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  pageTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },

  strip:    { flexDirection: 'row', borderRadius: 16, padding: 16, borderWidth: 1 },
  stripDiv: { width: 1, height: 36, alignSelf: 'center' },
  stripVal: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  stripLabel: { fontSize: 11, fontWeight: '500' },
  stripDot: { width: 5, height: 5, borderRadius: 3 },

  addRow:  { flexDirection: 'row', gap: 10 },
  addBtn:  { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6 },
  addBtnLabel: { fontSize: 12, fontWeight: '700' },

  card: { borderRadius: 18, padding: 16, borderWidth: 1, gap: 12 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mealTag:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  mealName:   { fontSize: 15, fontWeight: '700' },
  mealTime:   { fontSize: 12, marginTop: 2 },
  calPill:    { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  calPillNum: { fontSize: 15, fontWeight: '800' },
  calPillUnit:{ fontSize: 11, fontWeight: '600' },

  macroRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 12 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  chipLabel: { fontSize: 11, fontWeight: '700' },
  chipVal:   { fontSize: 11, fontWeight: '600' },
  deleteBtn: { marginLeft: 'auto' },

  addMealBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed' },
  addMealLabel: { fontSize: 14, fontWeight: '700' },
});
