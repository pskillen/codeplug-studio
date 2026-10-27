/**
 * Byte-identity contract for the own-ID work (#1444): a project saved before Digital IDs, with
 * per-channel DMR / NXDN numbers and no default ID, must export the same bytes after the change
 * for every target the change does not deliberately move.
 *
 * Every expectation below is a sha256 taken on the base (before any of #1444). They stay the same
 * through every later commit. `legacyLibrary()` is the one place that knows how the channels carry
 * their numbers; after the model change it routes the same literal through the migration.
 *
 * Not covered here on purpose: OpenGD77 Web Serial (it starts writing channel byte 0x27 for a
 * channel that chose an ID, owner decision D16) and native YAML (the schema moves).
 */
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newRadioBuildForProfile,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { migrateLegacyOwnIds } from '@core/domain/ownDigitalIds.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import type { NeonplugSerialiseOptions } from '@core/import-export/formats/neonplug/serialise.ts';
import { buildRadioWriteProjection } from '@app/services/radioIoWriteProjection.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import {
  AT_D890_LIMITS,
  AT_D890_MAP_SIZE,
  D890_MAP,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { encodeAtD890ChannelRecord } from '@integrations/radio-io/radios/at-d890uv/channelCodec.ts';
import { encodeAtD890ProjectionOntoImage } from '@integrations/radio-io/radios/at-d890uv/hydration.ts';
import { radioIdAddress } from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { encodeDm32ChannelRecord } from '@integrations/radio-io/radios/dm32uv/channelCodec.ts';
import { encodeDm32RadioIdBlock } from '@integrations/radio-io/radios/dm32uv/radioIdCodec.ts';

const PROJECT = 'p1';

function sha(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function filesHash(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).map(([name, text]) => [name, sha(text)]));
}

const TG_ID = 'tg-1';
const CONTACT_ID = 'contact-1';

/** A profile as saved before Digital IDs: the number sits on the profile. */
function dmr(dmrId: number | null): ChannelModeProfile {
  return {
    mode: 'dmr',
    dmrMode: null,
    colourCode: 1,
    timeslot: 1,
    dmrId,
    contactRef: { kind: 'talkGroup', id: TG_ID },
    rxGroupListId: null,
    sendTalkerAlias: 'default',
  } as unknown as ChannelModeProfile;
}

const FM: ChannelModeProfile = {
  mode: 'fm',
  rxTone: 'none',
  txTone: 'none',
  squelch: null,
  bandwidthKHz: 12.5,
  analogSquelchMode: 'default',
};

function nxdn(unitId: number | null): ChannelModeProfile {
  return {
    mode: 'nxdn',
    rxRan: 1,
    txRan: 1,
    unitId,
    contactRef: null,
    rxGroupListId: null,
    nxdnRate: 'nxdn96',
  } as unknown as ChannelModeProfile;
}

function channel(
  id: string,
  name: string,
  callsign: string,
  rxMhz: number,
  profiles: ChannelModeProfile[],
): Channel {
  return withExportEligibleDefaults(
    {
      ...newChannel(PROJECT, name, callsign),
      id,
      modeProfiles: profiles,
    },
    rxMhz,
  );
}

/**
 * A project as it was saved before Digital IDs: DMR 2351234 on two channels with different
 * callsigns, 2351235 on one more, no ID on another, an FM+DMR (MxN) channel, an NXDN channel
 * with unit ID 1234 and an analogue channel.
 */
