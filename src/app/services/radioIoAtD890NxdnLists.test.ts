import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newRadioBuildForProfile,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, ChannelModeProfile, EntityRef } from '@core/models/library.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { buildRadioWriteProjection, assembledHasNxdnContent } from './radioIoWriteProjection.ts';

const PROJECT = 'p1';

const DMR: ChannelModeProfile = {
  mode: 'dmr',
  dmrMode: null,
  colourCode: 3,
  timeslot: 2,
  ownDigitalIdId: null,
  contactRef: null,
  rxGroupListId: null,
  sendTalkerAlias: 'default',
};

function nxdn(
  over: Partial<Extract<ChannelModeProfile, { mode: 'nxdn' }>> = {},
): ChannelModeProfile {
  return {
    mode: 'nxdn',
    rxRan: 1,
    txRan: 1,
    ownDigitalIdId: null,
    contactRef: null,
    rxGroupListId: null,
    nxdnRate: 'nxdn48',
    ...over,
  };
}

function channel(id: string, rxHz: number, profiles: ChannelModeProfile[]): Channel {
  return withExportEligibleDefaults({
    ...newChannel(PROJECT, id),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    modeProfiles: profiles,
  });
}

const tg1234 = { ...newTalkGroup(PROJECT, 'NX TG', 1234, 'nxdn'), id: 'tg-nx' };
const tgAll = { ...newTalkGroup(PROJECT, 'All call', 65535, 'nxdn'), id: 'tg-all' };
const tgDmr = { ...newTalkGroup(PROJECT, 'DMR TG', 91, 'dmr'), id: 'tg-dmr' };
const alice = {
  ...newDigitalContact(PROJECT, 'Alice', 5678, 'nxdn'),
  id: 'dc-nx',
  callsign: 'M0ABC',
};
const bob = { ...newDigitalContact(PROJECT, 'Bob', 2345, 'dmr'), id: 'dc-dmr' };

const ref = (kind: 'talkGroup' | 'digitalContact', id: string): EntityRef =>
  ({ kind, id }) as EntityRef;

const local = {
  ...newRxGroupList(PROJECT, 'Local'),
  id: 'rx-local',
  members: [
    { ref: ref('talkGroup', 'tg-nx') },
    { ref: ref('talkGroup', 'tg-dmr') },
    { ref: ref('digitalContact', 'dc-nx') },
  ],
};
const dmrOnlyList = {
  ...newRxGroupList(PROJECT, 'DMR only'),
  id: 'rx-dmr',
  members: [{ ref: ref('talkGroup', 'tg-dmr') }],
};

const callTg = channel('call-tg', 430_125_000, [
  nxdn({ contactRef: ref('talkGroup', 'tg-nx'), rxGroupListId: 'rx-local' }),
]);
const callPerson = channel('call-person', 430_250_000, [
  nxdn({ contactRef: ref('digitalContact', 'dc-nx') }),
]);
const dmrCh = channel('dmr-ch', 430_375_000, [
  { ...DMR, contactRef: ref('talkGroup', 'tg-dmr'), rxGroupListId: 'rx-dmr' } as ChannelModeProfile,
]);

function libraryOf(over: Partial<LibrarySlice>): LibrarySlice {
  const channels = over.channels ?? [callTg, callPerson, dmrCh];
  const zone = {
    ...newZone(PROJECT, 'Z'),
    id: 'zone-z',
    members: channels.map((ch) => ({ kind: 'channel' as const, channelId: ch.id })),
  };
  return {
    channels,
    zones: [zone],
    scanLists: [],
    talkGroups: [tgAll, tg1234, tgDmr],
    digitalContacts: [bob, alice],
    analogContacts: [],
    rxGroupLists: [local, dmrOnlyList],
    aprsConfiguration: null,
    ...over,
  };
}

