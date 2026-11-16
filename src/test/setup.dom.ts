// DOM-only test setup: runs in the `dom` (jsdom) Vitest project after ./setup.ts.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

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

// The debug Memory category choice is remembered in localStorage; keep it from leaking between tests.
afterEach(() => {
  try {
    for (const key of Object.keys(window.localStorage))
      if (key.includes('debug-memory-category:')) window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
});
