import { describe, expect, it } from 'vitest';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import {
  assertOpenGd77WireNameParity,
  collectOpenGd77PathwaySnapshots,
  fmChannelFixture,
  mergePathwayCsvOptions,
  mergePathwaySerialOptions,
  OPENGD77_PATHWAY_PAIRS,
  serialPathwaySnapshot,
} from '@core/import-export/channelExpansion/__testUtils__/pathwayParity.ts';
import { expandOpenGd77ChannelWireRows } from '@core/import-export/opengd77ExportModes.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';

describe('OpenGD77 CSV ↔ serial channel wire name parity (#777)', () => {
  it('keeps full name under limit when abbreviation is set (useChannelAbbreviation on)', () => {
    const channel = fmChannelFixture({ name: 'hotspot', abbreviation: 'Hspt' });
    assertOpenGd77WireNameParity(
      channel,
      { useChannelAbbreviation: true },
      'hotspot',
      OPENGD77_PATHWAY_PAIRS,
    );
  });

  it('keeps full name under limit with default export settings', () => {
    const channel = fmChannelFixture({ name: 'hotspot', abbreviation: 'Hspt' });
    assertOpenGd77WireNameParity(channel, undefined, 'hotspot', OPENGD77_PATHWAY_PAIRS);
  });

  it('shortens with library abbreviation when over nameLimit (useChannelAbbreviation on)', () => {
    const channel = fmChannelFixture({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    assertOpenGd77WireNameParity(
      channel,
      { useChannelAbbreviation: true },
      "GB3MT M'flt",
      OPENGD77_PATHWAY_PAIRS,
    );
  });

  it('shortens without library abbreviation when useChannelAbbreviation is off', () => {
    const channel = fmChannelFixture({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    const settings: BuildExportSettings = {
      shortenNames: true,
      useChannelAbbreviation: false,
    };
    for (const pair of OPENGD77_PATHWAY_PAIRS) {
      const snapshots = collectOpenGd77PathwaySnapshots(channel, settings, pair);
      const csvOptions = mergePathwayCsvOptions(settings, 'opengd77', pair.csv);
      const serialOptions = mergePathwaySerialOptions(settings, pair.serial);
      const wireName = defaultChannelWireName(channel);
      const expanded = expandOpenGd77ChannelWireRows(
        channel,
        wireName,
        true,
        csvOptions,
        pair.csv,
        new Set<string>(),
        [],
      );
      const fromSerial = serialPathwaySnapshot(channel, serialOptions, pair.serial, settings);
      const csvName = snapshots[`${pair.csv} Channels.csv`]!.wireNames[0] ?? '';
      expect(expanded[0]?.wireName).toBe(fromSerial.wireNames[0]);
      expect(csvName).toBe(fromSerial.wireNames[0]);
      expect(csvName).not.toBe("GB3MT M'flt");
      expect(csvName.length).toBeLessThanOrEqual(16);
    }
  });
});
