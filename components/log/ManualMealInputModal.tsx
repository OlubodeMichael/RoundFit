import { AppModal } from "@/components/ui/AppModal";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import {
    Alert,
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

type ManualMealInputModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (value: ManualMealInput) => void;
};

const LABELS: { id: MealLabel; title: string }[] = [
  { id: "breakfast", title: "Breakfast" },
  { id: "lunch", title: "Lunch" },
  { id: "dinner", title: "Dinner" },
  { id: "snack", title: "Snack" },
  { id: "pre_workout", title: "Pre Workout" },
  { id: "post_workout", title: "Post Workout" },
];

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
}: ManualMealInputModalProps) {
  const { isDark } = useTheme();
  const [name, setName] = useState("");
  const [label, setLabel] = useState<MealLabel>("breakfast");
  const [calories, setCalories] = useState("");
  const [showMacros, setShowMacros] = useState(false);
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (!visible) return;
    setName("");
    setLabel("breakfast");
    setCalories("");
    setShowMacros(false);
    setProtein("");
    setCarbs("");
    setFat("");
  }, [visible]);

  const bg = isDark ? "#121212" : "#FFFFFF";
  const hi = isDark ? "#FFFFFF" : "#111111";
  const mid = isDark ? "#A3A3A3" : "#666666";
  const line = isDark ? "#2A2A2A" : "#EAEAEA";
  const inputBg = isDark ? "#181818" : "#FAFAFA";

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
      carbs: parseOptionalNumber(carbs),
      fat: parseOptionalNumber(fat),
    });
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Manual Entry"
      sheetHeight="full"
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.row}>
          <Text style={[s.label, { color: mid }]}>Meal name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken rice bowl"
            placeholderTextColor={mid}
            style={[
              s.input,
              {
                color: hi,
                borderColor: line,
                backgroundColor: inputBg,
              },
            ]}
          />
        </View>

        <View style={s.row}>
          <Text style={[s.label, { color: mid }]}>Meal label</Text>
          <View style={s.tagWrap}>
            {LABELS.map((opt) => {
              const active = opt.id === label;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setLabel(opt.id)}
                  style={[
                    s.tag,
                    {
                      borderColor: active ? "#F97316" : line,
                      backgroundColor: active
                        ? "rgba(249,115,22,0.14)"
                        : "transparent",
                    },
                  ]}
                >
                  <Text style={[s.tagText, { color: active ? "#F97316" : hi }]}>
                    {opt.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.row}>
          <Text style={[s.label, { color: mid }]}>Calories</Text>
          <TextInput
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            placeholder="e.g. 430"
            placeholderTextColor={mid}
            style={[
              s.input,
              {
                color: hi,
                borderColor: line,
                backgroundColor: inputBg,
              },
            ]}
          />
        </View>

        <TouchableOpacity
          style={[s.collapseBtn, { borderColor: line }]}
          onPress={() => setShowMacros((v) => !v)}
        >
          <Text style={[s.collapseText, { color: hi }]}>
            Protein / Carbs / Fat (optional)
          </Text>
          <Text style={[s.collapseIcon, { color: mid }]}>
            {showMacros ? "−" : "+"}
          </Text>
        </TouchableOpacity>

        {showMacros ? (
          <View style={s.macroGrid}>
            <View style={s.macroField}>
              <Text style={[s.label, { color: mid }]}>Protein (g)</Text>
              <TextInput
                value={protein}
                onChangeText={(v) => setProtein(sanitizeNumericInput(v))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={mid}
                style={[
                  s.input,
                  s.macroInput,
                  {
                    color: hi,
                    borderColor: line,
                    backgroundColor: inputBg,
                  },
                ]}
              />
            </View>
            <View style={s.macroField}>
              <Text style={[s.label, { color: mid }]}>Carbs (g)</Text>
              <TextInput
                value={carbs}
                onChangeText={(v) => setCarbs(sanitizeNumericInput(v))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={mid}
                style={[
                  s.input,
                  s.macroInput,
                  {
                    color: hi,
                    borderColor: line,
                    backgroundColor: inputBg,
                  },
                ]}
              />
            </View>
            <View style={s.macroField}>
              <Text style={[s.label, { color: mid }]}>Fat (g)</Text>
              <TextInput
                value={fat}
                onChangeText={(v) => setFat(sanitizeNumericInput(v))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={mid}
                style={[
                  s.input,
                  s.macroInput,
                  {
                    color: hi,
                    borderColor: line,
                    backgroundColor: inputBg,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[s.footer, { borderTopColor: line, backgroundColor: bg }]}>
        <TouchableOpacity
          style={[s.secondaryBtn, { borderColor: line }]}
          onPress={onClose}
        >
          <Text style={[s.secondaryText, { color: hi }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.primaryBtn} onPress={submit}>
          <Text style={s.primaryText}>Add meal</Text>
        </TouchableOpacity>
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  row: { gap: 8 },
  label: { fontSize: 12, fontWeight: "600" },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "500",
  },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: { fontSize: 12, fontWeight: "700" },
  collapseBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapseText: { fontSize: 13, fontWeight: "600" },
  collapseIcon: { fontSize: 22, lineHeight: 22, fontWeight: "500" },
  macroGrid: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  macroField: { flex: 1, gap: 8 },
  macroInput: { textAlign: "center" },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
  },
  secondaryText: { fontSize: 14, fontWeight: "700" },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    backgroundColor: "#F97316",
  },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
