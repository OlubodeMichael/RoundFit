// Master switches for features that are code-complete but intentionally not
// shipped yet. Flip to `true` to re-enable; each flag names its own plan doc.

/** Menstrual cycle tracking. See CYCLE_FEATURE_REMOVAL_PLAN.md. */
export const CYCLE_ENABLED = false;

/**
 * 30-day Mirror. The screen is design-complete but still renders hardcoded
 * sample data — see MIRROR_PLAN.md. Held back from first launch until the
 * report is computed from real logs. Flip to `true` once Phase 2 lands.
 */
export const MIRROR_ENABLED = false;
