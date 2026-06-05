import { StyleSheet } from 'react-native';

/** Emoji glyph size in meal rows (no background container). */
export const MEAL_EMOJI_SIZE = 48;
/** Slot width — emojis often draw wider than fontSize; avoid clipping the right edge. */
export const MEAL_EMOJI_SLOT_WIDTH = 56;
/** Photo thumbnails keep a clipped frame. */
export const MEAL_PHOTO_THUMB_SIZE = 64;

export const MEAL_THUMB_MAX_WIDTH = Math.max(MEAL_EMOJI_SLOT_WIDTH, MEAL_PHOTO_THUMB_SIZE);
export const MEAL_ROW_GAP = 10;
export const MEAL_ROW_PADDING_LEFT = 16;
export const MEAL_ROW_PADDING_RIGHT = 10;
export const MEAL_ROW_MIN_HEIGHT = MEAL_THUMB_MAX_WIDTH + 24;

/** Shared meal list thumb sizing (home Today's Meals + food log). */
export const mealLogThumbStyles = StyleSheet.create({
  emojiSlot: {
    width: MEAL_EMOJI_SLOT_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  emoji: {
    fontSize: MEAL_EMOJI_SIZE,
    lineHeight: MEAL_EMOJI_SIZE * 1.15,
    textAlign: 'center',
    overflow: 'visible',
  },
  thumbPhoto: {
    width: MEAL_PHOTO_THUMB_SIZE,
    height: MEAL_PHOTO_THUMB_SIZE,
    borderRadius: 14,
    flexShrink: 0,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});

/** Divider inset aligned under row text (padding + thumb + gap). */
export function mealRowDividerInset(
  rowPaddingLeft: number = MEAL_ROW_PADDING_LEFT,
  gap: number = MEAL_ROW_GAP,
): number {
  return rowPaddingLeft + MEAL_THUMB_MAX_WIDTH + gap;
}
