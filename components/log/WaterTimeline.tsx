import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import {
  timelineBubbleForMl,
  timelineBubbleRange,
} from '@/utils/water-timeline-bubble';

/** Y-center of the horizontal axis (dots + now marker align here) */
const AXIS_Y = 36;
const TRACK_HEIGHT = AXIS_Y + 24;

const NOW_RING = 14;
const NOW_CORE = 6;
const NOW_STEM_WIDTH = 2;
const NOW_STEM_HEIGHT = 42;

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

interface NowMarkerProps {
  centerX: number;
  accentColor: string;
  surfaceColor: string;
}

/** Vertical now-line through the axis with dot centered on the intersection */
function NowMarker({ centerX, accentColor, surfaceColor }: NowMarkerProps) {
  return (
    <View pointerEvents="none" style={s.nowMarkerRoot}>
      <View
        style={[
          s.nowStem,
          {
            left: centerX - NOW_STEM_WIDTH / 2,
            top: AXIS_Y - NOW_STEM_HEIGHT / 2,
            backgroundColor: accentColor,
          },
        ]}
      />
      <View
        style={[
          s.nowWrap,
          {
            left: centerX - NOW_RING / 2,
            top: AXIS_Y - NOW_RING / 2,
          },
        ]}
      >
        <View
          style={[
            s.nowRing,
            {
              borderColor: accentColor,
              backgroundColor: surfaceColor,
            },
          ]}
        />
        <View style={[s.nowCore, { backgroundColor: accentColor }]} />
      </View>
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

  const lastEntry = useMemo(() => {
    if (entries.length === 0) return null;
    return [...entries].sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
    )[0]!;
  }, [entries]);

  if (!lastEntry) return null;

  const { h, m, justNow } = timeAgoParts(lastEntry.logged_at);
  const trackColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const tickColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';

  const nowCx =
    trackWidth > 0 && showNowMarker
      ? timeOfDayFraction(new Date()) * trackWidth
      : 0;

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: textFaint }]}>Day rhythm</Text>
      <View
        style={[
          s.card,
          {
            backgroundColor: cardBackground,
            borderColor: cardBorder,
            shadowOpacity: isDark ? 0.35 : 0.06,
          },
          Platform.OS === 'android' && { elevation: isDark ? 0 : 2 },
        ]}
        accessibilityLabel={`Hydration timeline. Last sip ${
          justNow ? 'just now' : `${h > 0 ? `${h} hours ${m} minutes` : `${m} minutes`} ago`
        }.`}
      >
        <View style={s.headerRow}>
          <Text style={[s.lastSipText, { color: textColor }]} numberOfLines={1}>
            Last sip{' '}
            {justNow ? (
              <Text style={[s.lastSipAccent, { color: accentColor }]}>just now</Text>
            ) : (
              <>
                <Text style={[s.lastSipAccent, { color: accentColor }]}>
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
              { backgroundColor: trackColor, top: AXIS_Y - 1 },
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
                    top: AXIS_Y - 5,
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
                      top: AXIS_Y - halo / 2,
                      width: halo,
                      height: halo,
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
            <NowMarker
              centerX={nowCx}
              accentColor={accentColor}
              surfaceColor={cardBackground}
            />
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
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.08,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  lastSipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.25,
  },
  lastSipAccent: {
    fontWeight: '700',
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    flexShrink: 0,
  },
  timelineOuter: {
    height: TRACK_HEIGHT,
    marginBottom: 6,
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
    height: 10,
    borderRadius: 0.5,
  },
  dotWrap: {
    position: 'absolute',
    zIndex: 2,
  },
  nowMarkerRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  nowStem: {
    position: 'absolute',
    width: NOW_STEM_WIDTH,
    height: NOW_STEM_HEIGHT,
    borderRadius: 1,
    opacity: 0.88,
  },
  nowWrap: {
    position: 'absolute',
    width: NOW_RING,
    height: NOW_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NOW_RING / 2,
    borderWidth: 2,
  },
  nowCore: {
    width: NOW_CORE,
    height: NOW_CORE,
    borderRadius: NOW_CORE / 2,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.05,
    fontVariant: ['tabular-nums'],
  },
});
