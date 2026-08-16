/**
 * Pins today's `previewWireRows` (production) wire-name output — long names, an
 * abbreviation, a name collision, and a build override — per format. Not testing the
 * new `resolveWireNames` service (phase 1 doesn't wire it to any consumer yet).
 *
 * Later phases repoint `previewWireRows` at `resolveWireNames` (phase 2) and can diff
 * its output against these pins. Full byte-level goldens already exist per format
 * (`formats/dm32/serialise.test.ts`, `formats/opengd77/exportGolden.test.ts`,
 * `formats/anytone/exportGolden.test.ts`, `formats/chirp/exportGolden.test.ts`) — this
 * file only pins the wire-*name* strings previewWireRows shows the operator, not the
 * full CSV bytes those suites already cover.
 */
import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import type { Library } from '@core/models/library.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import { previewWireRows } from './previewWireRows.ts';

const PROJECT_ID = 'proj-1';

interface CharacterisationFixture {
  library: Library;
  overriddenChannelId: string;
  overriddenZoneId: string;
}

/** One constructed library exercising: a long name, an abbreviation, a name collision,
 * and (via the build) a wire-name override — same fixture for every format below. */
function characterisationLibrary(): CharacterisationFixture {
  const library = emptyLibrary();

  const long = withExportEligibleDefaults(
    newChannel(PROJECT_ID, 'Glasgow City Centre Repeater Group Site'),
    145.5,
  );
  long.abbreviation = 'GCCRGS';

  const dup1 = withExportEligibleDefaults(newChannel(PROJECT_ID, 'Home'), 146.0);
  const dup2 = withExportEligibleDefaults(newChannel(PROJECT_ID, 'Home'), 146.5);
  const overriddenChannel = withExportEligibleDefaults(newChannel(PROJECT_ID, 'Base'), 147.0);
  library.channels.push(long, dup1, dup2, overriddenChannel);

  const zoneLong = newZone(PROJECT_ID, 'Glasgow City Centre Repeater Group Site');
  const zoneDup1 = newZone(PROJECT_ID, 'Home');
  const zoneDup2 = newZone(PROJECT_ID, 'Home');
  const overriddenZone = newZone(PROJECT_ID, 'Base');
  library.zones.push(zoneLong, zoneDup1, zoneDup2, overriddenZone);

  return {
    library,
    overriddenChannelId: overriddenChannel.id,
    overriddenZoneId: overriddenZone.id,
  };
}

type FormatCase = { formatId: string; profileId: string };

const FORMAT_CASES: readonly FormatCase[] = [
  { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
  { formatId: 'opengd77', profileId: 'opengd77-1701' },
  { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
  { formatId: 'chirp', profileId: 'chirp-uv5r' },
];

/**
 * Wire names pinned per format — update deliberately (and note why) when the exporter
 * changes. Captured from today's `previewWireRows` production output; see file header.
 *
 * Notable current behaviour this pins (not necessarily desirable — just what exists):
 * - Channel overrides are NOT length-limited by `previewWireRows` today (shown raw,
 *   sanitised only) — only the *generated* suggestion goes through the shorten pipeline.
 * - CHIRP channel/zone rows are never disambiguated (`formatUsesListNameShortening`
 *   excludes chirp, and the CHIRP channel branch has no `reserved` set at all).
 */
const EXPECTED_CHANNEL_NAMES: Record<string, readonly string[]> = {
  dm32: ['GCCRGS', 'Home', 'Home 2', 'This Base Override Is Too Long for the radio'],
  opengd77: ['GCCRGS', 'Home', 'Home 2', 'This Base Override Is Too Long for the radio'],
  anytone: ['GCCRGS', 'Home', 'Home 2', 'This Base Override Is Too Long for the radio'],
  chirp: ['GCCRGS', 'Home', 'Home', 'This Base Override Is Too Long for the radio'],
};

const EXPECTED_ZONE_NAMES: Record<string, readonly string[]> = {
  dm32: ['This Zone Override Is Too Long for the radio', 'Gls Cy Cntr Rptr', 'Home', 'Home 2'],
  opengd77: ['This Zone Override Is Too Long for the radio', 'Gls Cy Cntr Rptr', 'Home', 'Home 2'],
  anytone: ['This Zone Override Is Too Long for the radio', 'Gls Cy Cntr Rptr', 'Home', 'Home 2'],
  chirp: [
    'This Zone Override Is Too Long for the radio',
    'Glasgow City Centre Repeater Group Site',
    'Home',
    'Home',
  ],
};

describe("wire-name characterisation (pins today's previewWireRows output)", () => {
  for (const { formatId, profileId } of FORMAT_CASES) {
    it(`channel wire names — ${formatId}/${profileId}`, () => {
      const { library, overriddenChannelId } = characterisationLibrary();
      const { build } = newRadioBuildForProfile(PROJECT_ID, profileId);
      const buildWithOverride = {
        ...build,
        channelOverrides: [
          {
            libraryEntityId: overriddenChannelId,
            wireName: 'This Base Override Is Too Long for the radio',
          },
        ],
      };
      const rows = previewWireRows(buildWithOverride, librarySliceFrom(library), 'channel');
      const names = rows.map((row) => row.effectiveWireName);
      expect(names).toEqual(EXPECTED_CHANNEL_NAMES[formatId]);
    });

    it(`zone wire names — ${formatId}/${profileId}`, () => {
      const { library, overriddenZoneId } = characterisationLibrary();
      const { build } = newRadioBuildForProfile(PROJECT_ID, profileId);
      const buildWithOverride = {
        ...build,
        zoneOverrides: [
          {
            libraryEntityId: overriddenZoneId,
            wireName: 'This Zone Override Is Too Long for the radio',
          },
        ],
      };
      const rows = previewWireRows(buildWithOverride, librarySliceFrom(library), 'zone');
      const names = rows.map((row) => row.effectiveWireName);
      expect(names).toEqual(EXPECTED_ZONE_NAMES[formatId]);
    });
  }
});
