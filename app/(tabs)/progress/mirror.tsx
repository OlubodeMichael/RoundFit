import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

export default function MirrorScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bg  = isDark ? '#0C0C0C' : '#F7F7F5';
  const hi  = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid = isDark ? '#888'    : '#888';

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={hi} />
      </TouchableOpacity>
      <Text style={[s.eyebrow, { color: mid }]}>Premium</Text>
      <Text style={[s.title, { color: hi }]}>30-Day Mirror</Text>
      <Text style={[s.sub, { color: mid }]}>
        Optimal sleep, optimal protein, best/worst training days, strongest correlation, and biggest improvement will live here.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: 20 },
  back:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 6 },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  title:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },
  sub:     { fontSize: 14, marginTop: 12, lineHeight: 20 },
});
