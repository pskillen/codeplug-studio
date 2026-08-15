/**
 * Named backup regions from a clone download / MemoryMap.
 * Radio constants stay here — not in React. Does not assemble or persist.
 */

import {
  atD890BackupRestoreRole,
  atD890BackupSpanForAddress,
} from '../radios/at-d890uv/backupRestoreRoles.ts';
import { D890_MAP } from '../radios/at-d890uv/constants.ts';
import { dm32BackupRestoreRole } from '../radios/dm32uv/backupRestoreRoles.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from '../radios/opengd77/backupRestoreRoles.ts';
import { OPENUV380_IMAGE_SIZE, openUv380AbsToOffset } from '../radios/opengd77/constants.ts';
import { RT95_IMAGE_SIZE, RT95_MODEL_ID } from '../radios/rt95/constants.ts';
import { uv17ProBackupMemSpans } from '../radios/uv17pro-family/backupRestoreRoles.ts';
import {
  UV21_PRO_V2_LAYOUT,
  UV5R_MINI_LAYOUT,
  type Uv17ProLayout,
} from '../radios/uv17pro-family/layout.ts';
import { createMemoryMap } from '../kit/memoryMap.ts';
import type { MemoryMap } from '../types.ts';
import {
  RadioBackupError,
  type RadioBackupCoverage,
  type RadioBackupRegionRole,
  type RadioBackupRegionV1,
} from './types.ts';

export interface BackupSparseBlock {
  address: number;
  data: Uint8Array;
}

export interface BackupRegionExtract {
  regions: RadioBackupRegionV1[];
  regionBytes: Record<string, Uint8Array>;
  coverage: RadioBackupCoverage;
  imageByteLength: number;
  restoreFragileAfterFactoryReset?: boolean;
  addressBase?: number;
  dm32ContactsBase?: number;
  dm32ContactsEnd?: number;
}

export interface RegionsFromDownloadInput {
  modelId: string;
  image: MemoryMap;
  sparseBlocks?: readonly BackupSparseBlock[];
  addressBase?: number;
  dm32ContactsBase?: number;
  dm32ContactsEnd?: number;
  /** Extra named bins (OpenGD77 occupied User Database). */
  extraRegions?: readonly { region: RadioBackupRegionV1; bytes: Uint8Array }[];
}

function regionPath(id: string): string {
  return `regions/${id}.bin`;
}

function makeRegion(
  id: string,
  label: string,
  address: number,
  data: Uint8Array,
  restoreRole: RadioBackupRegionRole,
): { region: RadioBackupRegionV1; bytes: Uint8Array } {
  return {
    region: {
      id,
      label,
      address,
      byteLength: data.byteLength,
      path: regionPath(id),
      restoreRole,
    },
    bytes: data,
  };
}

function collect(
  parts: readonly { region: RadioBackupRegionV1; bytes: Uint8Array }[],
  coverage: RadioBackupCoverage,
  imageByteLength: number,
  extra?: Partial<BackupRegionExtract>,
): BackupRegionExtract {
  if (parts.length === 0) {
    throw new RadioBackupError('Radio backup has no named regions to pack.');
  }
  const regions = parts.map((p) => p.region);
  const regionBytes: Record<string, Uint8Array> = {};
  for (const part of parts) {
    regionBytes[part.region.id] = part.bytes;
  }
  return { regions, regionBytes, coverage, imageByteLength, ...extra };
}

function sliceImage(image: MemoryMap, offset: number, length: number): Uint8Array {
  if (offset < 0 || length <= 0 || offset + length > image.size) {
    throw new RadioBackupError(
      `Radio backup cannot slice image [${offset}, ${offset + length}) from size ${image.size}.`,
    );
  }
  return image.get(offset, length);
}

function isDm32Model(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id === 'dm-32uv' || id === 'dp570uv' || id.includes('dm-32') || id.includes('dm32');
}

function isD890Model(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id.includes('d890') || id === 'id890uv';
}

function isOpenGd77Model(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id === 'dm-1701' ||
    id === 'md-9600' ||
    id.includes('opengd77') ||
    id === 'rt-84' ||
    id === 'rt-90'
  );
}

