import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppModal } from "@/components/ui/AppModal";
import { useNotifications } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { openNotificationSettings } from "@/utils/notifications";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ── Palette ────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark
    ? {
        bg:     "#0A0B0F",
        card:   "#1C1D23",
        sunken: "#0E0F13",
        edge:   "rgba(255,255,255,0.08)",
        hair:   "rgba(255,255,255,0.07)",
        hi:     "#F4F4F5",
        mid:    "#909096",
        faint:  "#505058",
        accent: "#F97316",
        isDark: true,
      }
    : {
        bg:     "#F2F2F6",
        card:   "#FFFFFF",
        sunken: "#F7F7F9",
        edge:   "rgba(0,0,0,0.06)",
        hair:   "rgba(0,0,0,0.06)",
        hi:     "#09090B",
        mid:    "#6B7280",
        faint:  "#C0C0C8",
        accent: "#F97316",
        isDark: false,
      };
}

// ── Data ───────────────────────────────────────────────────────────────────

interface Reminder {
  id:     string;
  label:  string;
  sub:    string;
  icon:   IoniconsName;
  iconBg: string;
  hour:   number;
  minute: number;
  period: "AM" | "PM";
}

const REMINDERS: Reminder[] = [
  {
    id:     "morning",
    label:  "Morning Check-in",
    sub:    "Log your energy, mood and plan to start the day with clarity.",
    icon:   "sunny-outline",
    iconBg: "#FBBF24",
    hour:   7,
    minute: 0,
    period: "AM",
  },
  {
    id:     "meal",
    label:  "Meal Reminder",
    sub:    "Track meals at the right moments and stay consistent with nutrition.",
    icon:   "restaurant-outline",
    iconBg: "#F97316",
    hour:   12,
    minute: 30,
    period: "PM",
  },
  {
    id:     "workout",
    label:  "Workout Reminder",
    sub:    "Timely nudges to keep movement and training on your schedule.",
    icon:   "barbell-outline",
    iconBg: "#34D399",
    hour:   5,
    minute: 0,
    period: "PM",
  },
  {
    id:     "sleep",
    label:  "Sleep Reminder",
    sub:    "Wind down reminders to help you build a stable evening routine.",
    icon:   "moon-outline",
    iconBg: "#818CF8",
    hour:   10,
    minute: 0,
    period: "PM",
  },
  {
    id:     "summary",
    label:  "Daily Summary",
    sub:    "A quick recap of your progress to reflect and plan tomorrow.",
    icon:   "bar-chart-outline",
    iconBg: "#38BDF8",
    hour:   8,
    minute: 0,
    period: "PM",
  },
];

const MEAL_LABELS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const MAX_MEALS = 4;
const NOTIFICATION_TIMES_STORAGE_KEY = "@roundfit/notification_times_v1";

interface TimeVal {
  hour:   number;
  minute: number;
  period: "AM" | "PM";
}
interface PickerTarget {
  id:          string;
  mealIndex?:  number;
}
interface NotificationTimeSettings {
  times:     Record<string, TimeVal>;
  mealTimes: TimeVal[];
}

function displayTime({ hour, minute, period }: TimeVal) {
  return `${hour}:${String(minute).padStart(2, "0")} ${period}`;
}

function defaultTimesByReminderId(): Record<string, TimeVal> {
  return Object.fromEntries(
    REMINDERS.filter((r) => r.id !== "meal").map((r) => [
      r.id,
      { hour: r.hour, minute: r.minute, period: r.period },
    ]),
  );
}

function isTimeVal(v: unknown): v is TimeVal {
  if (!v || typeof v !== "object") return false;
  const t = v as TimeVal;
  return (
    typeof t.hour === "number" &&
    typeof t.minute === "number" &&
    (t.period === "AM" || t.period === "PM")
  );
}

