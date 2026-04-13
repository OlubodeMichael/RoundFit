import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';
const O35 = 'rgba(249,115,22,0.35)';

export default function ProfileScreen() {
  const { isDark, preference, setTheme } = useTheme();
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
      {/* Avatar + name */}
      <View style={[s.profileCard, { backgroundColor: surface, borderColor: lo }]}>
        <View style={[s.avatar, { backgroundColor: O20, borderColor: O35 }]}>
          <Text style={[s.avatarLetter, { color: O }]}>M</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.profileName, { color: hi }]}>Michael Olubode</Text>
          <Text style={[s.profileEmail, { color: mid }]}>michael@calorefit.app</Text>
        </View>
        <TouchableOpacity style={[s.editBtn, { backgroundColor: O10, borderColor: O35 }]}>
          <Ionicons name="pencil-outline" size={15} color={O} />
        </TouchableOpacity>
      </View>

      {/* Goals */}
      <SectionHeader title="Goals" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <GoalRow icon="flame-outline"      label="Daily Calories"   value="2,100 kcal"  hi={hi} mid={mid} lo={lo} />
        <GoalRow icon="barbell-outline"    label="Protein Target"   value="140g"        hi={hi} mid={mid} lo={lo} />
        <GoalRow icon="scale-outline"      label="Goal Weight"      value="78 kg"       hi={hi} mid={mid} lo={lo} />
        <GoalRow icon="walk-outline"       label="Daily Steps"      value="10,000"      hi={hi} mid={mid} lo={lo} last />
      </View>

      {/* Notifications */}
      <SectionHeader title="Notifications" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <NotifRow label="Meal reminders"    sub="9:00 AM, 1:00 PM, 7:00 PM"  hi={hi} mid={mid} lo={lo} defaultOn />
        <NotifRow label="Daily summary"     sub="9:00 PM each evening"        hi={hi} mid={mid} lo={lo} defaultOn />
        <NotifRow label="Streak alerts"     sub="When streak is at risk"      hi={hi} mid={mid} lo={lo} defaultOn={false} last />
      </View>

      {/* Appearance */}
      <SectionHeader title="Appearance" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        {(['light', 'dark', 'system'] as const).map((p, i, arr) => (
          <TouchableOpacity
            key={p}
            onPress={() => setTheme(p)}
            style={[s.themeRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: lo }]}
          >
            <Ionicons
              name={p === 'light' ? 'sunny-outline' : p === 'dark' ? 'moon-outline' : 'settings-outline'}
              size={18}
              color={preference === p ? O : mid}
            />
            <Text style={[s.themeLabel, { color: preference === p ? O : hi }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
            {preference === p && (
              <Ionicons name="checkmark" size={16} color={O} style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Account */}
      <SectionHeader title="Account" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <ActionRow icon="lock-closed-outline"  label="Change Password"  hi={hi} mid={mid} lo={lo} />
        <ActionRow icon="cloud-upload-outline" label="Export Data"      hi={hi} mid={mid} lo={lo} />
        <ActionRow icon="help-circle-outline"  label="Help & Support"   hi={hi} mid={mid} lo={lo} />
        <ActionRow icon="log-out-outline"      label="Sign Out"         hi={hi} mid={mid} lo={lo} destructive last />
      </View>

      {/* Version */}
      <Text style={[s.version, { color: mid }]}>CaloreFit v1.0.0</Text>
    </ScrollView>
  );
}

function SectionHeader({ title, hi }: { title: string; hi: string }) {
  return <Text style={[s.sectionTitle, { color: hi }]}>{title}</Text>;
}

function GoalRow({ icon, label, value, hi, mid, lo, last }: { icon: IoniconsName; label: string; value: string; hi: string; mid: string; lo: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]}>
      <View style={[s.rowIcon, { backgroundColor: O10, borderColor: O20 }]}>
        <Ionicons name={icon} size={16} color={O} />
      </View>
      <Text style={[s.rowLabel, { color: hi }]}>{label}</Text>
      <Text style={[s.rowValue, { color: mid }]}>{value}</Text>
      <Ionicons name="chevron-forward" size={14} color={mid} />
    </View>
  );
}

function NotifRow({ label, sub, hi, mid, lo, defaultOn, last }: { label: string; sub: string; hi: string; mid: string; lo: string; defaultOn: boolean; last?: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: hi }]}>{label}</Text>
        <Text style={[{ fontSize: 11, marginTop: 2 }, { color: mid }]}>{sub}</Text>
      </View>
      <Switch
        value={defaultOn}
        onValueChange={() => {}}
        trackColor={{ false: lo, true: O35 }}
        thumbColor={defaultOn ? O : '#999'}
        ios_backgroundColor={lo}
      />
    </View>
  );
}

function ActionRow({ icon, label, hi, mid, lo, destructive, last }: { icon: IoniconsName; label: string; hi: string; mid: string; lo: string; destructive?: boolean; last?: boolean }) {
  const color = destructive ? '#EF4444' : hi;
  return (
    <TouchableOpacity style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={destructive ? '#EF4444' : mid} />
      <Text style={[s.rowLabel, { color, flex: 1 }]}>{label}</Text>
      {!destructive && <Ionicons name="chevron-forward" size={14} color={mid} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  profileCard:   { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16, borderWidth: 1 },
  avatar:        { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarLetter:  { fontSize: 22, fontWeight: '800' },
  profileName:   { fontSize: 16, fontWeight: '700' },
  profileEmail:  { fontSize: 13, marginTop: 2 },
  editBtn:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  sectionTitle:  { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -6 },

  card:   { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 13 },

  themeRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  themeLabel: { fontSize: 14, fontWeight: '600' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },

  version: { textAlign: 'center', fontSize: 12, marginTop: 4 },
});