function uvLayoutFor(modelId: string) {
  const id = modelId.toLowerCase();
  if (id.includes('uv21') || id.includes('uv-21')) return UV21_PRO_V2_LAYOUT;
  if (id.includes('uv5r') || id.includes('uv-5r')) return UV5R_MINI_LAYOUT;
  return null;
}

function blockRole(modelId: string, address: number, data: Uint8Array): RadioBackupRegionRole {
  if (isD890Model(modelId)) {
    return d890Role(address, data.byteLength);
  }
  if (isDm32Model(modelId)) {
    return dm32BackupRestoreRole(data);
  }
  return 'restorable';
}

function d890CoalesceKey(address: number, length: number): string {
  const span = atD890BackupSpanForAddress(address);
  if (span) return span.id;
  return `leftover:${atD890BackupRestoreRole(address, length)}`;
}

function coalesceSparse(
  modelId: string,
  blocks: readonly BackupSparseBlock[],
): BackupSparseBlock[] {
  const sorted = [...blocks].sort((a, b) => a.address - b.address);
  const out: BackupSparseBlock[] = [];
  for (const block of sorted) {
    const last = out[out.length - 1];
    const sameRole =
      last &&
      blockRole(modelId, last.address, last.data) === blockRole(modelId, block.address, block.data);
    const sameD890Span =
      !isD890Model(modelId) ||
      (last &&
        d890CoalesceKey(last.address, last.data.byteLength) ===
          d890CoalesceKey(block.address, block.data.byteLength));
    if (last && sameRole && sameD890Span && last.address + last.data.byteLength === block.address) {
      const merged = new Uint8Array(last.data.byteLength + block.data.byteLength);
      merged.set(last.data, 0);
      merged.set(block.data, last.data.byteLength);
      last.data = merged;
    } else {
      out.push({ address: block.address, data: block.data.slice() });
    }
  }
  return out;
}

function d890Role(address: number, length: number): RadioBackupRegionRole {
  return atD890BackupRestoreRole(address, length);
}

function hexId(address: number): string {
  return `0x${address.toString(16)}`;
}

function fromSparseBlocks(
  modelId: string,
  image: MemoryMap,
  sparseBlocks: readonly BackupSparseBlock[],
  extra?: Partial<BackupRegionExtract>,
): BackupRegionExtract {
  const coalesced = coalesceSparse(modelId, sparseBlocks);
  const usedIds = new Set<string>();
  const parts = coalesced.map((block, index) => {
    const inspect =
      isD890Model(modelId) && d890Role(block.address, block.data.byteLength) === 'inspect-only';
    const dm32Inspect =
      isDm32Model(modelId) && dm32BackupRestoreRole(block.data) === 'inspect-only';
    const restoreRole: RadioBackupRegionRole =
      inspect || dm32Inspect ? 'inspect-only' : 'restorable';
    const d890Span = isD890Model(modelId) ? atD890BackupSpanForAddress(block.address) : undefined;
    let id =
      d890Span?.id ??
      (inspect && block.address === D890_MAP.LocalInfo
        ? 'local-info'
        : dm32Inspect
          ? `calibration-${hexId(block.address)}`
          : `region-${hexId(block.address)}`);
    if (usedIds.has(id)) id = `${id}-${hexId(block.address)}`;
    usedIds.add(id);
    const label = d890Span
      ? d890Span.label
      : dm32Inspect
        ? `Calibration (${hexId(block.address)})`
        : inspect
          ? `Inspect-only (${hexId(block.address)})`
          : `Region ${index + 1} (${hexId(block.address)})`;
    return makeRegion(id, label, block.address, block.data, restoreRole);
  });
  return collect(parts, 'known-map-regions', image.size, extra);
}

function fromUvLayout(layout: Uv17ProLayout, image: MemoryMap): BackupRegionExtract {
  const parts = uv17ProBackupMemSpans(layout).map((span) => {
    const data = sliceImage(image, span.packedOffset, span.size);
    return makeRegion(span.id, span.label, span.packedOffset, data, span.restoreRole);
  });
  return collect(parts, 'full-clone', image.size || layout.memTotal);
}

