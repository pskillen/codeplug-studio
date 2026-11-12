import { describe, expect, it } from 'vitest';

import { makeSyntheticUfw, type SyntheticUfwOptions } from './__fixtures__/makeSyntheticUfw.ts';
import { encDecode, parseUv5rMiniStockUfw, parseUv5rMiniUfw, Uv5rMiniUfwError } from './ufw.ts';

function codeOf(o: SyntheticUfwOptions): string | undefined {
  try {
    parseUv5rMiniUfw(makeSyntheticUfw(o).bytes);
  } catch (e) {
    return e instanceof Uv5rMiniUfwError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

describe('encDecode', () => {
  it('is its own inverse and restarts the key per call', () => {
    const b = new Uint8Array([1, 2, 3, 4, 5, 250, 251]);
    expect(encDecode(encDecode(b))).toEqual(b);
    expect(encDecode(new Uint8Array(3))[0]).toBe(0xff);
    expect(encDecode(new Uint8Array(2))[1]).toBe(0xdf);
  });
});

describe('parseUv5rMiniUfw', () => {
  it('reads a valid container', () => {
    const s = makeSyntheticUfw({ flashSize: 0x2000 });
    const u = parseUv5rMiniUfw(s.bytes);
    expect(u.entries.flash.data).toEqual(s.flash);
    expect(u.loader.packed).toEqual(s.loader);
    expect(u.loader.entry.name).toBe('uart_user.bin');
    expect(u.loader.entry.attr).toBe(0x41);
  });

  it.each<[string, SyntheticUfwOptions, string]>([
    ['header CRC', { badHeaderCrc: true }, 'header-crc'],
    ['list CRC', { badListCrc: true }, 'list-crc'],
    ['flash data CRC', { badFlashCrc: true }, 'data-crc'],
    ['ota data CRC', { badOtaCrc: true }, 'data-crc'],
    ['a third entry', { thirdEntry: true }, 'entry-count'],
    ['no ota.bin', { noOta: true }, 'entry-set'],
    ['two loaders', { twoLoaders: true }, 'ota-directory'],
    ['loader name', { otaLoaderName: 'other.bin' }, 'ota-loader-name'],
    ['loader attr', { otaAttr: 0x40 }, 'ota-loader-attr'],
    ['loader entry CRC', { badOtaHeaderCrc: true }, 'ota-header-crc'],
    ['loader data CRC', { badOtaDataCrc: true }, 'ota-data-crc'],
  ])('refuses %s', (_n, opts, code) => {
    expect(codeOf(opts)).toBe(code);
  });

  it('refuses a short file and an entry running past the file end', () => {
    const s = makeSyntheticUfw();
    expect(() => parseUv5rMiniUfw(s.bytes.subarray(0, 10))).toThrow(Uv5rMiniUfwError);
    expect(() => parseUv5rMiniUfw(s.bytes.subarray(0, s.bytes.length - 1))).toThrow(
      /outside the image file/,
    );
  });
});

describe('parseUv5rMiniStockUfw', () => {
  it('accepts a loaderless file as a stock base', () => {
    const s = makeSyntheticUfw({ flashSize: 0x2000, blankOta: true });
    const u = parseUv5rMiniStockUfw(s.bytes);
    expect(u.loader).toBeNull();
    expect(u.entries.flash.data).toEqual(s.flash);
  });

  it('still reads a stock base that carries a loader', () => {
    const s = makeSyntheticUfw({ flashSize: 0x2000 });
    expect(parseUv5rMiniStockUfw(s.bytes).loader?.packed).toEqual(s.loader);
  });

  it('refuses a stock file whose ota.bin is neither blank nor a loader entry', () => {
    expect(() => parseUv5rMiniStockUfw(makeSyntheticUfw({ otaAttr: 0x40 }).bytes)).toThrow(
      Uv5rMiniUfwError,
    );
  });

  it('keeps the container checks for a loaderless file', () => {
    expect(() =>
      parseUv5rMiniStockUfw(makeSyntheticUfw({ blankOta: true, badFlashCrc: true }).bytes),
    ).toThrow(/checksum/);
  });

  it('an image never takes the loaderless path: parseUv5rMiniUfw refuses it', () => {
    expect(codeOf({ blankOta: true })).toBe('ota-directory');
  });
});
