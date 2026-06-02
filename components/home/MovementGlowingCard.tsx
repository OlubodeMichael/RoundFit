import type { ViewStyle } from 'react-native';

import {
  GradientCard,
  type GradientCardCorner,
  type GradientCardLayout,
} from '@/components/ui/GradientCard';
import type { CardAccent } from '@/components/ui/gradient-card-theme';

/** @deprecated Use `GradientCard` from `@/components/ui/GradientCard`. */
export interface MovementGlowingCardProps {
  accent: CardAccent;
  cardBg: string;
  borderColor: string;
  isDark?: boolean;
  delay?: number;
  layout?: GradientCardLayout;
  gradientStart?: { x: number; y: number };
  gradientEnd?: { x: number; y: number };
  style?: ViewStyle;
  children: React.ReactNode;
}

function cornerFromGradient(
  start: { x: number; y: number },
  end: { x: number; y: number },
): GradientCardCorner {
  if (start.x === 1 && start.y === 0) return 'top-right';
  if (start.x === 0 && start.y === 1) return 'bottom-left';
  if (start.x === 1 && start.y === 1) return 'bottom-right';
  return 'top-left';
}

/** @deprecated Use `GradientCard` instead. */
export function MovementGlowingCard({
  accent,
  cardBg,
  borderColor,
  isDark = true,
  delay = 0,
  layout = 'metric',
  gradientStart = { x: 0, y: 0 },
  gradientEnd = { x: 1, y: 1 },
  style,
  children,
}: MovementGlowingCardProps) {
  return (
    <GradientCard
      accent={accent}
      palette={{ card: cardBg, cardEdge: borderColor, isDark }}
      layout={layout}
      corner={cornerFromGradient(gradientStart, gradientEnd)}
      delay={delay}
      style={style}
    >
      {children}
    </GradientCard>
  );
}
