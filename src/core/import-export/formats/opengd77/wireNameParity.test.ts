import { describe, expect, it } from 'vitest';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { Channel } from '@core/models/library.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import { assembledChannelsToRadioDtos } from '@app/services/radioIoChannelMap.ts';
import { CHANNEL_COL } from './columns.ts';
import { serialiseChannels } from './serialise.ts';

const OPENGD77_CSV_PROFILES = ['opengd77-1701', 'opengd77-md9600'] as const;
const OPENGD77_SERIAL_PROFILES = ['radio-io-opengd77-1701', 'radio-io-opengd77-md9600'] as const;

function channelNameFromCsv(csv: string): string {
  const rows = parseCsv(csv);
  const headers = rows[0]!;
  const nameIndex = headers.indexOf(CHANNEL_COL.name);
  return rows[1]?.[nameIndex] ?? '';
}

function fmChannel(partial: Partial<Channel> & Pick<Channel, 'name'>): Channel {
  return {
    ...newChannel('p1', partial.name),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'fm' as const,
        squelch: null,
        rxTone: 'none' as const,
        txTone: 'none' as const,
        bandwidthKHz: 12.5,
      },
    ],
    ...partial,
  };
}

function minimalAssembled(channel: Channel, profileId: string): AssembledBuild {
  const wireName = defaultChannelWireName(channel);
  return {
    buildId: 'build-1',
    formatId: 'opengd77',
    profileId,
    buildName: 'Parity',
    channels: [{ entity: channel, wireName }],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

function csvWireName(
  channel: Channel,
  csvProfileId: (typeof OPENGD77_CSV_PROFILES)[number],
  exportSettings?: BuildExportSettings,
): string {
  const assembled = minimalAssembled(channel, csvProfileId);
  const options = mergeExportOptions(
    { exportSettings } as Parameters<typeof mergeExportOptions>[0],
    'opengd77',
    { profileId: csvProfileId },
  );
  const csv = serialiseChannels(assembled, options);
  return channelNameFromCsv(csv);
}

function serialWireName(
  channel: Channel,
  serialProfileId: (typeof OPENGD77_SERIAL_PROFILES)[number],
  exportSettings?: BuildExportSettings,
): string {
  const { build, egress } = newRadioBuildForProfile('p1', serialProfileId);
  const buildWithSettings = exportSettings
    ? { ...build, exportSettings: { ...build.exportSettings, ...exportSettings } }
    : build;
  const row = { entity: channel, wireName: defaultChannelWireName(channel) };
  const dtos = assembledChannelsToRadioDtos([row], buildWithSettings, egress);
  return dtos[0]?.wireName ?? '';
}

function assertCsvSerialParity(
  channel: Channel,
  exportSettings: BuildExportSettings | undefined,
  expectedWireName: string,
): void {
  for (let i = 0; i < OPENGD77_CSV_PROFILES.length; i++) {
    const csvProfile = OPENGD77_CSV_PROFILES[i]!;
    const serialProfile = OPENGD77_SERIAL_PROFILES[i]!;
    const csvName = csvWireName(channel, csvProfile, exportSettings);
    const serialName = serialWireName(channel, serialProfile, exportSettings);
    expect(csvName, `${csvProfile} CSV`).toBe(expectedWireName);
    expect(serialName, `${serialProfile} serial`).toBe(expectedWireName);
    expect(csvName, `${csvProfile} vs ${serialProfile}`).toBe(serialName);
  }
}

describe('OpenGD77 CSV ↔ serial channel wire name parity (#777)', () => {
  it('keeps full name under limit when abbreviation is set (useChannelAbbreviation on)', () => {
    const channel = fmChannel({ name: 'hotspot', abbreviation: 'Hspt' });
    assertCsvSerialParity(channel, { useChannelAbbreviation: true }, 'hotspot');
  });

  it('keeps full name under limit with default export settings', () => {
    const channel = fmChannel({ name: 'hotspot', abbreviation: 'Hspt' });
    assertCsvSerialParity(channel, undefined, 'hotspot');
  });

  it('shortens with library abbreviation when over nameLimit (useChannelAbbreviation on)', () => {
    const channel = fmChannel({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    assertCsvSerialParity(channel, { useChannelAbbreviation: true }, "GB3MT M'flt");
  });

  it('shortens without library abbreviation when useChannelAbbreviation is off', () => {
    const channel = fmChannel({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    const settings: BuildExportSettings = {
      shortenNames: true,
      useChannelAbbreviation: false,
    };
    for (let i = 0; i < OPENGD77_CSV_PROFILES.length; i++) {
      const csvProfile = OPENGD77_CSV_PROFILES[i]!;
      const serialProfile = OPENGD77_SERIAL_PROFILES[i]!;
      const csvName = csvWireName(channel, csvProfile, settings);
      const serialName = serialWireName(channel, serialProfile, settings);
      expect(csvName).toBe(serialName);
      expect(csvName).not.toBe("GB3MT M'flt");
      expect(csvName.length).toBeLessThanOrEqual(16);
    }
  });
});
