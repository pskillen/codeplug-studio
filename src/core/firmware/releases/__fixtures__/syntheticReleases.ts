/**
 * Test-only synthetic DM-32 release: seeded stock and built images, a patch made from them, and a published-style row.
 * Never real stock bytes.
 */
import { seededBytes, syntheticDescriptor } from '../../__fixtures__/synthetic.ts';
import { sha256Hex } from '../../hash.ts';
import { makeSyntheticDm32Patch } from '../../patch/formats/baofeng-dm32-firmware/__fixtures__/makeSyntheticPatch.ts';
import {
  makeSyntheticUv5rMiniPatch,
  synthUv5rMiniStock,
} from '../../patch/formats/baofeng-uv5rmini-firmware/__fixtures__/makeSyntheticPatch.ts';
import { UV5RMINI_STOCK_FIRMWARE } from '../../../radios/baofeng/uv-5r-mini/firmware.ts';
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

/**
 * Test-only synthetic UV-5R Mini release file for one flash layout: seeded stock, a built image that differs by layout,
 * a patch named `mm9pdy-<layout>-<version>` (or `buildName`), and a published-style row with `layout` (or none when
 * `rowLayout` is null). The descriptor carries the Mini's real release layouts. Never real stock bytes.
 */
export async function syntheticUv5rMiniRelease(
  opts: {
    layout?: string;
    version?: string;
    buildName?: string;
    rowLayout?: string | null;
    /** The base the patch names; default `synthetic`. */
    patchBase?: string;
  } = {},
) {
  const layout = opts.layout ?? 'L1';
  const version = opts.version ?? '9.9.9';
  const stockBin = synthUv5rMiniStock();
  const built = stockBin.slice();
  built.set(new TextEncoder().encode(`${layout}-${version}`), 200);
  const base = await syntheticDescriptor(
    'baofeng-uv5rmini',
    [{ role: 'ufw', fileName: 'stock.ufw', bytes: stockBin }],
    { fileName: 'synth.zip', bytes: seededBytes(103, 16) },
  );
  const descriptor: StockFirmwareDescriptor = {
    ...base,
    patchNames: ['baofeng-uv5rmini-firmware'],
    releaseLayouts: UV5RMINI_STOCK_FIRMWARE.releaseLayouts,
    // The synthetic patches name the base `synthetic`.
    baseName: 'synthetic',
  };
  const buildName = opts.buildName ?? `mm9pdy-${layout}-${version}`;
  const patchJson = await makeSyntheticUv5rMiniPatch(stockBin, built, {
    version,
    buildName,
    ...(opts.patchBase ? { base: opts.patchBase } : {}),
  });
  const patchBytes = new TextEncoder().encode(JSON.stringify(patchJson) + '\n');
  const patchSha256 = await sha256Hex(patchBytes);
  const rowLayout = opts.rowLayout === undefined ? layout : opts.rowLayout;
  const row: PublishedFirmwareRelease = {
    radioId: 'baofeng-uv5rmini',
    tag: version,
    patchName: 'baofeng-uv5rmini-firmware',
    channel: version.includes('-rc.') ? 'rc' : 'final',
    patchFile: `uv5rmini-fw-${layout}-${version}.patch.json`,
    patchSha256,
    stockVersion: descriptor.version,
    ...(rowLayout === null ? {} : { layout: rowLayout }),
    publishedOn: '2026-01-01',
    summary: 'Synthetic release.',
    verifyHint: 'Synthetic verify hint.',
    resultSha256: { ufw: await sha256Hex(built) },
    loadBytes: async () => patchBytes.slice(),
    loadNotes: async () => 'Synthetic notes.',
  };
  return { stockBin, built, descriptor, patchBytes, patchSha256, row, buildName };
}

/** The UV-5R Mini's two stock bases, as the synthetic variant descriptor names them. */
export const SYNTH_MINI_VARIANTS = {
  'nrf-v0.27': { version: 'v0.27 (NRF)', prefix: 'v0.27-NRF', layout: 'L2', seed: 5 },
  'nrfb-v0.04': { version: 'v0.04 (NRFB)', prefix: 'v0.04-NRFB', layout: 'L1', seed: 6 },
} as const;
export type SynthMiniBase = keyof typeof SYNTH_MINI_VARIANTS;

