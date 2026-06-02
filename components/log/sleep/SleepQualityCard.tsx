import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import { SleepQualityRing } from '@/components/log/sleep/SleepQualityRing';
import { SLEEP_QUALITY_OPTIONS, sleepQualityPillColor } from '@/components/log/sleep/constants';
import { sleepStyles } from '@/components/log/sleep/sleep-styles';
import { capitalFirst } from '@/utils/sleep-date';
import type { SleepQualityUi } from '@/utils/sleep-quality';

export interface SleepQualityCardProps {
  quality: SleepQualityUi;
  qualityScore: number | null;
  sleepEfficiency?: number | null;
  readOnly?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Optional — only used when the card is editable (`readOnly` false). */
  onSelectQuality?: (q: SleepQualityUi) => void;
}

export function SleepQualityCard({
  quality,
  qualityScore,
  sleepEfficiency = null,
  readOnly = false,
  expanded,
  onToggleExpand,
  onSelectQuality,
}: SleepQualityCardProps) {
  const P = usePalette();

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
      <AnimatedCard delay={180} onPress={readOnly ? undefined : onToggleExpand}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <SleepQualityRing quality={quality} score={qualityScore} size={72} strokeWidth={6} />
          <View style={{ flex: 1 }}>
            <Text style={[sleepStyles.heroEyebrow, { color: P.textFaint }]}>SLEEP QUALITY</Text>
            <Text style={{ color: P.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 }}>
              {capitalFirst(quality)}
            </Text>
          </View>
          {readOnly && sleepEfficiency != null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[sleepStyles.heroEyebrow, { color: P.textFaint }]}>EFFIC.</Text>
              <Text style={{ color: P.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>
                {Math.round(sleepEfficiency)}%
              </Text>
            </View>
          ) : !readOnly ? (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={P.textFaint}
            />
          ) : null}
        </View>

        {expanded && !readOnly && (
          <View style={[sleepStyles.qualityRow, { marginTop: 14 }]}>
            {SLEEP_QUALITY_OPTIONS.map((q) => {
              const active = q.id === quality;
              const color  = sleepQualityPillColor(P, q.id);
              return (
                <Pressable
                  key={q.id}
                  onPress={() => onSelectQuality?.(q.id)}
                  style={({ pressed }) => [
                    sleepStyles.qualityPill,
                    {
                      backgroundColor: active ? color : P.sunken,
                      borderColor:     active ? color : P.cardEdge,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name={q.icon} size={16} color={active ? '#fff' : color} />
                  <Text style={[sleepStyles.qualityLabel, { color: active ? '#fff' : P.text }]}>
                    {q.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </AnimatedCard>
    </View>
  );
}
