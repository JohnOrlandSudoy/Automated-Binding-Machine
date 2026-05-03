import React from 'react';
import { STAGES } from '../StageController';
import { Play, Pause, RotateCcw, Gauge } from 'lucide-react';

interface UIOverlayProps {
  currentStage: number;
  stageProgress: number;
  isPaused: boolean;
  speed: number;
  hoveredComponent: string | null;
  onTogglePause: () => void;
  onReset: () => void;
  onSpeedChange: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  currentStage,
  stageProgress,
  isPaused,
  speed,
  hoveredComponent,
  onTogglePause,
  onReset,
  onSpeedChange,
}) => {
  const stage = STAGES[currentStage];

  return (
    <>
      {/* Title */}
      <div className="absolute top-6 left-6 z-10">
        <h1 className="text-white font-bold text-xl tracking-wide drop-shadow-lg">
          Automated Paper Binding Machine
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {STAGES.map((s, i) => (
            <span key={s.name}>
              <span className={i === currentStage ? 'text-cyan-400 font-semibold' : ''}>
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span className="mx-1.5 text-gray-600">→</span>}
            </span>
          ))}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <button
          onClick={onTogglePause}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-all duration-200"
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
          {isPaused ? 'Play' : 'Pause'}
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-all duration-200"
        >
          <RotateCcw size={14} />
          Reset
        </button>
        <button
          onClick={onSpeedChange}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-all duration-200"
        >
          <Gauge size={14} />
          Speed: {speed}x
        </button>
      </div>

      {/* Stage Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-[480px] max-w-[90vw]">
        <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-cyan-400 font-semibold text-sm">{stage.label}</span>
            <span className="text-gray-400 text-xs">Stage {currentStage + 1} / {STAGES.length}</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${stageProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredComponent && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-cyan-500/40 rounded-lg px-4 py-2 text-cyan-300 text-sm font-medium shadow-lg shadow-cyan-500/10">
            {hoveredComponent}
          </div>
        </div>
      )}
    </>
  );
};

export default UIOverlay;
