import { describe, expect, it } from 'vitest';
import {
  filterExpandedRowsByOverrides,
  isEntityForceIncluded,
  isProjectionExcluded,
  overrideScanInclusion,
  parseOverrideArray,
  upsertOverride,
} from './formatBuildOverrides.ts';

describe('formatBuildOverrides', () => {
  it('parses forceInclude on override rows', () => {
    const rows = parseOverrideArray(
      [{ libraryEntityId: 'zone-1', forceInclude: true }],
      'zoneOverrides',
    );
    expect(rows).toEqual([{ libraryEntityId: 'zone-1', forceInclude: true }]);
  });

  it('detects forceInclude via isEntityForceIncluded', () => {
    const overrides = [{ libraryEntityId: 'zone-1', forceInclude: true }];
    expect(isEntityForceIncluded(overrides, 'zone-1')).toBe(true);
    expect(isEntityForceIncluded(overrides, 'zone-2')).toBe(false);
  });

  it('retains sparse override row when only forceInclude is set', () => {
    const next = upsertOverride(undefined, 'zone-1', { forceInclude: true });
    expect(next).toEqual([{ libraryEntityId: 'zone-1', forceInclude: true }]);
  });

  it('removes override row when forceInclude is cleared and no other fields remain', () => {
    const existing = [{ libraryEntityId: 'zone-1', forceInclude: true }];
    const next = upsertOverride(existing, 'zone-1', { forceInclude: false });
    expect(next).toEqual([]);
  });

  it('keeps override row when forceInclude cleared but wireName remains', () => {
    const existing = [{ libraryEntityId: 'zone-1', forceInclude: true, wireName: 'PMR' }];
    const next = upsertOverride(existing, 'zone-1', { forceInclude: false });
    expect(next).toEqual([{ libraryEntityId: 'zone-1', wireName: 'PMR' }]);
  });

  it('parses and retains orderOrSlot on override rows', () => {
    const rows = parseOverrideArray(
      [{ libraryEntityId: 'ch-1', orderOrSlot: 5 }],
      'channelOverrides',
    );
    expect(rows).toEqual([{ libraryEntityId: 'ch-1', orderOrSlot: 5 }]);
    const next = upsertOverride(undefined, 'ch-1', { orderOrSlot: 3 });
    expect(next).toEqual([{ libraryEntityId: 'ch-1', orderOrSlot: 3 }]);
    expect(upsertOverride(next, 'ch-1', { orderOrSlot: undefined })).toEqual([]);
  });

  it('parses and retains scanInclusion on override rows', () => {
    const rows = parseOverrideArray(
      [{ libraryEntityId: 'ch-1', scanInclusion: 'skip' }],
      'channelOverrides',
    );
    expect(rows).toEqual([{ libraryEntityId: 'ch-1', scanInclusion: 'skip' }]);
    expect(overrideScanInclusion(rows, 'ch-1')).toBe('skip');
    const next = upsertOverride(undefined, 'ch-1', { scanInclusion: 'alwaysScan' });
    expect(next).toEqual([{ libraryEntityId: 'ch-1', scanInclusion: 'alwaysScan' }]);
    expect(upsertOverride(next, 'ch-1', { scanInclusion: undefined })).toEqual([]);
  });

  it('keeps scanInclusion when clearing wireName', () => {
    const existing = [{ libraryEntityId: 'ch-1', wireName: 'A', scanInclusion: 'skip' as const }];
    const next = upsertOverride(existing, 'ch-1', { wireName: undefined });
    expect(next).toEqual([{ libraryEntityId: 'ch-1', scanInclusion: 'skip' }]);
  });

  it('rejects invalid scanInclusion on parse', () => {
    expect(() =>
      parseOverrideArray([{ libraryEntityId: 'ch-1', scanInclusion: 'nope' }], 'channelOverrides'),
    ).toThrow(/scanInclusion is invalid/);
  });

  it('isProjectionExcluded honours projection key and parent channel id', () => {
    const overrides = [
      { libraryEntityId: 'ch-1:fm', excluded: true },
      { libraryEntityId: 'ch-2', excluded: true },
    ];
    expect(isProjectionExcluded(overrides, 'ch-1:fm', 'ch-1')).toBe(true);
    expect(isProjectionExcluded(overrides, 'ch-1:dmr', 'ch-1')).toBe(false);
    expect(isProjectionExcluded(overrides, 'ch-2:fm', 'ch-2')).toBe(true);
    expect(isProjectionExcluded(overrides, 'ch-2', 'ch-2')).toBe(true);
  });

  it('filterExpandedRowsByOverrides drops excluded projections only', () => {
    const rows = [
      { key: 'ch-1:tg-a', sourceChannelId: 'ch-1', wireName: 'A' },
      { key: 'ch-1:tg-b', sourceChannelId: 'ch-1', wireName: 'B' },
      { key: 'ch-1:scratch', sourceChannelId: 'ch-1', wireName: 'S' },
    ];
    const filtered = filterExpandedRowsByOverrides(rows, [
      { libraryEntityId: 'ch-1:tg-b', excluded: true },
    ]);
    expect(filtered.map((row) => row.key)).toEqual(['ch-1:tg-a', 'ch-1:scratch']);

    const parentSkip = filterExpandedRowsByOverrides(rows, [
      { libraryEntityId: 'ch-1', excluded: true },
    ]);
    expect(parentSkip).toEqual([]);
  });
});
