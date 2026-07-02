/** Shared wire ↔ percent power ladder helpers — import/export boundary only. */

export interface PowerLadderEntry {
  percent: number;
  wire: string;
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
export function percentToWire(profile: PowerLadderProfile, percent: number | null): string {
  const high = profile.powerLadder[0];
  if (!high) return '';
  if (percent == null) return high.wire;

  let best = high;
  let bestDist = Math.abs(high.percent - percent);
  for (const entry of profile.powerLadder) {
    const dist = Math.abs(entry.percent - percent);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best.wire;
}
