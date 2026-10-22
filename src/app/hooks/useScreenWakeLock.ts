import { useEffect, useState } from 'react';

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
}

/**
 * Keep the screen awake while `active`. The browser drops the lock when the tab is hidden, so it is re-acquired when
 * the tab becomes visible again. Released when inactive and on unmount. A no-op where the Wake Lock API is missing.
 */
export function useScreenWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const supported = getWakeLock() !== undefined;
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const wakeLock = getWakeLock();
    if (!active || !wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || sentinel || document.visibilityState !== 'visible') return;
      try {
        const s = await wakeLock.request('screen');
        if (disposed) {
          void s.release().catch(() => {});
          return;
        }
        sentinel = s;
        setHeld(true);
        s.addEventListener?.('release', () => {
          if (sentinel === s) {
            sentinel = null;
            setHeld(false);
          }
        });
      } catch {
        setHeld(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const s = sentinel;
      sentinel = null;
      setHeld(false);
      void s?.release().catch(() => {});
    };
  }, [active]);

  return { supported, held };
}
