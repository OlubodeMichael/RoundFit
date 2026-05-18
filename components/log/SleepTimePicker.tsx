import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { usePalette } from '@/lib/log-theme'

// ── Clock geometry ────────────────────────────────────────────────────────

const SW         = Dimensions.get('window').width
const CLOCK_SIZE = Math.min(264, SW - 72)
const CENTER     = CLOCK_SIZE / 2
const NUM_R      = CLOCK_SIZE * 0.376  // ~99 at 264
const SEL_R      = CLOCK_SIZE * 0.076  // ~20 at 264

// ── Time helpers ──────────────────────────────────────────────────────────

interface ClockTime { hour: number; minute: number; period: 'AM' | 'PM' }

function parseClockString(s: string): ClockTime {
  const m = s.trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!m) return { hour: 11, minute: 0, period: 'PM' }
  let h = parseInt(m[1], 10)
  if (h < 1 || h > 12) h = 12
  const rawMin = m[2] ? parseInt(m[2], 10) : 0
  const minute = Math.round(rawMin / 5) * 5 % 60
  return { hour: h, minute, period: (m[3] as 'AM' | 'PM') ?? 'PM' }
}

function clockTimeToString(t: ClockTime): string {
  return `${t.hour}:${String(t.minute).padStart(2, '0')} ${t.period}`
}

function to24h(t: ClockTime): number {
  let h = t.hour
  if (t.period === 'PM' && h < 12) h += 12
  if (t.period === 'AM' && h === 12) h = 0
  return h * 60 + t.minute
}

