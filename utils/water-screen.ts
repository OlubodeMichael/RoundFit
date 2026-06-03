const ML_PER_OZ = 29.5735;
const DEFAULT_GOAL_ML = 2000;

export { DEFAULT_GOAL_ML, ML_PER_OZ };

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function offsetDate(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function isToday(d: Date): boolean {
  const t = new Date();
  return localDateKey(d) === localDateKey(t);
}

export function formatNavLabel(d: Date): string {
  const today = new Date();
  if (localDateKey(d) === localDateKey(today)) return "Today";
  const yesterday = offsetDate(today, -1);
  if (localDateKey(d) === localDateKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function whatsLeft(
  progress: number,
  remainOz: number,
): { head: string; body: string } {
  const oz = Number.isFinite(remainOz) ? Math.ceil(Math.max(0, remainOz)) : 0;
  if (progress >= 1)
    return { head: "Goal crushed!", body: "You nailed your hydration today." };
  if (progress >= 0.9)
    return {
      head: "Almost there.",
      body: `One small glass — about ${oz} oz — wraps it.`,
    };
  if (progress >= 0.75)
    return { head: "Keep it up.", body: `Only ${oz} oz to go. Stay on track.` };
  if (progress >= 0.5)
    return { head: "Halfway there.", body: `${oz} oz to go. Keep sipping.` };
  if (progress >= 0.25)
    return {
      head: "Getting started.",
      body: `${oz} oz left. You've got this.`,
    };
  return {
    head: "Let's get going!",
    body: "Drink a big glass now to get on track.",
  };
}

export interface WaterDayStats {
  totalMl: number;
  goalMl: number;
  totalOz: number;
  goalOz: number;
  remainOz: number;
  progress: number;
  pct: number;
}

export function computeWaterDayStats(
  totalMl: number,
  goalMl: number,
): WaterDayStats {
  const safeGoal =
    Number.isFinite(goalMl) && goalMl > 0 ? goalMl : DEFAULT_GOAL_ML;
  const safeTotal = Number.isFinite(totalMl) && totalMl >= 0 ? totalMl : 0;
  const progress = Math.min(safeTotal / safeGoal, 1);
  const totalOz = safeTotal / ML_PER_OZ;
  const goalOz = safeGoal / ML_PER_OZ;
  const remainOz = Math.max(0, goalOz - totalOz);
  const pct = Math.round(progress * 100);

  return {
    totalMl: safeTotal,
    goalMl: safeGoal,
    totalOz,
    goalOz,
    remainOz,
    progress,
    pct,
  };
}

export function formatRemainOz(remainOz: number): string {
  if (!Number.isFinite(remainOz) || remainOz <= 0) return "Goal met";
  if (remainOz < 1) return "Under 1 oz left";
  return `${Math.ceil(remainOz)} oz left`;
}

export function formatOz(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(decimals);
}
