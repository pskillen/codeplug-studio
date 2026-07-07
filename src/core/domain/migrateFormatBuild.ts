import type { BuildEntityOverride, FormatBuild } from '@core/models/formatBuild.ts';
import type { Library } from '@core/models/library.ts';
import { emptyTraitLayout } from '@core/models/traitLayout.ts';
import { migrateFlatMemoryLayoutOrderOnly } from './exportOrderOrSlot.ts';
import { migrateLegacySelections, type LegacyEntitySelection } from './formatBuildOverrides.ts';

export interface LegacyFormatBuildFields {
  channelSelections?: LegacyEntitySelection[];
  zoneSelections?: LegacyEntitySelection[];
  talkGroupSelections?: LegacyEntitySelection[];
  rxGroupListSelections?: LegacyEntitySelection[];
  contactSelections?: LegacyEntitySelection[];
}

type LegacyFormatBuild = FormatBuild & LegacyFormatBuildFields;

function hasLegacySelections(legacy?: LegacyFormatBuildFields): boolean {
  if (!legacy) return false;
  return (
    legacy.channelSelections !== undefined ||
    legacy.zoneSelections !== undefined ||
    legacy.talkGroupSelections !== undefined ||
    legacy.rxGroupListSelections !== undefined ||
    legacy.contactSelections !== undefined
  );
}

function migrateOverrideField(
  legacy: LegacyEntitySelection[] | undefined,
  current: BuildEntityOverride[],
  allEntityIds: string[],
): BuildEntityOverride[] {
  if (current.length > 0) return current;
  if (!legacy || legacy.length === 0) return [];
  return migrateLegacySelections(legacy, allEntityIds);
}

/** Normalise legacy *Selections fields to sparse *Overrides (opt-out semantics). */
export function migrateFormatBuild(
  build: FormatBuild,
  library: Library,
  legacy?: LegacyFormatBuildFields,
): FormatBuild {
  const legacyFromBuild = build as LegacyFormatBuild;
  const legacyFields = legacy ?? {
    channelSelections: legacyFromBuild.channelSelections,
    zoneSelections: legacyFromBuild.zoneSelections,
    talkGroupSelections: legacyFromBuild.talkGroupSelections,
    rxGroupListSelections: legacyFromBuild.rxGroupListSelections,
    contactSelections: legacyFromBuild.contactSelections,
  };

  if (!hasLegacySelections(legacyFields) && !missingOverrideFields(legacyFromBuild)) {
    return build;
  }

  const channelIds = library.channels.map((row) => row.id);
  const zoneIds = library.zones.map((row) => row.id);
  const talkGroupIds = library.talkGroups.map((row) => row.id);
  const rxGroupListIds = library.rxGroupLists.map((row) => row.id);
  const contactIds = [
    ...library.digitalContacts.map((row) => row.id),
    ...library.analogContacts.map((row) => row.id),
  ];

  return {
    ...build,
    channelOverrides: migrateOverrideField(
      legacyFields.channelSelections,
      build.channelOverrides ?? [],
      channelIds,
    ),
    zoneOverrides: migrateOverrideField(
      legacyFields.zoneSelections,
      build.zoneOverrides ?? [],
      zoneIds,
    ),
    talkGroupOverrides: migrateOverrideField(
      legacyFields.talkGroupSelections,
      build.talkGroupOverrides ?? [],
      talkGroupIds,
    ),
    rxGroupListOverrides: migrateOverrideField(
      legacyFields.rxGroupListSelections,
      build.rxGroupListOverrides ?? [],
      rxGroupListIds,
    ),
    contactOverrides: migrateOverrideField(
      legacyFields.contactSelections,
      build.contactOverrides ?? [],
      contactIds,
    ),
  };
}

function missingOverrideFields(build: LegacyFormatBuild): boolean {
  return (
    build.channelOverrides === undefined ||
    build.zoneOverrides === undefined ||
    build.talkGroupOverrides === undefined ||
    build.rxGroupListOverrides === undefined ||
    build.contactOverrides === undefined
  );
}

/** Rename-only normalisation when library is unavailable (e.g. IndexedDB read). */
export function normalizeFormatBuildFields(build: LegacyFormatBuild): FormatBuild {
  const normalized: FormatBuild = {
    ...build,
    layout: build.layout ?? emptyTraitLayout(),
    channelOverrides:
      build.channelOverrides ??
      (build.channelSelections ?? []).map((row) => ({
        libraryEntityId: row.libraryEntityId,
        wireName: row.overrides.name,
      })),
    zoneOverrides:
      build.zoneOverrides ??
      (build.zoneSelections ?? []).map((row) => ({
        libraryEntityId: row.libraryEntityId,
        wireName: row.overrides.name,
      })),
    talkGroupOverrides:
      build.talkGroupOverrides ??
      (build.talkGroupSelections ?? []).map((row) => ({
        libraryEntityId: row.libraryEntityId,
        wireName: row.overrides.name,
      })),
    rxGroupListOverrides:
      build.rxGroupListOverrides ??
      (build.rxGroupListSelections ?? []).map((row) => ({
        libraryEntityId: row.libraryEntityId,
        wireName: row.overrides.name,
      })),
    contactOverrides:
      build.contactOverrides ??
      (build.contactSelections ?? []).map((row) => ({
        libraryEntityId: row.libraryEntityId,
        wireName: row.overrides.name,
      })),
    exportUnlinkedChannels: build.exportUnlinkedChannels ?? true,
    exportUnlinkedTalkGroups: build.exportUnlinkedTalkGroups ?? true,
    exportUnlinkedRxGroupLists: build.exportUnlinkedRxGroupLists ?? true,
  };
  return migrateFlatMemoryLayoutOrderOnly(normalized);
}
