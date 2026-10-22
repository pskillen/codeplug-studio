import { describe, expect, it } from 'vitest';

import { seededBytes, syntheticDescriptor } from '../../firmware/__fixtures__/synthetic.ts';
import { FirmwareError } from '../../firmware/errors.ts';
import { resolveStockFirmware } from '../../firmware/stock/resolveStockFirmware.ts';
import { parseFirmwarePatch } from '../../firmware/patch/index.ts';
import { syntheticDm32Release } from '../../firmware/releases/__fixtures__/syntheticReleases.ts';
import type { LoadedFirmwarePatch } from '../../firmware/releases/types.ts';
import { DEFAULT_PATCH_VERIFY_HINT, prepareFirmwareImage } from './prepareFirmwareImage.ts';

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
    expect(prepared.title).toBe(`stock firmware ${descriptor.version}`);
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

describe('prepareFirmwareImage — patch target', () => {
  async function loaded(provenance: 'bundled' | 'unreviewed' = 'bundled') {
    const r = await syntheticDm32Release();
    const patch: LoadedFirmwarePatch = {
      bytes: r.patchBytes,
      sha256: r.patchSha256,
      parsed: parseFirmwarePatch(r.patchBytes),
      provenance,
      release: provenance === 'bundled' ? r.row : undefined,
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
    expect(prepared.provenance).toBe('bundled');
    expect(prepared.releaseTag).toBe(row.tag);
    expect(prepared.title).toBe(`MM9PDY modded firmware ${row.tag}`);
    expect(prepared.patchVersion).toBe('9.9.9');
    expect(prepared.patchSha256).toBe(patchSha256);
    expect(prepared.versionStamp).toBe('9.9.9');
    expect(prepared.verifyHint).toBe(row.verifyHint);
    expect(prepared.package.files.bin).toEqual(built);
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
