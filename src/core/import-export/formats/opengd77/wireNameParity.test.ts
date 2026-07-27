import { describe, expect, it } from 'vitest';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { newChannel } from '@core/domain/factories.ts';
import { assembledChannelExportWireName } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { expandOpenGd77ChannelWireRows } from '@core/import-export/opengd77ExportModes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { Channel } from '@core/models/library.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import { CHANNEL_COL } from './columns.ts';
import { serialiseChannels } from './serialise.ts';

const PROFILE_PAIRS = [
  { csv: 'opengd77-1701', serial: 'radio-io-opengd77-1701' },
  { csv: 'opengd77-md9600', serial: 'radio-io-opengd77-md9600' },
] as const;

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

function assertCsvSerialNamingParity(
  channel: Channel,
  exportSettings: BuildExportSettings | undefined,
  expectedWireName: string,
): void {
  const wireName = defaultChannelWireName(channel);
  const row = { entity: channel, wireName };

  for (const { csv, serial } of PROFILE_PAIRS) {
    const csvOptions = mergeExportOptions(
      { exportSettings } as Parameters<typeof mergeExportOptions>[0],
      'opengd77',
      { profileId: csv },
    );
    const serialOptions = mergeExportOptions(
      { exportSettings } as Parameters<typeof mergeExportOptions>[0],
      'radio-io',
      { profileId: serial },
    );

    const csvReserved = new Set<string>();
    const serialReserved = new Set<string>();
    const csvWarnings: string[] = [];
    const serialWarnings: string[] = [];

    const fromSerialHelper = assembledChannelExportWireName(
      row,
      serialReserved,
      serialOptions,
      serial,
      serialWarnings,
    );

    const expanded = expandOpenGd77ChannelWireRows(
      channel,
      wireName,
      true,
      csvOptions,
      csv,
      csvReserved,
      csvWarnings,
    );
    const fromCsvExpand = expanded[0]?.wireName ?? '';

    const assembled = minimalAssembled(channel, csv);
    const csvName = channelNameFromCsv(serialiseChannels(assembled, csvOptions));

    expect(fromCsvExpand, `${csv} expand`).toBe(expectedWireName);
    expect(fromSerialHelper, `${serial} helper`).toBe(expectedWireName);
    expect(csvName, `${csv} Channels.csv`).toBe(expectedWireName);
    expect(fromCsvExpand, `${csv} expand vs ${serial} helper`).toBe(fromSerialHelper);
    expect(csvName, `${csv} CSV vs ${serial} helper`).toBe(fromSerialHelper);
  }
}

describe('OpenGD77 CSV ↔ serial channel wire name parity (#777)', () => {
  it('keeps full name under limit when abbreviation is set (useChannelAbbreviation on)', () => {
    const channel = fmChannel({ name: 'hotspot', abbreviation: 'Hspt' });
    assertCsvSerialNamingParity(channel, { useChannelAbbreviation: true }, 'hotspot');
  });

  it('keeps full name under limit with default export settings', () => {
    const channel = fmChannel({ name: 'hotspot', abbreviation: 'Hspt' });
    assertCsvSerialNamingParity(channel, undefined, 'hotspot');
  });

  it('shortens with library abbreviation when over nameLimit (useChannelAbbreviation on)', () => {
    const channel = fmChannel({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    assertCsvSerialNamingParity(channel, { useChannelAbbreviation: true }, "GB3MT M'flt");
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
    for (const { csv, serial } of PROFILE_PAIRS) {
      const csvOptions = mergeExportOptions(
        { exportSettings: settings } as Parameters<typeof mergeExportOptions>[0],
        'opengd77',
        { profileId: csv },
      );
      const serialOptions = mergeExportOptions(
        { exportSettings: settings } as Parameters<typeof mergeExportOptions>[0],
        'radio-io',
        { profileId: serial },
      );
      const wireName = defaultChannelWireName(channel);
      const row = { entity: channel, wireName };
      const csvReserved = new Set<string>();
      const serialReserved = new Set<string>();
      const expanded = expandOpenGd77ChannelWireRows(
        channel,
        wireName,
        true,
        csvOptions,
        csv,
        csvReserved,
        [],
      );
      const fromSerial = assembledChannelExportWireName(
        row,
        serialReserved,
        serialOptions,
        serial,
        [],
      );
      const csvName = channelNameFromCsv(
        serialiseChannels(minimalAssembled(channel, csv), csvOptions),
      );
      expect(expanded[0]?.wireName).toBe(fromSerial);
      expect(csvName).toBe(fromSerial);
      expect(csvName).not.toBe("GB3MT M'flt");
      expect(csvName.length).toBeLessThanOrEqual(16);
    }
  });
});
