/**
 * DM-32UV debug archive coverage and identity evidence.
 * Classifies by the V-frame `0x0A` window and the `factory-sector` entry, never by region id
 * alone, so a build Backup archive classifies the same way as a debug capture.
 */
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { parseVAscii } from '../../kit/codecs/vProbe.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CHANNEL_LOCATION,
  DM32_FACTORY_SECTOR_ADDRESS,
  DM32_FACTORY_SECTOR_LENGTH,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
  DM32_VFRAME,
} from './constants.ts';
import { DM32_FACTORY_SECTOR_REGION_ID } from './calibrationDecode.ts';
import { decodeDm32ChannelLocationPage } from './channelLocationCodec.ts';
import { selectDm32CalibrationPages, type Dm32ConfigWindow } from './memory.ts';

export const DM32_DEBUG_VFRAMES_PATH = 'debug/v-frames.json';
export const DM32_DEBUG_CAPTURE_PATH = 'debug/capture.json';
const MAX_WINDOW_LAST = 0x0f_ffff;

export interface Dm32DebugVFrameJson {
  id: number;
  status: 'ok' | 'failed';
  payloadHex?: string;
  reason?: string;
}

export interface Dm32DebugCaptureJson {
  modelString: string;
  /** V-frame `0x0A` as returned. */
  v0a: { start: number; end: number };
  /** Block addresses `start` through `alignedEnd`. */
  window: Dm32ConfigWindow;
  discovered: { address: number; tag: number }[];
  channelCount: number;
  /** Reads beyond the product read set. Always empty (coordinator decision 35). */
  extraReadTags: number[];
  factory: { status: 'kept' } | { status: 'not-kept'; reason: 'mismatch' | 'failed' };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** The config window an archive states: `addressBase` plus `imageByteLength` whole blocks. */
export function dm32ArchiveWindow(
  manifest: Pick<RadioBackupManifestV1, 'addressBase' | 'imageByteLength'>,
): Dm32ConfigWindow | undefined {
  const { addressBase: start, imageByteLength: size } = manifest;
  if (!isInt(start) || !isInt(size) || size === 0) return undefined;
  if (start % DM32_BLOCK_SIZE !== 0 || size % DM32_BLOCK_SIZE !== 0) return undefined;
  if (start + size - 1 > MAX_WINDOW_LAST) return undefined;
  return { start, end: start + size - DM32_BLOCK_SIZE };
}

/** `debug/capture.json`, accepted only when it matches the window and is internally sound. */
export function parseDm32DebugCaptureJson(
  bytes: Uint8Array | undefined,
  window: Dm32ConfigWindow | undefined,
): Dm32DebugCaptureJson | undefined {
  const value = readJson(bytes);
  if (!isRecord(value) || !window) return undefined;
  const { modelString, v0a, discovered, channelCount, extraReadTags, factory } = value;
  const w = value.window;
  if (typeof modelString !== 'string' || !isInt(channelCount)) return undefined;
  if (!isRecord(v0a) || !isInt(v0a.start) || !isInt(v0a.end)) return undefined;
  if (!isRecord(w) || w.start !== window.start || w.end !== window.end) return undefined;
  if (!Array.isArray(extraReadTags) || !extraReadTags.every(isInt)) return undefined;
  if (!isRecord(factory)) return undefined;
  const factoryOk =
    factory.status === 'kept' ||
    (factory.status === 'not-kept' &&
      (factory.reason === 'mismatch' || factory.reason === 'failed'));
  if (!factoryOk || !Array.isArray(discovered)) return undefined;
  const seen = new Set<number>();
  for (const entry of discovered) {
    if (!isRecord(entry) || !isInt(entry.address) || !isInt(entry.tag) || entry.tag > 0xff)
      return undefined;
    if (entry.address % DM32_BLOCK_SIZE !== 0) return undefined;
    if (entry.address < window.start || entry.address > window.end) return undefined;
    if (seen.has(entry.address)) return undefined;
    seen.add(entry.address);
  }
  return value as unknown as Dm32DebugCaptureJson;
}

export function parseDm32DebugVFramesJson(
  bytes: Uint8Array | undefined,
): Dm32DebugVFrameJson[] | undefined {
  const value = readJson(bytes);
  if (!Array.isArray(value)) return undefined;
  const out: Dm32DebugVFrameJson[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isInt(entry.id) || entry.id > 0xff) return undefined;
    if (entry.status === 'ok') {
      if (typeof entry.payloadHex !== 'string' || !/^([0-9a-f]{2})*$/.test(entry.payloadHex))
        return undefined;
      out.push({ id: entry.id, status: 'ok', payloadHex: entry.payloadHex });
    } else if (entry.status === 'failed') {
      out.push({
        id: entry.id,
        status: 'failed',
        reason: typeof entry.reason === 'string' ? entry.reason : 'failed',
      });
    } else return undefined;
  }
  return out;
}

