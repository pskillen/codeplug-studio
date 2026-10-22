import { strToU8, zipSync } from 'fflate';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { seededBytes, syntheticDescriptor } from '../__fixtures__/synthetic.ts';
import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import type { NamedBytes, StockFirmwareDescriptor } from '../types.ts';
import { resolveStockFirmware } from './resolveStockFirmware.ts';
import { createUserFileStockSource } from './stockSource.ts';

/** Records every filter decision fflate asks for, so tests can prove non-members are never inflated. */
const filterLog = vi.hoisted(() => ({ asked: [] as { name: string; inflate: boolean }[] }));

vi.mock('fflate', async (importOriginal) => {
  const real = await importOriginal<typeof import('fflate')>();
  return {
    ...real,
    unzipSync: ((data: Uint8Array, opts?: Parameters<typeof real.unzipSync>[1]) => {
      const filter = opts?.filter;
      return real.unzipSync(data, {
        ...opts,
        filter: (f) => {
          const inflate = filter ? filter(f) : true;
          filterLog.asked.push({ name: f.name, inflate });
          return inflate;
        },
      });
    }) as typeof real.unzipSync,
  };
});

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof FirmwareError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

const oneBin = seededBytes(1, 3000);
const triA = seededBytes(2, 4000);
const triB = seededBytes(3, 64);
const triC = seededBytes(4, 32);

const oneZip = zipSync({
  'Vendor Firmware/ONE_STOCK.img': oneBin,
  'Vendor Firmware/readme.txt': strToU8('notes'),
});
const triZip = zipSync({
  'Pkg FW/TRI.A': triA,
  'Pkg FW/TRI.B': triB,
  'Pkg FW/TRI.C': triC,
  'ICON/pack.img': seededBytes(5, 2048),
});

let one: StockFirmwareDescriptor;
let tri: StockFirmwareDescriptor;

beforeAll(async () => {
  one = await syntheticDescriptor(
    'baofeng-dm32uv',
    [{ role: 'img', fileName: 'ONE_STOCK.img', bytes: oneBin }],
    { fileName: 'one.zip', bytes: oneZip },
  );
  tri = await syntheticDescriptor(
    'anytone-at-d890uv',
    [
      { role: 'a', fileName: 'TRI.A', bytes: triA },
      { role: 'b', fileName: 'TRI.B', bytes: triB },
      { role: 'c', fileName: 'TRI.C', bytes: triC },
    ],
    { fileName: 'tri.zip', bytes: triZip },
  );
});

beforeEach(() => {
  filterLog.asked = [];
});

const ctxOne = () => ({ otherDescriptors: [tri] });
const ctxTri = () => ({ otherDescriptors: [one] });

describe('resolveStockFirmware — one-member radio', () => {
  it('accepts the vendor zip', async () => {
    const v = await resolveStockFirmware(one, [{ name: 'one.zip', bytes: oneZip }], ctxOne());
    expect(v.via).toBe('zip');
    expect(v.zipMismatchNoted).toBe(false);
    expect(v.package.radioId).toBe('baofeng-dm32uv');
    expect(v.package.files.img).toEqual(oneBin);
    expect(v.sha256.img).toBe(one.members[0]!.sha256);
  });

  it('accepts the extracted file', async () => {
    const v = await resolveStockFirmware(one, [{ name: 'ONE_STOCK.img', bytes: oneBin }], ctxOne());
    expect(v.via).toBe('files');
    expect(v.package.files.img).toEqual(oneBin);
  });

  it('matches a loose file by basename, with either separator', async () => {
    const v = await resolveStockFirmware(
      one,
      [{ name: 'C:\\Downloads\\ONE_STOCK.img', bytes: oneBin }],
      ctxOne(),
    );
    expect(v.package.files.img).toEqual(oneBin);
  });
});

describe('resolveStockFirmware — three-member radio', () => {
  it('accepts the vendor zip without inflating unrelated entries', async () => {
    const v = await resolveStockFirmware(tri, [{ name: 'tri.zip', bytes: triZip }], ctxTri());
    expect(v.via).toBe('zip');
    expect(Object.keys(v.package.files).sort()).toEqual(['a', 'b', 'c']);
    expect(v.package.files.a).toEqual(triA);
    expect(filterLog.asked.find((a) => a.name === 'ICON/pack.img')?.inflate).toBe(false);
  });

  it('accepts three loose files', async () => {
    const v = await resolveStockFirmware(
      tri,
      [
        { name: 'TRI.A', bytes: triA },
        { name: 'TRI.B', bytes: triB },
        { name: 'TRI.C', bytes: triC },
      ],
      ctxTri(),
    );
    expect(v.via).toBe('files');
    expect(v.package.files.c).toEqual(triC);
  });

  it('prefers the zip member when a loose duplicate is also given', async () => {
    const v = await resolveStockFirmware(
      tri,
      [
        { name: 'tri.zip', bytes: triZip },
        { name: 'TRI.B', bytes: triB },
      ],
      ctxTri(),
    );
    expect(v.via).toBe('zip');
    expect(v.package.files.b).toEqual(triB);
  });
});

