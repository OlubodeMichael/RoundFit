import { ActivityIndicator, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import { SleepHypnogram } from '@/components/log/SleepHypnogram';
import { sleepStyles } from '@/components/log/sleep/sleep-styles';
import { formatStageDuration } from '@/utils/sleep-time';
import type { SleepSegment } from '@/utils/healthkit';
import type { SleepStageSummaryRow } from '@/types/sleep-log';

export type { SleepStageSummaryRow };

export interface SleepStagesSectionProps {
  visible: boolean;
  segmentsLoading: boolean;
  hasSegments: boolean;
  fullCycles: number;
  segments: SleepSegment[];
  stageSummary: SleepStageSummaryRow[];
  windowStart?: Date;
  windowEnd?: Date;
}

export function SleepStagesSection({
  visible,
  segmentsLoading,
  hasSegments,
  fullCycles,
  segments,
  stageSummary,
  windowStart,
  windowEnd,
}: SleepStagesSectionProps) {
  const P = usePalette();

  if (!visible || (!segmentsLoading && !hasSegments)) return null;

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
      <View style={sleepStyles.sectionHeader}>
        <Text style={[sleepStyles.sectionLabel, { color: P.textFaint }]}>SLEEP STAGES</Text>
        {!segmentsLoading && fullCycles > 0 && (
          <Text style={[sleepStyles.sectionSub, { color: P.textFaint }]}>
            {fullCycles} full {fullCycles === 1 ? 'cycle' : 'cycles'}
          </Text>
        )}
      </View>
      <AnimatedCard delay={90} padding={16}>
        {segmentsLoading && !hasSegments ? (
          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={P.sleep} />
          </View>
        ) : (
          <SleepHypnogram segments={segments} windowStart={windowStart} windowEnd={windowEnd} />
        )}
        {hasSegments && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {stageSummary.map((st) =>
              st.ms > 0 ? (
                <View
                  key={st.label}
                  style={[sleepStyles.stagePill, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <View style={[sleepStyles.stageDot, { backgroundColor: st.color }]} />
                    <Text style={{ color: P.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }}>
                      {st.label}
                    </Text>
                  </View>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: '800', letterSpacing: -0.3 }}>
                    {formatStageDuration(st.ms)}
                  </Text>
                  <Text style={{ color: P.textFaint, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
                    {st.pct}%
                  </Text>
                </View>
              ) : null,
            )}
          </View>
        )}
      </AnimatedCard>
    </View>
  );
}

export function SleepHealthKitBanner({ visible }: { visible: boolean }) {
  const P = usePalette();
  if (!visible) return null;

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
      <View style={[sleepStyles.hkBanner, { backgroundColor: P.waterSoft, borderColor: P.water + '40' }]}>
        <Ionicons name="logo-apple" size={13} color="#EF4444" />
        <Text style={[sleepStyles.hkBannerText, { color: P.water }]}>Synced from Apple Health</Text>
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}
