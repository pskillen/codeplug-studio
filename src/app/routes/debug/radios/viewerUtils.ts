import { RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import type { DebugArchive } from './captureArchive.ts';

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

/** Only the RT95 programming image has a defined map and representation in this session. */
export function regionIdentity(archive: DebugArchive, id: string) {
  if (archive.manifest.radioModelId === RT95_MODEL_ID && id === 'programming-image')
    return { space: 'RT95 programming image', representation: 'programming image bytes' };
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
