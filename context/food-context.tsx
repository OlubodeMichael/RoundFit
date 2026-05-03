import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/auth-context';
import type { ManualMealInput } from '@/components/log/ManualMealInputModal';
import { getLocalDateString } from '@/utils/date';
import { apiFetch } from '@/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MealItem {
  id:        string;
  meal:      string;
  name:      string;
  cals:      number;
  protein?:  number;
  carbs?:    number;
  fat?:      number;
  time:      string;
  imageUrl?: string;
}

export interface FoodContextValue {
  /** All meals logged for the active date. */
  meals: MealItem[];

  /** Daily calorie goal. */
  mealGoal: number;

  /** Sum of calories across all logged meals. */
  totalCalories: number;

  /** Calories remaining until the daily goal is reached. */
  remaining: number;

  /** Total protein consumed across all meals (grams). */
  totalProtein: number;

  /** Total carbs consumed across all meals (grams). */
  totalCarbs: number;

  /** Total fat consumed across all meals (grams). */
  totalFat: number;

  /** The date currently being viewed (YYYY-MM-DD). */
  activeDate: string;

  /** True while the initial log fetch is in-flight. */
  isLoading: boolean;

  /** Logs a meal from manual entry — hits POST /food/log. */
  addMeal: (entry: ManualMealInput) => Promise<void>;

  /** Analyzes a base64 photo via AI, saves the result, and returns the MealItem. */
  analyzePhoto: (base64Image: string) => Promise<MealItem | null>;

  /** Logs food from a barcode string — hits POST /food/barcode. */
  logBarcode: (barcode: string) => Promise<void>;

  /** Removes a meal — hits DELETE /food/log/:id. */
  deleteMeal: (id: string) => Promise<void>;

  /** Re-fetches logs for the given date (defaults to today). Changes activeDate when a date is passed. */
  refreshLogs: (date?: string) => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

/**
 * Same behaviour as auth `apiFetch`: cookies + timeout, and one retry on 401
 * after POST /auth/refresh so cold-start GETs succeed when the session rotates.
 */

function foodLogRowsFromResponse(body: Record<string, unknown>): Record<string, unknown>[] {
  const d = body.data;
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    const nested = o.logs ?? o.items ?? o.meals;
    if (Array.isArray(nested)) return nested as Record<string, unknown>[];
  }
  if (Array.isArray(body.logs)) return body.logs as Record<string, unknown>[];
  return [];
}

// ── Normalisation helpers ──────────────────────────────────────────────────

function deriveMealLabel(date: Date): string {
  const h = date.getHours();
  if (h < 10) return 'Breakfast';
  if (h < 14) return 'Lunch';
  if (h < 17) return 'Snack';
  if (h < 21) return 'Dinner';
  return 'Snack';
}

