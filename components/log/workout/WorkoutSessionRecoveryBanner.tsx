import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useWorkoutSession } from '@/context/workout-session-context';
import { getCatalogEntryById } from '@/config/workout-catalog';
import { usePalette } from '@/lib/log-theme';

interface WorkoutSessionRecoveryBannerProps {
  onRecover: () => void;
}

function fmtElapsedSince(startedAt: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

export function WorkoutSessionRecoveryBanner({
  onRecover,
}: WorkoutSessionRecoveryBannerProps) {
  const P = usePalette();
  const { hasRecoverableSession, recoverableSession, discard } = useWorkoutSession();

  if (!hasRecoverableSession || !recoverableSession) return null;

  const entry = getCatalogEntryById(recoverableSession.workoutType);
  const label = recoverableSession.workoutName || entry?.label || 'Workout';
  const wasPaused = recoverableSession.pausedAt != null;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: P.card, borderColor: P.workout + '66' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: P.workoutSoft }]}>
        <Ionicons name="refresh-outline" size={18} color={P.workout} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: P.text }]}>Resume workout?</Text>
        <Text style={[styles.sub, { color: P.textFaint }]} numberOfLines={1}>
          {label}
          {wasPaused ? ' · paused' : ''} · started {fmtElapsedSince(recoverableSession.startedAt)}
        </Text>
      </View>
      <Pressable
        onPress={() => void discard()}
        hitSlop={8}
        style={({ pressed }) => [
          styles.discardBtn,
          { backgroundColor: P.sunken, borderColor: P.cardEdge },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text style={[styles.discardText, { color: P.textFaint }]}>Discard</Text>
      </Pressable>
      <Pressable
        onPress={onRecover}
        style={({ pressed }) => [
          styles.recoverBtn,
          { backgroundColor: P.workout },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.recoverText}>Recover</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 11, marginTop: 2 },
  discardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  discardText: { fontSize: 11, fontWeight: '700' },
  recoverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  recoverText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