function isNotificationTimeSettings(v: unknown): v is NotificationTimeSettings {
  if (!v || typeof v !== "object") return false;
  const s = v as NotificationTimeSettings;
  const entries = Object.values(s.times ?? {});
  return (
    Array.isArray(s.mealTimes) &&
    s.mealTimes.every(isTimeVal) &&
    entries.length > 0 &&
    entries.every(isTimeVal)
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const REMINDER_IDS = REMINDERS.map((r) => r.id);
  const {
    enabled,
    permissionStatus,
    hydrated: enabledHydrated,
    toggle: hookToggle,
    syncReminder,
    syncMealReminders,
  } = useNotifications(REMINDER_IDS);

  const [times, setTimes] = useState<Record<string, TimeVal>>(
    defaultTimesByReminderId(),
  );
  const [mealTimes, setMealTimes] = useState<TimeVal[]>([
    { hour: 12, minute: 30, period: "PM" },
  ]);
  const [hasHydratedTimes, setHasHydratedTimes] = useState(false);
  const [pickerTarget, setPickerTarget]           = useState<PickerTarget | null>(null);
  const [draft, setDraft]                         = useState<TimeVal>({ hour: 7, minute: 0, period: "AM" });

  async function toggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const wasOff = !enabled[id];
    await hookToggle(id);

    if (wasOff) {
      if (id === "meal") {
        await syncMealReminders(mealTimes);
      } else {
        await syncReminder(id, times[id]);
      }
    }
  }

  function openPicker(target: PickerTarget) {
    const current =
      target.id === "meal" && target.mealIndex !== undefined
        ? mealTimes[target.mealIndex]
        : times[target.id];
    setDraft(current);
    setPickerTarget(target);
  }

  async function confirmTime() {
    if (!pickerTarget) return;
    if (pickerTarget.id === "meal" && pickerTarget.mealIndex !== undefined) {
      const updated = mealTimes.map((t, i) => (i === pickerTarget.mealIndex ? draft : t));
      setMealTimes(updated);
      await syncMealReminders(updated);
    } else {
      setTimes((prev) => ({ ...prev, [pickerTarget.id]: draft }));
      await syncReminder(pickerTarget.id, draft);
    }
    setPickerTarget(null);
  }

  async function addMeal() {
    if (mealTimes.length >= MAX_MEALS) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const updated = [...mealTimes, { hour: 6, minute: 0, period: "PM" as const }];
    setMealTimes(updated);
    await syncMealReminders(updated);
  }

  async function removeMeal(index: number) {
    if (mealTimes.length <= 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const updated = mealTimes.filter((_, i) => i !== index);
    setMealTimes(updated);
    await syncMealReminders(updated);
  }

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(NOTIFICATION_TIMES_STORAGE_KEY);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!isNotificationTimeSettings(parsed)) return;
        setTimes(parsed.times);
        setMealTimes(parsed.mealTimes);
      } catch {
        // corrupt storage — use defaults
      } finally {
        setHasHydratedTimes(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!hasHydratedTimes) return;
    AsyncStorage.setItem(
      NOTIFICATION_TIMES_STORAGE_KEY,
      JSON.stringify({ times, mealTimes }),
    ).catch(() => {});
  }, [hasHydratedTimes, mealTimes, times]);

  // Re-schedule all active reminders once both enabled state and times are hydrated
  useEffect(() => {
    if (!enabledHydrated || !hasHydratedTimes) return;
    (async () => {
      for (const id of REMINDER_IDS) {
        if (!enabled[id]) continue;
        if (id === "meal") {
          await syncMealReminders(mealTimes);
        } else {
          await syncReminder(id, times[id]);
        }
      }
    })();
  }, [enabledHydrated, hasHydratedTimes]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeReminder = REMINDERS.find((r) => r.id === pickerTarget?.id);
  const pickerTitle =
    pickerTarget?.id === "meal" && pickerTarget.mealIndex !== undefined
      ? (MEAL_LABELS[pickerTarget.mealIndex] ?? "Meal")
      : activeReminder?.label;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: P.bg }}
        contentContainerStyle={{
          paddingTop:    insets.top + 12,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: P.card, borderColor: P.edge }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={P.hi} />
          </TouchableOpacity>

          <Text style={[s.eyebrow, { color: P.mid, marginTop: 20 }]}>PREFERENCES</Text>
          <Text style={[s.title, { color: P.hi }]}>Notifications</Text>
          <Text style={[s.titleSub, { color: P.mid }]}>
            Choose your reminders and when to receive them.
          </Text>
        </View>

        {/* ── Permission denied banner ── */}
        {permissionStatus === "denied" && (
          <TouchableOpacity
            style={[s.deniedBanner, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.20)" }]}
            onPress={openNotificationSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[s.deniedText, { color: P.hi }]}>Notifications are disabled</Text>
              <Text style={[s.deniedSub, { color: P.mid }]}>Tap to open Settings and enable them.</Text>
            </View>
            <Ionicons name="open-outline" size={14} color={P.faint} />
          </TouchableOpacity>
        )}

        {/* ── Reminder cards ── */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {REMINDERS.map((item) =>
            item.id === "meal" ? (
              <MealCard
                key={item.id}
                item={item}
                on={enabled.meal}
                mealTimes={mealTimes}
                onToggle={() => toggle("meal")}
                onTimePress={(idx) => openPicker({ id: "meal", mealIndex: idx })}
                onAdd={addMeal}
                onRemove={removeMeal}
                P={P}
              />
            ) : (
              <ReminderCard
                key={item.id}
                item={item}
                on={enabled[item.id]}
                time={times[item.id]}
                onToggle={() => toggle(item.id)}
                onTimePress={() => openPicker({ id: item.id })}
                P={P}
              />
            ),
          )}
        </View>

        {/* ── Note ── */}
        <View style={[s.note, { backgroundColor: P.card, borderColor: P.edge, marginTop: 16 }]}>
          <View style={[s.noteIcon, { backgroundColor: "rgba(249,115,22,0.10)" }]}>
            <Ionicons name="information-circle-outline" size={16} color={P.accent} />
          </View>
          <Text style={[s.noteText, { color: P.mid }]}>
            You&apos;ll be prompted for notification permission when you enable your first reminder.
          </Text>
        </View>
      </ScrollView>

      {/* ── Time picker sheet ── */}
      <AppModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTitle}
        sheetHeight={0.46}
      >
        <View style={s.sheetBody}>
          {/* Large time display */}
          <View style={[s.timeDisplay, { backgroundColor: P.sunken, borderColor: P.edge }]}>
            <Text style={[s.timeBig, { color: P.hi }]}>
              {String(draft.hour).padStart(2, "0")}
              <Text style={{ color: P.faint }}>:</Text>
              {String(draft.minute).padStart(2, "0")}
            </Text>
            <Text style={[s.timePeriod, { color: P.accent }]}>{draft.period}</Text>
          </View>

          {/* Drum controls */}
          <View style={s.controls}>
            <DrumControl
              label="HOUR"
              value={String(draft.hour).padStart(2, "0")}
              onDec={() => setDraft((d) => ({ ...d, hour: ((d.hour - 2 + 12) % 12) + 1 }))}
              onInc={() => setDraft((d) => ({ ...d, hour: (d.hour % 12) + 1 }))}
              P={P}
            />
            <Text style={[s.drumColon, { color: P.faint }]}>:</Text>
            <DrumControl
              label="MIN"
              value={String(draft.minute).padStart(2, "0")}
              onDec={() => setDraft((d) => ({ ...d, minute: (Math.round(d.minute / 5) * 5 - 5 + 60) % 60 }))}
              onInc={() => setDraft((d) => ({ ...d, minute: (Math.round(d.minute / 5) * 5 + 5) % 60 }))}
              P={P}
            />
            <View style={s.drumCol}>
              <Text style={[s.drumLabel, { color: P.mid }]}>PERIOD</Text>
              <View style={[s.periodWrap, { borderColor: P.edge, backgroundColor: P.sunken }]}>
                {(["AM", "PM"] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setDraft((d) => ({ ...d, period: p }))}
                    activeOpacity={0.7}
                    style={[s.periodBtn, draft.period === p && { backgroundColor: P.accent }]}
                  >
                    <Text style={[s.periodText, { color: draft.period === p ? "#FFF" : P.mid }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: P.accent }]}
            onPress={confirmTime}
            activeOpacity={0.8}
          >
            <Text style={s.confirmText}>Set Reminder</Text>
          </TouchableOpacity>
        </View>
      </AppModal>
    </>
  );
}

