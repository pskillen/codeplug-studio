/**
 * Developer mode (#1650): a per-device switch, stored in this browser profile's `localStorage` only. It is never
 * synced and never written to a project, backup, Drive file or share link. The prod gate in
 * `src/app/services/prodFeatureGate.ts` is its only reader that changes what the app offers; see
 * docs/features/developer-mode/README.md.
 */

export const DEVELOPER_MODE_KEY = 'codeplug-studio:developerMode';

type DeveloperModeListener = (on: boolean) => void;

const listeners = new Set<DeveloperModeListener>();

/** True when developer mode is on for this browser profile. Fails soft to off. */
export function isDeveloperModeOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(DEVELOPER_MODE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setDeveloperMode(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(DEVELOPER_MODE_KEY, 'on');
    else globalThis.localStorage?.removeItem(DEVELOPER_MODE_KEY);
  } catch {
    // Storage unavailable (private mode, quota): nothing persists.
  }
  for (const listener of listeners) listener(on);
}

/** Listen for changes made in this tab and in other tabs of the same browser profile. */
export function subscribeDeveloperMode(listener: DeveloperModeListener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DEVELOPER_MODE_KEY || e.key === null) listener(isDeveloperModeOn());
  };
  globalThis.addEventListener?.('storage', onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.('storage', onStorage);
  };
}
