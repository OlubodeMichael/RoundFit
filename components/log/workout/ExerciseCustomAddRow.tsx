import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ExerciseCustomAddRowProps {
  category: string;
  onAdd: (name: string, category: string) => Promise<'added' | 'duplicate' | 'empty' | 'invalid'>;
  accentColor: string;
  sunkenColor: string;
  borderColor: string;
  textColor: string;
  textFaintColor: string;
}

export function ExerciseCustomAddRow({
  category,
  onAdd,
  accentColor,
  sunkenColor,
  borderColor,
  textColor,
  textFaintColor,
}: ExerciseCustomAddRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setExpanded(false);
    setName('');
    setError(null);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await onAdd(name, category);
    setSaving(false);

    if (result === 'empty') {
      setError('Enter an exercise name.');
      return;
    }
    if (result === 'duplicate') {
      setError('That exercise is already in your list.');
      return;
    }
    if (result === 'invalid') {
      setError('Pick a muscle group first.');
      return;
    }

    handleClose();
  };

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [
          s.trigger,
          { backgroundColor: sunkenColor, borderColor },
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Add exercise to ${category}`}
      >
        <Ionicons name="add" size={18} color={accentColor} />
        <Text style={[s.triggerText, { color: textColor }]}>Add to {category}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[s.form, { backgroundColor: sunkenColor, borderColor }]}>
      <Text style={[s.formLabel, { color: textFaintColor }]}>Add to {category}</Text>
      <View style={s.inputRow}>
        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError(null);
          }}
          placeholder="Exercise name"
          placeholderTextColor={textFaintColor}
          style={[s.input, { color: textColor, borderColor }]}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleSave}
          autoFocus
        />
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            s.saveBtn,
            { backgroundColor: accentColor },
            pressed && { opacity: 0.9 },
            saving && { opacity: 0.7 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
      {error ? <Text style={[s.error, { color: accentColor }]}>{error}</Text> : null}
      <Pressable onPress={handleClose} hitSlop={8}>
        <Text style={[s.cancel, { color: textFaintColor }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  triggerText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  form: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: 12, fontWeight: '600' },
  cancel: { fontSize: 13, fontWeight: '600', alignSelf: 'flex-start' },
});
