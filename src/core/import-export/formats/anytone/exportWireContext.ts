import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
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
  expandedChannels: ExpandedAnytoneChannelRow[],
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytoneExportWireContext {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
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

  const talkGroupWireNames = new Map<string, string>();
  for (const row of assembled.talkGroups) {
    talkGroupWireNames.set(
      row.entity.id,
      applyTalkGroupWireNameLimits(
        row.wireName,
        row.entity,
        reserved,
        options,
        profileId,
        warnings,
      ),
    );
  }

  const digitalContactWireNames = new Map<string, string>();
  for (const row of assembled.digitalContacts) {
    digitalContactWireNames.set(
      row.entity.id,
      applyListWireNameLimits(row.wireName, reserved, options, profileId, warnings),
    );
  }

  const zoneWireNames = new Map<string, string>();
  for (const zone of assembled.zones) {
    zoneWireNames.set(
      zone.zoneId,
      applyListWireNameLimits(zone.wireName, reserved, options, profileId, warnings),
    );
  }

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
    scanListWireNames.set(
      scanList.scanListId,
      applyListWireNameLimits(scanList.wireName, reserved, options, profileId, warnings),
    );
  }

  const rxGroupListWireNames = new Map<string, string>();
  for (const list of assembled.rxGroupLists) {
    rxGroupListWireNames.set(
      list.entity.id,
      applyListWireNameLimits(list.wireName, reserved, options, profileId, warnings),
    );
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
    if (isAmAirbandBankChannel(row.entity) || isFmBroadcastBankChannel(row.entity)) {
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