function legacyLibrary(): LibrarySlice {
  const legacyChannels = [
    channel('ch-a', 'Chan A', 'N0CALL', 430.1, [dmr(2351234)]),
    channel('ch-b', 'Chan B', 'N0CALL2', 430.2, [dmr(2351234)]),
    channel('ch-c', 'Chan C', 'N0CALL3', 430.3, [dmr(2351235)]),
    channel('ch-d', 'Chan D', 'N0CALL4', 430.4, [dmr(null)]),
    channel('ch-e', 'Chan E', 'N0CALL5', 430.5, [FM, dmr(2351235)]),
    channel('ch-f', 'Chan F', 'N0CALL6', 430.6, [dmr(1), nxdn(1234)]),
    channel('ch-g', 'Chan G', 'N0CALL7', 145.5, [FM]),
  ];
  // The same literal, through the migration every older project goes through on load.
  const { channels, ownDigitalIds } = migrateLegacyOwnIds(PROJECT, legacyChannels, []);
  const zone = {
    ...newZone(PROJECT, 'Zone'),
    id: 'zone-1',
    members: channels.map((ch) => ({ kind: 'channel' as const, channelId: ch.id })),
  };
  const talkGroup = { ...newTalkGroup(PROJECT, 'Local', 9), id: TG_ID };
  const contact = { ...newDigitalContact(PROJECT, 'Friend', 2351299), id: CONTACT_ID };
  return {
    channels,
    zones: [zone],
    scanLists: [],
    talkGroups: [talkGroup],
    digitalContacts: [contact],
    ownDigitalIds,
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

function fileExport(profileId: string) {
  const library = legacyLibrary();
  const { build, egress } = newRadioBuildForProfile(PROJECT, profileId);
  return { build, egress, library };
}

function projection(profileId: string) {
  const { build, egress, library } = fileExport(profileId);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  return buildRadioWriteProjection(assembled, build, library, egress);
}

/** What the image holds before the Write: a radio with its own IDs set. */
function d890Regions(profileId: string) {
  const { channels, organisation } = projection(profileId);
  const image = createMemoryMap(AT_D890_MAP_SIZE);
  const set = new Uint8Array(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
  set[0] = 0x01;
  image.set(D890_MAP.RadioIdSet, set);
  const own = new Uint8Array(AT_D890_LIMITS.RADIO_ID_STRIDE);
  own.set([0x00, 0x99, 0x99, 0x99], 0);
  image.set(radioIdAddress(0), own);
  const master = new Uint8Array(D890_MAP.MasterIdLength);
  master.set([0x00, 0x88, 0x88, 0x88], 0);
  image.set(D890_MAP.MasterIdData, master);
  encodeAtD890ProjectionOntoImage(image, channels, organisation);
  const radioIdData = new Uint8Array(250 * AT_D890_LIMITS.RADIO_ID_STRIDE);
  for (let i = 0; i < 250; i++) {
    radioIdData.set(image.get(radioIdAddress(i), AT_D890_LIMITS.RADIO_ID_STRIDE), i * 0x40);
  }
  return {
    radioIdSet: sha(image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES)),
    radioIdData: sha(radioIdData),
    masterIdData: sha(image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength)),
    channel0x18: channels.map((ch) => (ch.empty ? null : encodeAtD890ChannelRecord(ch)[0x18])),
    radioIds: organisation.radioIds,
  };
}

function dm32Regions(profileId: string) {
  const { channels, organisation } = projection(profileId);
  return {
    channel0x2b: channels.map((ch) => (ch.empty ? null : encodeDm32ChannelRecord(ch)[0x2b])),
    radioIdBlock: sha(encodeDm32RadioIdBlock(organisation.radioIds ?? [])),
    radioIds: organisation.radioIds,
  };
}

describe('own-ID output of a project saved before Digital IDs', () => {
  let d890Stock: ReturnType<typeof d890Regions>;
  let d890Mm9pdy: ReturnType<typeof d890Regions>;

  beforeAll(() => {
    d890Stock = d890Regions('radio-io-at-d890uv');
    d890Mm9pdy = d890Regions('radio-io-at-d890uv-mm9pdy');
  });

  it('AT-D890 stock Write leaves the radio IDs and master ID as read', () => {
    expect(d890Stock).toMatchSnapshot();
  });

  it('AT-D890 MM9PDY Write leaves the radio IDs and master ID as read', () => {
    expect(d890Mm9pdy).toMatchSnapshot();
  });

  it('DM-32UV stock Write: radio-ID list and channel 0x2B', () => {
    expect(dm32Regions('radio-io-dm32uv')).toMatchSnapshot();
  });

  it('DM-32UV MM9PDY Write: radio-ID list and channel 0x2B', () => {
    expect(dm32Regions('radio-io-dm32uv-mm9pdy')).toMatchSnapshot();
  });

  it('OpenGD77 CSV files', () => {
    const { build, egress, library } = fileExport('opengd77-1701');
    expect(filesHash(exportBuildAll({ build, egress, library }).files)).toMatchSnapshot();
  });

  it('Anytone CSV files', () => {
    const { build, egress, library } = fileExport('anytone-at-d890uv');
    expect(filesHash(exportBuildAll({ build, egress, library }).files)).toMatchSnapshot();
  });

  it('DM-32 CSV files', () => {
    const { build, egress, library } = fileExport('dm32-baofeng-dm32uv');
    expect(filesHash(exportBuildAll({ build, egress, library }).files)).toMatchSnapshot();
  });

  it('NeonPlug files', () => {
    const { build, egress, library } = fileExport('neonplug-dm32uv');
    const options: NeonplugSerialiseOptions = { exportDate: '2026-01-01T00:00:00.000Z' };
    expect(filesHash(exportBuildAll({ build, egress, library, options }).files)).toMatchSnapshot();
  });
});
