import { describe, expect, it } from 'vitest';

import { synthD890Package } from './__fixtures__/syntheticPackage.ts';
import { d890BlockCount, d890Blocks, parseD890FirmwarePackage } from './package.ts';

describe('parseD890FirmwarePackage', () => {
  it('parses the synthetic package', () => {
    const pkg = parseD890FirmwarePackage(synthD890Package(0x0800c000, 100));
    expect(pkg.model).toBe('D890UV');
    expect(pkg.version).toBe('V100');
    expect(pkg.entries).toEqual([
      { name: 'D890UV_MAIN.bin', addr: 0x0800c000, len: 100, off: 0, flag: 0x10000 },
    ]);
    expect(d890BlockCount(pkg)).toBe(4);
  });

  it('yields zero-padded 32-byte blocks in order', () => {
    const files = synthD890Package(0x0800c000, 100);
    const blocks = [...d890Blocks(parseD890FirmwarePackage(files))];
    expect(blocks.map((b) => b.addr)).toEqual([0x0800c000, 0x0800c020, 0x0800c040, 0x0800c060]);
    expect(blocks.every((b) => b.data.length === 32)).toBe(true);
    expect(blocks[3]!.data.subarray(0, 4)).toEqual(files.cdd.subarray(96, 100));
    expect(blocks[3]!.data.subarray(4)).toEqual(new Uint8Array(28));
  });

  it('refuses a 14-byte .spi (resource mode)', () => {
    const files = synthD890Package();
    expect(() => parseD890FirmwarePackage({ ...files, spi: files.spi.slice(0, 14) })).toThrow(
      /ICON pack \/ resource mode is not supported/,
    );
  });

  it('refuses a .spi that does not start with 0x20', () => {
    const files = synthD890Package();
    const spi = files.spi.slice();
    spi[0] = 0x21;
    expect(() => parseD890FirmwarePackage({ ...files, spi })).toThrow(
      expect.objectContaining({ code: 'interlock' }),
    );
  });

  it('refuses a .CDI length mismatch', () => {
    const files = synthD890Package();
    expect(() => parseD890FirmwarePackage({ ...files, cdi: files.cdi.slice(0, 277) })).toThrow(
      expect.objectContaining({ code: 'interlock' }),
    );
  });

  it('refuses a total length mismatch', () => {
    const files = synthD890Package();
    expect(() => parseD890FirmwarePackage({ ...files, cdd: files.cdd.slice(0, 99) })).toThrow(
      expect.objectContaining({ code: 'interlock' }),
    );
  });
});
