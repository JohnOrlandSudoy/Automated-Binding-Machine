import { type FC, useEffect, useMemo, useState } from 'react';
import { ClipboardList, RotateCcw } from 'lucide-react';
import {
  PAGE_COUNT_MAX,
  PAGE_COUNT_MIN,
  HOLE_PINCH_MM_MIN,
  HOLE_PINCH_MM_MAX,
  EDGE_MARGIN_MM_MIN,
  EDGE_MARGIN_MM_MAX,
  MANUAL_CYCLE_SECONDS_MIN,
  MANUAL_CYCLE_SECONDS_MAX,
} from '../simulation/constants';
import {
  clampBatchSets,
  clampPageCount,
  clampHolePinchMm,
  clampEdgeMarginMm,
  clampManualCycleSeconds,
  countingDeviation,
  sheetCountingAccuracyPercent,
  successRatePercent,
} from '../simulation/metrics';
import type { SimulationErrorEntry } from '../simulation/types';

export interface SimulationPanelProps {
  targetPages: number;
  batchSets: number;
  /** Completed full loops this session (accumulates until machine Reset or Reset stats). */
  batchSetsCompleted: number;
  onTargetPagesCommit: (value: number) => void;
  onBatchSetsCommit: (value: number) => void;
  actualCount: number | null;
  errors: number;
  successes: number;
  totalTrials: number;
  lastCycleWallSeconds: number | null;
  phaseSeconds: { counting: number; punching: number; binding: number };
  errorLog: SimulationErrorEntry[];
  /** Punching — measurable (mm). */
  holePinchMm: number;
  edgeMarginMm: number;
  manualCycleSeconds: number;
  onHolePinchMmCommit: (value: number) => void;
  onEdgeMarginMmCommit: (value: number) => void;
  onManualCycleSecondsCommit: (value: number) => void;
  onResetStats: () => void;
}

function formatSeconds(s: number): string {
  return `${s.toFixed(2)} s`;
}

