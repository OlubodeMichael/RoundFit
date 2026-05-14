import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Palette ────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark ? {
    bg:     '#0A0B0F',
    card:   '#1C1D23',
    sunken: '#0E0F13',
    edge:   'rgba(255,255,255,0.08)',
    hair:   'rgba(255,255,255,0.07)',
    hi:     '#F4F4F5',
    mid:    '#909096',
    faint:  '#505058',
    accent: '#F97316',
    isDark: true,
  } : {
    bg:     '#F2F2F6',
    card:   '#FFFFFF',
    sunken: '#F7F7F9',
    edge:   'rgba(0,0,0,0.06)',
    hair:   'rgba(0,0,0,0.06)',
    hi:     '#09090B',
    mid:    '#6B7280',
    faint:  '#C0C0C8',
    accent: '#F97316',
    isDark: false,
  };
}

type P = ReturnType<typeof usePalette>;

// ── Constants ──────────────────────────────────────────────────────────────

const PRIVACY_URL   = 'https://roundfit.co/privacy';
const TERMS_URL     = 'https://roundfit.co/terms';
const SUPPORT_EMAIL = 'support@roundfit.co';
const INSTAGRAM_URL = 'https://instagram.com/roundfit.co';

interface FaqItem {
  question: string;
  answer:   string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I log a meal?',
    answer:   'Go to the Log tab and tap on any meal slot (Breakfast, Lunch, Dinner, or Snack). You can enter food items manually with calories and macros, or use photo analysis to estimate nutrition from a picture of your meal.',
  },
  {
    question: 'How does calorie tracking work?',
    answer:   'RoundFit calculates your daily calorie target based on your age, weight, height, activity level, and fitness goal. As you log meals throughout the day, your remaining calories update in real time on the home dashboard.',
  },
  {
    question: 'How do I connect Apple Health?',
    answer:   'Go to your Profile and look for the Apple Health section. Tap "Connect" and grant the requested permissions. Once connected, RoundFit will automatically sync your steps, active calories, workouts, and sleep data.',
  },
  {
    question: 'How is my daily calorie target calculated?',
    answer:   'Your target is based on the Mifflin-St Jeor equation, which uses your age, sex, height, and weight to estimate your basal metabolic rate (BMR). This is then adjusted for your activity level and fitness goal (lose weight, build muscle, maintain, or boost energy).',
  },
  {
    question: 'How does sleep tracking work?',
    answer:   'You can manually log your bedtime and wake time in the Log tab under Sleep. If you have Apple Health connected with a compatible sleep tracker, RoundFit will also import your sleep stages (awake, light, deep, REM) automatically.',
  },
  {
    question: 'Can I edit or delete a logged entry?',
    answer:   'Yes. Tap on any logged meal, workout, or sleep entry to view its details. From there you can edit the values or delete the entry entirely. Changes are reflected immediately on your dashboard.',
  },
  {
    question: 'What do the cycle phases mean?',
    answer:   'Your menstrual cycle has four phases: Menstrual (period days — rest and gentle movement), Follicular (energy starts rising — great for new goals), Ovulation (peak strength and energy), and Luteal (wind down and prioritise recovery). RoundFit tracks these to give you phase-aware tips.',
  },
];

