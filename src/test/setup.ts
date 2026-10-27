import { beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

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

// An AT-D890 test that writes leaves its in-progress marker in storage (#1406): start each test
// without the previous one's pending-units record, as a fresh browser would.
beforeEach(() => {
  try {
    localStorage.removeItem('codeplug-studio:d890-pending-units');
  } catch {
    // Storage unavailable: nothing to clear.
  }
});
