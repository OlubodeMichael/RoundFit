import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppModal } from '@/components/ui/AppModal';
import { WorkoutActivityGrid } from '@/components/log/workout/WorkoutActivityGrid';
import { WORKOUT_CATALOG_ENTRIES, type WorkoutCatalogEntry } from '@/config/workout-catalog';
import type { WorkoutImportReviewItem } from '@/services/workout-import';
import { usePalette } from '@/lib/log-theme';

export interface WorkoutImportReviewSheetProps {
  visible: boolean;
  item: WorkoutImportReviewItem | null;
  selectedCatalogId: string | null;
  isSaving: boolean;
  showChangeType: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onChangeType: () => void;
  onSelectType: (entry: WorkoutCatalogEntry) => void;
  onCloseChangeType: () => void;
  onDismiss: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function WorkoutImportReviewSheet({
  visible,
  item,
  selectedCatalogId,
  isSaving,
  showChangeType,
  onSave,
  onDiscard,
  onChangeType,
  onSelectType,
  onCloseChangeType,
  onDismiss,
}: WorkoutImportReviewSheetProps) {
  const P = usePalette();

  if (!item) return null;

  const displayEntry = WORKOUT_CATALOG_ENTRIES.find((e) => e.id === selectedCatalogId) ?? item.catalogEntry;

  if (showChangeType) {
    return (
      <AppModal
        visible={visible}
        onClose={onCloseChangeType}
        title="Change activity type"
        sheetHeight={0.82}
        dismissGestureArea="sheet"
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <WorkoutActivityGrid
            entries={WORKOUT_CATALOG_ENTRIES}
            selectedId={selectedCatalogId}
            onSelect={onSelectType}
          />
        </ScrollView>
      </AppModal>
    );
  }

  return (
    <AppModal visible={visible} onClose={onDismiss} sheetHeight={0.52}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: P.workoutSoft }]}>
            <Ionicons name={displayEntry.icon} size={28} color={P.workout} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: P.text }]}>{item.label}</Text>
            {item.isFromWatch && (
              <View style={styles.watchRow}>
                <Ionicons name="watch-outline" size={14} color={P.textFaint} />
                <Text style={[styles.watchLabel, { color: P.textFaint }]}>
                  {item.sourceName ?? 'Apple Watch'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.statsRow, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          <Stat label="Duration" value={formatDuration(item.durationMinutes)} P={P} />
          <Stat
            label="Calories"
            value={item.caloriesBurned != null ? `${Math.round(item.caloriesBurned)} kcal` : '—'}
            P={P}
          />
          <Stat
            label="Avg HR"
            value={item.avgHeartRate != null ? `${item.avgHeartRate} bpm` : '—'}
            P={P}
          />
        </View>

        <Text style={[styles.hint, { color: P.textFaint }]}>
          Save this workout from your Watch, change the activity type, or discard it.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: P.workout },
              (pressed || isSaving) && { opacity: 0.75 },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Save workout</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onChangeType}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: P.cardEdge, backgroundColor: P.card },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="swap-horizontal-outline" size={18} color={P.text} />
            <Text style={[styles.secondaryBtnText, { color: P.text }]}>Change type</Text>
          </Pressable>

          <Pressable
            onPress={onDiscard}
            disabled={isSaving}
            style={({ pressed }) => [styles.discardBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.discardText, { color: P.textFaint }]}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

function Stat({
  label,
  value,
  P,
}: {
  label: string;
  value: string;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: P.textFaint }]}>{label}</Text>
      <Text style={[styles.statValue, { color: P.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  body: { flex: 1, paddingHorizontal: 24, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  watchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  watchLabel: { fontSize: 13, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  actions: { gap: 10, marginTop: 'auto', paddingBottom: 8 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
  discardBtn: { alignItems: 'center', paddingVertical: 10 },
  discardText: { fontSize: 14, fontWeight: '600' },
});
