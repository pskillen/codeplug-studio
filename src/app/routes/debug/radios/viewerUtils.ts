import { DM32_MODEL_IDS } from '@integrations/radio-io/radios/dm32uv/constants.ts';
import type { AtD890MemberStatus } from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import { getRadioDescriptor } from '@integrations/radio-io/registry.ts';
import { regionSections } from '@integrations/radio-io/debugCompare/index.ts';
import type { DebugSensitiveRange } from '@integrations/radio-io/debugSensitive.ts';
import { radioDebugDescriptors, type RadioDebugRegionNote } from './descriptors.ts';
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

/** Shown in place of each masked byte: same width as a hex pair. */
export const MASKED_HEX_BYTE = '••';

/**
 * Password bytes in one region of this archive, masked until the operator reveals them. Asks each
 * descriptor's radio-home `sensitiveRanges`; the ones for other radios return nothing.
 */
export function sensitiveRanges(
  archive: DebugArchive | undefined,
  regionId: string,
): readonly DebugSensitiveRange[] {
  if (!archive) return [];
  // Radios that share one hook (the two OpenGD77 descriptors) report the same span twice.
  const seen = new Set<string>();
  return radioDebugDescriptors
    .flatMap((d) => d.sensitiveRanges?.(archive, regionId) ?? [])
    .filter((r) => {
      const key = `${r.start}-${r.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const isMasked = (address: number, mask: readonly DebugSensitiveRange[]) =>
  mask.some((range) => address >= range.start && address < range.end);

/** A bounded slice of a single captured region, never a fabricated gap. Bytes in `mask` are hidden. */
export function hexRows(
  bytes: Uint8Array,
  address: number,
  page: number,
  mask: readonly DebugSensitiveRange[] = [],
) {
  const start = Math.max(0, Math.floor(page)) * HEX_PAGE_BYTES;
  const rows = [];
  for (let offset = start; offset < Math.min(start + HEX_PAGE_BYTES, bytes.length); offset += 16) {
    const data = Array.from(bytes.subarray(offset, Math.min(offset + 16, bytes.length)));
    const at = (i: number) => address + offset + i;
    rows.push({
      address: address + offset,
      hex: data
        .map((b, i) => (isMasked(at(i), mask) ? MASKED_HEX_BYTE : b.toString(16).padStart(2, '0')))
        .join(' '),
      ascii: data
        .map((b, i) =>
          isMasked(at(i), mask) ? '•' : b >= 32 && b <= 126 ? String.fromCharCode(b) : '.',
        )
        .join(''),
    });
  }
  return rows;
}

export const isDm32ModelId = (id: string) => (DM32_MODEL_IDS as readonly string[]).includes(id);

/** The descriptor whose radio owns this archive, by the registry's model ids. */
function descriptorFor(archive: DebugArchive) {
  return radioDebugDescriptors.find((d) =>
    getRadioDescriptor(d.archiveModelId)?.modelIds.includes(archive.manifest.radioModelId),
  );
}

/** Address space and byte representation of a region; the radio's own adapter decides. */
export function regionIdentity(archive: DebugArchive, id: string) {
  return descriptorFor(archive)?.compare?.regionIdentity?.(archive, id);
}

/** The radio's own Hex and Compare note for a region (representation, address caveat, tag). */
export function regionNote(archive: DebugArchive | undefined, id: string): RadioDebugRegionNote {
  return (archive && descriptorFor(archive)?.regionNote?.(archive, id)) || {};
}

/** Refuse comparisons whose address space or representation cannot be established. */
export function compareRegions(a: DebugArchive, b: DebugArchive) {
  const result = regionSections(a, b, (archive, id) =>
    descriptorFor(a)?.compare?.regionIdentity?.(archive, id),
  );
  if (result.error) return { error: result.error, regions: [] };
  return {
    regions: result.sections.map((s) =>
      s.kind === 'compared'
        ? { id: s.id, label: s.label, comparable: true, changed: s.changed, missing: s.missing }
        : {
            id: s.id,
            label: s.label,
            comparable: false,
            changed: 0,
            missing: s.missing,
            ...(s.reason?.startsWith('Address space') ? { reason: s.reason } : {}),
          },
    ),
  };
}

export const MEMBER_EXPLANATION: Record<AtD890MemberStatus, string> = {
  resolved: 'Resolved',
  'out-of-range': 'Out of range: beyond the hardware channel slots',
  absent: 'Absent: the channel bitmap does not mark this slot occupied',
  'not-captured': 'Not captured: the slot is occupied but its record is incomplete',
  'inventory-not-captured': 'Cannot resolve: the channel bitmap was not captured',
  unreadable: 'Unreadable: the captured record is empty or invalid',
};
