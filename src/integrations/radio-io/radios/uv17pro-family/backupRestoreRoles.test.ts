import { describe, expect, it } from 'vitest';
import { UV21_PRO_V2_LAYOUT, UV5R_MINI_LAYOUT } from './layout.ts';
import {
  isUv17ProRestoreNeverWritePackedOffset,
  uv17ProBackupMemSpans,
  uv17ProBackupRestoreRole,
} from './backupRestoreRoles.ts';
import { uv17ProKeptRegions } from './writeRole.ts';

describe('UV-17Pro backup restore roles', () => {
  it('classifies Mini MEM spans as restorable packed clone regions', () => {
    const spans = uv17ProBackupMemSpans(UV5R_MINI_LAYOUT);
    expect(spans).toHaveLength(3);
    expect(spans.every((s) => s.restoreRole === 'restorable')).toBe(true);
    expect(spans.map((s) => s.id)).toEqual(['mem-0', 'mem-1', 'mem-2']);
    expect(spans[0]!.radioAddr).toBe(0x0000);
    expect(spans[0]!.size).toBe(UV5R_MINI_LAYOUT.memSizes[0]);
    expect(spans[1]!.packedOffset).toBe(UV5R_MINI_LAYOUT.memSizes[0]);
    expect(spans[2]!.radioAddr).toBe(0xa000);
    expect(spans.reduce((sum, s) => sum + s.size, 0)).toBe(UV5R_MINI_LAYOUT.memTotal);
  });

  it('classifies UV-21 four MEM spans as restorable', () => {
    const spans = uv17ProBackupMemSpans(UV21_PRO_V2_LAYOUT);
    expect(spans).toHaveLength(4);
    expect(spans.every((s) => s.restoreRole === 'restorable')).toBe(true);
    expect(spans[3]!.id).toBe('mem-3');
    expect(spans[3]!.radioAddr).toBe(0xd000);
    expect(spans.reduce((sum, s) => sum + s.size, 0)).toBe(UV21_PRO_V2_LAYOUT.memTotal);
  });

  it('treats Write-kept packed offsets as restorable (they live in MEM spans)', () => {
    for (const region of uv17ProKeptRegions(UV5R_MINI_LAYOUT)) {
      expect(uv17ProBackupRestoreRole(UV5R_MINI_LAYOUT, region.packedOffset)).toBe('restorable');
      expect(isUv17ProRestoreNeverWritePackedOffset(UV5R_MINI_LAYOUT, region.packedOffset)).toBe(
        false,
      );
    }
  });

  it('does not invent a calibration span; packed offsets past the clone are inspect-only', () => {
    expect(uv17ProBackupRestoreRole(UV5R_MINI_LAYOUT, UV5R_MINI_LAYOUT.memTotal)).toBe(
      'inspect-only',
    );
    expect(
      isUv17ProRestoreNeverWritePackedOffset(UV5R_MINI_LAYOUT, UV5R_MINI_LAYOUT.memTotal),
    ).toBe(true);
    expect(uv17ProBackupMemSpans(UV5R_MINI_LAYOUT).some((s) => s.id.includes('cal'))).toBe(false);
  });
});
