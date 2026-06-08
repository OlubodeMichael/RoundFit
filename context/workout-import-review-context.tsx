import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePostHog } from 'posthog-react-native';

import { WorkoutImportReviewSheet } from '@/components/log/workout/WorkoutImportReviewSheet';
import { getCatalogEntryById, type WorkoutCatalogEntry } from '@/config/workout-catalog';
import { useAuth } from '@/context/auth-context';
import { useWorkouts } from '@/hooks/use-workouts';
import { useHealthKitWorkoutImport } from '@/hooks/use-healthkit-workout-import';
import {
  discardReviewedWorkout,
  fetchAppleFitnessWorkoutsForDisplay,
  importReviewedWorkout,
  type WorkoutImportReviewItem,
} from '@/services/workout-import';
import { notifyWorkoutImportSaved } from '@/utils/notifications';

export interface WorkoutImportReviewContextValue {
  currentItem: WorkoutImportReviewItem | null;
  isVisible: boolean;
  isSaving: boolean;
  showChangeType: boolean;
  selectedCatalogId: string | null;
  pendingCount: number;
  isImporting: boolean;
  save: () => Promise<void>;
  discard: () => Promise<void>;
  openChangeType: () => void;
  closeChangeType: () => void;
  changeType: (entry: WorkoutCatalogEntry) => void;
  dismiss: () => void;
  runImport: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  openPendingReview: () => Promise<void>;
  openReviewForItem: (item: WorkoutImportReviewItem) => void;
}

const WorkoutImportReviewContext = createContext<WorkoutImportReviewContextValue | null>(null);

