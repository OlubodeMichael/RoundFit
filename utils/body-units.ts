/**
 * Body measurement conversions. Stored profile values are always metric (cm, kg).
 * Profile `unit` is `metric` (cm, kg) or `imperial` (ft/in, lbs).
 */

export const CM_PER_IN = 2.54;
export const LB_PER_KG = 2.20462;

/** Profile `unit`: metric vs imperial for height/weight display. */
export type ProfileUnit = 'metric' | 'imperial';

/** Half-up rounding for metric display (avoids float noise from imperial conversion). */
function roundMetric(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/** Same rounding as profile stats: total inches, then split into ft/in. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_IN);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

export function formatHeightForStats(cm: number, unit: ProfileUnit): string {
  if (unit === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}′ ${inches}″`;
  }
  return `${roundMetric(cm, 1)} cm`;
}

export function formatWeightForStats(kg: number, unit: ProfileUnit): string {
  return unit === 'imperial'
    ? `${Math.round(kg * LB_PER_KG)} lbs`
    : `${roundMetric(kg, 1)} kg`;
}

export function formatHeightCmField(cm: number | undefined): string {
  if (cm === undefined || cm === null || Number.isNaN(cm)) return '';
  return String(roundMetric(cm, 1));
}

export function formatHeightImperialFields(cm: number | undefined): { feet: string; inches: string } {
  if (cm === undefined || cm === null || Number.isNaN(cm)) return { feet: '', inches: '' };
  const { feet, inches } = cmToFeetInches(cm);
  return { feet: String(feet), inches: String(inches) };
}

export function formatWeightKgField(kg: number | undefined, unit: ProfileUnit): string {
  if (kg === undefined || kg === null || Number.isNaN(kg)) return '';
  return unit === 'imperial'
    ? String(Math.round(kg * LB_PER_KG))
    : String(roundMetric(kg, 1));
}

export function parseHeightCmField(raw: string): number | undefined {
  const n = Number(String(raw).trim());
  if (String(raw).trim() === '' || Number.isNaN(n)) return undefined;
  return n;
}

/** At least one of feet/inches must be present with valid numbers. */
export function parseHeightImperialToCm(feetRaw: string, inchesRaw: string): number | undefined {
  const ftStr = feetRaw.trim();
  const inStr = inchesRaw.trim();
  if (!ftStr && !inStr) return undefined;
  const ft = ftStr === '' ? 0 : Number(ftStr);
  const inch = inStr === '' ? 0 : Number(inStr);
  if (Number.isNaN(ft) || Number.isNaN(inch) || ft < 0 || inch < 0) return undefined;
  return feetInchesToCm(ft, inch);
}

export function parseWeightFieldToKg(raw: string, unit: ProfileUnit): number | undefined {
  const n = Number(String(raw).trim());
  if (String(raw).trim() === '' || Number.isNaN(n)) return undefined;
  return unit === 'imperial' ? n / LB_PER_KG : n;
}

export function heightCmToStored(
  unit: ProfileUnit,
  heightCmField: string,
  heightFeet: string,
  heightInches: string,
): number | undefined {
  if (unit === 'metric') return parseHeightCmField(heightCmField);
  return parseHeightImperialToCm(heightFeet, heightInches);
}

export interface BodyFieldsState {
  heightCm: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
}

export function convertBodyFieldsForUnitChange(
  from: ProfileUnit,
  to: ProfileUnit,
  fields: BodyFieldsState,
): BodyFieldsState {
  if (from === to) return { ...fields };

  if (from === 'metric' && to === 'imperial') {
    const cm = parseHeightCmField(fields.heightCm);
    const hi = cm !== undefined ? formatHeightImperialFields(cm) : { feet: '', inches: '' };
    const wKg = parseWeightFieldToKg(fields.weight, 'metric');
    const w = wKg !== undefined ? formatWeightKgField(wKg, 'imperial') : '';
    return {
      heightCm: '',
      heightFeet: hi.feet,
      heightInches: hi.inches,
      weight: w,
    };
  }

  const cm = parseHeightImperialToCm(fields.heightFeet, fields.heightInches);
  const wKg = parseWeightFieldToKg(fields.weight, 'imperial');
  return {
    heightCm: cm !== undefined ? formatHeightCmField(cm) : '',
    heightFeet: '',
    heightInches: '',
    weight: wKg !== undefined ? formatWeightKgField(wKg, 'metric') : '',
  };
}
