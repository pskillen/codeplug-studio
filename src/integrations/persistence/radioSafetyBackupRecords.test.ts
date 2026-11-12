import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findSafetyBackupRecord,
  listSafetyBackupRecords,
  RADIO_SAFETY_BACKUP_KEY,
  recordSafetyBackup,
  type RadioSafetyBackupRecord,
} from './radioSafetyBackupRecords.ts';

const rec = (over: Partial<RadioSafetyBackupRecord> = {}): RadioSafetyBackupRecord => ({
  family: 'retevis-rt95',
  radioKey: 'AB 12345',
  region: 'cal',
  fileName: 'a.zip',
  sha256: 'a'.repeat(64),
  fingerprint: 'aaaaaaaa',
  savedAt: '2026-01-01T00:00:00.000Z',
  studioVersion: 'test',
  ...over,
});

describe('radioSafetyBackupRecords', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('finds nothing when empty', () => {
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')).toBeUndefined();
  });

  it('records and finds by family and key; the newest wins', () => {
    recordSafetyBackup(rec());
    recordSafetyBackup(
      rec({ sha256: 'b'.repeat(64), savedAt: '2026-02-01T00:00:00.000Z', region: 'full' }),
    );
    recordSafetyBackup(rec({ radioKey: 'OTHER' }));
    recordSafetyBackup(rec({ family: 'other-family' }));
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')?.region).toBe('full');
    expect(listSafetyBackupRecords('retevis-rt95')).toHaveLength(3);
    expect(findSafetyBackupRecord('retevis-rt95', 'NONE')).toBeUndefined();
  });

  it('drops junk entries', () => {
    window.localStorage.setItem(
      RADIO_SAFETY_BACKUP_KEY,
      JSON.stringify([{ nope: 1 }, rec(), rec({ region: 'x' as 'cal' }), rec({ radioKey: '' }), 7]),
    );
    expect(listSafetyBackupRecords('retevis-rt95')).toHaveLength(1);
    window.localStorage.setItem(RADIO_SAFETY_BACKUP_KEY, '{not json');
    expect(listSafetyBackupRecords('retevis-rt95')).toEqual([]);
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(listSafetyBackupRecords('retevis-rt95')).toEqual([]);
    expect(recordSafetyBackup(rec())).toBe(false);
  });

  it('stores no bytes, only the known fields', () => {
    recordSafetyBackup({ ...rec(), bytes: new Uint8Array(4) } as RadioSafetyBackupRecord);
    const stored = JSON.parse(window.localStorage.getItem(RADIO_SAFETY_BACKUP_KEY)!) as object[];
    expect(Object.keys(stored[0]!).sort()).toEqual(
      [
        'family',
        'fileName',
        'fingerprint',
        'radioKey',
        'region',
        'savedAt',
        'sha256',
        'studioVersion',
      ].sort(),
    );
  });
});
