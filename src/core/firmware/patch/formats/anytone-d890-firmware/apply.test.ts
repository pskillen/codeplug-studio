import { describe, expect, it } from 'vitest';

import { bytesToHex } from '../../../hex.ts';
import { FirmwareError } from '../../../errors.ts';
import type { FirmwarePackage } from '../../../types.ts';
import { applyFirmwarePatch, parseFirmwarePatch } from '../../index.ts';
import {
  makeSyntheticD890Patch,
  synthD890Built,
  synthD890Stock,
  type SyntheticD890Files,
} from './__fixtures__/makeSyntheticPatch.ts';

const stock = synthD890Stock();

function pkg(f: SyntheticD890Files): FirmwarePackage {
  return { radioId: 'anytone-at-d890uv', files: { cdd: f.cdd, cdi: f.cdi, spi: f.spi } };
}

function encode(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

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

function withTail(cdd: Uint8Array, tail: string): Uint8Array {
  const t = new TextEncoder().encode(tail);
  const out = new Uint8Array(cdd.length + t.length);
  out.set(cdd);
  out.set(t, cdd.length);
  return out;
}

type HookJson = { offset: number; original: string; hex: string };
type PatchJson = Record<string, unknown> & {
  hooks: HookJson[];
  append: { offset: number; hex: string };
  stock: Record<string, unknown>;
};

async function patchFor(built: SyntheticD890Files): Promise<PatchJson> {
  return (await makeSyntheticD890Patch(stock, built, '1.0.0')) as PatchJson;
}

describe('anytone-d890-firmware patch', () => {
  it('synthetic stock has consistent length fields', () => {
    expect(stock.cdi.length).toBe(278);
    expect(stock.spi.length).toBe(51);
    expect(u32le(stock.cdi, 0x104)).toBe(5000);
    expect(u32le(stock.spi, 6)).toBe(5000);
  });

  it('identical packages give no hooks and an empty append', async () => {
    const json = await patchFor(stock);
    expect(json.hooks).toEqual([]);
    expect(json.append).toEqual({ offset: 5000, hex: '' });
    const out = await applyFirmwarePatch(pkg(stock), parseFirmwarePatch(encode(json)));
    expect(out.files).toEqual({ cdd: stock.cdd, cdi: stock.cdi, spi: stock.spi });
  });

  it('merges nearby hooks, appends, and rewrites both length fields', async () => {
    const built = synthD890Built(stock, withTail(flippedCdd(10, 20, 4000), 'tail'));
    const json = await patchFor(built);
    expect(json.hooks).toHaveLength(2); // 10 and 20 merge (gap < 16); 4000 stays separate
    expect(json.hooks[0]!.original).toBe(bytesToHex(stock.cdd.slice(10, 21)));
    expect(json.append.hex).toBe('7461696c');
    const parsed = parseFirmwarePatch(encode(json));
    const out = await applyFirmwarePatch(pkg(stock), parsed);
    expect(out.radioId).toBe('anytone-at-d890uv');
    expect(out.files.cdd).toEqual(built.cdd);
    expect(out.files.cdi).toEqual(built.cdi);
    expect(out.files.spi).toEqual(built.spi);
    expect(u32le(out.files.cdi!, 0x104)).toBe(5004);
    expect(u32le(out.files.spi!, 6)).toBe(5004);
  });

  it('describes stock and result by role', async () => {
    const { description } = parseFirmwarePatch(encode(await patchFor(stock)));
    expect(Object.keys(description.stock).sort()).toEqual(['cdd', 'cdi', 'spi']);
    expect(Object.keys(description.result).sort()).toEqual(['cdd', 'cdi', 'spi']);
    expect(description.stock.cdi!.size).toBe(278);
  });

  it('refuses the wrong stock', async () => {
    const parsed = parseFirmwarePatch(
      encode(await patchFor(synthD890Built(stock, flippedCdd(100)))),
    );
    const wrong = { ...stock, cdd: flippedCdd(3000) };
    expect(await codeOf(() => applyFirmwarePatch(pkg(wrong), parsed))).toBe('patch-wrong-stock');
    expect(
      await codeOf(() =>
        applyFirmwarePatch(
          { radioId: 'anytone-at-d890uv', files: { cdd: stock.cdd, cdi: stock.cdi } },
          parsed,
        ),
      ),
    ).toBe('patch-wrong-stock');
  });

  it('refuses a tampered hook as a result mismatch', async () => {
    const json = await patchFor(synthD890Built(stock, flippedCdd(100)));
    const h = json.hooks[0]!;
    h.hex = h.hex.slice(0, -2) + (h.hex.endsWith('00') ? '01' : '00');
    const parsed = parseFirmwarePatch(encode(json));
    expect(await codeOf(() => applyFirmwarePatch(pkg(stock), parsed))).toBe(
      'patch-result-mismatch',
    );
  });

  it('refuses a hook whose original bytes do not match', async () => {
    const json = await patchFor(synthD890Built(stock, flippedCdd(100)));
    const h = json.hooks[0]!;
    h.original = h.original.slice(0, -2) + (h.original.endsWith('00') ? '01' : '00');
    const parsed = parseFirmwarePatch(encode(json));
    expect(await codeOf(() => applyFirmwarePatch(pkg(stock), parsed))).toBe(
      'patch-original-mismatch',
    );
  });

  it('refuses a hook outside the stock image', async () => {
    const json = await patchFor(stock);
    json.hooks = [{ offset: 4999, original: 'aabb', hex: 'ccdd' }];
    const parsed = parseFirmwarePatch(encode(json));
    expect(await codeOf(() => applyFirmwarePatch(pkg(stock), parsed))).toBe('patch-malformed');
  });

  it('refuses a hook that changes length', async () => {
    const json = await patchFor(stock);
    json.hooks = [{ offset: 10, original: 'aabb', hex: 'cc' }];
    expect(await codeOf(() => parseFirmwarePatch(encode(json)))).toBe('patch-malformed');
  });

  it('refuses an append that does not start at the end of the image', async () => {
    const json = await patchFor(synthD890Built(stock, withTail(stock.cdd, 'x')));
    json.append = { ...json.append, offset: 4999 };
    const parsed = parseFirmwarePatch(encode(json));
    expect(await codeOf(() => applyFirmwarePatch(pkg(stock), parsed))).toBe('patch-malformed');
  });

  it.each([
    ['missing key', (s: Record<string, unknown>) => delete s['.spi']],
    [
      'extra key',
      (s: Record<string, unknown>) => (s['.bin'] = { sha256: 'a'.repeat(64), size: 1 }),
    ],
  ])('refuses stock with a %s', async (_label, mutate) => {
    const json = await patchFor(stock);
    mutate(json.stock);
    expect(await codeOf(() => parseFirmwarePatch(encode(json)))).toBe('patch-malformed');
  });

  it.each([
    [
      'negative hook offset',
      (j: PatchJson) => (j.hooks = [{ offset: -1, original: 'aa', hex: 'bb' }]),
    ],
    ['bad hook hex', (j: PatchJson) => (j.hooks = [{ offset: 1, original: 'aa', hex: 'zz' }])],
    ['missing append', (j: PatchJson) => delete (j as Record<string, unknown>).append],
    ['hooks not a list', (j: PatchJson) => ((j as Record<string, unknown>).hooks = 'x')],
  ])('refuses a malformed patch: %s', async (_label, mutate) => {
    const json = await patchFor(stock);
    mutate(json);
    expect(await codeOf(() => parseFirmwarePatch(encode(json)))).toBe('patch-malformed');
  });

  it('never mutates the input package', async () => {
    const input = { cdd: stock.cdd.slice(), cdi: stock.cdi.slice(), spi: stock.spi.slice() };
    const parsed = parseFirmwarePatch(
      encode(await patchFor(synthD890Built(stock, withTail(flippedCdd(10, 4000), 'tail')))),
    );
    await applyFirmwarePatch(pkg(input), parsed);
    expect(input).toEqual({ cdd: stock.cdd, cdi: stock.cdi, spi: stock.spi });
  });

  it('has no version stamp', async () => {
    const parsed = parseFirmwarePatch(encode(await patchFor(stock)));
    expect(parsed.format.readVersionStamp).toBeUndefined();
  });
});
