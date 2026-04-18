import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';
import type { ManualMealInput } from '@/components/log/ManualMealInputModal';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

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
  /** All meals logged for today. */
  meals: MealItem[];

  /** Daily calorie goal. */
  mealGoal: number;

  /** Sum of calories across all logged meals. */
  totalCalories: number;

  /** Calories remaining until the daily goal is reached. */
  remaining: number;

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

  /** Re-fetches today's log from the server. */
  refreshLogs: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function foodFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res  = await fetch(`${API_BASE}${path}`, {
      ...options, headers, credentials: 'include', signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
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
  const createdAt = typeof row.created_at === 'string' ? new Date(row.created_at) : new Date();
  const time      = createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Prefer an explicit label from the server; fall back to a time-based guess.
  const rawLabel =
    typeof row.meal_label === 'string' ? row.meal_label :
    typeof row.meal       === 'string' ? row.meal       :
    null;
  const meal = rawLabel ? prettifyMealLabel(rawLabel) : deriveMealLabel(createdAt);

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
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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

  const [meals,     setMeals]     = useState<MealItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Meal goal tracks the current user's calorie budget. Falls back to TDEE,
  // then to the app-wide default when we haven't loaded a profile yet.
  const mealGoal = useMemo(() => {
    if (!user) return DEFAULT_MEAL_GOAL;
    return user.calorieBudget ?? user.tdee ?? DEFAULT_MEAL_GOAL;
  }, [user]);

  const totalCalories = useMemo(() => meals.reduce((sum, m) => sum + m.cals, 0), [meals]);
  const remaining     = mealGoal - totalCalories;

  // ── Fetch today's logs ──────────────────────────────────────────────────
  // We refetch whenever the auth state resolves or the signed-in user
  // changes so every account sees its own data and nothing leaks across
  // sign-in boundaries.
  const fetchLogs = useCallback(async () => {
    const { ok, body } = await foodFetch(`/food/logs?date=${todayDateString()}`);
    if (!ok) return;
    const rows = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
    setMeals(rows.map(fromApiLog));
  }, []);

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
    let cancelled = false;
    setIsLoading(true);
    setMeals([]);

    (async () => {
      try {
        await fetchLogs();
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

    const { ok, body } = await foodFetch('/food/log', {
      method: 'POST',
      body:   JSON.stringify({
        meal_name:  entry.name,
        meal_label: entry.label,
        calories:   entry.calories,
        protein:    entry.protein,
        carbs:      entry.carbs,
        fat:        entry.fat,
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
    const { ok, body } = await foodFetch('/food/photo', {
      method: 'POST',
      body:   JSON.stringify({ base64Image }),
    });
    if (!ok || !body.data) return null;
    const item = fromApiLog(body.data as Record<string, unknown>);
    if (item.cals === 0) {
      // Remove the server-saved entry and ask the user to retry
      await foodFetch(`/food/log/${item.id}`, { method: 'DELETE' });
      throw new ZeroCaloriesError();
    }
    setMeals((prev) => [...prev, item]);
    return item;
  }, []);

  // ── Log via barcode ──────────────────────────────────────────────────────
  const logBarcode = useCallback(async (barcode: string) => {
    const { ok, body } = await foodFetch('/food/barcode', {
      method: 'POST',
      body:   JSON.stringify({ barcode }),
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

    const { ok } = await foodFetch(`/food/log/${id}`, { method: 'DELETE' });
    if (!ok) {
      setMeals(snapshot); // rollback
      throw new Error('Failed to delete meal');
    }
  }, [meals]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refreshLogs = useCallback(async () => {
    await fetchLogs();
  }, [fetchLogs]);

  return (
    <FoodContext.Provider value={{
      meals, mealGoal, totalCalories, remaining, isLoading,
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
