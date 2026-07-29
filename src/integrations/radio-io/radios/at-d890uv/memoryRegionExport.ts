/**
 * AT-D890UV raw memory-region export — read-only debug/RE tool (#756, #758).
 *
 * Dumps documented `D890_MAP` regions to raw bytes for offline diffing against codeplugs
 * written by the official Anytone CPS. This is the read-only differential workflow for
 * unresolved layouts (AmZone encode, etc.) described in
 * `docs/reference/radios/anytone/at-d890uv/memory-layout.md` — it does not decode or
 * interpret anything, and never emits a `W` frame.
 */

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import {
  atD890EnterProgram,
  atD890ExitProgram,
  atD890ProbeIdent,
  atD890ReadMemory,
} from './connection.ts';
import { negotiateAtD890ReadBlockSize } from './linkProbe.ts';
import {
  AT_D890_BLOCK_SIZE,
  AT_D890_DUMP_RX_GROUP_LISTS,
  AT_D890_DUMP_RX_GROUP_SET_BYTES,
  AT_D890_DUMP_SCAN_LISTS,
  AT_D890_LIMITS,
  D890_MAP,
} from './constants.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import type { BytePipe, ProgressFn } from '../../types.ts';

export interface AtD890MemoryRegionChunk {
  address: number;
  length: number;
}

export interface AtD890MemoryRegion {
  id: string;
  label: string;
  /** {@link AT_D890_MEMORY_REGION_GROUPS} id — the unit the debug page exports as one file. */
  group: string;
  chunks: AtD890MemoryRegionChunk[];
}

export interface AtD890MemoryRegionGroup {
  id: string;
  label: string;
}

/**
 * Higher-level export units — one export button per group on the debug page, even though
 * each group still lists its individual regions (address/size) for reference.
 */
export const AT_D890_MEMORY_REGION_GROUPS: readonly AtD890MemoryRegionGroup[] = [
  { id: 'device', label: 'Device' },
  { id: 'optionalSettings', label: 'Optional settings & alarm' },
  { id: 'aprs', label: 'APRS' },
  { id: 'channels', label: 'Channels' },
  { id: 'zones', label: 'Zones' },
  { id: 'scanLists', label: 'Scan lists' },
  { id: 'talkgroups', label: 'Talkgroups' },
  { id: 'receiveGroups', label: 'RX groups' },
  { id: 'radioIds', label: 'Radio IDs' },
  { id: 'airband', label: 'Airband (AM channels + zones)' },
];

/** `RadioIdSet` bitmap capacity (`0x20` bytes × 8 bits) — no separate named max elsewhere. */
const RADIO_ID_MAX = 0x20 * 8;

function totalLength(chunks: AtD890MemoryRegionChunk[]): number {
  return chunks.reduce((sum, c) => sum + c.length, 0);
}

/**
 * `ChannelData` is tiled: 32 blocks (`ChannelDataBlockCount`) spaced `ChannelDataBlockOffset`
 * apart, but only the first `ChannelDataBlockSize * ChannelDataOffset` bytes of each block
 * ever hold a real channel record — the rest of the `0x40000`-byte backed half is padding.
 * Dumping only the used prefix of each block keeps this a ~512 kB read instead of 8 MB.
 */
function channelDataChunks(): AtD890MemoryRegionChunk[] {
  const perBlock = D890_MAP.ChannelDataBlockSize * D890_MAP.ChannelDataOffset;
  const chunks: AtD890MemoryRegionChunk[] = [];
  for (let block = 0; block < D890_MAP.ChannelDataBlockCount; block++) {
    chunks.push({
      address: D890_MAP.ChannelData + block * D890_MAP.ChannelDataBlockOffset,
      length: perBlock,
    });
  }
  return chunks;
}

function region(
  id: string,
  label: string,
  group: string,
  address: number,
  length: number,
): AtD890MemoryRegion {
  return { id, label, group, chunks: [{ address, length }] };
}

/**
 * Every region documented in `D890_MAP` except `DigitalContact*`, which is block-hopped
 * and handled separately by {@link runAtD890DigitalContactsDump}.
 */
