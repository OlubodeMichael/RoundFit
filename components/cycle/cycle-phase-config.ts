import { Droplets, Leaf, Moon, Sun, type LucideIcon } from 'lucide-react-native';

import type { CyclePhase } from '@/context/cycle-context';

export interface PhaseMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  tip: string;
}

export interface PhaseSegment {
  key: Exclude<CyclePhase, null>;
  days: number;
  color: string;
  label: string;
}

export const PHASE_META: Record<Exclude<CyclePhase, null>, PhaseMeta> = {
  menstrual: {
    label: 'Menstrual',
    icon: Droplets,
    color: '#F43F5E',
    tip: 'Rest and gentle movement today.',
  },
  follicular: {
    label: 'Follicular',
    icon: Leaf,
    color: '#F97316',
    tip: 'Energy rising — good time for new goals.',
  },
  ovulation: {
    label: 'Ovulation',
    icon: Sun,
    color: '#EAB308',
    tip: 'Peak strength and energy window.',
  },
  luteal: {
    label: 'Luteal',
    icon: Moon,
    color: '#8B5CF6',
    tip: 'Wind down and prioritise recovery.',
  },
};

export function buildSegments(cycleLength: number): PhaseSegment[] {
  const luteal = Math.max(cycleLength - 16, 10);
  return [
    { key: 'menstrual', days: 5, color: PHASE_META.menstrual.color, label: 'Menstrual' },
    { key: 'follicular', days: 8, color: PHASE_META.follicular.color, label: 'Follicular' },
    { key: 'ovulation', days: 3, color: PHASE_META.ovulation.color, label: 'Ovulation' },
    { key: 'luteal', days: luteal, color: PHASE_META.luteal.color, label: 'Luteal' },
  ];
}

export function getCurrentPhaseKey(cycleDay: number, cycleLength: number): string {
  const segments = buildSegments(cycleLength);
  let cumulative = 0;
  for (const segment of segments) {
    cumulative += segment.days;
    if (cycleDay <= cumulative) return segment.key;
  }
  return segments[segments.length - 1].key;
}

export function getCurrentPhaseColor(cycleDay: number, cycleLength: number): string {
  const segments = buildSegments(cycleLength);
  let cumulative = 0;
  for (const segment of segments) {
    cumulative += segment.days;
    if (cycleDay <= cumulative) return segment.color;
  }
  return segments[segments.length - 1].color;
}
