import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import {
  RadioInterlockError,
  RadioProtocolError,
  RadioWrongIdentError,
} from '../../../kit/errors.ts';
import type { BytePipe } from '../../../types.ts';
import { buildFakeRt95Eeprom, createFakeRt95Pipe } from '../__fixtures__/fakeRt95Pipe.ts';
import {
  normaliseRadioSerial,
  parseRt95SafetyZip,
  RT95_SAFETY_MANIFEST_KEYS,
  rt95SafetyBackupRadioKey,
  rt95SafetyFileSerial,
  sha256Hex,
} from './files.ts';
import { readRt95SafetyRegion, RT95_SAFETY_SIGNATURE_ADDR } from './reader.ts';
import { checkRt95SafetyBackupOutgoing, runRt95SafetyBackup } from './runner.ts';

const SERIAL = 'ab 12345';

function goodEeprom(): Uint8Array {
  const e = buildFakeRt95Eeprom();
  e.set(new TextEncoder().encode('AT778-UV'), RT95_SAFETY_SIGNATURE_ADDR);
  // Distinct calibration bytes so a replayed or shifted block would show.
  for (let a = 0x3cc0; a < 0x3fc0; a++) e[a] = (a * 7) & 0xff || 1;
  return e;
}

function readerOver(
  eeprom: Uint8Array,
  hook?: (addr: number, n: number) => Uint8Array | undefined,
) {
  const counts = new Map<number, number>();
  return async (addr: number): Promise<Uint8Array> => {
    const n = (counts.get(addr) ?? 0) + 1;
    counts.set(addr, n);
    return hook?.(addr, n) ?? eeprom.slice(addr, addr + 16);
  };
}

describe('normaliseRadioSerial', () => {
  it('trims, uppercases and collapses inner whitespace', () => {
    expect(normaliseRadioSerial('  ab   12345 ')).toBe('AB 12345');
    expect(rt95SafetyBackupRadioKey(SERIAL)).toBe('AB 12345');
  });
  it('treats empty as invalid', () => {
    expect(normaliseRadioSerial('   ')).toBe('');
  });
  it('sanitises a file-name serial', () => {
    expect(rt95SafetyFileSerial('ab 12/345')).toBe('AB-12-345');
    expect(rt95SafetyFileSerial('///')).toBe('unknown');
  });
});

describe('readRt95SafetyRegion', () => {
  it('reads the calibration region and the alias', async () => {
    const e = goodEeprom();
    const r = await readRt95SafetyRegion(readerOver(e), { region: 'cal' });
    expect(r.bytes).toEqual(e.slice(0x3b00, 0x4000));
    expect(r.rereads).toEqual([]);
  });

  it('re-reads a block that differs once and lists it', async () => {
    const e = goodEeprom();
    const r = await readRt95SafetyRegion(
      readerOver(e, (addr, n) =>
        addr === 0x3d00 && n === 1 ? new Uint8Array(16).fill(9) : undefined,
      ),
      { region: 'cal' },
    );
    expect(r.bytes).toEqual(e.slice(0x3b00, 0x4000));
    expect(r.rereads).toEqual([0x3d00]);
  });

  it('fails when a block differs on all three reads', async () => {
    const e = goodEeprom();
    await expect(
      readRt95SafetyRegion(
        readerOver(e, (addr, n) => (addr === 0x3d00 ? new Uint8Array(16).fill(n) : undefined)),
        { region: 'cal' },
      ),
    ).rejects.toThrow(/differs on all three reads/);
  });

  it('fails on a 16 KiB part (alias equals the ident block)', async () => {
    const e = goodEeprom();
    e.copyWithin(0x7b00, 0x3b00, 0x3b10);
    await expect(readRt95SafetyRegion(readerOver(e), { region: 'cal' })).rejects.toThrow(/16 KiB/);
  });

  it('fails without the AT778-UV signature', async () => {
    const e = goodEeprom();
    e.fill(0xff, 0x3ff8, 0x4000);
    await expect(readRt95SafetyRegion(readerOver(e), { region: 'cal' })).rejects.toThrow(
      /AT778-UV/,
    );
  });

  it('fails on an all-zero block inside the region', async () => {
    const e = goodEeprom();
    e.fill(0, 0x3d00, 0x3d10);
    await expect(readRt95SafetyRegion(readerOver(e), { region: 'cal' })).rejects.toThrow(
      /empty block/,
    );
  });
});