export const AT_D890_MEMORY_REGIONS: readonly AtD890MemoryRegion[] = [
  region('localInfo', 'Local info', 'device', D890_MAP.LocalInfo, D890_MAP.LocalInfoLength),
  region(
    'optionalSettingsMain',
    'Optional settings (main)',
    'optionalSettings',
    D890_MAP.OptionalSettingsMain,
    D890_MAP.OptionalSettingsMainLength,
  ),
  region(
    'optionalSettingsExt',
    'Optional settings (ext)',
    'optionalSettings',
    D890_MAP.OptionalSettingsExt,
    D890_MAP.OptionalSettingsExtLength,
  ),
  region(
    'optionalSettingsAprs',
    'Optional GPS info',
    'optionalSettings',
    D890_MAP.OptionalSettingsAprs,
    D890_MAP.OptionalSettingsAprsLength,
  ),
  region(
    'alarmBitmap',
    'Alarm bitmap',
    'optionalSettings',
    D890_MAP.AlarmBitmap,
    D890_MAP.AlarmBitmapLength,
  ),
  region(
    'alarmData',
    'Alarm data',
    'optionalSettings',
    D890_MAP.AlarmData,
    D890_MAP.AlarmDataLength,
  ),
  region(
    'aprsConfigMain',
    'APRS config (global)',
    'aprs',
    D890_MAP.AprsConfigMain,
    D890_MAP.AprsConfigMainLength,
  ),
  region(
    'aprsReceiveFilters',
    'APRS receive filters',
    'aprs',
    D890_MAP.AprsReceiveFilters,
    D890_MAP.AprsReceiveFiltersLength,
  ),
  region(
    'channelSet',
    'Channel occupancy bitmap',
    'channels',
    D890_MAP.ChannelSet,
    AT_D890_LIMITS.CHANNEL_SET_BYTES,
  ),
  { id: 'channelData', label: 'Channel bodies', group: 'channels', chunks: channelDataChunks() },
  region('zoneSet', 'Zone occupancy bitmap', 'zones', D890_MAP.ZoneSet, 0x20),
  region('zoneHide', 'Zone hidden bitmap', 'zones', D890_MAP.ZoneHide, 0x20),
  region(
    'zonesName',
    'Zone names',
    'zones',
    D890_MAP.ZonesName,
    AT_D890UV_LIMITS.ZONE_MAX * D890_MAP.ZoneDataOffset,
  ),
  region(
    'zoneChannels',
    'Zone membership',
    'zones',
    D890_MAP.ZoneChannels,
    AT_D890UV_LIMITS.ZONE_MAX * D890_MAP.ZoneChannelsStride,
  ),
  region(
    'zoneAChannel',
    'Zone A-channel table',
    'zones',
    D890_MAP.ZoneAChannel,
    D890_MAP.ZoneTableBytes,
  ),
  region(
    'zoneBChannel',
    'Zone B-channel table',
    'zones',
    D890_MAP.ZoneBChannel,
    D890_MAP.ZoneTableBytes,
  ),
  region('scanListSet', 'Scan-list occupancy bitmap', 'scanLists', D890_MAP.ScanListSet, 0x20),
  region(
    'scanListData',
    'Scan-list records',
    'scanLists',
    D890_MAP.ScanListData,
    AT_D890_DUMP_SCAN_LISTS * D890_MAP.ScanListStride,
  ),
  region('talkgroupSet', 'Talkgroup occupancy bitmap', 'talkgroups', D890_MAP.TalkgroupSet, 0x4f0),
  region(
    'talkgroupData',
    'Talkgroup records',
    'talkgroups',
    D890_MAP.TalkgroupData,
    AT_D890UV_LIMITS.TALK_GROUPS_MAX * D890_MAP.TalkgroupStride,
  ),
  region('talkgroupOrder', 'Talkgroup order table', 'talkgroups', D890_MAP.TalkgroupOrder, 0x1000),
  region(
    'receiveGroupSet',
    'RX-group occupancy bitmap',
    'receiveGroups',
    D890_MAP.ReceiveGroupSet,
    AT_D890_DUMP_RX_GROUP_SET_BYTES,
  ),
  region(
    'receiveGroupData',
    'RX-group records',
    'receiveGroups',
    D890_MAP.ReceiveGroupData,
    AT_D890_DUMP_RX_GROUP_LISTS * D890_MAP.ReceiveGroupStride,
  ),
  region('radioIdSet', 'Radio ID occupancy bitmap', 'radioIds', D890_MAP.RadioIdSet, 0x20),
  region(
    'radioIdData',
    'Radio ID records',
    'radioIds',
    D890_MAP.RadioIdData,
    RADIO_ID_MAX * D890_MAP.RadioIdStride,
  ),
  region('masterIdData', 'Master ID', 'radioIds', D890_MAP.MasterIdData, D890_MAP.MasterIdLength),
  region(
    'amAirSet',
    'AM airband occupancy bitmap',
    'airband',
    D890_MAP.AmAirSet,
    D890_MAP.AmAirSetLength,
  ),
  region(
    'amAirData',
    'AM airband channels',
    'airband',
    D890_MAP.AmAirData,
    D890_MAP.AmAirCount * D890_MAP.AmAirDataStride,
  ),
  region('amAirVfo', 'AM airband VFO', 'airband', D890_MAP.AmAirVfo, D890_MAP.AmAirVfoLength),
  region(
    'amZoneSet',
    'AM zone occupancy bitmap',
    'airband',
    D890_MAP.AmZoneSet,
    D890_MAP.AmZoneSetLength,
  ),
  region(
    'amZoneAChannel',
    'AM zone A-channel table',
    'airband',
    D890_MAP.AmZoneAChannel,
    D890_MAP.AmZoneAChannelLength,
  ),
  region(
    'amZoneScan',
    'AM zone scan bitmap',
    'airband',
    D890_MAP.AmZoneScan,
    D890_MAP.AmZoneCount * D890_MAP.AmZoneScanStride,
  ),
  region(
    'amZoneData',
    'AM zone records',
    'airband',
    D890_MAP.AmZoneData,
    D890_MAP.AmZoneCount * D890_MAP.AmZoneDataStride,
  ),
];

