import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A countdown to a deadline, for a radio that restarts after `END`. It is counted from a deadline, not from
 * ticks, so a background tab cannot stall it. `start(seconds)` begins it; `clear()` stops it at zero.
 */
export function useRestartCountdown(): {
  secondsLeft: number;
  start: (seconds: number) => void;
  clear: () => void;
} {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const start = useCallback((seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setSecondsLeft(seconds);
  }, []);
  const clear = useCallback(() => setSecondsLeft(0), []);
  return { secondsLeft, start, clear };
}
