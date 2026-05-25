import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

export type WaterVolumeIcon = ComponentProps<typeof Ionicons>['name'];

/** Small cup — sip and small pours */
const SMALL_CUP_MAX_ML = 180;
/** Glass / regular cup */
const GLASS_MAX_ML = 400;
/** Standard bottle */
const BOTTLE_MAX_ML = 750;

export function waterIconForMl(ml: number): WaterVolumeIcon {
  if (ml <= SMALL_CUP_MAX_ML) return 'cafe-outline';
  if (ml <= GLASS_MAX_ML) return 'beer-outline';
  if (ml <= BOTTLE_MAX_ML) return 'flask-outline';
  return 'flask';
}

export function waterIconSizeForMl(ml: number): number {
  if (ml <= SMALL_CUP_MAX_ML) return 17;
  if (ml <= GLASS_MAX_ML) return 19;
  if (ml <= BOTTLE_MAX_ML) return 20;
  return 22;
}

export function waterVolumeLabelForMl(ml: number): string {
  if (ml <= SMALL_CUP_MAX_ML) return 'Cup';
  if (ml <= GLASS_MAX_ML) return 'Glass';
  return 'Bottle';
}
