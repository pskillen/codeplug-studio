import { expect, it } from 'vitest';
import { emptyLibrary, newZone, newRadioBuild } from '@core/domain/factories.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import { resolveWireNames } from '@core/services/resolveWireNames.ts';
import { readZoneNameCandidates } from './readZoneNameCandidates.ts';

it('collects the shortened name and override without storing them', () => {
  const zone = newZone('p', 'Regional Repeaters North');
  const library = librarySliceFrom({ ...emptyLibrary(), zones: [zone] });
  const build = {
    ...newRadioBuild('p', 'baofeng-uv5r-mini-mm9pdy'),
    zoneOverrides: [{ libraryEntityId: zone.id, wireName: 'OVERRIDE' }],
  };
  const snapshot = structuredClone({ library, build });
  const row = resolveWireNames({
    library,
    build,
    entityKind: 'zone',
    formatId: 'radio-io',
    profileId: 'radio-io-uv5r-mini-mm9pdy',
  })[0];
  const names = readZoneNameCandidates(library, build, 'radio-io', 'radio-io-uv5r-mini-mm9pdy').get(
    zone.id,
  )!;
  expect(names).toContain('OVERRIDE');
  expect(names).toContain(row.suggestion.trim());
  expect(row.suggestion.length).toBeLessThanOrEqual(row.limit!);
  expect(names).not.toContain(zone.name);
  expect({ library, build }).toEqual(snapshot);
});