function fromOpenGd77(
  image: MemoryMap,
  extraRegions?: readonly { region: RadioBackupRegionV1; bytes: Uint8Array }[],
): BackupRegionExtract {
  const parts = OPENGD77_BACKUP_FLASH_SPANS.map((span) => {
    const offset = openUv380AbsToOffset(span.start);
    const data = sliceImage(image, offset, span.length);
    return makeRegion(span.id, span.label, span.start, data, span.restoreRole);
  });
  return collect(
    extraRegions && extraRegions.length > 0 ? [...parts, ...extraRegions] : parts,
    'known-map-regions',
    image.size || OPENUV380_IMAGE_SIZE,
  );
}

function fromRt95(image: MemoryMap): BackupRegionExtract {
  const size = image.size || RT95_IMAGE_SIZE;
  const data = sliceImage(image, 0, size);
  return collect(
    [makeRegion('programming-image', 'Programming image', 0, data, 'restorable')],
    'full-clone',
    size,
  );
}

/**
 * Build named region bins from a live download image (and optional sparse cache).
 */
export function regionsFromDownload(input: RegionsFromDownloadInput): BackupRegionExtract {
  const { modelId, image, sparseBlocks } = input;
  const extra: Partial<BackupRegionExtract> = {};
  if (isDm32Model(modelId)) {
    extra.restoreFragileAfterFactoryReset = true;
    if (input.addressBase !== undefined) extra.addressBase = input.addressBase;
    if (input.dm32ContactsBase !== undefined) extra.dm32ContactsBase = input.dm32ContactsBase;
    if (input.dm32ContactsEnd !== undefined) extra.dm32ContactsEnd = input.dm32ContactsEnd;
  }

  if (sparseBlocks && sparseBlocks.length > 0) {
    return fromSparseBlocks(modelId, image, sparseBlocks, extra);
  }

  const uv = uvLayoutFor(modelId);
  if (uv) {
    return fromUvLayout(uv, image);
  }
  if (isOpenGd77Model(modelId)) {
    return fromOpenGd77(image, input.extraRegions);
  }
  if (modelId === RT95_MODEL_ID || modelId.toLowerCase().includes('rt95')) {
    return fromRt95(image);
  }
  if (image.size > 0 && image.size <= 0x2_0000) {
    const data = sliceImage(image, 0, image.size);
    return collect(
      [makeRegion('clone', 'Clone image', 0, data, 'restorable')],
      'partial',
      image.size,
      extra,
    );
  }
  throw new RadioBackupError(
    `Radio backup has no region map for model ${modelId} and no sparse download cache.`,
  );
}

/**
 * Rebuild a MemoryMap from archive regions. Places each bin at its manifest address
 * when that fits; otherwise concatenates in manifest order (packed clones).
 */
export function memoryMapFromBackupRegions(
  imageByteLength: number,
  regions: readonly RadioBackupRegionV1[],
  regionBytes: Record<string, Uint8Array>,
): MemoryMap {
  const maxEnd = regions.reduce((max, r) => Math.max(max, r.address + r.byteLength), 0);
  const minAddr = regions.reduce((min, r) => Math.min(min, r.address), Number.POSITIVE_INFINITY);
  const fitsAbsolute = maxEnd <= imageByteLength || minAddr === 0;
  const size = fitsAbsolute ? Math.max(imageByteLength, maxEnd) : imageByteLength;
  const map = createMemoryMap(size);
  map.fill(0, size, 0xff);

  if (fitsAbsolute) {
    for (const region of regions) {
      const data = regionBytes[region.id];
      if (!data) continue;
      if (region.address + data.byteLength <= map.size) {
        map.set(region.address, data);
      }
    }
    return map;
  }

  const base = Number.isFinite(minAddr) ? minAddr : 0;
  for (const region of regions) {
    const data = regionBytes[region.id];
    if (!data) continue;
    const offset = region.address - base;
    if (offset >= 0 && offset + data.byteLength <= map.size) {
      map.set(offset, data);
    }
  }
  return map;
}