function project(
  profileId: 'radio-io-at-d890uv-mm9pdy' | 'radio-io-at-d890uv',
  library: LibrarySlice,
  atD890Nxdn?: boolean,
) {
  const { build, egress } = newRadioBuildForProfile(PROJECT, profileId);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  return buildRadioWriteProjection(
    assembled,
    build,
    library,
    egress,
    atD890Nxdn === undefined ? undefined : { atD890Nxdn },
  );
}

const text = (p: ReturnType<typeof project>) =>
  p.warnings.map((w) => formatExportWarning(w)).join('\n');

describe('AT-D890 MM9PDY NXDN lists projection (#255)', () => {
  const library = libraryOf({});

  it('radio reports NXDN enabled: talk groups first, then contacts, NXDN only', () => {
    const p = project('radio-io-at-d890uv-mm9pdy', library, true);
    const entries = p.organisation.nxdnLists!.entries;
    expect(entries.map((e) => e.kind)).toEqual(['group', 'group', 'individual']);
    expect(entries.map((e) => e.nxdnId).sort((a, b) => a - b)).toEqual([1234, 5678, 65535]);
    expect(entries[2]!.callsign).toBe('M0ABC');
    // The DMR talk group and contact stay out of the NXDN list.
    expect(entries.some((e) => e.nxdnId === 91 || e.nxdnId === 2345)).toBe(false);
  });

  it('writes only the RX lists an NXDN channel uses or that hold an NXDN member, with NXDN members', () => {
    const p = project('radio-io-at-d890uv-mm9pdy', library, true);
    const lists = p.organisation.nxdnLists!;
    const slotOf = (id: number) => lists.entries.findIndex((e) => e.nxdnId === id);
    expect(lists.rxGroups).toHaveLength(1);
    expect(lists.rxGroups[0]!.wireName).toBe('Local');
    expect([...lists.rxGroups[0]!.memberSlots].sort()).toEqual([slotOf(1234), slotOf(5678)].sort());
    // The DMR member of the mixed list is dropped with a warning.
    expect(text(p)).toMatch(/1 RX group list member\(s\) are not NXDN/);
  });

  it('fills each NXDN channel with its call target slot and RX group index', () => {
    const p = project('radio-io-at-d890uv-mm9pdy', library, true);
    const entries = p.organisation.nxdnLists!.entries;
    const byName = new Map(p.channels.map((c) => [c.wireName, c]));
    expect(byName.get('call-tg')!.nxdn).toMatchObject({
      txTargetIndex: entries.findIndex((e) => e.nxdnId === 1234),
      rxGroupIndex: 0,
    });
    expect(byName.get('call-person')!.nxdn!.txTargetIndex).toBe(
      entries.findIndex((e) => e.nxdnId === 5678),
    );
    expect(byName.get('call-person')!.nxdn!.rxGroupIndex).toBeUndefined();
    expect(byName.get('dmr-ch')!.nxdn).toBeUndefined();
  });

  it('the DMR bank holds only the DMR talk group and contact', () => {
    const p = project('radio-io-at-d890uv-mm9pdy', library, true);
    expect(p.organisation.talkGroups!.map((t) => t.digitalId)).toEqual([91, 2345]);
  });

  it('radio does not report NXDN enabled: no nxdnLists, same as stock', () => {
    for (const flag of [false, undefined]) {
      const p = project('radio-io-at-d890uv-mm9pdy', library, flag);
      expect(p.organisation.nxdnLists).toBeUndefined();
    }
    expect(project('radio-io-at-d890uv', library, true).organisation.nxdnLists).toBeUndefined();
  });

  it('D7: NXDN on but no NXDN talk groups, contacts or RX lists: no nxdnLists', () => {
    const lib = libraryOf({
      channels: [dmrCh],
      talkGroups: [tgDmr],
      digitalContacts: [bob],
      rxGroupLists: [dmrOnlyList],
    });
    const p = project('radio-io-at-d890uv-mm9pdy', lib, true);
    expect(p.organisation.nxdnLists).toBeUndefined();
  });

  it('D7: an NXDN channel with no call and no list leaves the lists alone and writes no target', () => {
    const bare = channel('bare', 430_500_000, [nxdn()]);
    const lib = libraryOf({
      channels: [bare],
      talkGroups: [],
      digitalContacts: [],
      rxGroupLists: [],
    });
    const p = project('radio-io-at-d890uv-mm9pdy', lib, true);
    expect(p.organisation.nxdnLists).toBeUndefined();
    expect(p.channels.find((c) => c.wireName === 'bare')!.nxdn).toEqual({
      rxRan: 1,
      txRan: 1,
      rate: 'nxdn48',
    });
  });

  it('skips IDs the radio refuses and warns; contact 65535 is refused, a talk group 65535 is not', () => {
    const badContact = { ...newDigitalContact(PROJECT, 'Bad', 65535, 'nxdn'), id: 'dc-bad' };
    const zero = { ...newTalkGroup(PROJECT, 'Zero', 0, 'nxdn'), id: 'tg-zero' };
    const lib = libraryOf({
      talkGroups: [tg1234, tgAll, zero],
      digitalContacts: [badContact],
    });
    const p = project('radio-io-at-d890uv-mm9pdy', lib, true);
    expect(p.organisation.nxdnLists!.entries.map((e) => e.nxdnId)).toEqual([1234, 65535]);
    expect(text(p)).toMatch(
      /2 NXDN talk group\(s\) or contact\(s\) have an ID the radio does not accept/,
    );
  });

  it('caps the list at 1000 with talk groups first, and warns', () => {
    const tgs = Array.from({ length: 600 }, (_, i) => ({
      ...newTalkGroup(PROJECT, `T${i}`, i + 1, 'nxdn'),
      id: `t${i}`,
    }));
    const dcs = Array.from({ length: 600 }, (_, i) => ({
      ...newDigitalContact(PROJECT, `C${i}`, i + 1, 'nxdn'),
      id: `c${i}`,
    }));
    const p = project(
      'radio-io-at-d890uv-mm9pdy',
      libraryOf({ talkGroups: tgs, digitalContacts: dcs, rxGroupLists: [], channels: [callTg] }),
      true,
    );
    const entries = p.organisation.nxdnLists!.entries;
    expect(entries).toHaveLength(1000);
    expect(entries.filter((e) => e.kind === 'group')).toHaveLength(600);
    expect(text(p)).toMatch(/200 were not written \(talk groups go first\)/);
  });

  it('an NXDN channel calling a DMR contact is written with no call target and a warning', () => {
    const bad = channel('bad-call', 430_600_000, [
      nxdn({ contactRef: ref('talkGroup', 'tg-dmr') }),
    ]);
    const p = project('radio-io-at-d890uv-mm9pdy', libraryOf({ channels: [bad, callTg] }), true);
    expect(p.channels.find((c) => c.wireName === 'bad-call')!.nxdn!.txTargetIndex).toBeUndefined();
    expect(text(p)).toMatch(/1 NXDN channel\(s\) call a talk group or contact that is not in/);
  });

  it('drops a repeated ID and kind from the list with a warning; its channel uses the first slot', () => {
    const twin = { ...newTalkGroup(PROJECT, 'NX TG twin', 1234, 'nxdn'), id: 'tg-nx-twin' };
    const twinCh = channel('twin-ch', 430_700_000, [
      nxdn({ contactRef: ref('talkGroup', 'tg-nx-twin') }),
    ]);
    const p = project(
      'radio-io-at-d890uv-mm9pdy',
      libraryOf({
        channels: [callTg, twinCh],
        talkGroups: [tg1234, twin],
        digitalContacts: [],
      }),
      true,
    );
    const entries = p.organisation.nxdnLists!.entries;
    expect(entries.map((e) => e.nxdnId)).toEqual([1234]);
    expect(text(p)).toMatch(/1 NXDN talk group\(s\) or contact\(s\) repeat an ID/);
    const byName = new Map(p.channels.map((c) => [c.wireName, c]));
    expect(byName.get('twin-ch')!.nxdn!.txTargetIndex).toBe(0);
  });

  it('the stock and the NXDN-off projections are identical to the base for a DMR-only build', () => {
    const dmrLib = libraryOf({
      channels: [dmrCh],
      talkGroups: [tgDmr],
      digitalContacts: [bob],
      rxGroupLists: [dmrOnlyList],
    });
    const off = project('radio-io-at-d890uv-mm9pdy', dmrLib, false);
    const on = project('radio-io-at-d890uv-mm9pdy', dmrLib, true);
    expect(on.channels).toEqual(off.channels);
    expect({ ...on.organisation }).toEqual({ ...off.organisation });
    expect(on.warnings).toEqual(off.warnings);
  });
});

