import { afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AT_D890_PENDING_UNITS_KEY } from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { consumeLeakedD890MarkerAllowance } from './leakedD890Marker.ts';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverMock {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

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