// ── Screen ─────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [expanded, setExpanded] = useState<number | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  function toggleFaq(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => (prev === index ? null : index));
  }

  function openEmail() {
    const subject = encodeURIComponent('RoundFit Support');
    const body    = encodeURIComponent(
      `\n\n---\nApp Version: ${appVersion}\nPlatform: ${Platform.OS} ${Platform.Version}`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={{
        paddingTop:    insets.top + 12,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: P.card, borderColor: P.edge }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color={P.hi} />
        </TouchableOpacity>

        <Text style={[s.eyebrow, { color: P.mid, marginTop: 20 }]}>SUPPORT</Text>
        <Text style={[s.title, { color: P.hi }]}>Help & Support</Text>
        <Text style={[s.titleSub, { color: P.mid }]}>
          Find answers, get in touch, or review our policies.
        </Text>
      </View>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <SectionLabel label="Common Questions" P={P} />
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge, marginHorizontal: 20 }]}>
        {FAQ_ITEMS.map((item, i) => (
          <View key={i}>
            {i > 0 && <View style={[s.divider, { backgroundColor: P.hair }]} />}
            <FaqRow
              item={item}
              open={expanded === i}
              onToggle={() => toggleFaq(i)}
              P={P}
            />
          </View>
        ))}
      </View>

      {/* ── Contact ────────────────────────────────────────────────── */}
      <SectionLabel label="Contact Us" P={P} />
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge, marginHorizontal: 20 }]}>
        <LinkRow
          icon="mail"
          iconBg="#F97316"
          label="Email Support"
          sub={SUPPORT_EMAIL}
          onPress={openEmail}
          P={P}
        />
        <View style={[s.divider, { backgroundColor: P.hair }]} />
        <LinkRow
          icon="logo-instagram"
          iconBg="#E1306C"
          label="Instagram"
          sub="@roundfit.co"
          onPress={() => Linking.openURL(INSTAGRAM_URL)}
          P={P}
          last
        />
      </View>

      {/* ── Legal ──────────────────────────────────────────────────── */}
      <SectionLabel label="Legal" P={P} />
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge, marginHorizontal: 20 }]}>
        <LinkRow
          icon="shield-checkmark"
          iconBg="#2DD4BF"
          label="Privacy Policy"
          onPress={() => Linking.openURL(PRIVACY_URL)}
          P={P}
        />
        <View style={[s.divider, { backgroundColor: P.hair }]} />
        <LinkRow
          icon="document-text"
          iconBg="#818CF8"
          label="Terms of Service"
          onPress={() => Linking.openURL(TERMS_URL)}
          P={P}
          last
        />
      </View>

      {/* ── App Info ───────────────────────────────────────────────── */}
      <SectionLabel label="About" P={P} />
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge, marginHorizontal: 20 }]}>
        <View style={s.infoRow}>
          <Text style={[s.infoLabel, { color: P.mid }]}>Version</Text>
          <Text style={[s.infoValue, { color: P.hi }]}>{appVersion}</Text>
        </View>
        <View style={[s.divider, { backgroundColor: P.hair }]} />
        <View style={s.infoRow}>
          <Text style={[s.infoLabel, { color: P.mid }]}>Platform</Text>
          <Text style={[s.infoValue, { color: P.hi }]}>
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} {Platform.Version}
          </Text>
        </View>
      </View>

      <Text style={[s.footer, { color: P.faint }]}>
        Made with care by the RoundFit team
      </Text>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ label, P }: { label: string; P: P }) {
  return (
    <Text style={[s.sectionLabel, { color: P.mid }]}>
      {label.toUpperCase()}
    </Text>
  );
}

function FaqRow({ item, open, onToggle, P }: {
  item:     FaqItem;
  open:     boolean;
  onToggle: () => void;
  P:        P;
}) {
  return (
    <TouchableOpacity
      style={s.faqRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={s.faqHeader}>
        <View style={[s.faqDot, { backgroundColor: open ? P.accent + '20' : P.sunken }]}>
          <Ionicons
            name="help"
            size={13}
            color={open ? P.accent : P.faint}
          />
        </View>
        <Text style={[s.faqQuestion, { color: P.hi, flex: 1 }]}>
          {item.question}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={P.faint}
        />
      </View>
      {open && (
        <Text style={[s.faqAnswer, { color: P.mid }]}>
          {item.answer}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface LinkRowProps {
  icon:    IoniconsName;
  iconBg:  string;
  label:   string;
  sub?:    string;
  onPress: () => void;
  P:       P;
  last?:   boolean;
}

function LinkRow({ icon, iconBg, label, sub, onPress, P }: LinkRowProps) {
  return (
    <TouchableOpacity
      style={s.linkRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={15} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.linkLabel, { color: P.hi }]}>{label}</Text>
        {sub && <Text style={[s.linkSub, { color: P.mid }]}>{sub}</Text>}
      </View>
      <Ionicons name="open-outline" size={14} color={P.faint} />
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backBtn: {
    width:          36,
    height:         36,
    borderRadius:   11,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize:       11,
    fontWeight:     '700',
    letterSpacing:  1.2,
  },
  title: {
    fontFamily:     'Syne_700Bold',
    fontSize:       28,
    letterSpacing:  -0.6,
    lineHeight:     32,
    marginTop:      4,
  },
  titleSub: {
    fontSize:   13,
    lineHeight: 19,
    marginTop:  6,
  },

  sectionLabel: {
    fontSize:        11,
    fontWeight:      '700',
    letterSpacing:   0.9,
    marginLeft:      24,
    marginTop:       20,
    marginBottom:    8,
  },

  card: {
    borderRadius: 16,
    borderWidth:  1,
    overflow:     'hidden',
  },
  divider: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 56,
  },

  // FAQ
  faqRow: {
    paddingHorizontal: 14,
    paddingVertical:   14,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  faqDot: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  faqQuestion: {
    fontSize:   14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  faqAnswer: {
    fontSize:     13,
    lineHeight:   20,
    marginTop:    10,
    marginLeft:   38,
    marginRight:  8,
  },

  // Link rows
  linkRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 14,
    paddingVertical:   14,
  },
  iconBox: {
    width:          32,
    height:         32,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
  linkLabel: {
    fontSize:   15,
    fontWeight: '500',
  },
  linkSub: {
    fontSize:  12,
    marginTop: 1,
  },

  // Info rows
  infoRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  infoLabel: {
    fontSize:   14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize:   14,
    fontWeight: '600',
  },

  footer: {
    textAlign:    'center',
    fontSize:     12,
    marginTop:    24,
    paddingBottom: 8,
  },
});
