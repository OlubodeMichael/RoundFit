import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share } from 'react-native';

import {
  deleteExportFile,
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
  const fileUriRef = useRef<string | null>(null);
  fileUriRef.current = fileUri;

  // The export file is the user's full account data, unencrypted in the cache
  // dir. Remove it once the export flow is dismissed or the screen unmounts —
  // it stays available for re-sharing only while the flow is open.
  useEffect(() => {
    return () => {
      if (fileUriRef.current) deleteExportFile(fileUriRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (fileUriRef.current) deleteExportFile(fileUriRef.current);
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
