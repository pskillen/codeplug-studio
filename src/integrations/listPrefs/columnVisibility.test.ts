import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  channelListColumnsKey,
  channelListColumnsSchemaKey,
} from './keys.ts';
import {
  loadChannelVisibleColumns,
  loadStringArray,
  saveStringArray,
} from './columnVisibility.ts';

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

describe('columnVisibility', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadStringArray returns fallback when key is missing', () => {
    const valid = new Set(['a', 'b']);
    expect(loadStringArray('missing', valid, ['a'])).toEqual(['a']);
  });

  it('loadStringArray filters unknown keys', () => {
    saveStringArray('cols', ['a', 'x', 'b']);
    const valid = new Set(['a', 'b']);
    expect(loadStringArray('cols', valid, [])).toEqual(['a', 'b']);
  });

  it('loadChannelVisibleColumns bumps schema version when stale', () => {
    const projectId = 'proj-1';
    const validKeys = new Set(['band', 'mode']);
    saveStringArray(channelListColumnsKey(projectId), ['band']);
    localStorage.setItem(channelListColumnsSchemaKey(projectId), '0');

    const cols = loadChannelVisibleColumns(projectId, validKeys, ['band', 'mode'], 1);

    expect(cols).toEqual(['band']);
    expect(localStorage.getItem(channelListColumnsSchemaKey(projectId))).toBe('1');
  });

  it('loadChannelVisibleColumns returns defaults when nothing stored', () => {
    const cols = loadChannelVisibleColumns('proj-2', new Set(['band']), ['band'], 1);
    expect(cols).toEqual(['band']);
  });
});

describe('columnVisibility fail-soft', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns fallback when localStorage throws on read', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('disabled');
      },
      setItem: () => {},
    });
    expect(loadStringArray('key', new Set(['a']), ['a'])).toEqual(['a']);
  });

  it('ignores write failures', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => saveStringArray('key', ['a'])).not.toThrow();
  });
});
