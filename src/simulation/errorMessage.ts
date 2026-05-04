import type { SimulationErrorEntry } from './types';

export function createCountingErrorEntry(
  trial: number,
  target: number,
  actual: number
): SimulationErrorEntry {
  const dev = target - actual;
  const sign = dev > 0 ? '+' : '';
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    trial,
    target,
    actual,
    message: `Sheet counting: target ${target} pahina, actual ${actual} (deviation ${sign}${dev}).`,
    at: Date.now(),
  };
}
