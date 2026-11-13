import { describe, expect, it } from 'vitest';

import { stockVariants } from '@core/firmware/stockVariants.ts';
import { UV5RMINI_STOCK_FIRMWARE } from '@core/radios/baofeng/uv-5r-mini/firmware.ts';
import { uv5rMiniLayoutFromRadioInfo } from '@core/radios/baofeng/uv-5r-mini/radioInfo.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioConfirmRequiredError, RadioInterlockError } from '../../../kit/errors.ts';
import { makeSyntheticUfw, type SyntheticUfwOptions } from './__fixtures__/makeSyntheticUfw.ts';
import {
  UV5RMINI_BASES,
  UV5RMINI_FLASH_BASE,
  UV5RMINI_PINNED_LOADERS,
  UV5RMINI_RETIRED_LOADERS,
  uv5rMiniHardLimit,
  type LayoutPinnedLoader,
  type PinnedLoader,
  type Uv5rMiniBase,
  type Uv5rMiniLayout,
} from './constants.ts';
import {
  checkUv5rMiniImage,
  firstDifferenceOutsideWindows,
  isUv5rMiniToStockImage,
  UV5RMINI_OTHER_LAYOUT_REFUSAL,
  UV5RMINI_REINSTALL_WARNING,
  UV5RMINI_RETIRED_LOADER_REFUSAL,
} from './interlocks.ts';
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
    radioLayout?: string;
    radioBuild?: string;
    radioReported?: true;
    reinstallConfirmed?: true;
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
    radioLayout: o.radioLayout,
    radioBuild: o.radioBuild,
    radioReported: o.radioReported,
    reinstallConfirmed: o.reinstallConfirmed,
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

/** The fake loader pinned as a layout loader: no list, tied to `layout`. */
const layoutPin = (layout: Uv5rMiniLayout): LayoutPinnedLoader => ({
  label: `fake-${layout}`,
  sha256: FAKE_PACKED_SHA,
  layout,
  rawSize: 0,
  packedSize: stock.loader.length,
  layoutRecord: { vmOff: 0, vmSize: 0, hcrcVm: 0, hcrcPrct: 0, hcrcBtif: 0 },
});

describe('checkUv5rMiniImage — already installed, list-carrying loader', () => {
  it('refuses an image whose build is the one the radio names, ignoring case and spaces', () => {
    for (const reported of ['mm9pdy-test', '  MM9PDY-Test ', 'Mm9Pdy-TEST']) {
      refused(prepared({ radioBuild: reported }), /already installed; nothing was sent/);
    }
    refused(prepared({ radioBuild: 'mm9pdy-test' }), /already runs mm9pdy-test/);
  });

  it('refuses even with the confirm: that loader would write nothing', () => {
    refused(
      prepared({ radioBuild: 'mm9pdy-test', reinstallConfirmed: true }),
      /already installed; nothing was sent/,
    );
  });

  it('runs after the hard checks, so a hard refusal wins', () => {
    refused(
      prepared({ radioBuild: 'mm9pdy-test', base: 'no-such-base' }),
      /base is not one Studio knows/,
    );
  });

  it('accepts a different build, no build from the radio, or one that only contains the name', () => {
    check(prepared({ radioBuild: 'mm9pdy-other' }));
    check(prepared({ radioBuild: undefined }));
    check(prepared({ radioBuild: 'mm9pdy-test-2' }));
  });
});

