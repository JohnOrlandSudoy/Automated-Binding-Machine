export interface SimulationErrorEntry {
  id: string;
  trial: number;
  target: number;
  actual: number;
  message: string;
  at: number;
}
