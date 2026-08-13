import { describe, expect, it } from 'vitest';
import {
  atD890BackupRestoreRole,
  atD890BackupSpanForAddress,
  isAtD890RestoreNeverWriteAddress,
} from './backupRestoreRoles.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';

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

  it('names LocalInfo and channel-data spans', () => {
    expect(atD890BackupSpanForAddress(D890_MAP.LocalInfo)?.id).toBe('local-info');
    expect(atD890BackupSpanForAddress(D890_MAP.ChannelData + 0x80)?.id).toBe('channel-data');
  });
});
