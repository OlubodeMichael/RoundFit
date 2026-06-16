import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

// ── Icon weights (bold, big, clear outline icons) ────────────────────────────

const ICON_SIZE   = 22;
const ICON_STROKE = 2.4;

// ── Palette ──────────────────────────────────────────────────────────────────

export function useSettingsPalette() {
  const { isDark } = useTheme();
  return isDark
    ? {
        bg:     '#0A0B0F',
        card:   '#1C1D23',
        sunken: '#0E0F13',
        edge:   'rgba(255,255,255,0.08)',
        hair:   'rgba(255,255,255,0.06)',
        text:   '#F4F4F5',
        dim:    '#909096',
        faint:  '#505058',
        accent: '#F97316',
        isDark: true,
      }
    : {
        bg:     '#F2F2F6',
        card:   '#FFFFFF',
        sunken: '#F7F7F9',
        edge:   'rgba(0,0,0,0.06)',
        hair:   'rgba(0,0,0,0.05)',
        text:   '#09090B',
        dim:    '#6B7280',
        faint:  '#C0C0C8',
        accent: '#F97316',
        isDark: false,
      };
}

export type SettingsPalette = ReturnType<typeof useSettingsPalette>;

// ── Screen wrapper (back header + scroll) ────────────────────────────────────

export function SettingsScreen({
  title,
  eyebrow = 'PROFILE',
  subtitle,
  children,
}: {
  title:     string;
  eyebrow?:  string;
  subtitle?: string;
  children:  ReactNode;
}) {
  const P = useSettingsPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingBottom: 12 }}>
        <View style={s.header}>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: P.card, borderColor: P.edge }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={P.text} strokeWidth={2.6} />
          </TouchableOpacity>

          <Text style={[s.headerTitle, { color: P.text }]} numberOfLines={1}>{title}</Text>

          <View style={s.headerSpacer} />
        </View>

        {!!subtitle && <Text style={[s.headerSub, { color: P.dim }]}>{subtitle}</Text>}
      </View>

      {children}
    </ScrollView>
  );
}

// ── Section (label + grouped card) ───────────────────────────────────────────

export function Section({
  label,
  children,
  P,
  cardRadius,
}: {
  label?:      string;
  children:    ReactNode;
  P:           SettingsPalette;
  cardRadius?: number;
}) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 6 }}>
      {!!label && <Text style={[s.sectionLabel, { color: P.dim }]}>{label.toUpperCase()}</Text>}
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge, borderRadius: cardRadius ?? 16 }]}>
        {children}
      </View>
    </View>
  );
}

export function Divider({ P, inset = 64 }: { P: SettingsPalette; inset?: number }) {
  return <View style={[s.divider, { backgroundColor: P.hair, marginLeft: inset }]} />;
}

export function IconBox({ Icon, P, color }: { Icon: LucideIcon; P: SettingsPalette; color?: string }) {
  return (
    <View style={[s.iconBox, { backgroundColor: color ?? P.sunken, borderColor: color ?? P.edge }]}>
      <Icon size={ICON_SIZE} color={color ? '#FFFFFF' : P.text} strokeWidth={ICON_STROKE} />
    </View>
  );
}

// ── NavRow ───────────────────────────────────────────────────────────────────

export interface NavRowProps {
  icon:        LucideIcon;
  label:       string;
  value?:      string;
  sub?:        string;
  /** Icon accent + soft chip color. */
  color?:      string;
  /** Optional label color (e.g. destructive red). Defaults to neutral text. */
  labelColor?: string;
  P:           SettingsPalette;
  hideChevron?: boolean;
  onPress:     () => void;
}

export function NavRow({
  icon, label, value, sub, color, labelColor, P, hideChevron, onPress,
}: NavRowProps) {
  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress}>
      <IconBox Icon={icon} P={P} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: labelColor ?? P.text }]}>{label}</Text>
        {!!sub && <Text style={[s.rowSub, { color: P.dim }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {value != null && value !== '—' && (
        <Text style={[s.rowValue, { color: P.dim, marginRight: 6 }]}>{value}</Text>
      )}
      {!hideChevron && <ChevronRight size={18} color={P.faint} strokeWidth={2.4} />}
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 44,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerSpacer: { width: 38, height: 38 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 22, fontWeight: '700', letterSpacing: -0.4,
  },
  headerSub: {
    textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 8,
    paddingHorizontal: 20,
  },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, marginLeft: 4 },
  card: { borderWidth: 1, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  rowSub:   { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 14 },
});
