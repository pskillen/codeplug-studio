import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { FlatMemoryLayout } from '@core/models/traitLayout.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  isEntityExcluded,
  isEntityForceIncluded,
} from '@core/domain/formatBuildOverrides.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';

export function buildUsesFlatMemoryList(build: FormatBuild): boolean {
  const profile = traitProfileFor(build.profileId);
  return profile?.traits.includes(BuildCapabilityTrait.FlatMemoryList) ?? false;
}

export function findFlatMemorySection(build: FormatBuild): FlatMemoryLayout | undefined {
  return build.layout.sections.find((s): s is FlatMemoryLayout => s.kind === 'flatMemory');
}

/** Seed flat memory from library channels when build has no layout section yet. */
export function seedFlatMemoryFromBuild(
  build: FormatBuild,
  library: LibrarySlice,
): FlatMemoryLayout {
  const channelIds: string[] = [];
  const seen = new Set<string>();

  for (const channel of library.channels) {
    if (isEntityExcluded(build.channelOverrides, channel.id)) continue;
    channelIds.push(channel.id);
    seen.add(channel.id);
  }

  for (const row of build.channelOverrides ?? []) {
    if (!row.forceInclude || seen.has(row.libraryEntityId)) continue;
    if (isEntityExcluded(build.channelOverrides, row.libraryEntityId)) continue;
    channelIds.push(row.libraryEntityId);
    seen.add(row.libraryEntityId);
  }

  return { kind: 'flatMemory', channelIds, scanFlags: {} };
}

export function resolveFlatMemorySection(
  build: FormatBuild,
  library: LibrarySlice,
): FlatMemoryLayout {
  return findFlatMemorySection(build) ?? seedFlatMemoryFromBuild(build, library);
}

/** Effective flat-memory channel ids for export — layout order with force-include append. */
export function flatMemoryExportChannelIds(
  build: FormatBuild,
  library: LibrarySlice,
): string[] {
  const section = resolveFlatMemorySection(build, library);
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const id of section.channelIds) {
    if (isEntityExcluded(build.channelOverrides, id) || seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  for (const row of build.channelOverrides ?? []) {
    if (!isEntityForceIncluded(build.channelOverrides, row.libraryEntityId)) continue;
    if (seen.has(row.libraryEntityId)) continue;
    ordered.push(row.libraryEntityId);
    seen.add(row.libraryEntityId);
  }

  return ordered;
}

export function replaceFlatMemorySection(
  build: FormatBuild,
  section: FlatMemoryLayout,
): FormatBuild {
  const other = build.layout.sections.filter((s) => s.kind !== 'flatMemory');
  return {
    ...build,
    layout: { sections: [...other, section] },
  };
}

export function reorderFlatMemoryChannels(
  section: FlatMemoryLayout,
  channelIds: string[],
): FlatMemoryLayout {
  return { ...section, channelIds };
}

export function addFlatMemoryChannel(
  section: FlatMemoryLayout,
  channelId: string,
): FlatMemoryLayout {
  if (section.channelIds.includes(channelId)) return section;
  return { ...section, channelIds: [...section.channelIds, channelId] };
}

export function removeFlatMemoryChannel(
  section: FlatMemoryLayout,
  channelId: string,
): FlatMemoryLayout {
  return {
    ...section,
    channelIds: section.channelIds.filter((id) => id !== channelId),
  };
}