export interface AtD890MemoryDumpOpts {
  onProgress?: ProgressFn;
  signal?: AbortSignal;
}

async function enterAndNegotiate(
  pipe: BytePipe,
  signal?: AbortSignal,
): Promise<{ model: string; readBlockSize: number }> {
  await atD890EnterProgram(pipe, signal);
  const ident = await atD890ProbeIdent(pipe, signal);
  let readBlockSize: number;
  try {
    const { bestBlockSize } = await negotiateAtD890ReadBlockSize(pipe, D890_MAP.LocalInfo, {
      signal,
    });
    readBlockSize = bestBlockSize;
  } catch {
    readBlockSize = AT_D890_BLOCK_SIZE;
  }
  return { model: ident.model, readBlockSize };
}

async function readRegionRaw(
  pipe: BytePipe,
  regionDef: AtD890MemoryRegion,
  readBlockSize: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const out = new Uint8Array(totalLength(regionDef.chunks));
  let off = 0;
  for (const chunk of regionDef.chunks) {
    const data = await atD890ReadMemory(pipe, chunk.address, chunk.length, signal, readBlockSize);
    out.set(data, off);
    off += data.length;
  }
  return out;
}

export interface AtD890MemoryRegionDumpResult {
  model: string;
  region: AtD890MemoryRegion;
  bytes: Uint8Array;
  elapsedMs: number;
}

/** Dump a single named region — its own PROGRAM session. */
export async function runAtD890MemoryRegionDump(
  pipe: BytePipe,
  regionId: string,
  opts: AtD890MemoryDumpOpts = {},
): Promise<AtD890MemoryRegionDumpResult> {
  const regionDef = AT_D890_MEMORY_REGIONS.find((r) => r.id === regionId);
  if (!regionDef) throw new RangeError(`Unknown AT-D890UV memory region id: ${regionId}`);

  const { model, readBlockSize } = await enterAndNegotiate(pipe, opts.signal);
  reportProgress(
    opts.onProgress,
    { cur: 0, max: 1, msg: `Reading ${regionDef.label}…`, stage: regionDef.label },
    opts.signal,
  );
  const started = Date.now();
  const bytes = await readRegionRaw(pipe, regionDef, readBlockSize, opts.signal);
  const elapsedMs = Date.now() - started;
  await atD890ExitProgram(pipe);

  return { model, region: regionDef, bytes, elapsedMs };
}

export interface AtD890MemoryDumpAllResult {
  model: string;
  /** region id → raw bytes, in the order the regions were dumped. */
  files: Map<string, Uint8Array>;
  totalBytes: number;
  elapsedMs: number;
}

