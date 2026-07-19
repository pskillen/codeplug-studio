/** Shared wire ↔ percent power ladder helpers — import/export boundary only. */

export interface PowerLadderEntry {
  percent: number;
  wire: string;
  /** Optional display hint for UI (e.g. "5 W", "7 W VHF / 6 W UHF"). Not used by export maths. */
  approxWatts?: string;
}

export interface PowerLadderProfile {
  powerLadder: readonly PowerLadderEntry[];
}

/** Exact wire → percent lookup; empty wire → null (radio default). */
export function wireToPercent(profile: PowerLadderProfile, wire: string): number | null {
  const trimmed = wire.trim();
  if (!trimmed) return null;
  const entry = profile.powerLadder.find((e) => e.wire === trimmed);
  return entry?.percent ?? null;
}

/** Nearest ladder entry; null percent → high/default (ladder[0]). */
export function nearestLadderEntry(
  profile: PowerLadderProfile,
  percent: number | null,
): PowerLadderEntry | undefined {
  const high = profile.powerLadder[0];
  if (!high) return undefined;
  if (percent == null) return high;

  let best = high;
  let bestDist = Math.abs(high.percent - percent);
  for (const entry of profile.powerLadder) {
    const dist = Math.abs(entry.percent - percent);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

/** Nearest ladder entry; null percent → high/default (ladder[0]). */
export function percentToWire(profile: PowerLadderProfile, percent: number | null): string {
  return nearestLadderEntry(profile, percent)?.wire ?? '';
}
