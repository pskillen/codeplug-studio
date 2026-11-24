import { describe, expect, it } from 'vitest';
import {
  DM32UV_RADIOFOUNDRY_BOARD,
  DM32UV_RADIOFOUNDRY_LIMITS,
} from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import {
  emptyLibrary,
  newAprsConfiguration,
  newChannel,
  newDigitalContact,
  newOwnDigitalId,
  newRadioBuildWithEgresses,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel, OwnDigitalId, TalkGroup } from '@core/models/library.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { exportBuildBinary, exportBuildZip } from '@core/services/exportBuild.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import {
  APRS_BASE,
  APRS_COMMENT_LEN,
  APRS_COMMENT_OFFSET,
  APRS_MAGIC_OFFSET,
  APRS_NAME_LEN,
  APRS_PATH1_OFFSET,
  APRS_RECORD_COUNT,
  APRS_RECORD_SIZE,
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
  RX_LIST_BASE,
  RX_LIST_LENGTH,
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
  channelSlotAddress,
} from './layout.ts';
import { parseRadioFoundryCodeplug } from './parse.ts';
import {
  RADIOFOUNDRY_PROFILES,
  resolveRadioFoundryProfile,
  type RadioFoundryRadioProfile,
} from './profiles.ts';
import { modeExportNameSuffix } from '@core/import-export/channelExpansion/multiMode.ts';
import {
  serialiseRadioFoundryCodeplug,
  serialiseRadioFoundryCodeplugWithProfile,
  radioFoundryPowerByte,
} from './serialise.ts';
import { ZONE_BITMAP, ZONE_BITMAP_SIZE, ZONE_RECORD_SIZE } from './layout.ts';

const LIMITS = DM32UV_RADIOFOUNDRY_LIMITS;

function fmDmrChannel(name: string): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    primaryMode: 'dmr',
    modeProfiles: [
      {
        mode: 'fm',
        squelch: null,
        rxTone: 'none',
        txTone: 'none',
        bandwidthKHz: 12.5,
      },
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
  return { entity, wireName: name };
}

function fmChannel(name: string, power: number | null = null): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    power,
    modeProfiles: [
      {
        mode: 'fm',
        squelch: null,
        rxTone: 'none',
        txTone: 'none',
        bandwidthKHz: 12.5,
      },
    ],
  };
  return { entity, wireName: name };
}

function ownId(number = 2_351_234, name = 'MM9PDY'): OwnDigitalId {
  return { ...newOwnDigitalId('p', 'dmr', name, number), isDefault: true };
}

function assembled(overrides: Partial<AssembledBuild> = {}): AssembledBuild {
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'DM-32',
    channels: [fmChannel('Local')],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [ownId()],
    ...overrides,
  };
}

