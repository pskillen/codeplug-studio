/**
 * UV-17Pro family backup region roles — restorable vs inspect-only.
 *
 * Backup packs each PROGRAM+R/W MEM_* span as a named zip region (packed clone
 * of the programming image, not a chip dump). Studio has no isolated
 * calibration or LocalInfo table on this map. Residual: vendor cal may live
 * inside these spans — do not invent offsets. Write-codeplug still requires
 * in-session / stash hydration; Restore uploads selected MEM bins only.
 */

import type { RadioBackupRegionRole } from '../../backup/types.ts';
import type { Uv17ProLayout } from './layout.ts';

export interface Uv17ProBackupMemSpan {
  id: string;
  label: string;
  radioAddr: number;
  packedOffset: number;
  size: number;
  restoreRole: RadioBackupRegionRole;
}

/**
 * One named zip region per MEM_* programming span. All spans are restorable.
 */
export function uv17ProBackupMemSpans(layout: Uv17ProLayout): readonly Uv17ProBackupMemSpan[] {
  let packed = 0;
  return layout.memStarts.map((radioAddr, i) => {
    const size = layout.memSizes[i]!;
    const span: Uv17ProBackupMemSpan = {
      id: `mem-${i}`,
      label: `MEM ${i + 1} (radio 0x${radioAddr.toString(16)})`,
      radioAddr,
      packedOffset: packed,
      size,
      restoreRole: 'restorable',
    };
    packed += size;
    return span;
  });
}

export function uv17ProBackupSpanForPackedOffset(
  layout: Uv17ProLayout,
  packedOffset: number,
): Uv17ProBackupMemSpan | undefined {
  return uv17ProBackupMemSpans(layout).find(
    (span) => packedOffset >= span.packedOffset && packedOffset < span.packedOffset + span.size,
  );
}

export function uv17ProBackupRestoreRole(
  layout: Uv17ProLayout,
  packedOffset: number,
): RadioBackupRegionRole {
  const span = uv17ProBackupSpanForPackedOffset(layout, packedOffset);
  return span?.restoreRole ?? 'inspect-only';
}

export function isUv17ProRestoreNeverWritePackedOffset(
  layout: Uv17ProLayout,
  packedOffset: number,
): boolean {
  return uv17ProBackupRestoreRole(layout, packedOffset) === 'inspect-only';
}
