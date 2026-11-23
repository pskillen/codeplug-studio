import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newOwnDigitalId,
  newTalkGroup,
} from '@core/domain/factories.ts';
import {
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { DMR_ID_DATABASE_ADDRESS } from './idDatabase.ts';
import { radioFoundryReviewContacts, radioFoundryWriteSourceFromAssembled } from './writeSource.ts';

function fmChannel(name: string): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [
      { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ],
  };
  return { entity, wireName: name };
}

function assembled(): AssembledBuild {
  const talkGroup = newTalkGroup('p', 'Town', 9);
  const contact = { ...newDigitalContact('p', 'Alice', 1001, 'dmr'), callsign: 'M7ABC' };
  const channel = fmChannel('Local');
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'DM-32',
    channels: [channel],
    zones: [{ zoneId: 'z', wireName: 'Home', memberChannelIds: [channel.entity.id] }],
    scanLists: [],
    talkGroups: [{ entity: talkGroup, wireName: talkGroup.name }],
    digitalContacts: [{ entity: contact, wireName: contact.name }],
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [{ ...newOwnDigitalId('p', 'dmr', 'MM9PDY', 2_351_234), isDefault: true }],
  };
}

describe('radioFoundryWriteSourceFromAssembled contacts', () => {
  it('keeps channels, zones, talk groups, and RX lists when private contacts are left out', () => {
    const build = assembled();
    const on = radioFoundryWriteSourceFromAssembled(build, { includeLibraryContacts: true });
    const off = radioFoundryWriteSourceFromAssembled(build, { includeLibraryContacts: false });
    const privateAt = CONTACT_BASE + CONTACT_RECORD_SIZE;
    expect(on.owned[CONTACT_BASE]).toBe(1);
    expect(off.owned[CONTACT_BASE]).toBe(1);
    expect(on.owned[privateAt]).toBe(1);
    expect(off.owned[privateAt]).toBe(0);
    expect(off.bytes[privateAt]).toBe('A'.charCodeAt(0));
    let mismatch = -1;
    for (let i = 0; i < on.owned.length; i += 1) {
      if (i >= privateAt && i < privateAt + CONTACT_RECORD_SIZE) continue;
      if (off.owned[i] !== on.owned[i] || off.bytes[i] !== on.bytes[i]) {
        mismatch = i;
        break;
      }
    }
    expect(mismatch).toBe(-1);
    expect(off.owned[DMR_ID_DATABASE_ADDRESS]).toBe(0);
  });

  it('reviews an empty list when the chosen source produced no rows', () => {
    const build = assembled();
    build.digitalContacts = [];
    expect(
      radioFoundryReviewContacts(build, [], {
        includeLibraryContacts: true,
        includeDigitalIdDirectory: false,
      }),
    ).toEqual([]);
    expect(
      radioFoundryReviewContacts(build, [], {
        includeLibraryContacts: false,
        includeDigitalIdDirectory: false,
      }),
    ).toBeUndefined();
  });
});
