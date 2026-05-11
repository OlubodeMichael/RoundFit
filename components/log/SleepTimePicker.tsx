import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import { usePalette } from '@/lib/log-theme'

// ── Geometry constants ────────────────────────────────────────────────────

const SIZE     = 284
const C        = SIZE / 2
const TRACK_R  = 112   // arc track radius
const LABEL_R  = 90    // hour number position radius
const HANDLE_R = 14    // draggable handle radius

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
const CARDINAL = new Set([12, 3, 6, 9])  // show AM/PM label on these

// ── Math helpers ──────────────────────────────────────────────────────────

function hourToDeg(h: number): number {
  return (h % 12) * 30  // 12→0°, 1→30°, … 11→330°
}

function degToXY(deg: number, r: number): [number, number] {
  const rad = (deg - 90) * (Math.PI / 180)
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)]
}

function xyToDeg(lx: number, ly: number): number {
  const rad = Math.atan2(ly - C, lx - C)
  return (rad * (180 / Math.PI) + 90 + 360) % 360
}

function snapToHour(deg: number): number {
  const snapped = (Math.round(deg / 30) * 30 + 360) % 360
  return snapped === 0 ? 12 : snapped / 30
}

function arcPath(startDeg: number, endDeg: number, r: number): string {
  const sweep = ((endDeg - startDeg) + 360) % 360
  const [x1, y1] = degToXY(startDeg, r)
  const [x2, y2] = degToXY(endDeg,   r)
  const large = sweep > 180 ? 1 : 0
  // Degenerate: if sweep ≈ 0, return a tiny arc so the path is valid
  if (sweep < 2) {
    const mid = degToXY(startDeg + 1, r)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${mid[0]} ${mid[1]}`
  }
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

// ── Time helpers ──────────────────────────────────────────────────────────

interface ClockTime { hour: number; period: 'AM' | 'PM' }

function parseClockString(s: string): ClockTime {
  const m = s.trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!m) return { hour: 11, period: 'PM' }
  let h = parseInt(m[1], 10)
  if (h < 1 || h > 12) h = 12
  const p = (m[3] as 'AM' | 'PM') ?? 'PM'
  return { hour: h, period: p }
}

function clockTimeToString(t: ClockTime): string {
  return `${t.hour}:00 ${t.period}`
}

function durationHours(bed: ClockTime, wake: ClockTime): number {
  const b24  = (bed.hour  % 12) + (bed.period  === 'PM' ? 12 : 0)
  const w24  = (wake.hour % 12) + (wake.period === 'PM' ? 12 : 0)
  const diff = ((w24 - b24) + 24) % 24
  return diff === 0 ? 24 : diff
}

// ── Component ─────────────────────────────────────────────────────────────

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

  const [bed,  setBed]  = useState<ClockTime>(() => parseClockString(bedtimeProp))
  const [wake, setWake] = useState<ClockTime>(() => parseClockString(wakeupProp))

  // Sync when picker opens
  useEffect(() => {
    if (visible) {
      setBed(parseClockString(bedtimeProp))
      setWake(parseClockString(wakeupProp))
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable refs for PanResponder (created once)
  const bedRef   = useRef(bed)
  const wakeRef  = useRef(wake)
  bedRef.current  = bed
  wakeRef.current = wake

  const clockRef    = useRef<View>(null)
  const clockPosRef = useRef({ x: 0, y: 0 })
  const activeRef   = useRef<'bed' | 'wake'>('bed')

  const measureClock = useCallback(() => {
    clockRef.current?.measure((_x, _y, _w, _h, px, py) => {
      clockPosRef.current = { x: px, y: py }
    })
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent
        const lx = pageX - clockPosRef.current.x
        const ly = pageY - clockPosRef.current.y

        const bedDeg  = hourToDeg(bedRef.current.hour)
        const wakeDeg = hourToDeg(wakeRef.current.hour)
        const [bx, by] = degToXY(bedDeg,  TRACK_R)
        const [wx, wy] = degToXY(wakeDeg, TRACK_R)
        const dBed  = Math.hypot(lx - bx, ly - by)
        const dWake = Math.hypot(lx - wx, ly - wy)
        activeRef.current = dBed <= dWake ? 'bed' : 'wake'
      },

      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent
        const lx  = pageX - clockPosRef.current.x
        const ly  = pageY - clockPosRef.current.y
        const deg = xyToDeg(lx, ly)
        const h   = snapToHour(deg)

        if (activeRef.current === 'bed')  setBed(prev  => ({ ...prev,  hour: h }))
        else                              setWake(prev => ({ ...prev, hour: h }))
      },
    }),
  ).current

  // Derived geometry
  const bedDeg  = hourToDeg(bed.hour)
  const wakeDeg = hourToDeg(wake.hour)
  const [bedX,  bedY]  = degToXY(bedDeg,  TRACK_R)
  const [wakeX, wakeY] = degToXY(wakeDeg, TRACK_R)
  const duration = durationHours(bed, wake)

  const SLEEP_CLR  = P.sleep        // indigo
  const WAKE_CLR   = '#F59E0B'      // amber — sunrise

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

        <View style={[s.sheet, { backgroundColor: P.bg, shadowColor: '#000' }]}>
          {/* Drag handle */}
          <View style={[s.dragHandle, { backgroundColor: P.cardEdge }]} />

          {/* Title */}
          <Text style={[s.title, { color: P.text }]}>Sleep Window</Text>

          {/* ── Top: start / duration / end ─────────────────── */}
          <View style={s.timesRow}>

            {/* Bedtime */}
            <View style={s.timeCol}>
              <View style={[s.timeIconRow]}>
                <View style={[s.iconPill, { backgroundColor: SLEEP_CLR + '22' }]}>
                  <Ionicons name="moon" size={12} color={SLEEP_CLR} />
                </View>
                <Text style={[s.timeEye, { color: P.textFaint }]}>BEDTIME</Text>
              </View>
              <Text style={[s.timeNum, { color: P.text }]}>
                {bed.hour}
                <Text style={[s.timeColon, { color: P.textDim }]}>:00</Text>
              </Text>
              <View style={s.periodRow}>
                {(['AM', 'PM'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    activeOpacity={0.75}
                    onPress={() => setBed(prev => ({ ...prev, period: p }))}
                    style={[
                      s.periodBtn,
                      { borderColor: P.cardEdge },
                      bed.period === p && { backgroundColor: SLEEP_CLR, borderColor: SLEEP_CLR },
                    ]}
                  >
                    <Text style={[s.periodTxt, { color: bed.period === p ? '#fff' : P.textDim }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duration badge */}
            <View style={[s.durBadge, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Text style={[s.durNum, { color: P.text }]}>{duration}</Text>
              <Text style={[s.durUnit, { color: P.textFaint }]}>hr</Text>
            </View>

            {/* Wakeup */}
            <View style={[s.timeCol, { alignItems: 'flex-end' }]}>
              <View style={[s.timeIconRow, { flexDirection: 'row-reverse' }]}>
                <View style={[s.iconPill, { backgroundColor: WAKE_CLR + '22' }]}>
                  <Ionicons name="sunny" size={12} color={WAKE_CLR} />
                </View>
                <Text style={[s.timeEye, { color: P.textFaint }]}>WAKE UP</Text>
              </View>
              <Text style={[s.timeNum, { color: P.text }]}>
                {wake.hour}
                <Text style={[s.timeColon, { color: P.textDim }]}>:00</Text>
              </Text>
              <View style={[s.periodRow, { justifyContent: 'flex-end' }]}>
                {(['AM', 'PM'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    activeOpacity={0.75}
                    onPress={() => setWake(prev => ({ ...prev, period: p }))}
                    style={[
                      s.periodBtn,
                      { borderColor: P.cardEdge },
                      wake.period === p && { backgroundColor: WAKE_CLR, borderColor: WAKE_CLR },
                    ]}
                  >
                    <Text style={[s.periodTxt, { color: wake.period === p ? '#fff' : P.textDim }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ── Clock face ──────────────────────────────────── */}
          <View
            ref={clockRef}
            onLayout={measureClock}
            style={s.clockWrap}
            {...panResponder.panHandlers}
          >
            <Svg width={SIZE} height={SIZE}>
              <Defs>
                <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={SLEEP_CLR} />
                  <Stop offset="100%" stopColor={WAKE_CLR} />
                </LinearGradient>
              </Defs>

              {/* Outer tick marks */}
              {Array.from({ length: 60 }, (_, i) => {
                const deg = i * 6
                const isHour = i % 5 === 0
                const r1 = TRACK_R + (isHour ? 10 : 6)
                const r2 = TRACK_R + (isHour ? 18 : 10)
                const [x1, y1] = degToXY(deg, r1)
                const [x2, y2] = degToXY(deg, r2)
                return (
                  <Line
                    key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={P.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}
                    strokeWidth={isHour ? 1.5 : 0.8}
                  />
                )
              })}

              {/* Background track */}
              <Circle
                cx={C} cy={C} r={TRACK_R}
                fill="none"
                stroke={P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}
                strokeWidth={10}
              />

              {/* Sleep arc */}
              <Path
                d={arcPath(bedDeg, wakeDeg, TRACK_R)}
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth={10}
                strokeLinecap="round"
              />

              {/* Hour labels */}
              {HOURS.map(h => {
                const deg    = hourToDeg(h)
                const [lx, ly] = degToXY(deg, LABEL_R)
                const isBed  = h === bed.hour
                const isWake = h === wake.hour
                const isCard = CARDINAL.has(h)
                const label  = isCard
                  ? (isBed ? `${h}${bed.period}` : isWake ? `${h}${wake.period}` : String(h))
                  : String(h)

                return (
                  <SvgText
                    key={h}
                    x={lx}
                    y={ly + 4.5}
                    textAnchor="middle"
                    fontSize={isBed || isWake ? 13 : 11}
                    fontWeight={isBed || isWake ? '800' : '500'}
                    fill={
                      isBed  ? SLEEP_CLR :
                      isWake ? WAKE_CLR  :
                      P.isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.30)'
                    }
                  >
                    {label}
                  </SvgText>
                )
              })}

              {/* Bedtime handle — moon */}
              <Circle cx={bedX}  cy={bedY}  r={HANDLE_R + 5} fill={P.isDark ? P.card : '#fff'} />
              <Circle cx={bedX}  cy={bedY}  r={HANDLE_R}     fill={SLEEP_CLR} />
              <Circle cx={bedX}  cy={bedY}  r={HANDLE_R - 5} fill={P.isDark ? P.card : '#fff'} opacity={0.3} />

              {/* Wakeup handle — sun */}
              <Circle cx={wakeX} cy={wakeY} r={HANDLE_R + 5} fill={P.isDark ? P.card : '#fff'} />
              <Circle cx={wakeX} cy={wakeY} r={HANDLE_R}     fill={WAKE_CLR} />
              <Circle cx={wakeX} cy={wakeY} r={HANDLE_R - 5} fill={P.isDark ? P.card : '#fff'} opacity={0.3} />
            </Svg>

            {/* Center label */}
            <View style={s.centerLabel} pointerEvents="none">
              <Text style={[s.centerDur, { color: P.text }]}>{duration}<Text style={[s.centerUnit, { color: P.textDim }]}> hr</Text></Text>
              <Text style={[s.centerSub, { color: P.textFaint }]}>SLEEP</Text>
            </View>
          </View>

          {/* ── Actions ─────────────────────────────────────── */}
          <View style={[s.actions, { paddingBottom: 8 }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onCancel}
              style={[s.cancelBtn, { borderColor: P.cardEdge }]}
            >
              <Text style={[s.cancelTxt, { color: P.textDim }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onConfirm(clockTimeToString(bed), clockTimeToString(wake))}
              style={[s.doneBtn, { backgroundColor: SLEEP_CLR }]}
            >
              <Text style={s.doneTxt}>Done</Text>
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
    paddingTop:    12,
    paddingBottom: 32,
    alignItems:    'center',
    shadowOpacity: 0.25,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: -6 },
    elevation:     16,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2, marginBottom: 14,
  },
  title: {
    fontSize: 17, fontWeight: '800', letterSpacing: -0.4, marginBottom: 18,
  },

  // ── Time row ──
  timesRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 28,
    width:          '100%',
    marginBottom:   6,
    gap:            12,
  },
  timeCol: {
    flex: 1,
  },
  timeIconRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginBottom:  4,
  },
  iconPill: {
    width: 20, height: 20, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  timeEye: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.4,
  },
  timeNum: {
    fontSize: 30, fontWeight: '800', letterSpacing: -1,
    lineHeight: 34,
  },
  timeColon: {
    fontSize: 18, fontWeight: '600',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  periodBtn: {
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      8,
    borderWidth:       1,
  },
  periodTxt: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
  },

  // ── Duration badge ──
  durBadge: {
    alignItems:        'center',
    paddingHorizontal: 10,
    paddingVertical:   12,
    borderRadius:      16,
    borderWidth:       1,
    flexDirection:     'column',
    minWidth:          52,
  },
  durNum: {
    fontSize: 22, fontWeight: '800', letterSpacing: -0.6,
  },
  durUnit: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 1,
  },

  // ── Clock ──
  clockWrap: {
    width:           SIZE,
    height:          SIZE,
    alignItems:      'center',
    justifyContent:  'center',
    marginVertical:  4,
  },
  centerLabel: {
    position:   'absolute',
    alignItems: 'center',
  },
  centerDur: {
    fontSize: 34, fontWeight: '800', letterSpacing: -1.2,
  },
  centerUnit: {
    fontSize: 16, fontWeight: '600',
  },
  centerSub: {
    fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: 1,
  },

  // ── Actions ──
  actions: {
    flexDirection:     'row',
    gap:               12,
    paddingHorizontal: 24,
    width:             '100%',
    marginTop:         8,
  },
  cancelBtn: {
    flex:            1,
    height:          52,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
  },
  cancelTxt: {
    fontSize: 15, fontWeight: '700',
  },
  doneBtn: {
    flex:            2,
    height:          52,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    flexDirection:   'row',
    gap:             6,
  },
  doneTxt: {
    fontSize: 15, fontWeight: '800', color: '#fff',
  },
})
