import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useRouter } from 'expo-router';

import { AnimatedCard, usePalette } from '@/lib/log-theme';
import { useInsights } from '@/context/insights-context';
import type { Insight as ApiInsight } from '@/context/insights-context';
import { useWeeklyInsights } from '@/hooks/use-weekly-insights';
import {
  formatWeekRange,
  getDayLetter,
  getDayName,
  formatSleepHours,
  formatDelta,
  getWeekStart,
} from '@/utils/insights-aggregator';
import { getLocalDateString } from '@/utils/date';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type Tab = 'today' | 'week';

// ─── Display helpers ──────────────────────────────────────────────────────────

type Tint = 'protein' | 'fat' | 'calories' | 'water' | 'sleep' | 'workout';

interface DisplayInsight {
  id: string; date: string; dateLong: string; isoDate: string;
  tag: string; tint: Tint; icon: IoniconName;
  title: string; body: string; source: 'ai' | 'rule';
}

function extractTitle(message: string): string {
  const dot = message.indexOf('. ');
  if (dot > 10 && dot < 72) return message.slice(0, dot);
  return message.length > 62 ? message.slice(0, 60).trimEnd() + '…' : message;
}

function relativeDay(isoDate: string): string {
  const raw = isoDate.length === 10 ? isoDate + 'T00:00:00' : isoDate;
  const d   = new Date(raw);
  const now = new Date();
  const dMid   = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff   = Math.round((nowMid.getTime() - dMid.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6)  return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function longDay(isoDate: string): string {
  const raw = isoDate.length === 10 ? isoDate + 'T00:00:00' : isoDate;
  return new Date(raw).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function toDisplay(insight: ApiInsight, fallbackDate?: string): DisplayInsight {
  const isAi    = insight.type === 'claude';
  const rawDate = insight.date || fallbackDate || getLocalDateString();
  const isoDate = rawDate.length > 10 ? rawDate.split('T')[0] : rawDate;
  return {
    id: insight.id,
    isoDate,
    date: relativeDay(rawDate),
    dateLong: longDay(rawDate),
    tag: isAi ? 'AI insight' : 'Daily insight',
    tint: isAi ? 'fat' : 'protein',
    icon: isAi ? 'sparkles' : 'bulb-outline',
    title: extractTitle(insight.message),
    body: insight.message,
    source: isAi ? 'ai' : 'rule',
  };
}

// ─── Segment toggle ───────────────────────────────────────────────────────────

function SegmentToggle({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const P       = usePalette();
  const { width } = useWindowDimensions();
  const PAD     = 20;
  const trackW  = width - PAD * 2;
  const pillW   = trackW / 2 - 4;

  const anim = useRef(new Animated.Value(active === 'today' ? 0 : 1)).current;

  const slide = (tab: Tab) => {
    Animated.spring(anim, {
      toValue:         tab === 'today' ? 0 : 1,
      useNativeDriver: true,
      tension:         240,
      friction:        22,
    }).start();
    onChange(tab);
  };

  const translateX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, pillW + 4],
  });

  return (
    <View style={[
      s.toggleTrack,
      { backgroundColor: P.sunken, borderColor: P.cardEdge, width: trackW }
    ]}>
      {/* Sliding pill */}
      <Animated.View
        style={[
          s.togglePill,
          {
            width:           pillW,
            backgroundColor: P.card,
            borderColor:     P.cardEdge,
            shadowColor:     '#000',
            shadowOpacity:   P.isDark ? 0.4 : 0.07,
            shadowRadius:    8,
            shadowOffset:    { width: 0, height: 2 },
            transform:       [{ translateX }],
          },
        ]}
      />

      {/* Tabs — rendered above the pill */}
      {(['today', 'week'] as Tab[]).map(tab => (
        <Pressable
          key={tab}
          onPress={() => slide(tab)}
          style={[s.toggleTab, { width: pillW }]}
          hitSlop={4}
        >
          <Text style={[
            s.toggleLabel,
            { color: active === tab ? P.text : P.textFaint },
          ]}>
            {tab === 'today' ? 'Today' : 'This week'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('today');

  // Fade animation for tab content swap
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setActiveTab(tab);
  };

  const { todayInsight, claudeInsight, history, isLoading, dismissInsight } = useInsights();
  const { data: weekData, isLoading: weekLoading, isRefreshing: weekRefreshing, refresh: weekRefresh } =
    useWeeklyInsights(getWeekStart());

  const heroSource  = claudeInsight ?? todayInsight;
  const heroDisplay = heroSource ? toDisplay(heroSource, new Date().toISOString()) : null;
  const todayId     = heroSource?.id;

  const pastDisplay = useMemo(
    () => history.filter(i => !i.dismissed && i.id !== todayId).map(i => toDisplay(i)),
    [history, todayId],
  );

  const longDate = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop:    insets.top + 12,
          paddingBottom: insets.bottom + 96,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeTab === 'week'
            ? <RefreshControl refreshing={weekRefreshing} onRefresh={weekRefresh} tintColor={P.calories} />
            : undefined
        }
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={[s.eyebrow, { color: P.textFaint }]}>{longDate.toUpperCase()}</Text>
          <Text style={[s.title, { color: P.text }]}>
            Insights<Text style={{ color: P.fat }}>.</Text>
          </Text>
        </View>

        {/* ── Toggle ───────────────────────────────────────────── */}
        <View style={s.toggleRow}>
          <SegmentToggle active={activeTab} onChange={switchTab} />
        </View>

        {/* ── Content ──────────────────────────────────────────── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {activeTab === 'today' ? (
            <TodayView
              isLoading={isLoading}
              heroDisplay={heroDisplay}
              heroSource={heroSource}
              pastDisplay={pastDisplay}
              onDismiss={id => dismissInsight(id)}
            />
          ) : (
            <WeekView data={weekData} isLoading={weekLoading} />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Today view ───────────────────────────────────────────────────────────────

function TodayView({
  isLoading, heroDisplay, heroSource, pastDisplay, onDismiss,
}: {
  isLoading:   boolean;
  heroDisplay: DisplayInsight | null;
  heroSource:  ApiInsight | null;
  pastDisplay: DisplayInsight[];
  onDismiss:   (id: string) => void;
}) {
  const P      = usePalette();
  const router = useRouter();
  return (
    <View style={s.stack}>
      {isLoading ? (
        <AnimatedCard delay={60}>
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={P.fat} />
            <Text style={[s.loadingText, { color: P.textFaint }]}>Loading your daily insight…</Text>
          </View>
        </AnimatedCard>
      ) : heroDisplay ? (
        <HeroInsightCard
          insight={heroDisplay}
          delay={60}
          onDismiss={() => onDismiss(heroSource!.id)}
          onPress={() => router.push({ pathname: '/insights/daily', params: { date: heroDisplay.isoDate } })}
        />
      ) : (
        <EmptyInsightCard
          delay={60}
          onPress={() => router.push({ pathname: '/insights/daily' })}
        />
      )}

      {pastDisplay.length > 0 && (
        <>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: P.text }]}>Past insights</Text>
            <Text style={[s.sectionCaption, { color: P.textFaint }]}>
              {pastDisplay.length} earlier {pastDisplay.length === 1 ? 'insight' : 'insights'}
            </Text>
          </View>
          {pastDisplay.map((item, idx) => (
            <PastInsightCard
              key={item.id}
              insight={item}
              delay={220 + idx * 50}
              onPress={() => router.push({ pathname: '/insights/daily', params: { date: item.isoDate } })}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ─── Week view (inline) ───────────────────────────────────────────────────────

function WeekView({ data, isLoading }: { data: ReturnType<typeof useWeeklyInsights>['data']; isLoading: boolean }) {
  const P = usePalette();

  if (isLoading && !data) {
    return (
      <View style={s.stack}>
        <AnimatedCard delay={60}>
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={P.calories} />
            <Text style={[s.loadingText, { color: P.textFaint }]}>Loading weekly report…</Text>
          </View>
        </AnimatedCard>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.stack}>
        <AnimatedCard delay={60} padding={24}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Ionicons name="bar-chart-outline" size={28} color={P.textFaint} />
            <Text style={[s.emptyTitle, { color: P.text, textAlign: 'center' }]}>No data yet</Text>
            <Text style={[s.emptyBody, { color: P.textFaint, textAlign: 'center' }]}>
              Log meals and workouts to generate your weekly report.
            </Text>
          </View>
        </AnimatedCard>
      </View>
    );
  }

  const weekRange   = formatWeekRange(data.week_start, data.week_end);
  const consistency = data.consistency_score;
  const targets     = data.targets_snapshot;

  const dayBars = data.days.map(d => ({
    label:  getDayLetter(d.date),
    score:  d.score,
    onTarget: d.met_calories === 'met',
    empty:  d.is_partial,
  }));

  const bestDay = data.best_day_date
    ? data.days.find(d => d.date === data.best_day_date)
    : null;

  const avgCalDelta  = targets ? data.avg_calories - targets.calorie_budget : null;
  const avgProtDelta = targets ? data.avg_protein  - targets.protein_target : null;

  const averages = [
    {
      key: 'cals', label: 'Calories',
      value: `${data.avg_calories.toLocaleString()}`,
      delta: avgCalDelta != null ? `${formatDelta(avgCalDelta)} vs target` : null,
      icon: 'flame' as IoniconName, tint: 'calories' as const,
    },
    {
      key: 'prot', label: 'Protein',
      value: `${data.avg_protein}g`,
      delta: avgProtDelta != null ? `${formatDelta(avgProtDelta, 'g')} vs target` : null,
      icon: 'fitness' as IoniconName, tint: 'protein' as const,
    },
    {
      key: 'sleep', label: 'Sleep',
      value: formatSleepHours(data.avg_sleep),
      delta: null,
      icon: 'moon' as IoniconName, tint: 'sleep' as const,
    },
    {
      key: 'steps', label: 'Steps',
      value: data.avg_steps != null ? `${Math.round(data.avg_steps).toLocaleString()}` : '—',
      delta: null,
      icon: 'walk' as IoniconName, tint: 'fat' as const,
    },
  ];

  return (
    <View style={s.stack}>
      {/* Consistency hero */}
      <AnimatedCard delay={60} style={{ overflow: 'hidden' }}>
        <View pointerEvents="none" style={[s.glow, { backgroundColor: P.caloriesSoft }]} />

        <View style={s.weekRangeRow}>
          <View style={[s.miniPill, { backgroundColor: P.caloriesSoft }]}>
            <View style={[s.dot, { backgroundColor: P.calories }]} />
            <Text style={[s.miniPillText, { color: P.calories }]}>{weekRange.toUpperCase()}</Text>
          </View>
          {data.streak > 0 && (
            <View style={[s.streakPill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Ionicons name="flame" size={10} color={P.calories} />
              <Text style={[s.streakText, { color: P.text }]}>{data.streak}-day streak</Text>
            </View>
          )}
        </View>

        <Text style={[s.consistencyLabel, { color: P.textFaint }]}>CONSISTENCY</Text>
        <View style={s.consistencyScoreRow}>
          <Text style={[s.consistencyScore, { color: P.text }]}>{consistency}</Text>
          <Text style={[s.consistencyOf, { color: P.textFaint }]}>/100</Text>
        </View>

        <View style={[s.progressTrack, { backgroundColor: P.sunken }]}>
          <View style={[s.progressFill, { width: `${consistency}%`, backgroundColor: P.calories }]} />
        </View>

        {/* Day bars */}
        <View style={s.daysRow}>
          {dayBars.map((d, i) => {
            const pct   = d.score / 100;
            const color = d.empty ? P.sunken : d.onTarget ? P.protein : P.textFaint;
            return (
              <View key={i} style={s.dayCol}>
                <View style={[s.dayTrack, { backgroundColor: P.sunken }]}>
                  {!d.empty && (
                    <View style={[s.dayFill, { height: `${pct * 100}%`, backgroundColor: color, opacity: d.onTarget ? 1 : 0.5 }]} />
                  )}
                </View>
                <Text style={[s.dayLabel, { color: P.textFaint }]}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </AnimatedCard>

      {/* Best day */}
      {bestDay && (
        <AnimatedCard delay={140}>
          <View style={s.bestRow}>
            <View style={[s.trophyTile, { backgroundColor: P.carbsSoft }]}>
              <Ionicons name="trophy" size={16} color={P.carbs} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.smallLabel, { color: P.textFaint }]}>BEST DAY</Text>
              <Text style={[s.bestTitle, { color: P.text }]}>{getDayName(bestDay.date)}</Text>
            </View>
            <Text style={[s.bestScore, { color: P.carbs }]}>{bestDay.score}</Text>
          </View>
          <Text style={[s.bestReason, { color: P.textDim }]}>
            {[
              bestDay.met_calories === 'met' ? 'Calories on target' : null,
              bestDay.met_protein  === 'met' ? 'Protein hit' : null,
              bestDay.workout_count > 0 ? `${bestDay.workout_count} workout` : null,
              bestDay.sleep_hours  != null ? `${formatSleepHours(bestDay.sleep_hours)} sleep` : null,
            ].filter(Boolean).join(' · ') || 'Your strongest day this week'}
          </Text>
        </AnimatedCard>
      )}

      {/* Averages 2×2 */}
      <AnimatedCard delay={200} padding={18}>
        <Text style={[s.cardTitle, { color: P.text }]}>Averages</Text>
        <View style={s.avgGrid}>
          {averages.map((a, i) => {
            const tint = P[a.tint] as string;
            const soft = P[`${a.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;
            return (
              <View key={a.key} style={[
                s.avgCell,
                { borderColor: P.hair },
                i % 2 === 0 && s.avgCellRight,
                i < 2 && s.avgCellBottom,
              ]}>
                <View style={[s.avgIcon, { backgroundColor: soft }]}>
                  <Ionicons name={a.icon} size={13} color={tint} />
                </View>
                <Text style={[s.avgLabel, { color: P.textFaint }]}>{a.label.toUpperCase()}</Text>
                <Text style={[s.avgValue, { color: P.text }]}>{a.value}</Text>
                {a.delta && <Text style={[s.avgDelta, { color: P.textDim }]}>{a.delta}</Text>}
              </View>
            );
          })}
        </View>
      </AnimatedCard>

      {/* Days-on-target bars */}
      <AnimatedCard delay={280}>
        <View style={s.targetHead}>
          <View style={[s.iconTile, { backgroundColor: P.proteinSoft }]}>
            <Ionicons name="checkmark-circle" size={15} color={P.protein} />
          </View>
          <Text style={[s.smallLabel, { color: P.protein }]}>TARGET SUMMARY</Text>
        </View>
        <View style={{ gap: 10 }}>
          {(() => {
            const sleepDays = data.days.filter(d => d.sleep_hours !== null).length;

            const rows = [
              { label: 'Calories', met: data.days_met_calories, total: 7, color: P.calories },
              { label: 'Protein',  met: data.days_met_protein,  total: 7, color: P.protein  },
              { label: 'Steps',    met: data.days_met_steps,    total: 7, color: P.fat      },
              ...(sleepDays > 0 ? [{ label: 'Sleep', met: data.days_met_sleep, total: 7, color: P.sleep }] : []),
            ];

            return rows.map(row => {
              const pct = row.met / row.total;
              return (
                <View key={row.label} style={{ gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[s.targetMetLabel, { color: P.textDim }]}>{row.label}</Text>
                    <Text style={[s.targetMetLabel, { color: P.textDim }]}>{row.met}/7 days</Text>
                  </View>
                  <View style={[s.progressTrack, { backgroundColor: P.sunken }]}>
                    <View style={[s.progressFill, { width: `${pct * 100}%`, backgroundColor: row.color }]} />
                  </View>
                </View>
              );
            });
          })()}
        </View>
      </AnimatedCard>

      {/* Weekly insight */}
      {data.weekly_insight_message ? (
        <AnimatedCard delay={360} style={{ overflow: 'hidden' }}>
          <View pointerEvents="none" style={[s.glow, { backgroundColor: P.fatSoft, top: -60, right: -60 }]} />
          <View style={s.insightHead}>
            <View style={[s.iconTile, { backgroundColor: P.fatSoft }]}>
              <Ionicons name="sparkles" size={15} color={P.fat} />
            </View>
            <Text style={[s.smallLabel, { color: P.fat }]}>WEEKLY INSIGHT</Text>
          </View>
          <Text style={[s.insightBody, { color: P.text }]}>{data.weekly_insight_message}</Text>
        </AnimatedCard>
      ) : null}
    </View>
  );
}

// ─── Sub-cards ────────────────────────────────────────────────────────────────

function HeroInsightCard({ insight, delay, onDismiss, onPress }: {
  insight: DisplayInsight; delay: number; onDismiss: () => void; onPress: () => void;
}) {
  const P    = usePalette();
  const tint = P[insight.tint] as string;
  const soft = P[`${insight.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;

  return (
    <AnimatedCard delay={delay} style={{ overflow: 'hidden' }} onPress={onPress}>
      <View pointerEvents="none" style={[s.glow, { backgroundColor: soft, top: -80, right: -80 }]} />

      <View style={s.heroHead}>
        <View style={[s.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name="sparkles" size={15} color={P.fat} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.heroEyebrow, { color: P.fat }]}>{"TODAY'S INSIGHT"}</Text>
          <Text style={[s.heroMeta, { color: P.textFaint }]}>{insight.dateLong}</Text>
        </View>
        {insight.source === 'ai' && (
          <View style={[s.aiBadge, { backgroundColor: P.fatSoft }]}>
            <Ionicons name="flash" size={10} color={P.fat} />
            <Text style={[s.aiBadgeText, { color: P.fat }]}>AI</Text>
          </View>
        )}
      </View>

      <View style={[s.tagPill, { backgroundColor: soft }]}>
        <Ionicons name={insight.icon} size={10} color={tint} />
        <Text style={[s.tagPillText, { color: tint }]}>{insight.tag.toUpperCase()}</Text>
      </View>

      <Text style={[s.heroTitle, { color: P.text }]}>{insight.title}</Text>
      <Text style={[s.heroBody, { color: P.textDim }]}>{insight.body}</Text>

      <View style={[s.heroFoot, { borderTopColor: P.hair }]}>
        <Pressable style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
          <Ionicons name="thumbs-up-outline" size={14} color={P.textDim} />
          <Text style={[s.footBtnText, { color: P.textDim }]}>Helpful</Text>
        </Pressable>
        <View style={[s.footDivider, { backgroundColor: P.hair }]} />
        <Pressable onPress={onDismiss} style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
          <Ionicons name="eye-off-outline" size={14} color={P.textDim} />
          <Text style={[s.footBtnText, { color: P.textDim }]}>Dismiss</Text>
        </Pressable>
        <View style={[s.footDivider, { backgroundColor: P.hair }]} />
        <Pressable style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
          <Ionicons name="share-outline" size={14} color={P.textDim} />
          <Text style={[s.footBtnText, { color: P.textDim }]}>Share</Text>
        </Pressable>
      </View>
    </AnimatedCard>
  );
}

function EmptyInsightCard({ delay, onPress }: { delay: number; onPress?: () => void }) {
  const P = usePalette();
  return (
    <AnimatedCard delay={delay} padding={24} onPress={onPress}>
      <View style={s.emptyRow}>
        <View style={[s.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name="sparkles" size={15} color={P.fat} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.emptyTitle, { color: P.text }]}>No insight yet today</Text>
          <Text style={[s.emptyBody, { color: P.textFaint }]}>
            Keep logging — insights appear once you have data to analyse.
          </Text>
        </View>
      </View>
    </AnimatedCard>
  );
}

function PastInsightCard({ insight, delay, onPress }: { insight: DisplayInsight; delay: number; onPress: () => void }) {
  const P    = usePalette();
  const tint = P[insight.tint] as string;
  const soft = P[`${insight.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;

  return (
    <AnimatedCard delay={delay} padding={18} onPress={onPress}>
      <View style={s.pastHead}>
        <View style={[s.pastIcon, { backgroundColor: soft }]}>
          <Ionicons name={insight.icon} size={15} color={tint} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.pastTopRow}>
            <Text style={[s.pastTag, { color: tint }]}>{insight.tag.toUpperCase()}</Text>
            {insight.source === 'ai' && (
              <View style={[s.miniAi, { backgroundColor: P.fatSoft }]}>
                <Ionicons name="sparkles" size={8} color={P.fat} />
                <Text style={[s.miniAiText, { color: P.fat }]}>AI</Text>
              </View>
            )}
          </View>
          <Text style={[s.pastDate, { color: P.textFaint }]}>{insight.date}</Text>
        </View>
      </View>
      <Text style={[s.pastTitle, { color: P.text }]}>{insight.title}</Text>
      <Text style={[s.pastBody,  { color: P.textDim }]} numberOfLines={2}>{insight.body}</Text>
    </AnimatedCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop:        4,
    paddingBottom:     16,
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

  // ── Toggle ──
  toggleRow: {
    paddingHorizontal: 20,
    marginBottom:      16,
  },
  toggleTrack: {
    flexDirection: 'row',
    alignItems:    'center',
    borderRadius:  18,
    borderWidth:   StyleSheet.hairlineWidth,
    padding:       4,
    height:        46,
    position:      'relative',
  },
  togglePill: {
    position:     'absolute',
    left:         4,
    top:          4,
    bottom:       4,
    borderRadius: 14,
    borderWidth:  StyleSheet.hairlineWidth,
  },
  toggleTab: {
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    zIndex:         1,
  },
  toggleLabel: {
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: -0.2,
  },

  // ── Shared ──
  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    paddingVertical: 4,
  },
  loadingText: { fontSize: 13, fontWeight: '500' },

  glow: {
    position: 'absolute', top: -80, right: -60,
    width: 240, height: 240, borderRadius: 120,
  },
  iconTile: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  smallLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4,
  },

  // ── Week: consistency ──
  weekRangeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, gap: 10,
  },
  miniPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  miniPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, marginLeft: 'auto',
  },
  streakText: { fontSize: 11, fontWeight: '700' },
  consistencyLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  consistencyScoreRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 5,
    marginTop: 4, marginBottom: 12,
  },
  consistencyScore: { fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 54 },
  consistencyOf:    { fontSize: 13, fontWeight: '700', paddingBottom: 8 },

  progressTrack: { height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressFill:  { height: '100%', borderRadius: 4 },

  daysRow:  { flexDirection: 'row', gap: 5, height: 80, alignItems: 'flex-end' },
  dayCol:   { flex: 1, alignItems: 'center', gap: 5 },
  dayTrack: { width: '100%', height: 62, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  dayFill:  { width: '100%', borderRadius: 5 },
  dayLabel: { fontSize: 10, fontWeight: '700' },

  // ── Week: best day ──
  bestRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  trophyTile: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bestTitle:  { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  bestScore:  { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  bestReason: { fontSize: 12, fontWeight: '500', lineHeight: 18 },

  // ── Week: averages ──
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  avgGrid:   { flexDirection: 'row', flexWrap: 'wrap' },
  avgCell:   { width: '50%', paddingVertical: 10, gap: 3 },
  avgCellRight:  { borderRightWidth: StyleSheet.hairlineWidth, paddingRight: 14 },
  avgCellBottom: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14, marginBottom: 2 },
  avgIcon:   { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avgLabel:  { fontSize: 9,  fontWeight: '800', letterSpacing: 1.0 },
  avgValue:  { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  avgDelta:  { fontSize: 11, fontWeight: '500' },

  // ── Week: target bars ──
  targetHead:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  targetMetLabel:  { fontSize: 12, fontWeight: '600' },

  // ── Week: insight ──
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  insightBody: { fontSize: 14, fontWeight: '500', lineHeight: 22, letterSpacing: -0.1 },

  // ── Today: empty ──
  emptyRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  emptyBody:  { fontSize: 13, fontWeight: '400', lineHeight: 19 },

  // ── Today: section ──
  sectionHead:    { marginTop: 10, marginBottom: -2, gap: 2 },
  sectionTitle:   { fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  sectionCaption: { fontSize: 11, fontWeight: '500' },

  // ── Today: hero ──
  heroHead:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  heroMeta:    { fontSize: 11, fontWeight: '500' },
  aiBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  aiBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  tagPill:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  tagPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.0 },
  heroTitle:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginBottom: 10 },
  heroBody:    { fontSize: 14, fontWeight: '500', lineHeight: 22, letterSpacing: -0.1 },
  heroFoot:    { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  footBtnText: { fontSize: 11, fontWeight: '700' },
  footDivider: { width: StyleSheet.hairlineWidth, height: 16 },

  // ── Past list ──
  pastHead:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  pastIcon:   { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pastTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastTag:    { fontSize: 9, fontWeight: '800', letterSpacing: 1.0 },
  miniAi:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  miniAiText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },
  pastDate:   { fontSize: 11, fontWeight: '500' },
  pastTitle:  { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  pastBody:   { fontSize: 13, fontWeight: '500', lineHeight: 19, letterSpacing: -0.1 },
});
