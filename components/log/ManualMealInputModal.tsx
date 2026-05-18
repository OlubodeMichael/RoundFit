import { AppModal } from "@/components/ui/AppModal";
import { usePalette } from "@/lib/log-theme";
import { useEffect, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export type MealLabel =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "pre_workout"
  | "post_workout";

export type ManualMealInput = {
  name: string;
  label: MealLabel;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type ManualMealInitialValues = {
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

type ManualMealInputModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (value: ManualMealInput) => void;
  presetLabel?: MealLabel;
  initialValues?: ManualMealInitialValues;
};

const LABELS: { id: MealLabel; title: string }[] = [
  { id: "breakfast",    title: "Breakfast"    },
  { id: "lunch",        title: "Lunch"        },
  { id: "dinner",       title: "Dinner"       },
  { id: "snack",        title: "Snack"        },
  { id: "pre_workout",  title: "Pre-workout"  },
  { id: "post_workout", title: "Post-workout" },
];

const O = '#F97316';

function parseOptionalNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

function sanitizeNumericInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  return cleaned.replace(/(\..*)\./g, "$1");
}

export function ManualMealInputModal({
  visible,
  onClose,
  onSubmit,
  presetLabel,
  initialValues,
}: ManualMealInputModalProps) {
  const P = usePalette();

  const [name,     setName]     = useState("");
  const [label,    setLabel]    = useState<MealLabel>(presetLabel ?? "breakfast");
  const [calories, setCalories] = useState("");
  const [protein,  setProtein]  = useState("");
  const [carbs,    setCarbs]    = useState("");
  const [fat,      setFat]      = useState("");

  const isEditing = !!initialValues;

  useEffect(() => {
    if (!visible) return;
    if (initialValues) {
      setName(initialValues.name ?? "");
      setLabel(presetLabel ?? "breakfast");
      setCalories(initialValues.calories != null ? String(initialValues.calories) : "");
      setProtein(initialValues.protein   != null ? String(initialValues.protein)  : "");
      setCarbs(  initialValues.carbs     != null ? String(initialValues.carbs)    : "");
      setFat(    initialValues.fat       != null ? String(initialValues.fat)      : "");
    } else {
      setName("");
      setLabel(presetLabel ?? "breakfast");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }, [visible, presetLabel, initialValues]);

  const submit = () => {
    const cleanName = name.trim();
    const cals = Number(calories);
    if (!cleanName) {
      Alert.alert("Meal name required", "Please enter a meal name.");
      return;
    }
    if (!Number.isFinite(cals) || cals <= 0) {
      Alert.alert("Calories required", "Please enter a valid calorie value.");
      return;
    }
    onSubmit({
      name: cleanName,
      label,
      calories: Math.round(cals),
      protein: parseOptionalNumber(protein),
      carbs:   parseOptionalNumber(carbs),
      fat:     parseOptionalNumber(fat),
    });
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      sheetHeight={0.80}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>
              {isEditing ? 'EDIT ENTRY' : 'NEW ENTRY'}
            </Text>
            <Text style={[s.title, { color: P.text }]}>
              {isEditing ? 'Edit meal' : 'Add manually'}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={[s.closeBtn, { backgroundColor: P.sunken }]}
          >
            <Text style={[s.closeBtnText, { color: P.textDim }]}>✕</Text>
          </Pressable>
        </View>

        {/* ── Meal name ───────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: P.textFaint }]}>MEAL NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken rice bowl"
            placeholderTextColor={P.textFaint}
            autoCapitalize="sentences"
            style={[s.textInput, { color: P.text, backgroundColor: P.sunken }]}
          />
        </View>

        {/* ── Meal type ───────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: P.textFaint }]}>MEAL TYPE</Text>
          {presetLabel ? (
            <View style={[s.presetChip, { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: O }]}>
              <Text style={[s.presetChipText, { color: O }]}>
                {LABELS.find((l) => l.id === presetLabel)?.title ?? presetLabel}
              </Text>
            </View>
          ) : (
            <View style={s.chipWrap}>
              {LABELS.map((opt) => {
                const active = opt.id === label;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setLabel(opt.id)}
                    activeOpacity={0.75}
                    style={[
                      s.chip,
                      active
                        ? { backgroundColor: O, borderColor: O }
                        : { backgroundColor: P.sunken, borderColor: P.sunken },
                    ]}
                  >
                    <Text style={[s.chipText, { color: active ? '#fff' : P.text }]}>
                      {opt.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Calories ────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: P.textFaint }]}>CALORIES</Text>
          <View style={[s.calsBox, { backgroundColor: P.sunken }]}>
            <TextInput
              value={calories}
              onChangeText={(t) => setCalories(sanitizeNumericInput(t))}
              keyboardType="number-pad"
              placeholder="e.g. 430"
              placeholderTextColor={P.textFaint}
              style={[s.calsInput, { color: P.text }]}
            />
            <Text style={[s.calsUnit, { color: P.textFaint }]}>kcal</Text>
          </View>
        </View>

        {/* ── Macros ──────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.macrosHeader}>
            <Text style={[s.sectionLabel, { color: P.textFaint }]}>MACROS · GRAMS</Text>
            <Text style={[s.optionalText, { color: P.textFaint }]}>Optional</Text>
          </View>
          <View style={s.macroGrid}>
            <MacroCell
              dot={P.protein}
              label="PROTEIN"
              value={protein}
              onChange={setProtein}
              P={P}
            />
            <MacroCell
              dot={P.carbs}
              label="CARBS"
              value={carbs}
              onChange={setCarbs}
              P={P}
            />
            <MacroCell
              dot={P.fat}
              label="FAT"
              value={fat}
              onChange={setFat}
              P={P}
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <View style={[s.footer, { borderTopColor: P.hair, backgroundColor: P.bg }]}>
        <TouchableOpacity
          style={[s.cancelBtn, { backgroundColor: P.sunken }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={[s.cancelText, { color: P.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.submitBtn}
          onPress={submit}
          activeOpacity={0.85}
        >
          <Text style={s.submitText}>
            {isEditing ? 'Save changes' : 'Add meal  →'}
          </Text>
        </TouchableOpacity>
      </View>
    </AppModal>
  );
}

// ── MacroCell ─────────────────────────────────────────────────────────────────

function MacroCell({
  dot, label, value, onChange, P,
}: {
  dot: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={[s.macroCell, { backgroundColor: P.sunken }]}>
      <View style={s.macroCellHeader}>
        <View style={[s.macroDot, { backgroundColor: dot }]} />
        <Text style={[s.macroCellLabel, { color: P.textFaint }]}>{label}</Text>
      </View>
      <View style={s.macroCellRow}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(sanitizeNumericInput(t))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={P.textFaint}
          style={[s.macroCellInput, { color: P.text }]}
        />
        <Text style={[s.macroCellUnit, { color: P.textFaint }]}>g</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               20,
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    paddingTop:     4,
  },
  eyebrow: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.4,
    color:         O,
    marginBottom:  4,
  },
  title: {
    fontFamily:    'Syne_700Bold',
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -0.8,
    lineHeight:    32,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },
  closeBtnText: {
    fontSize:   13,
    fontWeight: '700',
  },

  // Sections
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  // Text input (meal name)
  textInput: {
    height:            52,
    borderRadius:      14,
    paddingHorizontal: 16,
    fontSize:          15,
    fontWeight:        '500',
  },

  // Meal type chips
  presetChip: {
    alignSelf:         'flex-start',
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  presetChipText: {
    fontSize:   13,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    borderRadius:      999,
    paddingHorizontal: 16,
    paddingVertical:   9,
  },
  chipText: {
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: -0.1,
  },

  // Calories
  calsBox: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      14,
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               8,
  },
  calsInput: {
    flex:          1,
    fontSize:      34,
    fontWeight:    '800',
    letterSpacing: -1.2,
    padding:       0,
  },
  calsUnit: {
    fontSize:   14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Macros
  macrosHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  optionalText: {
    fontSize:   12,
    fontWeight: '500',
  },
  macroGrid: {
    flexDirection: 'row',
    gap:           10,
  },
  macroCell: {
    flex:          1,
    borderRadius:  14,
    padding:       12,
    gap:           6,
  },
  macroCellHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  macroDot: {
    width:        7,
    height:       7,
    borderRadius: 3.5,
  },
  macroCellLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.1,
  },
  macroCellRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
  },
  macroCellInput: {
    flex:          1,
    fontSize:      26,
    fontWeight:    '800',
    letterSpacing: -0.8,
    padding:       0,
  },
  macroCellUnit: {
    fontSize:   13,
    fontWeight: '700',
  },

  // Footer
  footer: {
    flexDirection:     'row',
    gap:               10,
    paddingHorizontal: 20,
    paddingTop:        12,
    paddingBottom:     8,
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex:            1,
    height:          52,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cancelText: {
    fontSize:   15,
    fontWeight: '700',
  },
  submitBtn: {
    flex:            2,
    height:          52,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: O,
  },
  submitText: {
    color:      '#FFFFFF',
    fontSize:   15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
