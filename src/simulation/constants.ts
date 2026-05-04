/** Spec: only A5 paper (ISO 216). Long / short for feed orientation used in Three.js footprint. */
export const A5_LONG_MM = 210;
export const A5_SHORT_MM = 148;
export const A5_ASPECT_LONG_OVER_SHORT = A5_LONG_MM / A5_SHORT_MM;

export const PAGE_COUNT_MIN = 40;
export const PAGE_COUNT_MAX = 100;

/** Punching — measurable setup (mm). */
export const HOLE_PINCH_MM_MIN = 0.1;
export const HOLE_PINCH_MM_MAX = 0.5;
export const EDGE_MARGIN_MM_MIN = 5;
export const EDGE_MARGIN_MM_MAX = 7;

/** Full manual-machine cycle length (wall clock at 1× speed). */
export const MANUAL_CYCLE_SECONDS_MIN = 180;
export const MANUAL_CYCLE_SECONDS_MAX = 300;

/** Stage indices in `STAGES` (StageController) for spec timers. */
export const STAGE_COUNTING = 1;
export const STAGE_PUNCHING = 3;
export const STAGE_BINDING = 4;
