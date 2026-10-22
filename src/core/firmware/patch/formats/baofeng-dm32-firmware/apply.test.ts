import { describe, expect, it } from 'vitest';

import { seededBytes } from '../../../__fixtures__/synthetic.ts';
import { FirmwareError } from '../../../errors.ts';
import type { FirmwarePackage } from '../../../types.ts';
import {
  applyFirmwarePatch,
  parseFirmwarePatch,
  readFirmwarePatchVersionStamp,
} from '../../index.ts';
import { makeSyntheticDm32Patch } from './__fixtures__/makeSyntheticPatch.ts';

const stock = seededBytes(1, 5000);

function pkg(bin: Uint8Array): FirmwarePackage {
  return { radioId: 'baofeng-dm32uv', files: { bin } };
}

function encode(json: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function codeOf(fn: () => unknown): Promise<string | undefined> {
  try {
    await fn();
  } catch (e) {
    return e instanceof FirmwareError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

async function roundtrip(built: Uint8Array) {
  const json = await makeSyntheticDm32Patch(stock, built, 'v1.0.0-rc1');
  const parsed = parseFirmwarePatch(encode(json));
  const out = await applyFirmwarePatch(pkg(stock), parsed);
  expect(out.files.bin).toEqual(built);
  return json as { segments: { offset: number; hex: string }[] };
}

function flipped(...offsets: number[]): Uint8Array {
  const b = stock.slice();
  for (const o of offsets) b[o] = b[o]! ^ 1;
  return b;
}

describe('baofeng-dm32-firmware patch', () => {
  it('identical images give no segments and apply returns stock', async () => {
    expect((await roundtrip(stock)).segments).toEqual([]);
  });

  it('merges nearby changes and appends the tail', async () => {
    const built = concat(flipped(10, 20, 4000), new TextEncoder().encode('tail'));
    const p = await roundtrip(built);
    expect(p.segments).toHaveLength(3); // 10 and 20 merge (gap < 16); 4000; the tail
    expect(p.segments.map((s) => s.offset)).toEqual([10, 4000, 5000]);
  });

  it('merges a tail with a segment that ends at the last stock byte', async () => {
    const built = concat(flipped(4999), new TextEncoder().encode('xyz'));
    const p = await roundtrip(built);
    expect(p.segments.at(-1)!.hex.slice(-6)).toBe('78797a');
  });

  it('describes stock and result by role', async () => {
    const json = await makeSyntheticDm32Patch(stock, flipped(5), '1.0.0');
    const { description } = parseFirmwarePatch(encode(json));
    expect(description.name).toBe('baofeng-dm32-firmware');
    expect(description.version).toBe('1.0.0');
    expect(Object.keys(description.stock)).toEqual(['bin']);
    expect(description.result.bin!.size).toBe(5000);
  });

  it('refuses the wrong stock', async () => {
    const parsed = parseFirmwarePatch(encode(await makeSyntheticDm32Patch(stock, flipped(5), 'x')));
    const wrong = stock.slice();
    wrong[4999] = 0;
    expect(await codeOf(() => applyFirmwarePatch(pkg(wrong), parsed))).toBe('patch-wrong-stock');
    expect(
      await codeOf(() =>
        applyFirmwarePatch({ radioId: 'baofeng-dm32uv', files: { other: stock } }, parsed),
      ),
    ).toBe('patch-wrong-stock');
  });

  it('refuses a tampered segment as a result mismatch', async () => {
    const json = (await makeSyntheticDm32Patch(stock, flipped(5), 'x')) as {
      segments: { hex: string }[];
    };
    json.segments[0]!.hex = '00';
    const parsed = parseFirmwarePatch(encode(json));
    expect(await codeOf(() => applyFirmwarePatch(pkg(stock), parsed))).toBe(
      'patch-result-mismatch',
    );
  });

  it('refuses a segment that leaves a gap', async () => {
    const json = await makeSyntheticDm32Patch(stock, stock, 'x');
    json.segments = [{ offset: 5001, hex: '00' }];
    const parsed = parseFirmwarePatch(encode(json));
    expect(await codeOf(() => applyFirmwarePatch(pkg(stock), parsed))).toBe('patch-malformed');
  });

  it.each([
    ['odd hex', (j: Record<string, unknown>) => (j.segments = [{ offset: 1, hex: 'abc' }])],
    ['negative offset', (j: Record<string, unknown>) => (j.segments = [{ offset: -1, hex: 'ab' }])],
    ['string offset', (j: Record<string, unknown>) => (j.segments = [{ offset: '1', hex: 'ab' }])],
    [
      'fractional offset',
      (j: Record<string, unknown>) => (j.segments = [{ offset: 1.5, hex: 'ab' }]),
    ],
    ['missing result', (j: Record<string, unknown>) => delete j.result],
    ['short sha256', (j: Record<string, unknown>) => (j.stock = { sha256: 'ab', size: 1 })],
    ['segments not a list', (j: Record<string, unknown>) => (j.segments = {})],
    [
      'zero-length version slot',
      (j: Record<string, unknown>) => (j.version_slot = { offset: 0, len: 0 }),
    ],
    ['bad neutral hash', (j: Record<string, unknown>) => (j.neutral_sha256 = 'nope')],
  ])('refuses a malformed patch: %s', async (_label, mutate) => {
    const json = await makeSyntheticDm32Patch(stock, flipped(5), 'x');
    mutate(json);
    expect(await codeOf(() => parseFirmwarePatch(encode(json)))).toBe('patch-malformed');
  });

  it('allows and ignores unknown extra keys', async () => {
    const json = await makeSyntheticDm32Patch(stock, flipped(5), 'x');
    json.notes = 'extra';
    expect(() => parseFirmwarePatch(encode(json))).not.toThrow();
  });

  it('refuses unknown names, unknown formats and unreadable files', async () => {
    const json = await makeSyntheticDm32Patch(stock, stock, 'x');
    expect(await codeOf(() => parseFirmwarePatch(encode({ ...json, name: 'nope' })))).toBe(
      'patch-unknown-format',
    );
    expect(await codeOf(() => parseFirmwarePatch(encode({ ...json, format: 2 })))).toBe(
      'patch-unknown-format',
    );
    expect(await codeOf(() => parseFirmwarePatch(encode([1, 2])))).toBe('patch-unknown-format');
    expect(await codeOf(() => parseFirmwarePatch(new TextEncoder().encode('{not json')))).toBe(
      'patch-unreadable',
    );
    expect(await codeOf(() => parseFirmwarePatch(new Uint8Array([0xff, 0xfe, 0x00])))).toBe(
      'patch-unreadable',
    );
  });

  it('never mutates the input package', async () => {
    const input = stock.slice();
    const parsed = parseFirmwarePatch(
      encode(
        await makeSyntheticDm32Patch(stock, concat(flipped(10, 4000), new Uint8Array([1])), 'x'),
      ),
    );
    await applyFirmwarePatch(pkg(input), parsed);
    expect(input).toEqual(stock);
  });

  it('reads the version stamp from the result image', async () => {
    const built = stock.slice();
    const slot = { offset: 4096, len: 24 };
    built.fill(0, slot.offset, slot.offset + slot.len);
    built.set(new TextEncoder().encode('1.0.0'), slot.offset);
    const parsed = parseFirmwarePatch(
      encode(await makeSyntheticDm32Patch(stock, built, '1.0.0', { versionSlot: slot })),
    );
    const result = await applyFirmwarePatch(pkg(stock), parsed);
    expect(readFirmwarePatchVersionStamp(result, parsed)).toBe('1.0.0');
  });

  it('returns no version stamp when the slot is empty or absent', async () => {
    const built = stock.slice();
    built.fill(0, 100, 124);
    const withSlot = parseFirmwarePatch(
      encode(
        await makeSyntheticDm32Patch(stock, built, 'x', { versionSlot: { offset: 100, len: 24 } }),
      ),
    );
    expect(readFirmwarePatchVersionStamp(pkg(built), withSlot)).toBeUndefined();
    const noSlot = parseFirmwarePatch(encode(await makeSyntheticDm32Patch(stock, built, 'x')));
    expect(readFirmwarePatchVersionStamp(pkg(built), noSlot)).toBeUndefined();
  });
});
