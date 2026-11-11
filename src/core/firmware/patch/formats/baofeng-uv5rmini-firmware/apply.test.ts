import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../../../errors.ts';
import { sha256Hex } from '../../../hash.ts';
import { bytesToHex, hexToBytes } from '../../../hex.ts';
import type { FirmwarePackage } from '../../../types.ts';
import {
  applyFirmwarePatch,
  listFirmwarePatchFormats,
  parseFirmwarePatch,
  readFirmwarePatchVersionStamp,
} from '../../index.ts';
import vector from './__fixtures__/conformanceVector.json';
import {
  makeSyntheticUv5rMiniPatch,
  synthUv5rMiniStock,
} from './__fixtures__/makeSyntheticPatch.ts';
import { UV5RMINI_MAX_EDITS, UV5RMINI_MAX_RESULT_SIZE } from './constants.ts';

const stock = synthUv5rMiniStock();

function pkg(bytes: Uint8Array, files: string[] = ['ufw']): FirmwarePackage {
  return {
    radioId: 'baofeng-uv5rmini',
    files: Object.fromEntries(files.map((f) => [f, bytes])),
  };
}

const encode = (json: unknown) => new TextEncoder().encode(JSON.stringify(json));

async function codeOf(fn: () => unknown): Promise<string | undefined> {
  try {
    await fn();
  } catch (e) {
    return e instanceof FirmwareError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

async function applyJson(json: unknown, s: Uint8Array = stock): Promise<FirmwarePackage> {
  return applyFirmwarePatch(pkg(s), parseFirmwarePatch(encode(json)));
}

function codeOfJson(json: unknown, s: Uint8Array = stock) {
  return codeOf(() => applyJson(json, s));
}

type PatchJson = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A valid patch over `stock`: edits at 10 and 4000, cut at 4000 + tail. */
async function validPatch(): Promise<{ json: PatchJson; built: Uint8Array }> {
  const built = new Uint8Array(4000 + 5);
  built.set(stock.subarray(0, 4000));
  built[10] ^= 0xff;
  built[300] ^= 0x01;
  built.set(new TextEncoder().encode('tail!'), 4000);
  return {
    json: (await makeSyntheticUv5rMiniPatch(stock, built, { truncate: 4000 })) as PatchJson,
    built,
  };
}

/** Re-sign `json.result` for `bytes`, so only the rule under test fails. */
async function resign(json: PatchJson, bytes: Uint8Array): Promise<void> {
  json.result['.ufw'] = { sha256: await sha256Hex(bytes), size: bytes.length };
}

describe('baofeng-uv5rmini-firmware patch', () => {
  it('is registered and parses to the described shape', async () => {
    expect(listFirmwarePatchFormats().map((f) => f.name)).toContain('baofeng-uv5rmini-firmware');
    const { json } = await validPatch();
    json.version = 'mm9pdy-pr112-g1a2b3c4';
    json.build.name = 'mm9pdy-pr112-g1a2b3c4';
    const parsed = parseFirmwarePatch(encode(json));
    expect(parsed.description.name).toBe('baofeng-uv5rmini-firmware');
    expect(parsed.description.format).toBe(1);
    expect(parsed.description.version).toBe('mm9pdy-pr112-g1a2b3c4');
    expect(Object.keys(parsed.description.stock)).toEqual(['ufw']);
    expect(Object.keys(parsed.description.result)).toEqual(['ufw']);
    expect(parsed.description.stock.ufw).toEqual(json.stock['.ufw']);
  });

  it('exposes build and loader on the parsed patch and stamps build.name', async () => {
    const { json, built } = await validPatch();
    json.build = { name: 'mm9pdy-0.1.0-rc.1', appSize: '0x77d1c', appCrc: '0x55e1' };
    json.loader = { sha256: 'ab'.repeat(32), list: ['nrfb-v0.04', 'mm9pdy-0.1.0-rc.1'] };
    const parsed = parseFirmwarePatch(encode(json));
    const p = parsed.patch as { build: unknown; loader: unknown; base: string };
    expect(p.build).toEqual(json.build);
    expect(p.loader).toEqual(json.loader);
    expect(p.base).toBe('synthetic');
    const out = await applyFirmwarePatch(pkg(stock), parsed);
    expect(readFirmwarePatchVersionStamp(out, parsed)).toBe('mm9pdy-0.1.0-rc.1');
    expect(out.files.ufw).toEqual(built);
  });

  it('a no-op patch gives stock back, and never mutates its input', async () => {
    const json = await makeSyntheticUv5rMiniPatch(stock, stock);
    const copy = stock.slice();
    const out = await applyJson(json);
    expect(out.files.ufw).toEqual(stock);
    expect(out.files.ufw).not.toBe(stock);
    expect(stock).toEqual(copy);
  });

  it('round trips edits, a cut and an append', async () => {
    const { json, built } = await validPatch();
    expect(json.edits.map((e: { offset: number }) => e.offset)).toEqual([10, 300]);
    expect(json.truncate).toBe(4000);
    const copy = stock.slice();
    const out = await applyJson(json);
    expect(out.files.ufw).toEqual(built);
    expect(stock).toEqual(copy);
  });

  it('allows a result of exactly 1 MiB', async () => {
    const big = new Uint8Array(UV5RMINI_MAX_RESULT_SIZE);
    big.set(stock);
    const json = await makeSyntheticUv5rMiniPatch(stock, big);
    expect((await applyJson(json)).files.ufw).toHaveLength(UV5RMINI_MAX_RESULT_SIZE);
  });

  describe('the firmware project conformance vector', () => {
    const vStock = hexToBytes(vector.stock);

    it('reaches the expected result hash', async () => {
      const out = await applyJson(vector.patch, vStock);
      expect(await sha256Hex(out.files.ufw!)).toBe(vector.resultSha256);
      expect(out.files.ufw).toHaveLength(vector.patch.result['.ufw'].size);
    });

    it('lists the negative cases it exercises', () => {
      expect(vector.negative.map((n) => n.reason)).toEqual([
        'stock hash',
        'overlapping edits',
        'edit past truncate',
        'result hash',
      ]);
    });

    it.each(vector.negative.map((n) => [n.reason, n] as const))('refuses: %s', async (_r, n) => {
      expect(n.expect).toBe('refuse');
      const code = await codeOfJson(n.patch, vStock);
      expect(code).toMatch(/^patch-/);
    });

    it('refuses with the specific reason for each negative case', async () => {
      const codes = await Promise.all(vector.negative.map((n) => codeOfJson(n.patch, vStock)));
      expect(codes).toEqual([
        'patch-wrong-stock',
        'patch-malformed',
        'patch-malformed',
        'patch-result-mismatch',
      ]);
    });
  });

  describe('refusals', () => {
    it('a wrong or missing name or format', async () => {
      const { json } = await validPatch();
      expect(await codeOfJson({ ...json, name: 'retevis-rt95-firmware' })).toBe('patch-malformed');
      expect(await codeOfJson({ ...json, name: 'other' })).toBe('patch-unknown-format');
      expect(await codeOfJson({ ...json, format: 2 })).toBe('patch-unknown-format');
      expect(await codeOfJson({ ...json, format: '1' })).toBe('patch-unknown-format');
    });

    it('stock and result that are not exactly the one key .ufw', async () => {
      const { json } = await validPatch();
      const entry = json.stock['.ufw'];
      for (const field of ['stock', 'result']) {
        for (const bad of [{}, { '.cdd': entry }, { '.ufw': entry, '.spi': entry }, [entry]]) {
          expect(
            await codeOfJson({ ...json, [field]: bad }),
            `${field} ${JSON.stringify(bad)}`,
          ).toBe('patch-malformed');
        }
      }
    });

    it('the wrong stock: size, hash, a different image, extra or missing members', async () => {
      const { json } = await validPatch();
      expect(
        await codeOfJson({ ...json, stock: { '.ufw': { ...json.stock['.ufw'], size: 4097 } } }),
      ).toBe('patch-wrong-stock');
      expect(
        await codeOfJson({
          ...json,
          stock: { '.ufw': { ...json.stock['.ufw'], sha256: 'f'.repeat(64) } },
        }),
      ).toBe('patch-wrong-stock');
      const flipped = stock.slice();
      flipped[0] ^= 1;
      expect(await codeOfJson(json, flipped)).toBe('patch-wrong-stock');
      const parsed = parseFirmwarePatch(encode(json));
      expect(await codeOf(() => applyFirmwarePatch(pkg(stock, ['ufw', 'extra']), parsed))).toBe(
        'patch-wrong-stock',
      );
      expect(await codeOf(() => applyFirmwarePatch(pkg(stock, ['other']), parsed))).toBe(
        'patch-wrong-stock',
      );
    });

    it('an empty edit', async () => {
      const { json } = await validPatch();
      json.edits.push({ offset: 3000, hex: '' });
      expect(await codeOfJson(json)).toBe('patch-malformed');
    });

    it('an edit outside [0, truncate)', async () => {
      const { json } = await validPatch();
      const pastEnd = { ...json, edits: [{ offset: 3999, hex: 'aabb' }] };
      expect(await codeOfJson(pastEnd)).toBe('patch-malformed');
      const atEnd = { ...json, edits: [{ offset: 4000, hex: 'aa' }] };
      expect(await codeOfJson(atEnd)).toBe('patch-malformed');
    });

    it('an edit that is not a whole non-negative number offset', async () => {
      const { json } = await validPatch();
      for (const offset of [-1, 1.5, '10', null]) {
        expect(await codeOfJson({ ...json, edits: [{ offset, hex: 'aa' }] })).toBe(
          'patch-malformed',
        );
      }
    });

    it('unsorted or overlapping edits', async () => {
      const { json } = await validPatch();
      expect(
        await codeOfJson({
          ...json,
          edits: [
            { offset: 20, hex: 'aa' },
            { offset: 10, hex: 'bb' },
          ],
        }),
      ).toBe('patch-malformed');
      expect(
        await codeOfJson({
          ...json,
          edits: [
            { offset: 10, hex: 'aabb' },
            { offset: 11, hex: 'cc' },
          ],
        }),
      ).toBe('patch-malformed');
    });

    it('adjacent edits are allowed (touching, not overlapping)', async () => {
      const built = stock.slice();
      built[10] ^= 1;
      built[11] ^= 1;
      const json = (await makeSyntheticUv5rMiniPatch(stock, built)) as PatchJson;
      json.edits = [
        { offset: 10, hex: bytesToHex(built.subarray(10, 11)) },
        { offset: 11, hex: bytesToHex(built.subarray(11, 12)) },
      ];
      expect((await applyJson(json)).files.ufw).toEqual(built);
    });

    it('a truncate longer than the stock image', async () => {
      const { json } = await validPatch();
      const bad = { ...json, truncate: stock.length + 1, edits: [], append: '' };
      await resign(bad, stock);
      expect(await codeOfJson(bad)).toBe('patch-malformed');
    });

    it('bad hex: odd length, non-hex, uppercase', async () => {
      const { json } = await validPatch();
      for (const hex of ['abc', 'zz', 'AB', 'a b', 7]) {
        expect(await codeOfJson({ ...json, edits: [{ offset: 10, hex }] }), `edit ${hex}`).toBe(
          'patch-malformed',
        );
        expect(await codeOfJson({ ...json, append: hex }), `append ${hex}`).toBe('patch-malformed');
      }
    });

    it('more than 4096 edits, and allows 4096', async () => {
      const { json } = await validPatch();
      const edits = (n: number) => Array.from({ length: n }, (_, i) => ({ offset: i, hex: '00' }));
      expect(
        await codeOfJson({
          ...json,
          edits: edits(UV5RMINI_MAX_EDITS + 1),
          truncate: 4096,
          append: '',
        }),
      ).toBe('patch-malformed');
      const ok = { ...json, edits: edits(UV5RMINI_MAX_EDITS), truncate: 4096, append: '' };
      const built = stock.slice();
      built.fill(0, 0, UV5RMINI_MAX_EDITS);
      await resign(ok, built);
      expect((await applyJson(ok)).files.ufw).toEqual(built);
    });

    it('a result over 1 MiB', async () => {
      const { json } = await validPatch();
      const bad = {
        ...json,
        result: { '.ufw': { sha256: '0'.repeat(64), size: UV5RMINI_MAX_RESULT_SIZE + 1 } },
        append: 'aa'.repeat(UV5RMINI_MAX_RESULT_SIZE + 1 - json.truncate),
      };
      expect(await codeOfJson(bad)).toBe('patch-malformed');
    });

    it('a result size or hash that does not match', async () => {
      const { json, built } = await validPatch();
      expect(
        await codeOfJson({
          ...json,
          result: { '.ufw': { ...json.result['.ufw'], size: built.length + 1 } },
        }),
      ).toBe('patch-result-mismatch');
      expect(
        await codeOfJson({
          ...json,
          result: { '.ufw': { ...json.result['.ufw'], sha256: 'e'.repeat(64) } },
        }),
      ).toBe('patch-result-mismatch');
      expect(await codeOfJson({ ...json, append: '75' + json.append.slice(2) })).toBe(
        'patch-result-mismatch',
      );
    });

    it('an uppercase hash', async () => {
      const { json } = await validPatch();
      const up = (s: string) => s.toUpperCase();
      expect(
        await codeOfJson({
          ...json,
          stock: { '.ufw': { ...json.stock['.ufw'], sha256: up(json.stock['.ufw'].sha256) } },
        }),
      ).toBe('patch-malformed');
      expect(
        await codeOfJson({
          ...json,
          result: { '.ufw': { ...json.result['.ufw'], sha256: up(json.result['.ufw'].sha256) } },
        }),
      ).toBe('patch-malformed');
    });

    it.each([
      ['not an object', 'stock'],
      ['missing', undefined],
    ])('a missing or non-object field (%s)', async (_label, value) => {
      const { json } = await validPatch();
      for (const field of value === undefined
        ? ['stock', 'result', 'build', 'loader', 'edits', 'version', 'base']
        : ['stock', 'result', 'build', 'loader', 'edits']) {
        const bad = { ...json };
        if (value === undefined) delete bad[field];
        else bad[field] = value;
        expect(await codeOfJson(bad), field).toBe('patch-malformed');
      }
      const noTruncate = { ...json };
      delete noTruncate.truncate;
      expect(await codeOfJson(noTruncate)).toBe('patch-malformed');
      const noAppend = { ...json };
      delete noAppend.append;
      expect(await codeOfJson(noAppend)).toBe('patch-malformed');
    });
  });

  describe('descriptive fields', () => {
    it('accept the real shapes', async () => {
      const { json } = await validPatch();
      json.build = { name: 'a'.repeat(21), appSize: '0x77d1c', appCrc: '0x55e1' };
      json.loader = { sha256: 'a1'.repeat(32), list: [] };
      expect(() => parseFirmwarePatch(encode(json))).not.toThrow();
    });

    it('refuse a bad build.name', async () => {
      const { json } = await validPatch();
      for (const name of ['', 'a'.repeat(22), 'has space', 'tab\t', 'é', 7, undefined]) {
        expect(
          await codeOfJson({ ...json, build: { ...json.build, name } }),
          `build.name ${String(name)}`,
        ).toBe('patch-malformed');
      }
    });

    it('refuse a bad appSize or appCrc', async () => {
      const { json } = await validPatch();
      for (const bad of ['77d1c', '0x', '0xzz', 0x77d1c, '']) {
        expect(await codeOfJson({ ...json, build: { ...json.build, appSize: bad } })).toBe(
          'patch-malformed',
        );
        expect(await codeOfJson({ ...json, build: { ...json.build, appCrc: bad } })).toBe(
          'patch-malformed',
        );
      }
    });

    it('refuse a bad loader hash or list', async () => {
      const { json } = await validPatch();
      for (const sha256 of ['A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64), 5]) {
        expect(await codeOfJson({ ...json, loader: { ...json.loader, sha256 } })).toBe(
          'patch-malformed',
        );
      }
      for (const list of ['nrfb-v0.04', ['has space'], [''], [7], ['a'.repeat(22)], null]) {
        expect(await codeOfJson({ ...json, loader: { ...json.loader, list } })).toBe(
          'patch-malformed',
        );
      }
    });

    it('never widen a check: a build or loader change leaves the result hash in force', async () => {
      const { json } = await validPatch();
      json.build = { name: 'other', appSize: '0x1', appCrc: '0x2' };
      json.loader = { sha256: 'b'.repeat(64), list: ['other'] };
      json.result['.ufw'].sha256 = 'c'.repeat(64);
      expect(await codeOfJson(json)).toBe('patch-result-mismatch');
    });
  });
});
