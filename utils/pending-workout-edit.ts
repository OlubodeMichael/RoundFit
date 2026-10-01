/** Hands an edit request to the already-mounted training screen. */
let pendingWorkoutEditId: string | null = null;

export function requestWorkoutEdit(workoutId: string): void {
  pendingWorkoutEditId = workoutId;
}

export function consumeWorkoutEditId(): string | null {
  const workoutId = pendingWorkoutEditId;
  pendingWorkoutEditId = null;
  return workoutId;
}
