import React, { useMemo, useRef, useState } from 'react'
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
import Svg, {
  Circle,
  G,
  Path,
  Text as SvgText,
} from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'

// ── Geometry ──────────────────────────────────────────────────────────────
//
// Apple Health Bedtime convention — 24-hour dial with midnight at the top:
//   • 12 AM (minute 0)   → 0°    (top of circle)
//   • 6 AM  (minute 360) → 90°   (right)
//   • 12 PM (minute 720) → 180°  (bottom)
//   • 6 PM  (minute 1080)→ 270°  (left)

const SW          = Dimensions.get('window').width
const DIAL        = Math.min(330, SW - 32)
const CENTER     = DIAL / 2

const RING_OUTER_R = CENTER - 6
const RING_INNER_R = CENTER - 60        // 54px thick ring
const RING_MID_R   = (RING_OUTER_R + RING_INNER_R) / 2
const RING_W       = RING_OUTER_R - RING_INNER_R
const FACE_R       = RING_INNER_R - 4   // inner dial face radius
const HANDLE_SIZE  = 38                 // bed / alarm icon container
const SNAP_MIN     = 5

const BED_COLOR  = '#4ED8E0' // cyan
const WAKE_COLOR = '#F5C137' // amber
const RING_BG    = '#000'    // outer ring — pure black (outside the sleep window)
const RING_ARC   = '#48484D' // sleep arc — lighter gray, the moving portion
const FACE_BG    = '#2A2A2E' // inner dial face
const TOOTH_CLR  = 'rgba(255,255,255,0.32)' // subtle striations on the arc
const HOUR_TICK  = 'rgba(255,255,255,0.20)'

// ── Time helpers ──────────────────────────────────────────────────────────

interface ClockTime { totalMin: number }

function parseClockString(s: string): ClockTime {
  const m = s.trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!m) return { totalMin: 23 * 60 }
  let h = parseInt(m[1], 10)
  if (!Number.isFinite(h)) h = 11
  const minutes = m[2] ? parseInt(m[2], 10) : 0
  const period  = (m[3] as 'AM' | 'PM' | undefined) ?? 'PM'
  if (period === 'PM' && h < 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return { totalMin: (h * 60 + minutes) % 1440 }
}