function prettifyMealLabel(raw: string): string {
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

function fromApiLog(row: Record<string, unknown>): MealItem {
  const raw = row.logged_at ?? row.created_at;
  const loggedAt = typeof raw === 'string' && raw ? new Date(raw) : null;
  const time = loggedAt
    ? loggedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '—';

  // Prefer an explicit label from the server; fall back to a time-based guess.
  const rawLabel =
    typeof row.meal_label === 'string' ? row.meal_label :
    typeof row.meal       === 'string' ? row.meal       :
    null;
  const meal = rawLabel ? prettifyMealLabel(rawLabel) : deriveMealLabel(loggedAt ?? new Date());

  // meal_name may be a JS array, a JSON array string, or a plain string
  const rawName = row.meal_name;
  let name: string;
  if (Array.isArray(rawName)) {
    name = (rawName as string[]).join(', ');
  } else {
    const str = String(rawName ?? '');
    // Handle stringified arrays like "['Chicken', 'Rice']" or '["Chicken","Rice"]'
    if (str.startsWith('[') && str.endsWith(']')) {
      try {
        const parsed = JSON.parse(str.replace(/'/g, '"'));
        name = Array.isArray(parsed) ? parsed.join(', ') : str;
      } catch {
        name = str;
      }
    } else {
      name = str;
    }
  }

  return {
    id:       String(row.id ?? ''),
    meal,
    name,
    cals:     typeof row.calories === 'number' ? row.calories : 0,
    protein:  typeof row.protein  === 'number' ? row.protein  : undefined,
    carbs:    typeof row.carbs    === 'number' ? row.carbs    : undefined,
    fat:      typeof row.fat      === 'number' ? row.fat      : undefined,
    time,
    imageUrl: typeof row.image_url === 'string' ? row.image_url : undefined,
  };
}

function todayDateString(): string {
  return getLocalDateString();
}

function titleMealLabel(value: ManualMealInput['label']): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export class ZeroCaloriesError extends Error {
  constructor() { super('zero_calories'); }
}

const DEFAULT_MEAL_GOAL = 2100;

// ── Context ────────────────────────────────────────────────────────────────

const FoodContext = createContext<FoodContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function FoodProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [meals,      setMeals]      = useState<MealItem[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [activeDate, setActiveDate] = useState(todayDateString);
  const appStateRef = useRef(AppState.currentState);

  // Meal goal tracks the current user's calorie budget. Falls back to TDEE,
  // then to the app-wide default when we haven't loaded a profile yet.
  const mealGoal = useMemo(() => {
    if (!user) return DEFAULT_MEAL_GOAL;
    return user.calorieBudget ?? user.tdee ?? DEFAULT_MEAL_GOAL;
  }, [user]);

  const totalCalories = useMemo(() => meals.reduce((sum, m) => sum + m.cals,              0), [meals]);
  const totalProtein  = useMemo(() => meals.reduce((sum, m) => sum + (m.protein ?? 0),    0), [meals]);
  const totalCarbs    = useMemo(() => meals.reduce((sum, m) => sum + (m.carbs   ?? 0),    0), [meals]);
  const totalFat      = useMemo(() => meals.reduce((sum, m) => sum + (m.fat     ?? 0),    0), [meals]);
  const remaining     = mealGoal - totalCalories;

  // ── Fetch logs for a given date ─────────────────────────────────────────
  const fetchLogs = useCallback(async (date: string) => {
    const { ok, body } = await apiFetch(`/food/logs?date=${encodeURIComponent(date)}`);
    if (!ok) return;
    const rows = foodLogRowsFromResponse(body);
    setMeals(rows.map(fromApiLog));
  }, []);

  // ── Reset to today when app returns to foreground on a new day ──────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        const today = todayDateString();
        setActiveDate((cur) => {
          if (cur !== today) {
            void fetchLogs(today);
            return today;
          }
          return cur;
        });
      }
    });
    return () => sub.remove();
  }, [fetchLogs]);

  useEffect(() => {
    // Wait for the auth layer to settle before deciding what to fetch.
    if (status === 'loading') return;

    // No session → make sure we never show another user's data.
    if (status === 'unauthenticated') {
      setMeals([]);
      setIsLoading(false);
      return;
    }

    // Authenticated → clear whatever we had and pull today's logs for this
    // user. `user?.id` in the dep array guarantees we refetch after account
    // switches too.
    const today = todayDateString();
    let cancelled = false;
    setIsLoading(true);
    setMeals([]);
    setActiveDate(today);

    (async () => {
      try {
        await fetchLogs(today);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchLogs]);

  // ── Add meal (manual) ────────────────────────────────────────────────────
  const addMeal = useCallback(async (entry: ManualMealInput) => {
    const now      = new Date();
    const tempId   = `optimistic-${Date.now()}`;
    const optimistic: MealItem = {
      id:      tempId,
      meal:    titleMealLabel(entry.label),
      name:    entry.name,
      cals:    entry.calories,
      protein: entry.protein,
      carbs:   entry.carbs,
      fat:     entry.fat,
      time:    now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    setMeals((prev) => [...prev, optimistic]);

    const { ok, body } = await apiFetch('/food/log', {
      method: 'POST',
      body:   JSON.stringify({
        meal_name:  entry.name,
        meal_label: entry.label,
        calories:   entry.calories,
        protein:    entry.protein,
        carbs:      entry.carbs,
        fat:        entry.fat,
        log_date:   todayDateString(),
      }),
    });

    if (ok && body.data) {
      const saved = fromApiLog(body.data as Record<string, unknown>);
      setMeals((prev) => prev.map((m) => m.id === tempId ? saved : m));
      return;
    }

    // rollback on failure
    setMeals((prev) => prev.filter((m) => m.id !== tempId));
    throw new Error('Failed to log meal');
  }, []);

  // ── Analyze via photo ────────────────────────────────────────────────────
  const analyzePhoto = useCallback(async (base64Image: string): Promise<MealItem | null> => {
    const { ok, body } = await apiFetch('/food/photo', {
      method: 'POST',
      body:   JSON.stringify({ base64Image, log_date: todayDateString() }),
    });
    if (!ok || !body.data) return null;
    const item = fromApiLog(body.data as Record<string, unknown>);
    if (item.cals === 0) {
      // Remove the server-saved entry and ask the user to retry
      await apiFetch(`/food/log/${item.id}`, { method: 'DELETE' });
      throw new ZeroCaloriesError();
    }
    setMeals((prev) => [...prev, item]);
    return item;
  }, []);

  // ── Log via barcode ──────────────────────────────────────────────────────
  const logBarcode = useCallback(async (barcode: string) => {
    const { ok, body } = await apiFetch('/food/barcode', {
      method: 'POST',
      body:   JSON.stringify({ barcode, log_date: todayDateString() }),
    });
    if (!ok || !body.data) {
      throw new Error('Failed to look up barcode');
    }
    setMeals((prev) => [...prev, fromApiLog(body.data as Record<string, unknown>)]);
  }, []);

  // ── Delete meal ──────────────────────────────────────────────────────────
  const deleteMeal = useCallback(async (id: string) => {
    const snapshot = meals;
    setMeals((prev) => prev.filter((m) => m.id !== id));

    const { ok } = await apiFetch(`/food/log/${id}`, { method: 'DELETE' });
    if (!ok) {
      setMeals(snapshot); // rollback
      throw new Error('Failed to delete meal');
    }
  }, [meals]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refreshLogs = useCallback(async (date?: string) => {
    const target = date ?? todayDateString();
    if (date && date !== activeDate) setActiveDate(date);
    if (!date && activeDate !== target) setActiveDate(target);
    await fetchLogs(target);
  }, [activeDate, fetchLogs]);

  return (
    <FoodContext.Provider value={{
      meals, mealGoal, totalCalories, totalProtein, totalCarbs, totalFat,
      remaining, activeDate, isLoading,
      addMeal, analyzePhoto, logBarcode, deleteMeal, refreshLogs,
    }}>
      {children}
    </FoodContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useFood(): FoodContextValue {
  const ctx = useContext(FoodContext);
  if (!ctx) throw new Error('useFood must be used inside <FoodProvider>');
  return ctx;
}
