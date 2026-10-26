import { beforeEach, describe, expect, it } from 'vitest';
import {
  addBackupThisSession,
  getBackupsThisSession,
  resetBackupsThisSession,
} from './radioSessionBackups.ts';

describe('radioSessionBackups', () => {
  beforeEach(() => resetBackupsThisSession());

  it('keeps backups per build, oldest first', () => {
    addBackupThisSession('b1', { serial: 'SN-1', name: 'One', at: 5 });
    addBackupThisSession('b1', { serial: 'SN-2', name: 'Two', at: 6 });
    expect(getBackupsThisSession('b1').map((b) => b.serial)).toEqual(['SN-1', 'SN-2']);
    expect(getBackupsThisSession('b2')).toEqual([]);
  });

  it('is in memory only: no storage APIs are touched', () => {
    const before = [localStorage.length, sessionStorage.length];
    addBackupThisSession('b1', { serial: 'SN-1', name: 'One', at: 5 });
    expect([localStorage.length, sessionStorage.length]).toEqual(before);
  });

  it('the D890 session store still re-exports addBackupThisSession', async () => {
    const m = await import('./atD890RadioSettingsSession.ts');
    expect(m.addBackupThisSession).toBe(addBackupThisSession);
  });
});
