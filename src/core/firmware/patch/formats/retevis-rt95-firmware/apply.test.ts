import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../../../errors.ts';
import { bytesToHex } from '../../../hex.ts';
import type { FirmwarePackage } from '../../../types.ts';
import { applyFirmwarePatch, parseFirmwarePatch } from '../../index.ts';
import { CDI_LEN_OFF, RT95_MAX_IMAGE, RT95_REFUSED_RANGES, SPI_LEN_OFF } from './constants.ts';
import {
  makeSyntheticRt95Patch,
  synthRt95Built,
  synthRt95Stock,
  type SyntheticRt95Files,
} from './__fixtures__/makeSyntheticPatch.ts';

const stock = synthRt95Stock();

function pkg(f: SyntheticRt95Files): FirmwarePackage {
  return { radioId: 'retevis-rt95-head', files: { cdd: f.cdd, cdi: f.cdi, spi: f.spi } };
}

const encode = (json: unknown) => new TextEncoder().encode(JSON.stringify(json));

function u32le(b: Uint8Array, off: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(off, true);
}

async function codeOf(fn: () => unknown): Promise<string | undefined> {
  try {
    await fn();
  } catch (e) {
    return e instanceof FirmwareError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

function flippedCdd(...offsets: number[]): Uint8Array {
  const b = stock.cdd.slice();
  for (const o of offsets) b[o] = b[o]! ^ 1;
  return b;
}

function withTail(cdd: Uint8Array, tail: string | number): Uint8Array {
  const t = typeof tail === 'string' ? new TextEncoder().encode(tail) : new Uint8Array(tail);
  const out = new Uint8Array(cdd.length + t.length);
  out.set(cdd);
  out.set(t, cdd.length);
  return out;
}

type PatchJson = Record<string, unknown> & {
  hooks: { offset: number; original: string; hex: string }[];
  append: { offset: number; hex: string };
  stock: Record<string, unknown>;
};

async function patchFor(built: SyntheticRt95Files): Promise<PatchJson> {
  return (await makeSyntheticRt95Patch(stock, built, '1.0.0')) as PatchJson;
}

describe('retevis-rt95-firmware patch', () => {
  it('synthetic stock has the RT95 shape and consistent length fields', () => {
    expect(stock.cdi.length).toBe(278);
    expect(stock.spi.length).toBe(10);
    expect(u32le(stock.cdi, 0x104)).toBe(stock.cdd.length);
    expect(u32le(stock.spi, 2)).toBe(stock.cdd.length);
  });

  it('a no-op patch (no hooks, empty append) applies to stock and gives stock', async () => {
    const json = await patchFor(stock);
    expect(json.hooks).toEqual([]);
    expect(json.append).toEqual({ offset: stock.cdd.length, hex: '' });
    const out = await applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)));
    expect(out.files).toEqual({ cdd: stock.cdd, cdi: stock.cdi, spi: stock.spi });
  });

  it('round trips: merges nearby hooks, appends, rewrites .CDI at 0x104 and .spi at 2', async () => {
    const built = synthRt95Built(stock, withTail(flippedCdd(10, 20, 4000), 'tail'));
    const json = await patchFor(built);
    expect(json.hooks.map((h) => h.offset)).toEqual([10, 4000]);
    const out = await applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)));
    expect(out.files.cdd).toEqual(built.cdd);
    expect(u32le(out.files.cdi!, CDI_LEN_OFF)).toBe(built.cdd.length);
    expect(u32le(out.files.spi!, SPI_LEN_OFF)).toBe(built.cdd.length);
    expect(out.files.cdi).toEqual(built.cdi);
    expect(out.files.spi).toEqual(built.spi);
  });

  it('refuses the wrong stock', async () => {
    const json = await patchFor(synthRt95Built(stock, withTail(stock.cdd, 'x')));
    const other = synthRt95Stock(0x15600);
    expect(
      await codeOf(() => applyFirmwarePatch(pkg(other), parseFirmwarePatch(encode(json)))),
    ).toBe('patch-wrong-stock');
    const missing = { radioId: 'retevis-rt95-head', files: { cdd: stock.cdd } } as FirmwarePackage;
    expect(await codeOf(() => applyFirmwarePatch(missing, parseFirmwarePatch(encode(json))))).toBe(
      'patch-wrong-stock',
    );
  });

  it('refuses when the original bytes differ (hash still matches stock)', async () => {
    const json = await patchFor(synthRt95Built(stock, flippedCdd(100)));
    json.hooks[0]!.original = bytesToHex(Uint8Array.of(stock.cdd[100]! ^ 0xff));
    expect(
      await codeOf(() => applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)))),
    ).toBe('patch-original-mismatch');
  });

  it('refuses an append offset other than the stock length', async () => {
    const json = await patchFor(synthRt95Built(stock, withTail(stock.cdd, 'ab')));
    json.append.offset = stock.cdd.length - 1;
    expect(
      await codeOf(() => applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)))),
    ).toBe('patch-malformed');
  });

  it('refuses a result that does not match the recorded hashes', async () => {
    const json = await patchFor(synthRt95Built(stock, withTail(stock.cdd, 'ab')));
    json.append.hex = '6162ff';
    expect(
      await codeOf(() => applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)))),
    ).toBe('patch-result-mismatch');
  });

  it('refuses a result longer than the front panel flash, and allows the maximum', async () => {
    const tooLong = synthRt95Built(
      stock,
      withTail(stock.cdd, RT95_MAX_IMAGE - stock.cdd.length + 1),
    );
    const json = await patchFor(tooLong);
    expect(
      await codeOf(() => applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)))),
    ).toBe('patch-malformed');
    const atMax = synthRt95Built(stock, withTail(stock.cdd, RT95_MAX_IMAGE - stock.cdd.length));
    const ok = await applyFirmwarePatch(
      pkg(stock),
      parseFirmwarePatch(encode(await patchFor(atMax))),
    );
    expect(ok.files.cdd).toHaveLength(RT95_MAX_IMAGE);
  });

  it('refuses a format other than 1, a wrong name and a hook that changes the length', async () => {
    const json = await patchFor(stock);
    expect(await codeOf(() => parseFirmwarePatch(encode({ ...json, format: 2 })))).toBe(
      'patch-unknown-format',
    );
    const bad = await patchFor(synthRt95Built(stock, flippedCdd(100)));
    bad.hooks[0]!.hex = '0102';
    expect(await codeOf(() => parseFirmwarePatch(encode(bad)))).toBe('patch-malformed');
  });

  it('refuses a hook run over 32 bytes, and more than 256 original bytes in all', async () => {
    const long = stock.cdd.slice();
    for (let i = 0; i < 33; i++) long[200 + i] ^= 1;
    expect(
      await codeOf(async () =>
        parseFirmwarePatch(encode(await patchFor(synthRt95Built(stock, long)))),
      ),
    ).toBe('patch-malformed');
    // 9 runs of 30 bytes, 100 bytes apart: each run is fine, the total (270) is not.
    const many = stock.cdd.slice();
    for (let r = 0; r < 9; r++) for (let i = 0; i < 30; i++) many[1000 + r * 100 + i] ^= 1;
    expect(
      await codeOf(async () =>
        parseFirmwarePatch(encode(await patchFor(synthRt95Built(stock, many)))),
      ),
    ).toBe('patch-malformed');
  });
});

