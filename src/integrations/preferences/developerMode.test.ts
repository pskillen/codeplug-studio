import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEVELOPER_MODE_KEY,
  isDeveloperModeOn,
  setDeveloperMode,
  subscribeDeveloperMode,
} from './developerMode.ts';

describe('developerMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(DEVELOPER_MODE_KEY);
  });

  it('is off by default and stores only this device', () => {
    expect(isDeveloperModeOn()).toBe(false);
    setDeveloperMode(true);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBe('on');
    expect(isDeveloperModeOn()).toBe(true);
    setDeveloperMode(false);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBeNull();
    expect(isDeveloperModeOn()).toBe(false);
  });

  it('ignores any value other than "on"', () => {
    localStorage.setItem(DEVELOPER_MODE_KEY, 'true');
    expect(isDeveloperModeOn()).toBe(false);
  });

  it('notifies subscribers in this tab and on storage events from other tabs', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeDeveloperMode((on) => seen.push(on));
    setDeveloperMode(true);
    localStorage.removeItem(DEVELOPER_MODE_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: DEVELOPER_MODE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    unsubscribe();
    setDeveloperMode(true);
    expect(seen).toEqual([true, false]);
  });

  it('fails soft to off when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    expect(isDeveloperModeOn()).toBe(false);
    expect(() => setDeveloperMode(true)).not.toThrow();
  });
});
