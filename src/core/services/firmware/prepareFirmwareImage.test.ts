import { describe, expect, it } from 'vitest';

import { seededBytes, syntheticDescriptor } from '../../firmware/__fixtures__/synthetic.ts';
import { FirmwareError } from '../../firmware/errors.ts';
import {
  makeSyntheticUv5rMiniPatch,
  synthUv5rMiniStock,
} from '../../firmware/patch/formats/baofeng-uv5rmini-firmware/__fixtures__/makeSyntheticPatch.ts';
import { resolveStockFirmware } from '../../firmware/stock/resolveStockFirmware.ts';
import { parseFirmwarePatch } from '../../firmware/patch/index.ts';
import { syntheticDm32Release } from '../../firmware/releases/__fixtures__/syntheticReleases.ts';
import type { LoadedFirmwarePatch } from '../../firmware/releases/types.ts';
import {
  DEFAULT_PATCH_VERIFY_HINT,
  prepareFirmwareImage,
  STOCK_FOR_BASE_MISSING,
} from './prepareFirmwareImage.ts';

async function verifiedStock() {
  const bin = seededBytes(21, 2048);
  const descriptor = await syntheticDescriptor(
    'baofeng-dm32uv',
    [{ role: 'img', fileName: 'S.img', bytes: bin }],
    { fileName: 's.zip', bytes: seededBytes(22, 16) },
  );
  const stock = await resolveStockFirmware(descriptor, [{ name: 'S.img', bytes: bin }], {
    otherDescriptors: [],
  });
  return { bin, descriptor, stock };
}

