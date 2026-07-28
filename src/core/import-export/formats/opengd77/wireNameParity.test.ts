import { describe, expect, it } from 'vitest';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import {
  assertOpenGd77WireNameParity,
  assertPathwayParity,
  collectOpenGd77PathwaySnapshots,
  fmChannelFixture,
  mergePathwayCsvOptions,
  mergePathwaySerialOptions,
  OPENGD77_PATHWAY_PAIRS,
  opengd77SerialPathwaySnapshot,
} from '@core/import-export/channelExpansion/__testUtils__/pathwayParity.ts';
import { expandOpenGd77ChannelWireRows } from '@core/import-export/opengd77ExportModes.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';

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
      const fromSerial = opengd77SerialPathwaySnapshot(channel, serialOptions, pair.serial, settings);
      const csvName = snapshots[`${pair.csv} Channels.csv`]!.wireNames[0] ?? '';
      expect(expanded[0]?.wireName).toBe(fromSerial.wireNames[0]);
      expect(csvName).toBe(fromSerial.wireNames[0]);
      expect(csvName).not.toBe("GB3MT M'flt");
      expect(csvName.length).toBeLessThanOrEqual(16);
    }
  });

  it('expands dual-mode FM+DMR to -F and -D on CSV and serial (#781)', () => {
    const channel: Channel = {
      ...newChannel('p1', 'DualMode'),
      rxFrequency: 430_850_000,
      txFrequency: 438_450_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    for (const pair of OPENGD77_PATHWAY_PAIRS) {
      const snapshots = collectOpenGd77PathwaySnapshots(channel, undefined, pair);
      assertPathwayParity(snapshots, {
        compareScanInclusion: true,
      });
      expect(snapshots[`${pair.csv} expand`]!.wireNames.sort()).toEqual(['DualMode-D', 'DualMode-F']);
    }
  });
});
