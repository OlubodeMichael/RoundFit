export const MODAL_GLASS = {
  FLOATING_H_MARGIN: 12,
  FLOATING_BOTTOM_GAP: 10,
  FULL_TOP_GAP: 10,
  SHEET_RADIUS: 36,
  BLUR_INTENSITY_DARK: 50,
  BLUR_INTENSITY_LIGHT: 70,
} as const;

export function modalGlassColors(isDark: boolean) {
  return {
    hi: isDark ? '#F4F4F5' : '#111111',
    mid: isDark ? '#8E8E93' : '#6B6B6B',
    lo: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
    overlay: isDark ? 'rgba(28,29,35,0.50)' : 'rgba(255,255,255,0.55)',
    backdrop: 'rgba(0,0,0,0.45)',
    border: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
    groupBg: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.04)',
    androidBg: isDark ? 'rgba(28,29,35,0.94)' : 'rgba(252,252,250,0.96)',
  };
}
