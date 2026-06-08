import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { PICKER_H, WheelTimePicker, type TimeVal } from '@/components/ui/WheelTimePicker';
import { usePalette } from '@/lib/log-theme';
import { useNotifications } from '@/hooks/use-notifications';
import {
  computeIntervalTimes,
  DEFAULT_WATER_CONFIG,
  type WaterReminderConfig,
} from '@/utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATER_CONFIG_KEY = '@roundfit/water_reminder_config_v1';

const INTERVALS: { label: string; value: number }[] = [
  { label: '1h',   value: 1   },
  { label: '1.5h', value: 1.5 },
  { label: '2h',   value: 2   },
  { label: '3h',   value: 3   },
];

function fmt({ hour, minute, period }: TimeVal) {
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

type PickerTarget = 'start' | 'end' | number | null; // number = times index

export function WaterReminderModal({ visible, onClose }: Props) {
  const P      = usePalette();
  const router = useRouter();
  const acc    = P.water;

  const { enabled, toggle, syncWaterReminders } = useNotifications(['water']);
  const isOn = enabled.water ?? false;

  const [config,        setConfig]        = useState<WaterReminderConfig>(DEFAULT_WATER_CONFIG);
  const [pickerTarget,  setPickerTarget]  = useState<PickerTarget>(null);
  const [pickerVal,     setPickerVal]     = useState<TimeVal>({ hour: 8, minute: 0, period: 'AM' });

  // Load saved config on open
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(WATER_CONFIG_KEY).then(raw => {
      if (!raw) return;
      try { setConfig(JSON.parse(raw) as WaterReminderConfig); }
      catch { /* use default */ }
    });
    setPickerTarget(null);
  }, [visible]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const previewTimes = config.mode === 'interval'
    ? computeIntervalTimes(config.intervalHours, config.windowStart, config.windowEnd)
    : config.times;

  // ── Picker helpers ─────────────────────────────────────────────────────────

  function openPicker(target: PickerTarget, initial: TimeVal) {
    setPickerVal(initial);
    setPickerTarget(prev => prev === target ? null : target);
  }

  function commitPicker() {
    if (pickerTarget === null) return;
    if (pickerTarget === 'start') {
      setConfig(c => ({ ...c, windowStart: pickerVal }));
    } else if (pickerTarget === 'end') {
      setConfig(c => ({ ...c, windowEnd: pickerVal }));
    } else {
      setConfig(c => {
        const times = [...c.times];
        times[pickerTarget as number] = pickerVal;
        return { ...c, times };
      });
    }
    setPickerTarget(null);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleToggle = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isOn) { await toggle('water'); return; }
    const granted = await toggle('water');
    if (granted) await syncWaterReminders(config);
  };

  const handleSave = async () => {
    try {
      // Commit any open picker before saving
      if (pickerTarget !== null) commitPicker();
      await syncWaterReminders(config);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // ── Colours ────────────────────────────────────────────────────────────────

  const cardBg     = P.isDark ? '#0E1219' : P.card;
  const chipActive = acc;
  const chipInactive = P.isDark ? '#252530' : '#F0EFEC';
  const borderOn   = acc + '45';
  const borderOff  = P.isDark ? 'rgba(255,255,255,0.07)' : P.cardEdge;

  return (
    <AppModal visible={visible} onClose={onClose} sheetHeight="full">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.root}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={[s.headerIcon, { backgroundColor: acc + '18' }]}>
            <Ionicons name="alarm-outline" size={20} color={acc} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: P.text }]}>Water Reminders</Text>
            <Text style={[s.subtitle, { color: P.textDim }]}>Stay hydrated throughout the day</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={[s.cancelBtn, { backgroundColor: P.isDark ? '#252530' : '#F0EFEC' }]}
            activeOpacity={0.7}
          >
            <Text style={[s.cancelTxt, { color: P.textDim }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* ── Enable toggle ───────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: isOn ? borderOn : borderOff }]}>
          <View style={s.cardRow}>
            <View style={[s.cardIcon, { backgroundColor: isOn ? acc + '18' : (P.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
              <Ionicons name="water-outline" size={18} color={isOn ? acc : P.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: P.text }]}>Daily hydration reminders</Text>
              <Text style={[s.cardSub, { color: P.textDim }]}>
                {isOn ? `${previewTimes.length} reminder${previewTimes.length !== 1 ? 's' : ''} scheduled` : 'Tap to enable'}
              </Text>
            </View>
            <Switch
              value={isOn}
              onValueChange={handleToggle}
              trackColor={{ false: P.isDark ? '#48484F' : '#E5E5EA', true: acc + '80' }}
              thumbColor={isOn ? acc : P.isDark ? '#3A3A44' : '#C8C8CF'}
              ios_backgroundColor={P.isDark ? '#48484F' : '#E5E5EA'}
            />
          </View>
        </View>

        {/* ── Mode selector ───────────────────────────────────────────────── */}
        <View style={[s.modeSeg, { backgroundColor: P.isDark ? '#141519' : '#ECEAE6' }]}>
          {(['interval', 'times'] as const).map(mode => {
            const active = config.mode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[s.modePill, active && { backgroundColor: P.isDark ? '#1C1D23' : '#FFF' }]}
                onPress={() => { setConfig(c => ({ ...c, mode })); setPickerTarget(null); }}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={mode === 'interval' ? 'timer-outline' : 'list-outline'}
                  size={13}
                  color={active ? acc : P.textDim}
                />
                <Text style={[s.modePillText, { color: active ? P.text : P.textDim }]}>
                  {mode === 'interval' ? 'Interval' : 'Set times'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Interval mode ───────────────────────────────────────────────── */}
        {config.mode === 'interval' && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: P.textFaint }]}>FREQUENCY</Text>
            <View style={s.chips}>
              {INTERVALS.map(({ label, value }) => {
                const active = config.intervalHours === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[s.chip, { backgroundColor: active ? chipActive : chipInactive }]}
                    onPress={() => setConfig(c => ({ ...c, intervalHours: value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipText, { color: active ? '#FFF' : P.textDim }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[s.sectionLabel, { color: P.textFaint, marginTop: 16 }]}>ACTIVE WINDOW</Text>
            <View style={s.windowRow}>
              {(['start', 'end'] as const).map(key => {
                const val = key === 'start' ? config.windowStart : config.windowEnd;
                const isActive = pickerTarget === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.timeRow, { backgroundColor: cardBg, borderColor: isActive ? acc : borderOff }]}
                    onPress={() => openPicker(key, val)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.timeRowLabel, { color: P.textDim }]}>
                      {key === 'start' ? 'From' : 'To'}
                    </Text>
                    <Text style={[s.timeRowVal, { color: isActive ? acc : P.text }]}>{fmt(val)}</Text>
                    <Ionicons name="chevron-down" size={14} color={isActive ? acc : P.textFaint} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Preview */}
            {previewTimes.length > 0 && (
              <View style={[s.preview, { backgroundColor: acc + '10', borderColor: acc + '25' }]}>
                <Ionicons name="notifications-outline" size={12} color={acc} />
                <Text style={[s.previewText, { color: acc }]}>
                  {previewTimes.length} reminder{previewTimes.length !== 1 ? 's' : ''}:{' '}
                  {previewTimes.map(fmt).join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Times mode ──────────────────────────────────────────────────── */}
        {config.mode === 'times' && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: P.textFaint }]}>REMINDER TIMES</Text>
            <View style={s.timesList}>
              {config.times.map((t, i) => {
                const isActive = pickerTarget === i;
                return (
                  <View key={i} style={[s.timeChip, { backgroundColor: cardBg, borderColor: isActive ? acc : borderOff }]}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => openPicker(i, t)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.timeChipText, { color: isActive ? acc : P.text }]}>{fmt(t)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => {
                        if (pickerTarget === i) setPickerTarget(null);
                        setConfig(c => ({ ...c, times: c.times.filter((_, j) => j !== i) }));
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color={P.textFaint} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {config.times.length < 8 && (
                <TouchableOpacity
                  style={[s.addBtn, { borderColor: acc + '40', backgroundColor: acc + '0C' }]}
                  onPress={() => {
                    const newTime: TimeVal = { hour: 9, minute: 0, period: 'AM' };
                    const newIndex = config.times.length;
                    setConfig(c => ({ ...c, times: [...c.times, newTime] }));
                    setPickerTarget(newIndex);
                    setPickerVal(newTime);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="add" size={16} color={acc} />
                  <Text style={[s.addBtnText, { color: acc }]}>Add time</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Inline picker ───────────────────────────────────────────────── */}
        {pickerTarget !== null && (
          <View style={s.pickerBlock}>
            <View style={s.pickerLabelRow}>
              <Text style={[s.pickerLabelText, { color: P.textFaint }]}>
                {pickerTarget === 'start' ? 'FROM' : pickerTarget === 'end' ? 'TO' : `REMINDER ${(pickerTarget as number) + 1}`}
              </Text>
              <View style={[s.timePill, { backgroundColor: acc + '15', borderColor: acc + '30' }]}>
                <Text style={[s.timePillText, { color: acc }]}>{fmt(pickerVal)}</Text>
              </View>
            </View>
            <View style={[s.pickerWrap, { height: PICKER_H }]}>
              <WheelTimePicker
                value={pickerVal}
                onChange={setPickerVal}
                accentColor={acc}
                isDark={P.isDark}
              />
            </View>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: acc + '18', borderColor: acc + '30' }]}
              onPress={commitPicker}
              activeOpacity={0.8}
            >
              <Text style={[s.confirmBtnText, { color: acc }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Save ────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: isOn ? acc : P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[s.saveTxt, { color: isOn ? '#fff' : P.textDim }]}>
            {isOn ? 'Save Reminders' : 'Enable & Save'}
          </Text>
        </TouchableOpacity>

        {/* ── Profile link ────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.linkRow}
          onPress={() => { onClose(); router.push('/(tabs)/profile/notifications'); }}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={13} color={P.textFaint} />
          <Text style={[s.linkText, { color: P.textFaint }]}>Manage all reminders in Notifications</Text>
          <Ionicons name="chevron-forward" size={11} color={P.textFaint} />
        </TouchableOpacity>

      </ScrollView>
    </AppModal>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 32, gap: 14 },

  header:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  subtitle:   { fontSize: 13, fontWeight: '500', marginTop: 2 },
  cancelBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  cancelTxt:  { fontSize: 14, fontWeight: '600' },

  card:    { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardSub:   { fontSize: 12, marginTop: 2 },

  modeSeg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  modePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  modePillText: { fontSize: 14, fontWeight: '600' },

  section:      { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },

  chips:    { flexDirection: 'row', gap: 8 },
  chip:     { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },

  windowRow: { flexDirection: 'row', gap: 10 },
  timeRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  timeRowLabel: { fontSize: 12, fontWeight: '600' },
  timeRowVal:   { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'right' },

  preview: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  previewText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },

  timesList: { gap: 8 },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  timeChipText: { fontSize: 15, fontWeight: '700' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
    paddingVertical: 13,
  },
  addBtnText: { fontSize: 14, fontWeight: '700' },

  pickerBlock:    { gap: 10 },
  pickerLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerLabelText:{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  timePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  timePillText: { fontSize: 13, fontWeight: '700' },
  pickerWrap:   { width: '100%', alignItems: 'center', justifyContent: 'center' },
  confirmBtn: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 11, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700' },

  saveBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  saveTxt: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', paddingVertical: 4 },
  linkText: { fontSize: 12, fontWeight: '500' },
});
