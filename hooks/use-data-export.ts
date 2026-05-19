import { useCallback, useState } from 'react';
import { Platform, Share } from 'react-native';

import {
  fetchUserDataExport,
  writeExportToCacheFile,
} from '@/services/data-export';
import { DataExportError } from '@/types/data-export';

export type DataExportPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface UseDataExportResult {
  phase: DataExportPhase;
  errorMessage: string | null;
  fileUri: string | null;
  startExport: () => Promise<void>;
  shareExport: () => Promise<void>;
  reset: () => void;
}

export function useDataExport(): UseDataExportResult {
  const [phase, setPhase] = useState<DataExportPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setErrorMessage(null);
    setFileUri(null);
  }, []);

  const startExport = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    setFileUri(null);

    try {
      const payload = await fetchUserDataExport();
      const uri = await writeExportToCacheFile(payload);
      setFileUri(uri);
      setPhase('ready');
    } catch (err: unknown) {
      const message =
        err instanceof DataExportError
          ? err.message
          : 'Could not export your data. Please try again.';
      setErrorMessage(message);
      setPhase('error');
    }
  }, []);

  const shareExport = useCallback(async () => {
    if (!fileUri) return;

    await Share.share(
      Platform.OS === 'ios'
        ? { url: fileUri, title: 'RoundFit data export' }
        : { message: fileUri, title: 'RoundFit data export' },
    );
  }, [fileUri]);

  return {
    phase,
    errorMessage,
    fileUri,
    startExport,
    shareExport,
    reset,
  };
}
