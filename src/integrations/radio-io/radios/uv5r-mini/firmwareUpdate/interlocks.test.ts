import { describe, expect, it } from 'vitest';

import { stockVariants } from '@core/firmware/stockVariants.ts';
import { UV5RMINI_STOCK_FIRMWARE } from '@core/radios/baofeng/uv-5r-mini/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { makeSyntheticUfw, type SyntheticUfwOptions } from './__fixtures__/makeSyntheticUfw.ts';
import {
  UV5RMINI_BASES,
  UV5RMINI_FLASH_BASE,
  UV5RMINI_PINNED_LOADERS,
  uv5rMiniHardLimit,
  type PinnedLoader,
  type Uv5rMiniBase,
} from './constants.ts';
import { checkUv5rMiniImage, firstDifferenceOutsideWindows } from './interlocks.ts';
import { sha256HexSync } from './sha256Sync.ts';

const FLASH_SIZE = 0x7c000 - 0x1000; // fills the area exactly
const stock = makeSyntheticUfw({ flashSize: FLASH_SIZE, flashSeed: 10, loaderSeed: 20 });
const FAKE_PACKED_SHA = sha256HexSync(stock.loader);
const pins: PinnedLoader[] = [
  { label: 'fake', sha256: FAKE_PACKED_SHA, lists: ['nrfb-v0.04', 'listed-build'] },
];
const STOCK_SHA = sha256HexSync(stock.bytes);
/** The production bases' windows and layouts, with the synthetic stock standing in for each base's stock file. */
const bases: Record<string, Uv5rMiniBase> = Object.fromEntries(
  Object.entries(UV5RMINI_BASES).map(([name, b]) => [name, { ...b, stockSha256: STOCK_SHA }]),
);
const V04 = bases['nrfb-v0.04']!;
const V27 = bases['nrf-v0.27']!;

/** The stock flash with `edit` applied at SoC addresses. */
function flashWith(...edits: [addr: number, value: number][]): Uint8Array {
  const f = stock.flash.slice();
  for (const [addr, v] of edits) f[addr - UV5RMINI_FLASH_BASE] = v;
  return f;
}

function prepared(
  o: {
    ufw?: SyntheticUfwOptions;
    stamp?: string | undefined;
    provenance?: PreparedFirmwareImage['provenance'];
    radioId?: string;
    extraRole?: boolean;
    noStock?: boolean;
    base?: string | undefined;
  } = {},
): PreparedFirmwareImage {
  const built = makeSyntheticUfw({ flash: stock.flash, loader: stock.loader, ...o.ufw });
  const files: Record<string, Uint8Array> = { ufw: built.bytes };
  if (o.extraRole) files.extra = new Uint8Array(4);
  const radioId = o.radioId ?? 'baofeng-uv5rmini';
  return {
    radioId,
    provenance: o.provenance ?? 'published',
    stockVersion: 'v0.04 (NRFB)',
    baseName: 'base' in o ? o.base : 'nrfb-v0.04',
    title: 'synthetic',
    versionStamp: 'stamp' in o ? o.stamp : 'mm9pdy-test',
    package: { radioId, files },
    stockPackage: o.noStock ? undefined : { radioId, files: { ufw: stock.bytes } },
    sha256: {},
    verifyHint: '',
  } as unknown as PreparedFirmwareImage;
}

const check = (img: PreparedFirmwareImage) => checkUv5rMiniImage(img, pins, bases);
const refused = (img: PreparedFirmwareImage, re: RegExp) => {
  expect(() => check(img)).toThrow(RadioInterlockError);
  expect(() => check(img)).toThrow(re);
};

describe('checkUv5rMiniImage — passes', () => {
  it('accepts an image that differs only inside the app windows', () => {
    const f = flashWith(
      [0x4000, 1],
      [0x4003, 1],
      [0x4020, 1],
      [0x4023, 1],
      [0x4100, 1],
      [0x7be1b, 1],
    );
    check(prepared({ ufw: { flash: f } }));
  });

  it('accepts a flash identical to the stock', () => {
    check(prepared());
  });
});

describe('checkUv5rMiniImage — I1 container', () => {
  it.each<[string, SyntheticUfwOptions]>([
    ['header CRC', { badHeaderCrc: true }],
    ['list CRC', { badListCrc: true }],
    ['data CRC', { badFlashCrc: true }],
    ['a third entry', { thirdEntry: true }],
    ['a missing ota.bin', { noOta: true }],
  ])('refuses %s', (_n, ufw) => refused(prepared({ ufw }), /not a well-formed update file/));
});

