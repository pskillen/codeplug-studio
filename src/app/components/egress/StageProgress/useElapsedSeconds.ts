import { useEffect, useState } from 'react';

/** Elapsed whole seconds since `startedAt`, ticking once a second while `running`. */
export function useElapsedSeconds(startedAt: number | null, running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (startedAt == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the run ends
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    if (!running) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, running]);
  return seconds;
}

/** `Elapsed 1:05` */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `Elapsed ${m}:${rest.toString().padStart(2, '0')}`;
}