import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadActiveProjectId,
  loadMapboxToken,
  saveActiveProjectId,
  saveMapboxToken,
} from './index.ts';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('active project preference', () => {
  it('returns null when nothing is stored', () => {
    expect(loadActiveProjectId()).toBeNull();
  });

  it('round-trips a project id', () => {
    saveActiveProjectId('project-123');
    expect(loadActiveProjectId()).toBe('project-123');
  });

  it('clears the stored id when given null', () => {
    saveActiveProjectId('project-123');
    saveActiveProjectId(null);
    expect(loadActiveProjectId()).toBeNull();
  });
});

describe('mapbox token preference', () => {
  it('returns empty string when nothing is stored', () => {
    expect(loadMapboxToken()).toBe('');
  });

  it('round-trips a token', () => {
    saveMapboxToken('pk.test-token');
    expect(loadMapboxToken()).toBe('pk.test-token');
  });

  it('clears the token when given empty string', () => {
    saveMapboxToken('pk.test-token');
    saveMapboxToken('');
    expect(loadMapboxToken()).toBe('');
  });
});
