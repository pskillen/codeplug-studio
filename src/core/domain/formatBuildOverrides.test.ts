import { describe, expect, it } from 'vitest';
import {
  isEntityForceIncluded,
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
});
