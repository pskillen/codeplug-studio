import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { channelListLayoutPrefsKey } from './keys.ts';
import {
  loadChannelListLayoutPrefs,
  mergeChannelListLayoutPrefs,
  saveChannelListLayoutPrefs,
} from './layoutPrefs.ts';

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

describe('channel list layout prefs', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips layout prefs', () => {
    saveChannelListLayoutPrefs('proj-1', { layout: 'cards', cardGroup: 'zone' });
    expect(loadChannelListLayoutPrefs('proj-1')).toEqual({
      layout: 'cards',
      cardGroup: 'zone',
    });
  });

  it('mergeChannelListLayoutPrefs patches existing prefs', () => {
    saveChannelListLayoutPrefs('proj-1', { layout: 'table', cardGroup: 'none' });
    const next = mergeChannelListLayoutPrefs('proj-1', { layout: 'cards' });
    expect(next).toEqual({ layout: 'cards', cardGroup: 'none' });
    expect(JSON.parse(localStorage.getItem(channelListLayoutPrefsKey('proj-1'))!)).toEqual({
      layout: 'cards',
      cardGroup: 'none',
    });
  });
});