function durationLabel(bed: ClockTime, wake: ClockTime): string {
  let diff = to24h(wake) - to24h(bed)
  if (diff <= 0) diff += 24 * 60
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// deg=0 → 12 o'clock, increases clockwise
function polarToCart(deg: number, r: number) {
  const rad = (deg - 90) * (Math.PI / 180)
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

// ── Clock face component ──────────────────────────────────────────────────

const HOUR_VALS   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTE_VALS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function ClockFace({
  mode, time, tint, P,
}: {
  mode: 'hour' | 'minute'
  time: ClockTime
  tint: string
  P:    ReturnType<typeof usePalette>
}) {
  const isMin    = mode === 'minute'
  const labels   = isMin ? MINUTE_VALS : HOUR_VALS
  const selValue = isMin ? time.minute : time.hour

  const handDeg = isMin ? time.minute * 6 : (time.hour % 12) * 30
  const handTip = polarToCart(handDeg, NUM_R)

  const clockBg = P.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const numClr  = P.isDark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)'

  return (
    <Svg width={CLOCK_SIZE} height={CLOCK_SIZE}>
      {/* Face */}
      <Circle cx={CENTER} cy={CENTER} r={CENTER - 2} fill={clockBg} />

      {/* Hand */}
      <Line
        x1={CENTER} y1={CENTER}
        x2={handTip.x} y2={handTip.y}
        stroke={tint}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Selection circle at hand tip */}
      <Circle cx={handTip.x} cy={handTip.y} r={SEL_R} fill={tint} />

      {/* Center dot */}
      <Circle cx={CENTER} cy={CENTER} r={5} fill={tint} />

      {/* Labels — rendered last so they sit above the selection circle */}
      {labels.map(val => {
        const deg   = isMin ? val * 6 : (val % 12) * 30
        const pos   = polarToCart(deg, NUM_R)
        const isSel = val === selValue
        const label = isMin ? String(val).padStart(2, '0') : String(val)
        return (
          <SvgText
            key={val}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={isMin ? 12 : 14}
            fontWeight="700"
            fill={isSel ? '#fff' : numClr}
          >
            {label}
          </SvgText>
        )
      })}
    </Svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export interface SleepTimePickerProps {
  visible:   boolean
  bedtime:   string
  wakeup:    string
  onConfirm: (bedtime: string, wakeup: string) => void
  onCancel:  () => void
}

export function SleepTimePicker({
  visible,
  bedtime:  bedtimeProp,
  wakeup:   wakeupProp,
  onConfirm,
  onCancel,
}: SleepTimePickerProps) {
  const P = usePalette()

  const [bed,        setBed]        = useState<ClockTime>(() => parseClockString(bedtimeProp))
  const [wake,       setWake]       = useState<ClockTime>(() => parseClockString(wakeupProp))
  const [editTarget, setEditTarget] = useState<'bed' | 'wake'>('bed')
  const [clockMode,  setClockMode]  = useState<'hour' | 'minute'>('hour')

  useEffect(() => {
    if (visible) {
      setBed(parseClockString(bedtimeProp))
      setWake(parseClockString(wakeupProp))
      setEditTarget('bed')
      setClockMode('hour')
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const SLEEP_CLR  = P.sleep
  const WAKE_CLR   = '#F59E0B'
  const tint       = editTarget === 'bed' ? SLEEP_CLR : WAKE_CLR
  const dur        = durationLabel(bed, wake)
  const activeTime = editTarget === 'bed' ? bed : wake

  // Refs keep PanResponder handlers free of stale closures
  const modeRef   = useRef(clockMode)
  const targetRef = useRef(editTarget)
  useEffect(() => { modeRef.current   = clockMode  }, [clockMode])
  useEffect(() => { targetRef.current = editTarget }, [editTarget])

  const handleTouchRef = useRef<(x: number, y: number, release?: boolean) => void>()
  handleTouchRef.current = (x, y, release = false) => {
    const dx = x - CENTER
    const dy = y - CENTER
    if (Math.sqrt(dx * dx + dy * dy) < 24) return

    const angle  = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360
    const setter = targetRef.current === 'bed' ? setBed : setWake

    if (modeRef.current === 'hour') {
      const h = Math.round(angle / 30) % 12
      setter(prev => ({ ...prev, hour: h === 0 ? 12 : h }))
    } else {
      const mIdx = Math.round(angle / 30) % 12
      setter(prev => ({ ...prev, minute: mIdx * 5 }))
    }

    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }

    // Auto-advance to minute mode when finger lifts after selecting hour
    if (release && modeRef.current === 'hour') {
      setClockMode('minute')
    }
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant:   e => handleTouchRef.current?.(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderMove:    e => handleTouchRef.current?.(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderRelease: e => handleTouchRef.current?.(e.nativeEvent.locationX, e.nativeEvent.locationY, true),
  }), [])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View style={[s.sheet, { backgroundColor: P.bg }]}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: P.cardEdge }]} />

          {/* Header */}
          <View style={s.header}>
            <Text style={[s.title, { color: P.text }]}>Sleep Window</Text>
            <View style={[s.durPill, {
              backgroundColor: SLEEP_CLR + '18',
              borderColor:     SLEEP_CLR + '38',
            }]}>
              <Ionicons name="moon-outline" size={13} color={SLEEP_CLR} />
              <Text style={[s.durTxt, { color: SLEEP_CLR }]}>{dur}</Text>
            </View>
          </View>

          {/* BEDTIME / WAKE UP tabs */}
          <View style={s.tabWrap}>
            <View style={[s.tabPill, { backgroundColor: P.sunken }]}>
              {(['bed', 'wake'] as const).map(target => {
                const isAct = editTarget === target
                const tc    = target === 'bed' ? SLEEP_CLR : WAKE_CLR
                const t     = target === 'bed' ? bed : wake
                return (
                  <Pressable
                    key={target}
                    onPress={() => { setEditTarget(target); setClockMode('hour') }}
                    style={({ pressed }) => [
                      s.tabBtn,
                      isAct && { backgroundColor: P.bg, borderColor: tc + '55', borderWidth: 1 },
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={s.tabIconRow}>
                      <Ionicons
                        name={target === 'bed' ? 'moon' : 'sunny'}
                        size={11}
                        color={isAct ? tc : P.textFaint}
                      />
                      <Text style={[s.tabLabel, { color: isAct ? tc : P.textFaint }]}>
                        {target === 'bed' ? 'BEDTIME' : 'WAKE UP'}
                      </Text>
                    </View>
                    <Text style={[s.tabTime, { color: isAct ? P.text : P.textDim }]}>
                      {clockTimeToString(t)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Clock face */}
          <View
            style={{ width: CLOCK_SIZE, height: CLOCK_SIZE, marginBottom: 14 }}
            {...panResponder.panHandlers}
          >
            <ClockFace mode={clockMode} time={activeTime} tint={tint} P={P} />
          </View>

          {/* HR | MIN  and  AM | PM controls */}
          <View style={s.controlRow}>
            <View style={[s.segWrap, { backgroundColor: P.sunken }]}>
              {(['hour', 'minute'] as const).map(m => (
                <Pressable
                  key={m}
                  onPress={() => setClockMode(m)}
                  style={[s.segBtn, clockMode === m && { backgroundColor: tint }]}
                >
                  <Text style={[s.segTxt, { color: clockMode === m ? '#fff' : P.textDim }]}>
                    {m === 'hour' ? 'HR' : 'MIN'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={[s.segWrap, { backgroundColor: P.sunken }]}>
              {(['AM', 'PM'] as const).map(p => {
                const isAct = activeTime.period === p
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      const setter = editTarget === 'bed' ? setBed : setWake
                      setter(t => ({ ...t, period: p }))
                    }}
                    style={[s.segBtn, isAct && { backgroundColor: tint }]}
                  >
                    <Text style={[s.segTxt, { color: isAct ? '#fff' : P.textDim }]}>{p}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Actions */}
          <View style={[s.actions, { borderTopColor: P.hair }]}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              style={[s.cancelBtn, { backgroundColor: P.sunken }]}
            >
              <Text style={[s.cancelTxt, { color: P.textDim }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(clockTimeToString(bed), clockTimeToString(wake))}
              activeOpacity={0.85}
              style={[s.doneBtn, { backgroundColor: SLEEP_CLR }]}
            >
              <Text style={s.doneTxt}>Save</Text>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 34, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 }, elevation: 20,
  },

  handle: { width: 36, height: 4, borderRadius: 2, marginTop: 14, marginBottom: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 24, marginBottom: 14,
  },
  title: { fontFamily: 'Syne_700Bold', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  durPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1,
  },
  durTxt: { fontFamily: 'Syne_700Bold', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },

  // Tabs
  tabWrap: { width: '100%', paddingHorizontal: 20, marginBottom: 16 },
  tabPill: { flexDirection: 'row', padding: 5, borderRadius: 18, gap: 6 },
  tabBtn:  { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 13, gap: 3 },
  tabIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  tabTime:  { fontFamily: 'Syne_700Bold', fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },

  // Controls row (HR|MIN + AM|PM)
  controlRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  segWrap:    { flexDirection: 'row', padding: 4, borderRadius: 99, gap: 2 },
  segBtn:     { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 99 },
  segTxt:     { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  // Actions
  actions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingTop: 14,
    width: '100%', borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '700' },
  doneBtn: {
    flex: 2, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  doneTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
})