function fieldText(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const stop = offset + length;
  while (end < stop && bytes[end] !== 0xff && bytes[end] !== 0x00) end += 1;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

function includesAscii(image: Uint8Array, text: string): boolean {
  const needle = new TextEncoder().encode(text);
  outer: for (let i = 0; i <= image.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (image[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function zoneMemberNumbers(bytes: Uint8Array, zoneIndex: number): number[] {
  const offset = ZONE_BITMAP + ZONE_BITMAP_SIZE + zoneIndex * ZONE_RECORD_SIZE;
  const members: number[] = [];
  for (let i = 0; i < 80; i += 1) {
    const at = offset + 16 + i * 2;
    const lo = bytes[at];
    const hi = bytes[at + 1];
    if (lo === 0 && hi === 0) break;
    members.push(lo! | (hi! << 8));
  }
  return members;
}

describe('RadioFoundry multi-mode channel export', () => {
  it('writes one record per FM and DMR mode with suffixes and mode bytes', () => {
    const channel = fmDmrChannel('Repeater');
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    const fmName = `Repeater${modeExportNameSuffix('fm')}`;
    const dmrName = `Repeater${modeExportNameSuffix('dmr')}`;
    expect(fieldText(bytes, channelSlotAddress(1).record, LIMITS.NAME_MAX)).toBe(fmName);
    expect(fieldText(bytes, channelSlotAddress(2).record, LIMITS.NAME_MAX)).toBe(dmrName);
    expect(bytes[channelSlotAddress(1).record + 0x18]).toBe(0);
    expect(bytes[channelSlotAddress(2).record + 0x18]).toBe(1);
    expect(warnings.map(formatExportWarning).join('\n')).not.toMatch(/more than one mode/);
  });

  it('lists both channel numbers in a zone, in mode order', () => {
    const channel = fmDmrChannel('Repeater');
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [channel],
        zones: [{ zoneId: 'z', wireName: 'Home', memberChannelIds: [channel.entity.id] }],
      }),
    );
    expect(zoneMemberNumbers(bytes, 0)).toEqual([1, 2]);
  });

  it('writes a single-mode channel without a suffix', () => {
    const channel = fmChannel('Local');
    const { bytes } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    expect(fieldText(bytes, channelSlotAddress(1).record, LIMITS.NAME_MAX)).toBe('Local');
    expect(bytes[0x3780]! & 0x01).toBe(0x01);
    expect(bytes[0x3780]! & 0x02).toBe(0);
  });

  it('keeps one record and warns when expandModes is false', () => {
    const channel = fmDmrChannel('Repeater');
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }), {
      expandModes: false,
    });
    expect(fieldText(bytes, channelSlotAddress(1).record, LIMITS.NAME_MAX)).toBe('Repeater');
    expect(bytes[0x3780]! & 0x02).toBe(0);
    expect(warnings.map(formatExportWarning).join('\n')).toMatch(/more than one mode/);
  });

  it('drops non-storable modes and still exports FM and DMR copies', () => {
    const channel = fmDmrChannel('Site');
    channel.entity.modeProfiles.push({
      mode: 'dstar',
      urCall: 'CQCQCQ',
      rpt1Call: '',
      rpt2Call: '',
    });
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    expect(fieldText(bytes, channelSlotAddress(1).record, LIMITS.NAME_MAX)).toBe(
      `Site${modeExportNameSuffix('fm')}`,
    );
    expect(fieldText(bytes, channelSlotAddress(2).record, LIMITS.NAME_MAX)).toBe(
      `Site${modeExportNameSuffix('dmr')}`,
    );
    expect(warnings.map(formatExportWarning).join('\n')).toMatch(/mode dstar was dropped/);
  });

  it('counts mode copies toward the channel cap', () => {
    const dualCount = Math.floor(LIMITS.CHANNEL_MAX / 2) + 1;
    const channels = Array.from({ length: dualCount }, (_, i) => fmDmrChannel(`C${i}`));
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(assembled({ channels }));
    const dropped = dualCount * 2 - LIMITS.CHANNEL_MAX;
    expect(warnings.map(formatExportWarning).join('\n')).toContain(String(LIMITS.CHANNEL_MAX));
    expect(warnings.map(formatExportWarning).join('\n')).toMatch(
      new RegExp(`Dropped ${dropped} channel`),
    );
    const lastKeptIndex = Math.floor(LIMITS.CHANNEL_MAX / 2) - 1;
    expect(includesAscii(bytes, `C${lastKeptIndex}${modeExportNameSuffix('dmr')}`)).toBe(true);
    expect(includesAscii(bytes, `C${dualCount - 1}${modeExportNameSuffix('fm')}`)).toBe(false);
  });

  it('parse round-trips FM and DMR copies as two library channels', () => {
    const channel = fmDmrChannel('Repeater');
    const { bytes } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    const parsed = parseRadioFoundryCodeplug(bytes, 'p');
    expect(parsed.channels).toHaveLength(2);
  });
});

