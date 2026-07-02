import { describe, expect, it } from 'vitest';
import { emptyLibrary, newRxGroupList, newTalkGroup } from '@core/domain/factories.ts';
import type { RepeaterListing } from './types.ts';
import {
  buildBrandmeisterImportBundle,
  uniqueRxGroupListName,
} from './brandmeisterImport.ts';
import type { ResolvedBrandMeisterTalkGroup } from './brandmeisterTalkGroups.ts';

const listing: RepeaterListing = {
  source: 'brandmeister',
  remoteId: '234054',
  callsign: 'GB7AC',
  name: 'Skelmorlie',
  rxFrequencyHz: 438_550_000,
  txFrequencyHz: 430_950_000,
  toneHz: null,
  modes: ['dmr'],
  primaryMode: 'dmr',
  colourCode: 3,
  locator: null,
  location: { lat: 55.84, lon: -4.88 },
  band: '',
  status: 'Online',
};

const resolved: ResolvedBrandMeisterTalkGroup[] = [
  { digitalId: 23559, name: 'Scotland West', slot: 1 },
  { digitalId: 2355, name: 'Scotland', slot: 2 },
];

describe('buildBrandmeisterImportBundle', () => {
  it('creates talk groups, RX list, and wires channel DMR profile', () => {
    const library = emptyLibrary();
    const bundle = buildBrandmeisterImportBundle(listing, 'proj-1', library, resolved);

    expect(bundle.talkGroupsToCreate).toHaveLength(2);
    expect(bundle.talkGroupsExisting).toHaveLength(0);
    expect(bundle.rxGroupList?.name).toBe('GB7AC — BrandMeister');
    expect(bundle.rxGroupList?.members).toHaveLength(2);
    expect(bundle.rxGroupList?.members[0]?.timeSlotOverride).toBe(1);
    expect(bundle.rxGroupList?.members[1]?.timeSlotOverride).toBe(2);

    const dmr = bundle.channel.modeProfiles.find((p) => p.mode === 'dmr');
    expect(dmr?.mode).toBe('dmr');
    if (dmr?.mode === 'dmr') {
      expect(dmr.rxGroupListId).toBe(bundle.rxGroupList?.id);
      expect(dmr.colourCode).toBe(3);
    }
  });

  it('reuses existing talk groups by digitalId', () => {
    const library = emptyLibrary();
    const existing = newTalkGroup('proj-1', 'Scotland West', 23559);
    library.talkGroups.push(existing);

    const bundle = buildBrandmeisterImportBundle(listing, 'proj-1', library, resolved);
    expect(bundle.talkGroupsToCreate).toHaveLength(1);
    expect(bundle.talkGroupsExisting).toHaveLength(1);
    expect(bundle.talkGroupsExisting[0]?.id).toBe(existing.id);
    expect(bundle.rxGroupList?.members[0]?.ref.id).toBe(existing.id);
  });

  it('returns channel only when remote talk groups are empty', () => {
    const bundle = buildBrandmeisterImportBundle(listing, 'proj-1', emptyLibrary(), []);
    expect(bundle.rxGroupList).toBeNull();
    expect(bundle.talkGroupsToCreate).toHaveLength(0);
    const dmr = bundle.channel.modeProfiles.find((p) => p.mode === 'dmr');
    if (dmr?.mode === 'dmr') {
      expect(dmr.rxGroupListId).toBeNull();
    }
  });
});

describe('uniqueRxGroupListName', () => {
  it('appends suffix when name collides', () => {
    const library = emptyLibrary();
    library.rxGroupLists.push(newRxGroupList('p', 'GB7AC — BrandMeister'));
    expect(uniqueRxGroupListName('GB7AC — BrandMeister', library)).toBe('GB7AC — BrandMeister 2');
  });
});
