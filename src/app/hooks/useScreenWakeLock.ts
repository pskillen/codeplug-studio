import { useEffect, useState } from 'react';
import { KeepAwake } from '@integrations/platform/keepAwake.ts';
import { isNativeApp } from '@integrations/platform/isNativeApp.ts';

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

/** One-line hint shown while a job runs and the screen could not be kept on. */
export const KEEP_SCREEN_ON_HINT = 'Keep this screen on until it finishes.';

/**
 * Holders of the native keep-screen-on flag. The flag is one per window, so overlapping jobs share it: it is only
 * cleared when the last holder lets go.
 */
let nativeHolders = 0;

async function acquireNative(): Promise<boolean> {
  nativeHolders += 1;
  try {
    await KeepAwake.keepAwake();
    return true;
  } catch {
    return false;
  }
}

function releaseNative(): void {
  nativeHolders = Math.max(0, nativeHolders - 1);
  if (nativeHolders === 0) void Promise.resolve(KeepAwake.allowSleep()).catch(() => {});
}

/**
 * Keep the screen awake while `active`. In the Android app this sets the window's keep-screen-on flag through the
 * in-repo plugin (reference-counted, so overlapping jobs do not release each other); in a browser it uses the Screen
 * Wake Lock API, which the browser drops when the tab is hidden, so it is re-acquired when the tab becomes visible
 * again. Released when inactive and on unmount. `held` is false where neither is available or the request failed: the
 * job still runs, and the caller can show a hint to keep the screen on.
 */
export function useScreenWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const native = isNativeApp();
  const supported = native || getWakeLock() !== undefined;
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !native) return;
    let disposed = false;
    void acquireNative().then((ok) => {
      if (!disposed) setHeld(ok);
    });
    return () => {
      disposed = true;
      setHeld(false);
      releaseNative();
    };
  }, [active, native]);

  useEffect(() => {
    const wakeLock = getWakeLock();
    if (!active || native || !wakeLock) return;
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
  }, [active, native]);

  return { supported, held };
}