describe('runRt95SafetyBackup', () => {
  it('cal: manifest, fingerprint and zip layout', async () => {
    const e = goodEeprom();
    const pipe = createFakeRt95Pipe({ eeprom: e });
    const r = await runRt95SafetyBackup(pipe, { region: 'cal', serial: SERIAL, retryDelayMs: 1 });
    expect(r.radioKey).toBe('AB 12345');
    expect(r.ident.model).toBe('RT95-P');
    expect(Object.keys(r.manifest)).toEqual([...RT95_SAFETY_MANIFEST_KEYS]);
    expect(r.manifest).toMatchObject({
      format: 'rt95-cal-backup',
      version: 1,
      start: 15104,
      end: 16383,
      size: 1280,
      chip: '32KiB',
      signature_ok: true,
      passes: 2,
      tool_sha256: '',
      serial: 'AB 12345',
    });
    expect(r.manifest.fingerprint).toBe(r.manifest.sha256.slice(0, 8));
    expect(r.manifest.sha256).toBe(await sha256Hex(e.slice(0x3b00, 0x4000)));
    const files = Object.keys(unzipSync(r.zipBytes)).sort();
    const base = r.fileName.replace(/\.zip$/, '');
    expect(base).toMatch(/^rt95-eeprom-cal-AB-12345-\d{8}-\d{6}$/);
    expect(files).toEqual([`${base}.bin`, `${base}.json`]);
    expect(pipe.count('W')).toBe(0);
    expect(pipe.count('END')).toBe(1);
    const parsed = await parseRt95SafetyZip(r.zipBytes);
    expect(parsed.region).toBe('cal');
    expect(parsed.serial).toBe('AB 12345');
  });

  it('full: writes the firmware tool format', async () => {
    const e = goodEeprom();
    const pipe = createFakeRt95Pipe({ eeprom: e });
    const r = await runRt95SafetyBackup(pipe, { region: 'full', serial: SERIAL });
    expect(r.manifest).toMatchObject({
      format: 'rt95-full-backup',
      start: 0,
      end: 32767,
      size: 32768,
    });
    const json = JSON.parse(
      strFromU8(unzipSync(r.zipBytes)[`${r.fileName.replace(/\.zip$/, '')}.json`]!),
    ) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([...RT95_SAFETY_MANIFEST_KEYS]);
    expect(json.ident).toEqual({ model: 'RT95-P', bandlimit: 1, version: 'V100' });
    expect(r.bytes).toEqual(e);
    expect(pipe.count('W')).toBe(0);
  }, 30_000);

  it('sends END and nothing after a failed read', async () => {
    const e = goodEeprom();
    e.fill(0xff, 0x3ff8, 0x4000);
    const pipe = createFakeRt95Pipe({ eeprom: e });
    await expect(
      runRt95SafetyBackup(pipe, { region: 'cal', serial: SERIAL }),
    ).rejects.toBeInstanceOf(RadioProtocolError);
    expect(pipe.count('END')).toBe(1);
  });

  it('refuses a wrong ident before any read, and still sends END', async () => {
    const sent: number[][] = [];
    const rx: number[] = [];
    const reply = (bytes: number[]) => setTimeout(() => rx.push(...bytes), 0);
    const pipe: BytePipe = {
      async write(data) {
        sent.push([...data]);
        reply([...data]);
        if (data.length === 7) reply([0x51, 0x58, 0x06]);
        if (data.length === 1 && data[0] === 0x02) {
          reply([
            0x49,
            ...new TextEncoder().encode('RT95'),
            0,
            0,
            0,
            1,
            ...new TextEncoder().encode('V100'),
            0,
            0,
            0x06,
          ]);
        }
      },
      async readExact(n) {
        for (let i = 0; i < 50 && rx.length < n; i++) await new Promise((r) => setTimeout(r, 2));
        if (rx.length < n) throw new Error('no data');
        return Uint8Array.from(rx.splice(0, n));
      },
      async flush() {
        rx.length = 0;
      },
      async close() {},
    };
    await expect(
      runRt95SafetyBackup(pipe, { region: 'cal', serial: SERIAL }),
    ).rejects.toBeInstanceOf(RadioWrongIdentError);
    expect(sent.some((f) => f[0] === 0x52)).toBe(false);
    expect(sent.at(-1)).toEqual([0x45, 0x4e, 0x44]);
  });
});

