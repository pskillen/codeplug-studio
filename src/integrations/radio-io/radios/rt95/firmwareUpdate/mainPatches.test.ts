/**
 * RT95 MAIN patches against the widened send-path identity check, and their binding to the MAIN radio. Synthetic
 * golden stock only; the MAIN descriptor is re-pinned to it so no real hash is involved.
 */
import { describe, expect, it } from 'vitest';

import { makeSyntheticMainPatch } from '@core/firmware/patch/formats/retevis-rt95-main-firmware/__fixtures__/makeSyntheticMainPatch.ts';
import { synthMainStock } from '@core/firmware/patch/formats/retevis-rt95-main-firmware/__fixtures__/synthMainStock.ts';
import {
  makeSyntheticRt95Patch,
  synthRt95Stock,
} from '@core/firmware/patch/formats/retevis-rt95-firmware/__fixtures__/makeSyntheticPatch.ts';
import { applyFirmwarePatch, parseFirmwarePatch } from '@core/firmware/patch/index.ts';
import { parsePublishedReleaseIndex } from '@core/firmware/releases/publishedIndex.ts';
import { createUserPatchSource } from '@core/firmware/releases/userPatchSource.ts';
import { sha256Hex } from '@core/firmware/hash.ts';
import type { FirmwarePackage, StockFirmwareDescriptor } from '@core/firmware/types.ts';
import {
  RT95_HEAD_STOCK_FIRMWARE,
  RT95_MAIN_STOCK_FIRMWARE,
} from '@core/radios/retevis/rt95/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RT95_MAIN_GOLDEN_SHA256 } from './__fixtures__/syntheticPackage.ts';
import { checkRt95FirmwareImage } from './interlocks.ts';
import { createRt95MainTarget } from './targets.ts';

const GOLDEN_STOCK: StockFirmwareDescriptor = {
  ...RT95_MAIN_STOCK_FIRMWARE,
  members: RT95_MAIN_STOCK_FIRMWARE.members.map((m) => ({
    ...m,
    sha256: RT95_MAIN_GOLDEN_SHA256[m.role as 'cdd' | 'cdi' | 'spi'],
  })),
};
const TARGET = createRt95MainTarget(GOLDEN_STOCK);
const stock = synthMainStock();
const stockPkg: FirmwarePackage = {
  radioId: 'retevis-rt95-main',
  files: { cdd: stock.cdd, cdi: stock.cdi, spi: stock.spi },
};
const encode = (json: unknown) => new TextEncoder().encode(JSON.stringify(json));

async function patched(opts: Parameters<typeof makeSyntheticMainPatch>[1]) {
  const json = await makeSyntheticMainPatch(stock, opts);
  return applyFirmwarePatch(stockPkg, parseFirmwarePatch(encode(json)));
}

function image(
  files: Record<string, Uint8Array>,
  over: Partial<{ stockPackage: FirmwarePackage | undefined; provenance: string }> = {},
): PreparedFirmwareImage {
  return {
    radioId: 'retevis-rt95-main',
    provenance: over.provenance ?? 'published',
    stockVersion: 'test',
    title: 'test',
    package: { radioId: 'retevis-rt95-main', files },
    stockPackage: 'stockPackage' in over ? over.stockPackage : stockPkg,
    sha256: {},
    verifyHint: 'test',
  } as unknown as PreparedFirmwareImage;
}

const identity = (i: PreparedFirmwareImage) => TARGET.checkImageIdentity!(i);
const CHANGES = /changes more than D35 allows/;
const append = new Uint8Array(300).fill(0x5a);

