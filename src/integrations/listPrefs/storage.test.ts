import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { channelListPrefsKey, entityListPrefsKey, trackingDashboardPrefsKey } from './keys.ts';
import {
  loadChannelListPrefs,
  loadTrackingDashboardPrefs,
  mergeChannelListPrefs,
  mergeEntityListPrefs,
  mergeTrackingDashboardPrefs,
  saveChannelListPrefs,
  saveTrackingDashboardPrefs,
} from './storage.ts';

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

describe('listPrefs storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when channel prefs are missing', () => {
    expect(loadChannelListPrefs('proj-1')).toBeNull();
  });

  it('round-trips channel list prefs', () => {
    saveChannelListPrefs('proj-1', { q: 'alpha', sortMode: 'distance' });
    expect(loadChannelListPrefs('proj-1')).toEqual({ q: 'alpha', sortMode: 'distance' });
  });

  it('mergeChannelListPrefs patches existing prefs', () => {
    saveChannelListPrefs('proj-1', { q: 'old', band: ['2m'] });
    const next = mergeChannelListPrefs('proj-1', { q: 'new' });
    expect(next).toEqual({ q: 'new', band: ['2m'] });
    expect(JSON.parse(localStorage.getItem(channelListPrefsKey('proj-1'))!)).toEqual({
      q: 'new',
      band: ['2m'],
    });
  });

  it('mergeEntityListPrefs isolates by entity', () => {
    mergeEntityListPrefs('zones', 'proj-1', { q: 'north' });
    mergeEntityListPrefs('talk-groups', 'proj-1', { q: 'local' });
    expect(JSON.parse(localStorage.getItem(entityListPrefsKey('zones', 'proj-1'))!)).toEqual({
      q: 'north',
    });
    expect(JSON.parse(localStorage.getItem(entityListPrefsKey('talk-groups', 'proj-1'))!)).toEqual({
      q: 'local',
    });
  });

  it('returns null when tracking dashboard prefs are missing', () => {
    expect(loadTrackingDashboardPrefs('proj-1')).toBeNull();
  });

  it('round-trips tracking dashboard prefs', () => {
    saveTrackingDashboardPrefs('proj-1', {
      windowHours: 24,
      minElevation: '10',
      onlyWithFrequencies: false,
      selectedSatelliteIds: ['sat-1', 'sat-2'],
    });
    expect(loadTrackingDashboardPrefs('proj-1')).toEqual({
      windowHours: 24,
      minElevation: '10',
      onlyWithFrequencies: false,
      selectedSatelliteIds: ['sat-1', 'sat-2'],
    });
  });

  it('mergeTrackingDashboardPrefs patches existing prefs and isolates by project', () => {
    saveTrackingDashboardPrefs('proj-1', { windowHours: 12, drawBehindMin: 5 });
    const next = mergeTrackingDashboardPrefs('proj-1', { windowHours: 48 });
    expect(next).toEqual({ windowHours: 48, drawBehindMin: 5 });
    expect(JSON.parse(localStorage.getItem(trackingDashboardPrefsKey('proj-1'))!)).toEqual({
      windowHours: 48,
      drawBehindMin: 5,
    });
    expect(loadTrackingDashboardPrefs('proj-2')).toBeNull();
  });
});

describe('listPrefs storage fail-soft', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when localStorage throws on read', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('disabled');
      },
      setItem: () => {},
    });
    expect(loadChannelListPrefs('proj-1')).toBeNull();
  });

  it('ignores write failures on save', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => saveChannelListPrefs('proj-1', { q: 'x' })).not.toThrow();
  });
});
