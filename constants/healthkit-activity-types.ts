/**
 * HKWorkoutActivityType raw values → Apple Fitness display names.
 * Matches Apple's HealthKit enum labels (see HKWorkoutActivityType documentation).
 */
export const HK_ACTIVITY_DISPLAY_LABEL: Readonly<Record<number, string>> = {
  1: 'American Football',
  2: 'Archery',
  3: 'Australian Football',
  4: 'Badminton',
  5: 'Baseball',
  6: 'Basketball',
  7: 'Bowling',
  8: 'Boxing',
  9: 'Climbing',
  10: 'Cricket',
  11: 'Cross Training',
  12: 'Curling',
  13: 'Cycling',
  14: 'Dance',
  15: 'Dance Inspired Training',
  16: 'Elliptical',
  17: 'Equestrian Sports',
  18: 'Fencing',
  19: 'Fishing',
  20: 'Functional Strength Training',
  21: 'Golf',
  22: 'Gymnastics',
  23: 'Handball',
  24: 'Hiking',
  25: 'Hockey',
  26: 'Hunting',
  27: 'Lacrosse',
  28: 'Martial Arts',
  29: 'Mind and Body',
  30: 'Mixed Metabolic Cardio Training',
  31: 'Paddle Sports',
  32: 'Play',
  33: 'Preparation and Recovery',
  34: 'Racquetball',
  35: 'Rowing',
  36: 'Rugby',
  37: 'Running',
  38: 'Sailing',
  39: 'Skating Sports',
  40: 'Snow Sports',
  41: 'Soccer',
  42: 'Softball',
  43: 'Squash',
  44: 'Stair Climbing',
  45: 'Surfing Sports',
  46: 'Swimming',
  47: 'Table Tennis',
  48: 'Tennis',
  49: 'Track and Field',
  50: 'Traditional Strength Training',
  51: 'Volleyball',
  52: 'Walking',
  53: 'Water Fitness',
  54: 'Water Polo',
  55: 'Water Sports',
  56: 'Wrestling',
  57: 'Yoga',
  58: 'Barre',
  59: 'Core Training',
  60: 'Cross Country Skiing',
  61: 'Downhill Skiing',
  62: 'Flexibility',
  63: 'HIIT',
  64: 'Jump Rope',
  65: 'Kickboxing',
  66: 'Pilates',
  67: 'Snowboarding',
  68: 'Stairs',
  69: 'Step Training',
  70: 'Wheelchair Walk Pace',
  71: 'Wheelchair Run Pace',
  72: 'Tai Chi',
  73: 'Mixed Cardio',
  74: 'Hand Cycling',
  75: 'Disc Sports',
  76: 'Fitness Gaming',
  77: 'Cardio Dance',
  78: 'Social Dance',
  79: 'Pickleball',
  80: 'Cooldown',
  82: 'Swim - Bike - Run',
  83: 'Transition',
  84: 'Underwater Diving',
  3000: 'Other',
};

/** camelCase enum keys from HKWorkoutActivityType → raw value. */
export const HK_ACTIVITY_ENUM_TO_NUMBER: Readonly<Record<string, number>> = {
  americanFootball: 1,
  archery: 2,
  australianFootball: 3,
  badminton: 4,
  baseball: 5,
  basketball: 6,
  bowling: 7,
  boxing: 8,
  climbing: 9,
  cricket: 10,
  crossTraining: 11,
  curling: 12,
  cycling: 13,
  dance: 14,
  danceInspiredTraining: 15,
  elliptical: 16,
  equestrianSports: 17,
  fencing: 18,
  fishing: 19,
  functionalStrengthTraining: 20,
  golf: 21,
  gymnastics: 22,
  handball: 23,
  hiking: 24,
  hockey: 25,
  hunting: 26,
  lacrosse: 27,
  martialArts: 28,
  mindAndBody: 29,
  mixedMetabolicCardioTraining: 30,
  paddleSports: 31,
  play: 32,
  preparationAndRecovery: 33,
  racquetball: 34,
  rowing: 35,
  rugby: 36,
  running: 37,
  sailing: 38,
  skatingSports: 39,
  snowSports: 40,
  soccer: 41,
  softball: 42,
  squash: 43,
  stairClimbing: 44,
  surfingSports: 45,
  swimming: 46,
  tableTennis: 47,
  tennis: 48,
  trackAndField: 49,
  traditionalStrengthTraining: 50,
  volleyball: 51,
  walking: 52,
  waterFitness: 53,
  waterPolo: 54,
  waterSports: 55,
  wrestling: 56,
  yoga: 57,
  barre: 58,
  coreTraining: 59,
  crossCountrySkiing: 60,
  downhillSkiing: 61,
  flexibility: 62,
  highIntensityIntervalTraining: 63,
  jumpRope: 64,
  kickboxing: 65,
  pilates: 66,
  snowboarding: 67,
  stairs: 68,
  stepTraining: 69,
  wheelchairWalkPace: 70,
  wheelchairRunPace: 71,
  taiChi: 72,
  mixedCardio: 73,
  handCycling: 74,
  discSports: 75,
  fitnessGaming: 76,
  cardioDance: 77,
  socialDance: 78,
  pickleball: 79,
  cooldown: 80,
  swimBikeRun: 82,
  transition: 83,
  underwaterDiving: 84,
  other: 3000,
};

export function healthKitEnumIdentifierToCamelKey(identifier: string): string {
  const enumName = identifier.replace(/^HKWorkoutActivityType/, '');
  if (!enumName) return '';
  return enumName.charAt(0).toLowerCase() + enumName.slice(1);
}

export function resolveHealthKitActivityTypeNumber(
  activityType: number | string | undefined,
  nativeEnum?: Record<string, number>,
): number {
  if (typeof activityType === 'number' && Number.isFinite(activityType)) {
    return activityType;
  }

  if (typeof activityType === 'string' && activityType.trim() !== '') {
    const numeric = Number(activityType);
    if (Number.isFinite(numeric)) return numeric;

    const camelKey = healthKitEnumIdentifierToCamelKey(activityType);
    const nativeValue = nativeEnum?.[camelKey];
    if (typeof nativeValue === 'number') return nativeValue;

    const mapped = HK_ACTIVITY_ENUM_TO_NUMBER[camelKey];
    if (mapped != null) return mapped;
  }

  return 3000;
}

export function getHealthKitActivityDisplayLabel(
  activityType: number,
  activityTypeName?: string,
): string {
  if (activityTypeName) {
    const resolvedFromName = resolveHealthKitActivityTypeNumber(activityTypeName);
    if (resolvedFromName !== 3000) {
      return HK_ACTIVITY_DISPLAY_LABEL[resolvedFromName] ?? 'Other';
    }
  }

  return HK_ACTIVITY_DISPLAY_LABEL[activityType] ?? 'Other';
}
