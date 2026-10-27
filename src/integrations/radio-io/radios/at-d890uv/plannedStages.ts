/**
 * AT-D890UV planned stages (#1393): the steps a Write (or Read / Backup) will emit, with sizes,
 * declared before the first byte moves. Labels are exactly the `stage` strings emitted by
 * `protocol.ts` (download list), `digitalContactWrite.ts` and `satelliteWrite.ts`.
 *
 * Kept in its own file so protocol refactors never conflict with it. Weights are estimates in
 * wire bytes; the progress UI only needs them proportional. `plannedStages.test.ts` keeps the
 * labels honest against a scripted Write.
 */

import type { PlannedStage, RadioOperation, RadioPlanContext, RadioSession } from '../../types.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import {
  AT_D890_BLOCK_SIZE,
  AT_D890_LIMITS,
  AT_D890_NXDN,
  AT_D890_NXDN_LIST_SET_SPAN_BYTES,
  AT_D890_NXDN_SETTINGS,
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from './constants.ts';
import { packAtD890DigitalContacts } from './digitalContactCodec.ts';
import {
  AT_D890_ERASE_UNIT_BYTES,
  eraseUnitBaseFor,
  isAtD890EraseUnitBookkeepingAddress,
  listTouchedEraseUnits,
} from './eraseUnits.ts';
import { encodeAtD890WriteImageFromDownloadCache } from './hydration.ts';
import {
  applyAtD890WriteImageToCache,
  atD890UploadBankIntentFromOrganisation,
  listWriteChunks,
  type AtD890DownloadCache,
} from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';

/** Record counts the download weights are sized from. Nominal values suit a typical codeplug. */
interface Counts {
  channels: number;
  zones: number;
  scanLists: number;
  talkGroups: number;
  rxGroups: number;
  radioIds: number;
  amAir: number;
  amZones: number;
}

const NOMINAL_COUNTS: Counts = {
  channels: 200,
  zones: 10,
  scanLists: 10,
  talkGroups: 50,
  rxGroups: 10,
  radioIds: 2,
  amAir: 0,
  amZones: 0,
};

/** Nominal count of touched erase units when the real set is unknown before the read. */
const NOMINAL_TOUCHED_UNITS = 6;

const ZONE_RECORD_BYTES = D890_MAP.ZoneDataLength + D890_MAP.ZoneChannelsStride;

function countsFor(ctx: RadioPlanContext): Counts {
  const prepared = ctx.prepared;
  if (!prepared) return NOMINAL_COUNTS;
  const org: RadioWriteOrganisation = prepared.organisation;
  return {
    channels: prepared.channels.length,
    zones: org.zones?.length ?? NOMINAL_COUNTS.zones,
    scanLists: org.scanLists?.length ?? NOMINAL_COUNTS.scanLists,
    talkGroups: org.talkGroups?.length ?? NOMINAL_COUNTS.talkGroups,
    rxGroups: org.rxGroups?.length ?? NOMINAL_COUNTS.rxGroups,
    radioIds: org.radioIds?.length ?? NOMINAL_COUNTS.radioIds,
    amAir: org.amAirChannels?.length ?? 0,
    amZones: org.amZones?.length ?? 0,
  };
}

