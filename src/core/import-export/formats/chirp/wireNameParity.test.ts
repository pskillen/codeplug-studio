import { describe, expect, it } from 'vitest';
import {
  assertChirpWireNameParity,
  CHIRP_PATHWAY_PAIRS,
  collectChirpPathwaySnapshots,
  fmChannelFixture,
  mergePathwayCsvOptions,
  mergePathwaySerialOptions,
  serialPathwaySnapshot,
} from '@core/import-export/channelExpansion/__testUtils__/pathwayParity.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';

describe('CHIRP CSV ↔ serial channel wire name parity (#780)', () => {
  it('keeps full name under limit when abbreviation is set (useChannelAbbreviation on)', () => {
    const channel = fmChannelFixture({
      callsign: 'GB7GL',
      name: 'hs',
      abbreviation: 'Hs',
    });
    assertChirpWireNameParity(
      channel,
      { useChannelAbbreviation: true },
      'GB7GL hs',
      CHIRP_PATHWAY_PAIRS,
    );
  });

  it('shortens with library abbreviation when over nameLimit (useChannelAbbreviation on)', () => {
    const channel = fmChannelFixture({
      callsign: 'GB7AC',
      name: 'Largs Scotland West',
      abbreviation: 'Largs',
    });
    assertChirpWireNameParity(
      channel,
      { useChannelAbbreviation: true },
      'GB7AC Largs',
      CHIRP_PATHWAY_PAIRS,
    );
  });

  it('shortens without library abbreviation when useChannelAbbreviation is off', () => {
    const channel = fmChannelFixture({
      callsign: 'GB7AC',
      name: 'Largs Scotland West',
      abbreviation: 'Largs',
    });
    const settings: BuildExportSettings = {
      shortenNames: true,
      useChannelAbbreviation: false,
    };
    for (const pair of CHIRP_PATHWAY_PAIRS) {
      const snapshots = collectChirpPathwaySnapshots(channel, settings, pair);
      const csvOptions = mergePathwayCsvOptions(settings, 'chirp', pair.csv);
      const serialOptions = mergePathwaySerialOptions(settings, pair.serial);
      const fromSerial = serialPathwaySnapshot(channel, serialOptions, pair.serial, settings);
      const csvName = snapshots[`${pair.csv} CSV`]!.wireNames[0] ?? '';
      expect(csvName).toBe(fromSerial.wireNames[0]);
      expect(csvName).not.toBe('GB7AC Largs');
      expect(csvName.length).toBeLessThanOrEqual(12);
    }
  });
});
