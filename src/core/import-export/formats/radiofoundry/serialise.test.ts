import { describe, expect, it } from 'vitest';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import {
  emptyLibrary,
  newAprsConfiguration,
  newChannel,
  newOwnDigitalId,
  newRadioBuildWithEgresses,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel, OwnDigitalId, TalkGroup } from '@core/models/library.ts';
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
  channelSlotAddress,
} from './layout.ts';
import { serialiseRadioFoundryCodeplug, radioFoundryPowerByte } from './serialise.ts';

const LIMITS = DM32UV_RADIOFOUNDRY_LIMITS;

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
    expect(bytes[0xa7620 + 0x17]).toBe(0x01);
    expect(bytes[0x8040]).toBe(0x01);
    expect(bytes[0x8041]).toBe(0x00);
    expect(bytes[0x806f]).toBe(0x00);
    expect(bytes[0x806f]).not.toBe(0xff);
    expect(bytes[0x00e8]).toBe(0x02);
    expect(bytes[0x00e9]).toBe(0x35);
    expect(bytes[0x00ea]).toBe(0x12);
    expect(bytes[0x00eb]).toBe(0x34);
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
    expect(written.warnings).toEqual([]);

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
    expect(warnings).toEqual([]);
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
    expect(radioFoundryPowerByte(null)).toBe(0);
    expect(radioFoundryPowerByte(1)).toBe(1);
    expect(radioFoundryPowerByte(100)).toBe(LIMITS.POWER_LEVELS);
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