describe('serialiseRadioFoundryCodeplug', () => {
  it('writes a 716384-byte image with a channel, a contact, and a zero-filled zone list', () => {
    const channel = fmChannel('Local');
    const talkGroup: TalkGroup = newTalkGroup('p', 'Town', 9);
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [channel],
        talkGroups: [{ entity: talkGroup, wireName: talkGroup.name }],
        zones: [
          {
            zoneId: 'z',
            wireName: 'Home',
            memberChannelIds: [channel.entity.id],
          },
        ],
      }),
    );

    expect(bytes.length).toBe(716384);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[0x3780]! & 0x01).toBe(0x01);
    expect(bytes[0x3790]).toBe('L'.charCodeAt(0));
    expect(bytes[0x3790 + 'Local'.length]).toBe(0xff);
    expect(bytes[0x3790 + 0x27]).toBe(0x00);
    expect(bytes[0x3790 + 0x28]).toBe(0x16);
    expect(bytes[0x3790 + 0x29]).toBe(0x00);
    expect(bytes[0xa7620 + 0x17]).toBe(0x00);
    expect(fieldText(bytes, 0xa7620, LIMITS.NAME_MAX)).toBe('Town TS1');
    expect(bytes[0x8040]).toBe(0x01);
    expect(bytes[0x8041]).toBe(0x00);
    expect(bytes[0x806f]).toBe(0x00);
    expect(bytes[0x806f]).not.toBe(0xff);
    expect(bytes[0x00e8]).toBe(0x02);
    expect(bytes[0x00e9]).toBe(0x35);
    expect(bytes[0x00ea]).toBe(0x12);
    expect(bytes[0x00eb]).toBe(0x34);
  });

  it('leaves the settings area 0xFF and unowned, and says the radio keeps its own', () => {
    const written = serialiseRadioFoundryCodeplug(assembled({ channels: [fmChannel('Calling')] }));
    const end = SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE;
    expect(written.bytes.subarray(SETTINGS_AREA_ADDRESS, end).every((b) => b === 0xff)).toBe(true);
    expect(written.owned.subarray(SETTINGS_AREA_ADDRESS, end).every((b) => b === 0)).toBe(true);
    const info = written.warnings.filter((w) => w.severity === 'info');
    expect(info).toHaveLength(1);
    expect(info[0]).toMatchObject({ kind: 'general' });
    expect(JSON.stringify(info[0])).toContain('settings area');
  });

  it('owns the records it stores and leaves 0xFF holes unowned', () => {
    const { bytes, owned } = serialiseRadioFoundryCodeplug(
      assembled({ channels: [fmChannel('Local')] }),
    );
    expect(owned.length).toBe(bytes.length);
    expect(owned[0]).toBe(0);
    expect(bytes[0]).toBe(0xff);
    expect(owned[0x00e0]).toBe(1);
    expect(owned[0x3780]).toBe(1);
    expect(owned[0x3790]).toBe(1);
    expect(owned[0x3790 + 0x20]).toBe(1);
    expect(bytes[0x3790 + 0x20]).toBe(0xff);
    expect(owned[0x15000]).toBe(0);
    expect(bytes[0x15000]).toBe(0xff);
    expect(owned[0x00ec]).toBe(0);
    const secondChannel = channelSlotAddress(2);
    expect(owned[secondChannel.record]).toBe(0);
    expect(owned[0x8010]).toBe(1);
    expect(bytes[0x8010]).toBe(0);
    expect(owned[0x80e0]).toBe(1);
    expect(bytes[0x80e0]).toBe(0);
    expect(owned[RX_LIST_LENGTH]).toBe(1);
    expect(bytes[RX_LIST_LENGTH]).toBe(0);
    expect(owned[RX_LIST_BASE]).toBe(0);
  });

  it('writes FM CTCSS and DCS, and drops a tone the radio would ignore', () => {
    const channel = fmChannel('Local');
    const profile = channel.entity.modeProfiles[0];
    if (profile?.mode !== 'fm') throw new Error('expected an FM profile');
    profile.rxTone = '88.5';
    profile.txTone = 'D023N';
    const written = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    const record = channelSlotAddress(1).record;
    expect([written.bytes[record + 0x20], written.bytes[record + 0x21]]).toEqual([0x85, 0x08]);
    expect([written.bytes[record + 0x22], written.bytes[record + 0x23]]).toEqual([0x23, 0x80]);
    expect(written.warnings.filter((w) => w.severity === 'problem')).toEqual([]);

    profile.rxTone = 'D023I';
    profile.txTone = '12.5';
    const dropped = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    expect([dropped.bytes[record + 0x20], dropped.bytes[record + 0x21]]).toEqual([0x23, 0xc0]);
    expect([dropped.bytes[record + 0x22], dropped.bytes[record + 0x23]]).toEqual([0xff, 0xff]);
    expect(dropped.warnings.map(formatExportWarning).join('\n')).toMatch(/TX tone 12.5/);

    profile.txTone = 'D023P';
    const positive = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    expect([positive.bytes[record + 0x22], positive.bytes[record + 0x23]]).toEqual([0x23, 0xc0]);
  });

  it('writes receive-only, scan skip, and a fixed location, and owns the timeout and SFR bytes', () => {
    const channel = fmChannel('Local');
    channel.entity.forbidTransmit = 'forbid';
    channel.entity.scanInclusion = 'skip';
    channel.entity.useLocation = true;
    channel.entity.location = { lat: 55.95, lon: -3.2 };
    const { bytes, owned } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    const record = channelSlotAddress(1).record;
    expect(bytes[record + 0x33]! & 0x04).toBe(0x04);
    expect(bytes[record + 0x33]! & 0x30).toBe(0x30);
    expect(bytes[record + 0x33]! & 0xc9).toBe(0);
    expect(bytes[record + 0x26]! & 0x08).toBe(0x08);
    expect(bytes[record + 0x26]! & 0x73).toBe(0);
    expect([bytes[record + 0x1a], bytes[record + 0x1c], bytes[record + 0x1d]]).toEqual([
      0x1c, 0xa5, 0x1b,
    ]);
    expect([bytes[record + 0x1e], bytes[record + 0x1f], bytes[record + 0x24]]).toEqual([
      0xd0, 0x87, 0x81,
    ]);
    expect(owned[record + 0x1b]).toBe(1);
    expect(bytes[record + 0x1b]).toBe(0);
    expect(owned[record + 0x25]).toBe(1);
    expect(bytes[record + 0x25]).toBe(0);
    expect(owned[record + 0x2a]).toBe(1);
    expect(bytes[record + 0x2a]).toBe(0);
    expect(bytes[record + 0x2d]).toBe(0);
    expect(bytes[record + 0x30]! & 0xf5).toBe(0);
    expect(bytes[record + 0x32]).toBe(0);
    expect(bytes[record + 0x34]).toBe(0);
    expect(bytes[record + 0x36]).toBe(0);
    for (let i = 0; i < 56; i += 1) expect(owned[record + i]).toBe(1);
  });

  it('owns every contact slot and writes the one after the last contact as empty', () => {
    const talkGroup = newTalkGroup('p', 'Town', 9);
    const { bytes, owned } = serialiseRadioFoundryCodeplug(
      assembled({ talkGroups: [{ entity: talkGroup, wireName: talkGroup.name }] }),
    );
    const next = CONTACT_BASE + CONTACT_RECORD_SIZE;
    const last = CONTACT_BASE + (LIMITS.CONTACTS_MAX - 1) * CONTACT_RECORD_SIZE;
    expect(owned[CONTACT_BASE]).toBe(1);
    expect(bytes[CONTACT_BASE]).toBe('T'.charCodeAt(0));
    for (const offset of [next, last]) {
      for (let i = 0; i < CONTACT_RECORD_SIZE; i += 1) {
        expect(owned[offset + i]).toBe(1);
        expect(bytes[offset + i]).toBe(0xff);
      }
    }
  });

  it('owns eight empty APRS records when the library has no configuration', () => {
    const { bytes, owned } = serialiseRadioFoundryCodeplug(assembled());
    const span = APRS_RECORD_COUNT * APRS_RECORD_SIZE;
    for (let i = 0; i < span; i += 1) {
      expect(owned[APRS_BASE + i]).toBe(1);
      expect(bytes[APRS_BASE + i]).toBe(0xff);
    }
    expect(owned[APRS_BASE - 1]).toBe(0);
    expect(owned[APRS_BASE + span]).toBe(0);
  });

  it('writes the library APRS name and comment into record 1', () => {
    const config = {
      ...newAprsConfiguration('p', 'Home'),
      comment: 'On the hill',
      manualTxIntervalSec: 60,
      autoTxIntervalSec: 600,
      positionSource: 'fixed' as const,
      fixedLocation: { lat: 55.95, lon: -3.2 },
      channelSlots: [
        {
          channelRef: null,
          timeslot: 1 as const,
          targetDmrId: 5057,
          callType: 'group' as const,
        },
      ],
    };
    const { bytes, owned, warnings } = serialiseRadioFoundryCodeplug(
      assembled({ aprsConfiguration: config }),
    );
    expect(fieldText(bytes, APRS_BASE, APRS_NAME_LEN)).toBe('Home');
    expect(bytes[APRS_BASE + 'Home'.length]).toBe(0xff);
    expect(bytes[APRS_BASE + 0x08]).toBe(0);
    expect(bytes[APRS_BASE + 0x09]).toBe(0);
    expect(bytes[APRS_BASE + 0x0c]).toBe(0);
    expect([
      ...bytes.subarray(APRS_BASE + APRS_PATH1_OFFSET, APRS_BASE + APRS_PATH1_OFFSET + 7),
    ]).toEqual(['X'.charCodeAt(0), 0x20, 0x20, 0x20, 0x20, 0x20, 0]);
    expect([...bytes.subarray(APRS_BASE + 0x16, APRS_BASE + 0x1d)]).toEqual([
      0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0,
    ]);
    expect(bytes[APRS_BASE + 0x1d]).toBe(0);
    expect(bytes[APRS_BASE + 0x1e]).toBe(0);
    expect(fieldText(bytes, APRS_BASE + APRS_COMMENT_OFFSET, APRS_COMMENT_LEN)).toBe('On the hill');
    expect(bytes[APRS_BASE + APRS_COMMENT_OFFSET + 'On the hill'.length]).toBe(0xff);
    expect(bytes[APRS_BASE + 0x37]).toBe(0);
    expect(bytes[APRS_BASE + APRS_MAGIC_OFFSET]).toBe(0x53);
    expect(bytes[APRS_BASE + APRS_MAGIC_OFFSET + 1]).toBe(0x41);
    for (let n = 1; n < APRS_RECORD_COUNT; n += 1) {
      for (let i = 0; i < APRS_RECORD_SIZE; i += 1) {
        const at = APRS_BASE + n * APRS_RECORD_SIZE + i;
        expect(owned[at]).toBe(1);
        expect(bytes[at]).toBe(0xff);
      }
    }
    expect(warnings.filter((w) => w.severity === 'problem')).toEqual([]);
  });

  it('uses APRS for an empty configuration name and shortens a long comment', () => {
    const comment = 'C'.repeat(APRS_COMMENT_LEN + 1);
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(
      assembled({
        aprsConfiguration: { ...newAprsConfiguration('p', ''), comment },
      }),
    );
    expect(fieldText(bytes, APRS_BASE, APRS_NAME_LEN)).toBe('APRS');
    expect(bytes[APRS_BASE]).not.toBe(0x00);
    expect(bytes[APRS_BASE]).not.toBe(0xff);
    expect(fieldText(bytes, APRS_BASE + APRS_COMMENT_OFFSET, APRS_COMMENT_LEN)).toBe(
      'C'.repeat(APRS_COMMENT_LEN),
    );
    const warning = warnings.find((item) => item.kind === 'wire_name');
    expect(warning).toMatchObject({
      remediation: 'shortened',
      entityKind: 'APRS comment',
      limit: APRS_COMMENT_LEN,
    });
  });

  it('leaves channel byte 0x2D at 0 when the channel has an APRS report slot', () => {
    const channel = fmChannel('Local');
    channel.entity.aprs = {
      receiveEnabled: true,
      reportType: 'digital',
      digitalPttMode: 'on',
      reportSlotIndex: 3,
    };
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [channel],
        aprsConfiguration: { ...newAprsConfiguration('p', 'Home'), comment: 'On the hill' },
      }),
    );
    expect(bytes[channelSlotAddress(1).record + 0x2d]).toBe(0);
  });

  it('writes direct mode and the talker-alias text bit for the channel timeslot', () => {
    const channel = fmChannel('Local');
    channel.entity.primaryMode = 'dmr';
    channel.entity.rxFrequency = 438_500_000;
    channel.entity.txFrequency = 438_500_000;
    channel.entity.modeProfiles = [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
        dmrMode: 'dmo-simplex',
        sendTalkerAlias: 'on',
      },
    ];
    const { bytes } = serialiseRadioFoundryCodeplug(assembled({ channels: [channel] }));
    const record = channelSlotAddress(1).record;
    expect(bytes[record + 0x26]! & 0x04).toBe(0x04);
    expect(bytes[record + 0x30]! & 0x08).toBe(0x08);
    expect(bytes[record + 0x31]! & 0x40).toBe(0x40);
  });

  it('truncates a 17th name character and warns', () => {
    const name = 'ABCDEFGHIJKLMNOPQ';
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(
      assembled({ channels: [fmChannel(name)] }),
    );
    const warning = warnings.find((item) => item.kind === 'wire_name');
    expect(warning).toBeDefined();
    expect(formatExportWarning(warning!)).toContain(String(LIMITS.NAME_MAX));
    expect(bytes[0x3790 + 15]).toBe('P'.charCodeAt(0));
    expect(bytes[0x3790 + 16]).not.toBe('Q'.charCodeAt(0));
  });

  it('drops a scan list with a warning and does not add a channel', () => {
    const channel = fmChannel('Only');
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [channel],
        scanLists: [
          {
            scanListId: 's',
            wireName: 'Evening',
            memberChannelIds: [channel.entity.id],
          },
        ],
      }),
    );
    expect(warnings.map(formatExportWarning).join('\n')).toMatch(/Scan list "Evening"/);
    expect(bytes[0x3780]).toBe(0x01);
    for (let i = 1; i < 16; i++) expect(bytes[0x3780 + i]).toBe(0);
    expect(includesAscii(bytes, 'Only')).toBe(true);
    expect(includesAscii(bytes, 'Evening')).toBe(false);
  });

  it('drops the channel past the channel cap and warns', () => {
    const channels = Array.from({ length: LIMITS.CHANNEL_MAX + 1 }, (_, index) =>
      fmChannel(`C${String(index + 1).padStart(4, '0')}`),
    );
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(assembled({ channels }));
    expect(warnings.map(formatExportWarning).join('\n')).toContain(String(LIMITS.CHANNEL_MAX));
    expect(includesAscii(bytes, 'C1024')).toBe(true);
    expect(includesAscii(bytes, 'C1025')).toBe(false);
    expect(bytes.length).toBe(716384);
  });

  it('fails when the default radio ID is missing', () => {
    expect(() => serialiseRadioFoundryCodeplug(assembled({ ownDigitalIds: [] }))).toThrow(
      /default DMR radio ID/,
    );
    expect(() =>
      serialiseRadioFoundryCodeplug(
        assembled({ ownDigitalIds: [{ ...ownId(LIMITS.DMR_ID_MAX + 1), isDefault: true }] }),
      ),
    ).toThrow(String(LIMITS.DMR_ID_MAX));
  });

  it('maps power percent onto the nine levels', () => {
    expect(radioFoundryPowerByte(null, DM32UV_RADIOFOUNDRY_BOARD.POWER_LEVELS)).toBe(0);
    expect(radioFoundryPowerByte(1, DM32UV_RADIOFOUNDRY_BOARD.POWER_LEVELS)).toBe(1);
    expect(radioFoundryPowerByte(100, DM32UV_RADIOFOUNDRY_BOARD.POWER_LEVELS)).toBe(
      LIMITS.POWER_LEVELS,
    );
  });

  it('downloads through the binary export path and refuses a zip', () => {
    const { build, egressPaths } = newRadioBuildWithEgresses('p', 'baofeng-dm32uv-radiofoundry');
    const egress = egressPaths[0]!;
    expect(egress.formatId).toBe('radiofoundry');
    expect(egress.kind).toBe('cps-file');
    expect(egress.profileId).toBe('radiofoundry-dm32uv');
    const channel = fmChannel('Local').entity;
    const library = {
      ...emptyLibrary(),
      channels: [channel],
      ownDigitalIds: [ownId()],
    };
    const result = exportBuildBinary({ build, egress, library });
    expect(result.fileName).toBe('codeplug.bin');
    expect(result.bytes.length).toBe(716384);
    expect(result.bytes[0]).toBe(0xff);
    expect(() => exportBuildZip({ build, egress, library })).toThrow(/codeplug\.bin/);
  });
});

