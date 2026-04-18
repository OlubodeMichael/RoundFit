import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedCard,
  PrimaryButton,
  ScreenHeader,
  Tip,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';

export default function BarcodeScanScreen() {
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
        <ScreenHeader eyebrow="Barcode" title="Scan" accent={P.water} />

        {/* ── Hero visualization ──────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedCard delay={60} padding={0}>
            <View style={[styles.viewfinder, { backgroundColor: P.sunken }]}>
              <View style={[styles.window, { borderColor: P.cardEdge }]}>
                <View style={[styles.corner, styles.cornerTL, { borderColor: P.water }]} />
                <View style={[styles.corner, styles.cornerTR, { borderColor: P.water }]} />
                <View style={[styles.corner, styles.cornerBL, { borderColor: P.water }]} />
                <View style={[styles.corner, styles.cornerBR, { borderColor: P.water }]} />

                {/* Faux barcode lines */}
                <View style={styles.bars}>
                  {BARS.map((w, i) => (
                    <View
                      key={i}
                      style={{
                        width: w, height: 60,
                        backgroundColor: P.text,
                        opacity: 0.75,
                        marginHorizontal: 1,
                      }}
                    />
                  ))}
                </View>

                <View style={[styles.scanLine, { backgroundColor: P.water }]} />
              </View>

              <Text style={[styles.viewfinderCaption, { color: P.textFaint }]}>
                Point at any food barcode
              </Text>
            </View>
          </AnimatedCard>
        </View>

        {/* ── Supported formats ───────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <Text style={[styles.sectionLabel, { color: P.textFaint }]}>WORKS WITH</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'QR', 'Code 128'].map((f) => (
                <View
                  key={f}
                  style={[styles.formatPill, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
                >
                  <Text style={[styles.formatText, { color: P.textDim }]}>{f}</Text>
                </View>
              ))}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Tips ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <Text style={[styles.sectionLabel, { color: P.textFaint }]}>TIPS FOR A QUICK SCAN</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              <Tip icon="sunny-outline"          tint={P.water}>Good lighting. Avoid glare on the barcode.</Tip>
              <Tip icon="scan-outline"           tint={P.water}>Hold the camera 6–12 inches from the label.</Tip>
              <Tip icon="phone-portrait-outline" tint={P.water}>Keep the phone steady — no shaking hands.</Tip>
            </View>
          </AnimatedCard>
        </View>

        {/* ── CTA ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label="Open scanner"
            icon="barcode"
            onPress={() => router.replace('/(tabs)/log/food')}
            accent={P.water}
          />
          <Text style={[styles.footNote, { color: P.textFaint }]}>
            Opens the Food Log where the barcode scanner lives.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const BARS = [2, 3, 1, 2, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3];

const styles = StyleSheet.create({
  viewfinder: {
    alignItems:       'center',
    justifyContent:   'center',
    paddingVertical:  32,
    paddingHorizontal: 20,
    borderRadius:     24,
  },
  window: {
    width:           240, height: 160,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    10,
    borderWidth:     StyleSheet.hairlineWidth,
  },
  corner: {
    position:    'absolute',
    width:       20, height: 20,
    borderWidth: 3,
  },
  cornerTL: { top:    -2, left:  -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius:     8 },
  cornerTR: { top:    -2, right: -2, borderLeftWidth:  0, borderBottomWidth: 0, borderTopRightRadius:    8 },
  cornerBL: { bottom: -2, left:  -2, borderRightWidth: 0, borderTopWidth:    0, borderBottomLeftRadius:  8 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth:  0, borderTopWidth:    0, borderBottomRightRadius: 8 },

  bars: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left:     20,
    right:    20,
    height:   2,
    top:      78,
    borderRadius: 2,
    shadowColor:   '#38BDF8',
    shadowOpacity: 0.7,
    shadowRadius:  6,
  },
  viewfinderCaption: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.2,
    marginTop:     18,
  },

  sectionLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  formatPill: {
    paddingHorizontal:12,
    paddingVertical:  7,
    borderRadius:     999,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  formatText: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },

  footNote: {
    fontSize:   11,
    fontWeight: '500',
    textAlign:  'center',
    marginTop:  12,
  },
});