/** Dump `regions` in one PROGRAM session — shared by "dump all" and "dump group". */
async function dumpRegionsInSession(
  pipe: BytePipe,
  regions: readonly AtD890MemoryRegion[],
  opts: AtD890MemoryDumpOpts,
): Promise<AtD890MemoryDumpAllResult> {
  const { model, readBlockSize } = await enterAndNegotiate(pipe, opts.signal);
  const files = new Map<string, Uint8Array>();
  const started = Date.now();

  for (let i = 0; i < regions.length; i++) {
    throwIfAborted(opts.signal);
    const regionDef = regions[i]!;
    reportProgress(
      opts.onProgress,
      { cur: i, max: regions.length, msg: `Reading ${regionDef.label}…`, stage: regionDef.label },
      opts.signal,
    );
    files.set(regionDef.id, await readRegionRaw(pipe, regionDef, readBlockSize, opts.signal));
  }

  const elapsedMs = Date.now() - started;
  await atD890ExitProgram(pipe);

  let totalBytes = 0;
  for (const bytes of files.values()) totalBytes += bytes.length;

  return { model, files, totalBytes, elapsedMs };
}

/** Dump every region in {@link AT_D890_MEMORY_REGIONS} in one PROGRAM session. */
export async function runAtD890MemoryDumpAll(
  pipe: BytePipe,
  opts: AtD890MemoryDumpOpts = {},
): Promise<AtD890MemoryDumpAllResult> {
  return dumpRegionsInSession(pipe, AT_D890_MEMORY_REGIONS, opts);
}

export interface AtD890WriteVerifyMemoryReadResult extends AtD890MemoryDumpAllResult {
  /** 16-byte blocks read at staged addresses outside {@link AT_D890_MEMORY_REGIONS}. */
  spillChunks: Map<number, Uint8Array>;
}

/**
 * Modelled-region dump plus targeted reads for RMW-preserved staging spill addresses
 * (non-0xff bytes staged from touched erase units but outside every modelled bank).
 * One PROGRAM session — used by cross-session write verify.
 */
export async function runAtD890WriteVerifyMemoryRead(
  pipe: BytePipe,
  spillAddresses: readonly number[],
  opts: AtD890MemoryDumpOpts = {},
): Promise<AtD890WriteVerifyMemoryReadResult> {
  const { model, readBlockSize } = await enterAndNegotiate(pipe, opts.signal);
  const files = new Map<string, Uint8Array>();
  const started = Date.now();
  const regions = AT_D890_MEMORY_REGIONS;
  const totalSteps = regions.length + spillAddresses.length;

  for (let i = 0; i < regions.length; i++) {
    throwIfAborted(opts.signal);
    const regionDef = regions[i]!;
    reportProgress(
      opts.onProgress,
      { cur: i, max: totalSteps, msg: `Reading ${regionDef.label}…`, stage: regionDef.label },
      opts.signal,
    );
    files.set(regionDef.id, await readRegionRaw(pipe, regionDef, readBlockSize, opts.signal));
  }

  const spillChunks = new Map<number, Uint8Array>();
  for (let i = 0; i < spillAddresses.length; i++) {
    throwIfAborted(opts.signal);
    const address = spillAddresses[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: regions.length + i,
        max: totalSteps,
        msg: `Reading RMW spill 0x${address.toString(16)}…`,
        stage: 'RMW preserved spill',
      },
      opts.signal,
    );
    spillChunks.set(
      address,
      await atD890ReadMemory(pipe, address, AT_D890_BLOCK_SIZE, opts.signal, readBlockSize),
    );
  }

  const elapsedMs = Date.now() - started;
  await atD890ExitProgram(pipe);

  let totalBytes = 0;
  for (const bytes of files.values()) totalBytes += bytes.length;
  totalBytes += spillChunks.size * AT_D890_BLOCK_SIZE;

  return { model, files, totalBytes, elapsedMs, spillChunks };
}

/**
 * Dump every region belonging to one {@link AT_D890_MEMORY_REGION_GROUPS} entry — the unit
 * the debug page's per-group Export button uses.
 */
