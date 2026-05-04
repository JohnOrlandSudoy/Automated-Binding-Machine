/** Spec: only A5 paper (ISO 216). Long / short for feed orientation used in Three.js footprint. */
export const A5_LONG_MM = 210;
export const A5_SHORT_MM = 148;
export const A5_ASPECT_LONG_OVER_SHORT = A5_LONG_MM / A5_SHORT_MM;

export const PAGE_COUNT_MIN = 40;
export const PAGE_COUNT_MAX = 80;

/** Stage indices in `STAGES` (StageController) for spec timers. */
export const STAGE_COUNTING = 1;
export const STAGE_PUNCHING = 3;
export const STAGE_BINDING = 4;
