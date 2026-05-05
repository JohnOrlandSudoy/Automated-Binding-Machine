/** Spec: only A5 paper (ISO 216). Long / short for feed orientation used in Three.js footprint. */
export const A5_LONG_MM = 210;
export const A5_SHORT_MM = 148;
export const A5_ASPECT_LONG_OVER_SHORT = A5_LONG_MM / A5_SHORT_MM;

export const PAGE_COUNT_MIN = 40;
export const PAGE_COUNT_MAX = 100;

/** 3D viewer: fixed wall-clock loop length at 1× speed (panel uses separate randomized throughput model). */
export const VIEWER_MANUAL_CYCLE_SECONDS = 240;

/** Default tray capacity for stacked books in the 3D scene. */
export const DEFAULT_TRAY_BATCH_CAPACITY = 10;

/** P1 — Counting accuracy when drawing actual count from target (recommended band). */
export const COUNTING_ACCURACY_PCT_MIN = 99.5;
export const COUNTING_ACCURACY_PCT_MAX = 100;

/** P2 — Punching offset Δx (mm). */
export const PUNCH_OFFSET_MM_MIN = 0;
export const PUNCH_OFFSET_MM_MAX = 0.5;

/** P3 — Dimensional margin W (mm), used in punching accuracy and offset model. */
export const DIMENSIONAL_MARGIN_MM_MIN = 4;
export const DIMENSIONAL_MARGIN_MM_MAX = 6;

/** P4 — Binding closure (%) → binding success S_b for the run. */
export const BINDING_CLOSURE_PCT_MIN = 95;
export const BINDING_CLOSURE_PCT_MAX = 100;

/** P5 — Throughput (books per minute); total cycle T_total = 60 / bpm (seconds). */
export const THROUGHPUT_BPM_MIN = 4;
export const THROUGHPUT_BPM_MAX = 8;

/** P6 — Functional slip (0–1 scale, recommended ≤ 0.05). */
export const FUNCTIONAL_SLIP_MIN = 0;
export const FUNCTIONAL_SLIP_MAX = 0.05;

/** Legacy measurable punch setup (mm) — kept for metrics clamps if needed elsewhere. */
export const HOLE_PINCH_MM_MIN = 0.1;
export const HOLE_PINCH_MM_MAX = 0.5;
export const EDGE_MARGIN_MM_MIN = 5;
export const EDGE_MARGIN_MM_MAX = 7;

export const MANUAL_CYCLE_SECONDS_MIN = 180;
export const MANUAL_CYCLE_SECONDS_MAX = 300;

/** Stage indices in `STAGES` (StageController) for spec timers. */
export const STAGE_COUNTING = 1;
export const STAGE_PUNCHING = 3;
export const STAGE_BINDING = 4;
