import { useState, useCallback, useRef, useEffect } from 'react';
import MachineViewer from './MachineViewer';
import UIOverlay from './controls/UIOverlay';
import { clampPageCount } from './simulation/metrics';
import { generateSimulationRunRecord } from './simulation/runRecord';
import {
  DEFAULT_TRAY_BATCH_CAPACITY,
  VIEWER_MANUAL_CYCLE_SECONDS,
} from './simulation/constants';
import { createDefectiveRunLogEntry } from './simulation/errorMessage';
import type { SimulationErrorEntry, SimulationRunRecord } from './simulation/types';
import type { SimulationPanelProps } from './controls/SimulationPanel';

function App() {
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const [targetPages, setTargetPages] = useState(50);
  const [batchSetsCompleted, setBatchSetsCompleted] = useState(0);
  const [lastRun, setLastRun] = useState<SimulationRunRecord | null>(null);
  const [errors, setErrors] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [totalTrials, setTotalTrials] = useState(0);
  const [errorLog, setErrorLog] = useState<SimulationErrorEntry[]>([]);

  const prevStageRef = useRef<number | null>(null);
  const targetPagesRef = useRef(targetPages);
  const skipCycleForManualResetRef = useRef(false);
  const batchSetsRef = useRef(DEFAULT_TRAY_BATCH_CAPACITY);
  const trayBooksStackedMirrorRef = useRef(0);

  useEffect(() => {
    targetPagesRef.current = targetPages;
  }, [targetPages]);

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
        const cs = targetPagesRef.current;
        setTotalTrials((t) => {
          const trial = t + 1;
          const record = generateSimulationRunRecord(cs, trial);
          setLastRun(record);

          if (record.classification === 'DEFECTIVE') {
            setErrors((e) => e + 1);
            setErrorLog((log) => [...log.slice(-39), createDefectiveRunLogEntry(record)]);
          } else {
            setSuccesses((s) => s + 1);
          }

          const cap = batchSetsRef.current;
          const prevMirror = trayBooksStackedMirrorRef.current;
          const nextMirror = prevMirror + 1 >= cap ? 0 : prevMirror + 1;
          trayBooksStackedMirrorRef.current = nextMirror;
          setBatchSetsCompleted(nextMirror);

          return trial;
        });
      }
    }
    prevStageRef.current = stage;
  }, []);

  const handleResetStats = useCallback(() => {
    setLastRun(null);
    setErrors(0);
    setSuccesses(0);
    setTotalTrials(0);
    setBatchSetsCompleted(0);
    trayBooksStackedMirrorRef.current = 0;
    setErrorLog([]);
  }, []);

  const handleTargetPagesCommit = useCallback((value: number) => {
    setTargetPages(clampPageCount(value));
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
    onTargetPagesCommit: handleTargetPagesCommit,
    lastRun,
    errors,
    successes,
    totalTrials,
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
        trayBooksStackedRef={trayBooksStackedMirrorRef}
        batchBookCapacity={DEFAULT_TRAY_BATCH_CAPACITY}
        manualCycleSeconds={VIEWER_MANUAL_CYCLE_SECONDS}
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
