import { beforeEach, describe, expect, it } from 'vitest';
import {
  addBackupThisSession,
  describeBackupRadio,
  findBackupForSerial,
  getBackupsThisSession,
  resetBackupsThisSession,
} from './radioSessionBackups.ts';

describe('radioSessionBackups', () => {
  beforeEach(() => resetBackupsThisSession());

  it('keeps backups per build, oldest first', () => {
    addBackupThisSession('b1', { serial: 'SN-1', model: 'M', name: 'One', at: 5 });
    addBackupThisSession('b1', { serial: 'SN-2', model: 'M', name: 'Two', at: 6 });
    expect(getBackupsThisSession('b1').map((b) => b.serial)).toEqual(['SN-1', 'SN-2']);
    expect(getBackupsThisSession('b2')).toEqual([]);
  });

  it('is in memory only: no storage APIs are touched', () => {
    const before = [localStorage.length, sessionStorage.length];
    addBackupThisSession('b1', { serial: 'SN-1', model: 'M', name: 'One', at: 5 });
    expect([localStorage.length, sessionStorage.length]).toEqual(before);
  });

  it('the D890 session store still re-exports addBackupThisSession', async () => {
    const m = await import('./atD890RadioSettingsSession.ts');
    expect(m.addBackupThisSession).toBe(addBackupThisSession);
  });

  it('describes an entry as the name over the model, or the model alone', () => {
    expect(
      describeBackupRadio({ serial: '', model: 'AT-D890UV', name: 'MM9PDY-1', at: 1 }),
    ).toEqual({
      primary: 'MM9PDY-1',
      secondary: 'AT-D890UV',
    });
    expect(describeBackupRadio({ serial: '', model: 'DM-32UV', name: '  ', at: 1 })).toEqual({
      primary: 'DM-32UV',
      secondary: null,
    });
  });

  it('a blank serial never matches a backup entry, even another blank one', () => {
    addBackupThisSession('b1', { serial: '', model: 'M', name: '', at: 1 });
    addBackupThisSession('b1', { serial: 'SN-1', model: 'M', name: '', at: 2 });
    expect(findBackupForSerial('b1', '')).toBeUndefined();
    expect(findBackupForSerial('b1', '   ')).toBeUndefined();
    expect(findBackupForSerial('b1', 'SN-1')?.at).toBe(2);
  });
});