describe('resolveStockFirmware — refusals', () => {
  it('refuses a hash mismatch as the wrong version', async () => {
    const bad = oneBin.slice();
    bad[100] = bad[100]! ^ 0xff;
    expect(
      await codeOf(resolveStockFirmware(one, [{ name: 'ONE_STOCK.img', bytes: bad }], ctxOne())),
    ).toBe('stock-wrong-version');
  });

  it('refuses a size mismatch as the wrong version', async () => {
    expect(
      await codeOf(
        resolveStockFirmware(
          one,
          [{ name: 'ONE_STOCK.img', bytes: oneBin.slice(0, 2999) }],
          ctxOne(),
        ),
      ),
    ).toBe('stock-wrong-version');
  });

  it('refuses a missing member', async () => {
    expect(
      await codeOf(
        resolveStockFirmware(
          tri,
          [
            { name: 'TRI.A', bytes: triA },
            { name: 'TRI.B', bytes: triB },
          ],
          ctxTri(),
        ),
      ),
    ).toBe('stock-missing-member');
  });

  it('refuses two zip entries with the same basename', async () => {
    const dupZip = zipSync({ 'a/ONE_STOCK.img': oneBin, 'b/ONE_STOCK.img': oneBin });
    expect(
      await codeOf(resolveStockFirmware(one, [{ name: 'dup.zip', bytes: dupZip }], ctxOne())),
    ).toBe('stock-duplicate-member');
  });

  it('refuses two loose inputs for one member', async () => {
    expect(
      await codeOf(
        resolveStockFirmware(
          one,
          [
            { name: 'ONE_STOCK.img', bytes: oneBin },
            { name: 'copy/ONE_STOCK.img', bytes: oneBin },
          ],
          ctxOne(),
        ),
      ),
    ).toBe('stock-duplicate-member');
  });

  it('refuses a corrupt zip', async () => {
    const corrupt = new Uint8Array(200);
    corrupt.set([0x50, 0x4b, 0x03, 0x04]);
    corrupt.set(seededBytes(9, 196), 4);
    expect(
      await codeOf(resolveStockFirmware(one, [{ name: 'bad.zip', bytes: corrupt }], ctxOne())),
    ).toBe('stock-corrupt-zip');
  });

  it("refuses the other radio's zip", async () => {
    expect(
      await codeOf(resolveStockFirmware(one, [{ name: 'tri.zip', bytes: triZip }], ctxOne())),
    ).toBe('stock-wrong-radio');
    expect(
      await codeOf(resolveStockFirmware(tri, [{ name: 'one.zip', bytes: oneZip }], ctxTri())),
    ).toBe('stock-wrong-radio');
  });

  it("refuses the other radio's loose files", async () => {
    expect(
      await codeOf(resolveStockFirmware(tri, [{ name: 'ONE_STOCK.img', bytes: oneBin }], ctxTri())),
    ).toBe('stock-wrong-radio');
  });

  it("refuses the other radio's bytes under this radio's file name", async () => {
    const twin = await syntheticDescriptor(
      'anytone-at-d890uv',
      [{ role: 'img', fileName: 'TWIN.img', bytes: seededBytes(11, 3000) }],
      { fileName: 'twin.zip', bytes: seededBytes(12, 10) },
    );
    const err = await resolveStockFirmware(twin, [{ name: 'TWIN.img', bytes: oneBin }], {
      otherDescriptors: [one],
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirmwareError);
    expect((err as FirmwareError).code).toBe('stock-wrong-radio');
    expect((err as FirmwareError).message).toContain(one.label);
  });

  it('refuses already-patched firmware', async () => {
    const patched = oneBin.slice();
    patched[10] = patched[10]! ^ 1;
    const ctx = {
      ...ctxOne(),
      knownPatchedResults: [
        {
          radioId: 'baofeng-dm32uv' as const,
          label: 'release 1.0.0',
          sha256: { img: await sha256Hex(patched) },
        },
      ],
    };
    const err = await resolveStockFirmware(
      one,
      [{ name: 'ONE_STOCK.img', bytes: patched }],
      ctx,
    ).catch((e: unknown) => e);
    expect((err as FirmwareError).code).toBe('stock-is-patched');
    expect((err as FirmwareError).message).toContain('release 1.0.0');
  });
});

describe('resolveStockFirmware — zip handling', () => {
  it('accepts a re-zipped download and notes the zip mismatch', async () => {
    const rezipped = zipSync({ 'other folder/ONE_STOCK.img': oneBin }, { level: 1 });
    expect(await sha256Hex(rezipped)).not.toBe(one.zip.sha256);
    const v = await resolveStockFirmware(one, [{ name: 'one.zip', bytes: rezipped }], ctxOne());
    expect(v.zipMismatchNoted).toBe(true);
    expect(v.package.files.img).toEqual(oneBin);
  });

  it('never inflates a large non-member entry', async () => {
    const decoyZip = zipSync({
      'fw/ONE_STOCK.img': oneBin,
      'ICON/huge-decoy.img': new Uint8Array(512 * 1024),
    });
    const v = await resolveStockFirmware(one, [{ name: 'one.zip', bytes: decoyZip }], ctxOne());
    const decoy = filterLog.asked.find((a) => a.name === 'ICON/huge-decoy.img');
    expect(decoy).toEqual({ name: 'ICON/huge-decoy.img', inflate: false });
    expect(filterLog.asked.find((a) => a.name === 'fw/ONE_STOCK.img')?.inflate).toBe(true);
    expect(Object.keys(v.package.files)).toEqual(['img']);
  });

  it('returns copies, so the input buffers are never shared', async () => {
    const input = oneBin.slice();
    const v = await resolveStockFirmware(one, [{ name: 'ONE_STOCK.img', bytes: input }], ctxOne());
    v.package.files.img![0] = v.package.files.img![0]! ^ 0xff;
    expect(input).toEqual(oneBin);
  });
});

describe('createUserFileStockSource', () => {
  it('returns the supplied files without verifying them', async () => {
    const files: NamedBytes[] = [{ name: 'anything.img', bytes: new Uint8Array([1, 2, 3]) }];
    const src = createUserFileStockSource(files);
    expect(src.kind).toBe('user-files');
    expect(await src.load(one)).toEqual(files);
  });
});
