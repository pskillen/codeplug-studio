import { describe, expect, it } from 'vitest';
import {
  buildZoneBehaviourContext,
  includeInScanListFromLegacyBoolean,
  normalizeIncludeInScanListOverride,
  resolveEffectiveIncludeInZoneDerivedScanList,
  resolveIncludeInZoneDerivedScanListWithLayer,
} from './resolve.ts';
import { DEFAULT_ZONE_BEHAVIOUR_DEFAULTS } from '@core/models/zoneBehaviourDefaults.ts';

const CHANNEL_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHANNEL_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('zoneBehaviourDefaults resolve', () => {
  it('migrates legacy boolean includeInScanList', () => {
    expect(includeInScanListFromLegacyBoolean(true)).toBe('default');
    expect(includeInScanListFromLegacyBoolean(false)).toBe('skip');
    expect(normalizeIncludeInScanListOverride(false)).toBe('skip');
    expect(normalizeIncludeInScanListOverride(true)).toBe('default');
    expect(normalizeIncludeInScanListOverride('include')).toBe('include');
  });

  it('defaults to library include', () => {
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_A,
        memberOverride: 'default',
      }),
    ).toBe('include');
  });

  it('honours library default skip', () => {
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_A,
        memberOverride: 'default',
        context: {
          libraryDefaults: { includeInZoneDerivedScanList: false },
        },
      }),
    ).toBe('skip');
  });

  it('member override beats library', () => {
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_A,
        memberOverride: 'skip',
        context: {
          libraryDefaults: { ...DEFAULT_ZONE_BEHAVIOUR_DEFAULTS },
        },
      }),
    ).toBe('skip');
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_A,
        memberOverride: 'include',
        context: {
          libraryDefaults: { includeInZoneDerivedScanList: false },
        },
      }),
    ).toBe('include');
  });

  it('build override beats member', () => {
    const context = buildZoneBehaviourContext(
      { includeInZoneDerivedScanList: true },
      { defaultIncludeInZoneDerivedScanList: false },
    );
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_A,
        memberOverride: 'include',
        context,
      }),
    ).toBe('skip');
  });

  it('projection beats build and is per-channel', () => {
    const context = buildZoneBehaviourContext(
      { includeInZoneDerivedScanList: true },
      { defaultIncludeInZoneDerivedScanList: true },
    );
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_A,
        memberOverride: 'include',
        context,
        projection: { [CHANNEL_A]: 'skip', [CHANNEL_B]: 'include' },
      }),
    ).toBe('skip');
    expect(
      resolveEffectiveIncludeInZoneDerivedScanList({
        channelId: CHANNEL_B,
        memberOverride: 'default',
        context,
        projection: { [CHANNEL_A]: 'skip' },
      }),
    ).toBe('include');
  });

  it('reports winning layer', () => {
    expect(
      resolveIncludeInZoneDerivedScanListWithLayer({
        channelId: CHANNEL_A,
        memberOverride: 'default',
        projection: { [CHANNEL_A]: 'skip' },
      }).layer,
    ).toBe('projection');
    expect(
      resolveIncludeInZoneDerivedScanListWithLayer({
        channelId: CHANNEL_A,
        memberOverride: 'skip',
      }).layer,
    ).toBe('member');
    expect(
      resolveIncludeInZoneDerivedScanListWithLayer({
        channelId: CHANNEL_A,
        memberOverride: 'default',
        context: buildZoneBehaviourContext(undefined, {
          defaultIncludeInZoneDerivedScanList: false,
        }),
      }).layer,
    ).toBe('build');
  });
});
