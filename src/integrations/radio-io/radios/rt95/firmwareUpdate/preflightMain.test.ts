import { describe, expect, it } from 'vitest';

import { RadioWrongIdentError } from '../../../kit/errors.ts';
import { buildFakeRt95Eeprom, createFakeRt95Pipe } from '../__fixtures__/fakeRt95Pipe.ts';
import { RT95_SAFETY_SIGNATURE_ADDR } from '../safetyBackup/reader.ts';
import { Rt95BootloaderMock } from './__fixtures__/rt95BootloaderMock.ts';
import { RT95_MAIN_FIRMWARE_UPDATER } from './descriptor.ts';
import {
  createRt95MainPreflight,
  RT95_HEAD_PREFLIGHT,
  RT95_MAIN_PREFLIGHT,
  RT95_MAIN_UPDATE_MODE_CONFIRM,
} from './preflight.ts';

const sb = RT95_MAIN_PREFLIGHT.safetyBackup!;

function eeprom(): Uint8Array {
  const e = buildFakeRt95Eeprom();
  e.set(new TextEncoder().encode('AT778-UV'), RT95_SAFETY_SIGNATURE_ADDR);
  for (let a = 0x3cc0; a < 0x3fc0; a++) e[a] = (a * 7) & 0xff || 1;
  return e;
}

describe('RT95 MAIN pre-flight', () => {
  it('has the inverse screen tick and is carried by the registered descriptor', () => {
    expect(RT95_MAIN_UPDATE_MODE_CONFIRM).toBe('The screen says UPDATE THE RF CPU.');
    expect(RT95_MAIN_PREFLIGHT.updateModeConfirm).toBe(RT95_MAIN_UPDATE_MODE_CONFIRM);
    expect(RT95_MAIN_FIRMWARE_UPDATER.preflight).toBe(RT95_MAIN_PREFLIGHT);
    expect(RT95_HEAD_PREFLIGHT.updateModeConfirm).not.toBe(RT95_MAIN_UPDATE_MODE_CONFIRM);
  });

  it('keeps the head attestations and has no safety backup on the head', () => {
    expect(RT95_MAIN_PREFLIGHT.attestations.map((a) => a.id)).toEqual([
      'serial-2101',
      'test-screen-v111',
    ]);
    expect(RT95_HEAD_PREFLIGHT.safetyBackup).toBeUndefined();
  });

  it('probe: names the main board in the wrong-radio text, sends only PROGRAM, 02, END', async () => {
    const probe = createRt95MainPreflight({ retryDelayMs: 0 }).probe!;
    const ok = new Rt95BootloaderMock({ mode: 'normal' });
    await expect(probe.run(ok, {})).resolves.toEqual({ summary: 'RT95-P, version V100' });
    expect(ok.log).toEqual(['PROGRAM', 'ident', 'END']);
    const bad = new Rt95BootloaderMock({ mode: 'normal', model: 'RT95' });
    const err = await probe.run(bad, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioWrongIdentError);
    expect((err as Error).message).toMatch(/Studio flashes only the RT95-P main board/);
  });
});

describe('RT95 MAIN safety backup step', () => {
  it('is the calibration backup, keyed by the typed serial', () => {
    expect(sb.recordFamily).toBe('retevis-rt95');
    expect(sb.normaliseSerial(' ab  1 ')).toBe('AB 1');
    expect(sb.link.baudRate).toBe(9600);
  });

  it('already saved: sends only PROGRAM, 02 and END', async () => {
    const pipe = createFakeRt95Pipe({ eeprom: eeprom() });
    const out = await sb.run(pipe, { serial: 'ab 1', radioKey: 'AB 1', isSaved: () => true });
    expect(out).toMatchObject({ kind: 'already-saved', radioKey: 'AB 1' });
    expect(pipe.log.map((l) => l.op)).toEqual(['PROGRAM', 'IDENT', 'END']);
  });

  it('not saved: reads 0x3B00-0x3FFF and 0x7B00 and returns taken', async () => {
    const pipe = createFakeRt95Pipe({ eeprom: eeprom() });
    const out = await sb.run(pipe, { serial: 'ab 1', radioKey: 'AB 1', isSaved: () => false });
    expect(out.kind).toBe('taken');
    const reads = pipe.log.filter((l) => l.op === 'R').map((l) => l.addr!);
    expect(reads).toContain(0x3b00);
    expect(reads).toContain(0x3ff0);
    expect(reads).toContain(0x7b00);
    expect(Math.min(...reads)).toBe(0x3b00);
    expect(pipe.count('W')).toBe(0);
    expect(pipe.log.at(-1)?.op).toBe('END');
    if (out.kind === 'taken') {
      expect(out.radioKey).toBe('AB 1');
      await expect(sb.verifyFile(out.zipBytes, { fallbackSerial: '' })).resolves.toMatchObject({
        radioKey: 'AB 1',
      });
    }
  });
});
