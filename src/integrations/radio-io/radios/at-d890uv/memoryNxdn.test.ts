import { describe, expect, it } from 'vitest';
import type { RadioNxdnListsDto } from '../../radioWriteProjection.ts';
import { AT_D890_NXDN } from './constants.ts';
import {
  atD890NxdnOwnedUnits,
  atD890UploadBankIntentFromOrganisation,
  clearNxdnBlocksFromCache,
  getCacheBytes,
  isAtD890NxdnPairAddress,
  listWriteChunks,
  stageAtD890NxdnLists,
  AT_D890_NXDN_RX_UNIT_BASE,
  type AtD890DownloadCache,
} from './memory.ts';

const LISTS: RadioNxdnListsDto = {
  entries: [
    { wireName: 'TG 1234', nxdnId: 1234, kind: 'group' },
    { wireName: 'Alice', nxdnId: 5678, kind: 'individual' },
  ],
  rxGroups: [{ wireName: 'Local', memberSlots: [0, 1] }],
};

function staleNxdnCache(): AtD890DownloadCache {
  const cache: AtD890DownloadCache = { blocks: new Map() };
  for (const address of [
    AT_D890_NXDN.ListIndex,
    AT_D890_NXDN.ListSet,
    AT_D890_NXDN.ListData,
    AT_D890_NXDN.ListOrder,
    AT_D890_NXDN.RxGroupData,
    AT_D890_NXDN.RxGroupSet,
    // And a B-half block, which a Read never targets but a clear must still drop.
    AT_D890_NXDN.ListIndex + 0x4_0000,
  ]) {
    cache.blocks.set(address, new Uint8Array(16).fill(0x77));
  }
  return cache;
}

describe('intent from organisation', () => {
  it('carries nxdnLists only for the MM9PDY target', () => {
    expect(
      atD890UploadBankIntentFromOrganisation({ atD890SettingsTarget: 'mm9pdy', nxdnLists: LISTS })
        .nxdnLists,
    ).toBe(LISTS);
    expect(atD890UploadBankIntentFromOrganisation({ nxdnLists: LISTS }).nxdnLists).toBeUndefined();
    expect(
      atD890UploadBankIntentFromOrganisation({
        atD890SettingsTarget: 'stock',
        nxdnLists: LISTS,
      }).nxdnLists,
    ).toBeUndefined();
    expect(
      atD890UploadBankIntentFromOrganisation({ atD890SettingsTarget: 'mm9pdy' }).nxdnLists,
    ).toBeUndefined();
  });
});

describe('stageAtD890NxdnLists', () => {
  it('stages blocks in all four list units and the RX group unit for an MM9PDY intent', () => {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const intent = atD890UploadBankIntentFromOrganisation({
      atD890SettingsTarget: 'mm9pdy',
      nxdnLists: LISTS,
    });
    expect(stageAtD890NxdnLists(cache, intent)).toBeGreaterThan(0);
    const addresses = new Set(listWriteChunks(cache).map((c) => c.address));
    for (const address of [
      AT_D890_NXDN.ListIndex,
      AT_D890_NXDN.ListSet,
      AT_D890_NXDN.ListData,
      AT_D890_NXDN.ListOrder,
      AT_D890_NXDN.RxGroupData,
      AT_D890_NXDN.RxGroupSet,
    ]) {
      expect(addresses.has(address), `0x${address.toString(16)}`).toBe(true);
    }
    // The list set is padded to its 16-byte block with FF past the CPS length.
    expect([...getCacheBytes(cache, AT_D890_NXDN.ListSet, 2)]).toEqual([0xfc, 0xff]);
    expect(getCacheBytes(cache, AT_D890_NXDN.ListSet + 0x7e, 2)).toEqual(
      new Uint8Array([0xff, 0xff]),
    );
  });

  it('clears stale NXDN blocks and stages none for a stock intent', () => {
    const cache = staleNxdnCache();
    const intent = atD890UploadBankIntentFromOrganisation({});
    expect(stageAtD890NxdnLists(cache, intent)).toBe(0);
    expect([...cache.blocks.keys()].filter(isAtD890NxdnPairAddress)).toEqual([]);
    expect(listWriteChunks(cache)).toEqual([]);
  });

  it('replaces stale blocks with the new list for an MM9PDY intent', () => {
    const cache = staleNxdnCache();
    const intent = atD890UploadBankIntentFromOrganisation({
      atD890SettingsTarget: 'mm9pdy',
      nxdnLists: LISTS,
    });
    stageAtD890NxdnLists(cache, intent);
    expect(cache.blocks.has(AT_D890_NXDN.ListIndex + 0x4_0000)).toBe(false);
    expect(getCacheBytes(cache, AT_D890_NXDN.ListIndex, 8)).toEqual(
      new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0]),
    );
  });

  it('stages only the RX group unit when there are no list entries, and sizes nothing for no lists', () => {
    const rxOnly = atD890UploadBankIntentFromOrganisation({
      atD890SettingsTarget: 'mm9pdy',
      nxdnLists: { entries: [], rxGroups: [{ wireName: 'Empty', memberSlots: [] }] },
    });
    expect(atD890NxdnOwnedUnits(rxOnly)).toEqual([AT_D890_NXDN_RX_UNIT_BASE]);
    expect(atD890NxdnOwnedUnits(atD890UploadBankIntentFromOrganisation({}))).toEqual([]);
    expect(
      atD890NxdnOwnedUnits(atD890UploadBankIntentFromOrganisation({ nxdnLists: LISTS })),
    ).toEqual([]);
    const cache: AtD890DownloadCache = { blocks: new Map() };
    stageAtD890NxdnLists(cache, rxOnly);
    expect(cache.blocks.has(AT_D890_NXDN.ListIndex)).toBe(false);
  });

  it('clearNxdnBlocksFromCache leaves every other block alone', () => {
    const cache = staleNxdnCache();
    cache.blocks.set(0x100_0000, new Uint8Array(16).fill(1));
    clearNxdnBlocksFromCache(cache);
    expect([...cache.blocks.keys()]).toEqual([0x100_0000]);
  });
});
