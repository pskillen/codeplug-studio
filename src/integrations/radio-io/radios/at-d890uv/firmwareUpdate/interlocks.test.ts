import { describe, expect, it } from 'vitest';

import { preparedD890Image, synthD890Package } from './__fixtures__/syntheticPackage.ts';
import { makeD890UpdateFrame } from './frames.ts';
import {
  checkD890FirmwareImage,
  checkD890Outgoing,
  checkD890Package,
  d890AddrProblem,
} from './interlocks.ts';
import { parseD890FirmwarePackage } from './package.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const zeros = new Uint8Array(32);

describe('makeD890UpdateFrame', () => {
  it('lays out a 40-byte frame', () => {
    const data = Uint8Array.from({ length: 32 }, (_, i) => i);
    const f = makeD890UpdateFrame(0x0800c020, data);
    expect(f).toHaveLength(40);
    expect(f[0]).toBe(1);
    expect([...f.subarray(1, 5)]).toEqual([0x20, 0xc0, 0x00, 0x08]);
    expect(f.subarray(5, 37)).toEqual(data);
    const sum = f.subarray(1, 37).reduce((a, b) => a + b, 0) & 0xffff;
    expect(f[37]! | (f[38]! << 8)).toBe(sum);
    expect(f[39]).toBe(6);
  });
});

describe('checkD890Outgoing', () => {
  it('allows only update traffic', () => {
    for (const ok of [enc('UPDATE'), Uint8Array.of(2), Uint8Array.of(0x18)]) {
      expect(() => checkD890Outgoing(ok)).not.toThrow();
    }
    expect(() => checkD890Outgoing(makeD890UpdateFrame(0x0800c000, zeros))).not.toThrow();
  });

  it.each([
    ['PROGRAM', enc('PROGRAM')],
    ['END', enc('END')],
    ['R…', Uint8Array.of(0x52, 0, 0, 0, 0, 0)],
    ['W…', Uint8Array.of(0x57, ...new Uint8Array(40))],
    ['FACTORY', enc('FACTORY')],
    ['NEWEROM', enc('NEWEROM')],
    ['+ACTIVE', enc('+ACTIVE')],
    ['empty', new Uint8Array(0)],
    ['01 alone', Uint8Array.of(1)],
  ])('refuses %s', (_name, bytes) => {
    expect(() => checkD890Outgoing(bytes)).toThrow(expect.objectContaining({ code: 'interlock' }));
  });

  it('refuses a bad checksum', () => {
    const f = makeD890UpdateFrame(0x0800c000, zeros);
    f[37] ^= 1;
    expect(() => checkD890Outgoing(f)).toThrow(/checksum/);
  });
});

describe('address windows', () => {
  it.each([
    0x08000000, 0x0800a000, 0x0800bfe0, 0x0800bfff, 0x081e4000, 0x081f0000, 0x20000000, 0,
    0x081e3ff0,
  ])('refuses a frame at address %i', (addr) => {
    expect(d890AddrProblem(addr)).toBeDefined();
    expect(() => checkD890Outgoing(makeD890UpdateFrame(addr, zeros))).toThrow(
      expect.objectContaining({ code: 'interlock' }),
    );
  });

  it.each([0x0800c000, 0x081e3fe0])('allows a frame at address %i', (addr) => {
    expect(d890AddrProblem(addr)).toBeUndefined();
    expect(() => checkD890Outgoing(makeD890UpdateFrame(addr, zeros))).not.toThrow();
  });
});

describe('checkD890Package', () => {
  const pkgAt = (addr?: number, len?: number) =>
    parseD890FirmwarePackage(synthD890Package(addr, len));

  it('passes the synthetic package', () => {
    expect(() => checkD890Package(pkgAt())).not.toThrow();
  });

  it('refuses a package loading below the firmware window', () => {
    expect(() => checkD890Package(pkgAt(0x08008000))).toThrow(/outside the firmware window/);
  });

  it('refuses a package that touches the activation page', () => {
    expect(() => checkD890Package(pkgAt(0x0800a000))).toThrow(
      expect.objectContaining({ code: 'interlock' }),
    );
  });

  it('refuses a package that runs into the image cache', () => {
    expect(() => checkD890Package(pkgAt(0x081e3f80, 0x100))).toThrow(
      expect.objectContaining({ code: 'interlock' }),
    );
  });

  it('refuses a package whose first entry does not load at the firmware base', () => {
    expect(() => checkD890Package(pkgAt(0x0800c020))).toThrow(/first entry must load/);
  });

  it('refuses an image with no vector table', () => {
    const pkg = { ...pkgAt(), cdd: new Uint8Array(100) };
    expect(() => checkD890Package(pkg)).toThrow(/vector table/);
  });

  it('refuses an even reset vector', () => {
    const files = synthD890Package();
    files.cdd[4] = 0x40;
    expect(() => checkD890Package(parseD890FirmwarePackage(files))).toThrow(/vector table/);
  });
});

describe('checkD890FirmwareImage', () => {
  const files = synthD890Package();

  it('returns the parsed package', () => {
    expect(checkD890FirmwareImage(preparedD890Image(files)).model).toBe('D890UV');
  });

  it('refuses an image for another radio', () => {
    expect(() => checkD890FirmwareImage(preparedD890Image(files, { radioId: 'x' }))).toThrow(
      /not for the AT-D890UV/,
    );
  });

  it('refuses missing or extra roles', () => {
    expect(() =>
      checkD890FirmwareImage(
        preparedD890Image(files, { files: { cdd: files.cdd, cdi: files.cdi } }),
      ),
    ).toThrow(/exactly the .CDD, .CDI and .spi/);
    expect(() =>
      checkD890FirmwareImage(
        preparedD890Image(files, { files: { ...files, extra: new Uint8Array(1) } }),
      ),
    ).toThrow(/exactly the .CDD, .CDI and .spi/);
  });

  it('refuses a resource-mode package', () => {
    expect(() =>
      checkD890FirmwareImage(
        preparedD890Image(files, { files: { ...files, spi: files.spi.slice(0, 14) } }),
      ),
    ).toThrow(/resource mode/);
  });
});
