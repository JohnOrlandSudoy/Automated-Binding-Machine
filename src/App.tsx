import { useState, useCallback } from 'react';
import MachineViewer from './MachineViewer';
import UIOverlay from './controls/UIOverlay';

function App() {
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const handleStageChange = useCallback((stage: number, progress: number) => {
    setCurrentStage(stage);
    setStageProgress(progress);
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a1a2e]">
      <MachineViewer
        onStageChange={handleStageChange}
        onPausedChange={handlePausedChange}
        onSpeedChange={handleSpeedChange}
        onHoveredComponent={setHoveredComponent}
        action={action}
        onActionConsumed={handleActionConsumed}
      />
      <UIOverlay
        currentStage={currentStage}
        stageProgress={stageProgress}
        isPaused={isPaused}
        speed={speed}
        hoveredComponent={hoveredComponent}
        onTogglePause={() => setAction('toggle_pause')}
        onReset={() => setAction('reset')}
        onSpeedChange={() => setAction('speed')}
      />
    </div>
  );
}

export default App;
