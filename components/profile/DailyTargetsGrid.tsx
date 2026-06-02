import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export interface DailyTargetsGridColors {
  card: string;
  edge: string;
  text: string;
  dim: string;
  faint: string;
  sunken: string;
  isDark: boolean;
}

export interface DailyTargetsGridProps {
  calories: string;
  protein: string;
  water: string;
  sleep: string;
  steps: string;
  colors: DailyTargetsGridColors;
  onEdit: () => void;
}

interface TargetDef {
  key: keyof Pick<DailyTargetsGridProps, 'calories' | 'protein' | 'water' | 'sleep' | 'steps'>;
  icon: IoniconsName;
  iconBg: string;
  iconSoft: string;
  label: string;
  unit?: string;
  hero?: boolean;
}

const TARGETS: TargetDef[] = [
  {
    key: 'calories',
    icon: 'flame',
    iconBg: '#FF7849',
    iconSoft: 'rgba(255,120,73,0.16)',
    label: 'Calories',
    unit: 'kcal',
    hero: true,
  },
  {
    key: 'protein',
    icon: 'barbell',
    iconBg: '#34D399',
    iconSoft: 'rgba(52,211,153,0.16)',
    label: 'Protein',
    unit: 'g',
  },
  {
    key: 'water',
    icon: 'water',
    iconBg: '#0EA5E9',
    iconSoft: 'rgba(14,165,233,0.16)',
    label: 'Water',
    unit: 'L',
  },
  {
    key: 'sleep',
    icon: 'moon',
    iconBg: '#818CF8',
    iconSoft: 'rgba(129,140,248,0.16)',
    label: 'Sleep',
    unit: 'h',
  },
  {
    key: 'steps',
    icon: 'footsteps',
    iconBg: '#38BDF8',
    iconSoft: 'rgba(56,189,248,0.16)',
    label: 'Steps',
  },
];

interface TargetCardProps {
  def: TargetDef;
  value: string;
  colors: DailyTargetsGridColors;
  onPress: () => void;
  style?: ViewStyle;
}

function TargetCard({ def, value, colors, onPress, style }: TargetCardProps) {
  const isHero = def.hero === true;
  const hasValue = value !== '—';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${def.label}, ${hasValue ? `${value} ${def.unit ?? ''}`.trim() : 'not set'}`}
      style={({ pressed }) => [
        s.cardPressable,
        style,
        pressed && s.cardPressed,
      ]}
    >
      {isHero ? (
        <LinearGradient
          colors={
            colors.isDark
              ? ['rgba(255,120,73,0.10)', 'rgba(255,120,73,0.02)', 'transparent']
              : ['rgba(255,120,73,0.08)', 'rgba(255,120,73,0.02)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.card, s.heroCard, { backgroundColor: colors.card, borderColor: colors.edge }]}
        >
          <TargetCardContent def={def} value={value} colors={colors} isHero />
        </LinearGradient>
      ) : (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.edge }]}>
          <TargetCardContent def={def} value={value} colors={colors} isHero={false} />
        </View>
      )}
    </Pressable>
  );
}

function TargetCardContent({
  def,
  value,
  colors,
  isHero,
}: {
  def: TargetDef;
  value: string;
  colors: DailyTargetsGridColors;
  isHero: boolean;
}) {
  const hasValue = value !== '—';
  const valueColor = colors.isDark ? colors.text : '#3F3F46';
  const valueFont = colors.isDark ? 'BarlowCondensed_800ExtraBold' : 'BarlowCondensed_700Bold';

  return (
    <>
      <View style={s.cardHeader}>
        <View style={[s.iconRing, { backgroundColor: def.iconSoft }]}>
          <View style={[s.iconBox, { backgroundColor: def.iconBg }]}>
            <Ionicons name={def.icon} size={isHero ? 15 : 14} color="#FFF" />
          </View>
        </View>
        <Text style={[s.label, { color: colors.dim }]}>{def.label}</Text>
      </View>

      <View style={[s.valueRow, isHero && s.heroValueRow]}>
        <Text
          style={[
            isHero ? s.heroValue : s.value,
            { color: valueColor, fontFamily: valueFont },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {value}
        </Text>
        {def.unit != null && hasValue && (
          <Text style={[s.unit, { color: colors.faint }]}>{def.unit}</Text>
        )}
      </View>
    </>
  );
}

export function DailyTargetsGrid({
  calories,
  protein,
  water,
  sleep,
  steps,
  colors,
  onEdit,
}: DailyTargetsGridProps) {
  const values: Record<TargetDef['key'], string> = {
    calories,
    protein,
    water,
    sleep,
    steps,
  };

  const hero = TARGETS[0];
  const grid = TARGETS.slice(1);

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionLabel, { color: colors.dim }]}>DAILY TARGETS</Text>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit daily targets"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [
            s.editBtn,
            {
              backgroundColor: colors.sunken,
              borderColor: colors.edge,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Ionicons name="options-outline" size={14} color={colors.dim} />
        </Pressable>
      </View>

      <TargetCard
        def={hero}
        value={values[hero.key]}
        colors={colors}
        onPress={onEdit}
      />

      <View style={s.row}>
        {grid.slice(0, 2).map((def) => (
          <TargetCard
            key={def.key}
            def={def}
            value={values[def.key]}
            colors={colors}
            onPress={onEdit}
            style={s.halfCard}
          />
        ))}
      </View>

      <View style={s.row}>
        {grid.slice(2, 4).map((def) => (
          <TargetCard
            key={def.key}
            def={def}
            value={values[def.key]}
            colors={colors}
            onPress={onEdit}
            style={s.halfCard}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cardPressable: {
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 94,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroCard: {
    minHeight: 102,
    paddingBottom: 18,
  },
  halfCard: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconRing: {
    padding: 3,
    borderRadius: 11,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 14,
  },
  heroValueRow: {
    marginTop: 16,
  },
  value: {
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroValue: {
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginBottom: 3,
  },
});
