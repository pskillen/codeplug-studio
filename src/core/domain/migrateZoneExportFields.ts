import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { Library, Zone } from '@core/models/library.ts';
import type { ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import {
  findZoneGroupingSection,
  replaceZoneGroupingSection,
  seedZoneGroupingFromLibrary,
} from './zoneGroupingLayout.ts';
import { resolveEffectiveZoneChannelIds } from './zoneHierarchy.ts';
import { migrateZoneMemberEntries } from './migrateZoneMembers.ts';
import { migrateBuildScanListsToLibrary } from './migrateScanLists.ts';
import { migrateChannelScanListFromBuildOverrides } from './migrateChannelScanList.ts';
import { migrateAprsSingletonAggregate } from './migrateAprsSingleton.ts';
import { normalizeChannelBehaviourDefaults } from './normalizeChannelBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from './normalizeZoneBehaviourDefaults.ts';

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

/** True when the radio target has a DM32-compatible egress (not only the default pathway). */
function isDm32Build(build: RadioBuild): boolean {
  const target = radioTargetFor(build.radioTargetId);
  return target?.compatibleEgress.some((egress) => egress.formatId === 'dm32') ?? false;
}

export function migrateZoneExportFieldsToBuildLayout(
  library: Library,
  formatBuilds: RadioBuild[],
): { library: Library; formatBuilds: RadioBuild[] } {
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
    if (!isDm32Build(build)) return build;

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

/**
 * @deprecated No-op — `RadioBuild` no longer carries `profileId`; the DM32 default-profile
 * rewrite this performed is now implicit in `defaultCompatibleEgress` (radioTargetId →
 * `dm32-baofeng-dm32uv` is the only DM32 egress in the catalog) (#654).
 */
export function migrateDm32ProfileId(formatBuilds: RadioBuild[]): RadioBuild[] {
  return formatBuilds;
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
    aprsConfiguration:
      withMembers.aprsConfiguration ??
      (withMembers as { aprsConfigurations?: AprsConfiguration[] }).aprsConfigurations?.[0] ??
      null,
    channelDefaults: normalizeChannelBehaviourDefaults(
      withMembers.channelDefaults ?? withMembers.meta.channelDefaults,
    ),
    zoneDefaults: normalizeZoneBehaviourDefaults(
      withMembers.zoneDefaults ?? withMembers.meta.zoneDefaults,
    ),
  };

  const { library: migratedLibrary, formatBuilds: radioBuilds } = migrateZoneExportFieldsToBuildLayout(
    library,
    withMembers.radioBuilds,
  );

  return migrateAprsSingletonAggregate(
    migrateChannelScanListFromBuildOverrides(
      migrateBuildScanListsToLibrary({
        meta: withMembers.meta,
        channels: migratedLibrary.channels,
        zones: migratedLibrary.zones,
        talkGroups: migratedLibrary.talkGroups,
        digitalContacts: migratedLibrary.digitalContacts,
        analogContacts: migratedLibrary.analogContacts,
        rxGroupLists: migratedLibrary.rxGroupLists,
        scanLists: migratedLibrary.scanLists,
        aprsConfiguration: migratedLibrary.aprsConfiguration,
        channelDefaults: migratedLibrary.channelDefaults,
        zoneDefaults: migratedLibrary.zoneDefaults,
        radioBuilds,
        egressPaths: withMembers.egressPaths,
      }),
    ),
  );
}
