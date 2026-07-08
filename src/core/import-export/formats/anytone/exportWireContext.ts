import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { resolveMaxNameLength } from '@core/import-export/channelExpansion/exportWireNames.ts';
import {
  finalizeWireName,
  uniqueWireName,
} from '@core/import-export/channelExpansion/shortenName.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { anytoneChannelWireName } from './exportChannelWire.ts';
import { isAmAirbandBankChannel, isFmBroadcastBankChannel } from './receiveOnlyBanks.ts';
import { DEFAULT_ANYTONE_PROFILE_ID } from './profiles.ts';

export const ANYTONE_RECEIVE_BANK_NAME_WIDTH = 16;

/** CPS receive-bank name column — fixed 16-char field (space-padded). */
export function padReceiveBankName(name: string): string {
  return name
    .padEnd(ANYTONE_RECEIVE_BANK_NAME_WIDTH, ' ')
    .slice(0, ANYTONE_RECEIVE_BANK_NAME_WIDTH);
}

/** Shorten zone / scan list / RX group list / digital contact wire names at export. */
export function applyAnytoneListWireNameLimits(
  baseWireName: string,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const base = baseWireName.trim();

  if (!shorten || maxLen == null) {
    const name = sanitiseAsciiWireString(uniqueWireName(base, reserved));
    reserved.add(name);
    if (maxLen != null && name.length > maxLen) {
      warnings.push(`Wire name "${name}" exceeds ${maxLen} characters`);
    }
    return name;
  }

  return sanitiseAsciiWireString(
    finalizeWireName(base, reserved, maxLen, { allowCallsignSuffixDowngrade: false }, warnings),
  );
}

export interface AnytoneExportWireContext {
  channelWireNames: ReadonlyMap<string, string>;
  talkGroupWireNames: ReadonlyMap<string, string>;
  digitalContactWireNames: ReadonlyMap<string, string>;
  zoneWireNames: ReadonlyMap<string, string>;
  scanListWireNames: ReadonlyMap<string, string>;
  rxGroupListWireNames: ReadonlyMap<string, string>;
  channelWireName(channelId: string): string;
  memberChannelWireName(channelId: string): string;
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
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytoneExportWireContext {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const reserved = new Set<string>();
  const wireOptions = { reserved, warnings };

  const channelWireNames = new Map<string, string>();
  for (const row of assembled.channels) {
    channelWireNames.set(
      row.entity.id,
      anytoneChannelWireName(row, wireOptions, options, profileId),
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
      applyAnytoneListWireNameLimits(row.wireName, reserved, options, profileId, warnings),
    );
  }

  const zoneWireNames = new Map<string, string>();
  for (const zone of assembled.zones) {
    zoneWireNames.set(
      zone.zoneId,
      applyAnytoneListWireNameLimits(zone.wireName, reserved, options, profileId, warnings),
    );
  }

  const scanListWireNames = new Map<string, string>();
  for (const scanList of assembled.scanLists) {
    scanListWireNames.set(
      scanList.scanListId,
      applyAnytoneListWireNameLimits(scanList.wireName, reserved, options, profileId, warnings),
    );
  }

  const rxGroupListWireNames = new Map<string, string>();
  for (const list of assembled.rxGroupLists) {
    rxGroupListWireNames.set(
      list.entity.id,
      applyAnytoneListWireNameLimits(list.wireName, reserved, options, profileId, warnings),
    );
  }

  const receiveBankWireName = (channelId: string): string => {
    const base = channelWireNames.get(channelId) ?? '';
    return padReceiveBankName(base);
  };

  const memberChannelWireName = (channelId: string): string => {
    const row = channelRowById(assembled, channelId);
    if (!row) return '';
    if (isAmAirbandBankChannel(row.entity) || isFmBroadcastBankChannel(row.entity)) {
      return receiveBankWireName(channelId);
    }
    return channelWireNames.get(channelId) ?? '';
  };

  return {
    channelWireNames,
    talkGroupWireNames,
    digitalContactWireNames,
    zoneWireNames,
    scanListWireNames,
    rxGroupListWireNames,
    channelWireName: (channelId) => channelWireNames.get(channelId) ?? '',
    memberChannelWireName,
    receiveBankWireName,
    talkGroupWireName: (talkGroupId) => talkGroupWireNames.get(talkGroupId) ?? '',
    digitalContactWireName: (contactId) => digitalContactWireNames.get(contactId) ?? '',
    zoneWireName: (zoneId) => zoneWireNames.get(zoneId) ?? '',
    scanListWireName: (scanListId) => scanListWireNames.get(scanListId) ?? '',
    rxGroupListWireName: (listId) => rxGroupListWireNames.get(listId) ?? '',
  };
}