describe('RT95 MAIN identity check with patches', () => {
  it('accepts a patched image from a hook and an append, and a zero-change patch', async () => {
    const out = await patched({ hook: true, append });
    expect(checkRt95FirmwareImage(image(out.files), TARGET).cdd.length).toBe(0xd93c + 300);
    const zero = await patched({});
    expect(() => checkRt95FirmwareImage(image(zero.files), TARGET)).not.toThrow();
  });

  it('accepts a user (unreviewed) image the same way', async () => {
    const out = await patched({ hook: true, append });
    expect(() =>
      checkRt95FirmwareImage(image(out.files, { provenance: 'unreviewed' }), TARGET),
    ).not.toThrow();
  });

  it('refuses one byte changed outside the hook site', async () => {
    for (const at of [0x381, 0x386, 0x1000, 0xd93b]) {
      const out = await patched({ hook: true, append });
      const cdd = out.files.cdd!.slice();
      cdd[at] = cdd[at]! ^ 1;
      expect(() => checkRt95FirmwareImage(image({ ...out.files, cdd }), TARGET)).toThrow(CHANGES);
    }
  });

  it('refuses a missing or unpinned stockPackage', async () => {
    const out = await patched({ hook: true, append });
    expect(() =>
      checkRt95FirmwareImage(image(out.files, { stockPackage: undefined }), TARGET),
    ).toThrow(CHANGES);
    const other = synthMainStock();
    other.cdd[0x2000] ^= 1;
    expect(() =>
      checkRt95FirmwareImage(
        image(out.files, {
          stockPackage: { radioId: 'retevis-rt95-main', files: { ...other } },
        }),
        TARGET,
      ),
    ).toThrow(CHANGES);
  });

  it('refuses a .CDI or .spi changed beyond the length field, or with the wrong length', async () => {
    const out = await patched({ hook: true, append });
    const cdi = out.files.cdi!.slice();
    cdi[0x108] = 1;
    expect(() => identity(image({ ...out.files, cdi }), TARGET)).toThrow(CHANGES);
    const spi = out.files.spi!.slice();
    spi[0] = 2;
    expect(() => identity(image({ ...out.files, spi }), TARGET)).toThrow(CHANGES);
    const badLen = out.files.cdi!.slice();
    badLen[0x104] ^= 1;
    expect(() => identity(image({ ...out.files, cdi: badLen }), TARGET)).toThrow(CHANGES);
  });

  it('refuses an image over the window end and one shorter than the stock image', async () => {
    const out = await patched({ hook: true, append });
    const big = new Uint8Array(0xdc00 + 1);
    big.set(out.files.cdd!);
    expect(() => identity(image({ ...out.files, cdd: big }), TARGET)).toThrow(CHANGES);
    const short = out.files.cdd!.slice(0, 0xd93b);
    expect(() => identity(image({ ...out.files, cdd: short }), TARGET)).toThrow(CHANGES);
  });

  it('still refuses a patched image on the real pinned stock (not the synthetic one)', async () => {
    const out = await patched({ hook: true, append });
    expect(() =>
      checkRt95FirmwareImage(image(out.files), createRt95MainTarget(RT95_MAIN_STOCK_FIRMWARE)),
    ).toThrow(CHANGES);
  });
});

describe('RT95 MAIN patch binding', () => {
  it('the MAIN descriptor takes the MAIN patch name and the head does not', () => {
    expect(RT95_MAIN_STOCK_FIRMWARE.patchNames).toEqual(['retevis-rt95-main-firmware']);
    expect(RT95_HEAD_STOCK_FIRMWARE.patchNames).toEqual(['retevis-rt95-firmware']);
  });

  it('a user patch file binds to the MAIN radio and is unreviewed', async () => {
    const bytes = encode(await makeSyntheticMainPatch(stock, { hook: true, append }));
    const source = createUserPatchSource(
      { name: 'rt95-main-fw-x.patch.json', bytes },
      { rows: [], descriptors: [RT95_HEAD_STOCK_FIRMWARE, RT95_MAIN_STOCK_FIRMWARE] },
    );
    const [summary] = await source.listReleases('retevis-rt95-main');
    expect(summary).toMatchObject({ provenance: 'unreviewed', radioId: 'retevis-rt95-main' });
  });

  it('the head radio refuses a MAIN patch name, and the MAIN radio a head patch', async () => {
    const mainBytes = encode(await makeSyntheticMainPatch(stock, {}));
    const descriptors = [RT95_HEAD_STOCK_FIRMWARE, RT95_MAIN_STOCK_FIRMWARE];
    await expect(
      createUserPatchSource(
        { name: 'm.json', bytes: mainBytes },
        { rows: [], descriptors },
      ).listReleases('retevis-rt95-head'),
    ).rejects.toMatchObject({ code: 'patch-wrong-radio' });
    const head = synthRt95Stock();
    const headBytes = encode(await makeSyntheticRt95Patch(head, head, '1'));
    await expect(
      createUserPatchSource(
        { name: 'h.json', bytes: headBytes },
        { rows: [], descriptors },
      ).listReleases('retevis-rt95-main'),
    ).rejects.toMatchObject({ code: 'patch-wrong-radio' });
  });

  it('a published index row for releases/retevis-rt95-main/ binds', async () => {
    const bytes = encode(await makeSyntheticMainPatch(stock, { hook: true, append }));
    const entry = {
      radioId: 'retevis-rt95-main',
      version: '1.0.0',
      channel: 'final',
      patchName: 'retevis-rt95-main-firmware',
      patchFile: 'rt95-main-fw-1.0.0.patch.json',
      patchPath: 'releases/retevis-rt95-main/rt95-main-fw-1.0.0.patch.json',
      patchSha256: await sha256Hex(bytes),
      stockVersion: 'MAIN V1.61 (20231202)',
      publishedOn: '2026-01-01',
      summary: 'Synthetic.',
      verifyHint: 'Synthetic.',
      resultSha256: { cdd: 'a'.repeat(64), cdi: 'b'.repeat(64), spi: 'c'.repeat(64) },
    };
    const [row] = parsePublishedReleaseIndex(
      { format: 1, releases: [entry] },
      {
        descriptors: [RT95_HEAD_STOCK_FIRMWARE, RT95_MAIN_STOCK_FIRMWARE],
        loadPatchBytes: async () => bytes,
      },
    );
    expect(row).toMatchObject({
      radioId: 'retevis-rt95-main',
      patchName: 'retevis-rt95-main-firmware',
    });
  });
});
