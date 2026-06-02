import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

const MAX_TILT_PX = 48;
const TILT_GAIN = 92;
const TILT_LERP = 0.18;
const UPDATE_MS = 32;
const WAVE_SPEED = 2.4;

export interface WaterSloshState {
  /** Horizontal offset of the water mass in SVG units */
  tiltX: number;
  /** Radians for the surface wave animation */
  wavePhase: number;
}

export function useWaterSlosh(active: boolean): WaterSloshState {
  const [tiltX, setTiltX] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);
  const smoothedTilt = useRef(0);
  const waveStart = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      smoothedTilt.current = 0;
      setTiltX(0);
      return;
    }

    let mounted = true;
    Accelerometer.setUpdateInterval(UPDATE_MS);

    const sub = Accelerometer.addListener(({ x }) => {
      if (!mounted || !Number.isFinite(x)) return;
      const target = Math.max(-MAX_TILT_PX, Math.min(MAX_TILT_PX, x * TILT_GAIN));
      smoothedTilt.current += (target - smoothedTilt.current) * TILT_LERP;
      setTiltX(smoothedTilt.current);
    });

    return () => {
      mounted = false;
      sub.remove();
      smoothedTilt.current = 0;
      setTiltX(0);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      setWavePhase(0);
      return;
    }

    let frame = 0;
    const tick = () => {
      const elapsed = (Date.now() - waveStart.current) / 1000;
      setWavePhase(elapsed * WAVE_SPEED);
      frame = requestAnimationFrame(tick);
    };
    waveStart.current = Date.now();
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return { tiltX, wavePhase };
}