export type Dm32BlockCoverage =
  'captured' | 'discovered, not read' | 'not discovered' | 'discovery not recorded';

export interface Dm32CoverageBlock {
  address: number;
  status: Dm32BlockCoverage;
  tag?: number;
  calibration?: 'live' | 'duplicate';
}

export interface Dm32DebugCoverage {
  window?: Dm32ConfigWindow;
  blocks: Dm32CoverageBlock[];
  /** Captured window entries, by region id. */
  windowRegions: RadioBackupRegionV1[];
  factory?: RadioBackupRegionV1;
  unclassified: { region: RadioBackupRegionV1; reason: string }[];
  discoveryRecorded: boolean;
}

function isFactoryRegion(region: RadioBackupRegionV1, bytes: Uint8Array | undefined): boolean {
  return (
    region.id === DM32_FACTORY_SECTOR_REGION_ID &&
    region.address === DM32_FACTORY_SECTOR_ADDRESS &&
    region.byteLength === DM32_FACTORY_SECTOR_LENGTH &&
    bytes?.length === DM32_FACTORY_SECTOR_LENGTH &&
    region.restoreRole === 'inspect-only'
  );
}

/** Per-block window map, the factory sector as its own address space, and what stays unknown. */
export function classifyDm32DebugCoverage(
  manifest: Pick<RadioBackupManifestV1, 'addressBase' | 'imageByteLength' | 'regions'>,
  regions: Record<string, Uint8Array>,
  sidecars: Record<string, Uint8Array> = {},
): Dm32DebugCoverage {
  const window = dm32ArchiveWindow(manifest);
  const unclassified: Dm32DebugCoverage['unclassified'] = [];
  const candidates: RadioBackupRegionV1[] = [];
  let factory: RadioBackupRegionV1 | undefined;
  for (const region of manifest.regions) {
    const bytes = regions[region.id];
    if (isFactoryRegion(region, bytes)) {
      if (factory) unclassified.push({ region, reason: 'Second factory-sector entry' });
      else factory = region;
      continue;
    }
    const tail = bytes?.[bytes.length - 1];
    const reason = !window
      ? 'Archive does not state a valid configuration window'
      : bytes?.length !== region.byteLength || region.byteLength === 0
        ? 'Stored bytes do not match the manifest length'
        : region.address % DM32_BLOCK_SIZE !== 0 || region.byteLength % DM32_BLOCK_SIZE !== 0
          ? 'Not whole 4 KiB blocks'
          : region.address < window.start ||
              region.address + region.byteLength - 1 > window.end + DM32_METADATA_OFFSET
            ? tail === DM32_METADATA.CALIBRATION
              ? 'Outside the V-frame 0x0A window (a tag 0x02 page here is not calibration)'
              : 'Outside the V-frame 0x0A window'
            : undefined;
    if (reason) unclassified.push({ region, reason });
    else candidates.push(region);
  }
  const overlapping = new Set<RadioBackupRegionV1>();
  for (const a of candidates)
    for (const b of candidates)
      if (a !== b && a.address < b.address + b.byteLength && b.address < a.address + a.byteLength)
        overlapping.add(a);
  for (const region of overlapping) unclassified.push({ region, reason: 'Overlaps another entry' });
  const windowRegions = candidates.filter((r) => !overlapping.has(r));

  const capture = parseDm32DebugCaptureJson(sidecars[DM32_DEBUG_CAPTURE_PATH], window);
  const discovered = new Map(capture?.discovered.map((d) => [d.address, d.tag]));
  const blocks: Dm32CoverageBlock[] = [];
  if (window) {
    for (let address = window.start; address <= window.end; address += DM32_BLOCK_SIZE) {
      const region = windowRegions.find(
        (r) => r.address <= address && address < r.address + r.byteLength,
      );
      if (region) {
        const tag = regions[region.id]![address - region.address + DM32_METADATA_OFFSET]!;
        blocks.push({ address, status: 'captured', tag });
      } else if (discovered.has(address)) {
        blocks.push({ address, status: 'discovered, not read', tag: discovered.get(address)! });
      } else {
        blocks.push({ address, status: capture ? 'not discovered' : 'discovery not recorded' });
      }
    }
    const tagged = blocks.filter(
      (b): b is Dm32CoverageBlock & { tag: number } => b.tag !== undefined,
    );
    const calibration = selectDm32CalibrationPages(
      tagged.map((b) => ({ address: b.address, metadata: b.tag })),
      window,
    );
    for (const block of blocks) {
      if (block.address === calibration.live?.address) block.calibration = 'live';
      else if (calibration.duplicates.some((d) => d.address === block.address))
        block.calibration = 'duplicate';
    }
  }
  return {
    window,
    blocks,
    windowRegions,
    factory,
    unclassified,
    discoveryRecorded: !!capture,
  };
}

