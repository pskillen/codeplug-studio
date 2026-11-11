import { describe, expect, it } from 'vitest';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { makeSyntheticUfw, type SyntheticUfwOptions } from './__fixtures__/makeSyntheticUfw.ts';
import { UV5RMINI_BASE, UV5RMINI_FLASH_BASE, type PinnedLoader } from './constants.ts';
import { checkUv5rMiniImage, firstDifferenceOutsideWindows } from './interlocks.ts';
import { sha256HexSync } from './sha256Sync.ts';

const FLASH_SIZE = 0x7c000 - 0x1000; // fills the area exactly
const stock = makeSyntheticUfw({ flashSize: FLASH_SIZE, flashSeed: 10, loaderSeed: 20 });
const FAKE_PACKED_SHA = sha256HexSync(stock.loader);
const pins: PinnedLoader[] = [
  { label: 'fake', sha256: FAKE_PACKED_SHA, lists: ['nrfb-v0.04', 'listed-build'] },
];

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
    title: 'synthetic',
    versionStamp: 'stamp' in o ? o.stamp : 'mm9pdy-test',
    package: { radioId, files },
    stockPackage: o.noStock ? undefined : { radioId, files: { ufw: stock.bytes } },
    sha256: {},
    verifyHint: '',
  } as unknown as PreparedFirmwareImage;
}

const check = (img: PreparedFirmwareImage) => checkUv5rMiniImage(img, pins);
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
    expect(() => checkUv5rMiniImage(prepared())).toThrow(/loader is not one Studio knows/);
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
    refused(prepared({ ufw: { flash: big.flash } }), /past the limit 0x94000/);
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

describe('firmwareUpdate constants', () => {
  it('keeps the windows inside the area and sorted', () => {
    const w = UV5RMINI_BASE.windows;
    expect(w.every(([s, e]) => s < e && e <= UV5RMINI_BASE.areaEnd)).toBe(true);
    expect(w.map((x) => x[0])).toEqual([...w.map((x) => x[0])].sort((a, b) => a - b));
  });
  it('compares only outside the windows', () => {
    const a = new Uint8Array(0x7c000 - 0x1000);
    const b = a.slice();
    b[0x4000 - 0x1000] = 1;
    expect(firstDifferenceOutsideWindows(a, b, UV5RMINI_BASE)).toBe(-1);
    b[0x4004 - 0x1000] = 1;
    expect(firstDifferenceOutsideWindows(a, b, UV5RMINI_BASE)).toBe(0x4004 - 0x1000);
  });
});
