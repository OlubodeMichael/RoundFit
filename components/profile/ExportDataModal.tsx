import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { useDataExport } from '@/hooks/use-data-export';
import { useTheme } from '@/hooks/use-theme';

export interface ExportDataModalProps {
  visible: boolean;
  onClose: () => void;
  onExportStarted?: () => void;
  onExportCompleted?: () => void;
  onExportFailed?: (message: string) => void;
}

function usePalette() {
  const { isDark } = useTheme();
  return isDark
    ? {
        sunken: '#0E0F13',
        edge: 'rgba(255,255,255,0.08)',
        hair: 'rgba(255,255,255,0.06)',
        text: '#F4F4F5',
        dim: '#909096',
        faint: '#505058',
        accent: '#38BDF8',
      }
    : {
        sunken: '#F7F7F9',
        edge: 'rgba(0,0,0,0.06)',
        hair: 'rgba(0,0,0,0.05)',
        text: '#09090B',
        dim: '#6B7280',
        faint: '#C0C0C8',
        accent: '#0EA5E9',
      };
}

export function ExportDataModal({
  visible,
  onClose,
  onExportStarted,
  onExportCompleted,
  onExportFailed,
}: ExportDataModalProps) {
  const P = usePalette();
  const { phase, errorMessage, startExport, shareExport, reset } = useDataExport();

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  useEffect(() => {
    if (phase === 'ready') onExportCompleted?.();
    if (phase === 'error' && errorMessage) onExportFailed?.(errorMessage);
  }, [phase, errorMessage, onExportCompleted, onExportFailed]);

  const busy = phase === 'loading';

  function handleClose() {
    if (!busy) onClose();
  }

  async function handleExport() {
    onExportStarted?.();
    await startExport();
  }

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Export Data"
      sheetHeight={0.62}
    >
      <Text style={[styles.subtitle, { color: P.dim }]}>
        Download a copy of your RoundFit data
      </Text>

      <View style={styles.body}>
        {phase === 'ready' ? (
          <View style={[styles.infoBox, { backgroundColor: 'rgba(56,189,248,0.1)', borderColor: 'rgba(56,189,248,0.25)' }]}>
            <Ionicons name="checkmark-circle" size={20} color={P.accent} />
            <Text style={[styles.infoText, { color: P.text }]}>
              Your export is ready. Share or save the JSON file to Files, email, or cloud storage.
            </Text>
          </View>
        ) : phase === 'error' ? (
          <View style={[styles.infoBox, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={[styles.infoText, { color: P.text }]}>{errorMessage}</Text>
          </View>
        ) : (
          <Text style={[styles.copy, { color: P.dim }]}>
            Includes your profile, food logs, workouts, health and sleep data, weight, check-ins,
            insights, and cycle history. Export is limited to once per day.
          </Text>
        )}

        {busy && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={P.accent} />
            <Text style={[styles.loadingText, { color: P.dim }]}>Preparing your export…</Text>
          </View>
        )}
      </View>

      <View style={[styles.footer, { borderTopColor: P.hair }]}>
        {phase === 'ready' ? (
          <>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: P.accent }]} onPress={() => void shareExport()} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Share export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: P.edge }]} onPress={handleClose} activeOpacity={0.7}>
              <Text style={[styles.secondaryBtnText, { color: P.dim }]}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: busy ? P.sunken : P.accent, opacity: busy ? 0.7 : 1 }]}
              onPress={() => void handleExport()}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryBtnText, { color: busy ? P.faint : '#FFF' }]}>
                {busy ? 'Exporting…' : phase === 'error' ? 'Try again' : 'Export my data'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: P.edge }]} onPress={handleClose} disabled={busy} activeOpacity={0.7}>
              <Text style={[styles.secondaryBtnText, { color: P.dim }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: -4,
    marginBottom: 4,
  },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 14 },
  copy: { fontSize: 14, lineHeight: 21 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  footer: { gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  secondaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },
});