/** Lower-case hex with no separators (sidecar payloads). */
export const dm32DebugHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);

export interface Dm32VFrameEvidence {
  id: number;
  /** Printable ASCII as returned (trailing NULs trimmed), when the payload is text. */
  text?: string;
  hex?: string;
  failed?: string;
}

export interface Dm32DebugIdentity {
  modelString?: string;
  vframes: Dm32VFrameEvidence[];
  /** V01: stock base version, unchanged by MM9PDY. Not a mod discriminator. */
  baseFirmware?: Dm32VFrameEvidence;
  /** V02: chip UID (8 bytes) plus 4 derived bytes. Not a serial. */
  chipUidHex?: string;
  /** A captured MM9PDY channel location page decodes (persistent data, not running firmware). */
  mm9pdyDataPresent: boolean;
}

/** Positive evidence from captured bytes and capture sidecars only; never manifest claims. */
export function dm32DebugIdentity(
  sidecars: Record<string, Uint8Array>,
  regions: readonly RadioBackupRegionV1[],
  bytes: Record<string, Uint8Array>,
): Dm32DebugIdentity {
  const frames = parseDm32DebugVFramesJson(sidecars[DM32_DEBUG_VFRAMES_PATH]) ?? [];
  const vframes = frames.map((frame): Dm32VFrameEvidence => {
    if (frame.status === 'failed') return { id: frame.id, failed: frame.reason };
    const payload = fromHex(frame.payloadHex ?? '');
    const text = parseVAscii(payload);
    return {
      id: frame.id,
      hex: frame.payloadHex,
      ...(text.length > 0 && /^[\x20-\x7e]+$/.test(text) ? { text } : {}),
    };
  });
  const capture = readJson(sidecars[DM32_DEBUG_CAPTURE_PATH]);
  const modelString =
    isRecord(capture) && typeof capture.modelString === 'string' && capture.modelString
      ? capture.modelString
      : undefined;
  const uid = vframes.find((v) => v.id === DM32_VFRAME.EFUSE_IDENTITY);
  let mm9pdyDataPresent = false;
  for (const region of regions) {
    const data = bytes[region.id];
    if (region.id === DM32_FACTORY_SECTOR_REGION_ID || data?.length !== region.byteLength) continue;
    for (let offset = 0; offset + DM32_BLOCK_SIZE <= data.length; offset += DM32_BLOCK_SIZE) {
      const page = data.subarray(offset, offset + DM32_BLOCK_SIZE);
      if (
        (DM32_CHANNEL_LOCATION.TAGS as readonly number[]).includes(page[DM32_METADATA_OFFSET]!) &&
        decodeDm32ChannelLocationPage(page)
      )
        mm9pdyDataPresent = true;
    }
  }
  return {
    modelString,
    vframes,
    baseFirmware: vframes.find((v) => v.id === DM32_VFRAME.FIRMWARE && !v.failed),
    chipUidHex: uid?.hex || undefined,
    mm9pdyDataPresent,
  };
}
