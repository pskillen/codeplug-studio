import { useState } from 'react';
import type { DebugArchive } from './captureArchive.ts';
import { archiveKey } from './viewerUtils.ts';

/**
 * Show/hide state for password bytes. Hidden by default, and hidden again whenever a
 * different archive (a new read, an import, another retained read) is shown.
 */
export function useSensitiveReveal(archive?: DebugArchive) {
  const [revealedFor, setRevealedFor] = useState<number>();
  const key = archive ? archiveKey(archive) : undefined;
  const revealed = key !== undefined && revealedFor === key;
  return { revealed, toggle: () => setRevealedFor(revealed ? undefined : key) };
}
