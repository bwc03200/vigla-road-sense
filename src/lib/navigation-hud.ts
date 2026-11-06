export const RADAR_VIGILANCE_M = 300;
export const HAZARD_VIGILANCE_M = 500;
export const VIGILANCE_DURATION_MS = 10_000;

export function isVigilanceInRange(kind: string, distanceM: number): boolean {
  return distanceM >= 0 && ((kind === "radar" && distanceM < RADAR_VIGILANCE_M) ||
    (kind === "hazard" && distanceM < HAZARD_VIGILANCE_M));
}

export function vigilanceProgress(distanceM: number, kind: string): number {
  const max = kind === "radar" ? RADAR_VIGILANCE_M : HAZARD_VIGILANCE_M;
  return Math.max(0, Math.min(100, distanceM / max * 100));
}