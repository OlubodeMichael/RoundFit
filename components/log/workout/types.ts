export type WorkoutType = 'strength' | 'run' | 'cardio' | 'hiit' | 'yoga' | 'other';
export type Intensity = 'low' | 'moderate' | 'high' | 'max';

export type SetRow = {
  id: string;
  reps: string;
  weight: string;
};

export interface SelectedExercise {
  name: string;
  sets: SetRow[];
}

export type ExerciseSection = {
  category: string;
  exercises: string[];
};