describe('DMR and NXDN entities that share a name (stock target wire names)', () => {
  // The DMR bank is the only bank written for DMR entities, so a name shared with an NXDN
  // talk group or contact is not a clash there. Before #1454 the DMR entity got "NX TG 2".
  const nxTg = { ...newTalkGroup(PROJECT, 'NX TG', 1234, 'nxdn'), id: 'tg-nx-clash' };
  const dmrTgSame = { ...newTalkGroup(PROJECT, 'NX TG', 92, 'dmr'), id: 'tg-dmr-clash' };
  const nxContact = { ...newDigitalContact(PROJECT, 'Same Op', 5678, 'nxdn'), id: 'dc-nx-clash' };
  const dmrContactSame = {
    ...newDigitalContact(PROJECT, 'Same Op', 2345, 'dmr'),
    id: 'dc-dmr-clash',
  };
  const lib = libraryOf({
    channels: [dmrCh],
    talkGroups: [nxTg, dmrTgSame],
    digitalContacts: [nxContact, dmrContactSame],
    rxGroupLists: [dmrOnlyList],
  });

  for (const profileId of ['radio-io-at-d890uv', 'radio-io-at-d890uv-mm9pdy'] as const) {
    it(`keeps the plain DMR name and raises no rename warning (${profileId})`, () => {
      const p = project(profileId, lib, true);
      // The AT-D890 DMR bank holds the DMR talk groups and the DMR contacts.
      expect(p.organisation.talkGroups!.map((t) => t.wireName).sort()).toEqual([
        'NX TG',
        'Same Op',
      ]);
      expect(text(p)).not.toMatch(/NX TG 2|Same Op 2/);
    });
  }
});

