import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { resolveWireNames } from '@core/services/resolveWireNames.ts';

export function readZoneNameCandidates(
  library: LibrarySlice,
  build: RadioBuild,
  formatId: string,
  profileId: string,
): Map<string, string[]> {
  const rows = resolveWireNames({ build, library, entityKind: 'zone', formatId, profileId });
  return new Map(
    rows.map((row) => [
      row.libraryEntityId,
      [
        ...new Set(
          [row.override, row.suggestion, row.effective]
            .map((value) => value?.trim())
            .filter((value): value is string => !!value && value !== row.libraryName.trim()),
        ),
      ],
    ]),
  );
}
