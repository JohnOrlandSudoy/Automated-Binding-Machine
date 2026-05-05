import {
  BINDING_CLOSURE_PCT_MAX,
  BINDING_CLOSURE_PCT_MIN,
  COUNTING_ACCURACY_PCT_MAX,
  COUNTING_ACCURACY_PCT_MIN,
  DIMENSIONAL_MARGIN_MM_MAX,
  DIMENSIONAL_MARGIN_MM_MIN,
  FUNCTIONAL_SLIP_MAX,
  FUNCTIONAL_SLIP_MIN,
  PUNCH_OFFSET_MM_MAX,
  PUNCH_OFFSET_MM_MIN,
  THROUGHPUT_BPM_MAX,
  THROUGHPUT_BPM_MIN,
} from './constants';
import type { QualityClassification, SimulationRunRecord } from './types';

function u(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Doc §3: EXCELLENT ≥85%; ACCEPTABLE includes 65–84% and gap 60–64%; DEFECTIVE &lt;60%. */
export function classifyQualityScore(qsPercent: number): QualityClassification {
  if (qsPercent >= 85) return 'EXCELLENT';
  if (qsPercent >= 60) return 'ACCEPTABLE';
  return 'DEFECTIVE';
}

/**
 * F2: A_p = 1 − (Δx / W). F3: E = |C_a − C_s| / C_s. F4: S_b from P4 closure.
 * η = T_active / T_total. F5: Q_s = mean of five 0–100 sub-scores (equal weights).
 */
export function generateSimulationRunRecord(cs: number, trial: number): SimulationRunRecord {
  const countingAccuracySamplePct = u(COUNTING_ACCURACY_PCT_MIN, COUNTING_ACCURACY_PCT_MAX);
  let actualCa = Math.round((cs * countingAccuracySamplePct) / 100);
  actualCa = Math.max(1, actualCa);

  const offsetMm = u(PUNCH_OFFSET_MM_MIN, PUNCH_OFFSET_MM_MAX);
  const marginMm = u(DIMENSIONAL_MARGIN_MM_MIN, DIMENSIONAL_MARGIN_MM_MAX);
  const bindingClosurePercent = u(BINDING_CLOSURE_PCT_MIN, BINDING_CLOSURE_PCT_MAX);
  const slip = u(FUNCTIONAL_SLIP_MIN, FUNCTIONAL_SLIP_MAX);

  const throughputBpm = u(THROUGHPUT_BPM_MIN, THROUGHPUT_BPM_MAX);
  const totalCycleSeconds = 60 / throughputBpm;

  const efficiencyEta = u(0.68, 0.99);
  const activeSeconds = totalCycleSeconds * efficiencyEta;
  const downtimeSeconds = totalCycleSeconds - activeSeconds;

  const w1 = Math.random();
  const w2 = Math.random();
  const w3 = Math.random();
  const ws = w1 + w2 + w3;
  const phaseClockSeconds = {
    counting: (w1 / ws) * activeSeconds,
    punching: (w2 / ws) * activeSeconds,
    binding: (w3 / ws) * activeSeconds,
  };

  const punchingAccuracyAp = Math.max(0, Math.min(1, 1 - offsetMm / marginMm));
  const countingErrorE = Math.abs(actualCa - cs) / cs;
  const bindingSuccessSb = bindingClosurePercent / 100;

  const sCount = 100 * (1 - Math.min(1, countingErrorE / 0.05));
  const sPunch = punchingAccuracyAp * 100;
  const sBind = bindingClosurePercent;
  const sEta = efficiencyEta * 100;
  const sSlip = 100 * (1 - Math.min(1, slip / 0.15));
  const qualityScoreQs = (sCount + sPunch + sBind + sEta + sSlip) / 5;

  const classification = classifyQualityScore(qualityScoreQs);

  return {
    trial,
    targetCs: cs,
    actualCa,
    offsetMm,
    marginMm,
    slip,
    throughputBpm,
    totalCycleSeconds,
    activeSeconds,
    downtimeSeconds,
    phaseClockSeconds,
    bindingClosurePercent,
    countingAccuracySamplePct,
    efficiencyEta: activeSeconds / totalCycleSeconds,
    punchingAccuracyAp,
    countingErrorE,
    bindingSuccessSb,
    qualityScoreQs,
    classification,
  };
}