export function WorkoutImportReviewProvider({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  const { user } = useAuth();
  const { logWorkout, refreshWorkouts, workouts } = useWorkouts();

  const [queue, setQueue] = useState<WorkoutImportReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangeType, setShowChangeType] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const queueRef = useRef(queue);
  queueRef.current = queue;

  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;

  const isAlreadyImported = useCallback((uuid: string) => {
    return workoutsRef.current.some((workout) => workout.healthkit_uuid === uuid);
  }, []);

  const presentQueue = useCallback((items: WorkoutImportReviewItem[]) => {
    if (items.length === 0) return;
    setQueue(items);
    setCurrentIndex(0);
    setSelectedCatalogId(items[0]?.catalogId ?? null);
    setShowChangeType(false);
    setIsVisible(true);
  }, []);

  const handlePendingReviews = useCallback((items: WorkoutImportReviewItem[]) => {
    setPendingCount(items.length);
  }, []);

  const { runImport, isImporting } = useHealthKitWorkoutImport({
    reviewBeforeImport: true,
    onPendingReviews: handlePendingReviews,
  });

  const refreshPendingCount = useCallback(async () => {
    if (!user?.id) {
      setPendingCount(0);
      return;
    }
    try {
      const pending = await fetchAppleFitnessWorkoutsForDisplay({
        isAlreadyImported,
        userId: user.id,
      });
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, [isAlreadyImported, user?.id]);

  const openPendingReview = useCallback(async () => {
    if (!user?.id) return;
    await runImport();
    const pending = await fetchAppleFitnessWorkoutsForDisplay({
      isAlreadyImported,
      userId: user.id,
    });
    setPendingCount(pending.length);
    if (pending.length > 0) {
      presentQueue(pending);
    }
  }, [isAlreadyImported, presentQueue, runImport, user?.id]);

  const openReviewForItem = useCallback((item: WorkoutImportReviewItem) => {
    presentQueue([item]);
  }, [presentQueue]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  const currentItem = queue[currentIndex] ?? null;

  const advanceOrClose = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      setSelectedCatalogId(queue[nextIndex]?.catalogId ?? null);
      setShowChangeType(false);
      return;
    }
    setQueue([]);
    setCurrentIndex(0);
    setSelectedCatalogId(null);
    setShowChangeType(false);
    setIsVisible(false);
    void refreshPendingCount();
  }, [currentIndex, queue, refreshPendingCount]);

  const captureReviewEvent = useCallback((
    action: 'save' | 'change_type' | 'discard',
    item: WorkoutImportReviewItem,
    catalogId?: string,
  ) => {
    posthog.capture('workout_import_reviewed', {
      action,
      healthkit_uuid: item.sample.uuid,
      catalog_id: catalogId ?? item.catalogId,
      original_catalog_id: item.catalogId,
      duration_mins: item.durationMinutes,
      calories_burned: item.caloriesBurned ?? null,
      avg_heart_rate: item.avgHeartRate ?? null,
    });
  }, [posthog]);

  const save = useCallback(async () => {
    if (!currentItem || isSaving) return;
    setIsSaving(true);
    try {
      const catalogId = selectedCatalogId ?? currentItem.catalogId;
      const changedType = catalogId !== currentItem.catalogId;
      await importReviewedWorkout(currentItem.sample, logWorkout, { catalogId }, user?.id);
      captureReviewEvent(changedType ? 'change_type' : 'save', currentItem, catalogId);
      const entry = getCatalogEntryById(catalogId);
      posthog.capture('workout_imported_watch', {
        activity_id: catalogId,
        backend_type: entry?.backendType ?? 'other',
        duration_mins: currentItem.durationMinutes,
        calories_burned: currentItem.caloriesBurned ?? null,
        action: changedType ? 'change_type' : 'save',
      });
      void notifyWorkoutImportSaved({
        label: entry?.label ?? currentItem.label,
        caloriesBurned: currentItem.caloriesBurned,
      }).catch(() => {});
      await refreshWorkouts();
      advanceOrClose();
    } finally {
      setIsSaving(false);
    }
  }, [
    advanceOrClose,
    captureReviewEvent,
    currentItem,
    isSaving,
    logWorkout,
    posthog,
    refreshWorkouts,
    selectedCatalogId,
    user?.id,
  ]);

  const discard = useCallback(async () => {
    if (!currentItem || isSaving) return;
    setIsSaving(true);
    try {
      await discardReviewedWorkout(currentItem.sample, user?.id);
      captureReviewEvent('discard', currentItem);
      advanceOrClose();
    } finally {
      setIsSaving(false);
    }
  }, [advanceOrClose, captureReviewEvent, currentItem, isSaving, user?.id]);

  const openChangeType = useCallback(() => {
    setShowChangeType(true);
  }, []);

  const closeChangeType = useCallback(() => {
    setShowChangeType(false);
  }, []);

  const changeType = useCallback((entry: WorkoutCatalogEntry) => {
    setSelectedCatalogId(entry.id);
    setShowChangeType(false);
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setShowChangeType(false);
  }, []);

  const value = useMemo((): WorkoutImportReviewContextValue => ({
    currentItem,
    isVisible,
    isSaving,
    showChangeType,
    selectedCatalogId: selectedCatalogId ?? currentItem?.catalogId ?? null,
    pendingCount,
    isImporting,
    save,
    discard,
    openChangeType,
    closeChangeType,
    changeType,
    dismiss,
    runImport,
    refreshPendingCount,
    openPendingReview,
    openReviewForItem,
  }), [
    changeType,
    closeChangeType,
    currentItem,
    discard,
    dismiss,
    isImporting,
    isSaving,
    isVisible,
    openChangeType,
    openPendingReview,
    openReviewForItem,
    pendingCount,
    refreshPendingCount,
    runImport,
    save,
    selectedCatalogId,
    showChangeType,
  ]);

  return (
    <WorkoutImportReviewContext.Provider value={value}>
      {children}
      <WorkoutImportReviewSheet
        visible={isVisible}
        item={currentItem}
        selectedCatalogId={selectedCatalogId ?? currentItem?.catalogId ?? null}
        isSaving={isSaving}
        showChangeType={showChangeType}
        onSave={() => { void save(); }}
        onDiscard={() => { void discard(); }}
        onChangeType={openChangeType}
        onSelectType={changeType}
        onCloseChangeType={closeChangeType}
        onDismiss={dismiss}
      />
    </WorkoutImportReviewContext.Provider>
  );
}

export function useWorkoutImportReview(): WorkoutImportReviewContextValue {
  const ctx = useContext(WorkoutImportReviewContext);
  if (!ctx) {
    throw new Error('useWorkoutImportReview must be used inside <WorkoutImportReviewProvider>');
  }
  return ctx;
}
