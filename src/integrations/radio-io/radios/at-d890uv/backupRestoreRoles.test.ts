import { describe, expect, it } from 'vitest';
import {
  AT_D890_BACKUP_REGION_SPANS,
  atD890BackupRestoreRole,
  atD890BackupSpanForAddress,
  isAtD890RestoreNeverWriteAddress,
} from './backupRestoreRoles.ts';
import { AT_D890_LIMITS, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import { scanListAddress } from './memory.ts';

describe('AT_D890_BACKUP_REGION_SPANS', () => {
  it('marks LocalInfo and alarm inspect-only', () => {
    expect(atD890BackupRestoreRole(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength)).toBe(
      'inspect-only',
    );
    expect(atD890BackupRestoreRole(D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength)).toBe(
      'inspect-only',
    );
    expect(atD890BackupRestoreRole(D890_MAP.AlarmData, D890_MAP.AlarmDataLength)).toBe(
      'inspect-only',
    );
    expect(isAtD890RestoreNeverWriteAddress(D890_MAP.LocalInfo)).toBe(true);
    expect(isAtD890RestoreNeverWriteAddress(D890_MAP.AlarmBitmap)).toBe(true);
  });

  it('marks optional settings, APRS, channels, and zones restorable', () => {
    expect(
      atD890BackupRestoreRole(D890_MAP.OptionalSettingsMain, D890_MAP.OptionalSettingsMainLength),
    ).toBe('restorable');
    expect(atD890BackupRestoreRole(D890_MAP.AprsConfigMain, D890_MAP.AprsConfigMainLength)).toBe(
      'restorable',
    );
    expect(atD890BackupRestoreRole(D890_MAP.ChannelSet, 0x10)).toBe('restorable');
    expect(atD890BackupRestoreRole(D890_MAP.ChannelData, 0x10)).toBe('restorable');
    expect(atD890BackupRestoreRole(D890_MAP.ZoneSet, 0x10)).toBe('restorable');
    expect(atD890BackupRestoreRole(D890_MAP.AmAirSet, D890_MAP.AmAirSetLength)).toBe('restorable');
  });

  it('treats unnamed leftover and the family skip address as inspect-only', () => {
    expect(atD890BackupRestoreRole(0x1234, 0x10)).toBe('inspect-only');
    expect(atD890BackupRestoreRole(AT_D890_SAFE_SKIP_WRITE_ADDR, 0x10)).toBe('inspect-only');
    expect(isAtD890RestoreNeverWriteAddress(AT_D890_SAFE_SKIP_WRITE_ADDR)).toBe(true);
  });

  it('restores each scan-list bank without archiving the pitch gap', () => {
    const banks = AT_D890_BACKUP_REGION_SPANS.filter((span) =>
      span.id.startsWith('scan-list-data.bank'),
    );
    const bankCount = (AT_D890_LIMITS.SCAN_LIST_SET_BYTES * 8) / D890_MAP.ScanListBankSize;
    expect(banks).toHaveLength(bankCount);
    expect(
      banks.every((span) => span.length === D890_MAP.ScanListBankSize * D890_MAP.ScanListStride),
    ).toBe(true);
    expect(banks.every((span) => span.restoreRole === 'restorable')).toBe(true);
    expect(atD890BackupRestoreRole(scanListAddress(32), 0x10)).toBe('restorable');
    expect(atD890BackupRestoreRole(0x210_4000, 0x10)).toBe('inspect-only');
    expect(atD890BackupSpanForAddress(0x214_0000)).toBeUndefined();
  });

  it('names LocalInfo and channel-data spans', () => {
    expect(atD890BackupSpanForAddress(D890_MAP.LocalInfo)?.id).toBe('local-info');
    expect(atD890BackupSpanForAddress(D890_MAP.ChannelData + 0x80)?.id).toBe('channel-data');
  });
});