describe('assembledHasNxdnContent', () => {
  it('is true for NXDN talk groups or contacts even with no NXDN channel', () => {
    const { build, egress } = newRadioBuildForProfile(PROJECT, 'radio-io-at-d890uv-mm9pdy');
    const lib = libraryOf({ channels: [dmrCh] });
    const assembled = assemble(build, lib, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    expect(assembledHasNxdnContent(assembled)).toBe(true);
    const dmrOnly = libraryOf({ channels: [dmrCh], talkGroups: [tgDmr], digitalContacts: [bob] });
    expect(
      assembledHasNxdnContent(
        assemble(build, dmrOnly, { formatId: egress.formatId, profileId: egress.profileId }),
      ),
    ).toBe(false);
  });
});

describe('MM9PDY zeroes the NXDN bytes of channels written without NXDN fields', () => {
  const library = libraryOf({});
  it('flags DMR channels, and every channel when the radio does not report NXDN enabled', () => {
    const on = project('radio-io-at-d890uv-mm9pdy', library, true);
    expect(on.channels.find((c) => c.wireName === 'dmr-ch')!.clearNxdnBytes).toBe(true);
    expect(on.channels.find((c) => c.wireName === 'call-tg')!.clearNxdnBytes).toBeUndefined();
    for (const flag of [false, undefined]) {
      const off = project('radio-io-at-d890uv-mm9pdy', library, flag);
      expect(off.channels.every((c) => c.empty || c.clearNxdnBytes === true)).toBe(true);
    }
  });

  it('the stock target never sets it', () => {
    const stock = project('radio-io-at-d890uv', library, true);
    expect(stock.channels.some((c) => c.clearNxdnBytes !== undefined)).toBe(false);
  });
});
