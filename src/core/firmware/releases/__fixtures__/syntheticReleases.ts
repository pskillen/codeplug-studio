/**
 * Test-only synthetic DM-32 release: seeded stock and built images, a patch made from them, and a published-style row.
 * Never real stock bytes.
 */
import { seededBytes, syntheticDescriptor } from '../../__fixtures__/synthetic.ts';
import { sha256Hex } from '../../hash.ts';
import { makeSyntheticDm32Patch } from '../../patch/formats/baofeng-dm32-firmware/__fixtures__/makeSyntheticPatch.ts';
import { resolveStockFirmware } from '../../stock/resolveStockFirmware.ts';
import type { StockFirmwareDescriptor } from '../../types.ts';
import type { PublishedFirmwareRelease } from '../types.ts';

export const SYNTH_DM32_FILE = 'SYNTH_DM32.bin';

export async function syntheticDm32Release(opts: { version?: string; seed?: number } = {}) {
  const version = opts.version ?? '9.9.9';
  const stockBin = seededBytes(opts.seed ?? 101, 4096);
  const built = stockBin.slice();
  built.set([1, 2, 3, 4], 100);
  const slot = { offset: 2000, len: 8 };
  built.set(new TextEncoder().encode(version), slot.offset);
  built.fill(0, slot.offset + version.length, slot.offset + slot.len);

  const base = await syntheticDescriptor(
    'baofeng-dm32uv',
    [{ role: 'bin', fileName: SYNTH_DM32_FILE, bytes: stockBin }],
    { fileName: 'synth.zip', bytes: seededBytes(102, 16) },
  );
  const descriptor: StockFirmwareDescriptor = { ...base, patchNames: ['baofeng-dm32-firmware'] };
  const stock = await resolveStockFirmware(
    descriptor,
    [{ name: SYNTH_DM32_FILE, bytes: stockBin }],
    {
      otherDescriptors: [],
    },
  );
  const patchJson = await makeSyntheticDm32Patch(stockBin, built, version, { versionSlot: slot });
  const patchBytes = new TextEncoder().encode(JSON.stringify(patchJson, null, 1) + '\n');
  const patchSha256 = await sha256Hex(patchBytes);
  const row: PublishedFirmwareRelease = {
    radioId: 'baofeng-dm32uv',
    tag: version,
    patchName: 'baofeng-dm32-firmware',
    channel: version.includes('-rc.') ? 'rc' : 'final',
    patchFile: `synth-${version}.patch.json`,
    patchSha256,
    stockVersion: descriptor.version,
    publishedOn: '2026-01-01',
    summary: 'Synthetic release.',
    verifyHint: 'Synthetic verify hint.',
    resultSha256: { bin: await sha256Hex(built) },
    loadBytes: async () => patchBytes.slice(),
    loadNotes: async () => 'Synthetic notes.',
  };
  return { stockBin, built, descriptor, stock, patchJson, patchBytes, patchSha256, row };
}
