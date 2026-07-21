import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import {
  expandAllNeonplugChannelsForExport,
  type ExpandedNeonplugChannelRow,
} from './channelExpansion.ts';
import { channelToNeonplugChannel, neonplugContextsFromExportOptions } from './channelWire.ts';
import { serialiseNeonplugContactsForProfile } from './contacts.ts';
import {
  assignNeonplugExpandedChannelNumbers,
  resolveContactBookId,
  resolveRxGroupListId,
} from './exportContext.ts';
import {
  DEFAULT_NEONPLUG_PROFILE_ID,
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
} from './profiles.ts';
import { serialiseNeonplugRxGroups } from './rxGroups.ts';
import { collectNeonplugExportWarnings } from './warnings.ts';
import type { NeonplugChannel, NeonplugCodeplugData, NeonplugRadioInfo } from './wireTypes.ts';
import {
  deriveNeonplugZoneDerivedScanLists,
  ensureNeonplugDm32uvScanListsFloor,
} from './zoneDerivedScanLists.ts';
import { serialiseNeonplugZones } from './zones.ts';

export const NEONPLUG_CODEPLUG_VERSION = '1.0.0';
export const NEONPLUG_JSON_FILE_NAME = 'codeplug.json';

export type NeonplugSerialiseOptions = CpsExportOptions & {
  /** Override ISO exportDate for deterministic tests. */
  exportDate?: string;
};

export interface NeonplugSerialiseResult {
  /** Compact `codeplug.json` body. */
  content: string;
  data: NeonplugCodeplugData;
  warnings: string[];
}

function radioInfoForProfile(profileId: string): NeonplugRadioInfo {
  if (profileId === 'neonplug-uv5rmini') {
    return {
      model: 'UV5R-Mini',
      firmware: '',
      buildDate: '',
      vframes: {},
    };
  }
  return {
    model: 'DP570UV',
    firmware: '',
    buildDate: '',
    vframes: {},
  };
}

/** NeonPlug `radioInfo.model` string for a Studio profile id (merge / UI checks). */
export function neonplugRadioModelForProfile(profileId: string): string {
  return radioInfoForProfile(profileId).model;
}

function emptyCodeplug(radioInfo: NeonplugRadioInfo, exportDate: string): NeonplugCodeplugData {
  return {
    version: NEONPLUG_CODEPLUG_VERSION,
    exportDate,
    channels: [],
    zones: [],
    scanLists: [],
    contacts: [],
    rxGroups: [],
    radioIds: [],
    quickContacts: [],
    messages: [],
    digitalEmergencies: [],
    analogEmergencies: [],
    encryptionKeys: [],
    digitalEmergencyConfig: null,
    radioSettings: null,
    radioInfo,
  };
}

function channelById(assembled: AssembledBuild): Map<string, AssembledChannel> {
  return new Map(assembled.channels.map((row) => [row.entity.id, row]));
}

function resolveWireName(
  row: AssembledChannel,
  reserved: Set<string>,
  profileId: string,
  options: CpsExportOptions | undefined,
  warnings: string[],
): string {
  return applyWireNameLimits(row.wireName, row.entity, reserved, options, profileId, warnings);
}

function multiTalkGroupLibrarySlice(assembled: AssembledBuild) {
  return {
    talkGroups: assembled.talkGroups.map((row) => row.entity),
    digitalContacts: assembled.digitalContacts.map((row) => row.entity),
  };
}

interface Dm32uvChannelFkMaps {
  contactIdByEntityId: Map<string, number>;
  rxGroupIndexById: Map<string, number>;
  scanListIdByChannelId: Map<string, number>;
}

/** Serialise one expanded NeonPlug channel row into a wire object. */
function expandedRowToNeonplugChannel(
  expanded: ExpandedNeonplugChannelRow,
  number: number,
  source: AssembledChannel,
  profileId: string,
  options: CpsExportOptions | undefined,
  fks: Dm32uvChannelFkMaps,
): NeonplugChannel {
  const { scanContext, behaviourContext } = neonplugContextsFromExportOptions(options);
  return channelToNeonplugChannel(source.entity, {
    number,
    name: expanded.wireName,
    profileId,
    scanContext,
    behaviourContext,
    contactId: resolveContactBookId(expanded.txContactRef, fks.contactIdByEntityId),
    rxGroupListId: resolveRxGroupListId(expanded.rxGroupListId, fks.rxGroupIndexById),
    scanListId: fks.scanListIdByChannelId.get(expanded.sourceChannelId) ?? 0,
  });
}

/**
 * Build NeonPlug channels for DM32UV — expand (m×n + scratch), then sequential numbers 1…N.
 */