/** The download list, in the order `downloadAtD890SparseRegions` emits it. */
export function d890DownloadStages(counts: Counts = NOMINAL_COUNTS): PlannedStage[] {
  const L = AT_D890_LIMITS;
  const M = D890_MAP;
  // `downloadAtD890SparseRegions` emits one event per stage with `cur` = the stage's position in
  // the list, not progress inside it, so every stage is `coarse` (no per-step bar).
  return coarse([
    { label: 'Local info', weight: M.LocalInfoLength },
    {
      label: 'Optional settings / alarm',
      weight:
        M.OptionalSettingsMainLength +
        M.OptionalSettingsExtLength +
        M.OptionalSettingsAprsLength +
        M.AlarmBitmapLength +
        M.AlarmDataLength,
    },
    { label: 'APRS settings', weight: M.AprsConfigMainLength + M.AprsReceiveFiltersLength },
    { label: 'Channels', weight: L.CHANNEL_SET_BYTES + counts.channels * 2 * L.CHANNEL_CHUNK_SIZE },
    {
      label: 'Zones',
      weight: 2 * L.ZONE_SET_BYTES + 2 * M.ZoneTableBytes + counts.zones * ZONE_RECORD_BYTES,
    },
    { label: 'Scan lists', weight: L.SCAN_LIST_SET_BYTES + counts.scanLists * L.SCAN_LIST_STRIDE },
    {
      label: 'Talk groups',
      weight: L.TALKGROUP_SET_BYTES + counts.talkGroups * L.TALKGROUP_RECORD_SIZE,
    },
    { label: 'RX groups', weight: L.RX_GROUP_SET_BYTES + counts.rxGroups * L.RX_GROUP_STRIDE },
    {
      label: 'NXDN lists',
      weight:
        AT_D890_NXDN.ListIndexBytes +
        AT_D890_NXDN_LIST_SET_SPAN_BYTES +
        AT_D890_NXDN.RxGroupSetBytes +
        AT_D890_NXDN_SETTINGS.Bytes,
    },
    { label: 'Radio IDs', weight: L.RADIO_ID_SET_BYTES + counts.radioIds * L.RADIO_ID_STRIDE },
    { label: 'Master ID', weight: M.MasterIdLength },
    {
      label: 'AM airband',
      weight:
        M.AmAirSetLength +
        M.AmAirVfoLength +
        M.AmZoneSetLength +
        M.AmZoneAChannelLength +
        M.AmZoneScanLength +
        counts.amAir * M.AmAirDataLength +
        counts.amZones * M.AmZoneDataLength,
    },
  ]);
}

function coarse(stages: PlannedStage[]): PlannedStage[] {
  return stages.map((s) => ({ ...s, coarse: true }));
}

/** The session's download cache, when it holds one (then Write does not read again). */
function sessionCache(session: RadioSession | undefined): AtD890DownloadCache | null {
  const radio = session?.radio;
  if (!(radio instanceof AtD890uvProtocol)) return null;
  const cache = radio.getDownloadCache();
  return cache && cache.blocks.size > 0 ? cache : null;
}

const BLOCK = AT_D890_BLOCK_SIZE;

/**
 * Estimated 'Preserving untouched settings' units and 'Upload' bytes from the session cache, by
 * running the same cache merge the upload does, on a clone (no protocol change, nothing sent).
 * Returns `undefined` when the projection can't be encoded here; the caller then uses nominals.
 */
function writeWeightsFromCache(
  cache: AtD890DownloadCache,
  ctx: RadioPlanContext,
): { units: number; uploadBytes: number } | undefined {
  const prepared = ctx.prepared;
  if (!prepared) return undefined;
  try {
    const clone: AtD890DownloadCache = {
      firmware: cache.firmware,
      modelString: cache.modelString,
      blocks: new Map([...cache.blocks].map(([addr, data]) => [addr, data.slice()])),
    };
    const image = encodeAtD890WriteImageFromDownloadCache(
      clone,
      prepared.channels,
      prepared.organisation,
    );
    const intent = atD890UploadBankIntentFromOrganisation(prepared.organisation, prepared.channels);
    applyAtD890WriteImageToCache(clone, image, intent);
    const modelled = listWriteChunks(clone, AT_D890_SAFE_SKIP_WRITE_ADDR);
    const units = new Set(listTouchedEraseUnits(modelled.map((c) => c.address)));
    if ((intent.settingsPatches?.length ?? 0) > 0) {
      units.add(eraseUnitBaseFor(D890_MAP.OptionalSettingsMain));
    }
    // Transmitted = modelled blocks plus the non-empty co-resident blocks of the touched units.
    let uploadBytes = 0;
    for (const [base, data] of clone.blocks) {
      for (let off = 0; off < data.length; off += BLOCK) {
        const addr = base + off;
        if (addr === AT_D890_SAFE_SKIP_WRITE_ADDR) continue;
        if (isAtD890EraseUnitBookkeepingAddress(addr)) continue;
        if (!units.has(eraseUnitBaseFor(addr))) continue;
        if (data.subarray(off, off + BLOCK).some((b) => b !== 0xff)) uploadBytes += BLOCK;
      }
    }
    return { units: units.size, uploadBytes };
  } catch {
    return undefined;
  }
}

