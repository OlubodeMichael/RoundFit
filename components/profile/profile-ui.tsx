import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconBox, type SettingsPalette } from '@/components/profile/settings-ui';

// ── Header ────────────────────────────────────────────────────────────────────

/** Circular header button (back / sign out). */
export function HeaderButton({
  P, icon: Icon, color, onPress, accessibilityLabel,
}: {
  P:                   SettingsPalette;
  icon:                LucideIcon;
  color?:              string;
  onPress:             () => void;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      style={[s.headerBtn, { backgroundColor: P.card, borderColor: P.edge }]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Icon size={20} color={color ?? P.text} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

/** Centered title with optional left/right slots. Slots keep the title centered. */
export function ProfileHeader({
  P, title, left, right,
}: {
  P:      SettingsPalette;
  title:  string;
  left?:  ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={s.header}>
      <View style={s.headerSlot}>{left}</View>
      <Text style={[s.headerTitle, { color: P.text }]}>{title}</Text>
      <View style={[s.headerSlot, s.headerSlotRight]}>{right}</View>
    </View>
  );
}

// ── Group (Title-Case header + grouped card) ──────────────────────────────────

export function ProfileGroup({
  P, title, action, children,
}: {
  P:        SettingsPalette;
  title:    string;
  action?:  ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={s.group}>
      <View style={s.groupHeader}>
        <Text style={[s.groupTitle, { color: P.dim }]}>{title}</Text>
        {action}
      </View>
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge }]}>
        {children}
      </View>
    </View>
  );
}

// ── Row (plain inline icon + label + optional value + chevron) ────────────────

export function ProfileRow({
  P, icon: Icon, label, value, onPress, color, hideChevron, bold, filled,
}: {
  P:            SettingsPalette;
  icon:         LucideIcon;
  label:        string;
  value?:       string;
  onPress:      () => void;
  /** Tints the icon + label (e.g. destructive red). Defaults to neutral text. */
  color?:       string;
  hideChevron?: boolean;
  /** Emphasise the label (e.g. Log Out / Delete Account). */
  bold?:        boolean;
  /** Render the icon inside a filled color chip (e.g. Log Out / Delete Account). */
  filled?:      boolean;
}) {
  const tint = color ?? P.text;
  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress}>
      {filled ? (
        <IconBox Icon={Icon} P={P} color={tint} />
      ) : (
        <Icon size={20} color={tint} strokeWidth={2.1} />
      )}
      <Text style={[s.rowLabel, { color: tint }, bold && s.rowLabelBold]}>{label}</Text>
      {!!value && <Text style={[s.rowValue, { color: P.dim }]}>{value}</Text>}
      {!hideChevron && <ChevronRight size={18} color={P.faint} strokeWidth={2.4} />}
    </TouchableOpacity>
  );
}

export function ProfileDivider({ P }: { P: SettingsPalette }) {
  return <View style={[s.divider, { backgroundColor: P.hair }]} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 44,
  },
  headerSlot: { width: 38, alignItems: 'flex-start' },
  headerSlotRight: { alignItems: 'flex-end' },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },

  // Group
  group: { paddingHorizontal: 20, marginTop: 18 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500', letterSpacing: -0.2 },
  rowLabelBold: { fontWeight: '700' },
  rowValue: { fontSize: 15, marginRight: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
});
