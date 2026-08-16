import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { AssembledBuild, AssembledChannel, LibrarySlice } from '@core/services/assemble.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  overridesFromAssembledWireNames,
  resolveWireNamesFromOptions,
} from '@core/services/resolveWireNames.ts';
import { pushWireNameResolutionWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import { anytoneChannelWireName } from './exportChannelWire.ts';
import { isAmAirbandBankChannel, isFmBroadcastBankChannel } from './receiveOnlyBanks.ts';
import { DEFAULT_ANYTONE_PROFILE_ID } from './profiles.ts';
import { zoneIdFromDerivedScanListId } from './zoneDerivedScanLists.ts';
import { anytoneChannelExpansionById, type ExpandedAnytoneChannelRow } from './channelExpansion.ts';

export const ANYTONE_RECEIVE_BANK_NAME_WIDTH = 16;

/** CPS receive-bank name column — fixed 16-char field (space-padded). */
export function padReceiveBankName(name: string): string {
  return name
    .padEnd(ANYTONE_RECEIVE_BANK_NAME_WIDTH, ' ')
    .slice(0, ANYTONE_RECEIVE_BANK_NAME_WIDTH);
}

/** @deprecated Use applyListWireNameLimits from channelExpansion/listWireNames.ts */
export const applyAnytoneListWireNameLimits = applyListWireNameLimits;

export interface AnytoneExportWireContext {
  channelWireNames: ReadonlyMap<string, string>;
  talkGroupWireNames: ReadonlyMap<string, string>;
  digitalContactWireNames: ReadonlyMap<string, string>;
  zoneWireNames: ReadonlyMap<string, string>;
  scanListWireNames: ReadonlyMap<string, string>;
  rxGroupListWireNames: ReadonlyMap<string, string>;
  expansionByChannelId: ReadonlyMap<string, readonly ExpandedAnytoneChannelRow[]>;
  channelWireName(channelId: string): string;
  memberChannelWireName(channelId: string): string;
  memberChannelWireNames(channelId: string): readonly string[];
  receiveBankWireName(channelId: string): string;
  talkGroupWireName(talkGroupId: string): string;
  digitalContactWireName(contactId: string): string;
  zoneWireName(zoneId: string): string;
  scanListWireName(scanListId: string): string;
  rxGroupListWireName(listId: string): string;
}

function channelRowById(
  assembled: AssembledBuild,
  channelId: string,
): AssembledChannel | undefined {
  return assembled.channels.find((row) => row.entity.id === channelId);
}

/** One canonical wire name per entity for a single Anytone export pass. */
export function buildAnytoneExportWireContext(
  assembled: AssembledBuild,
  library: LibrarySlice,
  expandedChannels: ExpandedAnytoneChannelRow[],
  options?: CpsExportOptions,
  warnings: ExportWarning[] = [],
): AnytoneExportWireContext {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  // Channel m×n/timeslot-clone composition stays format-specific (anytoneChannelWireName)
  // — only its own reserved set, scoped to channels, matching resolveWireNames' per-kind
  // scoping (no more cross-kind sharing with zone/scanList/talkGroup/contact/rxGroupList).
  const reserved = new Set<string>();
  for (const row of expandedChannels) {
    reserved.add(row.wireName);
  }
  const wireOptions = { reserved, warnings };

  const expansionByChannelId = anytoneChannelExpansionById(expandedChannels);

  const channelWireNames = new Map<string, string>();
  for (const row of expandedChannels) {
    if (!channelWireNames.has(row.sourceChannelId)) {
      channelWireNames.set(row.sourceChannelId, row.wireName);
    }
  }
  for (const assembledRow of assembled.channels) {
    if (channelWireNames.has(assembledRow.entity.id)) continue;
    channelWireNames.set(
      assembledRow.entity.id,
      anytoneChannelWireName(assembledRow, wireOptions, options, profileId),
    );
  }

  const talkGroupResolutions = resolveWireNamesFromOptions({
    library,
    entityKind: 'talkGroup',
    formatId: 'anytone',
    profileId,
    options: options ?? {},
    overrides: overridesFromAssembledWireNames(assembled.talkGroups, (row) => row.entity.id),
  });
  const talkGroupWireNames = new Map<string, string>();
  for (const resolution of talkGroupResolutions) {
    talkGroupWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Talk group',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId,
    });
  }

  const contactResolutions = resolveWireNamesFromOptions({
    library,
    entityKind: 'contact',
    formatId: 'anytone',
    profileId,
    options: options ?? {},
    overrides: options?.contactOverrides,
  });
  const digitalContactWireNames = new Map<string, string>();
  for (const resolution of contactResolutions) {
    digitalContactWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Contact',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId,
    });
  }

  const zoneResolutions = resolveWireNamesFromOptions({
    library,
    entityKind: 'zone',
    formatId: 'anytone',
    profileId,
    options: options ?? {},
    overrides: overridesFromAssembledWireNames(assembled.zones, (row) => row.zoneId),
  });
  const zoneWireNames = new Map<string, string>();
  for (const resolution of zoneResolutions) {
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

  const scanListResolutions = new Map(
    resolveWireNamesFromOptions({
      library,
      entityKind: 'scanList',
      formatId: 'anytone',
      profileId,
      options: options ?? {},
      overrides: overridesFromAssembledWireNames(assembled.scanLists, (row) => row.scanListId),
    }).map((resolution) => {
      pushWireNameResolutionWarning(warnings, {
        entityKind: 'Scan list',
        remediation: resolution.remediation,
        original: resolution.override ?? resolution.libraryName,
        exported: resolution.effective,
        limit: resolution.limit,
        profileId,
      });
      return [resolution.libraryEntityId, resolution.effective] as const;
    }),
  );
  const scanListWireNames = new Map<string, string>();
  for (const scanList of assembled.scanLists) {
    const derivedZoneId = zoneIdFromDerivedScanListId(scanList.scanListId);
    if (derivedZoneId != null) {
      const zoneWire = zoneWireNames.get(derivedZoneId);
      if (zoneWire != null) {
        scanListWireNames.set(scanList.scanListId, zoneWire);
        continue;
      }
    }
    // Zone-derived scan lists have no matching `library.scanLists` entry — the resolver
    // only resolves real library scan lists, so fall back to the assembled wire name
    // (already shortened by `deriveAnytoneZoneDerivedScanLists`) when there's no match.
    scanListWireNames.set(
      scanList.scanListId,
      scanListResolutions.get(scanList.scanListId) ?? scanList.wireName,
    );
  }

  const rxGroupListResolutions = resolveWireNamesFromOptions({
    library,
    entityKind: 'rxGroupList',
    formatId: 'anytone',
    profileId,
    options: options ?? {},
    overrides: overridesFromAssembledWireNames(assembled.rxGroupLists, (row) => row.entity.id),
  });
  const rxGroupListWireNames = new Map<string, string>();
  for (const resolution of rxGroupListResolutions) {
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

  const receiveBankWireName = (channelId: string): string => {
    const base = channelWireNames.get(channelId) ?? '';
    return padReceiveBankName(base);
  };

  const memberChannelWireName = (channelId: string): string => {
    const names = memberChannelWireNames(channelId);
    return names[0] ?? '';
  };

  const memberChannelWireNames = (channelId: string): string[] => {
    const expanded = expansionByChannelId.get(channelId);
    if (expanded && expanded.length > 0) {
      return expanded.map((row) => row.wireName);
    }
    const row = channelRowById(assembled, channelId);
    if (!row) return [];
    if (
      isAmAirbandBankChannel(row.entity, options?.channelBehaviourContext) ||
      isFmBroadcastBankChannel(row.entity, options?.channelBehaviourContext)
    ) {
      return [receiveBankWireName(channelId)];
    }
    return [channelWireNames.get(channelId) ?? ''];
  };

  return {
    channelWireNames,
    talkGroupWireNames,
    digitalContactWireNames,
    zoneWireNames,
    scanListWireNames,
    rxGroupListWireNames,
    expansionByChannelId,
    channelWireName: (channelId) => channelWireNames.get(channelId) ?? '',
    memberChannelWireName,
    memberChannelWireNames,
    receiveBankWireName,
    talkGroupWireName: (talkGroupId) => talkGroupWireNames.get(talkGroupId) ?? '',
    digitalContactWireName: (contactId) => digitalContactWireNames.get(contactId) ?? '',
    zoneWireName: (zoneId) => zoneWireNames.get(zoneId) ?? '',
    scanListWireName: (scanListId) => scanListWireNames.get(scanListId) ?? '',
    rxGroupListWireName: (listId) => rxGroupListWireNames.get(listId) ?? '',
  };
}
