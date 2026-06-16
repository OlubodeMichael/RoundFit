/** SVG viewBox for the hydration jar */
export const JAR_VIEW_W = 120;
export const JAR_VIEW_H = 210;

export const JAR_DISPLAY_SCALE_DEFAULT = 1.42;
export const JAR_DISPLAY_SCALE_COMPACT = 1.02;
/** Home hydration card — fits beside stats in the progress row */
export const JAR_DISPLAY_SCALE_CARD = 0.48;

/** Interior clip — mason jar body */
export const JAR_CLIP_PATH = [
  'M 38 24',
  'L 82 24',
  'C 84 30 92 38 102 48',
  'L 106 172',
  'C 106 192 62 198 60 198',
  'C 58 198 14 192 14 172',
  'L 18 48',
  'C 28 38 36 30 38 24',
  'Z',
].join(' ');

/** Glass outline (stroke) */
export const JAR_OUTLINE_PATH = [
  'M 36 20',
  'L 84 20',
  'C 86 26 94 36 104 46',
  'L 108 172',
  'C 108 194 62 200 60 200',
  'C 58 200 12 194 12 172',
  'L 16 46',
  'C 26 36 34 26 36 20',
  'Z',
].join(' ');

/** Lid ring */
export const JAR_LID_PATH = [
  'M 32 18',
  'L 88 18',
  'C 90 18 90 22 88 23',
  'L 32 23',
  'C 30 22 30 18 32 18',
  'Z',
].join(' ');

export const JAR_INTERIOR_TOP_Y = 24;
export const JAR_INTERIOR_BOTTOM_Y = 198;
export const JAR_INTERIOR_HEIGHT = JAR_INTERIOR_BOTTOM_Y - JAR_INTERIOR_TOP_Y;

/** Extra width so sloshing water still covers the jar interior */
export const SLOSH_EXTRA_X = 36;

export function buildWaterBodyPath(
  fillY: number,
  wavePhase: number,
  amplitude: number,
): string {
  const left = 14 - SLOSH_EXTRA_X;
  const right = 106 + SLOSH_EXTRA_X;
  const bottom = JAR_INTERIOR_BOTTOM_Y;
  const segments = 14;
  const width = right - left;

  let wave = `L ${right} ${bottom} L ${right} ${fillY}`;

  for (let i = segments; i >= 0; i -= 1) {
    const t = i / segments;
    const x = left + width * t;
    const waveY =
      fillY +
      Math.sin(t * Math.PI * 2 + wavePhase) * amplitude +
      Math.sin(t * Math.PI * 4 + wavePhase * 1.3) * (amplitude * 0.35);
    wave += ` L ${x.toFixed(1)} ${waveY.toFixed(1)}`;
  }

  return `M ${left} ${bottom}${wave} Z`;
}

export function fillLevelY(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return JAR_INTERIOR_BOTTOM_Y - p * JAR_INTERIOR_HEIGHT;
}