function nominalUploadBytes(counts: Counts): number {
  const L = AT_D890_LIMITS;
  return (
    counts.channels * L.CHANNEL_RECORD_SIZE +
    counts.zones * ZONE_RECORD_BYTES +
    counts.scanLists * L.SCAN_LIST_RECORD_SIZE +
    counts.talkGroups * L.TALKGROUP_RECORD_SIZE +
    counts.rxGroups * L.RX_GROUP_RECORD_SIZE +
    0x1000
  );
}

function contactStages(ctx: RadioPlanContext): PlannedStage[] {
  const contacts = ctx.prepared?.organisation.digitalContacts;
  const wanted = ctx.parts ? ctx.parts.contacts : (contacts?.length ?? 0) > 0;
  if (!wanted) return [];
  const optional = !contacts || contacts.length === 0;
  let bytes = 0x4000;
  if (contacts && contacts.length > 0) {
    try {
      const chunks = packAtD890DigitalContacts(contacts).stagingChunks;
      bytes = chunks.length * BLOCK;
    } catch {
      // The plan is advisory: a contact set the packer rejects keeps the nominal sizes, and the
      // Write itself reports the real error.
    }
  }
  const flag = optional ? { optional: true } : {};
  // The contact units are Studio-owned (#1406): no preserve read, only the write stage.
  return [{ label: 'Digital contacts', weight: bytes, ...flag }];
}

/** Bytes a settings-only Write sends: the non-empty blocks of the one settings erase unit (nominal). */
const SETTINGS_ONLY_UPLOAD_BYTES = 0x1000;

/** Settings alone (no codeplug or contacts): one erase unit, no download. */
function isSettingsOnly(ctx: RadioPlanContext): boolean {
  const p = ctx.parts;
  return p !== undefined && p.settings && !p.codeplug && !p.contacts;
}

function settingsOnlyPlan(): PlannedStage[] {
  // Keps after a restart are a separate session with no plan (#1406).
  return [
    { label: 'Preserving untouched settings', weight: AT_D890_ERASE_UNIT_BYTES },
    { label: 'Upload', weight: SETTINGS_ONLY_UPLOAD_BYTES },
  ];
}

function writePlan(ctx: RadioPlanContext): PlannedStage[] {
  if (isSettingsOnly(ctx)) return settingsOnlyPlan();
  const counts = countsFor(ctx);
  const cache = sessionCache(ctx.session);
  const stages: PlannedStage[] = [];
  // The download stages appear only when the Write has to read first (no in-session cache).
  if (!cache) stages.push(...d890DownloadStages(counts));

  const exact = cache ? writeWeightsFromCache(cache, ctx) : undefined;
  const units = exact?.units ?? NOMINAL_TOUCHED_UNITS;
  const uploadBytes = exact?.uploadBytes ?? nominalUploadBytes(counts);
  stages.push(
    {
      label: 'Preserving untouched settings',
      weight: units * AT_D890_ERASE_UNIT_BYTES,
    },
    { label: 'Upload', weight: uploadBytes },
  );
  stages.push(...contactStages(ctx));
  // Keps after a restart are a separate session with no plan, as on OpenGD77 (#1406).
  return stages;
}

/** `RadioDescriptor.planStages` for the AT-D890UV (stock and MM9PDY share it). */
export function planAtD890Stages(op: RadioOperation, ctx: RadioPlanContext): PlannedStage[] {
  switch (op) {
    case 'write':
      return writePlan(ctx);
    case 'read':
    case 'backup':
      // A Backup is the same download as a Read.
      return d890DownloadStages(NOMINAL_COUNTS);
    default:
      return [];
  }
}
