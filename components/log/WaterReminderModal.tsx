import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { PICKER_H, WheelTimePicker, type TimeVal } from '@/components/ui/WheelTimePicker';
import { usePalette } from '@/lib/log-theme';
import { useNotifications } from '@/hooks/use-notifications';

// Shared with profile/notifications.tsx — same key keeps both screens in sync
const STORAGE_KEY = '@roundfit/notification_times_v1';
const DEFAULT_TIME: TimeVal = { hour: 9, minute: 0, period: 'AM' };

function displayTime({ hour, minute, period }: TimeVal) {
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function WaterReminderModal({ visible, onClose }: Props) {
  const P      = usePalette();
  const router = useRouter();
  const acc    = P.water;

  const { enabled, toggle, syncReminder } = useNotifications(['water']);
  const isOn = enabled.water ?? false;

  const [time, setTime] = useState<TimeVal>(DEFAULT_TIME);

  // Load saved water time from shared notification storage
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { times?: Record<string, TimeVal> };
        const t = parsed?.times?.water;
        if (t && typeof t.hour === 'number') setTime(t);
      } catch { /* use default */ }
    });
  }, [visible]);

  const handleTimeChange = (newTime: TimeVal) => {
    setTime(newTime);
  };

  const persistTime = async (): Promise<void> => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const current: { times: Record<string, TimeVal>; mealTimes: TimeVal[] } =
      raw ? JSON.parse(raw) : { times: {}, mealTimes: [] };
    current.times = { ...current.times, water: time };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  };

  const enableAndSchedule = async (): Promise<boolean> => {
    await persistTime();
    const ok = await toggle('water');
    if (!ok) return false;
    await syncReminder('water', time);
    return true;
  };

  const handleToggle = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isOn) {
      await toggle('water');
      return;
    }
    try {
      await enableAndSchedule();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSave = async () => {
    try {
      await persistTime();
      if (isOn) await syncReminder('water', time);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleEnable = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const ok = await enableAndSchedule();
      if (!ok) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      sheetHeight="full"
    >
      <View style={s.root}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={[s.headerIcon, { backgroundColor: acc + '18' }]}>
            <Ionicons name="alarm-outline" size={20} color={acc} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: P.text }]}>Water Reminder</Text>
            <Text style={[s.subtitle, { color: P.textDim }]}>Set a daily nudge to stay hydrated</Text>
          </View>
        </View>

        {/* ── Toggle card ───────────────────────────────────────────────── */}
        <View style={[s.card, {
          backgroundColor: P.isDark ? '#0E1219' : P.card,
          borderColor:     isOn ? acc + '45' : (P.isDark ? 'rgba(255,255,255,0.07)' : P.cardEdge),
        }]}>
          <View style={s.cardRow}>
            <View style={[s.cardIcon, { backgroundColor: isOn ? acc + '18' : (P.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
              <Ionicons name="water-outline" size={18} color={isOn ? acc : P.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: P.text }]}>Daily hydration reminder</Text>
              <Text style={[s.cardSub, { color: P.textDim }]}>
                {isOn ? `Reminder set for ${displayTime(time)}` : 'Tap to enable'}
              </Text>
            </View>
            <Switch
              value={isOn}
              onValueChange={handleToggle}
              trackColor={{
                false: P.isDark ? '#48484F' : '#E5E5EA',
                true:  acc + '80',
              }}
              thumbColor={isOn ? acc : P.isDark ? '#3A3A44' : '#C8C8CF'}
              ios_backgroundColor={P.isDark ? '#48484F' : '#E5E5EA'}
            />
          </View>
        </View>

        {/* ── Time label ────────────────────────────────────────────────── */}
        <View style={s.pickerLabel}>
          <Text style={[s.pickerLabelText, { color: P.textFaint }]}>REMINDER TIME</Text>
          <View style={[s.timePill, { backgroundColor: acc + '15', borderColor: acc + '30' }]}>
            <Text style={[s.timePillText, { color: acc }]}>{displayTime(time)}</Text>
          </View>
        </View>

        {/* ── Wheel picker ──────────────────────────────────────────────── */}
        <View style={s.pickerWrap}>
          <WheelTimePicker
            value={time}
            onChange={handleTimeChange}
            accentColor={acc}
            isDark={P.isDark}
          />
        </View>

        {/* ── Save button ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: isOn ? acc : P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          onPress={isOn ? handleSave : handleEnable}
          activeOpacity={0.85}
        >
          <Text style={[s.saveTxt, { color: isOn ? '#fff' : P.textDim }]}>
            {isOn ? 'Save Reminder' : 'Enable Reminder'}
          </Text>
        </TouchableOpacity>

        {/* ── Profile notifications link ────────────────────────────────── */}
        <TouchableOpacity
          style={s.linkRow}
          onPress={() => { onClose(); router.push('/(tabs)/profile/notifications'); }}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={13} color={P.textFaint} />
          <Text style={[s.linkText, { color: P.textFaint }]}>
            Manage all reminders in Notifications
          </Text>
          <Ionicons name="chevron-forward" size={11} color={P.textFaint} />
        </TouchableOpacity>

      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: 22, paddingTop: 8, gap: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  subtitle:   { fontSize: 13, fontWeight: '500', marginTop: 2 },

  card:    { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardSub:   { fontSize: 12, marginTop: 2 },

  pickerLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerLabelText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  timePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  timePillText: { fontSize: 13, fontWeight: '700' },

  pickerWrap: {
    width:          '100%',
    height:         PICKER_H,
    alignItems:     'center',
    justifyContent: 'center',
    marginVertical: 4,
  },

  saveBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  saveTxt: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', paddingVertical: 4 },
  linkText: { fontSize: 12, fontWeight: '500' },
});
