import { useEffect, useState } from 'react';

const DEFAULT_TICK_INTERVAL_MS = 1000;

/**
 * Shared wall-clock tick for pass countdowns and above-horizon highlights — one interval
 * per surface, not one timer per table row.
 */
export function useNowTick(intervalMs: number = DEFAULT_TICK_INTERVAL_MS): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [intervalMs]);

  return nowMs;
}
