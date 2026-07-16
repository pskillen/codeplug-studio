import type { ChannelBehaviourContext } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { APRS_COL, APRS_HEADERS } from './columns.ts';
import { APRS_ROW_DEFAULTS } from './aprsDefaults.ts';
import { formatCsv } from './csvWrite.ts';
import type { AnytonePreparedExport } from './prepareExportAssembly.ts';
import { DEFAULT_ANYTONE_PROFILE_ID, getAnytoneProfile } from './profiles.ts';
import {
  formatAnytoneAprsAutoTxIntervalWire,
  formatAnytoneAprsCallType,
  formatAnytoneAprsChannelSlot,
  formatAnytoneAprsIntervalSec,
  formatAnytoneAprsTargetDmrId,
  formatAnytoneAprsTimeslot,
  formatAnytonePositionSource,
} from './aprsWireFormat.ts';
import {
  resolveAmAirChannelSlotById,
  resolveDmrChannelSlotById,
  resolveFmBroadcastChannelSlotById,
} from './exportChannelSlots.ts';

function padRow(headers: string[], values: Record<string, string>): string[] {
  return headers.map((header) => values[header] ?? '');
}

const SLOT_COLUMN_GROUPS: readonly (readonly [
  keyof typeof APRS_COL,
  keyof typeof APRS_COL,
  keyof typeof APRS_COL,
  keyof typeof APRS_COL,
])[] = [
  ['channel1', 'slot1', 'aprsTg1', 'callType1'],
  ['channel2', 'slot2', 'aprsTg2', 'callType2'],
  ['channel3', 'slot3', 'aprsTg3', 'callType3'],
  ['channel4', 'slot4', 'aprsTg4', 'callType4'],
  ['channel5', 'slot5', 'aprsTg5', 'callType5'],
  ['channel6', 'slot6', 'aprsTg6', 'callType6'],
  ['channel7', 'slot7', 'aprsTg7', 'callType7'],
  ['channel8', 'slot8', 'aprsTg8', 'callType8'],
] as const;

function mergeChannelSlotMaps(
  dmr: Map<string, number>,
  amAir: Map<string, number>,
  fmBroadcast: Map<string, number>,
): Map<string, number> {
  const merged = new Map<string, number>();
  for (const [id, slot] of dmr) merged.set(id, slot);
  for (const [id, slot] of amAir) merged.set(id, slot);
  for (const [id, slot] of fmBroadcast) merged.set(id, slot);
  return merged;
}

function serialiseAprsSlot(
  slot: AprsChannelSlot | undefined,
  channelSlotById: Map<string, number>,
  channelNameById: Map<string, string>,
  warnings: string[],
): Record<string, string> {
  if (!slot) {
    return {
      channel: '0',
      slot: '0',
      aprsTg: '0',
      callType: '0',
    };
  }
  if (slot.channelRef == null) {
    return {
      channel: '0',
      slot: formatAnytoneAprsTimeslot(slot.timeslot),
      aprsTg: formatAnytoneAprsTargetDmrId(slot.targetDmrId),
      callType: formatAnytoneAprsCallType(slot.callType),
    };
  }

  const channelId = slot.channelRef.id;
  const wireSlot = channelSlotById.get(channelId);
  if (wireSlot == null) {
    const label = channelNameById.get(channelId) ?? channelId;
    warnings.push(
      `APRS slot references channel "${label}" which is not in this Anytone export (missing from build or unsupported bank); exporting channel wire as 0`,
    );
  }

  return {
    channel: formatAnytoneAprsChannelSlot(wireSlot ?? null),
    slot: formatAnytoneAprsTimeslot(slot.timeslot),
    aprsTg: formatAnytoneAprsTargetDmrId(slot.targetDmrId),
    callType: formatAnytoneAprsCallType(slot.callType),
  };
}

export function buildAnytoneExportChannelSlotById(
  assembled: AssembledBuild,
  prepared: AnytonePreparedExport,
  context?: ChannelBehaviourContext,
): Map<string, number> {
  return mergeChannelSlotMaps(
    resolveDmrChannelSlotById(assembled, prepared, context),
    resolveAmAirChannelSlotById(assembled, context),
    resolveFmBroadcastChannelSlotById(assembled, context),
  );
}

export function serialiseAprsCsv(
  config: AprsConfiguration,
  assembled: AssembledBuild,
  prepared: AnytonePreparedExport,
  options?: CpsExportOptions,
  warnings: string[] = [],
): string {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const profile = getAnytoneProfile(profileId);
  const slots = config.channelSlots ?? [];

  if (slots.length > profile.maxAprsSlots) {
    warnings.push(
      `APRS configuration has ${slots.length} channel slots; exporting first ${profile.maxAprsSlots} only`,
    );
  }

  const channelSlotById = buildAnytoneExportChannelSlotById(
    assembled,
    prepared,
    options?.channelBehaviourContext,
  );
  const channelNameById = new Map(
    assembled.channels.map((row) => [row.entity.id, row.entity.name]),
  );
  const position = formatAnytonePositionSource(config.positionSource, config.fixedLocation);
  const values: Record<string, string> = { ...APRS_ROW_DEFAULTS };

  values[APRS_COL.manualTxIntervalSec] = formatAnytoneAprsIntervalSec(config.manualTxIntervalSec);
  values[APRS_COL.autoTxIntervalSec] = formatAnytoneAprsAutoTxIntervalWire(
    config.autoTxIntervalSec,
    warnings,
  );
  values[APRS_COL.fixedLocationBeacon] = position.fixedLocationBeacon;
  values[APRS_COL.latiDegree] = position.latitude.degrees;
  values[APRS_COL.latiMinInt] = position.latitude.minInt;
  values[APRS_COL.latiMinMark] = position.latitude.minMark;
  values[APRS_COL.northOrSouth] = position.latitude.hemisphere;
  values[APRS_COL.longtiDegree] = position.longitude.degrees;
  values[APRS_COL.longtiMinInt] = position.longitude.minInt;
  values[APRS_COL.longtiMinMark] = position.longitude.minMark;
  values[APRS_COL.eastOrWest] = position.longitude.hemisphere;

  const exportSlots = slots.slice(0, profile.maxAprsSlots);
  for (let index = 0; index < SLOT_COLUMN_GROUPS.length; index++) {
    const [channelKey, slotKey, aprsTgKey, callTypeKey] = SLOT_COLUMN_GROUPS[index]!;
    const slotWire = serialiseAprsSlot(
      exportSlots[index],
      channelSlotById,
      channelNameById,
      warnings,
    );
    values[APRS_COL[channelKey]] = slotWire.channel;
    values[APRS_COL[slotKey]] = slotWire.slot;
    values[APRS_COL[aprsTgKey]] = slotWire.aprsTg;
    values[APRS_COL[callTypeKey]] = slotWire.callType;
  }

  const row = padRow(APRS_HEADERS, values);
  return formatCsv(APRS_HEADERS, [row]);
}

export function hasAnytoneAprsExport(assembled: AssembledBuild): boolean {
  return assembled.aprsConfiguration != null;
}
