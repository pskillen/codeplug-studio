import { describe, expect, it } from 'vitest';

import { FirmwareError } from '../../../errors.ts';
import { sha256Hex } from '../../../hash.ts';
import type { FirmwarePackage, FirmwareRadioId } from '../../../types.ts';
import { applyFirmwarePatch, parseFirmwarePatch } from '../../index.ts';
import {
  makeSyntheticRt95Patch,
  synthRt95Stock,
} from '../retevis-rt95-firmware/__fixtures__/makeSyntheticPatch.ts';
import {
  RT95_MAIN_MAX_APPEND,
  RT95_MAIN_REFUSED_RANGES,
  RT95_MAIN_IMAGE_LEN,
} from './constants.ts';
import vector from './__fixtures__/conformanceVector.json';
import { makeSyntheticMainPatch, synthMainBuilt } from './__fixtures__/makeSyntheticMainPatch.ts';
import { synthMainStock, type SyntheticMainFiles } from './__fixtures__/synthMainStock.ts';

const stock = synthMainStock();

function pkg(
  f: SyntheticMainFiles,
  radioId: FirmwareRadioId = 'retevis-rt95-main',
): FirmwarePackage {
  return { radioId, files: { cdd: f.cdd, cdi: f.cdi, spi: f.spi } };
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

const applyJson = (json: unknown, s: SyntheticMainFiles = stock) =>
  applyFirmwarePatch(pkg(s), parseFirmwarePatch(encode(json)));

type PatchJson = Record<string, unknown> & {
  hooks: { offset: number; original: string; hex: string }[];
  append: { offset: number; hex: string };
};

const hookPatch = async () =>
  (await makeSyntheticMainPatch(stock, {
    hook: true,
    append: new Uint8Array(64).fill(7),
  })) as PatchJson;

describe('retevis-rt95-main-firmware patch', () => {
  it('applies by the tail rule: stock[0, 0xD93C) + hook + append', async () => {
    const append = Uint8Array.from({ length: 100 }, (_, i) => i);
    const out = await applyJson(await makeSyntheticMainPatch(stock, { hook: true, append }));
    const want = synthMainBuilt(stock, { hook: true, append });
    expect(out.files.cdd).toEqual(want.cdd);
    expect(out.files.cdd).toHaveLength(RT95_MAIN_IMAGE_LEN + 100);
    expect(new DataView(out.files.cdi!.buffer).getUint32(0x104, true)).toBe(
      RT95_MAIN_IMAGE_LEN + 100,
    );
    expect(new DataView(out.files.spi!.buffer).getUint32(2, true)).toBe(RT95_MAIN_IMAGE_LEN + 100);
  });

  it('a zero-change patch drops the 40-byte tail and leaves .CDI and .spi alone', async () => {
    const out = await applyJson(await makeSyntheticMainPatch(stock));
    expect(out.files.cdd).toEqual(stock.cdd.slice(0, RT95_MAIN_IMAGE_LEN));
    expect(out.files.cdi).toEqual(stock.cdi);
    expect(out.files.spi).toEqual(stock.spi);
  });

  it('accepts a full 708-byte append', async () => {
    const json = await makeSyntheticMainPatch(stock, {
      hook: true,
      append: new Uint8Array(RT95_MAIN_MAX_APPEND),
    });
    expect((await applyJson(json)).files.cdd).toHaveLength(0xdc00);
  });

  it('has no version stamp and describes itself', () => {
    const parsed = parseFirmwarePatch(encode((vector.cases[0] as { patch: unknown }).patch));
    expect(parsed.format.readVersionStamp).toBeUndefined();
    expect(parsed.description.name).toBe('retevis-rt95-main-firmware');
  });

  describe('the firmware project conformance vector', () => {
    it('the synthetic stock matches the vector stock hashes', async () => {
      expect(await sha256Hex(stock.cdd)).toBe(vector.stock['.CDD'].sha256);
      expect(await sha256Hex(stock.cdi)).toBe(vector.stock['.CDI'].sha256);
      expect(await sha256Hex(stock.spi)).toBe(vector.stock['.spi'].sha256);
      expect(stock.cdd).toHaveLength(vector.stock['.CDD'].size);
    });

    it('lists the cases it exercises', () => {
      expect(vector.cases.map((c) => c.id)).toEqual([
        'zero-change',
        'hook-and-append',
        'refuse-hook-elsewhere',
        'refuse-append-709',
      ]);
    });

    for (const c of vector.cases) {
      if ('result' in c && c.result) {
        const want = c.result;
        it(`${c.id}: reaches the expected result hashes`, async () => {
          const out = await applyJson(c.patch);
          for (const [wire, role] of [
            ['.CDD', 'cdd'],
            ['.CDI', 'cdi'],
            ['.spi', 'spi'],
          ] as const) {
            const w = want[wire];
            expect(out.files[role]).toHaveLength(w.size);
            expect(await sha256Hex(out.files[role]!)).toBe(w.sha256);
          }
        });
      } else {
        it(`${c.id}: is refused`, async () => {
          expect((c as { error: string }).error).toBeTruthy();
          expect(await codeOf(() => applyJson(c.patch))).toMatch(/^patch-/);
        });
      }
    }
  });

  describe('refusals', () => {
    const refusedParse = async (mutate: (p: PatchJson) => void) => {
      const p = await hookPatch();
      mutate(p);
      return codeOf(() => parseFirmwarePatch(encode(p)));
    };

    it('more than one hook', async () => {
      expect(await refusedParse((p) => p.hooks.push({ ...p.hooks[0]! }))).toBe('patch-malformed');
    });

    it('a hook not at 0x382', async () => {
      expect(await refusedParse((p) => (p.hooks[0]!.offset = 0x400))).toBe('patch-malformed');
    });

    it('a hook of another length', async () => {
      expect(
        await refusedParse((p) => {
          p.hooks[0]!.original = '08f081fe0000';
          p.hooks[0]!.hex = '0df0dbfa0000';
        }),
      ).toBe('patch-malformed');
    });

    it('a hook with other original bytes', async () => {
      expect(await refusedParse((p) => (p.hooks[0]!.original = '08f081ff'))).toBe(
        'patch-malformed',
      );
    });

    it.each(RT95_MAIN_REFUSED_RANGES.map((r) => [r.name, r.start, r.end] as const))(
      'a hook on the %s',
      async (name, start, end) => {
        for (const off of [start, end - 1]) {
          const p = await hookPatch();
          p.hooks[0]!.offset = off;
          const msg = await (async () => {
            try {
              parseFirmwarePatch(encode(p));
            } catch (e) {
              return (e as Error).message;
            }
            return '';
          })();
          expect(msg).toContain(name);
        }
      },
    );

    it('an append that does not start at 0xD93C', async () => {
      expect(await refusedParse((p) => (p.append.offset = 0xd93d))).toBe('patch-malformed');
    });

    it('an append over 708 bytes', async () => {
      expect(
        await refusedParse((p) => (p.append.hex = '00'.repeat(RT95_MAIN_MAX_APPEND + 1))),
      ).toBe('patch-malformed');
    });

    it('the wrong name and the wrong format', async () => {
      expect(await refusedParse((p) => (p.name = 'retevis-rt95-firmware-x'))).toBe(
        'patch-unknown-format',
      );
      expect(await refusedParse((p) => (p.format = 2))).toBe('patch-unknown-format');
    });

    it('a result hash that does not match', async () => {
      const p = await hookPatch();
      (p.hooks[0] as { hex: string }).hex = '0df0dbfb';
      expect(await codeOf(() => applyJson(p))).toBe('patch-result-mismatch');
    });

    it('stock whose hook-site bytes differ is a different stock', async () => {
      const other = synthMainStock();
      other.cdd[0x382] ^= 1;
      const hp = await hookPatch();
      expect(await codeOf(() => applyJson(hp, other))).toBe('patch-wrong-stock');
    });
  });

  describe('head and MAIN do not mix', () => {
    it('a MAIN patch on the head stock is refused', async () => {
      const head = synthRt95Stock();
      const json = await makeSyntheticMainPatch(stock);
      const code = await codeOf(() =>
        applyFirmwarePatch(
          { radioId: 'retevis-rt95-head', files: { cdd: head.cdd, cdi: head.cdi, spi: head.spi } },
          parseFirmwarePatch(encode(json)),
        ),
      );
      expect(code).toBe('patch-wrong-stock');
    });

    it('a head patch on the MAIN stock is refused', async () => {
      const head = synthRt95Stock();
      const json = await makeSyntheticRt95Patch(head, head, '1');
      expect(await codeOf(() => applyJson(json))).toBe('patch-wrong-stock');
    });
  });
});
