import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import {
  timelineBubbleForMl,
  timelineBubbleRange,
} from '@/utils/water-timeline-bubble';

const LAST_SIP_ORANGE = '#F4A261';
const LAST_SIP_RING = 'rgba(244,162,97,0.20)';

const NOW_DOT_SIZE = 8;
const NOW_STEM_WIDTH = 2;
const NOW_STEM_BELOW_LINE = 4;

/** Vertical space above the axis for the now-marker dot */
const TIMELINE_TOP_PAD = 10;
const TRACK_LINE_Y = 38;
const TRACK_HEIGHT = TRACK_LINE_Y + 14;

/** Hours on the 6 AM → midnight axis */
const TIMELINE_AXIS_HOURS = [6, 12, 18, 24] as const;
const TICK_FRACTIONS = [0, 1 / 3, 2 / 3, 1] as const;

export interface WaterTimelineEntry {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface WaterTimelineProps {
  entries: WaterTimelineEntry[];
  accentColor: string;
  isDark: boolean;
  textColor: string;
  textFaint: string;
  cardBackground: string;
  cardBorder: string;
  showNowMarker?: boolean;
}

function timeAgoParts(iso: string): { h: number; m: number; justNow: boolean } {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return { h: 0, m: 0, justNow: true };
  return { h: Math.floor(mins / 60), m: mins % 60, justNow: false };
}

function timeOfDayFraction(date: Date): number {
  const h = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, Math.min(1, (h - 6) / 18));
}

function formatAxisTime(hour: number, compact = false): string {
  const d = new Date();
  d.setHours(hour === 24 ? 0 : hour, 0, 0, 0);
  if (compact) {
    const h = d.getHours();
    const isPm = h >= 12;
    const h12 = h % 12 || 12;
    return `${h12}${isPm ? 'p' : 'a'}`;
  }
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const TIME_LABELS = TIMELINE_AXIS_HOURS.map((h) => formatAxisTime(h));
const RANGE_LABEL = `${formatAxisTime(6, true)} — ${formatAxisTime(24, true)}`;

interface NowTimeMarkerProps {
  centerX: number;
}

function NowTimeMarker({ centerX }: NowTimeMarkerProps) {
  const stemTop = TIMELINE_TOP_PAD + NOW_DOT_SIZE + 3;
  const stemHeight = TRACK_LINE_Y - stemTop + NOW_STEM_BELOW_LINE;

  return (
    <View
      style={[s.nowMarker, { left: centerX - NOW_STEM_WIDTH / 2 }]}
      pointerEvents="none"
    >
      <View style={s.nowDot} />
      <View style={[s.nowStem, { height: stemHeight }]} />
    </View>
  );
}

export function WaterTimeline({
  entries,
  accentColor,
  isDark,
  textColor,
  textFaint,
  cardBackground,
  cardBorder,
  showNowMarker = true,
}: WaterTimelineProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const { minMl, maxMl } = useMemo(() => timelineBubbleRange(entries), [entries]);

  const lastEntry = entries[0];
  if (!lastEntry) return null;

  const { h, m, justNow } = timeAgoParts(lastEntry.logged_at);
  const trackColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const tickColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';

  const nowCx =
    trackWidth > 0 && showNowMarker
      ? timeOfDayFraction(new Date()) * trackWidth
      : 0;

  return (
    <View
      style={[
        s.card,
        { backgroundColor: cardBackground, borderColor: cardBorder },
      ]}
    >
      <View style={s.headerRow}>
        <View style={s.lastSipIconWrap}>
          <View style={s.lastSipRing} />
          <View style={s.lastSipDot} />
        </View>

        <Text style={[s.lastSipText, { color: textColor }]} numberOfLines={1}>
          Last sip{' '}
          {justNow ? (
            <Text style={s.lastSipTime}>just now</Text>
          ) : (
            <>
              <Text style={s.lastSipTime}>
                {h > 0 ? `${h}h ${m}m` : `${m}m`}
              </Text>
              {' ago'}
            </>
          )}
        </Text>

        <Text style={[s.rangeLabel, { color: textFaint }]} numberOfLines={1}>
          {RANGE_LABEL}
        </Text>
      </View>

      <View
        style={s.timelineOuter}
        onLayout={(ev: LayoutChangeEvent) =>
          setTrackWidth(ev.nativeEvent.layout.width)
        }
      >
        <View
          style={[
            s.trackLine,
            { backgroundColor: trackColor, top: TRACK_LINE_Y - 1 },
          ]}
        />

        {trackWidth > 0 &&
          TICK_FRACTIONS.map((frac) => (
            <View
              key={frac}
              style={[
                s.tick,
                {
                  left: frac * trackWidth - 0.5,
                  top: TRACK_LINE_Y - 4,
                  backgroundColor: tickColor,
                },
              ]}
            />
          ))}

        {trackWidth > 0 &&
          entries.map((e) => {
            const { inner, halo } = timelineBubbleForMl(
              e.amount_ml,
              minMl,
              maxMl,
            );
            const cx = timeOfDayFraction(new Date(e.logged_at)) * trackWidth;
            const inset = (halo - inner) / 2;
            const haloAlpha = 0.18 + (inner / 26) * 0.12;
            const entryHaloColor = isDark
              ? `rgba(30,80,120,${haloAlpha + 0.08})`
              : `rgba(56,189,248,${haloAlpha})`;

            return (
              <View
                key={e.id}
                style={[
                  s.dotWrap,
                  {
                    left: cx - halo / 2,
                    top: TRACK_LINE_Y - halo / 2,
                    width: halo,
                    height: halo,
                    zIndex: 1,
                  },
                ]}
              >
                <View
                  style={{
                    width: halo,
                    height: halo,
                    borderRadius: halo / 2,
                    backgroundColor: entryHaloColor,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: inset,
                    top: inset,
                    width: inner,
                    height: inner,
                    borderRadius: inner / 2,
                    backgroundColor: accentColor,
                  }}
                />
              </View>
            );
          })}

        {trackWidth > 0 && showNowMarker && (
          <NowTimeMarker centerX={nowCx} />
        )}
      </View>

      <View style={s.timeLabels}>
        {TIME_LABELS.map((label, i) => (
          <Text
            key={TIMELINE_AXIS_HOURS[i]}
            style={[s.timeLabel, { color: textFaint }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  lastSipIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastSipRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LAST_SIP_RING,
  },
  lastSipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LAST_SIP_ORANGE,
  },
  lastSipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  lastSipTime: {
    color: LAST_SIP_ORANGE,
    fontWeight: '700',
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    maxWidth: '28%',
    textAlign: 'right',
  },
  timelineOuter: {
    height: TRACK_HEIGHT,
    marginBottom: 8,
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  tick: {
    position: 'absolute',
    width: 1,
    height: 8,
    borderRadius: 0.5,
  },
  dotWrap: {
    position: 'absolute',
  },
  nowMarker: {
    position: 'absolute',
    top: TIMELINE_TOP_PAD,
    alignItems: 'center',
    zIndex: 5,
  },
  nowDot: {
    width: NOW_DOT_SIZE,
    height: NOW_DOT_SIZE,
    borderRadius: NOW_DOT_SIZE / 2,
    backgroundColor: LAST_SIP_ORANGE,
  },
  nowStem: {
    width: NOW_STEM_WIDTH,
    marginTop: 3,
    borderRadius: 1,
    backgroundColor: LAST_SIP_ORANGE,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