describe('checkUv5rMiniImage — already installed, always-write layout loader', () => {
  const checkL1 = (o: Parameters<typeof prepared>[0]) => () =>
    checkUv5rMiniImage(prepared({ radioLayout: 'L1', ...o }), [layoutPin('L1')], bases);

  it("asks for a confirm, not a refusal, when the radio's build is the image, ignoring case and spaces", () => {
    for (const reported of ['mm9pdy-test', '  MM9PDY-Test ', 'Mm9Pdy-TEST']) {
      const run = checkL1({ radioBuild: reported });
      expect(run).toThrow(RadioConfirmRequiredError);
      expect(run).not.toThrow(RadioInterlockError);
      expect(run).toThrow(UV5RMINI_REINSTALL_WARNING('mm9pdy-test'));
    }
    expect(UV5RMINI_REINSTALL_WARNING('mm9pdy-L1-1.0.0')).toBe(
      'This radio already runs mm9pdy-L1-1.0.0. Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies.',
    );
  });

  it('accepts the same build once the operator has confirmed', () => {
    expect(checkL1({ radioBuild: 'mm9pdy-test', reinstallConfirmed: true })).not.toThrow();
  });

  it("asks for nothing when the radio's build differs or it gave none", () => {
    expect(checkL1({ radioBuild: 'mm9pdy-other' })).not.toThrow();
    expect(checkL1({ radioBuild: undefined })).not.toThrow();
  });

  it('runs after the hard checks: the confirm never lets a refused image through', () => {
    const f = flashWith([0x1000, stock.flash[0]! ^ 0xff]);
    expect(
      checkL1({ radioBuild: 'mm9pdy-test', reinstallConfirmed: true, ufw: { flash: f } }),
    ).toThrow(/outside the firmware's own area/);
    expect(checkL1({ radioBuild: 'mm9pdy-test', ufw: { flash: f } })).toThrow(RadioInterlockError);
    expect(checkL1({ radioBuild: 'mm9pdy-test', radioLayout: 'L2' })).toThrow(
      UV5RMINI_OTHER_LAYOUT_REFUSAL,
    );
  });

  it('asks the same for a to-stock image onto a radio already on that stock', () => {
    // The layout is known and the radio names no MM9PDY build: it may run stock.
    const run = checkL1({ stamp: 'nrfb-v0.04', radioBuild: undefined });
    expect(run).toThrow(RadioConfirmRequiredError);
    expect(run).toThrow(
      'Studio sees no MM9PDY build on this radio, so it may already run the stock nrfb-v0.04. Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies.',
    );
    expect(checkL1({ stamp: 'nrfb-v0.04', radioBuild: 'NRFB-v0.04 ' })).toThrow(
      RadioConfirmRequiredError,
    );
    expect(checkL1({ stamp: 'nrfb-v0.04', reinstallConfirmed: true })).not.toThrow();
  });

  it('only says the radio may run the stock when it names no build', () => {
    // A radio with no radio report answers Radio Info; Firmware V0.04 resolves to layout 1, so the nrfb-v0.04
    // to-stock file fits it. An MM9PDY build from before the report names no build either, so it says only "may".
    const answer = uv5rMiniLayoutFromRadioInfo({ firmware: 'V0.04', hardware: 'V1.7' });
    expect(answer).toEqual({ kind: 'layout', layout: 'L1' });
    const run = checkL1({ stamp: 'nrfb-v0.04', radioLayout: 'L1', radioBuild: undefined });
    expect(run).toThrow(RadioConfirmRequiredError);
    expect(run).toThrow(/so it may already run the stock nrfb-v0\.04\./);
    expect(run).not.toThrow(/already runs the stock/);
    expect(checkL1({ stamp: 'nrfb-v0.04', reinstallConfirmed: true })).not.toThrow();
  });

  it('asks nothing for a to-stock image onto a radio that shows a modded build', () => {
    expect(checkL1({ stamp: 'nrfb-v0.04', radioBuild: 'mm9pdy-L1-1.0.0' })).not.toThrow();
  });

  it('asks nothing for a to-stock image onto a radio whose report names no build', () => {
    // A report means an MM9PDY build, so the radio can't already run the stock.
    expect(
      checkL1({ stamp: 'nrfb-v0.04', radioBuild: undefined, radioReported: true }),
    ).not.toThrow();
  });
});

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

describe('checkUv5rMiniImage — layout loaders', () => {
  const checkWith = (layout: Uv5rMiniLayout, img: PreparedFirmwareImage) => () =>
    checkUv5rMiniImage(img, [layoutPin(layout)], bases);

  it("accepts an image whose loader is for the radio's layout", () => {
    expect(checkWith('L1', prepared({ radioLayout: 'L1' }))).not.toThrow();
    expect(checkWith('L2', prepared({ radioLayout: 'L2' }))).not.toThrow();
  });

  it('refuses an L1 file for a layout-2 radio and an L2 file for a layout-1 radio', () => {
    for (const [loader, radio] of [
      ['L1', 'L2'],
      ['L2', 'L1'],
    ] as const) {
      const run = checkWith(loader, prepared({ radioLayout: radio }));
      expect(run).toThrow(RadioInterlockError);
      expect(run).toThrow(UV5RMINI_OTHER_LAYOUT_REFUSAL);
    }
    expect(UV5RMINI_OTHER_LAYOUT_REFUSAL).toBe(
      'This file is for the other flash layout; nothing was sent.',
    );
  });

  it("refuses a layout loader's image when Studio does not know the radio's layout", () => {
    expect(checkWith('L2', prepared())).toThrow(/doesn't know this radio's flash layout/);
    expect(checkWith('L2', prepared({ radioLayout: 'L3' }))).toThrow(UV5RMINI_OTHER_LAYOUT_REFUSAL);
  });

  it('checks the layout before the area and the stock bytes', () => {
    const f = flashWith([0x1000, stock.flash[0]! ^ 0xff]);
    expect(checkWith('L1', prepared({ ufw: { flash: f }, radioLayout: 'L2' }))).toThrow(
      UV5RMINI_OTHER_LAYOUT_REFUSAL,
    );
  });

  it('does not apply I7: a layout loader has no list', () => {
    expect(
      checkWith('L1', prepared({ stamp: 'nrfb-v0.04', radioLayout: 'L1', radioBuild: 'mm9pdy-x' })),
    ).not.toThrow();
  });

  it('a list-carrying loader ignores the radio layout', () => {
    check(prepared({ radioLayout: 'L2' }));
    check(prepared());
  });
});

describe('UV5RMINI_PINNED_LOADERS', () => {
  it('pins the two always-write layout loaders exactly, one per layout, with no list', () => {
    const byLabel = (l: string) => UV5RMINI_PINNED_LOADERS.find((p) => p.label === l);
    expect(byLabel('L1')).toMatchObject({
      sha256: 'b314ace5106ed3b5ec67846b38d7bf8e65415824343b24650622efb8bdc604dd',
      layout: 'L1',
      rawSize: 17_904,
      packedSize: 15_648,
      layoutRecord: {
        vmOff: 0x95000,
        vmSize: 0x68000,
        hcrcVm: 0x06d9,
        hcrcPrct: 0xd9bb,
        hcrcBtif: 0xf13a,
      },
    });
    expect(byLabel('L2')).toMatchObject({
      sha256: '1e6c3e0d563a50f38caa2972c773ccdff99aa875c1e9098cc923be1cb5b6193e',
      layout: 'L2',
      rawSize: 17_904,
      packedSize: 15_648,
      layoutRecord: {
        vmOff: 0x94000,
        vmSize: 0x6a000,
        hcrcVm: 0x2074,
        hcrcPrct: 0x48f9,
        hcrcBtif: 0xf13a,
      },
    });
    expect(byLabel('L1')?.lists).toBeUndefined();
    expect(byLabel('L2')?.lists).toBeUndefined();
  });

  it('keeps every list-carrying pin without a layout', () => {
    const listed = UV5RMINI_PINNED_LOADERS.filter((p) => p.lists !== undefined);
    expect(listed.map((p) => p.label)).toEqual(['stock', 'stock+c4', 'stock+c4+w1']);
    expect(listed.every((p) => p.layout === undefined)).toBe(true);
  });

  it('pins stock+c4+w1 with its packed hash and the three builds it lists', () => {
    const w1 = UV5RMINI_PINNED_LOADERS.find((p) => p.label === 'stock+c4+w1');
    expect(w1?.sha256).toBe('3ec9a37db41f98bcf9e2b2a75200fd3450ac48807860470f5ca11b08a11724e8');
    expect(w1?.lists).toEqual(['nrfb-v0.04', 'mm9pdy-0.1.0-rc.1', 'mm9pdy-pr125-g1c0a9df']);
  });

  it('pins five distinct loaders, and an unknown hash is in none of them', () => {
    const hashes = UV5RMINI_PINNED_LOADERS.map((p) => p.sha256);
    expect(new Set(hashes).size).toBe(5);
    expect(hashes).not.toContain(FAKE_PACKED_SHA);
  });

  it('drops the first layout loaders, which write nothing for the installed build', () => {
    const retired = [
      'b748e39af6caa7968a7eb74099e35dce0714876a0949a70d9279adc870ed7e09',
      '2f1b8999ea6dcc858ef076b20564e0339c1fb665add46efdafc4bd40222aadae',
    ];
    expect(UV5RMINI_RETIRED_LOADERS.map((r) => r.sha256)).toEqual(retired);
    const pinned = UV5RMINI_PINNED_LOADERS.map((p) => p.sha256);
    for (const h of retired) expect(pinned).not.toContain(h);
  });
});

describe('checkUv5rMiniImage — retired loaders', () => {
  it('refuses an image built with a retired loader, saying to use a newer build', () => {
    const retired = [{ label: 'L1-nolist-v1', sha256: FAKE_PACKED_SHA }];
    // The production pins, with the fake loader standing in for a retired one.
    expect(UV5RMINI_RETIRED_LOADER_REFUSAL).toBe(
      'This image was built with an older loader that Studio no longer sends. Use a newer build of this firmware. Nothing was sent.',
    );
    const img = prepared({ radioLayout: 'L1' });
    const run = () => checkUv5rMiniImage(img, UV5RMINI_PINNED_LOADERS, bases, retired);
    expect(run).toThrow(RadioInterlockError);
    expect(run).toThrow(UV5RMINI_RETIRED_LOADER_REFUSAL);
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

describe('checkUv5rMiniImage — always short, for an always-write layout loader', () => {
  // The loader erases from the start of the firmware area to the image's end, so the image must end at the area end:
  // longer reaches past the firmware (I3), shorter or longer than the stock is refused (I4).
  const run = (flash: Uint8Array) => () =>
    checkUv5rMiniImage(
      prepared({
        ufw: { flash },
        radioLayout: 'L1',
        radioBuild: 'mm9pdy-test',
        reinstallConfirmed: true,
      }),
      [layoutPin('L1')],
      bases,
    );

  it('accepts an image that ends exactly at the area end', () => {
    expect(UV5RMINI_FLASH_BASE + stock.flash.length).toBe(V04.areaEnd);
    expect(run(stock.flash)).not.toThrow();
  });

  it('refuses one that runs past the area end', () => {
    const long = makeSyntheticUfw({ flashSize: FLASH_SIZE + 0x1000, loader: stock.loader });
    expect(run(long.flash)).toThrow(/past the end of the firmware area 0x7C000/);
  });

  it('refuses one that ends short of the area end', () => {
    expect(run(stock.flash.subarray(0, stock.flash.length - 0x1000))).toThrow(
      /bytes where the stock is/,
    );
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
  });
});

describe('checkUv5rMiniImage — to stock', () => {
  /** A radio running a modded build (so a to-stock image is not "already installed"). */
  const MODDED = 'mm9pdy-L1-1.0.0';
  /**
   * A to-stock image: build name = base name, flash identical to the stock, the base's own layout loader, for a radio
   * that shows a modded build.
   */
  const toStock = (o: Parameters<typeof prepared>[0] & { layout?: Uv5rMiniLayout } = {}) => {
    const base = o.base ?? 'nrfb-v0.04';
    const layout = o.layout ?? bases[base]!.loaderLayout;
    return () =>
      checkUv5rMiniImage(
        prepared({ stamp: base, radioLayout: layout, radioBuild: MODDED, ...o, base }),
        [layoutPin(layout)],
        bases,
      );
  };

  it('recognises a to-stock image by its build name alone', () => {
    expect(isUv5rMiniToStockImage({ versionStamp: 'nrfb-v0.04' })).toBe(true);
    expect(isUv5rMiniToStockImage({ versionStamp: 'nrf-v0.27' })).toBe(true);
    expect(isUv5rMiniToStockImage({ versionStamp: 'mm9pdy-L1-1.0.0' })).toBe(false);
    expect(isUv5rMiniToStockImage({ versionStamp: 'toString' })).toBe(false);
    expect(isUv5rMiniToStockImage({ versionStamp: undefined })).toBe(false);
  });

  it('accepts the stock flash with the base layout loader, on each base', () => {
    expect(toStock({ base: 'nrfb-v0.04' })).not.toThrow();
    expect(toStock({ base: 'nrf-v0.27' })).not.toThrow();
  });

  it('maps v0.04 to the L1 loader and v0.27 to the L2 loader', () => {
    expect(UV5RMINI_BASES['nrfb-v0.04']!.loaderLayout).toBe('L1');
    expect(UV5RMINI_BASES['nrf-v0.27']!.loaderLayout).toBe('L2');
  });

  it('refuses a list-carrying loader, even one that does not list the stock', () => {
    const img = prepared({ stamp: 'nrfb-v0.04', radioLayout: 'L1' });
    const unlisted: PinnedLoader[] = [{ label: 'old', sha256: FAKE_PACKED_SHA, lists: ['x'] }];
    for (const p of [pins, unlisted]) {
      expect(() => checkUv5rMiniImage(img, p, bases)).toThrow(RadioInterlockError);
      expect(() => checkUv5rMiniImage(img, p, bases)).toThrow(/carries an older loader/);
    }
  });

  it("refuses the other layout's loader for the base", () => {
    expect(toStock({ base: 'nrfb-v0.04', layout: 'L2' })).toThrow(
      /for nrfb-v0.04 carries the L2 loader, not that stock's L1 loader/,
    );
    expect(toStock({ base: 'nrf-v0.27', layout: 'L1' })).toThrow(
      /for nrf-v0.27 carries the L1 loader, not that stock's L2 loader/,
    );
  });

  it('refuses a build name that is another base than the one it is built on', () => {
    expect(toStock({ base: 'nrfb-v0.04', stamp: 'nrf-v0.27' })).toThrow(
      /puts back the stock nrf-v0.27, but it is built on nrfb-v0.04/,
    );
  });

  it.each<[string, number]>([
    ['the first byte', 0x1000],
    ['the version word window', 0x4000],
    ['the second small window', 0x4020],
    ['the app window', 0x4100],
    ['the end of the app window', 0x7be1b],
    ['the last byte', 0x7bfff],
  ])('refuses any change to the stock flash, at %s', (_n, addr) => {
    const f = flashWith([addr, stock.flash[addr - UV5RMINI_FLASH_BASE]! ^ 0xff]);
    const run = toStock({ ufw: { flash: f } });
    expect(run).toThrow(RadioInterlockError);
    expect(run).toThrow(
      new RegExp(`changes the stock at 0x${addr.toString(16).toUpperCase()}, so it would not`),
    );
  });

  it("refuses when the radio's layout is another, or unknown", () => {
    expect(toStock({ radioLayout: 'L2' })).toThrow(UV5RMINI_OTHER_LAYOUT_REFUSAL);
    expect(toStock({ radioLayout: undefined })).toThrow(/doesn't know this radio's flash layout/);
  });

  it('a modded build is not held to the to-stock rule', () => {
    const f = flashWith([0x4100, 1]);
    expect(() =>
      checkUv5rMiniImage(
        prepared({ ufw: { flash: f }, stamp: 'mm9pdy-L1-1.0.0', radioLayout: 'L1' }),
        [layoutPin('L1')],
        bases,
      ),
    ).not.toThrow();
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
  it("names each base as the stock descriptor does, so a to-stock patch's title finds its stock", () => {
    const named = stockVariants(UV5RMINI_STOCK_FIRMWARE).map((v) => v.baseName);
    expect(Object.keys(UV5RMINI_BASES)).toEqual(named);
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
