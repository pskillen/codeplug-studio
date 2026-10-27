import { describe, expect, it } from 'vitest';
import {
  AT_D890_BACKUP_REGION_SPANS,
  atD890BackupRestoreRole,
  atD890BackupSpanForAddress,
  isAtD890RestoreNeverWriteAddress,
} from './backupRestoreRoles.ts';
import {
  AT_D890_LIMITS,
  AT_D890_NXDN,
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from './constants.ts';
import { channelPrimaryAddress, channelSecondaryAddress, scanListAddress } from './memory.ts';

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

  it('covers every settings-unit extent the firmware keeps across a save, with no hole', () => {
    const unit = 0x350_0000;
    const extents: [number, number][] = [
      [0x000, 0xa00],
      [0x1000, 0x400],
      [0x2000, 0x510],
    ];
    for (const [off, len] of extents) {
      for (let a = unit + off; a < unit + off + len; a++) {
        const span = atD890BackupSpanForAddress(a);
        expect(span, `0x${a.toString(16)}`).toBeDefined();
        expect(span?.restoreRole).toBe('restorable');
      }
    }
  });

  it('adds the wiped-region spans at the planned addresses', () => {
    const want: Record<string, [number, number]> = {
      'settings-store': [0x350_0200, 0x200],
      'dtmf-list': [0x350_0800, 0x100],
      'optional-settings-ext-tail': [0x350_0960, 0xa0],
      'aprs-text-tail': [0x350_1260, 0x20],
      'gps-info-tail': [0x350_12b0, 0x50],
      'gps-zone-switch': [0x350_2000, 0x400],
      'aprs-beacon-names': [0x350_2400, 0x110],
      'vfo-channels': [0x1f8_1000, 0x100],
    };
    for (const [id, [start, length]] of Object.entries(want)) {
      const span = AT_D890_BACKUP_REGION_SPANS.find((s) => s.id === id);
      expect(span, id).toMatchObject({ start, length, restoreRole: 'restorable' });
    }
  });

  it('places VFO A/B (slots 4000/4001) in vfo-channels, not channel-data', () => {
    for (const slot of [4000, 4001]) {
      expect(channelPrimaryAddress(slot)).toBeGreaterThanOrEqual(D890_MAP.VfoChannels);
      expect(channelSecondaryAddress(slot) + 0x40).toBeLessThanOrEqual(
        D890_MAP.VfoChannels + D890_MAP.VfoChannelsLength,
      );
      expect(atD890BackupSpanForAddress(channelPrimaryAddress(slot))?.id).toBe('vfo-channels');
      expect(atD890BackupSpanForAddress(channelSecondaryAddress(slot))?.id).toBe('vfo-channels');
    }
    expect(atD890BackupSpanForAddress(channelPrimaryAddress(3999))?.id).toBe('channel-data');
  });
});

describe('NXDN list and RX group spans', () => {
  it('names the four list units and the RX group unit', () => {
    expect(atD890BackupSpanForAddress(AT_D890_NXDN.ListIndex)?.label).toMatch(/NXDN contacts/);
    expect(atD890BackupSpanForAddress(AT_D890_NXDN.ListSet)?.id).toBe('nxdn-list-set');
    expect(atD890BackupSpanForAddress(AT_D890_NXDN.ListData + 0xc8 * 999)?.id).toBe(
      'nxdn-list-data',
    );
    expect(atD890BackupSpanForAddress(AT_D890_NXDN.ListOrder)?.id).toBe('nxdn-list-order');
    expect(atD890BackupSpanForAddress(AT_D890_NXDN.RxGroupData)?.id).toBe('nxdn-rx-group-data');
    expect(atD890BackupSpanForAddress(AT_D890_NXDN.RxGroupSet)?.id).toBe('nxdn-rx-group-set');
  });

  it('restores the RX groups; the list is backed up but inspect-only (above the restore image)', () => {
    expect(atD890BackupRestoreRole(AT_D890_NXDN.RxGroupData, 0x200)).toBe('restorable');
    expect(atD890BackupRestoreRole(AT_D890_NXDN.RxGroupSet, 0x20)).toBe('restorable');
    expect(atD890BackupRestoreRole(AT_D890_NXDN.ListIndex, 16)).toBe('inspect-only');
    expect(atD890BackupRestoreRole(AT_D890_NXDN.ListData, 16)).toBe('inspect-only');
  });
});