describe('checkUv5rMiniImage — I2 loader', () => {
  it.each<[string, SyntheticUfwOptions]>([
    ['two loaders', { twoLoaders: true }],
    ['the wrong loader name', { otaLoaderName: 'other.bin' }],
    ['the wrong attribute', { otaAttr: 0x40 }],
    ['a bad loader entry CRC', { badOtaHeaderCrc: true }],
    ['a bad loader data CRC', { badOtaDataCrc: true }],
  ])('refuses %s', (_n, ufw) => refused(prepared({ ufw }), /not a well-formed update file/));

  it('refuses a loader that is not pinned', () => {
    refused(
      prepared({ ufw: { loader: new Uint8Array(600).fill(7) } }),
      /loader is not one Studio knows/,
    );
  });

  it('refuses every loader when the production table is used (the fake is not pinned there)', () => {
    expect(() => checkUv5rMiniImage(prepared(), undefined, bases)).toThrow(
      /loader is not one Studio knows/,
    );
  });
});

describe('UV5RMINI_PINNED_LOADERS', () => {
  it('pins stock+c4+w1 with its packed hash and the three builds it lists', () => {
    const w1 = UV5RMINI_PINNED_LOADERS.find((p) => p.label === 'stock+c4+w1');
    expect(w1?.sha256).toBe('3ec9a37db41f98bcf9e2b2a75200fd3450ac48807860470f5ca11b08a11724e8');
    expect(w1?.lists).toEqual(['nrfb-v0.04', 'mm9pdy-0.1.0-rc.1', 'mm9pdy-pr125-g1c0a9df']);
  });

  it('pins three distinct loaders, and an unknown hash is in none of them', () => {
    const hashes = UV5RMINI_PINNED_LOADERS.map((p) => p.sha256);
    expect(new Set(hashes).size).toBe(3);
    expect(hashes).not.toContain(FAKE_PACKED_SHA);
  });
});

describe('checkUv5rMiniImage — I3 area', () => {
  it('refuses a flash.bin past the area end', () => {
    const big = makeSyntheticUfw({
      flashSize: FLASH_SIZE + 1,
      flashSeed: 10,
      loader: stock.loader,
    });
    refused(prepared({ ufw: { flash: big.flash } }), /past the end of the firmware area/);
  });

  it('refuses a flash.bin past 0x94000', () => {
    const big = makeSyntheticUfw({ flashSize: 0x94000 - 0x1000 + 1, loader: stock.loader });
    // With the production area end the limit is the second line of defence; widen the area to reach it.
    const wide = { ...bases, 'nrfb-v0.04': { ...V04, areaEnd: 0x95000 } };
    const img = prepared({ ufw: { flash: big.flash } });
    expect(() => checkUv5rMiniImage(img, pins, wide)).toThrow(/past the limit 0x94000/);
  });
});

