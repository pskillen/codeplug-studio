// Shared setup for every Vitest project (`dom` and `node`). Anything that touches `window` lives in
// ./setup.dom.ts. Storage access is guarded, so the leaked-marker check also runs where there is no
// `localStorage`.
import { afterEach, beforeEach } from 'vitest';
import { AT_D890_PENDING_UNITS_KEY } from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { consumeLeakedD890MarkerAllowance } from './leakedD890Marker.ts';

function readMarker(): string | null {
  try {
    return localStorage.getItem(AT_D890_PENDING_UNITS_KEY);
  } catch {
    return null;
  }
}

function clearMarker(): void {
  try {
    localStorage.removeItem(AT_D890_PENDING_UNITS_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

// An AT-D890 write that is abandoned leaves its pending-units record in storage (#1406). Each
// test starts without one, as a fresh browser would, and a test that leaves one by accident fails
// here instead of being silently reset. A test that leaves one on purpose calls
// `allowLeakedD890Marker()` (./leakedD890Marker.ts).
beforeEach(clearMarker);

afterEach(() => {
  const allowed = consumeLeakedD890MarkerAllowance();
  const leaked = readMarker();
  if (leaked === null || allowed) return;
  clearMarker();
  throw new Error(
    `A test left an AT-D890 pending-units record in storage (${AT_D890_PENDING_UNITS_KEY}): ${leaked}. ` +
      'Clear it in the test, or call allowLeakedD890Marker() if leaving it is the point.',
  );
});
