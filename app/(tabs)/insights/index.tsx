import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { DailyGoalsSummaryCard } from '@/components/insights/DailyGoalsSummaryCard';
import { InsightGradientCard } from '@/components/insights/InsightGradientCard';
import { GradientCard } from '@/components/ui/GradientCard';
import { useInsights } from '@/context/insights-context';
import type { Insight as ApiInsight } from '@/context/insights-context';
import { useWeeklyInsights } from '@/hooks/use-weekly-insights';
import {
  dayHasChartData,
  formatWeekRange,
  getDayLetter,
  getDayName,
  formatSleepHours,
  formatDelta,
  getWeekStart,
  type NormalizedDay,
  type InsightTargets,
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
  category: string;
}

function extractTitle(message: string): string {
  const dot = message.indexOf('. ');
  if (dot > 10 && dot < 72) return message.slice(0, dot);
  return message.length > 62 ? message.slice(0, 60).trimEnd() + '…' : message;
}

function categorizeInsight(title: string, isAi: boolean): string {
  const t = title.toLowerCase();
  if (t.includes('sleep') || t.includes('rest') || t.includes('bed')) return 'SLEEP';
  if (t.includes('protein') || t.includes('nutrition') || t.includes('calorie') || t.includes('food') || t.includes('eat')) return 'NUTRITION';
  if (t.includes('workout') || t.includes('exercise') || t.includes('training') || t.includes('session')) return 'FITNESS';
  if (t.includes('recovery') || t.includes('hrv') || t.includes('stress') || t.includes('cortisol')) return 'RECOVERY';
  if (t.includes('water') || t.includes('hydration')) return 'HYDRATION';
  if (t.includes('step') || t.includes('walk')) return 'ACTIVITY';
  return isAi ? 'RIS' : 'DAILY';
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
  if (diff < 0)   return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diff <= 6)  return d.toLocaleDateString(undefined, { weekday: 'long' });
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
  const title   = insight.title || extractTitle(insight.message);
  return {
    id: insight.id,
    isoDate,
    date: relativeDay(rawDate),
    dateLong: longDay(rawDate),
    tag: isAi ? 'RIS insight' : 'Daily insight',
    tint: isAi ? 'fat' : 'protein',
    icon: isAi ? 'sparkles' : 'bulb-outline',
    title,
    body: insight.message,
    source: isAi ? 'ai' : 'rule',
    category: categorizeInsight(title, isAi),
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

  const { todayInsight, claudeInsight, history, isLoading: insightLoading, dismissInsight } = useInsights();
  const { data: weekData, isLoading: weekLoading, isRefreshing: weekRefreshing, refresh: weekRefresh } =
    useWeeklyInsights(getWeekStart());

  const todayStr     = getLocalDateString();
  const todayDay     = weekData?.days.find(d => d.date === todayStr) ?? null;
  const todayTargets = weekData?.targets_snapshot ?? null;

  const heroSource  = claudeInsight ?? todayInsight;
  const heroDisplay = heroSource ? toDisplay(heroSource, new Date().toISOString()) : null;

  const pastDisplay = useMemo(() => {
    const today = getLocalDateString();
    return history
      .filter(i => !i.dismissed && i.date !== today)
      .map(i => toDisplay(i));
  }, [history]);

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
              todayDay={todayDay}
              todayTargets={todayTargets}
              isLoading={weekLoading}
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
  todayDay,
  todayTargets,
  isLoading,
  heroDisplay,
  heroSource,
  pastDisplay,
  onDismiss,
}: {
  todayDay:     NormalizedDay | null;
  todayTargets: InsightTargets | null;
  isLoading:    boolean;
  heroDisplay:  DisplayInsight | null;
  heroSource:   ApiInsight | null;
  pastDisplay:  DisplayInsight[];
  onDismiss:    (id: string) => void;
}) {
  const P      = usePalette();
  const router = useRouter();

  if (isLoading && !todayDay) {
    return (
      <View style={s.stack}>
        <AnimatedCard delay={60}>
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={P.calories} />
            <Text style={[s.loadingText, { color: P.textFaint }]}>Loading today's data…</Text>
          </View>
        </AnimatedCard>
      </View>
    );
  }

  // Date label — e.g. "WED, MAY 28"
  const cardDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase();

  // Targets
  const calBudget   = todayTargets?.calorie_budget ?? 2000;
  const protTarget  = todayTargets?.protein_target ?? 150;
  const stepsTarget = todayTargets?.steps_target   ?? 10000;
  const sleepTarget = todayTargets?.sleep_target   ?? 8;

  // Values
  const cals    = todayDay?.calories    ?? 0;
  const protein = todayDay?.protein     ?? 0;
  const steps   = todayDay?.steps       ?? null;
  const sleep   = todayDay?.sleep_hours ?? null;

  // Progress percentages (0–100, capped)
  const calPct   = calBudget   > 0 ? Math.min((cals    / calBudget)   * 100, 100) : 0;
  const protPct  = protTarget  > 0 ? Math.min((protein / protTarget)  * 100, 100) : 0;
  const stepsPct = stepsTarget > 0 && steps != null ? Math.min((steps / stepsTarget) * 100, 100) : 0;
  const sleepPct = sleepTarget > 0 && sleep != null ? Math.min((sleep / sleepTarget) * 100, 100) : 0;

  // Met status
  const metCal   = todayDay?.met_calories === 'met';
  const metProt  = todayDay?.met_protein  === 'met';
  const metSteps = todayDay?.met_steps    === 'met';
  const metSleep = todayDay?.met_sleep    === 'met';
  const goalsMetCount = [metCal, metProt, metSteps, metSleep].filter(Boolean).length;

  const miniGoals = [
    { label: 'Calories', pct: calPct,   met: metCal   },
    { label: 'Protein',  pct: protPct,  met: metProt  },
    { label: 'Steps',    pct: stepsPct, met: metSteps },
    { label: 'Sleep',    pct: sleepPct, met: metSleep },
  ];

  // Show goals card if user has logged food, OR if it's evening (≥17:00) and nothing logged yet
  const hasLogged     = cals > 0 || protein > 0;
  const isEvening     = new Date().getHours() >= 17;
  const showGoalsCard = hasLogged || isEvening;

  return (
    <View style={s.stack}>

      {/* ── Goals summary — visible when logged, or evening reminder ── */}
      {showGoalsCard ? (
        <DailyGoalsSummaryCard
          P={P}
          delay={60}
          dateLabel={cardDate}
          goalsMetCount={goalsMetCount}
          miniGoals={miniGoals}
        />
      ) : null}

      {/* ── Today's AI insight ──────────────────────────── */}
      {heroDisplay && (
        <InsightHeroCard
          insight={heroDisplay}
          delay={220}
          onDismiss={() => onDismiss(heroSource!.id)}
          onPress={() => router.push({ pathname: '/insights/daily', params: { date: heroDisplay.isoDate } })}
        />
      )}

      {/* ── Past insights ───────────────────────────────── */}
      {pastDisplay.length > 0 && (
        <>
          <View style={[s.sectionHead, { paddingHorizontal: 4 }]}>
            <Text style={[s.sectionTitle, { color: P.text }]}>Past insights</Text>
            <Text style={[s.sectionCaption, { color: P.textFaint }]}>
              {pastDisplay.length} earlier {pastDisplay.length === 1 ? 'insight' : 'insights'}
            </Text>
          </View>
          {pastDisplay.map((item, idx) => (
            <InsightPastCard
              key={item.id}
              insight={item}
              delay={280 + idx * 50}
              onPress={() => router.push({ pathname: '/insights/daily', params: { date: item.isoDate } })}
            />
          ))}
        </>
      )}

    </View>
  );
}