const SimulationPanel: FC<SimulationPanelProps> = ({
  targetPages,
  batchSets,
  batchSetsCompleted,
  onTargetPagesCommit,
  onBatchSetsCommit,
  actualCount,
  errors,
  successes,
  totalTrials,
  lastCycleWallSeconds,
  phaseSeconds,
  errorLog,
  holePinchMm,
  edgeMarginMm,
  manualCycleSeconds,
  onHolePinchMmCommit,
  onEdgeMarginMmCommit,
  onManualCycleSecondsCommit,
  onResetStats,
}) => {
  const [pagesDraft, setPagesDraft] = useState(String(targetPages));
  const [batchDraft, setBatchDraft] = useState(String(batchSets));
  const [holeDraft, setHoleDraft] = useState(String(holePinchMm));
  const [marginDraft, setMarginDraft] = useState(String(edgeMarginMm));
  const [cycleDraft, setCycleDraft] = useState(String(manualCycleSeconds));

  useEffect(() => {
    setPagesDraft(String(targetPages));
  }, [targetPages]);

  useEffect(() => {
    setBatchDraft(String(batchSets));
  }, [batchSets]);

  useEffect(() => {
    setHoleDraft(String(holePinchMm));
  }, [holePinchMm]);

  useEffect(() => {
    setMarginDraft(String(edgeMarginMm));
  }, [edgeMarginMm]);

  useEffect(() => {
    setCycleDraft(String(manualCycleSeconds));
  }, [manualCycleSeconds]);

  const accuracy = useMemo(() => {
    if (actualCount === null) return null;
    return sheetCountingAccuracyPercent(targetPages, actualCount);
  }, [actualCount, targetPages]);

  const deviation = useMemo(() => {
    if (actualCount === null) return null;
    return countingDeviation(targetPages, actualCount);
  }, [actualCount, targetPages]);

  const successRate = useMemo(
    () => successRatePercent(successes, totalTrials),
    [successes, totalTrials]
  );

  const commitPages = () => {
    const n = parseInt(pagesDraft, 10);
    if (Number.isNaN(n)) {
      setPagesDraft(String(targetPages));
      return;
    }
    onTargetPagesCommit(clampPageCount(n));
  };

  const commitBatch = () => {
    const n = parseInt(batchDraft, 10);
    if (Number.isNaN(n)) {
      setBatchDraft(String(batchSets));
      return;
    }
    onBatchSetsCommit(clampBatchSets(n));
  };

  const commitHole = () => {
    const n = parseFloat(holeDraft.replace(',', '.'));
    if (Number.isNaN(n)) {
      setHoleDraft(String(holePinchMm));
      return;
    }
    onHolePinchMmCommit(clampHolePinchMm(n));
  };

  const commitMargin = () => {
    const n = parseFloat(marginDraft.replace(',', '.'));
    if (Number.isNaN(n)) {
      setMarginDraft(String(edgeMarginMm));
      return;
    }
    onEdgeMarginMmCommit(clampEdgeMarginMm(n));
  };

  const commitCycle = () => {
    const n = parseInt(cycleDraft, 10);
    if (Number.isNaN(n)) {
      setCycleDraft(String(manualCycleSeconds));
      return;
    }
    onManualCycleSecondsCommit(clampManualCycleSeconds(n));
  };

  return (
    <div className="absolute right-6 top-[5.75rem] z-10 w-[min(22rem,calc(100vw-3rem))] max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-white/15 bg-black/55 backdrop-blur-md shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-white">
          <ClipboardList size={16} className="text-cyan-400 shrink-0" />
          <span className="text-sm font-semibold tracking-wide">Simulation Control</span>
        </div>
        <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300">
          A5 only
        </span>
      </div>

      <div className="space-y-3 p-3 text-sm text-gray-200">
        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Target count — counting ({PAGE_COUNT_MIN}–{PAGE_COUNT_MAX} pages)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={PAGE_COUNT_MIN}
              max={PAGE_COUNT_MAX}
              value={pagesDraft}
              onChange={(e) => setPagesDraft(e.target.value)}
              onBlur={commitPages}
              onKeyDown={(e) => e.key === 'Enter' && commitPages()}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">Target sets sa batch</label>
          <input
            type="number"
            min={1}
            value={batchDraft}
            onChange={(e) => setBatchDraft(e.target.value)}
            onBlur={commitBatch}
            onKeyDown={(e) => e.key === 'Enter' && commitBatch()}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-cyan-500/50"
          />
          <div className="mt-1.5 flex justify-between gap-2 text-xs">
            <span className="text-gray-400">Naipon (bago mag-reset)</span>
            <span className="font-mono text-amber-200">
              {batchSetsCompleted} / {batchSets}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-orange-500/25 bg-orange-950/20 p-2.5 space-y-2 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-200/90">
            Punching — need i-measure
          </div>
          <p className="text-[10px] leading-snug text-gray-400">
            Hole pinch at edge margin (mm); parehong sakop ng punching stage sa simulation.
          </p>
          <div>
            <label className="mb-1 block text-[11px] text-gray-400">
              Hole pinch ({HOLE_PINCH_MM_MIN}–{HOLE_PINCH_MM_MAX} mm)
            </label>
            <input
              type="number"
              step={0.01}
              min={HOLE_PINCH_MM_MIN}
              max={HOLE_PINCH_MM_MAX}
              value={holeDraft}
              onChange={(e) => setHoleDraft(e.target.value)}
              onBlur={commitHole}
              onKeyDown={(e) => e.key === 'Enter' && commitHole()}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-orange-400/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-400">
              Edge margin ({EDGE_MARGIN_MM_MIN}–{EDGE_MARGIN_MM_MAX} mm)
            </label>
            <input
              type="number"
              step={0.1}
              min={EDGE_MARGIN_MM_MIN}
              max={EDGE_MARGIN_MM_MAX}
              value={marginDraft}
              onChange={(e) => setMarginDraft(e.target.value)}
              onBlur={commitMargin}
              onKeyDown={(e) => e.key === 'Enter' && commitMargin()}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-orange-400/40"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Manual machine — cycle time ({MANUAL_CYCLE_SECONDS_MIN}–{MANUAL_CYCLE_SECONDS_MAX} s)
          </label>
          <input
            type="number"
            min={MANUAL_CYCLE_SECONDS_MIN}
            max={MANUAL_CYCLE_SECONDS_MAX}
            step={1}
            value={cycleDraft}
            onChange={(e) => setCycleDraft(e.target.value)}
            onBlur={commitCycle}
            onKeyDown={(e) => e.key === 'Enter' && commitCycle()}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-cyan-500/50"
          />
          <p className="mt-1 text-[10px] text-gray-500">
            Target na haba ng isang buong loop sa 1× speed (wall clock).
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Run output</div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Target count</span>
            <span className="font-mono text-cyan-200">{targetPages}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Actual count</span>
            <span className="font-mono text-white">{actualCount ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Errors</span>
            <span className="font-mono text-rose-300">{errors}</span>
          </div>
          {errorLog.length > 0 ? (
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Detalye ng error (huling {Math.min(errorLog.length, 40)})
              </div>
              <ul className="max-h-28 space-y-1.5 overflow-y-auto text-[10px] leading-snug text-rose-200/95">
                {[...errorLog].reverse().map((e) => (
                  <li key={e.id} className="border-l-2 border-rose-500/50 pl-2">
                    <span className="text-gray-500">Trial {e.trial}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Successful runs</span>
            <span className="font-mono text-emerald-300">{successes}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Total trials</span>
            <span className="font-mono text-white">{totalTrials}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Total cycle (wall, last)</span>
            <span className="font-mono text-white">
              {lastCycleWallSeconds !== null ? formatSeconds(lastCycleWallSeconds) : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5 mt-1">
            <span className="text-gray-400">Target cycle (manual)</span>
            <span className="font-mono text-cyan-200/90">{manualCycleSeconds} s</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Hole pinch</span>
            <span className="font-mono text-orange-200/90">{holePinchMm.toFixed(3)} mm</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Edge margin</span>
            <span className="font-mono text-orange-200/90">{edgeMarginMm.toFixed(2)} mm</span>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Phase timers (session sim time)</div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Counting</span>
            <span className="font-mono">{formatSeconds(phaseSeconds.counting)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Punching</span>
            <span className="font-mono">{formatSeconds(phaseSeconds.punching)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Binding</span>
            <span className="font-mono">{formatSeconds(phaseSeconds.binding)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Computed</div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Accuracy</span>
            <span className="font-mono text-white">
              {accuracy !== null ? `${accuracy.toFixed(2)} %` : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Deviation</span>
            <span className="font-mono text-white">{deviation !== null ? deviation : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Success rate</span>
            <span className="font-mono text-white">
              {totalTrials > 0 ? `${successRate.toFixed(2)} %` : '—'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetStats}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 py-2 text-xs text-gray-200 hover:bg-white/10"
        >
          <RotateCcw size={14} />
          Reset stats
        </button>

        <p className="text-[10px] leading-snug text-gray-500">
          Naipon / target: kada buong loop +1; kapag puno (hal. 10/10) awtomatik balik sa 0/10. Tray sa 3D: hanggang sa dami ng target sets (max 48 libro). I-reset: <strong className="text-gray-400">Reset</strong> machine o <strong className="text-gray-400">Reset stats</strong>.
        </p>
      </div>
    </div>
  );
};

export default SimulationPanel;
