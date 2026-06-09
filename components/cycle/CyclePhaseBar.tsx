import { StyleSheet, Text, View } from 'react-native';

import {
  buildSegments,
  getCurrentPhaseColor,
  getCurrentPhaseKey,
} from '@/components/cycle/cycle-phase-config';

const BAR_HEIGHT = 8;
const SEGMENT_GAP = 3;
const LABEL_WIDTH = 66;

export interface CyclePhaseBarProps {
  cycleDay: number;
  cycleLength: number;
  barWidth: number;
  activePhase?: string | null;
}

export function CyclePhaseBar({
  cycleDay,
  cycleLength,
  barWidth,
  activePhase,
}: CyclePhaseBarProps) {
  const segments = buildSegments(cycleLength);
  const totalDays = segments.reduce((sum, segment) => sum + segment.days, 0);
  const usableWidth = barWidth - SEGMENT_GAP * (segments.length - 1);
  const progressX = Math.min((cycleDay / cycleLength) * barWidth, barWidth - 1);
  const currentKey = activePhase ?? getCurrentPhaseKey(cycleDay, cycleLength);

  let cumulativeDays = 0;

  return (
    <View style={s.wrap}>
      <View style={s.barRow}>
        {segments.map((segment, index) => {
          const segmentWidth = (segment.days / totalDays) * usableWidth;
          const dayStart = cumulativeDays + 1;
          const dayEnd = cumulativeDays + segment.days;
          cumulativeDays += segment.days;

          let fillRatio = 0;
          if (cycleDay > dayEnd) fillRatio = 1;
          else if (cycleDay >= dayStart) fillRatio = (cycleDay - dayStart + 1) / segment.days;

          const isFirst = index === 0;
          const isLast = index === segments.length - 1;
          const radiusLeft = { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 };
          const radiusRight = { borderTopRightRadius: 6, borderBottomRightRadius: 6 };

          return (
            <View
              key={segment.key}
              style={[
                s.segmentTrack,
                { width: segmentWidth, backgroundColor: `${segment.color}22` },
                isFirst && radiusLeft,
                isLast && radiusRight,
              ]}
            >
              <View
                style={[
                  s.segmentFill,
                  {
                    width: segmentWidth * fillRatio,
                    backgroundColor: segment.color,
                  },
                  isFirst && radiusLeft,
                  isLast && fillRatio === 1 && radiusRight,
                ]}
              />
            </View>
          );
        })}
      </View>

      <View
        style={[
          s.indicator,
          {
            left: progressX - 8,
            borderColor: getCurrentPhaseColor(cycleDay, cycleLength),
          },
        ]}
      />

      <View style={s.labelRow}>
        {(() => {
          let cursor = 0;
          return segments.map((segment, index) => {
            const segmentWidth = (segment.days / totalDays) * usableWidth;
            const midpoint = cursor + index * SEGMENT_GAP + segmentWidth / 2;
            cursor += segmentWidth;
            const active = segment.key === currentKey;

            return (
              <Text
                key={segment.key}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  s.label,
                  {
                    left: midpoint - LABEL_WIDTH / 2,
                    color: segment.color,
                    opacity: active ? 1 : 0.45,
                    fontWeight: active ? '800' : '600',
                  },
                ]}
              >
                {segment.label}
              </Text>
            );
          });
        })()}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 0 },
  barRow: { flexDirection: 'row', gap: SEGMENT_GAP, marginBottom: 10 },
  segmentTrack: { height: BAR_HEIGHT, overflow: 'hidden' },
  segmentFill: { height: BAR_HEIGHT },
  indicator: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  labelRow: { height: 16, marginTop: 2 },
  label: {
    position: 'absolute',
    width: LABEL_WIDTH,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: -0.1,
  },
});
