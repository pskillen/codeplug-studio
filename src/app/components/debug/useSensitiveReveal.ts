import { useState } from 'react';

/**
 * Show/hide state for password bytes. Hidden by default, and hidden again whenever the
 * `key` changes (a new read, an import, another retained read is shown). Pass any stable
 * per-source number; `undefined` means nothing is shown and so nothing is revealed.
 */
export function useSensitiveReveal(key?: number) {
  const [revealedFor, setRevealedFor] = useState<number>();
  const revealed = key !== undefined && revealedFor === key;
  return { revealed, toggle: () => setRevealedFor(revealed ? undefined : key) };
}