/**
 * Test-only UV-5R Mini descriptor with the radio's real two stock bases (`nrf-v0.27` primary, `nrfb-v0.04`), each
 * pinned to its own seeded synthetic stock, and the Mini's real release layouts. Never real stock bytes.
 */
export async function syntheticUv5rMiniVariantsDescriptor(): Promise<StockFirmwareDescriptor> {
  const stock = (base: SynthMiniBase) => synthUv5rMiniStockFor(base);
  const base = await syntheticDescriptor(
    'baofeng-uv5rmini',
    [{ role: 'ufw', fileName: 'stock-nrf.ufw', bytes: stock('nrf-v0.27') }],
    { fileName: 'synth.zip', bytes: seededBytes(103, 16) },
  );
  const nrfb = stock('nrfb-v0.04');
  return {
    ...base,
    version: SYNTH_MINI_VARIANTS['nrf-v0.27'].version,
    baseName: 'nrf-v0.27',
    alsoAccepts: [
      {
        version: SYNTH_MINI_VARIANTS['nrfb-v0.04'].version,
        baseName: 'nrfb-v0.04',
        members: [
          {
            role: 'ufw',
            fileName: 'stock-nrfb.ufw',
            size: nrfb.length,
            sha256: await sha256Hex(nrfb),
          },
        ],
      },
    ],
    severalStocks: true,
    patchNames: ['baofeng-uv5rmini-firmware'],
    releaseLayouts: UV5RMINI_STOCK_FIRMWARE.releaseLayouts,
  };
}

/** The seeded synthetic stock of one Mini base. */
export function synthUv5rMiniStockFor(base: SynthMiniBase): Uint8Array {
  return seededBytes(SYNTH_MINI_VARIANTS[base].seed, 4096);
}

/**
 * Test-only UV-5R Mini release on one stock base (D133): a patch on that base's synthetic stock named
 * `<prefix>-<version>` (or `buildName`), and an index-style row with its `base`, stock version and the base's `layout`
 * (or `rowLayout`, or none when null). `stockOf` builds on another base's stock (a crossed patch). Never real stock.
 */
export async function syntheticUv5rMiniVariantRelease(opts: {
  base: SynthMiniBase;
  version?: string;
  buildName?: string;
  rowLayout?: string | null;
  /** The base the patch names; default `base`. */
  patchBase?: string;
  /** The stock the patch is built on; default `base`'s. */
  stockOf?: SynthMiniBase;
  publishedOn?: string;
  feature?: string;
}) {
  const v = SYNTH_MINI_VARIANTS[opts.base];
  const version = opts.version ?? '9.9.9';
  const descriptor = await syntheticUv5rMiniVariantsDescriptor();
  const stockBin = synthUv5rMiniStockFor(opts.stockOf ?? opts.base);
  const built = stockBin.slice();
  built.set(new TextEncoder().encode(`${opts.base}-${version}-${opts.feature ?? ''}`), 200);
  const buildName = opts.buildName ?? `${v.prefix}-${version}`;
  const patchJson = await makeSyntheticUv5rMiniPatch(stockBin, built, {
    version,
    buildName,
    base: opts.patchBase ?? opts.base,
  });
  const patchBytes = new TextEncoder().encode(JSON.stringify(patchJson) + '\n');
  const patchSha256 = await sha256Hex(patchBytes);
  const rowLayout = opts.rowLayout === undefined ? v.layout : opts.rowLayout;
  const row: PublishedFirmwareRelease = {
    radioId: 'baofeng-uv5rmini',
    tag: version,
    patchName: 'baofeng-uv5rmini-firmware',
    channel: version.includes('-rc.') ? 'rc' : 'final',
    patchFile: `uv5rmini-fw-${version}-${opts.base}-hw1.7.patch.json`,
    patchSha256,
    stockVersion: v.version,
    ...(rowLayout === null ? {} : { layout: rowLayout }),
    base: opts.base,
    publishedOn: opts.publishedOn ?? '2026-01-01',
    summary: `Synthetic ${opts.base} ${version}.`,
    verifyHint: 'Synthetic verify hint.',
    resultSha256: { ufw: await sha256Hex(built) },
    loadBytes: async () => patchBytes.slice(),
    loadNotes: async () => 'Synthetic notes.',
  };
  return { stockBin, built, descriptor, patchJson, patchBytes, patchSha256, row, buildName };
}