function serialiseDm32uvChannels(
  numbered: Array<{ row: ExpandedNeonplugChannelRow; number: number }>,
  assembled: AssembledBuild,
  profileId: string,
  options: CpsExportOptions | undefined,
  fks: Dm32uvChannelFkMaps,
): NeonplugChannel[] {
  const byId = channelById(assembled);
  const channels: NeonplugChannel[] = [];

  for (const { row, number } of numbered) {
    const source = byId.get(row.sourceChannelId);
    if (!source) continue;
    channels.push(expandedRowToNeonplugChannel(row, number, source, profileId, options, fks));
  }

  return channels;
}

/**
 * Build NeonPlug channels for UV5R-Mini — `number` is flat-memory slot from assemble.
 * Blank slots are omitted (not written as empty channel objects).
 */
function serialiseUv5rminiChannels(
  assembled: AssembledBuild,
  profileId: string,
  options: CpsExportOptions | undefined,
  warnings: string[],
): NeonplugChannel[] {
  const profile = getNeonplugProfile(profileId);
  if (isNeonplugDm32uvProfile(profile)) {
    throw new Error(`Expected neonplug-uv5rmini profile, got ${profileId}`);
  }

  const { scanContext, behaviourContext } = neonplugContextsFromExportOptions(options);
  const reserved = new Set<string>();
  const byId = channelById(assembled);
  const channels: NeonplugChannel[] = [];
  const max = profile.maxMemorySlots;

  const memorySlots = assembled.channelMemorySlots;
  if (memorySlots && memorySlots.length > 0) {
    for (const slot of memorySlots) {
      if (slot.channelId == null) continue;
      if (slot.slot > max) continue;
      if (channels.length >= max) break;
      const row = byId.get(slot.channelId);
      if (!row) continue;
      const name = resolveWireName(row, reserved, profileId, options, warnings);
      channels.push(
        channelToNeonplugChannel(row.entity, {
          number: slot.slot,
          name,
          profileId,
          scanContext,
          behaviourContext,
          contactId: 0,
          rxGroupListId: 0,
          scanListId: 0,
        }),
      );
    }
    return channels;
  }

  // Fallback when assemble did not attach memory slots — sequential like DM32.
  for (let i = 0; i < assembled.channels.length && channels.length < max; i++) {
    const row = assembled.channels[i]!;
    const name = resolveWireName(row, reserved, profileId, options, warnings);
    channels.push(
      channelToNeonplugChannel(row.entity, {
        number: i + 1,
        name,
        profileId,
        scanContext,
        behaviourContext,
        contactId: 0,
        rxGroupListId: 0,
        scanListId: 0,
      }),
    );
  }
  return channels;
}

export function serialiseNeonplugCodeplug(
  assembled: AssembledBuild,
  options?: NeonplugSerialiseOptions,
): NeonplugSerialiseResult {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_NEONPLUG_PROFILE_ID;
  const profile = getNeonplugProfile(profileId);
  const warnings = collectNeonplugExportWarnings(assembled, options);
  const exportDate = options?.exportDate ?? new Date().toISOString();
  const data = emptyCodeplug(radioInfoForProfile(profileId), exportDate);

  if (isNeonplugDm32uvProfile(profile)) {
    const { contacts, contactIdByEntityId } = serialiseNeonplugContactsForProfile(
      assembled,
      profileId,
      options,
      warnings,
    );
    const { rxGroups, rxGroupIndexById } = serialiseNeonplugRxGroups(
      assembled,
      profile,
      options,
      warnings,
    );

    const librarySlice = multiTalkGroupLibrarySlice(assembled);
    const expanded = expandAllNeonplugChannelsForExport(
      assembled,
      librarySlice,
      { ...options, profileId },
      warnings,
    );
    const { numbered, numbersBySourceChannelId } = assignNeonplugExpandedChannelNumbers(
      expanded,
      profile.maxChannels,
      warnings,
      profile.label,
    );

    const { scanLists, scanListIdByChannelId } = deriveNeonplugZoneDerivedScanLists(
      assembled,
      profile,
      numbersBySourceChannelId,
      options,
      warnings,
    );
    data.contacts = contacts;
    data.rxGroups = rxGroups;
    data.zones = serialiseNeonplugZones(
      assembled,
      profile,
      numbersBySourceChannelId,
      options,
      warnings,
    );
    data.scanLists = ensureNeonplugDm32uvScanListsFloor(scanLists, numbered[0]?.number);
    data.channels = serialiseDm32uvChannels(numbered, assembled, profileId, options, {
      contactIdByEntityId,
      rxGroupIndexById,
      scanListIdByChannelId,
    });
  } else {
    data.channels = serialiseUv5rminiChannels(assembled, profileId, options, warnings);
  }

  return {
    content: JSON.stringify(data),
    data,
    warnings,
  };
}
