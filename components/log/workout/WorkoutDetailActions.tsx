import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { PrimaryButton, usePalette } from '@/lib/log-theme';

export function WorkoutDetailFooterNote({ children }: { children: string }) {
  const P = usePalette();
  return (
    <Text style={[styles.footerNote, { color: P.textFaint }]}>{children}</Text>
  );
}

export interface WorkoutDetailActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  primaryLabel?: string;
  primaryLoading?: boolean;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
}

export function WorkoutDetailActions({
  onEdit,
  onDelete,
  primaryLabel,
  primaryLoading,
  onPrimary,
  primaryDisabled,
}: WorkoutDetailActionsProps) {
  const P = usePalette();

  if (onPrimary != null && primaryLabel != null) {
    return (
      <View style={styles.pad}>
        <PrimaryButton
          label={primaryLabel}
          onPress={onPrimary}
          loading={primaryLoading}
          disabled={primaryDisabled}
          accent={P.workout}
        />
      </View>
    );
  }

  if (onEdit == null && onDelete == null) return null;

  return (
    <View style={styles.pad}>
      {onEdit != null && (
        <PrimaryButton label="Edit workout" icon="pencil-outline" onPress={onEdit} accent={P.workout} />
      )}
      {onDelete != null && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete workout"
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="trash-outline" size={16} color={P.danger} />
          <Text style={[styles.deleteText, { color: P.danger }]}>Delete workout</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 20, gap: 12 },
  footerNote: {
    marginTop: 20,
    paddingHorizontal: WORKOUT_DETAIL_PAD,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    minHeight: 44,
  },
  deleteText: { fontSize: 14, fontWeight: '700' },
});
