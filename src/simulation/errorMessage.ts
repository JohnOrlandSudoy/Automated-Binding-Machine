import type { SimulationErrorEntry, SimulationRunRecord } from './types';

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

export function createDefectiveRunLogEntry(record: SimulationRunRecord): SimulationErrorEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    trial: record.trial,
    target: record.targetCs,
    actual: record.actualCa,
    message: `DEFECTIVE (Q_s ${record.qualityScoreQs.toFixed(2)}%): η=${(record.efficiencyEta * 100).toFixed(1)}%, A_p=${(record.punchingAccuracyAp * 100).toFixed(1)}%, E=${(record.countingErrorE * 100).toFixed(2)}%.`,
    at: Date.now(),
  };
}