describe('checkRt95SafetyBackupOutgoing', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('allows PROGRAM, 02, a 16-byte read and END', () => {
    for (const f of [
      enc('PROGRAM'),
      enc('END'),
      Uint8Array.of(2),
      Uint8Array.of(0x52, 0x3b, 0, 0x10),
    ]) {
      expect(() => checkRt95SafetyBackupOutgoing(f)).not.toThrow();
    }
  });
  it('refuses a write frame', () => {
    const w = Uint8Array.from([0x57, 0x3b, 0x00, 0x10, ...new Array(16).fill(0), 0, 0x06]);
    expect(() => checkRt95SafetyBackupOutgoing(w)).toThrow(RadioInterlockError);
  });
  it('refuses a read of another length', () => {
    expect(() => checkRt95SafetyBackupOutgoing(Uint8Array.of(0x52, 0x3b, 0, 0x20))).toThrow(
      RadioInterlockError,
    );
  });
  it('refuses anything else', () => {
    expect(() => checkRt95SafetyBackupOutgoing(Uint8Array.of(0x06))).toThrow(RadioInterlockError);
    expect(() => checkRt95SafetyBackupOutgoing(new Uint8Array(0))).toThrow(RadioInterlockError);
  });
});

describe('parseRt95SafetyZip', () => {
  async function good() {
    return runRt95SafetyBackup(createFakeRt95Pipe({ eeprom: goodEeprom() }), {
      region: 'cal',
      serial: SERIAL,
    });
  }
  function rezip(zip: Uint8Array, edit: (files: Record<string, Uint8Array>, base: string) => void) {
    const files = unzipSync(zip);
    const base = Object.keys(files)[0]!.replace(/\.(bin|json)$/, '');
    edit(files, base);
    return zipSync(files);
  }
  function editManifest(zip: Uint8Array, edit: (m: Record<string, unknown>) => void) {
    return rezip(zip, (files, base) => {
      const m = JSON.parse(strFromU8(files[`${base}.json`]!)) as Record<string, unknown>;
      edit(m);
      files[`${base}.json`] = strToU8(JSON.stringify(m));
    });
  }

  it('refuses a changed byte', async () => {
    const r = await good();
    const zip = rezip(r.zipBytes, (files, base) => {
      const bin = files[`${base}.bin`]!.slice();
      bin[100] ^= 1;
      files[`${base}.bin`] = bin;
    });
    await expect(parseRt95SafetyZip(zip)).rejects.toThrow(/SHA-256/);
  });
  it('refuses a wrong format', async () => {
    const r = await good();
    const zip = editManifest(r.zipBytes, (m) => (m.format = 'something-else'));
    await expect(parseRt95SafetyZip(zip)).rejects.toThrow(/unknown format/);
  });
  it('refuses a missing key', async () => {
    const r = await good();
    const zip = editManifest(r.zipBytes, (m) => delete m.fingerprint);
    await expect(parseRt95SafetyZip(zip)).rejects.toThrow(/fingerprint/);
  });
  it('refuses a wrong model and fewer than two passes', async () => {
    const r = await good();
    await expect(
      parseRt95SafetyZip(
        editManifest(
          r.zipBytes,
          (m) => (m.ident = { model: 'RT95', bandlimit: 1, version: 'V100' }),
        ),
      ),
    ).rejects.toThrow(/RT95-P/);
    await expect(
      parseRt95SafetyZip(editManifest(r.zipBytes, (m) => (m.passes = 1))),
    ).rejects.toThrow(/twice/);
  });
  it('accepts a file with no serial and reports it empty', async () => {
    const r = await good();
    const parsed = await parseRt95SafetyZip(editManifest(r.zipBytes, (m) => delete m.serial));
    expect(parsed.serial).toBe('');
  });
  it('refuses a non-zip', async () => {
    await expect(parseRt95SafetyZip(new Uint8Array([1, 2, 3]))).rejects.toThrow(/zip/);
  });
});
