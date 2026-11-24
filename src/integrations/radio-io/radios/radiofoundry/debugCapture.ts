/**
 * Read-only RadioFoundry debug capture: guarded connect, codeplug blocks, optional ID-database area 2,
 * packed as an inspect-only partial archive.
 */
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import { summariseRadioFoundryBuild } from '@core/radios/radiofoundry/firmware.ts';
import { debugOpenPort, DebugWrongFirmwareError } from '../../debugHandoff.ts';
import type {
  RadioBackupCapturedVia,
  RadioBackupManifestV1,
  RadioBackupRegionV1,
} from '../../backup/types.ts';
import { RADIO_BACKUP_FORMAT, RADIO_BACKUP_VERSION } from '../../backup/types.ts';
import { readDebugFrame, encodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import type { BytePipe, ProgressFn } from '../../types.ts';
import {
  BLOCK_SIZE,
  DM32_RADIOFOUNDRY_MODEL_ID,
  EEPROM_IMAGE_END,
  FLASH_IMAGE_START,
  HANDSHAKE_ERROR,
  servedBlockAddresses,
} from './constants.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

function blockInsideLayout(addr: number, layout: RadioFoundryInfoLayout): boolean {
  if (addr % BLOCK_SIZE !== 0 || addr < 0) return false;
  const inEeprom = addr + BLOCK_SIZE <= layout.eepromEnd;
  const inFlash = addr >= layout.flashStart && addr + BLOCK_SIZE <= layout.imageEnd;
  return inEeprom || inFlash;
}
import { createRadioFoundryDebugGuard } from './debugGuard.ts';
import {
  RADIOFOUNDRY_DEBUG_HOTSPOT_HINT,
  RADIOFOUNDRY_DEBUG_NO_ANSWER,
  RADIOFOUNDRY_DEBUG_OPENGD77_FOUND,
} from './debugText.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from './idDatabase.ts';
import {
  RadioFoundryCableProtocol,
  type RadioFoundryCableProtocolOptions,
  type RadioFoundryImageBlock,
} from './protocol.ts';
import type { RadioFoundryCableBoard } from './board.ts';
import { parseRadioFoundryVersionText } from './version.ts';

export interface RadioFoundryInfoLayout {
  eepromEnd: number;
  flashStart: number;
  imageEnd: number;
  physicalBase: number;
}

export function parseRadioFoundryInfoLayout(
  info: Uint8Array,
  board: RadioFoundryCableBoard,
): RadioFoundryInfoLayout {
  const eepromEnd = readU32(info, 8);
  const flashStart = readU32(info, 12);
  const imageEnd = Math.min(readU32(info, 16), board.limits.IMAGE_END);
  const physicalBase = readU32(info, 20);
  return { eepromEnd, flashStart, imageEnd, physicalBase };
}

export function radioFoundryDebugAddresses(
  layout: RadioFoundryInfoLayout,
  opts: { area2: boolean },
): { codeplug: number[]; area2: number[] } {
  const codeplug = servedBlockAddresses(
    RADIOFOUNDRY_IMAGE_SIZE,
    layout.eepromEnd,
    layout.flashStart,
  ).filter((addr) => blockInsideLayout(addr, layout));
  const area2: number[] = [];
  if (opts.area2) {
    for (
      let addr = DMR_ID_DATABASE_AREA2_ADDRESS;
      addr + BLOCK_SIZE <= layout.imageEnd;
      addr += BLOCK_SIZE
    ) {
      area2.push(addr);
    }
  }
  return { codeplug, area2 };
}

export interface RadioFoundryDebugCapture {
  modelId: string;
  capturedAt: string;
  capturedVia: RadioBackupCapturedVia;
  info: Uint8Array;
  versionText?: string;
  iddb?: Uint8Array;
  layout: RadioFoundryInfoLayout;
  codeplug: Map<number, RadioFoundryImageBlock>;
  area2?: Map<number, RadioFoundryImageBlock>;
}

const IDDB_COMMAND = 0x1f;

export async function captureRadioFoundryDebugPipe(
  pipe: BytePipe,
  board: RadioFoundryCableBoard,
  opts?: {
    signal?: AbortSignal;
    onProgress?: ProgressFn;
    capturedVia?: RadioBackupCapturedVia;
    includeArea2?: boolean;
    protocolOptions?: RadioFoundryCableProtocolOptions;
    /** When handshake looks like OpenGD77, leave the raw transport open on the error. */
    keepPortOnOpenGd77?: boolean;
  },
): Promise<RadioFoundryDebugCapture> {
  const signal = opts?.signal;
  const guard = createRadioFoundryDebugGuard(pipe, board, signal);
  const radio = new RadioFoundryCableProtocol(board, opts?.protocolOptions);
  const capturedVia = opts?.capturedVia ?? 'web-serial';
  let leavePortOpen = false;
  try {
    opts?.onProgress?.({ cur: 0, max: 0, msg: 'Connecting…', stage: 'Connect' });
    await radio.connect(guard.pipe);
    const replies = radio.connectReplies();
    if (!replies) throw new Error('RadioFoundry connect left no INFO reply.');
    const layout = parseRadioFoundryInfoLayout(replies.info, board);
    guard.limitImageEnd(layout.imageEnd);
    const addresses = radioFoundryDebugAddresses(layout, { area2: !!opts?.includeArea2 });
    const codeplug = await radio.readImageBlocks(addresses.codeplug, {
      signal,
      onProgress: opts?.onProgress,
      stage: 'Codeplug',
    });
    let iddb: Uint8Array | undefined;
    const seq = 7;
    await guard.pipe.write(encodeDebugFrame(IDDB_COMMAND, seq, new Uint8Array(4)));
    try {
      const frame = await readDebugFrame(guard.pipe, 1000);
      if (
        frame.command === (IDDB_COMMAND | 0x80) &&
        frame.seq === seq &&
        frame.payload.length >= 1 &&
        frame.payload[0] === 0
      ) {
        iddb = frame.payload.subarray(1);
      } else {
        await guard.pipe.drain?.();
      }
    } catch {
      await guard.pipe.drain?.();
    }
    let area2: Map<number, RadioFoundryImageBlock> | undefined;
    if (opts?.includeArea2 && addresses.area2.length > 0) {
      area2 = await radio.readImageBlocks(addresses.area2, {
        signal,
        onProgress: opts?.onProgress,
        stage: 'ID database',
        msg: 'Reading ID database area 2',
      });
    }
    signal?.throwIfAborted();
    return {
      modelId: board.modelId,
      capturedAt: new Date().toISOString(),
      capturedVia,
      info: replies.info.slice(),
      ...(replies.versionText != null ? { versionText: replies.versionText } : {}),
      ...(iddb ? { iddb } : {}),
      layout,
      codeplug,
      ...(area2 ? { area2 } : {}),
    };
  } catch (err) {
    if (err instanceof RadioProtocolError && err.message === HANDSHAKE_ERROR) {
      const received = guard.received().slice();
      const hasDash = received.includes(0x2d);
      let hasRfFrame = false;
      for (let i = 0; i < received.length - 1; i += 1) {
        if (received[i] === 0xa5 && received[i + 1] === 0x5a) {
          hasRfFrame = true;
          break;
        }
      }
      if (hasDash && !hasRfFrame) {
        if (pipe.drain) await pipe.drain();
        else if (pipe.flush) await pipe.flush();
        leavePortOpen = opts?.keepPortOnOpenGd77 === true;
        throw new DebugWrongFirmwareError(
          'opengd77',
          RADIOFOUNDRY_DEBUG_OPENGD77_FOUND,
          leavePortOpen ? debugOpenPort(pipe, capturedVia, board.baudRate) : undefined,
          received,
        );
      }
      const hint =
        board.modelId !== DM32_RADIOFOUNDRY_MODEL_ID ? ` ${RADIOFOUNDRY_DEBUG_HOTSPOT_HINT}` : '';
      throw new DebugWrongFirmwareError(
        'unknown',
        RADIOFOUNDRY_DEBUG_NO_ANSWER + hint,
        undefined,
        received,
      );
    }
    throw err;
  } finally {
    try {
      await radio.disconnect();
    } catch {
      /* keep primary error */
    }
    if (!leavePortOpen) {
      try {
        await guard.pipe.close();
      } catch {
        /* keep primary error */
      }
    }
  }
}

export const RADIOFOUNDRY_DEBUG_INFO_SIDECAR = 'debug/info.bin';
export const RADIOFOUNDRY_DEBUG_VERSION_SIDECAR = 'debug/version.txt';
export const RADIOFOUNDRY_DEBUG_IDDB_SIDECAR = 'debug/iddb.bin';
export const RADIOFOUNDRY_DEBUG_SUMS_SIDECAR = 'debug/sums.bin';
export const RADIOFOUNDRY_REGION = {
  eeprom: 'eeprom-image',
  flash: 'flash-image',
  area2: 'iddb-area2',
} as const;

const FLASH_REGION_LENGTH = RADIOFOUNDRY_IMAGE_SIZE - FLASH_IMAGE_START;

function stitchBlocks(
  blocks: Map<number, RadioFoundryImageBlock>,
  start: number,
  length: number,
): Uint8Array {
  const out = new Uint8Array(length);
  out.fill(0xff);
  for (let off = 0; off < length; off += BLOCK_SIZE) {
    const addr = start + off;
    const entry = blocks.get(addr);
    if (!entry) continue;
    const n = Math.min(BLOCK_SIZE, length - off);
    out.set(entry.bytes.subarray(0, n), off);
  }
  return out;
}

function sumsSidecarRows(blocks: Map<number, RadioFoundryImageBlock>): Uint8Array {
  const addrs = [...blocks.keys()].sort((a, b) => a - b);
  const out = new Uint8Array(addrs.length * 9);
  for (let i = 0; i < addrs.length; i += 1) {
    const addr = addrs[i]!;
    const { crc, blank } = blocks.get(addr)!;
    const row = out.subarray(i * 9, (i + 1) * 9);
    writeU32(row, 0, addr);
    writeU32(row, 4, crc);
    row[8] = blank ? 1 : 0;
  }
  return out;
}

function lastNonBlankArea2End(blocks: Map<number, RadioFoundryImageBlock>): number | null {
  const addrs = [...blocks.keys()].sort((a, b) => b - a);
  for (const addr of addrs) {
    if (!blocks.get(addr)!.blank) return addr + BLOCK_SIZE;
  }
  return null;
}

export function buildRadioFoundryDebugArchiveParts(capture: RadioFoundryDebugCapture): {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
} {
  const regions: Record<string, Uint8Array> = {};
  const list: RadioBackupRegionV1[] = [];
  const eeprom = stitchBlocks(capture.codeplug, 0, EEPROM_IMAGE_END);
  list.push({
    id: RADIOFOUNDRY_REGION.eeprom,
    label: 'EEPROM image',
    address: 0,
    byteLength: eeprom.length,
    path: `regions/${RADIOFOUNDRY_REGION.eeprom}.bin`,
    restoreRole: 'inspect-only',
  });
  regions[RADIOFOUNDRY_REGION.eeprom] = eeprom;
  const flash = stitchBlocks(capture.codeplug, FLASH_IMAGE_START, FLASH_REGION_LENGTH);
  list.push({
    id: RADIOFOUNDRY_REGION.flash,
    label: 'Flash image',
    address: FLASH_IMAGE_START,
    byteLength: flash.length,
    path: `regions/${RADIOFOUNDRY_REGION.flash}.bin`,
    restoreRole: 'inspect-only',
  });
  regions[RADIOFOUNDRY_REGION.flash] = flash;
  let imageByteLength = FLASH_IMAGE_START + flash.length;
  if (capture.area2 && capture.area2.size > 0) {
    const end = lastNonBlankArea2End(capture.area2);
    if (end != null && end > DMR_ID_DATABASE_AREA2_ADDRESS) {
      const len = end - DMR_ID_DATABASE_AREA2_ADDRESS;
      const area2 = stitchBlocks(capture.area2, DMR_ID_DATABASE_AREA2_ADDRESS, len);
      list.push({
        id: RADIOFOUNDRY_REGION.area2,
        label: 'DMR ID database area 2',
        address: DMR_ID_DATABASE_AREA2_ADDRESS,
        byteLength: area2.length,
        path: `regions/${RADIOFOUNDRY_REGION.area2}.bin`,
        restoreRole: 'inspect-only',
      });
      regions[RADIOFOUNDRY_REGION.area2] = area2;
      imageByteLength = Math.max(imageByteLength, end);
    }
  }
  const allBlocks = new Map<number, RadioFoundryImageBlock>(capture.codeplug);
  if (capture.area2) {
    for (const [k, v] of capture.area2) allBlocks.set(k, v);
  }
  const sidecars: Record<string, Uint8Array> = {
    [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: capture.info.slice(),
    [RADIOFOUNDRY_DEBUG_SUMS_SIDECAR]: sumsSidecarRows(allBlocks),
  };
  if (capture.versionText != null) {
    sidecars[RADIOFOUNDRY_DEBUG_VERSION_SIDECAR] = new TextEncoder().encode(capture.versionText);
  }
  if (capture.iddb) {
    sidecars[RADIOFOUNDRY_DEBUG_IDDB_SIDECAR] = capture.iddb.slice();
  }
  let firmware: string | undefined;
  if (capture.versionText) {
    try {
      firmware = summariseRadioFoundryBuild(
        parseRadioFoundryVersionText(capture.versionText),
      ).label;
    } catch {
      firmware = undefined;
    }
  }
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: capture.capturedAt,
    capturedVia: capture.capturedVia,
    app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
    radioModelId: capture.modelId,
    descriptorLabel: 'RadioFoundry debug capture',
    ...(firmware ? { firmware } : {}),
    coverage: 'partial',
    imageByteLength,
    regions: list,
  };
  return { manifest, regions, sidecars };
}

function readU32(source: Uint8Array, offset: number): number {
  return (
    (source[offset]! |
      (source[offset + 1]! << 8) |
      (source[offset + 2]! << 16) |
      (source[offset + 3]! << 24)) >>>
    0
  );
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}