describe('checkUv5rMiniImage — I4 stock bytes', () => {
  it.each<[string, number]>([
    ['the first byte of flash.bin', 0x1000],
    ['just before the first window', 0x3fff],
    ['just after the first window', 0x4004],
    ['between the windows', 0x4010],
    ['just after the second window', 0x4024],
    ['just before the app window', 0x40ff],
    ['the end of the app window', 0x7be1c],
    ['the last byte', 0x7bfff],
  ])('refuses a change at %s', (_n, addr) => {
    const f = flashWith([addr, stock.flash[addr - UV5RMINI_FLASH_BASE]! ^ 0xff]);
    refused(
      prepared({ ufw: { flash: f } }),
      new RegExp(`at 0x${addr.toString(16).toUpperCase()},`),
    );
  });

  it('refuses a length difference', () => {
    const short = stock.flash.subarray(0, stock.flash.length - 0x100);
    refused(prepared({ ufw: { flash: short } }), /bytes where the stock is/);
  });

  it('refuses an image with no stock to compare against', () => {
    refused(prepared({ noStock: true }), /isn't available to check against/);
  });
});

describe('checkUv5rMiniImage — I7 unlisted self', () => {
  it('refuses a build the loader lists', () => {
    refused(prepared({ stamp: 'listed-build' }), /already listed by its own loader/);
    refused(prepared({ stamp: 'nrfb-v0.04' }), /already listed by its own loader/);
  });
});

describe('checkUv5rMiniImage — binding and provenance', () => {
  it('refuses an image with no build name', () => {
    refused(prepared({ stamp: undefined }), /can't tell which build/);
  });
  it('refuses the plain stock image', () => {
    refused(prepared({ provenance: 'stock' }), /can't tell which build/);
  });
  it('refuses another radio', () => {
    refused(prepared({ radioId: 'baofeng-dm32uv' }), /not for the Baofeng UV-5R Mini/);
  });
  it('refuses an extra role', () => {
    refused(prepared({ extraRole: true }), /exactly one \.ufw file/);
  });
});

describe('checkUv5rMiniImage — the base', () => {
  it('refuses an image whose patch names no base, or one Studio does not know', () => {
    refused(prepared({ base: undefined }), /base is not one Studio knows/);
    refused(prepared({ base: 'nrf-v0.27-L1' }), /base is not one Studio knows/);
  });

  it("refuses a base whose stock is not the stock the image was built from (a v0.27 patch can't borrow v0.04's windows)", () => {
    const real = (name: string) => () =>
      checkUv5rMiniImage(prepared({ base: name }), pins, UV5RMINI_BASES);
    expect(real('nrfb-v0.04')).toThrow(/is not that base's stock/);
    expect(real('nrf-v0.27')).toThrow(/is not that base's stock/);
  });

  it('applies the named base: the v0.27 app window ends at 0x7BBC8, the v0.04 one at 0x7BE1C', () => {
    const f = flashWith([0x7bbc8, 1]);
    check(prepared({ ufw: { flash: f }, base: 'nrfb-v0.04' }));
    refused(prepared({ ufw: { flash: f }, base: 'nrf-v0.27' }), /at 0x7BBC8,/);
    const g = flashWith([0x7bbc7, 1]);
    check(prepared({ ufw: { flash: g }, base: 'nrf-v0.27' }));
  });

  it('takes the hard limit from the base layout: 0x93000 on v0.27, 0x94000 on v0.04', () => {
    expect(uv5rMiniHardLimit(V04)).toBe(0x94000);
    expect(uv5rMiniHardLimit(V27)).toBe(0x93000);
    // A table whose area end is out of range (a bad edit) is still held by the layout limit.
    const wide = { ...bases, 'nrf-v0.27': { ...V27, areaEnd: 0x94000 } };
    const past = makeSyntheticUfw({ flashSize: 0x93000 - 0x1000 + 1, loader: stock.loader });
    const wideCheck = (base: string) => () =>
      checkUv5rMiniImage(prepared({ ufw: { flash: past.flash }, base }), pins, wide);
    expect(wideCheck('nrf-v0.27')).toThrow(/past the limit 0x93000/);
    // The same size passes the v0.04 limit (it fails later, on the stock comparison, not on the limit).
    expect(wideCheck('nrfb-v0.04')).not.toThrow(/past the limit/);
  });
});

describe('firmwareUpdate constants', () => {
  it.each(Object.values(UV5RMINI_BASES))(
    'keeps the windows of $name inside the area and the layout limit, sorted',
    (base) => {
      const w = base.windows;
      expect(w.every(([s, e]) => s < e && e <= base.areaEnd)).toBe(true);
      expect(base.areaEnd).toBeLessThanOrEqual(uv5rMiniHardLimit(base));
      expect(w.map((x) => x[0])).toEqual([...w.map((x) => x[0])].sort((a, b) => a - b));
    },
  );
  it('has one base per pinned stock file, with the same hash', () => {
    const pinned = stockVariants(UV5RMINI_STOCK_FIRMWARE).map((v) => v.members[0]!.sha256);
    expect(Object.values(UV5RMINI_BASES).map((b) => b.stockSha256)).toEqual(pinned);
  });
  it('keys each base by its own name', () => {
    for (const [key, b] of Object.entries(UV5RMINI_BASES)) expect(b.name).toBe(key);
  });
  it('compares only outside the windows', () => {
    const a = new Uint8Array(0x7c000 - 0x1000);
    const b = a.slice();
    b[0x4000 - 0x1000] = 1;
    expect(firstDifferenceOutsideWindows(a, b, V04)).toBe(-1);
    b[0x4004 - 0x1000] = 1;
    expect(firstDifferenceOutsideWindows(a, b, V04)).toBe(0x4004 - 0x1000);
  });
});
