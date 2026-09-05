import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type OnboardingDraft = {
  age: number;
  sex: 'male' | 'female' | null;
  weightKg: number;
  heightCm: number;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'in';
  goals: string[];
  activity: string | null;
  cycleLength: number;
  cyclePhase: string | null;
  lifeStage: string | null;
  unit: 'metric' | 'imperial';
  healthChoice: 'connect' | 'skip' | null;
  name: string;
};

const KG_PER_LB = 2.20462;
const CM_PER_IN = 2.54;

const INITIAL_DRAFT: OnboardingDraft = {
  age: 25,
  sex: null,
  weightKg: 154 / KG_PER_LB,
  heightCm: 67 * CM_PER_IN,
  weightUnit: 'lb',
  heightUnit: 'in',
  goals: [],
  activity: null,
  cycleLength: 28,
  cyclePhase: null,
  lifeStage: null,
  unit: 'imperial',
  healthChoice: null,
  name: '',
};

type OnboardingDraftContextValue = {
  draft: OnboardingDraft;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
};

const OnboardingDraftContext = createContext<OnboardingDraftContextValue | null>(null);

export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const updateDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);
  const value = useMemo(() => ({ draft, updateDraft }), [draft, updateDraft]);

  return (
    <OnboardingDraftContext.Provider value={value}>
      {children}
    </OnboardingDraftContext.Provider>
  );
}

export function useOnboardingDraft() {
  const context = useContext(OnboardingDraftContext);
  if (!context) {
    throw new Error('useOnboardingDraft must be used inside OnboardingDraftProvider');
  }
  return context;
}
