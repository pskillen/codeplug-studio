import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { expandChannelWireRows } from '@core/import-export/channelExpansion/multiMode.ts';
import { isProjectionExcluded } from '@core/domain/formatBuildOverrides.ts';
import { buildListWireNameMap } from '@core/import-export/channelExpansion/listWireNames.ts';
import {
  applyDigitalContactExportWireName,
  buildDigitalContactExportWireNameMap,
  resolveAnalogContactExportBaseName,
} from '@core/import-export/digitalContactExportName.ts';
import { DEFAULT_OPENGD77_PROFILE_ID } from './profiles.ts';

export interface OpenGd77ListWireMaps {
  zoneWireNames: Map<string, string>;
  rxGroupListWireNames: Map<string, string>;
  contactWireNames: Map<string, string>;
}

function seedReservedFromChannels(
  assembled: AssembledBuild,
  options: CpsExportOptions | undefined,
  profileId: string,
  reserved: Set<string>,
  warnings: string[],
): void {
  const expandModes = options?.expandModes ?? true;
  for (const row of assembled.channels) {
    const expanded = expandChannelWireRows(
      row.entity,
      row.wireNameOverride?.trim() || row.wireName,
      expandModes,
      options,
      profileId,
      reserved,
      warnings,
    );
    for (const entry of expanded) {
      if (isProjectionExcluded(options?.channelOverrides, entry.key, row.entity.id)) continue;
      reserved.add(entry.wireName);
    }
  }
}

export function buildOpenGd77ListWireMaps(
  exportAssembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: string[] = [],
): OpenGd77ListWireMaps {
  const profileId = options?.profileId ?? exportAssembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;
  const reserved = new Set<string>();

  seedReservedFromChannels(exportAssembled, options, profileId, reserved, warnings);
  for (const tg of exportAssembled.talkGroups) {
    reserved.add(tg.wireName);
  }

  const zoneWireNames = buildListWireNameMap(
    exportAssembled.zones.map((zone) => ({
      id: zone.zoneId,
      wireName: zone.wireName,
      entityKind: 'Zone' as const,
    })),
    reserved,
    options,
    profileId,
    warnings,
  );

  const rxGroupListWireNames = buildListWireNameMap(
    exportAssembled.rxGroupLists.map((list) => ({
      id: list.entity.id,
      wireName: list.wireName,
      entityKind: 'RX group list' as const,
    })),
    reserved,
    options,
    profileId,
    warnings,
  );

  const contactWireNames = buildDigitalContactExportWireNameMap(
    exportAssembled.digitalContacts,
    options?.contactOverrides,
    options,
    profileId,
    warnings,
  );
  for (const contact of exportAssembled.analogContacts) {
    const base = resolveAnalogContactExportBaseName(contact.entity, options?.contactOverrides);
    contactWireNames.set(
      contact.entity.id,
      applyDigitalContactExportWireName(base, options, profileId, warnings),
    );
  }

  return { zoneWireNames, rxGroupListWireNames, contactWireNames };
}

export function zoneExportWireName(
  maps: OpenGd77ListWireMaps,
  zoneId: string,
  fallback: string,
): string {
  return maps.zoneWireNames.get(zoneId) ?? fallback;
}

export function rxGroupListExportWireName(
  maps: OpenGd77ListWireMaps,
  listId: string,
  fallback: string,
): string {
  return maps.rxGroupListWireNames.get(listId) ?? fallback;
}

export function contactExportWireName(
  maps: OpenGd77ListWireMaps,
  contactId: string,
  fallback: string,
): string {
  return maps.contactWireNames.get(contactId) ?? fallback;
}
