import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFakeRt95Eeprom,
  createFakeRt95Pipe,
} from '@integrations/radio-io/radios/rt95/__fixtures__/fakeRt95Pipe.ts';
import { Rt95Protocol, setRt95EndAtForTests } from '@integrations/radio-io/radios/rt95/protocol.ts';
import { RT95_SAFETY_SIGNATURE_ADDR } from '@integrations/radio-io/radios/rt95/safetyBackup/reader.ts';
import { findSafetyBackupRecord } from '@integrations/persistence/radioSafetyBackupRecords.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import {
  backupRt95Safety,
  openRt95SafetyBackupFile,
  recordRt95SafetyBackupFile,
  recordRt95SafetyBackupSaved,
} from './rt95SafetyBackup.ts';

vi.mock('@integrations/download/browserDownload.ts', () => ({
  downloadZip: vi.fn(),
  isoTimestampForFilename: () => 'x',
}));

function eeprom(): Uint8Array {
  const e = buildFakeRt95Eeprom();
  e.set(new TextEncoder().encode('AT778-UV'), RT95_SAFETY_SIGNATURE_ADDR);
  return e;
}

async function connected() {
  setRt95EndAtForTests(0);
  const pipe = createFakeRt95Pipe({ eeprom: eeprom() });
  const radio = new Rt95Protocol();
  await radio.connect(pipe);
  const session = { pipe, radio, descriptor: {} } as unknown as RadioSession;
  return { pipe, radio, session };
}

describe('rt95SafetyBackup service', () => {
  beforeEach(() => window.localStorage.clear());

  it('reads the calibration region through the connected protocol, read-only', async () => {
    const { pipe, session } = await connected();
    const r = await backupRt95Safety(session, { region: 'cal', serial: ' ab 1 ' });
    expect(r.radioKey).toBe('AB 1');
    expect(r.manifest.format).toBe('rt95-cal-backup');
    expect(r.ident.model).toBe('RT95-P');
    expect(pipe.count('W')).toBe(0);
  });

  it('refuses a session that is not an RT95 and an empty serial', async () => {
    const { session } = await connected();
    await expect(
      backupRt95Safety({ ...session, radio: {} } as unknown as RadioSession, {
        region: 'cal',
        serial: 'x',
      }),
    ).rejects.toThrow(/only available for the RT95/);
    await expect(backupRt95Safety(session, { region: 'cal', serial: '  ' })).rejects.toThrow(
      /serial/,
    );
  });

  it('records a saved backup (no bytes) and can find it by serial', async () => {
    const { session } = await connected();
    const r = await backupRt95Safety(session, { region: 'cal', serial: 'ab 1' });
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 1')).toBeUndefined();
    expect(recordRt95SafetyBackupSaved(r)).toBe(true);
    const rec = findSafetyBackupRecord('retevis-rt95', 'AB 1');
    expect(rec).toMatchObject({ region: 'cal', fingerprint: r.manifest.fingerprint });
    expect(JSON.stringify(rec)).not.toContain('zipBytes');
  });

  it('opens a file, needs a serial when the file has none, and refuses a bad file', async () => {
    const { session } = await connected();
    const r = await backupRt95Safety(session, { region: 'cal', serial: 'ab 1' });
    const opened = await openRt95SafetyBackupFile(r.zipBytes, 'mine.zip');
    expect(opened.parsed.serial).toBe('AB 1');
    expect(recordRt95SafetyBackupFile(opened)).toBe(true);
    // a file with no serial and none typed cannot be recorded
    const noSerial = { ...opened, parsed: { ...opened.parsed, serial: '' } };
    expect(recordRt95SafetyBackupFile(noSerial)).toBe(false);
    expect(recordRt95SafetyBackupFile(noSerial, ' zz9 ')).toBe(true);
    expect(findSafetyBackupRecord('retevis-rt95', 'ZZ9')).toBeDefined();
    await expect(openRt95SafetyBackupFile(new Uint8Array([1, 2]), 'x.zip')).rejects.toThrow();
  });
});
