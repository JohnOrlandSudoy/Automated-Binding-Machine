import { PAGE_COUNT_MIN, PAGE_COUNT_MAX } from './constants';

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
