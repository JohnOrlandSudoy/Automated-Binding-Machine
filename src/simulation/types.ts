export type QualityClassification = 'EXCELLENT' | 'ACCEPTABLE' | 'DEFECTIVE';

export interface SimulationErrorEntry {
  id: string;
  trial: number;
  target: number;
  actual: number;
  message: string;
  at: number;
}

/** One completed machine loop: randomized parameters (panel data) + formulas F2–F5 + Q_s band. */
export interface SimulationRunRecord {
  trial: number;
  targetCs: number;
  actualCa: number;
  offsetMm: number;
  marginMm: number;
  slip: number;
  throughputBpm: number;
  totalCycleSeconds: number;
  activeSeconds: number;
  downtimeSeconds: number;
  phaseClockSeconds: { counting: number; punching: number; binding: number };
  bindingClosurePercent: number;
  /** Sampled P1 % used to derive actual from target (before rounding). */
  countingAccuracySamplePct: number;
  efficiencyEta: number;
  punchingAccuracyAp: number;
  countingErrorE: number;
  bindingSuccessSb: number;
  qualityScoreQs: number;
  classification: QualityClassification;
}
