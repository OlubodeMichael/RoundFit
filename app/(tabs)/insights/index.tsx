import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

const O = '#F97316';

export default function InsightsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bg      = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface = isDark ? '#161616' : '#FFFFFF';
  const hi      = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid     = isDark ? '#888'    : '#888';
  const lo      = isDark ? '#2A2A2A' : '#F0EDE8';

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
      <View>
        <Text style={[s.eyebrow, { color: mid }]}>Today</Text>
        <Text style={[s.pageTitle, { color: hi }]}>Insights</Text>
      </View>

      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <Text style={[s.cardTitle, { color: hi }]}>Today&apos;s insight</Text>
        <Text style={[s.cardSub, { color: mid }]}>
          Personalised insight card will appear here once data is wired up.
        </Text>
      </View>

      <TouchableOpacity
        style={[s.weeklyBtn, { backgroundColor: O }]}
        onPress={() => router.push('/(tabs)/insights/weekly')}
        activeOpacity={0.85}
      >
        <Ionicons name="calendar-outline" size={18} color="#FFF" />
        <Text style={s.weeklyBtnLabel}>View weekly report</Text>
      </TouchableOpacity>

      <Text style={[s.sectionTitle, { color: hi }]}>Past insights</Text>
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <Text style={[s.cardSub, { color: mid }]}>No past insights yet. Check back tomorrow.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  eyebrow:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  pageTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  card:      { borderRadius: 18, padding: 18, borderWidth: 1, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub:   { fontSize: 13, lineHeight: 19 },

  weeklyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  weeklyBtnLabel: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
