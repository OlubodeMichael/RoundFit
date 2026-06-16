import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HK_ACTIVITY_DISPLAY_LABEL } from '@/constants/healthkit-activity-types';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface HealthKitActivityIcon {
  icon: IoniconName;
  sfSymbol: string;
}

const DEFAULT_HK_ICON: HealthKitActivityIcon = {
  icon: 'fitness-outline',
  sfSymbol: 'figure.mixed.cardio',
};

/** Per-activity icons — SF Symbols on iOS, Ionicons elsewhere. */
const HK_ACTIVITY_ICON: Readonly<Record<number, HealthKitActivityIcon>> = {
  1: { icon: 'american-football-outline', sfSymbol: 'figure.american.football' },
  2: { icon: 'locate-outline', sfSymbol: 'figure.archery' },
  3: { icon: 'football-outline', sfSymbol: 'figure.australian.football' },
  4: { icon: 'tennisball-outline', sfSymbol: 'figure.badminton' },
  5: { icon: 'baseball-outline', sfSymbol: 'figure.baseball' },
  6: { icon: 'basketball-outline', sfSymbol: 'figure.basketball' },
  7: { icon: 'ellipse-outline', sfSymbol: 'figure.bowling' },
  8: { icon: 'body-outline', sfSymbol: 'figure.boxing' },
  9: { icon: 'trending-up-outline', sfSymbol: 'figure.climbing' },
  10: { icon: 'baseball-outline', sfSymbol: 'figure.cricket' },
  11: { icon: 'fitness-outline', sfSymbol: 'figure.cross.training' },
  12: { icon: 'snow-outline', sfSymbol: 'figure.curling' },
  13: { icon: 'bicycle-outline', sfSymbol: 'figure.outdoor.cycle' },
  14: { icon: 'musical-notes-outline', sfSymbol: 'figure.dance' },
  15: { icon: 'musical-notes-outline', sfSymbol: 'figure.dance' },
  16: { icon: 'sync-outline', sfSymbol: 'figure.elliptical' },
  17: { icon: 'walk-outline', sfSymbol: 'figure.equestrian.sports' },
  18: { icon: 'flash-outline', sfSymbol: 'figure.fencing' },
  19: { icon: 'fish-outline', sfSymbol: 'figure.fishing' },
  20: { icon: 'barbell-outline', sfSymbol: 'figure.strengthtraining.functional' },
  21: { icon: 'golf-outline', sfSymbol: 'figure.golf' },
  22: { icon: 'body-outline', sfSymbol: 'figure.gymnastics' },
  23: { icon: 'hand-left-outline', sfSymbol: 'figure.handball' },
  24: { icon: 'trail-sign-outline', sfSymbol: 'figure.hiking' },
  25: { icon: 'snow-outline', sfSymbol: 'figure.hockey' },
  26: { icon: 'eye-outline', sfSymbol: 'figure.hunting' },
  27: { icon: 'football-outline', sfSymbol: 'figure.lacrosse' },
  28: { icon: 'body-outline', sfSymbol: 'figure.martial.arts' },
  29: { icon: 'flower-outline', sfSymbol: 'figure.mind.and.body' },
  30: { icon: 'pulse-outline', sfSymbol: 'figure.mixed.cardio' },
  31: { icon: 'boat-outline', sfSymbol: 'figure.paddle.sports' },
  32: { icon: 'happy-outline', sfSymbol: 'figure.play' },
  33: { icon: 'medkit-outline', sfSymbol: 'figure.cooldown' },
  34: { icon: 'tennisball-outline', sfSymbol: 'figure.racquetball' },
  35: { icon: 'boat-outline', sfSymbol: 'figure.outdoor.rowing' },
  36: { icon: 'american-football-outline', sfSymbol: 'figure.rugby' },
  37: { icon: 'fitness-outline', sfSymbol: 'figure.run' },
  38: { icon: 'boat-outline', sfSymbol: 'figure.sailing' },
  39: { icon: 'snow-outline', sfSymbol: 'figure.skating' },
  40: { icon: 'snow-outline', sfSymbol: 'figure.snowboarding' },
  41: { icon: 'football-outline', sfSymbol: 'figure.soccer' },
  42: { icon: 'baseball-outline', sfSymbol: 'figure.softball' },
  43: { icon: 'tennisball-outline', sfSymbol: 'figure.squash' },
  44: { icon: 'trending-up-outline', sfSymbol: 'figure.stair.stepper' },
  45: { icon: 'water-outline', sfSymbol: 'figure.surfing' },
  46: { icon: 'water-outline', sfSymbol: 'figure.pool.swim' },
  47: { icon: 'tennisball-outline', sfSymbol: 'figure.table.tennis' },
  48: { icon: 'tennisball-outline', sfSymbol: 'figure.tennis' },
  49: { icon: 'stopwatch-outline', sfSymbol: 'figure.track.and.field' },
  50: { icon: 'barbell-outline', sfSymbol: 'figure.strengthtraining.traditional' },
  51: { icon: 'basketball-outline', sfSymbol: 'figure.volleyball' },
  52: { icon: 'walk-outline', sfSymbol: 'figure.walk' },
  53: { icon: 'water-outline', sfSymbol: 'figure.water.fitness' },
  54: { icon: 'water-outline', sfSymbol: 'figure.waterpolo' },
  55: { icon: 'water-outline', sfSymbol: 'figure.open.water.swim' },
  56: { icon: 'body-outline', sfSymbol: 'figure.wrestling' },
  57: { icon: 'body-outline', sfSymbol: 'figure.yoga' },
  58: { icon: 'body-outline', sfSymbol: 'figure.barre' },
  59: { icon: 'shield-outline', sfSymbol: 'figure.core.training' },
  60: { icon: 'snow-outline', sfSymbol: 'figure.skiing.crosscountry' },
  61: { icon: 'snow-outline', sfSymbol: 'figure.skiing.downhill' },
  62: { icon: 'body-outline', sfSymbol: 'figure.flexibility' },
  63: { icon: 'flash-outline', sfSymbol: 'figure.highintensity.intervaltraining' },
  64: { icon: 'fitness-outline', sfSymbol: 'figure.jumprope' },
  65: { icon: 'body-outline', sfSymbol: 'figure.kickboxing' },
  66: { icon: 'body-outline', sfSymbol: 'figure.pilates' },
  67: { icon: 'snow-outline', sfSymbol: 'figure.snowboarding' },
  68: { icon: 'trending-up-outline', sfSymbol: 'figure.stair.stepper' },
  69: { icon: 'footsteps-outline', sfSymbol: 'figure.step.training' },
  70: { icon: 'accessibility-outline', sfSymbol: 'figure.roll' },
  71: { icon: 'accessibility-outline', sfSymbol: 'figure.roll.runningpace' },
  72: { icon: 'flower-outline', sfSymbol: 'figure.taichi' },
  73: { icon: 'pulse-outline', sfSymbol: 'figure.mixed.cardio' },
  74: { icon: 'bicycle-outline', sfSymbol: 'figure.hand.cycling' },
  75: { icon: 'ellipse-outline', sfSymbol: 'figure.disc.sports' },
  76: { icon: 'game-controller-outline', sfSymbol: 'figure.play' },
  77: { icon: 'musical-notes-outline', sfSymbol: 'figure.dance' },
  78: { icon: 'musical-notes-outline', sfSymbol: 'figure.socialdance' },
  79: { icon: 'tennisball-outline', sfSymbol: 'figure.pickleball' },
  80: { icon: 'snow-outline', sfSymbol: 'figure.cooldown' },
  82: { icon: 'trophy-outline', sfSymbol: 'figure.multisport' },
  83: { icon: 'swap-horizontal-outline', sfSymbol: 'arrow.triangle.2.circlepath' },
  84: { icon: 'water-outline', sfSymbol: 'figure.water.fitness' },
  3000: { icon: 'ellipsis-horizontal-circle-outline', sfSymbol: 'figure.mixed.cardio' },
};

export function getHealthKitActivityIcon(activityType: number): HealthKitActivityIcon {
  return HK_ACTIVITY_ICON[activityType] ?? DEFAULT_HK_ICON;
}

/** Every known HK activity type should resolve to a dedicated icon. */
export function getKnownHealthKitActivityTypes(): number[] {
  return Object.keys(HK_ACTIVITY_DISPLAY_LABEL).map(Number);
}