// ── ReminderCard ───────────────────────────────────────────────────────────

type P = ReturnType<typeof usePalette>;

function ReminderCard({
  item, on, time, onToggle, onTimePress, P,
}: {
  item:        Reminder;
  on:          boolean;
  time:        TimeVal;
  onToggle:    () => void;
  onTimePress: () => void;
  P:           P;
}) {
  return (
    <View style={[s.card, { backgroundColor: P.card, borderColor: on ? "rgba(249,115,22,0.25)" : P.edge }]}>
      {/* Main row */}
      <View style={s.cardRow}>
        <View style={[s.iconBox, { backgroundColor: item.iconBg }]}>
          <Ionicons name={item.icon} size={17} color="#FFF" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[s.cardLabel, { color: P.hi }]}>{item.label}</Text>
          <Text style={[s.cardSub, { color: P.mid }]} numberOfLines={2}>{item.sub}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={onToggle}
          trackColor={{ false: P.isDark ? "#48484F" : "#E5E5EA", true: "rgba(249,115,22,0.50)" }}
          thumbColor={on ? P.accent : P.isDark ? "#3A3A44" : "#C8C8CF"}
          ios_backgroundColor={P.isDark ? "#48484F" : "#E5E5EA"}
        />
      </View>

      {/* Expanded: time */}
      {on && (
        <>
          <View style={[s.divider, { backgroundColor: P.hair, marginHorizontal: 16 }]} />
          <TouchableOpacity style={s.timeRow} onPress={onTimePress} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={14} color={P.mid} />
            <Text style={[s.timeLabel, { color: P.mid }]}>Reminder at</Text>
            <View style={[s.timeChip, { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.22)" }]}>
              <Text style={[s.timeChipText, { color: P.accent }]}>{displayTime(time)}</Text>
              <Ionicons name="pencil-outline" size={11} color={P.accent} />
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ── MealCard ───────────────────────────────────────────────────────────────

function MealCard({
  item, on, mealTimes, onToggle, onTimePress, onAdd, onRemove, P,
}: {
  item:        Reminder;
  on:          boolean;
  mealTimes:   TimeVal[];
  onToggle:    () => void;
  onTimePress: (idx: number) => void;
  onAdd:       () => void;
  onRemove:    (idx: number) => void;
  P:           P;
}) {
  return (
    <View style={[s.card, { backgroundColor: P.card, borderColor: on ? "rgba(249,115,22,0.25)" : P.edge }]}>
      {/* Main row */}
      <View style={s.cardRow}>
        <View style={[s.iconBox, { backgroundColor: item.iconBg }]}>
          <Ionicons name={item.icon} size={17} color="#FFF" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[s.cardLabel, { color: P.hi }]}>{item.label}</Text>
          <Text style={[s.cardSub, { color: P.mid }]} numberOfLines={2}>{item.sub}</Text>
        </View>
        {on && (
          <View style={[s.countBadge, { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.20)" }]}>
            <Text style={[s.countText, { color: P.accent }]}>{mealTimes.length}</Text>
          </View>
        )}
        <Switch
          value={on}
          onValueChange={onToggle}
          trackColor={{ false: P.isDark ? "#48484F" : "#E5E5EA", true: "rgba(249,115,22,0.50)" }}
          thumbColor={on ? P.accent : P.isDark ? "#3A3A44" : "#C8C8CF"}
          ios_backgroundColor={P.isDark ? "#48484F" : "#E5E5EA"}
        />
      </View>

      {/* Expanded: meal slots */}
      {on && (
        <>
          <View style={[s.divider, { backgroundColor: P.hair, marginHorizontal: 16 }]} />
          {mealTimes.map((t, idx) => (
            <View key={idx}>
              {idx > 0 && (
                <View style={[s.divider, { backgroundColor: P.hair, marginHorizontal: 16 }]} />
              )}
              <View style={s.mealSlot}>
                <Text style={[s.mealLabel, { color: P.mid }]}>
                  {MEAL_LABELS[idx] ?? `Meal ${idx + 1}`}
                </Text>
                <TouchableOpacity
                  onPress={() => onTimePress(idx)}
                  activeOpacity={0.7}
                  style={[s.timeChip, { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.22)" }]}
                >
                  <Text style={[s.timeChipText, { color: P.accent }]}>{displayTime(t)}</Text>
                  <Ionicons name="pencil-outline" size={11} color={P.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onRemove(idx)}
                  hitSlop={8}
                  activeOpacity={0.6}
                  disabled={mealTimes.length <= 1}
                  style={{ opacity: mealTimes.length <= 1 ? 0.2 : 1 }}
                >
                  <Ionicons name="close-circle-outline" size={18} color={P.faint} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {mealTimes.length < MAX_MEALS && (
            <>
              <View style={[s.divider, { backgroundColor: P.hair, marginHorizontal: 16 }]} />
              <TouchableOpacity onPress={onAdd} activeOpacity={0.7} style={s.addRow}>
                <Ionicons name="add-circle-outline" size={16} color={P.accent} />
                <Text style={[s.addText, { color: P.accent }]}>Add meal time</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
}

// ── DrumControl ────────────────────────────────────────────────────────────

function DrumControl({
  label, value, onDec, onInc, P,
}: {
  label:  string;
  value:  string;
  onDec:  () => void;
  onInc:  () => void;
  P:      P;
}) {
  return (
    <View style={s.drumCol}>
      <Text style={[s.drumLabel, { color: P.mid }]}>{label}</Text>
      <View style={s.drumRow}>
        <TouchableOpacity
          onPress={onDec}
          style={[s.drumBtn, { backgroundColor: P.sunken, borderColor: P.edge }]}
          activeOpacity={0.6}
          hitSlop={8}
        >
          <Text style={[s.drumBtnText, { color: P.mid }]}>-</Text>
        </TouchableOpacity>
        <Text style={[s.drumVal, { color: P.hi }]}>{value}</Text>
        <TouchableOpacity
          onPress={onInc}
          style={[s.drumBtn, { backgroundColor: P.sunken, borderColor: P.edge }]}
          activeOpacity={0.6}
          hitSlop={8}
        >
          <Text style={[s.drumBtnText, { color: P.mid }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    11,
    borderWidth:     1,
    alignItems:      "center",
    justifyContent:  "center",
  },
  eyebrow:  { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title:    { fontFamily: "Syne_700Bold", fontSize: 28, letterSpacing: -0.6, lineHeight: 32, marginTop: 4 },
  titleSub: { fontSize: 13, lineHeight: 19, marginTop: 6 },

  // Permission denied banner
  deniedBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    marginHorizontal:  20,
    marginBottom:      10,
    padding:           14,
    borderRadius:      14,
    borderWidth:       1,
  },
  deniedText: { fontSize: 14, fontWeight: "600" },
  deniedSub:  { fontSize: 12, marginTop: 2 },

  // Card
  card: {
    borderRadius: 16,
    borderWidth:  1,
    overflow:     "hidden",
  },
  cardRow: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingHorizontal: 14,
    paddingVertical:   14,
    gap:            12,
  },
  iconBox: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  cardLabel: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  cardSub:   { fontSize: 12, lineHeight: 17 },

  divider: { height: StyleSheet.hairlineWidth },

  // Time row
  timeRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  timeLabel: { flex: 1, fontSize: 13, fontWeight: "500" },
  timeChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      8,
    borderWidth:       1,
  },
  timeChipText: { fontSize: 13, fontWeight: "600" },

  // Count badge
  countBadge: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontWeight: "700" },

  // Meal slots
  mealSlot: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 14,
    paddingVertical:   11,
    gap:               10,
  },
  mealLabel: { flex: 1, fontSize: 13, fontWeight: "500" },

  addRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               7,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  addText: { fontSize: 13, fontWeight: "600" },

  // Note
  note: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    marginHorizontal:  20,
    padding:           14,
    borderRadius:      14,
    borderWidth:       1,
  },
  noteIcon: {
    width:          30,
    height:         30,
    borderRadius:   8,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // Sheet
  sheetBody: { paddingHorizontal: 24, paddingTop: 8, gap: 24 },
  timeDisplay: {
    flexDirection:  "row",
    alignItems:     "baseline",
    justifyContent: "center",
    gap:            10,
    borderRadius:   16,
    borderWidth:    1,
    paddingVertical: 18,
  },
  timeBig: {
    fontFamily:          "Syne_700Bold",
    fontSize:            52,
    letterSpacing:       -2,
    includeFontPadding:  false,
  },
  timePeriod: {
    fontFamily:    "Syne_700Bold",
    fontSize:      20,
    letterSpacing: -0.5,
    marginBottom:  4,
  },
  controls: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
  },
  drumCol:   { alignItems: "center", gap: 8 },
  drumLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  drumRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  drumBtn: {
    width:          36,
    height:         36,
    borderRadius:   10,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
  },
  drumBtnText: { fontSize: 18, fontWeight: "700", lineHeight: 20 },
  drumVal: {
    fontFamily:         "Syne_700Bold",
    fontSize:           24,
    letterSpacing:      -0.5,
    minWidth:           36,
    textAlign:          "center",
    includeFontPadding: false,
  },
  drumColon: {
    fontFamily:         "Syne_700Bold",
    fontSize:           24,
    marginBottom:       22,
    includeFontPadding: false,
  },
  periodWrap: {
    borderRadius:  10,
    borderWidth:   1,
    overflow:      "hidden",
    flexDirection: "column",
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    alignItems:        "center",
  },
  periodText:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  confirmBtn:  { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  confirmText: { color: "#FFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
});
