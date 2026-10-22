import { describe, expect, it } from 'vitest';

import { seededBytes, syntheticDescriptor } from '../../firmware/__fixtures__/synthetic.ts';
import { FirmwareError } from '../../firmware/errors.ts';
import { resolveStockFirmware } from '../../firmware/stock/resolveStockFirmware.ts';
import { prepareFirmwareImage } from './prepareFirmwareImage.ts';

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
