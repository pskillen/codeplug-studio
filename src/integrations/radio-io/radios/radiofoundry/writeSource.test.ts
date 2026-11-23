import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newOwnDigitalId,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import {
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
} from '@core/import-export/formats/radiofoundry/layout.ts';
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

  it('writes timeslot clone contacts into the contact blocks the cable sends', () => {
    const tg = newTalkGroup('p', 'X', 2355);
    const rgl = {
      ...newRxGroupList('p', 'List'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 1 as const }],
    };
    const dmr: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 2,
      ownDigitalIdId: null,
      contactRef: { kind: 'talkGroup', id: tg.id },
      rxGroupListId: rgl.id,
    };
    const channel: Channel = {
      ...newChannel('p', 'Repeater'),
      primaryMode: 'dmr',
      rxFrequency: 430_125_000,
      txFrequency: 430_125_000,
      modeProfiles: [dmr],
    };
    const build = assembled();
    build.channels = [{ entity: channel, wireName: channel.name }];
    build.talkGroups = [{ entity: tg, wireName: tg.name }];
    build.rxGroupLists = [{ entity: rgl, wireName: rgl.name }];
    const { bytes, owned } = radioFoundryWriteSourceFromAssembled(build);
    const ts1 = CONTACT_BASE;
    const ts2 = CONTACT_BASE + CONTACT_RECORD_SIZE;
    expect(owned[ts1]).toBe(1);
    expect(owned[ts2]).toBe(1);
    expect(bytes[ts1 + 0x17]).toBe(0x00);
    expect(bytes[ts2 + 0x17]).toBe(0x02);
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