export async function runAtD890MemoryGroupDump(
  pipe: BytePipe,
  groupId: string,
  opts: AtD890MemoryDumpOpts = {},
): Promise<AtD890MemoryDumpAllResult> {
  const regions = AT_D890_MEMORY_REGIONS.filter((r) => r.group === groupId);
  if (regions.length === 0) {
    throw new RangeError(`Unknown AT-D890UV memory region group id: ${groupId}`);
  }
  return dumpRegionsInSession(pipe, regions, opts);
}

/** Read a little-endian u32 at `offset`. */
function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

/**
 * Read a `blockLength`/`stride` block-hopped linear span — de-interleaves the physical
 * `0x80000`-spaced blocks into a single contiguous byte stream. Mirrors anytone-cps
 * `Device::getDigitalContactDataBuffer` / the mirrored write-side addressing — see
 * memory-layout.md's DigitalContact section.
 */
async function readBlockHoppedLinear(
  pipe: BytePipe,
  base: number,
  linearLength: number,
  blockLength: number,
  stride: number,
  readBlockSize: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const aligned = Math.ceil(linearLength / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
  const out = new Uint8Array(aligned);
  for (let off = 0; off < aligned; off += AT_D890_BLOCK_SIZE) {
    const addrMod = off % blockLength;
    const block = (off - addrMod) / blockLength;
    const addr = base + block * stride + addrMod;
    const data = await atD890ReadMemory(pipe, addr, AT_D890_BLOCK_SIZE, signal, readBlockSize);
    out.set(data, off);
  }
  return out.subarray(0, linearLength);
}

export interface AtD890DigitalContactsDumpResult {
  model: string;
  contactCount: number;
  meta: Uint8Array;
  order: Uint8Array;
  contacts: Uint8Array;
  elapsedMs: number;
}

/**
 * Dump the digital-contact bank: meta header, de-interleaved order table, and
 * de-interleaved contact records. Own operation because the bank is large and block-hopped
 * — see {@link AT_D890_MEMORY_REGIONS} for everything else. Read-only; Studio never Reads
 * or Writes this bank in any modelled path (#759).
 */
export async function runAtD890DigitalContactsDump(
  pipe: BytePipe,
  opts: AtD890MemoryDumpOpts = {},
): Promise<AtD890DigitalContactsDumpResult> {
  const { model, readBlockSize } = await enterAndNegotiate(pipe, opts.signal);
  const started = Date.now();

  reportProgress(
    opts.onProgress,
    { cur: 0, max: 3, msg: 'Reading contact meta…', stage: 'Meta' },
    opts.signal,
  );
  const meta = await atD890ReadMemory(
    pipe,
    D890_MAP.DigitalContactMeta,
    D890_MAP.DigitalContactMetaLength,
    opts.signal,
    readBlockSize,
  );
  const contactCount = readU32LE(meta, 0);
  const endAddress = readU32LE(meta, 4);

  const relative = Math.max(0, endAddress - D890_MAP.DigitalContactData);
  const dataBlock = Math.floor(relative / D890_MAP.DigitalContactDataStride);
  const dataLinearLength =
    dataBlock * D890_MAP.DigitalContactDataBlockLength +
    (relative - dataBlock * D890_MAP.DigitalContactDataStride);

  reportProgress(
    opts.onProgress,
    { cur: 1, max: 3, msg: `Reading order table for ${contactCount} contacts…`, stage: 'Order' },
    opts.signal,
  );
  const orderLinearLength = contactCount * D890_MAP.DigitalContactOrderEntrySize;
  const order = await readBlockHoppedLinear(
    pipe,
    D890_MAP.DigitalContactOrder,
    orderLinearLength,
    D890_MAP.DigitalContactOrderBlockLength,
    D890_MAP.DigitalContactOrderBlockStride,
    readBlockSize,
    opts.signal,
  );

  reportProgress(
    opts.onProgress,
    { cur: 2, max: 3, msg: `Reading ${contactCount} contact records…`, stage: 'Contacts' },
    opts.signal,
  );
  const contacts = await readBlockHoppedLinear(
    pipe,
    D890_MAP.DigitalContactData,
    dataLinearLength,
    D890_MAP.DigitalContactDataBlockLength,
    D890_MAP.DigitalContactDataStride,
    readBlockSize,
    opts.signal,
  );

  const elapsedMs = Date.now() - started;
  await atD890ExitProgram(pipe);

  return { model, contactCount, meta, order, contacts, elapsedMs };
}
