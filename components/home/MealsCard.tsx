import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { MealItem } from '@/context/food-context';
import {
  MEAL_ROW_GAP,
  MEAL_ROW_MIN_HEIGHT,
  MEAL_ROW_PADDING_LEFT,
  MEAL_ROW_PADDING_RIGHT,
  mealLogThumbStyles,
} from '@/lib/meal-log-row';

const MAX_VISIBLE_MEALS = 5;

const MEAL_EMOJIS: Record<string, string> = {
  breakfast: '🥞',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
  other: '🍴',
};

export interface MealsCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  hair: string;
  sunken: string;
  calories: string;
  caloriesSoft: string;
  proteinSoft: string;
  carbsSoft: string;
  fatSoft: string;
  isDark: boolean;
}

export interface MealsCardProps {
  P: MealsCardPalette;
  delay?: number;
  meals: MealItem[];
  totalCalories: number;
  title?: string;
  onLogMore?: () => void;
}

export function MealsCard({
  P,
  delay = 0,
  meals,
  totalCalories,
  title = "Today's Meals",
  onLogMore,
}: MealsCardProps) {
  const accent = getCardAccent('meals', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const caption =
    meals.length === 0
      ? 'Nothing logged yet'
      : `${meals.length} ${meals.length === 1 ? 'entry' : 'entries'} · ${totalCalories.toLocaleString()} kcal`;

  return (
    <GradientCard variant="meals" palette={palette} delay={delay}>
      <Pressable
        onPress={onLogMore}
        disabled={!onLogMore}
        style={({ pressed }) => [onLogMore && pressed && s.pressed]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <Text style={[s.headerTitle, { color: P.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[s.headerCaption, { color: P.textDim }]} numberOfLines={1}>
              {caption}
            </Text>
          </View>
          {onLogMore ? (
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          ) : null}
        </View>
      </Pressable>

      <View style={[s.divider, { backgroundColor: P.hair }]} />

      {meals.length === 0 ? (
        <EmptyBlock
          P={P}
          message={
            onLogMore ? 'Log your first meal' : 'No meals logged this day'
          }
          onPress={onLogMore}
        />
      ) : (
        <View>
          {meals.slice(0, MAX_VISIBLE_MEALS).map((meal, i) => (
            <MealLogRow
              key={meal.id}
              meal={meal}
              P={P}
              emoji={MEAL_EMOJIS[meal.meal.toLowerCase()] ?? '🍴'}
              showDivider={i > 0}
              onPress={onLogMore}
            />
          ))}
        </View>
      )}

      {onLogMore && meals.length > 0 ? (
        <>
          <View style={[s.divider, { backgroundColor: P.hair }]} />
          <FooterAction
            P={P}
            accent={accent}
            label="Log another meal"
            onPress={onLogMore}
          />
        </>
      ) : null}
    </GradientCard>
  );
}

function MealLogRow({
  meal,
  P,
  emoji,
  showDivider,
  onPress,
}: {
  meal: MealItem;
  P: MealsCardPalette;
  emoji: string;
  showDivider: boolean;
  onPress?: () => void;
}) {
  const hasPhoto = Boolean(meal.imageUrl);
  const firstFood = meal.name.split(',')[0]?.trim() || meal.name;

  return (
    <View>
      {showDivider ? (
        <View style={[s.rowDivider, { backgroundColor: P.hair }]} />
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          s.row,
          onPress && pressed && { backgroundColor: P.sunken },
        ]}
      >
        {hasPhoto ? (
          <View style={mealLogThumbStyles.thumbPhoto}>
            <Image
              source={meal.imageUrl}
              style={mealLogThumbStyles.thumbImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </View>
        ) : (
          <View style={mealLogThumbStyles.emojiSlot}>
            <Text style={mealLogThumbStyles.emoji} allowFontScaling={false}>
              {emoji}
            </Text>
          </View>
        )}
        <View style={s.rowCopy}>
          <Text
            style={[s.rowTitle, { color: P.text }]}
            numberOfLines={1}
          >
            {firstFood}
          </Text>
          <Text style={[s.rowMeta, { color: P.textFaint }]} numberOfLines={1}>
            {meal.meal} · {meal.time}
          </Text>
        </View>
        <View style={s.rowStat}>
          <Text style={[s.rowValue, { color: P.text }]}>
            {meal.cals.toLocaleString()}
          </Text>
          <Text style={[s.rowUnit, { color: P.textFaint }]}>kcal</Text>
        </View>
      </Pressable>
    </View>
  );
}

function EmptyBlock({
  P,
  message,
  onPress,
}: {
  P: MealsCardPalette;
  message: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={s.empty}>
      <Ionicons
        name={onPress ? 'add-circle-outline' : 'restaurant-outline'}
        size={18}
        color={P.textFaint}
      />
      <Text style={[s.emptyText, { color: P.textFaint }]}>{message}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && s.pressed]}
    >
      {content}
    </Pressable>
  );
}

function FooterAction({
  P,
  accent,
  label,
  onPress,
}: {
  P: MealsCardPalette;
  accent: { iconBg: string; iconSoft: string };
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={s.footer}
    >
      <View style={[s.footerIcon, { backgroundColor: accent.iconSoft }]}>
        <Ionicons name="add" size={16} color={accent.iconBg} />
      </View>
      <Text style={[s.footerLabel, { color: P.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.88 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  headerMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.45,
    lineHeight: 24,
  },
  headerCaption: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MEAL_ROW_GAP,
    paddingLeft: MEAL_ROW_PADDING_LEFT,
    paddingRight: MEAL_ROW_PADDING_RIGHT,
    paddingVertical: 12,
    minHeight: MEAL_ROW_MIN_HEIGHT,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 20,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  rowStat: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  rowValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  rowUnit: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