describe('RadioFoundry codec follows the radio profile', () => {
  const sample = () =>
    assembled({
      channels: [fmChannel('Local', 50), fmChannel('Top', 100)],
    });

  it('writes the same bytes for the codec id, the radio-io id and no id', () => {
    const named = serialiseRadioFoundryCodeplug(sample(), { profileId: 'radiofoundry-dm32uv' });
    const cable = serialiseRadioFoundryCodeplug(sample(), {
      profileId: 'radio-io-dm32uv-radiofoundry',
    });
    const unset = serialiseRadioFoundryCodeplug({ ...sample(), profileId: '' });
    expect(Buffer.from(cable.bytes).equals(Buffer.from(named.bytes))).toBe(true);
    expect(Buffer.from(cable.owned).equals(Buffer.from(named.owned))).toBe(true);
    expect(Buffer.from(unset.bytes).equals(Buffer.from(named.bytes))).toBe(true);
    expect(Buffer.from(unset.owned).equals(Buffer.from(named.owned))).toBe(true);
  });

  it('refuses an unknown profile id', () => {
    expect(() => serialiseRadioFoundryCodeplug(sample(), { profileId: 'radio-io-dm32uv' })).toThrow(
      /does not know the radio profile/,
    );
  });

  const synthetic: RadioFoundryRadioProfile = {
    ...RADIOFOUNDRY_PROFILES[0]!,
    id: 'radiofoundry-test-board',
    board: {
      ...DM32UV_RADIOFOUNDRY_BOARD,
      POWER_LEVELS: 3,
      BANDS_HZ: [{ minHz: 144_000_000, maxHz: 146_000_000 }],
    },
  };

  it('uses the profile power steps and bands', () => {
    const wideChannel = fmChannel('Far', 1);
    wideChannel.entity.rxFrequency = 435_000_000;
    wideChannel.entity.txFrequency = 435_000_000;
    const { bytes, warnings } = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: [fmChannel('Top', 100), wideChannel] }),
      synthetic,
    );
    // Three levels spread over the ten byte steps: bottom 1, top 10.
    expect(bytes[channelSlotAddress(1).record + 0x19]).toBe(10);
    expect(bytes[channelSlotAddress(2).record + 0x19]).toBe(1);
    expect(warnings.map(formatExportWarning).join('\n')).toContain('outside 144-146 MHz');
  });

  it('spreads five levels over the power byte and reads each back', () => {
    const fiveLevel: RadioFoundryRadioProfile = {
      ...synthetic,
      id: 'radiofoundry-test-five',
      board: { ...synthetic.board, POWER_LEVELS: 5 },
    };
    const percents = [1, 21, 41, 61, 100];
    const { bytes } = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: percents.map((p, i) => fmChannel(`P${i}`, p)) }),
      fiveLevel,
    );
    const written = percents.map((_, i) => bytes[channelSlotAddress(i + 1).record + 0x19]);
    expect(written).toEqual([1, 3, 6, 8, 10]);
    const parsed = parseRadioFoundryCodeplug(bytes, '', fiveLevel);
    expect(parsed.channels.map((c) => c.power)).toEqual(percents);
  });

  it('keeps the old nine-level bytes for every percent', () => {
    for (let percent = 1; percent <= 100; percent++) {
      const old = Math.min(8, Math.floor(((percent - 1) * 9) / 100)) + 1;
      expect(radioFoundryPowerByte(percent, 9)).toBe(old);
    }
  });

  it('reads the profile power steps back on parse', () => {
    const { bytes } = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: [fmChannel('Top', 100)] }),
      synthetic,
    );
    expect(parseRadioFoundryCodeplug(bytes, '', synthetic).channels[0]?.power).toBe(100);
  });

  it('parses the same rows for the radio-io id as for no profile', () => {
    const { bytes } = serialiseRadioFoundryCodeplug(sample());
    const plain = parseRadioFoundryCodeplug(bytes, 'p');
    const cable = parseRadioFoundryCodeplug(bytes, 'p', 'radio-io-dm32uv-radiofoundry');
    const strip = (r: typeof plain) =>
      JSON.stringify(r, (key, value) =>
        key === 'id' || key === 'updatedAt' || key.endsWith('Id') ? undefined : value,
      );
    expect(strip(cable)).toBe(strip(plain));
  });

  it('writes talk-group timeslot clones with 0x17 overrides on contacts', () => {
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
    const { bytes, warnings } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [{ entity: channel, wireName: channel.name }],
        talkGroups: [{ entity: tg, wireName: tg.name }],
        rxGroupLists: [{ entity: rgl, wireName: rgl.name }],
      }),
    );
    const ts1Offset = CONTACT_BASE;
    const ts2Offset = CONTACT_BASE + CONTACT_RECORD_SIZE;
    expect(fieldText(bytes, ts1Offset, LIMITS.NAME_MAX)).toBe('X TS1');
    expect(fieldText(bytes, ts2Offset, LIMITS.NAME_MAX)).toBe('X TS2');
    expect(bytes[ts1Offset + 0x17]).toBe(0x00);
    expect(bytes[ts2Offset + 0x17]).toBe(0x02);
    const record = channelSlotAddress(1).record;
    expect(bytes[record + 0x2e]).toBe(2);
    expect(bytes[record + 0x31]).toBe(0x40);
    const rxOffset = RX_LIST_BASE;
    expect(bytes[rxOffset + LIMITS.NAME_MAX]).toBe(1);
    expect(bytes[rxOffset + LIMITS.NAME_MAX + 1]).toBe(0);
    expect(
      warnings
        .map(formatExportWarning)
        .some((w) => w.includes('member timeslot overrides were not written')),
    ).toBe(false);
  });

  it('writes a single TS1 clone for an unreferenced talk group', () => {
    const tg = newTalkGroup('p', 'Lonely', 99);
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({ talkGroups: [{ entity: tg, wireName: tg.name }] }),
    );
    expect(fieldText(bytes, CONTACT_BASE, LIMITS.NAME_MAX)).toBe('Lonely TS1');
    expect(bytes[CONTACT_BASE + CONTACT_RECORD_SIZE]).toBe(0xff);
  });

  it('keeps 0x17 at no override for private contacts', () => {
    const tg = newTalkGroup('p', 'Town', 9);
    const priv = newDigitalContact('p', 'Alice', 1001, 'dmr');
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({
        talkGroups: [{ entity: tg, wireName: tg.name }],
        digitalContacts: [{ entity: priv, wireName: priv.name }],
      }),
    );
    const privOffset = CONTACT_BASE + CONTACT_RECORD_SIZE;
    expect(bytes[privOffset + 0x17]).toBe(0x01);
  });

  it('warns when clones and private contacts exceed the contact cap', () => {
    const talkGroups = Array.from({ length: 700 }, (_, i) => {
      const tg = newTalkGroup('p', `G${i}`, 100 + i);
      return { entity: tg, wireName: tg.name };
    });
    const channels = talkGroups.slice(0, 2).map((row, i) => {
      const dmr: ChannelModeProfileDMR = {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup', id: row.entity.id },
        rxGroupListId: null,
      };
      const entity: Channel = {
        ...newChannel('p', `Ch${i}`),
        primaryMode: 'dmr',
        rxFrequency: 430_125_000,
        txFrequency: 430_125_000,
        modeProfiles: [dmr],
      };
      return { entity, wireName: entity.name };
    });
    const digitalContacts = Array.from({ length: 325 }, (_, i) => {
      const entity = newDigitalContact('p', `C${i}`, 10_000 + i, 'dmr');
      return { entity, wireName: entity.name };
    });
    const { warnings } = serialiseRadioFoundryCodeplug(
      assembled({ channels, talkGroups, digitalContacts }),
    );
    expect(warnings.map(formatExportWarning).join('\n')).toMatch(
      /talk-group timeslot copies and private contacts share this table/,
    );
  });

  it('shortens long clone names to fit NAME_MAX and keeps them unique', () => {
    const tg = newTalkGroup('p', 'ABCDEFGHIJKLMNOP', 2355);
    const tg2 = newTalkGroup('p', 'BCDEFGHIJKLMNOPQ', 2356);
    const dmr: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      ownDigitalIdId: null,
      contactRef: { kind: 'talkGroup', id: tg.id },
      rxGroupListId: null,
    };
    const dmr2: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 1,
      ownDigitalIdId: null,
      contactRef: { kind: 'talkGroup', id: tg2.id },
      rxGroupListId: null,
    };
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [
          {
            entity: {
              ...newChannel('p', 'A'),
              primaryMode: 'dmr',
              rxFrequency: 430_125_000,
              txFrequency: 430_125_000,
              modeProfiles: [dmr],
            },
            wireName: 'A',
          },
          {
            entity: {
              ...newChannel('p', 'B'),
              primaryMode: 'dmr',
              rxFrequency: 430_125_000,
              txFrequency: 430_125_000,
              modeProfiles: [dmr2],
            },
            wireName: 'B',
          },
        ],
        talkGroups: [
          { entity: tg, wireName: tg.name },
          { entity: tg2, wireName: tg2.name },
        ],
      }),
    );
    const name1 = fieldText(bytes, CONTACT_BASE, LIMITS.NAME_MAX);
    const name2 = fieldText(bytes, CONTACT_BASE + CONTACT_RECORD_SIZE, LIMITS.NAME_MAX);
    expect(name1.length).toBeLessThanOrEqual(LIMITS.NAME_MAX);
    expect(name2.length).toBeLessThanOrEqual(LIMITS.NAME_MAX);
    expect(name1).toMatch(/ TS1$/);
    expect(name2).toMatch(/ TS1$/);
    expect(name1).not.toBe(name2);
  });
});

