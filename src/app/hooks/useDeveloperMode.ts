import { useSyncExternalStore } from 'react';
import {
  isDeveloperModeOn,
  setDeveloperMode,
  subscribeDeveloperMode,
} from '@integrations/preferences/developerMode.ts';

function subscribe(onChange: () => void): () => void {
  return subscribeDeveloperMode(() => onChange());
}

/**
 * Developer mode on this device (#1650), re-rendering on change. Components that show a prod-hidden feature call this
 * so they update when the switch flips, and pass the value to the gate resolver.
 */
export function useDeveloperMode(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isDeveloperModeOn, () => false);
  return [on, setDeveloperMode];
}
