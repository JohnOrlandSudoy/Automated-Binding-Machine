export interface Stage {
  name: string;
  label: string;
  duration: number;
  startTime: number;
}

export const STAGES: Stage[] = [
  { name: 'paper_feed', label: 'Paper Feed', duration: 3, startTime: 0 },
  { name: 'counting', label: 'Counting', duration: 3, startTime: 3 },
  { name: 'conveyor', label: 'Conveyor Transfer', duration: 3, startTime: 6 },
  { name: 'punching', label: 'Punching', duration: 4, startTime: 9 },
  { name: 'spiral_binding', label: 'Spiral Binding', duration: 5, startTime: 13 },
  { name: 'output_ejection', label: 'Output Ejection', duration: 3, startTime: 18 },
  { name: 'reset', label: 'Reset', duration: 3, startTime: 21 },
];

export const TOTAL_DURATION = 24;

export interface StageState {
  currentStage: number;
  stageProgress: number;
  globalProgress: number;
  elapsedTime: number;
}

export class StageController {
  private elapsed: number = 0;
  private speed: number = 1;
  private paused: boolean = false;
  private lastTimestamp: number | null = null;

  getSpeed(): number {
    return this.speed;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  isPaused(): boolean {
    return this.paused;
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (!this.paused) {
      this.lastTimestamp = null;
    }
  }

  reset(): void {
    this.elapsed = 0;
    this.lastTimestamp = null;
  }

  update(timestamp: number): StageState {
    if (!this.paused) {
      if (this.lastTimestamp !== null) {
        const delta = (timestamp - this.lastTimestamp) / 1000;
        this.elapsed += delta * this.speed;
      }
      this.lastTimestamp = timestamp;
    } else {
      this.lastTimestamp = null;
    }

    const loopedTime = this.elapsed % TOTAL_DURATION;

    let currentStage = 0;
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (loopedTime >= STAGES[i].startTime) {
        currentStage = i;
        break;
      }
    }

    const stage = STAGES[currentStage];
    const stageElapsed = loopedTime - stage.startTime;
    const stageProgress = Math.min(stageElapsed / stage.duration, 1);
    const globalProgress = loopedTime / TOTAL_DURATION;

    return {
      currentStage,
      stageProgress,
      globalProgress,
      elapsedTime: loopedTime,
    };
  }
}
