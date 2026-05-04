import {
  PAGE_COUNT_MIN,
  PAGE_COUNT_MAX,
  HOLE_PINCH_MM_MIN,
  HOLE_PINCH_MM_MAX,
  EDGE_MARGIN_MM_MIN,
  EDGE_MARGIN_MM_MAX,
  MANUAL_CYCLE_SECONDS_MIN,
  MANUAL_CYCLE_SECONDS_MAX,
} from './constants';

export function sheetCountingAccuracyPercent(target: number, actual: number): number {
  if (target <= 0) return 0;
  const rel = Math.abs((target - actual) / target);
  const pct = (1 - rel) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function countingDeviation(target: number, actual: number): number {
  return target - actual;
}

export function successRatePercent(successes: number, totalTrials: number): number {
  if (totalTrials <= 0) return 0;
  return (successes / totalTrials) * 100;
}

export function clampPageCount(n: number): number {
  return Math.min(PAGE_COUNT_MAX, Math.max(PAGE_COUNT_MIN, Math.round(n)));
}

export function clampBatchSets(n: number): number {
  return Math.min(9999, Math.max(1, Math.round(n)));
}

export function clampHolePinchMm(n: number): number {
  return Math.min(HOLE_PINCH_MM_MAX, Math.max(HOLE_PINCH_MM_MIN, Math.round(n * 1000) / 1000));
}

export function clampEdgeMarginMm(n: number): number {
  return Math.min(EDGE_MARGIN_MM_MAX, Math.max(EDGE_MARGIN_MM_MIN, Math.round(n * 100) / 100));
}

export function clampManualCycleSeconds(n: number): number {
  return Math.min(MANUAL_CYCLE_SECONDS_MAX, Math.max(MANUAL_CYCLE_SECONDS_MIN, Math.round(n)));
}
