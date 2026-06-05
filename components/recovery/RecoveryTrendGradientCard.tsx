import { StyleSheet, type ViewStyle } from 'react-native';

import {
  GradientCard,
  getCardAccent,
  type GradientCardCorner,
  type GradientCardLayout,
} from '@/components/ui/GradientCard';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';

const SHELL_RADIUS = 18;

export interface RecoveryTrendGradientCardProps {
  children: React.ReactNode;
  palette: TrendPalette;
  readinessScore: number;
  corner?: GradientCardCorner;
  layout?: GradientCardLayout;
  animated?: boolean;
  delay?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function RecoveryTrendGradientCard({
  children,
  palette,
  readinessScore,
  corner = 'top-left',
  layout = 'full',
  animated = false,
  delay = 0,
  style,
  contentStyle,
}: RecoveryTrendGradientCardProps) {
  const accent = getCardAccent('readiness', palette.isDark, { readinessScore });
  const cardPalette = {
    card: palette.card,
    cardEdge: palette.cardEdge,
    isDark: palette.isDark,
  };

  return (
    <GradientCard
      variant="readiness"
      accentOptions={{ readinessScore }}
      palette={cardPalette}
      layout={layout}
      corner={corner}
      animated={animated}
      delay={delay}
      style={style}
      contentStyle={[
        layout === 'full' ? s.shellFull : s.shellMetric,
        { borderColor: accent.iconSoft },
        contentStyle,
      ]}
    >
      {children}
    </GradientCard>
  );
}

const s = StyleSheet.create({
  shellFull: {
    borderRadius: SHELL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  shellMetric: {
    flex: 1,
    borderRadius: SHELL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 3,
    justifyContent: 'center',
  },
});
