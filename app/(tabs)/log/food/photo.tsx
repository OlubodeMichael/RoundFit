import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AnimatedCard,
  PrimaryButton,
  ScreenHeader,
  Tip,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';

export default function PhotoAnalysisScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="AI detect" title="Photo" accent={P.calories} />

        {/* ── Camera hero ─────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedCard delay={60} padding={0}>
            <View style={[styles.viewfinder, { backgroundColor: P.sunken }]}>
              <View style={[styles.plate, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                <View style={[styles.plateInner, { backgroundColor: P.caloriesSoft }]}>
                  <Ionicons name="restaurant" size={34} color={P.calories} />
                </View>
              </View>

              <View style={[styles.corner, styles.cornerTL, { borderColor: P.calories }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: P.calories }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: P.calories }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: P.calories }]} />

              <View style={[styles.aiBadge, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name="sparkles" size={11} color={P.calories} />
                <Text style={[styles.aiBadgeText, { color: P.calories }]}>
                  AI DETECT
                </Text>
              </View>
            </View>
          </AnimatedCard>
        </View>

        {/* ── How it works ────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <Text style={[styles.sectionLabel, { color: P.textFaint }]}>
              HOW IT WORKS
            </Text>
            <View style={{ gap: 14, marginTop: 14 }}>
              <Step
                n={1}
                title="Snap your meal"
                body="Plate, bowl, or food on the table — one item or many."
                P={P}
              />
              <Step
                n={2}
                title="AI identifies the food"
                body="We detect dishes, ingredients and estimate portion sizes."
                P={P}
              />
              <Step
                n={3}
                title="Review before logging"
                body="Tweak the calorie or macro estimate if it looks off."
                P={P}
              />
            </View>
          </AnimatedCard>
        </View>

        {/* ── What works best ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <Text style={[styles.sectionLabel, { color: P.textFaint }]}>
              FOR BEST RESULTS
            </Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              <Tip icon="sunny-outline">Shoot in natural light when you can.</Tip>
              <Tip icon="expand-outline">Fill the frame with the food, top-down.</Tip>
              <Tip icon="close-circle-outline">Avoid hands, cutlery, or packaging in frame.</Tip>
            </View>
          </AnimatedCard>
        </View>

        {/* ── CTA ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label="Open camera"
            icon="camera"
            onPress={() => router.replace('/(tabs)/log/food')}
            accent={P.calories}
          />
          <Text style={[styles.footNote, { color: P.textFaint }]}>
            Opens the Food Log where the AI camera lives.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Step({
  n, title, body, P,
}: {
  n: number; title: string; body: string;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={[styles.stepN, { backgroundColor: P.caloriesSoft }]}>
        <Text style={[styles.stepNText, { color: P.calories }]}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.stepTitle, { color: P.text }]}>{title}</Text>
        <Text style={[styles.stepBody, { color: P.textFaint }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    alignItems:       'center',
    justifyContent:   'center',
    paddingVertical:  40,
    borderRadius:     24,
    overflow:         'hidden',
  },
  plate: {
    width:           140, height: 140, borderRadius: 70,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     StyleSheet.hairlineWidth,
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    14,
    shadowOffset:    { width: 0, height: 6 },
  },
  plateInner: {
    width:           90, height: 90, borderRadius: 45,
    alignItems:      'center',
    justifyContent:  'center',
  },
  corner: {
    position:    'absolute',
    width:       28, height: 28,
    borderWidth: 3,
  },
  cornerTL: { top: 20,    left: 20,    borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius:     10 },
  cornerTR: { top: 20,    right: 20,   borderLeftWidth:  0, borderBottomWidth: 0, borderTopRightRadius:    10 },
  cornerBL: { bottom: 20, left: 20,    borderRightWidth: 0, borderTopWidth:    0, borderBottomLeftRadius:  10 },
  cornerBR: { bottom: 20, right: 20,   borderLeftWidth:  0, borderTopWidth:    0, borderBottomRightRadius: 10 },

  aiBadge: {
    position:          'absolute',
    top:               24,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
  },
  aiBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },

  sectionLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },

  stepN: {
    width:          32, height: 32, borderRadius: 10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stepNText: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  stepTitle: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  stepBody: {
    fontSize:      11,
    fontWeight:    '500',
    lineHeight:    15,
  },

  footNote: {
    fontSize:   11,
    fontWeight: '500',
    textAlign:  'center',
    marginTop:  12,
  },
});
