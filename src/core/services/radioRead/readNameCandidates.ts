import { EXPORT_NAME_MODE_OPTIONS } from '@core/domain/channelNaming.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { resolveWireNames } from '@core/services/resolveWireNames.ts';

export function readChannelNameCandidates(
  library: LibrarySlice,
  build: RadioBuild,
  formatId: string,
  profileId: string,
): Map<string, string[]> {
  const candidates = new Map<string, Set<string>>();
  for (const { value } of EXPORT_NAME_MODE_OPTIONS) {
    const rows = resolveWireNames({
      build: { ...build, exportSettings: { ...build.exportSettings, nameModeOverride: value } },
      library,
      entityKind: 'channel',
      formatId,
      profileId,
    });
    for (const row of rows) {
      const names = candidates.get(row.libraryEntityId) ?? new Set<string>();
      for (const raw of [row.override, row.suggestion, row.effective]) {
        const name = raw?.trim();
        if (name && name !== row.libraryName.trim()) names.add(name);
      }
      candidates.set(row.libraryEntityId, names);
    }
  }
  return new Map([...candidates].map(([id, names]) => [id, [...names]]));
}