function clockTimeToString(t: ClockTime): string {
  const min = ((t.totalMin % 1440) + 1440) % 1440
  const h24 = Math.floor(min / 60)
  const m   = min % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function durationLabel(bed: ClockTime, wake: ClockTime): string {
  let diff = wake.totalMin - bed.totalMin
  if (diff <= 0) diff += 1440
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

// ── Angle / point conversions ─────────────────────────────────────────────

function minToAngle(min: number): number {
  return ((min % 1440) / 1440) * 360
}

function angleToMin(angle: number): number {
  const a = ((angle % 360) + 360) % 360
  return Math.round((a / 360) * 1440) % 1440
}

function snapMinutes(min: number): number {
  return ((Math.round(min / SNAP_MIN) * SNAP_MIN) % 1440 + 1440) % 1440
}

function angleToXY(angle: number, r: number) {
  const rad = (angle - 90) * Math.PI / 180
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

function pointToAngle(x: number, y: number): number {
  const dx = x - CENTER
  const dy = y - CENTER
  let theta = Math.atan2(dy, dx) * 180 / Math.PI + 90
  if (theta < 0) theta += 360
  return theta
}

/** Simple arc along the ring centerline — used as a stroked path so that
 *  `strokeLinecap="round"` gives us perfect semicircular endcaps without
 *  having to construct them manually. */
function arcCenterlinePath(fromAngle: number, toAngle: number, r: number): string {
  const start = angleToXY(fromAngle, r)
  const end   = angleToXY(toAngle, r)
  const sweep = ((toAngle - fromAngle) + 360) % 360
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  visible:   boolean
  bedtime:   string
  wakeup:    string
  onConfirm: (bedtime: string, wakeup: string) => void
  onCancel:  () => void
}

type DragTarget = 'bed' | 'wake' | 'arc' | null

export function SleepTimePicker({ visible, bedtime, wakeup, onConfirm, onCancel }: Props) {
  const [bed,  setBed]  = useState<ClockTime>(() => parseClockString(bedtime))
  const [wake, setWake] = useState<ClockTime>(() => parseClockString(wakeup))

  React.useEffect(() => {
    if (!visible) return
    setBed(parseClockString(bedtime))
    setWake(parseClockString(wakeup))
  }, [visible, bedtime, wakeup])

  const bedAngle  = minToAngle(bed.totalMin)
  const wakeAngle = minToAngle(wake.totalMin)

  // ── Drag state ─────────────────────────────────────────────────────────
  const dragRef = useRef<DragTarget>(null)
  const arcStartRef = useRef<{
    startAngle: number
    bedMin:     number
    wakeMin:    number
  } | null>(null)
  const lastSnapRef = useRef<{ bed: number; wake: number }>({ bed: -1, wake: -1 })

  const updateFromTouch = (locX: number, locY: number, isStart: boolean) => {
    const angle = pointToAngle(locX, locY)

    if (isStart) {
      const distBed  = Math.abs(((angle - bedAngle  + 540) % 360) - 180)
      const distWake = Math.abs(((angle - wakeAngle + 540) % 360) - 180)
      const HANDLE_GRAB_DEG = 16
      if (distBed < HANDLE_GRAB_DEG && distBed <= distWake) {
        dragRef.current = 'bed'
      } else if (distWake < HANDLE_GRAB_DEG) {
        dragRef.current = 'wake'
      } else {
        dragRef.current = 'arc'
        arcStartRef.current = {
          startAngle: angle,
          bedMin:     bed.totalMin,
          wakeMin:    wake.totalMin,
        }
      }
    }

    if (dragRef.current === 'bed') {
      const next = snapMinutes(angleToMin(angle))
      if (next !== lastSnapRef.current.bed) {
        lastSnapRef.current.bed = next
        void Haptics.selectionAsync().catch(() => {})
        setBed({ totalMin: next })
      }
    } else if (dragRef.current === 'wake') {
      const next = snapMinutes(angleToMin(angle))
      if (next !== lastSnapRef.current.wake) {
        lastSnapRef.current.wake = next
        void Haptics.selectionAsync().catch(() => {})
        setWake({ totalMin: next })
      }
    } else if (dragRef.current === 'arc' && arcStartRef.current) {
      const deltaDeg = angle - arcStartRef.current.startAngle
      const deltaMin = Math.round((deltaDeg / 360) * 1440)
      const newBed   = snapMinutes((arcStartRef.current.bedMin  + deltaMin + 1440) % 1440)
      const newWake  = snapMinutes((arcStartRef.current.wakeMin + deltaMin + 1440) % 1440)
      if (newBed !== lastSnapRef.current.bed || newWake !== lastSnapRef.current.wake) {
        lastSnapRef.current = { bed: newBed, wake: newWake }
        void Haptics.selectionAsync().catch(() => {})
        setBed({ totalMin: newBed })
        setWake({ totalMin: newWake })
      }
    }
  }

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant:   e => updateFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY, true),
    onPanResponderMove:    e => updateFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY, false),
    onPanResponderRelease: () => {
      dragRef.current = null
      arcStartRef.current = null
      lastSnapRef.current = { bed: -1, wake: -1 }
    },
    onPanResponderTerminate: () => {
      dragRef.current = null
      arcStartRef.current = null
      lastSnapRef.current = { bed: -1, wake: -1 }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bedAngle, wakeAngle, bed.totalMin, wake.totalMin])

  const bedPos  = angleToXY(bedAngle,  RING_MID_R)
  const wakePos = angleToXY(wakeAngle, RING_MID_R)

  // Hour ticks inside the dial face — short radial marks at every hour.
  const hourTicks = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const angle = (i / 24) * 360
      const inner = angleToXY(angle, FACE_R - 6)
      const outer = angleToXY(angle, FACE_R - (i % 6 === 0 ? 12 : 8))
      return { d: `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}` }
    })
  }, [])

  // Hour labels every 2 hours.
  const hourLabels = useMemo(() => {
    return [
      { min: 0,    text: '12AM' },
      { min: 120,  text: '2'    },
      { min: 240,  text: '4'    },
      { min: 360,  text: '6AM'  },
      { min: 480,  text: '8'    },
      { min: 600,  text: '10'   },
      { min: 720,  text: '12PM' },
      { min: 840,  text: '2'    },
      { min: 960,  text: '4'    },
      { min: 1080, text: '6PM'  },
      { min: 1200, text: '8'    },
      { min: 1320, text: '10'   },
    ].map(it => {
      const angle = minToAngle(it.min)
      const p     = angleToXY(angle, FACE_R - 28)
      const isCardinal = it.min === 0 || it.min === 720
      return { ...it, x: p.x, y: p.y + 4, cardinal: isCardinal }
    })
  }, [])

  // Comb striations on the gray arc — small radial lines on the OUTER half
  // of the ring, pointing inward from the outer edge. Stops short of the
  // rounded endcaps so the icons sit on a clean curve.
  const teeth = useMemo(() => {
    const sweep = ((wakeAngle - bedAngle) + 360) % 360
    // Reserve a few degrees on each end so the teeth don't bleed into the
    // rounded endcaps where the icons live.
    const endcapDeg = (RING_W / 2) / RING_MID_R * 180 / Math.PI + 4
    const usableSweep = Math.max(0, sweep - endcapDeg * 2)
    const step = 2.2
    const count = Math.floor(usableSweep / step)
    return Array.from({ length: count }).map((_, i) => {
      const a = bedAngle + endcapDeg + i * step + step / 2
      const inner = angleToXY(a, RING_OUTER_R - 14)
      const outer = angleToXY(a, RING_OUTER_R - 2)
      return { d: `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}` }
    })
  }, [bedAngle, wakeAngle])

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

        <View style={s.sheet}>
          <View style={s.grabHandle} />

          {/* Title */}
          <Text style={s.title}>Bedtime and Wake Up</Text>

          {/* Card containing time labels + dial + duration */}
          <View style={s.card}>
            {/* Two-column time display */}
            <View style={s.timeRow}>
              <View style={s.timeCol}>
                <View style={s.timeLabelRow}>
                  <Ionicons name="bed" size={13} color={BED_COLOR} />
                  <Text style={[s.timeLabel, { color: BED_COLOR }]}>BEDTIME</Text>
                </View>
                <Text style={s.timeValue}>{clockTimeToString(bed)}</Text>
              </View>
              <View style={s.timeCol}>
                <View style={s.timeLabelRow}>
                  <Ionicons name="alarm" size={13} color="rgba(255,255,255,0.5)" />
                  <Text style={[s.timeLabel, { color: 'rgba(255,255,255,0.5)' }]}>WAKE UP</Text>
                </View>
                <Text style={[s.timeValue, { color: 'rgba(255,255,255,0.55)' }]}>
                  {clockTimeToString(wake)}
                </Text>
              </View>
            </View>

            {/* Dial */}
            <View
              style={{ width: DIAL, height: DIAL, marginTop: 8 }}
              {...pan.panHandlers}
            >
              <Svg width={DIAL} height={DIAL}>
                {/* Outer dark ring (full circle) */}
                <Circle
                  cx={CENTER} cy={CENTER}
                  r={RING_MID_R}
                  stroke={RING_BG}
                  strokeWidth={RING_W}
                  fill="none"
                />

                {/* Sleep arc — stroked path with rounded endcaps. The round
                    linecap naturally extends by RING_W / 2 past the endpoint
                    angle, giving us perfect semicircles where the icons sit. */}
                <Path
                  d={arcCenterlinePath(bedAngle, wakeAngle, RING_MID_R)}
                  stroke={RING_ARC}
                  strokeWidth={RING_W}
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Comb striations on the gray arc, pointing inward */}
                <G>
                  {teeth.map((t, i) => (
                    <Path
                      key={i}
                      d={t.d}
                      stroke={TOOTH_CLR}
                      strokeWidth={1}
                      strokeLinecap="round"
                    />
                  ))}
                </G>

                {/* Inner dial face */}
                <Circle
                  cx={CENTER} cy={CENTER}
                  r={FACE_R}
                  fill={FACE_BG}
                />

                {/* Hour tick marks INSIDE the dial face */}
                <G>
                  {hourTicks.map((t, i) => (
                    <Path
                      key={i}
                      d={t.d}
                      stroke={HOUR_TICK}
                      strokeWidth={i % 6 === 0 ? 1.5 : 1}
                      strokeLinecap="round"
                    />
                  ))}
                </G>

                {/* Hour labels */}
                <G>
                  {hourLabels.map((h, i) => (
                    <SvgText
                      key={i}
                      x={h.x}
                      y={h.y}
                      fontSize={h.cardinal ? 13 : 14}
                      fontWeight={h.cardinal ? '700' : '500'}
                      fill={h.cardinal ? '#fff' : 'rgba(255,255,255,0.55)'}
                      textAnchor="middle"
                    >
                      {h.text}
                    </SvgText>
                  ))}
                </G>
              </Svg>

              {/* Decorative icons inside the dial face */}
              <View
                pointerEvents="none"
                style={[
                  s.faceIcon,
                  {
                    left: angleToXY(minToAngle(0),   FACE_R * 0.35).x - 12,
                    top:  angleToXY(minToAngle(0),   FACE_R * 0.35).y - 12,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={22} color={BED_COLOR} />
              </View>
              <View
                pointerEvents="none"
                style={[
                  s.faceIcon,
                  {
                    left: angleToXY(minToAngle(720), FACE_R * 0.35).x - 12,
                    top:  angleToXY(minToAngle(720), FACE_R * 0.35).y - 12,
                  },
                ]}
              >
                <Ionicons name="sunny" size={22} color={WAKE_COLOR} />
              </View>

              {/* Bed icon — centered inside the bedtime endcap. The endcap is
                  a semicircle of radius RING_W / 2 created by strokeLinecap,
                  so the icon naturally sits within it without its own
                  background. */}
              <View
                pointerEvents="none"
                style={[
                  s.endcapIcon,
                  {
                    left: bedPos.x - HANDLE_SIZE / 2,
                    top:  bedPos.y - HANDLE_SIZE / 2,
                  },
                ]}
              >
                <Ionicons name="bed" size={18} color={BED_COLOR} />
              </View>

              {/* Alarm icon — centered inside the wakeup endcap */}
              <View
                pointerEvents="none"
                style={[
                  s.endcapIcon,
                  {
                    left: wakePos.x - HANDLE_SIZE / 2,
                    top:  wakePos.y - HANDLE_SIZE / 2,
                  },
                ]}
              >
                <Ionicons name="alarm" size={18} color="rgba(255,255,255,0.75)" />
              </View>
            </View>

            {/* Duration */}
            <Text style={s.duration}>{durationLabel(bed, wake)}</Text>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              style={s.cancelBtn}
            >
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(clockTimeToString(bed), clockTimeToString(wake))}
              activeOpacity={0.85}
              style={s.doneBtn}
            >
              <Text style={s.doneTxt}>Save</Text>
              <Ionicons name="checkmark" size={16} color="#000" />
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
    backgroundColor:     '#000',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom:       34,
    paddingHorizontal:   16,
    alignItems:          'center',
    shadowColor:         '#000',
    shadowOpacity:       0.4,
    shadowRadius:        24,
    shadowOffset:        { width: 0, height: -8 },
    elevation:           20,
  },
  grabHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 12, marginBottom: 18,
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  card: {
    width: '100%',
    backgroundColor: '#1A1A1D',
    borderRadius: 22,
    paddingTop: 18,
    paddingBottom: 22,
    alignItems: 'center',
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 40,
    marginBottom: 10,
  },
  timeCol: { alignItems: 'center', gap: 4 },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  timeValue: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },

  endcapIcon: {
    position:        'absolute',
    width:           HANDLE_SIZE,
    height:          HANDLE_SIZE,
    alignItems:      'center',
    justifyContent:  'center',
    // No background — the rounded endcap of the arc stroke is the visual
    // container. The icon just floats centered on the endpoint.
  },
  faceIcon: { position: 'absolute' },

  duration: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 14,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700' },
  doneBtn: {
    flex: 2, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
    backgroundColor: '#fff',
  },
  doneTxt: { color: '#000', fontSize: 15, fontWeight: '800' },
})
