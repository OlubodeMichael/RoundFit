export interface CardAccent {
  gradient: readonly [string, string, string];
  iconBg: string;
  iconSoft: string;
}

export type CardAccentVariant =
  | 'steps'
  | 'distance'
  | 'macros'
  | 'meals'
  | 'workouts'
  | 'insight'
  | 'readiness'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'water'
  | 'calories';

export interface CardAccentOptions {
  goalComplete?: boolean;
  readinessScore?: number;
}

function accentFromRgb(
  isDark: boolean,
  rgb: string,
  main: string,
): CardAccent {
  return {
    gradient: isDark
      ? [`rgba(${rgb},0.06)`, `rgba(${rgb},0.01)`, 'transparent']
      : [`rgba(${rgb},0.05)`, `rgba(${rgb},0.01)`, 'transparent'],
    iconBg: main,
    iconSoft: isDark ? `rgba(${rgb},0.22)` : `rgba(${rgb},0.10)`,
  };
}

export function stepsAccent(isDark: boolean, goalComplete: boolean): CardAccent {
  if (goalComplete) {
    return accentFromRgb(isDark, '52,211,153', '#34D399');
  }
  return accentFromRgb(isDark, '56,189,248', '#38BDF8');
}

export function distanceAccent(isDark: boolean): CardAccent {
  return isDark
    ? accentFromRgb(true, '129,140,248', '#818CF8')
    : accentFromRgb(false, '79,70,229', '#4F46E5');
}

export function macrosAccent(isDark: boolean): CardAccent {
  return isDark
    ? accentFromRgb(true, '251,191,36', '#FBBF24')
    : accentFromRgb(false, '217,119,6', '#D97706');
}

export function mealsAccent(isDark: boolean): CardAccent {
  return isDark
    ? accentFromRgb(true, '255,120,73', '#FF7849')
    : accentFromRgb(false, '234,88,12', '#EA580C');
}

export function workoutsAccent(isDark: boolean): CardAccent {
  return isDark
    ? accentFromRgb(true, '34,211,238', '#22D3EE')
    : accentFromRgb(false, '8,145,178', '#0891B2');
}

export function insightAccent(isDark: boolean): CardAccent {
  return isDark
    ? accentFromRgb(true, '167,139,250', '#A78BFA')
    : accentFromRgb(false, '124,58,237', '#7C3AED');
}

export function readinessAccent(score: number, isDark: boolean): CardAccent {
  const band = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
  const tones = {
    high: { main: '#34D399', rgb: '52,211,153' },
    mid: { main: '#FBBF24', rgb: '251,191,36' },
    low: {
      main: isDark ? '#FF7849' : '#EA580C',
      rgb: isDark ? '255,120,73' : '234,88,12',
    },
  } as const;
  return accentFromRgb(isDark, tones[band].rgb, tones[band].main);
}

export function proteinAccent(isDark: boolean): CardAccent {
  return accentFromRgb(isDark, '52,211,153', '#34D399');
}

export function carbsAccent(isDark: boolean): CardAccent {
  return accentFromRgb(isDark, '251,191,36', '#FBBF24');
}

export function fatAccent(isDark: boolean): CardAccent {
  return isDark
    ? accentFromRgb(true, '167,139,250', '#A78BFA')
    : accentFromRgb(false, '124,58,237', '#7C3AED');
}

export function waterAccent(isDark: boolean): CardAccent {
  return accentFromRgb(isDark, '56,189,248', '#38BDF8');
}

export function caloriesAccent(isDark: boolean): CardAccent {
  return mealsAccent(isDark);
}

/** Resolve preset accent for GradientCard. */
export function getCardAccent(
  variant: CardAccentVariant,
  isDark: boolean,
  options: CardAccentOptions = {},
): CardAccent {
  switch (variant) {
    case 'steps':
      return stepsAccent(isDark, options.goalComplete ?? false);
    case 'distance':
      return distanceAccent(isDark);
    case 'macros':
      return macrosAccent(isDark);
    case 'meals':
    case 'calories':
      return mealsAccent(isDark);
    case 'workouts':
      return workoutsAccent(isDark);
    case 'insight':
      return insightAccent(isDark);
    case 'readiness':
      return readinessAccent(options.readinessScore ?? 0, isDark);
    case 'protein':
      return proteinAccent(isDark);
    case 'carbs':
      return carbsAccent(isDark);
    case 'fat':
      return fatAccent(isDark);
    case 'water':
      return waterAccent(isDark);
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

/** @deprecated Use CardAccent */
export type MovementAccent = CardAccent;
