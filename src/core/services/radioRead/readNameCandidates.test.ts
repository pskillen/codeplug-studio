import { expect, it } from 'vitest';
import { EXPORT_NAME_MODE_OPTIONS } from '@core/domain/channelNaming.ts';
import { emptyLibrary, newChannel, newRadioBuild } from '@core/domain/factories.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import { resolveWireNames } from '@core/services/resolveWireNames.ts';
import { readChannelNameCandidates } from './readNameCandidates.ts';
import { planReadChannelUpsert } from './upsertReadChannels.ts';
import { mapReadChannel } from './mapReadChannel.ts';

it('collects every mode and override without changing the library or build', () => {
  const channel = {
    ...newChannel('p', 'Hotspot Local North'),
    callsign: 'GB3XX',
    rxFrequency: 145500000,
    txFrequency: 145500000,
  };
  const library = librarySliceFrom({ ...emptyLibrary(), channels: [channel] });
  const build = {
    ...newRadioBuild('p', 'baofeng-uv5r-mini'),
    channelOverrides: [{ libraryEntityId: channel.id, wireName: 'HOTSPOT N' }],
  };
  const snapshot = structuredClone({ library, build });
  const names = readChannelNameCandidates(library, build, 'radio-io', 'radio-io-uv5r-mini').get(
    channel.id,
  )!;
  expect(names).toContain('HOTSPOT N');
  expect(names).not.toContain(channel.name);
  for (const { value } of EXPORT_NAME_MODE_OPTIONS) {
    const row = resolveWireNames({
      library,
      build: { ...build, exportSettings: { ...build.exportSettings, nameModeOverride: value } },
      entityKind: 'channel',
      formatId: 'radio-io',
      profileId: 'radio-io-uv5r-mini',
    })[0];
    expect(names).toContain(row.suggestion.trim());
    expect(row.suggestion.length).toBeLessThanOrEqual(row.limit!);
    const read = mapReadChannel({
      slotIndex: 1,
      empty: false,
      wireName: row.suggestion,
      rxHz: 145500000,
      txHz: 145500000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 20,
      bandwidth: 'FM',
    })!;
    expect(
      planReadChannelUpsert(library, 'p', [read], {
        nameCandidatesByChannelId: new Map([[channel.id, names]]),
      }).updates[0].matchedBy,
    ).toBe('shortened-name');
    expect(planReadChannelUpsert(library, 'p', [read]).creates).toHaveLength(1);
  }
  expect({ library, build }).toEqual(snapshot);
});
