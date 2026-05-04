/** One simulated machine run: actual page count vs target (no real sensors). */
export function simulateActualCount(target: number): number {
  const r = Math.random();
  if (r < 0.7) return target;
  if (r < 0.86) return target + (Math.random() < 0.5 ? -1 : 1);
  if (r < 0.94) return target + (Math.random() < 0.5 ? -2 : 2);
  return target + (Math.random() < 0.5 ? -5 : 4);
}
