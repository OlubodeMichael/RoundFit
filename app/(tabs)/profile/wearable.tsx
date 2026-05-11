import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useHealth } from '@/hooks/use-health';
import { isExpoGoEnvironment } from '@/utils/healthkit';

const LAST_HEALTH_SYNC_KEY = '@roundfit/last_health_sync';

function formatLastSync(ts: number | null): string {
  if (!ts) return 'Never';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export default function WearableScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isConnected, isLoading, syncFromDevice } = useHealth();
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const bg  = isDark ? '#0A0B0F' : '#F7F7F5';
  const hi  = isDark ? '#F4F4F5' : '#0C0C0C';
  const mid = isDark ? '#909096' : '#888';
  const card = isDark ? '#17171C' : '#FFFFFF';
  const edge = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const ok = '#22C55E';
  const warn = '#F59E0B';
  const isUnsupported = Platform.OS !== 'ios' || isExpoGoEnvironment();

  const loadLastSync = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const raw = await AsyncStorage.getItem(LAST_HEALTH_SYNC_KEY);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      setLastSyncMs(Number.isNaN(parsed) ? null : parsed);
    } catch {
      setLastSyncMs(null);
    }
  }, []);

  useEffect(() => {
    void loadLastSync();
  }, [loadLastSync]);

  const handleManualSync = useCallback(async () => {
    if (isUnsupported) return;
    setSyncError(null);
    setSyncing(true);
    try {
      await syncFromDevice(true);
      await loadLastSync();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not sync right now.';
      setSyncError(message);
    } finally {
      setSyncing(false);
    }
  }, [isUnsupported, loadLastSync, syncFromDevice]);

  const statusLabel = useMemo(() => {
    if (isUnsupported) return 'Unavailable in this build';
    return isConnected ? 'Connected' : 'Not connected';
  }, [isConnected, isUnsupported]);

  const statusColor = isUnsupported ? warn : (isConnected ? ok : warn);

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={hi} />
      </TouchableOpacity>
      <Text style={[s.eyebrow, { color: mid }]}>Health Sync</Text>
      <Text style={[s.title, { color: hi }]}>Wearable</Text>

      <View style={[s.card, { backgroundColor: card, borderColor: edge }]}>
        <View style={s.row}>
          <Text style={[s.label, { color: mid }]}>HealthKit Status</Text>
          <Text style={[s.value, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        <View style={[s.divider, { backgroundColor: edge }]} />

        <View style={s.row}>
          <Text style={[s.label, { color: mid }]}>Last Sync</Text>
          <Text style={[s.value, { color: hi }]}>{formatLastSync(lastSyncMs)}</Text>
        </View>

        {syncError ? (
          <>
            <View style={[s.divider, { backgroundColor: edge }]} />
            <Text style={s.errorText}>{syncError}</Text>
          </>
        ) : null}
      </View>

      <TouchableOpacity
        style={[
          s.syncBtn,
          { backgroundColor: syncing || isLoading || isUnsupported ? '#9CA3AF' : '#F97316' },
        ]}
        onPress={handleManualSync}
        disabled={syncing || isLoading || isUnsupported}
        activeOpacity={0.8}
      >
        {syncing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={s.syncBtnText}>Sync Now</Text>
        )}
      </TouchableOpacity>

      {isUnsupported ? (
        <Text style={[s.sub, { color: mid }]}>
          Install a development build on iOS to use HealthKit sync.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: 20 },
  back:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 6 },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  title:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },
  sub:     { fontSize: 14, marginTop: 12, lineHeight: 20 },
  card: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: { fontSize: 14, fontWeight: '500' },
  value: { fontSize: 14, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  syncBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    lineHeight: 18,
  },
});
