/**
 * AT-D890UV CloneImageRadio — sparse 16-byte selective download/upload.
 */

import { AT_D890_EMPTY_WRITE_CACHE_MESSAGE } from './hydration.ts';
import {
  applyAtD890WriteImageToCache,
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
  getCacheBytes,
  listWriteChunks,
  zoneChannelsAddress,
  zoneNameAddress,
  scanListAddress,
  talkgroupAddress,
  receiveGroupAddress,
  radioIdAddress,
  amAirDataAddress,
  amZoneDataAddress,
  alignedSpanForAtD890Region,
  AT_D890_CHANNEL_LOCATION_UNIT_BASE,
  type AtD890DownloadCache,
  type AtD890UploadBankIntent,
} from './memory.ts';
import {
  AT_D890_BLOCK_SIZE,
  AT_D890_LIMITS,
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from './constants.ts';
import { listSetBits } from './bitmap.ts';
import {
  atD890EnterProgram,
  atD890ExitProgram,
  atD890ProbeIdent,
  atD890ReadMemory,
  atD890WriteMemory,
  atD890ModelHints,
} from './connection.ts';
import { negotiateAtD890ReadBlockSize } from './linkProbe.ts';
import { decodeChannelsFromAtD890Cache, encodeChannelsIntoAtD890Image } from './channelCodec.ts';
import { refreshScanListSetFromRadioBase } from './scanListCodec.ts';
import {
  assertAtD890SentinelRegionsPlausible,
  cloneAtD890SentinelSnapshot,
  compareAtD890SentinelSnapshots,
  snapshotAtD890SentinelRegions,
  type AtD890SentinelCompareResult,
  type AtD890SentinelSnapshot,
} from './sentinelVerify.ts';
import {
  AT_D890_ERASE_UNIT_BYTES,
  eraseUnitBaseFor,
  isAtD890EraseUnitBookkeepingAddress,
  listTouchedEraseUnits,
  readSpanForEraseUnit,
} from './eraseUnits.ts';
import { assertAtD890LocalInfoPlausible } from './identityCheck.ts';
import {
  assertPreservedBytesMatchFreshRead,
  type AtD890StagingChunk,
  listSparseStagingChunks,
  modelledAddressSetFromChunks,
  overlayModelledChunksOntoUnit,
  preWriteChunksFromFreshUnits,
} from './sparseEraseRmw.ts';
import {
  assertAtD890SettingsPatchesPermitted,
  type AtD890RadioSettingsSnapshot,
  type AtD890SettingsPatch,
} from './settingsFields.ts';
import {
  applyAtD890SettingsPatchesToUnit,
  assertAtD890SentinelSpansNotErased,
  atD890PatchMaskMap,
} from './settingsPatch.ts';
import {
  captureAtD890WriteStagingSnapshot,
  cloneAtD890WriteStagingSnapshot,
  type AtD890WriteStagingSnapshot,
} from './writeMemoryVerify.ts';
import { assertAtD890TransmitAddress } from './writableExtents.ts';
import { restoreAtD890FromBackup, type AtD890RestoreArchive } from './restoreFromBackup.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import type { BytePipe, CloneImageRadio, IdentResult, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';

export type { AtD890DownloadCache };

const DOWNLOAD_STAGES = [
  'Local info',
  'Optional settings / alarm',
  'APRS settings',
  'Channels',
  'Zones',
  'Scan lists',
  'Talk groups',
  'RX groups',
  'Radio IDs',
  'Master ID',
  'AM airband',
] as const;

async function readRegion(
  pipe: BytePipe,
  cache: AtD890DownloadCache,
  address: number,
  length: number,
  signal?: AbortSignal,
  readBlockSize?: number,
): Promise<void> {
  const data = await atD890ReadMemory(pipe, address, length, signal, readBlockSize);
  putCacheBytes(cache, address, data);
}

export async function downloadAtD890SparseRegions(
  pipe: BytePipe,
  cache: AtD890DownloadCache,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal; readBlockSize?: number },
): Promise<void> {
  const signal = opts?.signal;
  const readBlockSize = opts?.readBlockSize;
  let stageIdx = 0;
  const stage = (msg: string) => {
    reportProgress(
      opts?.onProgress,
      { cur: stageIdx, max: DOWNLOAD_STAGES.length, msg, stage: DOWNLOAD_STAGES[stageIdx] },
      signal,
    );
    stageIdx += 1;
  };

  stage('Reading local info…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.LocalInfo,
    D890_MAP.LocalInfoLength,
    signal,
    readBlockSize,
  );

  stage('Reading optional settings and alarm…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.OptionalSettingsMain,
    D890_MAP.OptionalSettingsMainLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.OptionalSettingsExt,
    D890_MAP.OptionalSettingsExtLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.OptionalSettingsAprs,
    D890_MAP.OptionalSettingsAprsLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.SettingsStore,
    D890_MAP.SettingsStoreLength,
    signal,
    readBlockSize,
  );
  await readRegion(pipe, cache, D890_MAP.DtmfList, D890_MAP.DtmfListLength, signal, readBlockSize);
  await readRegion(
    pipe,
    cache,
    D890_MAP.OptionalSettingsExtTail,
    D890_MAP.OptionalSettingsExtTailLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AlarmBitmap,
    D890_MAP.AlarmBitmapLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AlarmData,
    D890_MAP.AlarmDataLength,
    signal,
    readBlockSize,
  );

  stage('Reading APRS settings…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.AprsConfigMain,
    D890_MAP.AprsConfigMainLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AprsReceiveFilters,
    D890_MAP.AprsReceiveFiltersLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AprsTextTail,
    D890_MAP.AprsTextTailLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.GpsInfoTail,
    D890_MAP.GpsInfoTailLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.GpsZoneSwitch,
    D890_MAP.GpsZoneSwitchLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AprsBeaconNames,
    D890_MAP.AprsBeaconNamesLength,
    signal,
    readBlockSize,
  );

  stage('Reading channel bitmap…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.ChannelSet,
    AT_D890_LIMITS.CHANNEL_SET_BYTES,
    signal,
    readBlockSize,
  );
  const channelSet = getCacheBytes(cache, D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  for (const idx of listSetBits(channelSet)) {
    throwIfAborted(signal);
    const primary = await atD890ReadMemory(
      pipe,
      channelPrimaryAddress(idx),
      AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
      signal,
      readBlockSize,
    );
    putCacheBytes(cache, channelPrimaryAddress(idx), primary);
    const secondary = await atD890ReadMemory(
      pipe,
      channelSecondaryAddress(idx),
      AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
      signal,
      readBlockSize,
    );
    putCacheBytes(cache, channelSecondaryAddress(idx), secondary);
  }

  // VFO A/B (slots 4000/4001) are normally bitmap-set and already read above. This read makes
  // sure they are captured even when the bits are clear, and names them `vfo-channels`.
  await readRegion(
    pipe,
    cache,
    D890_MAP.VfoChannels,
    D890_MAP.VfoChannelsLength,
    signal,
    readBlockSize,
  );

  stage('Reading zones…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.ZoneSet,
    AT_D890_LIMITS.ZONE_SET_BYTES,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.ZoneHide,
    AT_D890_LIMITS.ZONE_SET_BYTES,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.ZoneAChannel,
    D890_MAP.ZoneTableBytes,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.ZoneBChannel,
    D890_MAP.ZoneTableBytes,
    signal,
    readBlockSize,
  );
  const zoneSet = getCacheBytes(cache, D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES);
  for (const idx of listSetBits(zoneSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      zoneNameAddress(idx),
      D890_MAP.ZoneDataLength,
      signal,
      readBlockSize,
    );
    await readRegion(
      pipe,
      cache,
      zoneChannelsAddress(idx),
      D890_MAP.ZoneChannelsStride,
      signal,
      readBlockSize,
    );
  }

  stage('Reading scan lists…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.ScanListSet,
    AT_D890_LIMITS.SCAN_LIST_SET_BYTES,
    signal,
    readBlockSize,
  );
  const scanSet = getCacheBytes(cache, D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
  for (const idx of listSetBits(scanSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      scanListAddress(idx),
      AT_D890_LIMITS.SCAN_LIST_STRIDE,
      signal,
      readBlockSize,
    );
  }

  stage('Reading talk groups…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.TalkgroupSet,
    AT_D890_LIMITS.TALKGROUP_SET_BYTES,
    signal,
    readBlockSize,
  );
  const tgSet = getCacheBytes(cache, D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  for (const idx of listSetBits(tgSet, true)) {
    throwIfAborted(signal);
    const slot = talkgroupAddress(idx);
    const { start, length } = alignedSpanForAtD890Region(
      slot,
      AT_D890_LIMITS.TALKGROUP_RECORD_SIZE,
    );
    await readRegion(pipe, cache, start, length, signal, readBlockSize);
  }

  stage('Reading RX groups…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.ReceiveGroupSet,
    AT_D890_LIMITS.RX_GROUP_SET_BYTES,
    signal,
    readBlockSize,
  );
  const rxSet = getCacheBytes(cache, D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
  for (const idx of listSetBits(rxSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      receiveGroupAddress(idx),
      AT_D890_LIMITS.RX_GROUP_STRIDE,
      signal,
      readBlockSize,
    );
  }

  stage('Reading operator radio IDs…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.RadioIdSet,
    AT_D890_LIMITS.RADIO_ID_SET_BYTES,
    signal,
    readBlockSize,
  );
  const ridSet = getCacheBytes(cache, D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
  for (const idx of listSetBits(ridSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      radioIdAddress(idx),
      AT_D890_LIMITS.RADIO_ID_STRIDE,
      signal,
      readBlockSize,
    );
  }

  stage('Reading master radio ID…');
  await readRegion(
    pipe,
    cache,
    D890_MAP.MasterIdData,
    D890_MAP.MasterIdLength,
    signal,
    readBlockSize,
  );

  stage('Reading AM airband…');
  await readRegion(pipe, cache, D890_MAP.AmAirSet, D890_MAP.AmAirSetLength, signal, readBlockSize);
  const amAirSet = getCacheBytes(cache, D890_MAP.AmAirSet, D890_MAP.AmAirSetLength);
  for (const idx of listSetBits(amAirSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      amAirDataAddress(idx),
      D890_MAP.AmAirDataLength,
      signal,
      readBlockSize,
    );
  }
  await readRegion(pipe, cache, D890_MAP.AmAirVfo, D890_MAP.AmAirVfoLength, signal, readBlockSize);

  await readRegion(
    pipe,
    cache,
    D890_MAP.AmZoneSet,
    D890_MAP.AmZoneSetLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AmZoneAChannel,
    D890_MAP.AmZoneAChannelLength,
    signal,
    readBlockSize,
  );
  await readRegion(
    pipe,
    cache,
    D890_MAP.AmZoneScan,
    D890_MAP.AmZoneScanLength,
    signal,
    readBlockSize,
  );
  const amZoneSet = getCacheBytes(cache, D890_MAP.AmZoneSet, D890_MAP.AmZoneSetLength);
  for (const idx of listSetBits(amZoneSet)) {
    throwIfAborted(signal);
    await readRegion(
      pipe,
      cache,
      amZoneDataAddress(idx),
      D890_MAP.AmZoneDataLength,
      signal,
      readBlockSize,
    );
  }
}

export class AtD890uvProtocol implements CloneImageRadio {
  private pipe: BytePipe | null = null;
  private cache: AtD890DownloadCache | null = null;
  private programming = false;
  private readBlockSize = AT_D890_BLOCK_SIZE;
  private identRaw: Uint8Array | null = null;
  private identBandCode = 0;
  private lastUploadSentinelBefore: AtD890SentinelSnapshot | undefined;
  private lastUploadStagingSnapshot: AtD890WriteStagingSnapshot | undefined;
  private lastUploadSettingsPatches: readonly AtD890SettingsPatch[] | undefined;
  private uploadBankIntent: AtD890UploadBankIntent = {
    replaceAmAirBank: false,
    replaceTalkgroupOrder: false,
  };

  /** Band code from the connection ident (byte 8); `0` before connect. */
  getIdentBandCode(): number {
    return this.identBandCode;
  }

  getNegotiatedReadBlockSize(): number {
    return this.readBlockSize;
  }

  /** The 16 ident bytes from the last connect, or null before one. Byte 8 is the variant. */
  getIdentRaw(): Uint8Array | null {
    return this.identRaw ? this.identRaw.slice() : null;
  }

  getDownloadCache(): AtD890DownloadCache | null {
    return this.cache;
  }

  seedDownloadCache(seed: AtD890DownloadCache): void {
    if (seed.blocks.size === 0) {
      throw new RadioProtocolError('AT-D890UV hydration has no sparse blocks to write');
    }
    const blocks = new Map<number, Uint8Array>();
    const normalized: AtD890DownloadCache = {
      firmware: seed.firmware,
      modelString: seed.modelString,
      blocks,
    };
    for (const [address, data] of seed.blocks) {
      putCacheBytes(normalized, address, data);
    }
    this.cache = normalized;
  }

  setUploadBankIntent(intent: AtD890UploadBankIntent): void {
    this.uploadBankIntent = intent;
  }

  async connect(
    pipe: BytePipe,
    opts?: { signal?: AbortSignal; settleScale?: number },
  ): Promise<IdentResult> {
    void opts?.settleScale;
    this.pipe = pipe;
    this.cache = { blocks: new Map() };
    this.programming = false;
    this.readBlockSize = AT_D890_BLOCK_SIZE;

    await atD890EnterProgram(pipe, opts?.signal);
    this.programming = true;
    const ident = await atD890ProbeIdent(pipe, opts?.signal);
    this.identRaw = ident.raw.slice();
    this.cache.modelString = ident.model;
    this.cache.firmware = ident.version;
    this.identBandCode = ident.bandCode;

    try {
      const { bestBlockSize } = await negotiateAtD890ReadBlockSize(pipe, D890_MAP.LocalInfo, {
        signal: opts?.signal,
      });
      this.readBlockSize = bestBlockSize;
    } catch {
      this.readBlockSize = AT_D890_BLOCK_SIZE;
    }

    return {
      raw: ident.raw,
      firmwareHint: ident.version,
      modelHints: [...atD890ModelHints()],
    };
  }

  async disconnect(): Promise<void> {
    const pipe = this.pipe;
    try {
      if (pipe && this.programming) {
        await atD890ExitProgram(pipe);
      }
    } catch {
      // Best-effort — port may already be closing.
    } finally {
      this.pipe = null;
      this.programming = false;
      this.readBlockSize = AT_D890_BLOCK_SIZE;
    }
  }

  /**
   * Drop PROGRAM mode without sending END — staged writes are not committed to flash.
   * Call on failed or aborted upload before disconnect().
   */
  abandonProgramMode(): void {
    this.programming = false;
  }

  /** Pre-Write sentinel snapshot from the last successful {@link upload} — consumed once. */
  takeUploadSentinelSnapshot(): AtD890SentinelSnapshot | undefined {
    const snap = this.lastUploadSentinelBefore;
    this.lastUploadSentinelBefore = undefined;
    return snap ? cloneAtD890SentinelSnapshot(snap) : undefined;
  }

  /** Settings patches the last successful {@link upload} applied — consumed once. */
  takeUploadSettingsPatches(): readonly AtD890SettingsPatch[] | undefined {
    const patches = this.lastUploadSettingsPatches;
    this.lastUploadSettingsPatches = undefined;
    return patches?.map((p) => ({
      fieldId: p.fieldId,
      address: p.address,
      bytes: p.bytes.slice(),
      mask: p.mask.slice(),
    }));
  }

  /** Staging chunks from the last successful {@link upload} — consumed once. */
  takeUploadStagingSnapshot(): AtD890WriteStagingSnapshot | undefined {
    const snap = this.lastUploadStagingSnapshot;
    this.lastUploadStagingSnapshot = undefined;
    return snap ? cloneAtD890WriteStagingSnapshot(snap) : undefined;
  }

  /** Re-read never-write regions and diff against a pre-Write snapshot (cross-session). */
  async verifySentinelRegionsAgainst(
    before: AtD890SentinelSnapshot,
    opts?: { signal?: AbortSignal; settingsPatches?: readonly AtD890SettingsPatch[] },
  ): Promise<AtD890SentinelCompareResult> {
    if (!this.pipe) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    if (!this.programming) {
      await atD890EnterProgram(this.pipe, opts?.signal);
      this.programming = true;
    }
    const after = await snapshotAtD890SentinelRegions(this.pipe, opts?.signal, this.readBlockSize);
    return compareAtD890SentinelSnapshots(before, after, opts?.settingsPatches);
  }

  async download(opts: { onProgress?: ProgressFn; signal?: AbortSignal }): Promise<MemoryMap> {
    if (!this.pipe || !this.cache || !this.programming) {
      throw new RadioProtocolError('AT-D890UV not connected / not in PROGRAM mode');
    }
    this.cache.blocks = new Map();
    await downloadAtD890SparseRegions(this.pipe, this.cache, {
      ...opts,
      readBlockSize: this.readBlockSize,
    });
    return cacheToMemoryMap(this.cache);
  }

  async upload(
    image: MemoryMap,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (!this.pipe || !this.cache) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    assertAtD890SettingsPatchesPermitted(this.uploadBankIntent.settingsPatches ?? []);
    if (!this.programming) {
      await atD890EnterProgram(this.pipe, opts.signal);
      this.programming = true;
    }
    const freshScanListSet = await atD890ReadMemory(
      this.pipe,
      D890_MAP.ScanListSet,
      AT_D890_LIMITS.SCAN_LIST_SET_BYTES,
      opts.signal,
      this.readBlockSize,
    );
    refreshScanListSetFromRadioBase(image, freshScanListSet);

    if (this.cache.blocks.size === 0) {
      throw new RadioProtocolError(AT_D890_EMPTY_WRITE_CACHE_MESSAGE);
    }

    applyAtD890WriteImageToCache(this.cache, image, this.uploadBankIntent);

    if (this.cache.blocks.size === 0) {
      throw new RadioProtocolError(
        'AT-D890UV upload has no modelled sparse blocks — assemble the build before Write',
      );
    }

    const preUploadCache: AtD890DownloadCache = {
      blocks: new Map(
        [...this.cache.blocks.entries()].map(([address, data]) => [address, data.slice()]),
      ),
    };

    const modelledChunks = listWriteChunks(this.cache, AT_D890_SAFE_SKIP_WRITE_ADDR);
    await this.rmwStageAndTransmit({
      updateDownloadCache: true,
      modelledChunks,
      touchedUnits: listTouchedEraseUnits(modelledChunks.map((c) => c.address)),
      settingsPatches: this.uploadBankIntent.settingsPatches ?? [],
      ownsLocationUnit: this.uploadBankIntent.channelLocationTable !== undefined,
      preUploadCache,
      opts,
    });
  }

  /**
   * Settings-only Write: apply `patches` to the fresh read of the settings erase unit and
   * transmit that unit's non-`0xff` blocks, nothing else. Goes through the same RMW core as
   * {@link upload}: sentinel and LocalInfo plausibility, marker filter, transmit fence limited to
   * erase unit `0x3500000`, staging snapshot, and the no-`END` failure path. Needs no Download.
   */
  async uploadSettingsPatches(
    patches: readonly AtD890SettingsPatch[],
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (!this.pipe) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    if (patches.length === 0) {
      throw new RadioProtocolError('AT-D890UV settings upload has no patches');
    }
    assertAtD890SettingsPatchesPermitted(patches);
    if (!this.programming) {
      await atD890EnterProgram(this.pipe, opts.signal);
      this.programming = true;
    }
    await this.rmwStageAndTransmit({
      // A settings-only Write must not fabricate a download cache: a later codeplug Write relies
      // on an empty cache to trigger the in-session download and the empty-cache guard.
      updateDownloadCache: (this.cache?.blocks.size ?? 0) > 0,
      modelledChunks: [],
      touchedUnits: [eraseUnitBaseFor(D890_MAP.OptionalSettingsMain)],
      settingsPatches: patches,
      ownsLocationUnit: false,
      opts,
    });
  }

  /** Cheap read of the settings spans (W9): no other reads, no cache changes. */
  async readSettingsSnapshot(opts?: {
    signal?: AbortSignal;
  }): Promise<AtD890RadioSettingsSnapshot> {
    const pipe = this.pipe;
    if (!pipe) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    if (!this.programming) {
      await atD890EnterProgram(pipe, opts?.signal);
      this.programming = true;
    }
    const read = (address: number, length: number) =>
      atD890ReadMemory(pipe, address, length, opts?.signal, this.readBlockSize);
    const localInfo = await read(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
    const main = await read(D890_MAP.OptionalSettingsMain, D890_MAP.OptionalSettingsMainLength);
    const ext = await read(D890_MAP.OptionalSettingsExt, D890_MAP.OptionalSettingsExtLength);
    const masterId = await read(D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
    return { localInfo, main, ext, masterId, bandCode: this.identBandCode };
  }

  /**
   * Erase-unit read-modify-write: fresh-read each touched unit, overlay the modelled chunks, apply
   * the settings patches, stage the non-`0xff` blocks and transmit them. Shared by {@link upload}
   * and {@link uploadSettingsPatches}; every guard below applies to both.
   */
  private async rmwStageAndTransmit(args: {
    modelledChunks: readonly AtD890StagingChunk[];
    touchedUnits: readonly number[];
    settingsPatches: readonly AtD890SettingsPatch[];
    ownsLocationUnit: boolean;
    /** Mirror transmitted blocks into the download cache (false: leave it untouched). */
    updateDownloadCache: boolean;
    /** Cache as it stood before the write image was applied; unset skips the staleness guard. */
    preUploadCache?: AtD890DownloadCache;
    opts: { onProgress?: ProgressFn; signal?: AbortSignal };
  }): Promise<void> {
    const pipe = this.pipe;
    if (!pipe) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    const { modelledChunks, settingsPatches, ownsLocationUnit, preUploadCache, opts } = args;
    // Last line of defence: nothing outside the allow-list reaches the wire, whoever built the patch.
    assertAtD890SettingsPatchesPermitted(settingsPatches);
    const modelledAddresses = modelledAddressSetFromChunks(modelledChunks);
    const touchedUnits = [...args.touchedUnits];
    const touchedUnitSet = new Set(touchedUnits);
    const settingsUnit = eraseUnitBaseFor(D890_MAP.OptionalSettingsMain);
    if (settingsPatches.length > 0 && !touchedUnitSet.has(settingsUnit)) {
      touchedUnits.push(settingsUnit);
      touchedUnitSet.add(settingsUnit);
    }
    if (!ownsLocationUnit && touchedUnitSet.has(AT_D890_CHANNEL_LOCATION_UNIT_BASE)) {
      // Stock intents clear the pair from the cache; reaching here is a staging bug.
      throw new RadioProtocolError(
        'AT-D890UV stock Write must not touch the MM9PDY channel location table',
      );
    }
    const transmitGuard = (address: number) => assertAtD890TransmitAddress(address, touchedUnitSet);

    try {
      const sentinelBefore = await snapshotAtD890SentinelRegions(
        pipe,
        opts.signal,
        this.readBlockSize,
      );
      assertAtD890SentinelRegionsPlausible(sentinelBefore);
      this.lastUploadSentinelBefore = cloneAtD890SentinelSnapshot(sentinelBefore);
      this.lastUploadSettingsPatches = settingsPatches;

      const freshUnits = new Map<number, Uint8Array>();
      for (let u = 0; u < touchedUnits.length; u++) {
        throwIfAborted(opts.signal);
        const unitBase = touchedUnits[u]!;
        const { start, length } = readSpanForEraseUnit(unitBase);
        reportProgress(
          opts.onProgress,
          {
            cur: u,
            max: touchedUnits.length,
            msg: `Reading erase unit 0x${unitBase.toString(16)}…`,
            stage: 'Preserving untouched settings',
          },
          opts.signal,
        );
        const data = await atD890ReadMemory(pipe, start, length, opts.signal, this.readBlockSize);
        freshUnits.set(unitBase, data);
      }

      const liveLocal = await atD890ReadMemory(
        pipe,
        D890_MAP.LocalInfo,
        D890_MAP.LocalInfoLength,
        opts.signal,
        this.readBlockSize,
      );
      assertAtD890LocalInfoPlausible(liveLocal);

      const mergedUnits = new Map<number, Uint8Array>();
      for (const [base, data] of freshUnits) {
        if (ownsLocationUnit && base === AT_D890_CHANNEL_LOCATION_UNIT_BASE) {
          // Studio owns this whole unit. Start from erased flash, never from the fresh
          // read: the factory test pattern (and any older table) must not be carried over.
          mergedUnits.set(base, new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff));
          continue;
        }
        mergedUnits.set(base, data.slice());
      }
      for (const unitBase of touchedUnits) {
        const unitChunks = modelledChunks.filter((c) => eraseUnitBaseFor(c.address) === unitBase);
        overlayModelledChunksOntoUnit(unitBase, mergedUnits.get(unitBase)!, unitChunks);
      }

      if (settingsPatches.length > 0) {
        const merged = mergedUnits.get(settingsUnit);
        if (!merged) {
          throw new RadioProtocolError(
            'AT-D890UV settings patch has no fresh read of the optional-settings erase unit',
          );
        }
        // Field patches ride on the fresh read. The patched blocks are not "modelled": the
        // preserved check below allows only the patched bits to differ.
        applyAtD890SettingsPatchesToUnit(settingsUnit, merged, settingsPatches);
        assertAtD890SentinelSpansNotErased(settingsUnit, merged);
      }

      const stagingChunks = listSparseStagingChunks(mergedUnits, modelledAddresses);
      assertPreservedBytesMatchFreshRead(
        stagingChunks,
        freshUnits,
        modelledAddresses,
        atD890PatchMaskMap(settingsPatches),
      );
      // Defence in depth: markers are already omitted in listSparseStagingChunks.
      // Keep this filter so a future staging change cannot put them on the wire.
      //
      // ⚠️ DO NOT REMOVE, AND DO NOT ADD A FLAG TO RE-ENABLE THIS.
      // +0x3fbf0 and +0x3fff0 in every 0x40000 erase unit are the radio's own flash
      // sector-management markers, not codeplug payload. The radio maintains them itself;
      // the official Anytone CPS never writes them.
      //
      // fe6955e3's whole-unit RMW writeback swept them into our transmitted set. For three
      // days every Studio write was ACKed, reached flash, and landed 0x40000 above the
      // address we sent while the live bank kept its old contents — the radio was
      // unprogrammable and the cause was invisible.
      //
      // Restoring these writes as a controlled experiment on 2026-07-30 made the radio
      // display "Program error please initialise the radio!" and factory-reset itself,
      // destroying the operator's configuration. Writing these addresses is not a
      // diagnostic option. See docs/reference/radios/anytone/at-d890uv/flash-sectors.md
      const transmittedChunks = stagingChunks.filter(
        (c) =>
          c.address !== AT_D890_SAFE_SKIP_WRITE_ADDR &&
          !isAtD890EraseUnitBookkeepingAddress(c.address),
      );
      const preWriteFromRadio = preWriteChunksFromFreshUnits(transmittedChunks, freshUnits);
      this.lastUploadStagingSnapshot = captureAtD890WriteStagingSnapshot(transmittedChunks, {
        preWriteFromRadio,
        downloadCache: preUploadCache,
      });

      reportProgress(
        opts.onProgress,
        {
          cur: 0,
          max: transmittedChunks.length || 1,
          msg: 'Writing sparse regions…',
          stage: 'Upload',
        },
        opts.signal,
      );

      for (let i = 0; i < transmittedChunks.length; i++) {
        throwIfAborted(opts.signal);
        const { address, data } = transmittedChunks[i]!;
        reportProgress(
          opts.onProgress,
          {
            cur: i + 1,
            max: transmittedChunks.length,
            msg: `Writing 0x${address.toString(16)}`,
            stage: 'Upload',
          },
          opts.signal,
        );
        await atD890WriteMemory(pipe, address, data, opts.signal, { transmitGuard });
        if (args.updateDownloadCache && this.cache) putCacheBytes(this.cache, address, data);
      }
    } catch (err) {
      this.lastUploadSentinelBefore = undefined;
      this.lastUploadSettingsPatches = undefined;
      this.lastUploadStagingSnapshot = undefined;
      this.abandonProgramMode();
      throw err;
    }
  }

  decodeChannels(image: MemoryMap): RadioChannelDto[] {
    void image;
    if (!this.cache) return [];
    return decodeChannelsFromAtD890Cache(this.cache);
  }

  encodeChannels(image: MemoryMap, channels: readonly RadioChannelDto[]): MemoryMap {
    return encodeChannelsIntoAtD890Image(image, channels);
  }

  readFirmware(image: MemoryMap): string | undefined {
    void image;
    return this.cache?.firmware;
  }

  async restoreFromBackup(
    archive: AtD890RestoreArchive,
    opts: { regionIds: readonly string[]; onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<void> {
    if (!this.pipe) {
      throw new RadioProtocolError('AT-D890UV not connected');
    }
    if (!this.programming) {
      await atD890EnterProgram(this.pipe, opts.signal);
      this.programming = true;
    }
    try {
      await restoreAtD890FromBackup(this.pipe, archive, {
        ...opts,
        readBlockSize: this.readBlockSize,
      });
    } catch (err) {
      this.abandonProgramMode();
      throw err;
    }
  }
}

export function createAtD890uvProtocol(): CloneImageRadio {
  return new AtD890uvProtocol();
}