describe('prepareFirmwareImage — stock target', () => {
  it('prepares the verified stock unchanged', async () => {
    const { bin, descriptor, stock } = await verifiedStock();
    const prepared = await prepareFirmwareImage({ descriptor, stock, target: { kind: 'stock' } });
    expect(prepared.provenance).toBe('stock');
    expect(prepared.radioId).toBe('baofeng-dm32uv');
    expect(prepared.stockVersion).toBe(descriptor.version);
    expect(prepared.verifyHint).toBe(descriptor.stockVerifyHint);
    expect(prepared.package.files.img).toEqual(bin);
    expect(prepared.sha256.img).toBe(descriptor.members[0]!.sha256);
    expect(prepared.releaseTag).toBeUndefined();
    expect(prepared.stockPackage).toBe(stock.package);
    expect(prepared.title).toBe(`stock firmware ${descriptor.version}`);
    expect(prepared.radioLayout).toBeUndefined();
  });

  it("carries the radio's layout when the operator gave one", async () => {
    const { descriptor, stock } = await verifiedStock();
    const prepared = await prepareFirmwareImage({
      descriptor,
      stock,
      target: { kind: 'stock' },
      radioLayout: 'L2',
    });
    expect(prepared.radioLayout).toBe('L2');
  });

  it('carries the typed Radio Info build name, and nothing when none was given', async () => {
    const { descriptor, stock } = await verifiedStock();
    const base = { descriptor, stock, target: { kind: 'stock' } } as const;
    expect(
      (await prepareFirmwareImage({ ...base, radioBuild: 'mm9pdy-L2-1.0.0' })).radioBuild,
    ).toBe('mm9pdy-L2-1.0.0');
    expect((await prepareFirmwareImage(base)).radioBuild).toBeUndefined();
    expect((await prepareFirmwareImage({ ...base, radioBuild: '' })).radioBuild).toBeUndefined();
  });

  it('carries the reinstall confirm only when it was given', async () => {
    const { descriptor, stock } = await verifiedStock();
    const base = { descriptor, stock, target: { kind: 'stock' } } as const;
    expect(
      (await prepareFirmwareImage({ ...base, reinstallConfirmed: true })).reinstallConfirmed,
    ).toBe(true);
    expect((await prepareFirmwareImage(base)).reinstallConfirmed).toBeUndefined();
    expect(
      (await prepareFirmwareImage({ ...base, reinstallConfirmed: false })).reinstallConfirmed,
    ).toBeUndefined();
  });

  it('refuses stock whose bytes no longer match the verified hashes', async () => {
    const { descriptor, stock } = await verifiedStock();
    const tampered = { ...stock, sha256: { img: '0'.repeat(64) } };
    const err = await prepareFirmwareImage({
      descriptor,
      stock: tampered,
      target: { kind: 'stock' },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirmwareError);
  });

  it('refuses stock verified for a different radio', async () => {
    const { descriptor, stock } = await verifiedStock();
    const other = { ...descriptor, radioId: 'anytone-at-d890uv' as const };
    await expect(
      prepareFirmwareImage({ descriptor: other, stock, target: { kind: 'stock' } }),
    ).rejects.toBeInstanceOf(FirmwareError);
  });
});

describe('prepareFirmwareImage — a radio with a second stock version', () => {
  it('prepares the stock version that was verified, not the primary one', async () => {
    const a = seededBytes(31, 1024);
    const b = seededBytes(32, 1536);
    const zip = { fileName: 'z.zip', bytes: seededBytes(33, 16) };
    const first = await syntheticDescriptor(
      'baofeng-dm32uv',
      [{ role: 'img', fileName: 'A.img', bytes: a }],
      zip,
    );
    const second = await syntheticDescriptor(
      'baofeng-dm32uv',
      [{ role: 'img', fileName: 'B.img', bytes: b }],
      zip,
    );
    const descriptor = {
      ...first,
      alsoAccepts: [{ version: 'v0.0.2-test', members: second.members }],
    };
    const stock = await resolveStockFirmware(descriptor, [{ name: 'B.img', bytes: b }], {
      otherDescriptors: [],
    });
    const prepared = await prepareFirmwareImage({ descriptor, stock, target: { kind: 'stock' } });
    expect(prepared.stockVersion).toBe('v0.0.2-test');
    expect(prepared.package.files.img).toEqual(b);
  });
});

describe('prepareFirmwareImage — patch target', () => {
  async function loaded(provenance: 'published' | 'unreviewed' = 'published') {
    const r = await syntheticDm32Release();
    const patch: LoadedFirmwarePatch = {
      bytes: r.patchBytes,
      sha256: r.patchSha256,
      parsed: parseFirmwarePatch(r.patchBytes),
      provenance,
      release: provenance === 'published' ? r.row : undefined,
    };
    return { ...r, patch };
  }

  it('applies a bundled patch and carries its provenance and stamp', async () => {
    const { descriptor, stock, patch, built, row, patchSha256 } = await loaded();
    const prepared = await prepareFirmwareImage({
      descriptor,
      stock,
      target: { kind: 'patch', patch },
    });
    expect(prepared.provenance).toBe('published');
    expect(prepared.releaseTag).toBe(row.tag);
    expect(prepared.title).toBe(`MM9PDY modded firmware ${row.tag}`);
    expect(prepared.patchVersion).toBe('9.9.9');
    expect(prepared.patchSha256).toBe(patchSha256);
    expect(prepared.versionStamp).toBe('9.9.9');
    expect(prepared.verifyHint).toBe(row.verifyHint);
    expect(prepared.package.files.bin).toEqual(built);
    expect(prepared.stockPackage).toBe(stock.package);
    expect(prepared.sha256.bin).toBe(row.resultSha256.bin);
  });

  it('uses the default verify hint for an unreviewed patch', async () => {
    const { descriptor, stock, patch } = await loaded('unreviewed');
    const prepared = await prepareFirmwareImage({
      descriptor,
      stock,
      target: { kind: 'patch', patch },
    });
    expect(prepared.provenance).toBe('unreviewed');
    expect(prepared.releaseTag).toBeUndefined();
    expect(prepared.title).toBe('MM9PDY modded firmware 9.9.9');
    expect(prepared.verifyHint).toBe(DEFAULT_PATCH_VERIFY_HINT);
  });

  it('refuses a patch made for other stock before applying it', async () => {
    const { descriptor, stock, patch } = await loaded();
    const repinned = {
      ...descriptor,
      members: descriptor.members.map((m) => ({ ...m, sha256: 'f'.repeat(64) })),
    };
    const err = await prepareFirmwareImage({
      descriptor: repinned,
      stock: { ...stock, descriptor: repinned },
      target: { kind: 'patch', patch },
    }).catch((e: unknown) => e);
    expect((err as FirmwareError).code).toBe('patch-wrong-stock');
  });

  it("refuses a patch whose name is not this radio's", async () => {
    const { descriptor, stock, patch } = await loaded();
    const other = { ...descriptor, patchNames: ['someone-else'] };
    const err = await prepareFirmwareImage({
      descriptor: other,
      stock: { ...stock, descriptor: other },
      target: { kind: 'patch', patch },
    }).catch((e: unknown) => e);
    expect((err as FirmwareError).code).toBe('patch-wrong-radio');
  });
});

describe('prepareFirmwareImage — one stock per base (UV-5R Mini: L1 on v0.04, L2 on v0.27)', () => {
  const stockA = synthUv5rMiniStock();
  const stockB = seededBytes(61, 4096);

  async function setup(supplied: readonly ('a' | 'b')[]) {
    const a = await syntheticDescriptor(
      'baofeng-uv5rmini',
      [{ role: 'ufw', fileName: 'stock-a.ufw', bytes: stockA }],
      { fileName: 'z.zip', bytes: seededBytes(62, 16) },
    );
    const b = await syntheticDescriptor(
      'baofeng-uv5rmini',
      [{ role: 'ufw', fileName: 'stock-b.ufw', bytes: stockB }],
      { fileName: 'z.zip', bytes: seededBytes(62, 16) },
    );
    const descriptor = {
      ...a,
      zip: undefined,
      baseName: 'base-a',
      severalStocks: true,
      alsoAccepts: [{ version: 'v0.0.2-test', baseName: 'base-b', members: b.members }],
      patchNames: ['baofeng-uv5rmini-firmware'],
    };
    const files = supplied.map((k) =>
      k === 'a' ? { name: 'stock-a.ufw', bytes: stockA } : { name: 'stock-b.ufw', bytes: stockB },
    );
    const stock = await resolveStockFirmware(descriptor, files, { otherDescriptors: [] });
    const patchOn = async (stockBytes: Uint8Array, base: string, buildName: string) => {
      const built = stockBytes.slice();
      built[100] = built[100]! ^ 0xff;
      const json = await makeSyntheticUv5rMiniPatch(stockBytes, built, {
        buildName,
        version: '0.1',
        base,
      });
      const bytes = new TextEncoder().encode(JSON.stringify(json));
      return {
        bytes,
        sha256: 'ab'.repeat(32),
        parsed: parseFirmwarePatch(bytes),
        provenance: 'unreviewed',
      } as LoadedFirmwarePatch;
    };
    return {
      descriptor,
      stock,
      l1: await patchOn(stockA, 'base-a', 'mm9pdy-L1-0.1'),
      l2: await patchOn(stockB, 'base-b', 'mm9pdy-L2-0.1'),
    };
  }

  it('builds each file on the stock its own base names, whichever was supplied first', async () => {
    for (const order of [
      ['a', 'b'],
      ['b', 'a'],
    ] as const) {
      const { descriptor, stock, l1, l2 } = await setup(order);
      const one = await prepareFirmwareImage({
        descriptor,
        stock,
        target: { kind: 'patch', patch: l1 },
      });
      expect(one.stockVersion).toBe('v0.0.1-test');
      expect(one.stockPackage?.files.ufw).toEqual(stockA);
      expect(one.baseName).toBe('base-a');
      const two = await prepareFirmwareImage({
        descriptor,
        stock,
        target: { kind: 'patch', patch: l2 },
      });
      expect(two.stockVersion).toBe('v0.0.2-test');
      expect(two.stockPackage?.files.ufw).toEqual(stockB);
      expect(two.baseName).toBe('base-b');
    }
  });

  it('refuses a file whose base was not supplied, naming the stock file to add', async () => {
    const { descriptor, stock, l2 } = await setup(['a']);
    const err = await prepareFirmwareImage({
      descriptor,
      stock,
      target: { kind: 'patch', patch: l2 },
    }).catch((e: unknown) => e);
    expect((err as FirmwareError).code).toBe('patch-wrong-stock');
    expect((err as FirmwareError).message).toBe(
      STOCK_FOR_BASE_MISSING('v0.0.2-test', ['stock-b.ufw']),
    );
  });
});

describe('prepareFirmwareImage — a to-stock patch (UV-5R Mini)', () => {
  /** A synthetic Mini-shaped stock whose base name is the fixture's `synthetic`, and a patch built on it. */
  async function setup(buildName: string, { baseName = 'synthetic' as string | null } = {}) {
    const stockBytes = synthUv5rMiniStock();
    const built = stockBytes.slice();
    built[100] = built[100]! ^ 0xff;
    const base = await syntheticDescriptor(
      'baofeng-uv5rmini',
      [{ role: 'ufw', fileName: 'stock.ufw', bytes: stockBytes }],
      { fileName: 'z.zip', bytes: seededBytes(41, 16) },
    );
    const descriptor = {
      ...base,
      zip: undefined,
      ...(baseName === null ? {} : { baseName }),
      patchNames: ['baofeng-uv5rmini-firmware'],
    };
    const stock = await resolveStockFirmware(
      descriptor,
      [{ name: 'stock.ufw', bytes: stockBytes }],
      { otherDescriptors: [] },
    );
    const json = await makeSyntheticUv5rMiniPatch(stockBytes, built, { buildName, version: '0.1' });
    const bytes = new TextEncoder().encode(JSON.stringify(json));
    const patch: LoadedFirmwarePatch = {
      bytes,
      sha256: 'ab'.repeat(32),
      parsed: parseFirmwarePatch(bytes),
      provenance: 'unreviewed',
    };
    return prepareFirmwareImage({ descriptor, stock, target: { kind: 'patch', patch } });
  }

  it("reads as the stock it puts back: the stock's title and verify hint, marked back to stock", async () => {
    const prepared = await setup('synthetic');
    expect(prepared.backToStock).toBe(true);
    expect(prepared.title).toBe('stock firmware v0.0.1-test');
    expect(prepared.verifyHint).toBe('The radio boots normally.');
    expect(prepared.versionStamp).toBe('synthetic');
    expect(prepared.provenance).toBe('unreviewed');
  });

  it('is a modded build when the build name is not the base name', async () => {
    const prepared = await setup('mm9pdy-L1-1.0.0');
    expect(prepared.backToStock).toBeUndefined();
    expect(prepared.title).toBe('MM9PDY modded firmware 0.1');
  });

  it('is not to-stock when the stock has no base name', async () => {
    const prepared = await setup('synthetic', { baseName: null });
    expect(prepared.backToStock).toBeUndefined();
  });
});
