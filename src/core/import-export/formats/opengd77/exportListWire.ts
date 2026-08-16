import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { pushWireNameResolutionWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import {
  libraryFromAssembledOrStub,
  overridesFromAssembledWireNames,
  resolveWireNamesFromOptions,
} from '@core/services/resolveWireNames.ts';
import { DEFAULT_OPENGD77_PROFILE_ID } from './profiles.ts';

export interface OpenGd77ListWireMaps {
  zoneWireNames: Map<string, string>;
  rxGroupListWireNames: Map<string, string>;
  contactWireNames: Map<string, string>;
}

export function buildOpenGd77ListWireMaps(
  exportAssembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings: ExportWarning[] = [],
): OpenGd77ListWireMaps {
  const profileId = options?.profileId ?? exportAssembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;
  const library = libraryFromAssembledOrStub(exportAssembled);
  const mergedOptions = { ...options, profileId };

  const zoneWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library,
    entityKind: 'zone',
    formatId: 'opengd77',
    profileId,
    options: mergedOptions,
    overrides: overridesFromAssembledWireNames(exportAssembled.zones, (row) => row.zoneId),
  })) {
    zoneWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Zone',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId,
    });
  }

  const rxGroupListWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library,
    entityKind: 'rxGroupList',
    formatId: 'opengd77',
    profileId,
    options: mergedOptions,
    overrides: overridesFromAssembledWireNames(
      exportAssembled.rxGroupLists,
      (row) => row.entity.id,
    ),
  })) {
    rxGroupListWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'RX group list',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId,
    });
  }

  const contactWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library,
    entityKind: 'contact',
    formatId: 'opengd77',
    profileId,
    options: mergedOptions,
    overrides: options?.contactOverrides,
  })) {
    contactWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Contact',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId,
    });
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
