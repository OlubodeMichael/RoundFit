import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import { useInsights } from '@/context/insights-context';
import type { Insight as ApiInsight } from '@/context/insights-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Display shape ────────────────────────────────────────────────────────────
// Adapts the API's flat { message } field into what the cards need.
type Tint = 'protein' | 'fat' | 'calories' | 'water' | 'sleep' | 'workout';

interface DisplayInsight {
  id:       string;
  date:     string;
  dateLong: string;
  tag:      string;
  tint:     Tint;
  icon:     IoniconName;
  title:    string;
  body:     string;
  source:   'ai' | 'rule';
}

// Pull the first sentence (or first 60 chars) as the card title.
function extractTitle(message: string): string {
  const dot = message.indexOf('. ');
  if (dot > 10 && dot < 72) return message.slice(0, dot);
  return message.length > 62
    ? message.slice(0, 60).trimEnd() + '…'
    : message;
}

function relativeDay(isoDate: string): string {
  const d       = new Date(isoDate);
  const now     = new Date();
  const diffDay = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDay === 0) return 'Today';
  if (diffDay === 1) return 'Yesterday';
  if (diffDay <= 6)  return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function longDay(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function toDisplay(insight: ApiInsight, fallbackDate?: string): DisplayInsight {
  const isAi = insight.type === 'claude';
  return {
    id:       insight.id,
    date:     relativeDay(insight.date || fallbackDate || new Date().toISOString()),
    dateLong: longDay(insight.date   || fallbackDate || new Date().toISOString()),
    tag:      isAi ? 'AI insight' : 'Daily insight',
    tint:     isAi ? 'fat' : 'protein',
    icon:     isAi ? 'sparkles' : 'bulb-outline',
    title:    extractTitle(insight.message),
    body:     insight.message,
    source:   isAi ? 'ai' : 'rule',
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { todayInsight, claudeInsight, history, isLoading, dismissInsight } = useInsights();

  // Prefer Claude insight for hero if available, else fall back to today's rule insight.
  const heroSource  = claudeInsight ?? todayInsight;
  const heroDisplay = heroSource
    ? toDisplay(heroSource, new Date().toISOString())
    : null;

  // Past = history excluding today's hero, excluding dismissed.
  const todayId = heroSource?.id;
  const pastDisplay = useMemo(
    () => history
      .filter(i => !i.dismissed && i.id !== todayId)
      .map(i => toDisplay(i)),
    [history, todayId],
  );

  const longDate = useMemo(
    () => new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    }),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop:    insets.top + 12,
          paddingBottom: insets.bottom + 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>
              {longDate.toUpperCase()}
            </Text>
            <Text style={[styles.title, { color: P.text }]}>
              Insights<Text style={{ color: P.fat }}>.</Text>
            </Text>
          </View>
        </View>

        <View style={styles.stack}>
          {/* ── Today's insight ───────────────────────────────── */}
          {isLoading ? (
            <AnimatedCard delay={60}>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={P.fat} />
                <Text style={[styles.loadingText, { color: P.textFaint }]}>
                  Loading your daily insight…
                </Text>
              </View>
            </AnimatedCard>
          ) : heroDisplay ? (
            <HeroInsightCard
              insight={heroDisplay}
              delay={60}
              onDismiss={() => dismissInsight(heroSource!.id)}
            />
          ) : (
            <EmptyInsightCard delay={60} />
          )}

          {/* ── Weekly report ─────────────────────────────────── */}
          <WeeklyReportCard
            onPress={() => router.push('/(tabs)/insights/weekly')}
            delay={140}
          />

          {/* ── Past insights ─────────────────────────────────── */}
          {pastDisplay.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: P.text }]}>Past insights</Text>
                <Text style={[styles.sectionCaption, { color: P.textFaint }]}>
                  {pastDisplay.length} earlier {pastDisplay.length === 1 ? 'insight' : 'insights'}
                </Text>
              </View>

              {pastDisplay.map((item, idx) => (
                <PastInsightCard key={item.id} insight={item} delay={220 + idx * 50} />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Hero insight card ────────────────────────────────────────────────────────
function HeroInsightCard({
  insight,
  delay,
  onDismiss,
}: {
  insight:   DisplayInsight;
  delay:     number;
  onDismiss: () => void;
}) {
  const P    = usePalette();
  const tint = P[insight.tint] as string;
  const soft = P[`${insight.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;

  return (
    <AnimatedCard delay={delay} style={{ overflow: 'hidden' }}>
      {/* Ambient glow */}
      <View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: soft, top: -80, right: -80 }]}
      />

      <View style={styles.heroHead}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name="sparkles" size={16} color={P.fat} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.heroEyebrow, { color: P.fat }]}>{"TODAY'S INSIGHT"}</Text>
          <Text style={[styles.heroMeta, { color: P.textFaint }]}>{insight.dateLong}</Text>
        </View>
        {insight.source === 'ai' && (
          <View style={[styles.aiBadge, { backgroundColor: P.fatSoft }]}>
            <Ionicons name="flash" size={10} color={P.fat} />
            <Text style={[styles.aiBadgeText, { color: P.fat }]}>AI</Text>
          </View>
        )}
      </View>

      <View style={[styles.tagPill, { backgroundColor: soft }]}>
        <Ionicons name={insight.icon} size={10} color={tint} />
        <Text style={[styles.tagPillText, { color: tint }]}>{insight.tag.toUpperCase()}</Text>
      </View>

      <Text style={[styles.heroTitle, { color: P.text }]}>{insight.title}</Text>
      <Text style={[styles.heroBody, { color: P.textDim }]}>{insight.body}</Text>

      <View style={[styles.heroFoot, { borderTopColor: P.hair }]}>
        <Pressable
          style={({ pressed }) => [styles.footBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="thumbs-up-outline" size={14} color={P.textDim} />
          <Text style={[styles.footBtnText, { color: P.textDim }]}>Helpful</Text>
        </Pressable>
        <View style={[styles.footDivider, { backgroundColor: P.hair }]} />
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.footBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="eye-off-outline" size={14} color={P.textDim} />
          <Text style={[styles.footBtnText, { color: P.textDim }]}>Dismiss</Text>
        </Pressable>
        <View style={[styles.footDivider, { backgroundColor: P.hair }]} />
        <Pressable
          style={({ pressed }) => [styles.footBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={14} color={P.textDim} />
          <Text style={[styles.footBtnText, { color: P.textDim }]}>Share</Text>
        </Pressable>
      </View>
    </AnimatedCard>
  );
}

// ─── Empty insight card ───────────────────────────────────────────────────────
function EmptyInsightCard({ delay }: { delay: number }) {
  const P = usePalette();
  return (
    <AnimatedCard delay={delay} padding={24}>
      <View style={styles.emptyRow}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name="sparkles" size={16} color={P.fat} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.emptyTitle, { color: P.text }]}>
            No insight yet today
          </Text>
          <Text style={[styles.emptyBody, { color: P.textFaint }]}>
            Keep logging — insights appear once you have data to analyse.
          </Text>
        </View>
      </View>
    </AnimatedCard>
  );
}

// ─── Weekly report card ───────────────────────────────────────────────────────
function WeeklyReportCard({ onPress, delay }: { onPress: () => void; delay: number }) {
  const P = usePalette();
  return (
    <AnimatedCard delay={delay} padding={0} style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.weeklyWrap,
          { backgroundColor: P.calories },
          pressed && { opacity: 0.92 },
        ]}
      >
        <View pointerEvents="none" style={[styles.weeklyGlow, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />

        <Text style={styles.weeklyTitle}>Weekly report</Text>
        <Text style={styles.weeklySub}>
          Consistency score, averages, top pattern, and a fresh recommendation — refreshed every Sunday.
        </Text>

        <View style={styles.weeklyFoot}>
          <View style={styles.weeklyRowItem}>
            <Ionicons name="stats-chart" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.weeklyFootLabel}>7 days</Text>
          </View>
          <View style={styles.weeklyRowItem}>
            <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.weeklyFootLabel}>1 pattern</Text>
          </View>
          <View style={[styles.weeklyCta, { backgroundColor: '#fff' }]}>
            <Text style={[styles.weeklyCtaText, { color: P.calories }]}>Open</Text>
            <Ionicons name="arrow-forward" size={13} color={P.calories} />
          </View>
        </View>
      </Pressable>
    </AnimatedCard>
  );
}

// ─── Past insight row card ────────────────────────────────────────────────────
function PastInsightCard({ insight, delay }: { insight: DisplayInsight; delay: number }) {
  const P    = usePalette();
  const tint = P[insight.tint] as string;
  const soft = P[`${insight.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;

  return (
    <AnimatedCard delay={delay} padding={18}>
      <View style={styles.pastHead}>
        <View style={[styles.pastIcon, { backgroundColor: soft }]}>
          <Ionicons name={insight.icon} size={16} color={tint} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.pastTopRow}>
            <Text style={[styles.pastTag, { color: tint }]}>{insight.tag.toUpperCase()}</Text>
            {insight.source === 'ai' && (
              <View style={[styles.miniAi, { backgroundColor: P.fatSoft }]}>
                <Ionicons name="sparkles" size={8} color={P.fat} />
                <Text style={[styles.miniAiText, { color: P.fat }]}>AI</Text>
              </View>
            )}
          </View>
          <Text style={[styles.pastDate, { color: P.textFaint }]}>{insight.date}</Text>
        </View>
      </View>

      <Text style={[styles.pastTitle, { color: P.text }]}>{insight.title}</Text>
      <Text style={[styles.pastBody, { color: P.textDim }]} numberOfLines={2}>
        {insight.body}
      </Text>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        4,
    paddingBottom:     18,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  4,
  },
  title: {
    fontSize:      30,
    fontWeight:    '800',
    letterSpacing: -0.8,
  },

  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },

  // ─── Loading ──
  loadingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize:   13,
    fontWeight: '500',
  },

  // ─── Empty ──
  emptyRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           14,
  },
  emptyTitle: {
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.3,
    marginBottom:  4,
  },
  emptyBody: {
    fontSize:   13,
    fontWeight: '400',
    lineHeight: 19,
  },

  // ─── Section header ──
  sectionHead: {
    marginTop:    12,
    marginBottom: -2,
    gap:          2,
  },
  sectionTitle: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize:   11,
    fontWeight: '500',
  },

  // ─── Hero ──
  glow: {
    position:     'absolute',
    width:        260,
    height:       260,
    borderRadius: 130,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  14,
  },
  iconTile: {
    width:          36, height: 36, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.8,
  },
  heroMeta: {
    fontSize:   11,
    fontWeight: '500',
  },
  aiBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
  },
  aiBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 0.6,
  },
  tagPill: {
    alignSelf:         'flex-start',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    marginBottom:      10,
  },
  tagPillText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.0,
  },
  heroTitle: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.6,
    marginBottom:  10,
  },
  heroBody: {
    fontSize:      14,
    fontWeight:    '500',
    lineHeight:    22,
    letterSpacing: -0.1,
  },
  heroFoot: {
    flexDirection:  'row',
    alignItems:     'center',
    marginTop:      18,
    paddingTop:     14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical:6,
  },
  footBtnText: {
    fontSize:   11,
    fontWeight: '700',
  },
  footDivider: { width: StyleSheet.hairlineWidth, height: 16 },

  // ─── Weekly report ──
  weeklyWrap: {
    padding:  22,
    overflow: 'hidden',
  },
  weeklyGlow: {
    position:     'absolute',
    top:          -60,
    right:        -60,
    width:        220,
    height:       220,
    borderRadius: 110,
  },
  weeklyTitle: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.6,
    color:         '#fff',
    marginBottom:  6,
  },
  weeklySub: {
    fontSize:      13,
    fontWeight:    '500',
    lineHeight:    19,
    color:         'rgba(255,255,255,0.85)',
    marginBottom:  16,
  },
  weeklyFoot: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  weeklyRowItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  weeklyFootLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.9)',
  },
  weeklyCta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      10,
    marginLeft:        'auto',
  },
  weeklyCtaText: {
    fontSize:   12,
    fontWeight: '800',
  },

  // ─── Past list ──
  pastHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  10,
  },
  pastIcon: {
    width:          36, height: 36, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pastTopRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  pastTag: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.0,
  },
  miniAi: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      6,
  },
  miniAiText: {
    fontSize:      8,
    fontWeight:    '800',
    letterSpacing: 0.4,
  },
  pastDate: {
    fontSize:   11,
    fontWeight: '500',
  },
  pastTitle: {
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.3,
    marginBottom:  4,
  },
  pastBody: {
    fontSize:      13,
    fontWeight:    '500',
    lineHeight:    19,
    letterSpacing: -0.1,
  },
});
