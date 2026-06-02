import { StyleSheet } from 'react-native';

import {
  JAR_DISPLAY_SCALE_COMPACT,
  JAR_DISPLAY_SCALE_DEFAULT,
  JAR_VIEW_H,
} from '@/components/log/water-jar-paths';

/** Matches WaterJarVisual scaled height */
export const TANK_HEIGHT = JAR_VIEW_H * JAR_DISPLAY_SCALE_DEFAULT;
export const TANK_HEIGHT_COMPACT = JAR_VIEW_H * JAR_DISPLAY_SCALE_COMPACT;

export const reservoirStyles = StyleSheet.create({
  wrap: { gap: 16 },
  wrapSide: { gap: 8 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  remainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  remainTxt: { fontSize: 11, fontWeight: '700' },
  pctChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pctTxt: { fontSize: 11, fontWeight: '800' },
  jarStage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TANK_HEIGHT + 8,
  },
  jarStageSide: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TANK_HEIGHT_COMPACT + 4,
  },
  statsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 28,
  },
  heroOz: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.8,
    lineHeight: 46,
    includeFontPadding: false,
  },
  heroOzSide: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 32,
    includeFontPadding: false,
  },
  heroUnit: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  goalHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  messageBlock: { gap: 4, paddingHorizontal: 2 },
  messageHead: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  messageBody: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaTxt: { fontSize: 12, fontWeight: '600' },
  completeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  completeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});
