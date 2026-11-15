import { DM32_MODEL_IDS } from '@integrations/radio-io/radios/dm32uv/constants.ts';
import { DM32_FACTORY_SECTOR_REGION_ID } from '@integrations/radio-io/radios/dm32uv/calibrationDecode.ts';
import { classifyDm32DebugCoverage } from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import { MMD1_BASE, MMD1_END } from '@integrations/radio-io/radios/rt95/modData/layout.ts';
import {
  RT95_MMD1_REGION_ID,
  RT95_MMD1_REGION_PATH,
} from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import {
  RT95_CALIBRATION_START,
  RT95_CALIBRATION_LENGTH,
} from '@core/radios/retevis/rt95/calibration.ts';
import {
  RT95_CALIBRATION_REGION_ID,
  RT95_CALIBRATION_REGION_PATH,
} from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import type { AtD890MemberStatus } from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import { RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import type { DebugArchive } from './captureArchive.ts';

const archiveIds = new WeakMap<DebugArchive, number>();
let nextArchiveId = 1;
/** Stable per-object key: a different archive object (new read, import, other retained read) differs. */
export function archiveKey(archive: DebugArchive): number {
  let id = archiveIds.get(archive);
  if (id === undefined) archiveIds.set(archive, (id = nextArchiveId++));
  return id;
}

export const HEX_PAGE_BYTES = 256;
export const formatAddress = (n: number) => `0x${n.toString(16).toUpperCase().padStart(8, '0')}`;

/** A bounded slice of a single captured region, never a fabricated gap. */
export function hexRows(bytes: Uint8Array, address: number, page: number) {
  const start = Math.max(0, Math.floor(page)) * HEX_PAGE_BYTES;
  const rows = [];
  for (let offset = start; offset < Math.min(start + HEX_PAGE_BYTES, bytes.length); offset += 16) {
    const data = bytes.subarray(offset, Math.min(offset + 16, bytes.length));
    rows.push({
      address: address + offset,
      hex: Array.from(data, (b) => b.toString(16).padStart(2, '0')).join(' '),
      ascii: Array.from(data, (b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join(''),
    });
  }
  return rows;
}

export const isDm32ModelId = (id: string) => (DM32_MODEL_IDS as readonly string[]).includes(id);

/** Only the RT95 programming image has a defined map and representation in this session. */
export function regionIdentity(archive: DebugArchive, id: string) {
  if (isDm32ModelId(archive.manifest.radioModelId)) {
    const coverage = classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
    if (
      coverage.factory?.id === id &&
      !coverage.unclassified.some((entry) => entry.region.id === id)
    )
      return { space: 'DM-32 factory sector', representation: 'factory sector bytes' };
    if (
      id !== DM32_FACTORY_SECTOR_REGION_ID &&
      coverage.windowRegions.some((region) => region.id === id) &&
      !coverage.unclassified.some((entry) => entry.region.id === id)
    )
      return { space: 'DM-32 configuration', representation: 'configuration bytes' };
    return undefined;
  }
  if (archive.manifest.radioModelId === RT95_MODEL_ID && id === 'programming-image')
    return { space: 'RT95 programming image', representation: 'programming image bytes' };
  if (archive.manifest.radioModelId === RT95_MODEL_ID && id === RT95_MMD1_REGION_ID) {
    const region = archive.manifest.regions.find((r) => r.id === id);
    if (
      region?.address === MMD1_BASE &&
      region.byteLength <= MMD1_END - MMD1_BASE &&
      region.restoreRole === 'inspect-only' &&
      region.path === RT95_MMD1_REGION_PATH &&
      archive.regions[id]?.length === region.byteLength
    )
      return { space: 'RT95 main-body EEPROM via head', representation: 'EEPROM bytes' };
  }
  if (archive.manifest.radioModelId === RT95_MODEL_ID && id === RT95_CALIBRATION_REGION_ID) {
    const region = archive.manifest.regions.find((r) => r.id === id);
    if (
      region?.address === RT95_CALIBRATION_START &&
      region.byteLength <= RT95_CALIBRATION_LENGTH &&
      region.restoreRole === 'inspect-only' &&
      region.path === RT95_CALIBRATION_REGION_PATH &&
      archive.regions[id]?.length === region.byteLength
    )
      return { space: 'RT95 main-body EEPROM via head', representation: 'EEPROM bytes' };
  }
  return undefined;
}

/** Refuse comparisons whose address space or representation cannot be established. */
export function compareRegions(a: DebugArchive, b: DebugArchive) {
  if (a.manifest.radioModelId !== b.manifest.radioModelId)
    return { error: 'Radio models differ; captures are incompatible.', regions: [] };
  const ids = new Set([
    ...a.manifest.regions.map((r) => r.id),
    ...b.manifest.regions.map((r) => r.id),
  ]);
  const regions = Array.from(ids, (id) => {
    const left = a.manifest.regions.find((r) => r.id === id);
    const right = b.manifest.regions.find((r) => r.id === id);
    if (!left || !right || left.address !== right.address)
      return {
        id,
        label: left?.label ?? right?.label ?? id,
        comparable: false,
        changed: 0,
        missing: Math.max(left?.byteLength ?? 0, right?.byteLength ?? 0),
      };
    const leftIdentity = regionIdentity(a, id);
    const rightIdentity = regionIdentity(b, id);
    if (
      !leftIdentity ||
      !rightIdentity ||
      leftIdentity.space !== rightIdentity.space ||
      leftIdentity.representation !== rightIdentity.representation
    )
      return {
        id,
        label: left.label,
        comparable: false,
        changed: 0,
        missing: 0,
        reason: 'Address space or byte representation is unknown or differs',
      };
    const x = a.regions[id]!;
    const y = b.regions[id]!;
    const length = Math.min(x.length, y.length);
    let changed = 0;
    for (let i = 0; i < length; i++) if (x[i] !== y[i]) changed++;
    return {
      id,
      label: left.label,
      comparable: true,
      changed,
      missing: Math.abs(x.length - y.length),
    };
  });
  return { regions };
}

export const MEMBER_EXPLANATION: Record<AtD890MemberStatus, string> = {
  resolved: 'Resolved',
  'out-of-range': 'Out of range: beyond the hardware channel slots',
  absent: 'Absent: the channel bitmap does not mark this slot occupied',
  'not-captured': 'Not captured: the slot is occupied but its record is incomplete',
  'inventory-not-captured': 'Cannot resolve: the channel bitmap was not captured',
  unreadable: 'Unreadable: the captured record is empty or invalid',
};
