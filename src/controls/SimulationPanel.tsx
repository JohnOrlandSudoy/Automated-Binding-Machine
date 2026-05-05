import { type FC, useEffect, useState } from 'react';
import { ClipboardList, RotateCcw } from 'lucide-react';
import { PAGE_COUNT_MAX, PAGE_COUNT_MIN } from '../simulation/constants';
import { clampPageCount } from '../simulation/metrics';
import type { SimulationErrorEntry, SimulationRunRecord } from '../simulation/types';

export interface SimulationPanelProps {
  targetPages: number;
  onTargetPagesCommit: (value: number) => void;
  /** Latest completed loop (randomized data + formulas). */
  lastRun: SimulationRunRecord | null;
  errors: number;
  successes: number;
  totalTrials: number;
  errorLog: SimulationErrorEntry[];
  onResetStats: () => void;
}

function formatSeconds(s: number): string {
  return `${s.toFixed(2)} s`;
}

function formatClockFromSeconds(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t - h * 3600 - m * 60;
  const secStr = sec.toFixed(2);
  const mPart = `${String(m).padStart(2, '0')}:${secStr.padStart(5, '0')}`;
  return h > 0 ? `${h}:${mPart}` : mPart;
}

function classificationStyle(c: SimulationRunRecord['classification']): string {
  if (c === 'EXCELLENT') return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40';
  if (c === 'ACCEPTABLE') return 'text-amber-200 bg-amber-500/15 border-amber-500/35';
  return 'text-rose-300 bg-rose-500/15 border-rose-500/40';
}

const SimulationPanel: FC<SimulationPanelProps> = ({
  targetPages,
  onTargetPagesCommit,
  lastRun,
  errors,
  successes,
  totalTrials,
  errorLog,
  onResetStats,
}) => {
  const [pagesDraft, setPagesDraft] = useState(String(targetPages));

  useEffect(() => {
    setPagesDraft(String(targetPages));
  }, [targetPages]);

  const commitPages = () => {
    const n = parseInt(pagesDraft, 10);
    if (Number.isNaN(n)) {
      setPagesDraft(String(targetPages));
      return;
    }
    onTargetPagesCommit(clampPageCount(n));
  };

  const r = lastRun;

  return (
    <div className="absolute right-6 top-[5.75rem] z-10 w-[min(22rem,calc(100vw-3rem))] max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-white/15 bg-black/55 backdrop-blur-md shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-white">
          <ClipboardList size={16} className="text-cyan-400 shrink-0" />
          <span className="text-sm font-semibold tracking-wide">Simulation Control</span>
        </div>
        <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300">
          A5 · tables
        </span>
      </div>

      <div className="space-y-3 p-3 text-sm text-gray-200">
        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Target count C<sub className="text-[10px]">s</sub> — lang ito ang naa-adjust (
            {PAGE_COUNT_MIN}–{PAGE_COUNT_MAX} pahina)
          </label>
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

        <p className="text-[10px] leading-snug text-gray-500">
          Bawat tapos ng isang cycle sa viewer: randomized ang iba pang parameter (within recommended ranges
          ng threshold table); lumalabas ang η, F2–F5, at performance class.
        </p>

        {r ? (
          <div
            className={`rounded-lg border px-2.5 py-2 text-center text-[11px] font-bold uppercase tracking-wider ${classificationStyle(r.classification)}`}
          >
            {r.classification} · Q<sub className="text-[9px]">s</sub> {r.qualityScoreQs.toFixed(2)}%
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-center text-[11px] text-gray-500">
            Hintayin matapos ang unang cycle para sa run data…
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Randomized — huling trial
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Trial #</span>
            <span className="font-mono text-white">{r ? r.trial : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Actual Cₐ</span>
            <span className="font-mono text-white">{r ? r.actualCa : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Offset Δx</span>
            <span className="font-mono">{r ? `${r.offsetMm.toFixed(3)} mm` : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Margin W</span>
            <span className="font-mono">{r ? `${r.marginMm.toFixed(2)} mm` : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Slip</span>
            <span className="font-mono">{r ? r.slip.toFixed(4) : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Throughput</span>
            <span className="font-mono">{r ? `${r.throughputBpm.toFixed(2)} bpm` : '—'}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5 mt-1">
            <span className="text-gray-400">T<sub className="text-[9px]">total</sub> (cycle)</span>
            <span className="font-mono">{r ? formatSeconds(r.totalCycleSeconds) : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">T<sub className="text-[9px]">active</sub></span>
            <span className="font-mono">{r ? formatSeconds(r.activeSeconds) : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Downtime</span>
            <span className="font-mono">{r ? formatSeconds(r.downtimeSeconds) : '—'}</span>
          </div>
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/15 p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90">
            Time per phase (clock — huling trial)
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Counting</span>
            <span className="font-mono text-cyan-200/95">
              {r ? formatClockFromSeconds(r.phaseClockSeconds.counting) : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Punching</span>
            <span className="font-mono text-cyan-200/95">
              {r ? formatClockFromSeconds(r.phaseClockSeconds.punching) : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Binding</span>
            <span className="font-mono text-cyan-200/95">
              {r ? formatClockFromSeconds(r.phaseClockSeconds.binding) : '—'}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Formula table (interpretation)
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 shrink">η = Tₐ / Tₜ efficiency</span>
            <span className="font-mono text-right">
              {r ? `${(r.efficiencyEta * 100).toFixed(2)} %` : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 shrink">F2 Aₚ = 1 − Δx/W</span>
            <span className="font-mono text-right">{r ? `${(r.punchingAccuracyAp * 100).toFixed(2)} %` : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 shrink">F3 E = |Cₐ−Cₛ|/Cₛ</span>
            <span className="font-mono text-right">{r ? `${(r.countingErrorE * 100).toFixed(3)} %` : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 shrink">F4 Sᵦ (closure)</span>
            <span className="font-mono text-right">{r ? `${(r.bindingSuccessSb * 100).toFixed(2)} %` : '—'}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5 mt-1">
            <span className="text-gray-400 shrink">F5 Qₛ (equal weights)</span>
            <span className="font-mono text-cyan-200/90 text-right">
              {r ? `${r.qualityScoreQs.toFixed(2)} %` : '—'}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Session</div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Trials</span>
            <span className="font-mono text-white">{totalTrials}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Excellent + Acceptable</span>
            <span className="font-mono text-emerald-300">{successes}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Defective</span>
            <span className="font-mono text-rose-300">{errors}</span>
          </div>
          {errorLog.length > 0 ? (
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Log (huling {Math.min(errorLog.length, 40)})
              </div>
              <ul className="max-h-28 space-y-1.5 overflow-y-auto text-[10px] leading-snug text-rose-200/95">
                {[...errorLog].reverse().map((e) => (
                  <li key={e.id} className="border-l-2 border-rose-500/50 pl-2">
                    <span className="text-gray-500">T{e.trial}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onResetStats}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 py-2 text-xs text-gray-200 hover:bg-white/10"
        >
          <RotateCcw size={14} />
          Reset session / log
        </button>
      </div>
    </div>
  );
};

export default SimulationPanel;