describe('retevis-rt95-firmware refused ranges', () => {
  // The firmware project's fw/protect.toml, as addresses (end exclusive). File offset = address - 0x08002000.
  const PROTECT_TOML: readonly (readonly [number, number])[] = [
    [0x08002000, 0x08002008],
    [0x08004f1c, 0x08005018],
    [0x080170ee, 0x080170f2],
    [0x08017360, 0x08017367],
    [0x08005074, 0x08005078],
    [0x0801722d, 0x08017234],
    [0x08017234, 0x08017238],
    [0x0800b108, 0x0800b10c],
    [0x08015058, 0x08015c20],
    [0x08017216, 0x0801721e],
    [0x08013e72, 0x08013e76],
  ];

  it('holds exactly the protect table, as .CDD file offsets', () => {
    expect(RT95_REFUSED_RANGES.map((r) => [r.start + 0x08002000, r.end + 0x08002000])).toEqual(
      PROTECT_TOML,
    );
    expect(RT95_REFUSED_RANGES).toHaveLength(11);
  });

  describe.each(RT95_REFUSED_RANGES.map((r) => [r.name, r] as const))('%s', (_name, range) => {
    it.each([
      ['its first byte', range.start],
      ['its last byte', range.end - 1],
    ])('refuses a hook on %s', async (_label, offset) => {
      const json = await patchFor(synthRt95Built(stock, flippedCdd(offset)));
      expect(
        json.hooks.some((h) => h.offset <= offset && offset < h.offset + h.hex.length / 2),
      ).toBe(true);
      const err = await codeOf(() => parseFirmwarePatch(encode(json)));
      expect(err).toBe('patch-malformed');
    });

    it('allows a hook just outside it', async () => {
      const before = range.start - 40;
      // Keep clear of other ranges: pick the byte only when it is outside every range.
      const outside = (o: number) => !RT95_REFUSED_RANGES.some((r) => o >= r.start && o < r.end);
      if (before > 0 && outside(before)) {
        const json = await patchFor(synthRt95Built(stock, flippedCdd(before)));
        expect(await codeOf(() => parseFirmwarePatch(encode(json)))).toBeUndefined();
      }
    });
  });
});
