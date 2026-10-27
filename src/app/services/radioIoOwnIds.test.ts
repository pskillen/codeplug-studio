/**
 * Digital IDs on the Write path (#1444, #1445): the default DMR ID goes first in the radio-ID list,
 * channels on Default point at it, a channel that chose another ID points at its own slot, and
 * with no default the AT-D890 leaves its IDs alone (with a warning) and the DM-32UV keeps today's
 * list.
 */
import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, ChannelModeProfile, OwnDigitalId } from '@core/models/library.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { encodeAtD890ChannelRecord } from '@integrations/radio-io/radios/at-d890uv/channelCodec.ts';
import {
  AT_D890_LIMITS,
  AT_D890_MAP_SIZE,
  D890_MAP,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { encodeAtD890ProjectionOntoImage } from '@integrations/radio-io/radios/at-d890uv/hydration.ts';
import { radioIdAddress } from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { encodeChannelRecord as encodeOpenGd77Channel } from '@integrations/radio-io/radios/opengd77/channelCodec.ts';
import { encodeDm32ChannelRecord } from '@integrations/radio-io/radios/dm32uv/channelCodec.ts';
import { atD890WriteCoverageRows } from '@integrations/radio-io/radios/at-d890uv/writeCoverage.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';

const PROJECT = 'p1';

function ownId(id: string, number: number, over: Partial<OwnDigitalId> = {}): OwnDigitalId {
  return {
    id,
    projectId: PROJECT,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: '',
    protocol: 'dmr',
    number,
    isDefault: false,
    ...over,
  };
}

const HOME = ownId('own-home', 2351234, { name: 'Home', isDefault: true });
const CLUB = ownId('own-club', 2351235, { name: 'Club' });

function dmr(ownDigitalIdId: string | null): ChannelModeProfile {
  return {
    mode: 'dmr',
    colourCode: 1,
    timeslot: 1,
    ownDigitalIdId,
    contactRef: null,
    rxGroupListId: null,
  };
}

const FM: ChannelModeProfile = {
  mode: 'fm',
  rxTone: 'none',
  txTone: 'none',
  squelch: null,
  bandwidthKHz: 12.5,
  analogSquelchMode: 'default',
};

function channel(id: string, rxMhz: number, profiles: ChannelModeProfile[]): Channel {
  return withExportEligibleDefaults(
    { ...newChannel(PROJECT, id), id, modeProfiles: profiles },
    rxMhz,
  );
}

function libraryWith(ownDigitalIds: OwnDigitalId[]): LibrarySlice {
  const channels = [
    channel('on-default', 430.1, [dmr(null)]),
    channel('override', 430.2, [dmr('own-club')]),
    channel('analogue', 145.5, [FM]),
  ];
  return {
    channels,
    zones: [
      {
        ...newZone(PROJECT, 'Z'),
        id: 'zone-z',
        members: channels.map((ch) => ({ kind: 'channel' as const, channelId: ch.id })),
      },
    ],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
    ownDigitalIds,
  };
}

function project(profileId: string, library: LibrarySlice) {
  const { build, egress } = newRadioBuildForProfile(PROJECT, profileId);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  return buildRadioWriteProjection(assembled, build, library, egress);
}

function warningText(projection: ReturnType<typeof project>): string {
  return projection.warnings.map((w) => formatExportWarning(w)).join('\n');
}

describe.each(['radio-io-at-d890uv', 'radio-io-at-d890uv-mm9pdy'])('AT-D890 (%s)', (profileId) => {
  it('with a default: radio IDs are the default then the chosen IDs, channels point at them', () => {
    const projection = project(profileId, libraryWith([HOME, CLUB]));
    expect(projection.organisation.radioIds).toEqual([
      { index: 0, dmrId: 2351234, name: 'Home' },
      { index: 1, dmrId: 2351235, name: 'Club' },
    ]);
    const byName = new Map(projection.channels.map((ch) => [ch.wireName, ch.dmrRadioIdIndex]));
    expect(byName.get('on-default')).toBe(0);
    expect(byName.get('override')).toBe(1);
    const encoded = projection.channels.map((ch) => encodeAtD890ChannelRecord(ch)[0x18]);
    expect(encoded).toEqual(expect.arrayContaining([0, 1]));
  });

  it('with a default: the master ID is the default, as BCD', () => {
    const { channels, organisation } = project(profileId, libraryWith([HOME, CLUB]));
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    encodeAtD890ProjectionOntoImage(image, channels, organisation);
    expect([...image.get(D890_MAP.MasterIdData, 4)]).toEqual([0x02, 0x35, 0x12, 0x34]);
    expect([...image.get(radioIdAddress(1), 4)]).toEqual([0x02, 0x35, 0x12, 0x35]);
    const set = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    expect(set[0]).toBe(0b11);
  });

  it('an unnamed default is labelled by its number and keeps the radio master name', () => {
    const unnamed = ownId('own-plain', 2351236, { isDefault: true });
    const { channels, organisation } = project(profileId, libraryWith([unnamed]));
    expect(organisation.radioIds?.[0]).toMatchObject({ dmrId: 2351236, name: 'ID 2351236' });
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const prior = new Uint8Array(D890_MAP.MasterIdLength);
    prior.set([0x4d, 0x00, 0x79, 0x00], 4); // "My" in UTF-16LE
    image.set(D890_MAP.MasterIdData, prior);
    encodeAtD890ProjectionOntoImage(image, channels, organisation);
    const body = image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
    expect([...body.subarray(0, 4)]).toEqual([0x02, 0x35, 0x12, 0x36]);
    expect([...body.subarray(4, 8)]).toEqual([0x4d, 0x00, 0x79, 0x00]);
  });

  it('without a default: no radio IDs, every channel on 0, and one warning', () => {
    const projection = project(profileId, libraryWith([{ ...HOME, isDefault: false }, CLUB]));
    expect(projection.organisation.radioIds).toEqual([]);
    expect(projection.channels.every((ch) => (ch.dmrRadioIdIndex ?? 0) === 0)).toBe(true);
    expect(warningText(projection)).toContain('Radio IDs not written: set a default DMR ID');
  });

  it('without any Digital IDs: the same warning for a build with DMR channels', () => {
    expect(warningText(project(profileId, libraryWith([])))).toContain(
      'Radio IDs not written: set a default DMR ID',
    );
  });

  it('with a default there is no such warning', () => {
    expect(warningText(project(profileId, libraryWith([HOME, CLUB])))).not.toContain(
      'Radio IDs not written',
    );
  });
});

describe.each(['radio-io-dm32uv', 'radio-io-dm32uv-mm9pdy'])('DM-32UV (%s)', (profileId) => {
  it('with a default: it is entry 0 and no channel is left on 0xFF (#1445)', () => {
    const projection = project(profileId, libraryWith([HOME, CLUB]));
    expect(projection.organisation.radioIds).toEqual([
      { index: 0, dmrId: 2351234, name: 'Home' },
      { index: 1, dmrId: 2351235, name: 'Club' },
    ]);
    const bytes = projection.channels
      .filter((ch) => !ch.empty)
      .map((ch) => encodeDm32ChannelRecord(ch)[0x2b]);
    expect(bytes).toHaveLength(3);
    expect(bytes).not.toContain(0xff);
    const byName = new Map(
      projection.channels.map((ch) => [ch.wireName, encodeDm32ChannelRecord(ch)[0x2b]]),
    );
    expect(byName.get('on-default')).toBe(0);
    expect(byName.get('override')).toBe(1);
  });

  it('without the default the Default channel is still 0xFF, which is what the fix removes', () => {
    const projection = project(profileId, libraryWith([{ ...HOME, isDefault: false }, CLUB]));
    const byName = new Map(
      projection.channels.map((ch) => [ch.wireName, encodeDm32ChannelRecord(ch)[0x2b]]),
    );
    expect(byName.get('on-default')).toBe(0xff);
    // Only the chosen ID is listed, as before.
    expect(projection.organisation.radioIds).toEqual([{ index: 0, dmrId: 2351235, name: 'Club' }]);
  });
});

describe('OpenGD77 Web Serial per-channel DMR ID', () => {
  it('Default writes 0 at 0x27; a chosen ID writes its number big-endian with the override flag', () => {
    const projection = project('radio-io-opengd77-1701', libraryWith([HOME, CLUB]));
    const records = new Map(
      projection.channels.map((ch) => [ch.wireName, encodeOpenGd77Channel(ch)]),
    );
    const onDefault = records.get('on-default')!;
    expect([...onDefault.subarray(0x27, 0x2a)]).toEqual([0, 0, 0]);
    expect(onDefault[0x26]! & 0x80).toBe(0);
    const override = records.get('override')!;
    expect([...override.subarray(0x27, 0x2a)]).toEqual([0x23, 0xe0, 0x83]);
    expect(override[0x26]! & 0x80).toBe(0x80);
  });
});

describe('AT-D890 write coverage rows', () => {
  const label = (rows: ReturnType<typeof atD890WriteCoverageRows>, name: string) =>
    rows.find((row) => row.label === name)!;

  it('says radio IDs are written from Digital IDs when a default exists', () => {
    const rows = atD890WriteCoverageRows(false, 0, true);
    expect(label(rows, 'Operator radio IDs')).toMatchObject({
      status: 'written',
      note: 'From your Digital IDs',
    });
    expect(label(rows, 'Master radio ID')).toMatchObject({ status: 'written' });
  });

  it('says they are left alone when there is no default DMR ID', () => {
    const rows = atD890WriteCoverageRows(true, 0, false);
    expect(label(rows, 'Operator radio IDs')).toMatchObject({
      status: 'leftAlone',
      note: 'No default DMR ID',
    });
    expect(label(rows, 'Master radio ID')).toMatchObject({ status: 'leftAlone' });
  });
});
