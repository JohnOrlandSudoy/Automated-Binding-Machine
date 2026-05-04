import { useState, useCallback, useRef, useEffect } from 'react';
import MachineViewer from './MachineViewer';
import UIOverlay from './controls/UIOverlay';
import { clampBatchSets, clampPageCount } from './simulation/metrics';
import { simulateActualCount } from './simulation/simulateRun';
import { STAGE_BINDING, STAGE_COUNTING, STAGE_PUNCHING } from './simulation/constants';
import { createCountingErrorEntry } from './simulation/errorMessage';
import type { SimulationErrorEntry } from './simulation/types';
import type { SimulationPanelProps } from './controls/SimulationPanel';

function App() {
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const [targetPages, setTargetPages] = useState(50);
  const [batchSets, setBatchSets] = useState(10);
  const [batchSetsCompleted, setBatchSetsCompleted] = useState(0);
  const [actualCount, setActualCount] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [totalTrials, setTotalTrials] = useState(0);
  const [lastCycleWallSeconds, setLastCycleWallSeconds] = useState<number | null>(null);
  const [phaseSeconds, setPhaseSeconds] = useState({ counting: 0, punching: 0, binding: 0 });
  const [errorLog, setErrorLog] = useState<SimulationErrorEntry[]>([]);

  const prevStageRef = useRef<number | null>(null);
  const cycleStartWallRef = useRef<number | null>(null);
  const targetPagesRef = useRef(targetPages);
  const skipCycleForManualResetRef = useRef(false);
  const batchSetsRef = useRef(batchSets);
  /** Same value as batchSetsCompleted; updated synchronously on each cycle for 3D stack. */
  const trayBooksStackedMirrorRef = useRef(0);

  useEffect(() => {
    targetPagesRef.current = targetPages;
  }, [targetPages]);

  useEffect(() => {
    batchSetsRef.current = batchSets;
  }, [batchSets]);

  useEffect(() => {
    trayBooksStackedMirrorRef.current = batchSetsCompleted;
  }, [batchSetsCompleted]);

  const handleStageChange = useCallback((stage: number, progress: number) => {
    setCurrentStage(stage);
    setStageProgress(progress);

    const prev = prevStageRef.current;
    if (prev === 6 && stage === 0) {
      if (skipCycleForManualResetRef.current) {
        skipCycleForManualResetRef.current = false;
      } else {
        const target = targetPagesRef.current;
        const nextActual = simulateActualCount(target);
        const ok = nextActual === target;

        const cap = batchSetsRef.current;
        const prevMirror = trayBooksStackedMirrorRef.current;
        const nextMirror = prevMirror + 1 >= cap ? 0 : prevMirror + 1;
        trayBooksStackedMirrorRef.current = nextMirror;
        setBatchSetsCompleted(nextMirror);

        setActualCount(nextActual);
        setTotalTrials((t) => {
          const nt = t + 1;
          if (!ok) {
            setErrorLog((log) => [...log.slice(-39), createCountingErrorEntry(nt, target, nextActual)]);
          }
          return nt;
        });
        setSuccesses((s) => s + (ok ? 1 : 0));
        setErrors((e) => e + (ok ? 0 : 1));

        const now = performance.now();
        if (cycleStartWallRef.current === null) {
          cycleStartWallRef.current = now;
        } else {
          setLastCycleWallSeconds((now - cycleStartWallRef.current) / 1000);
          cycleStartWallRef.current = now;
        }
      }
    }
    prevStageRef.current = stage;
  }, []);

  const handleSimulationTick = useCallback((deltaSim: number, stage: number) => {
    if (deltaSim <= 0) return;
    setPhaseSeconds((p) => ({
      counting: p.counting + (stage === STAGE_COUNTING ? deltaSim : 0),
      punching: p.punching + (stage === STAGE_PUNCHING ? deltaSim : 0),
      binding: p.binding + (stage === STAGE_BINDING ? deltaSim : 0),
    }));
  }, []);

  const handleResetStats = useCallback(() => {
    setActualCount(null);
    setErrors(0);
    setSuccesses(0);
    setTotalTrials(0);
    setLastCycleWallSeconds(null);
    setPhaseSeconds({ counting: 0, punching: 0, binding: 0 });
    setBatchSetsCompleted(0);
    trayBooksStackedMirrorRef.current = 0;
    setErrorLog([]);
    cycleStartWallRef.current = null;
  }, []);

  const handleTargetPagesCommit = useCallback((value: number) => {
    setTargetPages(clampPageCount(value));
  }, []);

  const handleBatchSetsCommit = useCallback((value: number) => {
    const v = clampBatchSets(value);
    setBatchSets(v);
    setBatchSetsCompleted((x) => {
      const nx = Math.min(x, v);
      trayBooksStackedMirrorRef.current = nx;
      return nx;
    });
  }, []);

  const handlePausedChange = useCallback((paused: boolean) => {
    setIsPaused(paused);
  }, []);

  const handleSpeedChange = useCallback((spd: number) => {
    setSpeed(spd);
  }, []);

  const handleActionConsumed = useCallback(() => {
    setAction(null);
  }, []);

  const simulation: SimulationPanelProps = {
    targetPages,
    batchSets,
    batchSetsCompleted,
    onTargetPagesCommit: handleTargetPagesCommit,
    onBatchSetsCommit: handleBatchSetsCommit,
    actualCount,
    errors,
    successes,
    totalTrials,
    lastCycleWallSeconds,
    phaseSeconds,
    errorLog,
    onResetStats: handleResetStats,
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a1a2e]">
      <MachineViewer
        onStageChange={handleStageChange}
        onPausedChange={handlePausedChange}
        onSpeedChange={handleSpeedChange}
        onHoveredComponent={setHoveredComponent}
        onSimulationTick={handleSimulationTick}
        trayBooksStackedRef={trayBooksStackedMirrorRef}
        batchBookCapacity={batchSets}
        action={action}
        onActionConsumed={handleActionConsumed}
      />
      <UIOverlay
        currentStage={currentStage}
        stageProgress={stageProgress}
        isPaused={isPaused}
        speed={speed}
        hoveredComponent={hoveredComponent}
        simulation={simulation}
        onTogglePause={() => setAction('toggle_pause')}
        onReset={() => {
          if (currentStage === 6) {
            skipCycleForManualResetRef.current = true;
          }
          setBatchSetsCompleted(0);
          trayBooksStackedMirrorRef.current = 0;
          setAction('reset');
        }}
        onSpeedChange={() => setAction('speed')}
      />
    </div>
  );
}

export default App;
