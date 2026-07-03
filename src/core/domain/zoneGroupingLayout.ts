import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { zoneMemberChannelIds } from '@core/domain/zoneMembers.ts';

export function findZoneGroupingSection(build: FormatBuild): ZoneGroupingLayout | undefined {
  return build.layout.sections.find((s): s is ZoneGroupingLayout => s.kind === 'zoneGrouping');
}

/** Seed export layout from library zone membership when build has no zone grouping section. */
export function seedZoneGroupingFromLibrary(library: LibrarySlice): ZoneGroupingLayout {
  return {
    kind: 'zoneGrouping',
    zones: library.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      channelIds: zoneMemberChannelIds(zone),
    })),
  };
}

export function updateZoneGroupingEntry(
  section: ZoneGroupingLayout,
  zoneId: string,
  patch: Partial<ZoneGroupingZoneEntry>,
): ZoneGroupingLayout {
  return {
    ...section,
    zones: section.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)),
  };
}

export function replaceZoneGroupingSection(
  build: FormatBuild,
  section: ZoneGroupingLayout,
): FormatBuild {
  const other = build.layout.sections.filter((section) => section.kind !== 'zoneGrouping');
  return {
    ...build,
    layout: { sections: [...other, section] },
  };
}

export function updateZoneChannelIds(
  section: ZoneGroupingLayout,
  zoneId: string,
  channelIds: string[],
): ZoneGroupingLayout {
  return {
    ...section,
    zones: section.zones.map((zone) => (zone.id === zoneId ? { ...zone, channelIds } : zone)),
  };
}
