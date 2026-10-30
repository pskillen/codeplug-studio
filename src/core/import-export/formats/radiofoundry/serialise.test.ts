import { describe, expect, it } from 'vitest';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import {
  emptyLibrary,
  newChannel,
  newOwnDigitalId,
  newRadioBuildWithEgresses,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel, OwnDigitalId, TalkGroup } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { exportBuildBinary, exportBuildZip } from '@core/services/exportBuild.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
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
