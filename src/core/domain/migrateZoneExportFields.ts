import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Library, Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import {
  findZoneGroupingSection,
  replaceZoneGroupingSection,
  seedZoneGroupingFromLibrary,
} from './zoneGroupingLayout.ts';
import { resolveEffectiveZoneChannelIds } from './zoneHierarchy.ts';
import { migrateZoneMemberEntries } from './migrateZoneMembers.ts';

export interface LegacyZoneExportFields {
  exportScratchChannel: boolean;
  exportScanList: boolean;
  scanCarrierFrequencyHz: number | null;
}

type ZoneWithLegacy = Zone & Partial<LegacyZoneExportFields>;

export function readLegacyZoneExportFields(zone: ZoneWithLegacy): LegacyZoneExportFields | null {
  const hasLegacy =
    zone.exportScratchChannel !== undefined ||
    zone.exportScanList !== undefined ||
    zone.scanCarrierFrequencyHz !== undefined;
  if (!hasLegacy) return null;
  return {
    exportScratchChannel: zone.exportScratchChannel ?? false,
    exportScanList: zone.exportScanList ?? false,
    scanCarrierFrequencyHz: zone.scanCarrierFrequencyHz ?? null,
  };
}

export function stripZoneExportFields(zone: ZoneWithLegacy): Zone {
  const rest = { ...zone };
  delete rest.exportScratchChannel;
  delete rest.exportScanList;
  delete rest.scanCarrierFrequencyHz;
  return rest;
}

function applyLegacyToZoneEntry(
  entry: ZoneGroupingZoneEntry,
  legacy: LegacyZoneExportFields,
): ZoneGroupingZoneEntry {
  return {
    ...entry,
    exportScratchChannel: legacy.exportScratchChannel,
    exportScanList: legacy.exportScanList,
    scanCarrierFrequencyHz: legacy.scanCarrierFrequencyHz,
  };
}

function channelIdsFromZone(zone: Zone, zones: Zone[]): string[] {
  return resolveEffectiveZoneChannelIds(zone, zones);
}

export function migrateZoneExportFieldsToBuildLayout(
  library: Library,
  formatBuilds: FormatBuild[],
): { library: Library; formatBuilds: FormatBuild[] } {
  const legacyByZoneId = new Map<string, LegacyZoneExportFields>();
  for (const zone of library.zones) {
    const legacy = readLegacyZoneExportFields(zone as ZoneWithLegacy);
    if (legacy) legacyByZoneId.set(zone.id, legacy);
  }

  const cleanedLibrary: Library = {
    ...library,
    zones: library.zones.map((zone) => stripZoneExportFields(zone as ZoneWithLegacy)),
  };

  if (legacyByZoneId.size === 0) {
    return {
      library: cleanedLibrary,
      formatBuilds: migrateDm32ProfileId(formatBuilds),
    };
  }

  const updatedBuilds = formatBuilds.map((build) => {
    if (build.formatId !== 'dm32') return build;

    let section = findZoneGroupingSection(build);
    if (!section) {
      section = seedZoneGroupingFromLibrary(cleanedLibrary);
    }

    const layoutZoneIds = new Set(section.zones.map((entry) => entry.id));
    const updatedZones = section.zones.map((entry) => {
      const legacy = legacyByZoneId.get(entry.id);
      return legacy ? applyLegacyToZoneEntry(entry, legacy) : entry;
    });

    for (const zone of cleanedLibrary.zones) {
      if (layoutZoneIds.has(zone.id)) continue;
      const legacy = legacyByZoneId.get(zone.id);
      updatedZones.push({
        id: zone.id,
        name: zone.name,
        channelIds: channelIdsFromZone(zone, cleanedLibrary.zones),
        ...(legacy
          ? {
              exportScratchChannel: legacy.exportScratchChannel,
              exportScanList: legacy.exportScanList,
              scanCarrierFrequencyHz: legacy.scanCarrierFrequencyHz,
            }
          : {}),
      });
    }

    return replaceZoneGroupingSection(build, { ...section, zones: updatedZones });
  });

  return {
    library: cleanedLibrary,
    formatBuilds: migrateDm32ProfileId(updatedBuilds),
  };
}

export function migrateDm32ProfileId(formatBuilds: FormatBuild[]): FormatBuild[] {
  return formatBuilds.map((build) =>
    build.profileId === 'dm32-default' ? { ...build, profileId: 'dm32-baofeng-dm32uv' } : build,
  );
}

/** Normalise legacy library zone export fields and profile ids on load/import. */
export function migrateProjectAggregate(aggregate: ProjectAggregate): ProjectAggregate {
  const withMembers = migrateZoneMemberEntries(aggregate);
  const library: Library = {
    channels: withMembers.channels,
    zones: withMembers.zones,
    talkGroups: withMembers.talkGroups,
    digitalContacts: withMembers.digitalContacts,
    analogContacts: withMembers.analogContacts,
    rxGroupLists: withMembers.rxGroupLists,
    scanLists: withMembers.scanLists ?? [],
  };

  const { library: migratedLibrary, formatBuilds } = migrateZoneExportFieldsToBuildLayout(
    library,
    withMembers.formatBuilds,
  );

  return {
    meta: withMembers.meta,
    channels: migratedLibrary.channels,
    zones: migratedLibrary.zones,
    talkGroups: migratedLibrary.talkGroups,
    digitalContacts: migratedLibrary.digitalContacts,
    analogContacts: migratedLibrary.analogContacts,
    rxGroupLists: migratedLibrary.rxGroupLists,
    scanLists: migratedLibrary.scanLists,
    formatBuilds,
  };
}