describe('DM-1701 RadioFoundry serialise', () => {
  const profile = resolveRadioFoundryProfile('radiofoundry-dm1701');

  it('maps power percent onto five levels and warns on band', () => {
    const { bytes } = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: [fmChannel('Top', 100), fmChannel('Mid', 50)] }),
      profile,
    );
    expect(bytes[channelSlotAddress(1).record + 0x19]).toBe(10);
    expect(bytes[channelSlotAddress(2).record + 0x19]).toBe(6);

    const inBand = fmChannel('Ok', 1);
    inBand.entity.rxFrequency = 446_000_000;
    inBand.entity.txFrequency = 446_000_000;
    const inBandResult = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: [inBand] }),
      profile,
    );
    expect(
      inBandResult.warnings.filter((w) => formatExportWarning(w).includes('MHz')),
    ).toHaveLength(0);

    const outOfBand = fmChannel('Far', 1);
    outOfBand.entity.rxFrequency = 485_000_000;
    outOfBand.entity.txFrequency = 485_000_000;
    const { warnings } = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: [outOfBand] }),
      profile,
    );
    expect(formatExportWarning(warnings[0]!)).toContain('136-174 and 400-480 MHz');

    const { bytes: topBytes } = serialiseRadioFoundryCodeplugWithProfile(
      assembled({ channels: [fmChannel('Top', 100)] }),
      profile,
    );
    expect(parseRadioFoundryCodeplug(topBytes, '', profile).channels[0]?.power).toBe(100);
  });
});
