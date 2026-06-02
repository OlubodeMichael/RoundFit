import { StyleSheet } from 'react-native';

/** Shared meal list thumb sizing (home Today's Meals + food log). */
export const MEAL_THUMB_SIZE = 72;
export const MEAL_ROW_MIN_HEIGHT = MEAL_THUMB_SIZE + 28;

export const mealLogThumbStyles = StyleSheet.create({
  thumb: {
    width: MEAL_THUMB_SIZE,
    height: MEAL_THUMB_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    width: MEAL_THUMB_SIZE,
    height: MEAL_THUMB_SIZE,
    fontSize: MEAL_THUMB_SIZE * 0.78,
    lineHeight: MEAL_THUMB_SIZE,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});

/** Divider inset aligned under row text (padding + thumb + gap). */
export function mealRowDividerInset(rowPaddingHorizontal: number, gap = 14): number {
  return rowPaddingHorizontal + MEAL_THUMB_SIZE + gap;
}