// ─── Week view (inline) ───────────────────────────────────────────────────────

function weekInsightPalette(P: ReturnType<typeof usePalette>) {
  return { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
}

function WeekInsightCard({
  P,
  delay,
  contentStyle,
  children,
}: {
  P: ReturnType<typeof usePalette>;
  delay: number;
  contentStyle?: object;
  children: React.ReactNode;
}) {
  return (
    <GradientCard
      variant="insightGrey"
      palette={weekInsightPalette(P)}
      corner="top-right"
      delay={delay}
      contentStyle={contentStyle}
    >
      {children}
    </GradientCard>
  );
}

function WeekView({ data, isLoading }: { data: ReturnType<typeof useWeeklyInsights>['data']; isLoading: boolean }) {
  const P = usePalette();

  if (isLoading && !data) {
    return (
      <View style={s.stack}>
        <WeekInsightCard P={P} delay={60} contentStyle={{ padding: 20 }}>
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={P.calories} />
            <Text style={[s.loadingText, { color: P.textFaint }]}>Loading weekly report…</Text>
          </View>
        </WeekInsightCard>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.stack}>
        <WeekInsightCard P={P} delay={60} contentStyle={{ padding: 24 }}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Ionicons name="bar-chart-outline" size={32} color={P.textFaint} />
            <Text style={[s.emptyTitle, { color: P.text, textAlign: 'center' }]}>No data yet</Text>
            <Text style={[s.emptyBody, { color: P.textFaint, textAlign: 'center' }]}>
              Log meals and workouts to generate your weekly report.
            </Text>
          </View>
        </WeekInsightCard>
      </View>
    );
  }

  const targets  = data.targets_snapshot;
  const todayStr = getLocalDateString();

  // "MAY 25 — 31" format
  const weekRangeLabel = (() => {
    const s = new Date(`${data.week_start}T12:00:00`);
    const e = new Date(`${data.week_end}T12:00:00`);
    const month = s.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return `${month} ${s.getDate()} — ${e.getDate()}`;
  })();

  const daysLogged = data.days.filter(d => !d.is_partial).length;

  const dayBars = data.days.map(d => ({
    label:   getDayLetter(d.date),
    score:   d.score,
    hasData: !d.is_partial,          // only fill bars for days with food logged
    isBest:  d.date === data.best_day_date,
    today:   d.date === todayStr,
  }));

  const bestDay = data.best_day_date
    ? data.days.find(d => d.date === data.best_day_date)
    : null;

  // "3 of 4 goals" for best day
  const bestDayStatuses = bestDay
    ? [bestDay.met_calories, bestDay.met_protein, bestDay.met_steps, bestDay.met_sleep]
    : [];
  const bestDayMet   = bestDayStatuses.filter(s => s === 'met').length;
  const bestDayTotal = bestDayStatuses.filter(s => s !== 'no-data').length;

  const avgCalDelta  = targets ? data.avg_calories - targets.calorie_budget : null;
  const avgProtDelta = targets ? data.avg_protein  - targets.protein_target : null;

  const averages = [
    {
      key: 'cals',  label: 'Calories',
      value: data.avg_calories > 0 ? data.avg_calories.toLocaleString() : '—',
      delta: avgCalDelta != null ? `${Math.abs(Math.round(avgCalDelta)).toLocaleString()} ${avgCalDelta < 0 ? 'below' : 'above'} target` : null,
      icon: 'flame-outline' as IoniconName,
    },
    {
      key: 'prot',  label: 'Protein',
      value: data.avg_protein > 0 ? `${data.avg_protein} g` : '—',
      delta: avgProtDelta != null ? `${Math.abs(Math.round(avgProtDelta))} g ${avgProtDelta < 0 ? 'below' : 'above'} target` : null,
      icon: 'pulse-outline' as IoniconName,
    },
    {
      key: 'sleep', label: 'Sleep',
      value: formatSleepHours(data.avg_sleep),
      delta: null,
      icon: 'moon-outline' as IoniconName,
    },
    {
      key: 'steps', label: 'Steps',
      value: data.avg_steps != null ? Math.round(data.avg_steps).toLocaleString() : '—',
      delta: null,
      icon: 'walk-outline' as IoniconName,
    },
  ];

  // Bar color: today = orange, best day = yellow, other logged = neutral
  const barColor = (d: { hasData: boolean; isBest: boolean; today: boolean }) => {
    if (!d.hasData) return 'transparent';
    if (d.today)    return P.calories;   // current day — orange
    if (d.isBest)   return P.carbs;      // best day — yellow/gold
    return P.isDark ? 'rgba(255,255,255,0.25)' : '#1C1C1E';
  };

  return (
    <View style={s.stack}>

      {/* ── Days logged + bar chart ──────────────────────── */}
      <WeekInsightCard P={P} delay={60} contentStyle={{ padding: 20 }}>
        <Text style={[s.weekRangeText, { color: P.textFaint }]}>{weekRangeLabel}</Text>

        <View style={s.daysLoggedRow}>
          <Text style={[s.daysLoggedNum, { color: P.text }]}>{daysLogged}</Text>
          <Text style={[s.daysLoggedOf, { color: P.text }]}> of 7 days logged</Text>
        </View>

        <View style={s.daysRow}>
          {dayBars.map((d, i) => {
            const pct = d.hasData ? Math.max(d.score / 100, 0.15) : 0;
            return (
              <View key={i} style={s.dayCol}>
                <View style={[s.dayTrack, { backgroundColor: P.sunken }]}>
                  {d.hasData && (
                    <View style={[s.dayFill, { height: `${pct * 100}%`, backgroundColor: barColor(d) }]} />
                  )}
                </View>
                <Text style={[s.dayLabel, {
                  color:      d.today ? P.calories : P.textFaint,
                  fontWeight: d.today ? '800' : '700',
                }]}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </WeekInsightCard>

      {/* ── Best day ──────────────────────────────────────── */}
      {bestDay && bestDayMet > 0 && (
        <WeekInsightCard P={P} delay={140} contentStyle={{ padding: 20 }}>
          <View style={s.bestRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.bestDayLabel, { color: P.textFaint }]}>BEST DAY</Text>
              <Text style={[s.bestDayName, { color: P.text }]}>{getDayName(bestDay.date)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={[s.bestDayGoals, { color: P.calories }]}>
                {bestDayMet} of {bestDayTotal} goals
              </Text>
              {bestDay.sleep_hours != null && (
                <Text style={[s.bestDaySleep, { color: P.textFaint }]}>
                  {formatSleepHours(bestDay.sleep_hours)} sleep
                </Text>
              )}
            </View>
          </View>
        </WeekInsightCard>
      )}

      {/* ── Daily averages ────────────────────────────────── */}
      <WeekInsightCard P={P} delay={200} contentStyle={{ padding: 18 }}>
        <Text style={[s.avgSectionTitle, { color: P.text }]}>Daily averages</Text>
        <View style={s.avgGrid}>
          {averages.map((a, i) => (
            <View key={a.key} style={[
              s.avgCell,
              { borderColor: P.hair },
              i % 2 === 0 && s.avgCellRight,
              i < 2      && s.avgCellBottom,
            ]}>
              <View style={s.avgIconRow}>
                <Ionicons name={a.icon} size={15} color={P.textFaint} />
                <Text style={[s.avgLabel, { color: P.textFaint }]}>{a.label}</Text>
              </View>
              <Text style={[s.avgValue, { color: P.text }]}>{a.value}</Text>
              {a.delta && <Text style={[s.avgDelta, { color: P.textFaint }]}>{a.delta}</Text>}
            </View>
          ))}
        </View>
      </WeekInsightCard>

    </View>
  );
}

// ─── Insight cards ───────────────────────────────────────────────────────────

function InsightHeroCard({ insight, delay, onDismiss, onPress }: {
  insight: DisplayInsight; delay: number; onDismiss: () => void; onPress: () => void;
}) {
  const P = usePalette();
  const cardP = {
    card: P.card,
    cardEdge: P.cardEdge,
    text: P.text,
    textDim: P.textDim,
    textFaint: P.textFaint,
    hair: P.hair,
    isDark: P.isDark,
  };

  return (
    <InsightGradientCard
      P={cardP}
      delay={delay}
      onPress={onPress}
      eyebrow={`Today's insight · ${insight.category}`}
      title={insight.title}
      body={insight.body}
      footer={
        <View style={s.heroFoot}>
          <Pressable style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
            <Ionicons name="thumbs-up-outline" size={16} color={P.textDim} />
            <Text style={[s.footBtnText, { color: P.textDim }]}>Helpful</Text>
          </Pressable>
          <View style={[s.footDivider, { backgroundColor: P.hair }]} />
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="eye-off-outline" size={16} color={P.textDim} />
            <Text style={[s.footBtnText, { color: P.textDim }]}>Dismiss</Text>
          </Pressable>
          <View style={[s.footDivider, { backgroundColor: P.hair }]} />
          <Pressable style={({ pressed }) => [s.footBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
            <Ionicons name="share-outline" size={16} color={P.textDim} />
            <Text style={[s.footBtnText, { color: P.textDim }]}>Share</Text>
          </Pressable>
        </View>
      }
    />
  );
}

function InsightPastCard({ insight, delay, onPress }: {
  insight: DisplayInsight; delay: number; onPress: () => void;
}) {
  const P = usePalette();
  return (
    <InsightGradientCard
      P={{
        card: P.card,
        cardEdge: P.cardEdge,
        text: P.text,
        textDim: P.textDim,
        textFaint: P.textFaint,
        hair: P.hair,
        isDark: P.isDark,
      }}
      delay={delay}
      onPress={onPress}
      compact
      icon="time-outline"
      eyebrow={insight.date.toUpperCase()}
      title={insight.title}
      body={insight.body}
    />
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
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  4,
  },
  title: {
    fontSize:      34,
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
    fontSize:      15,
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
  loadingText: { fontSize: 15, fontWeight: '500' },

  glow: {
    position: 'absolute', top: -80, right: -60,
    width: 240, height: 240, borderRadius: 120,
  },
  iconTile: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  smallLabel: {
    fontSize: 12, fontWeight: '800', letterSpacing: 1.4,
  },

  // ── Week: days logged card ──
  weekRangeText:  { fontSize: 14, fontWeight: '500', letterSpacing: 0.4, marginBottom: 12 },
  daysLoggedRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 0, marginBottom: 20 },
  daysLoggedNum:  { fontSize: 64, fontWeight: '800', letterSpacing: -2, lineHeight: 66 },
  daysLoggedOf:   { fontSize: 18, fontWeight: '500', paddingBottom: 10 },

  daysRow:  { flexDirection: 'row', gap: 5, height: 120, alignItems: 'flex-end' },
  dayCol:   { flex: 1, alignItems: 'center', gap: 5 },
  dayTrack: { width: '100%', height: 100, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  dayFill:  { width: '100%', borderRadius: 5 },
  dayLabel: { fontSize: 12, fontWeight: '700' },

  // ── Week: best day ──
  bestRow:     { flexDirection: 'row', alignItems: 'center' },
  bestDayLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, marginBottom: 4 },
  bestDayName:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  bestDayGoals: { fontSize: 15, fontWeight: '700' },
  bestDaySleep: { fontSize: 14, fontWeight: '400' },

  // ── Week: averages ──
  avgSectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 16 },
  avgGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  avgCell:     { width: '50%', paddingVertical: 10, gap: 4 },
  avgCellRight:  { borderRightWidth: StyleSheet.hairlineWidth, paddingRight: 14 },
  avgCellBottom: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14, marginBottom: 4 },
  avgIconRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  avgLabel:    { fontSize: 14, fontWeight: '500' },
  avgValue:    { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  avgDelta:    { fontSize: 13, fontWeight: '400' },

  // ── Today: empty ──
  emptyRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  emptyBody:  { fontSize: 15, fontWeight: '400', lineHeight: 22 },

  // ── Today: goals summary ──
  todayDateLabel: { fontSize: 12, fontWeight: '500', letterSpacing: 0.6, marginBottom: 12 },
  goalsRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 0, marginBottom: 20 },
  goalsBigNum:    { fontSize: 56, fontWeight: '800', letterSpacing: -2, lineHeight: 58 },
  goalsOfText:    { fontSize: 16, fontWeight: '500', paddingBottom: 9 },
  miniGoalsRow:   { flexDirection: 'row', gap: 10 },
  miniGoalCol:    { flex: 1, gap: 6 },
  miniGoalTrack:  { height: 3, borderRadius: 2, overflow: 'hidden' },
  miniGoalFill:   { height: '100%', borderRadius: 2 },
  miniGoalLabel:  { fontSize: 10, letterSpacing: 0.2 },

  // ── Today: hero (kept for insight cards) ──
  heroTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  heroEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroTitle:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, lineHeight: 32, marginBottom: 12 },
  heroBody:    { fontSize: 15, fontWeight: '400', lineHeight: 23, letterSpacing: -0.1 },
  heroFoot:    { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingHorizontal: 4, paddingBottom: 12 },
  footBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  footBtnText: { fontSize: 14, fontWeight: '600' },
  footDivider: { width: StyleSheet.hairlineWidth, height: 16 },

  // ── Past list (kept for insight cards) ──
  pastRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastPinCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pastDateLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  pastTitle:     { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  pastBody:      { fontSize: 13, fontWeight: '400', lineHeight: 19, letterSpacing: -0.1 },

  // ── Section header (kept for past insights) ──
  sectionHead:    { marginTop: 10, marginBottom: -2, gap: 3 },
  sectionTitle:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  sectionCaption: { fontSize: 14, fontWeight: '400' },
});
