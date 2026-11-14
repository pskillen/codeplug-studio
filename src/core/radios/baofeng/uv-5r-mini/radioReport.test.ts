import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  fromHex,
  L1_VM,
  L2_VM,
  RADIO_REPORT_EXAMPLE_HEX,
  radioReportFrame,
  withCrc,
} from './__fixtures__/radioReportFrame.ts';
import {
  crc16Xmodem,
  decodeUv5rMiniRadioReport,
  UV5RMINI_BAD_REPORT_REFUSAL,
  UV5RMINI_RADIO_REPORT_ADDRESS,
  UV5RMINI_RADIO_REPORT_FORMAT,
  UV5RMINI_UNKNOWN_FORMAT_REFUSAL,
  UV5RMINI_UNKNOWN_LAYOUT_REFUSAL,
  uv5rMiniLayoutFromReport,
} from './radioReport.ts';
import {
  UV5RMINI_FIRMWARE_OPTIONS,
  UV5RMINI_RADIO_INFO_OTHER,
  UV5RMINI_SUFFIX_OPTIONS,
  uv5rMiniLayoutFromRadioInfo,
} from './radioInfo.ts';
import {
  UV5RMINI_NO_BUILD_FOR_RADIO,
  UV5RMINI_PROVEN_HARDWARE,
  UV5RMINI_RADIO_INFO_REFUSAL,
  UV5RMINI_STOCK_BASE_KEYS,
} from './stockBases.ts';

const example = () => fromHex(RADIO_REPORT_EXAMPLE_HEX);
const decode = decodeUv5rMiniRadioReport;
const invalid = (reason: string) => ({ kind: 'invalid', reason });

/** Edit the example, then set its CRC right, so only the edited field differs. */
const edited = (edit: (b: Uint8Array) => void) => {
  const b = example();
  edit(b);
  return withCrc(b);
};

describe('crc16Xmodem', () => {
  it('matches the CRC-16/XMODEM check value', () => {
    expect(crc16Xmodem(new TextEncoder().encode('123456789'))).toBe(0x31c3);
  });
});

describe('decodeUv5rMiniRadioReport', () => {
  it('reads format 2 at 0xEFC0', () => {
    expect(UV5RMINI_RADIO_REPORT_ADDRESS).toBe(0xefc0);
    expect(UV5RMINI_RADIO_REPORT_FORMAT).toBe(2);
  });

  it('decodes the test vector: L2, NRF / V0.27 / V1.7, register 0 0x1234, the build name', () => {
    expect(decode(example())).toEqual({
      kind: 'report',
      layout: 'L2',
      suffix: 'NRF',
      version: 'V0.27',
      hardware: 'V1.7',
      flags: 0,
      vmStart: 0x94000,
      vmSize: 0x6a000,
      vmBank0: 0x94000,
      rf0: 0x1234,
      name: 'mm9pdy-L2-0.2.0-rc.1',
    });
  });

  it('the fixture builder makes the test vector by default', () => {
    expect(radioReportFrame()).toEqual(example());
  });

  it('decodes an L1 frame on NRFB / V0.04 / V1.7 with bit 0 set', () => {
    expect(decode(radioReportFrame({ vm: L1_VM, suffix: 'NRFB', version: 'V0.04' }))).toMatchObject(
      {
        kind: 'report',
        layout: 'L1',
        suffix: 'NRFB',
        version: 'V0.04',
        hardware: 'V1.7',
        flags: 1,
      },
    );
  });

  it('reads a string without its trailing NULs and spaces, and compares it exactly', () => {
    expect(decode(radioReportFrame({ hardware: 'V1.7\0' }))).toMatchObject({ hardware: 'V1.7' });
    expect(decode(radioReportFrame({ suffix: 'nrf' }))).toMatchObject({ suffix: 'nrf' });
    // Spaces inside a string are kept.
    expect(decode(radioReportFrame({ version: 'V 0.2' }))).toMatchObject({ version: 'V 0.2' });
  });

  describe('the rules, in order', () => {
    it('1: refuses a read that is not 64 bytes', () => {
      expect(decode(example().subarray(0, 63))).toEqual(invalid('the read was 63 bytes, not 64'));
      expect(decode(new Uint8Array(65))).toEqual(invalid('the read was 65 bytes, not 64'));
    });

    it('2: treats no magic as stock (erased flash, zeros)', () => {
      expect(decode(new Uint8Array(64).fill(0xff))).toEqual({ kind: 'stock', reason: 'magic' });
      expect(decode(new Uint8Array(64))).toEqual({ kind: 'stock', reason: 'magic' });
      expect(decode(edited((b) => (b[3] = 0x53)))).toEqual({ kind: 'stock', reason: 'magic' });
    });

    it('3: treats a bad CRC as stock', () => {
      const b = example();
      b[0x3e] ^= 0x01;
      expect(decode(b)).toEqual({ kind: 'stock', reason: 'crc' });
      // A changed field with the old CRC is a bad CRC too.
      const c = example();
      c[0x30] = 0x58;
      expect(decode(c)).toEqual({ kind: 'stock', reason: 'crc' });
    });

    it('4: names any format but 2, format 1 included, and reads nothing past it', () => {
      expect(decode(radioReportFrame({ format: 1 }))).toEqual({ kind: 'unknownFormat', format: 1 });
      expect(decode(radioReportFrame({ format: 3, flags: 0xff, vm: [0, 0] }))).toEqual({
        kind: 'unknownFormat',
        format: 3,
      });
    });

    it('5: refuses a reserved flags bit', () => {
      for (const flags of [0x02, 0x80, 0x03]) {
        expect(decode(radioReportFrame({ flags }))).toEqual(invalid('a reserved flags bit is set'));
      }
    });

    it('6: refuses an empty, all-space or unprintable string, naming which', () => {
      expect(decode(radioReportFrame({ suffix: new Uint8Array(4) }))).toEqual(
        invalid('its suffix string is unreadable'),
      );
      expect(decode(radioReportFrame({ version: '     ' }))).toEqual(
        invalid('its Firmware string is unreadable'),
      );
      expect(decode(radioReportFrame({ hardware: Uint8Array.of(0x56, 0x31, 0x7f, 0x37) }))).toEqual(
        invalid('its Hardware string is unreadable'),
      );
      // A NUL inside the string, not trailing, is unprintable.
      expect(decode(radioReportFrame({ suffix: Uint8Array.of(0x4e, 0, 0x52, 0x46) }))).toEqual(
        invalid('its suffix string is unreadable'),
      );
      expect(
        decode(radioReportFrame({ version: Uint8Array.of(0x56, 0xb0, 0x2e, 0x32, 0x37) })),
      ).toEqual(invalid('its Firmware string is unreadable'));
    });

    it('7: refuses bit 0 disagreeing with the strings, either way', () => {
      const DISAGREES = invalid(
        'its NRFB V0.04 flag disagrees with its suffix, Firmware and Hardware strings',
      );
      // Set, but the strings are not NRFB / V0.04 / V1.7.
      expect(decode(radioReportFrame({ flags: 1 }))).toEqual(DISAGREES);
      expect(
        decode(radioReportFrame({ flags: 1, suffix: 'NRFB', version: 'V0.04', hardware: 'V1.8 ' })),
      ).toEqual(DISAGREES);
      // Clear, but they are.
      expect(
        decode(radioReportFrame({ flags: 0, vm: L1_VM, suffix: 'NRFB', version: 'V0.04' })),
      ).toEqual(DISAGREES);
    });

    it('8: names any other VM pair as an unknown layout', () => {
      for (const vm of [
        [0x95000, 0x6a000], // L1 start with L2 size
        [0x94000, 0x68000], // L2 start with L1 size
        [0x96000, 0x66000],
        [0, 0],
      ] as const) {
        expect(decode(radioReportFrame({ vm }))).toEqual({
          kind: 'unknownLayout',
          vmStart: vm[0],
          vmSize: vm[1],
          name: 'mm9pdy-L2-0.2.0-rc.1',
        });
      }
    });
  });

  it('returns vm_bank0 as read when it differs, and still decides on the pair', () => {
    expect(decode(radioReportFrame({ bank0: 0x95000 }))).toMatchObject({
      kind: 'report',
      layout: 'L2',
      vmStart: 0x94000,
      vmBank0: 0x95000,
    });
  });

  it('decides nothing on the reserved bytes', () => {
    const r = decode(
      edited((b) => {
        b.set([0xaa, 0x55], 0x06);
        b.set([0x12, 0x34], 0x16);
      }),
    );
    expect(r).toEqual(decode(example()));
  });
});

describe('uv5rMiniLayoutFromReport', () => {
  const answer = (b: Uint8Array) => uv5rMiniLayoutFromReport(decodeUv5rMiniRadioReport(b));

  it('asks the Radio Info question for a stock radio', () => {
    expect(answer(new Uint8Array(64).fill(0xff))).toBeNull();
  });

  it('refuses a broken report with its reason, and names an unknown format', () => {
    expect(answer(radioReportFrame({ flags: 0x02 }))).toEqual({
      kind: 'refused',
      message: UV5RMINI_BAD_REPORT_REFUSAL('a reserved flags bit is set'),
    });
    expect(UV5RMINI_BAD_REPORT_REFUSAL('a reserved flags bit is set')).toBe(
      "This radio's MM9PDY report doesn't read right: a reserved flags bit is set. Nothing was sent.",
    );
    expect(answer(radioReportFrame({ format: 1 }))).toEqual({
      kind: 'refused',
      message: UV5RMINI_UNKNOWN_FORMAT_REFUSAL(1),
    });
  });

  it('blames the older side for an unknown format: the radio below format 2, Studio above it', () => {
    for (const format of [0, 1]) {
      expect(UV5RMINI_UNKNOWN_FORMAT_REFUSAL(format)).toBe(
        `This radio's MM9PDY build is older than this version of Studio: it answers in report format ${format}, and Studio reads format 2. Nothing was sent.`,
      );
      expect(UV5RMINI_UNKNOWN_FORMAT_REFUSAL(format)).not.toMatch(/update Studio/);
    }
    for (const format of [3, 255]) {
      expect(UV5RMINI_UNKNOWN_FORMAT_REFUSAL(format)).toBe(
        `This radio's MM9PDY build answers in report format ${format}, which this version of Studio doesn't know. Nothing was sent; update Studio and try again.`,
      );
    }
  });

  it('refuses an unknown pair', () => {
    expect(answer(radioReportFrame({ vm: [0x96000, 0x66000] }))).toEqual({
      kind: 'refused',
      message: UV5RMINI_UNKNOWN_LAYOUT_REFUSAL,
      detail: 'VM entry at 0x96000, 0x66000 bytes: no flash layout Studio knows.',
    });
    // The words a user sees name no layout (#1670); the detail is shown only with developer mode on.
    expect(UV5RMINI_UNKNOWN_LAYOUT_REFUSAL).toBe(
      "This radio reports firmware Studio doesn't support. Nothing was sent.",
    );
  });

  it('marks an empty-named report as reported, with no build', () => {
    const r = answer(radioReportFrame({ name: '' }));
    expect(r).toMatchObject({ kind: 'layout', layout: 'L2', reported: true });
    expect(r).not.toHaveProperty('build');
  });

  it('reports a vm_bank0 mismatch and keeps the pair', () => {
    const r = answer(radioReportFrame({ bank0: 0x95000 }));
    expect(r).toMatchObject({ kind: 'layout', layout: 'L2' });
    expect(r && r.kind === 'layout' ? r.details?.at(-1) : '').toBe(
      "The radio's settings store starts at 0x95000, not at its VM entry 0x94000. Studio goes by the VM entry.",
    );
  });
});

describe('uv5rMiniLayoutFromReport: the stock base from the shared table', () => {
  const answer = (b: Uint8Array) => uv5rMiniLayoutFromReport(decodeUv5rMiniRadioReport(b));
  const VM = { L1: L1_VM, L2: L2_VM } as const;

  it('NRF / V0.27 / V1.7 on L2 is nrf-v0.27, with the strings, layout, build and RF chip shown', () => {
    expect(answer(radioReportFrame())).toEqual({
      kind: 'layout',
      layout: 'L2',
      build: 'mm9pdy-L2-0.2.0-rc.1',
      reported: true,
      codeBase: 'nrf-v0.27',
      details: [
        'MM9PDY build: mm9pdy-L2-0.2.0-rc.1',
        'Suffix: NRF',
        'Firmware: V0.27',
        'Hardware: V1.7',
        'Code base: nrf-v0.27',
        'RF chip register 0: 0x1234',
      ],
    });
  });

  it('NRFB / V0.04 / V1.7 on L1 is nrfb-v0.04', () => {
    expect(answer(radioReportFrame({ vm: L1_VM, suffix: 'NRFB', version: 'V0.04' }))).toMatchObject(
      { kind: 'layout', layout: 'L1', codeBase: 'nrfb-v0.04' },
    );
  });

  it('keeps the reported layout: NRF / V0.27 on L1 is nrf-v0.27 on L1, for Prepare to match a file on both', () => {
    expect(answer(radioReportFrame({ vm: L1_VM, name: 'mm9pdy-L1-0.2.0' }))).toMatchObject({
      kind: 'layout',
      layout: 'L1',
      codeBase: 'nrf-v0.27',
    });
  });

  it('refuses a combination with no base as having no build, never the nearest one', () => {
    expect(answer(radioReportFrame({ suffix: 'NRFB' }))).toEqual({
      kind: 'refused',
      message: UV5RMINI_NO_BUILD_FOR_RADIO('NRFB', 'V0.27'),
    });
    expect(answer(radioReportFrame({ version: 'V0.04' }))).toEqual({
      kind: 'refused',
      message: UV5RMINI_NO_BUILD_FOR_RADIO('NRF', 'V0.04'),
    });
    // Compared exactly: the radio's own strings are never loosened.
    expect(answer(radioReportFrame({ suffix: 'nrf' }))).toEqual({
      kind: 'refused',
      message: UV5RMINI_NO_BUILD_FOR_RADIO('nrf', 'V0.27'),
    });
  });

  it('refuses a Hardware string not proven, with the Radio Info refusal', () => {
    for (const hardware of ['V1.8 ', 'V1.6', 'v1.7']) {
      expect(answer(radioReportFrame({ hardware }))).toEqual({
        kind: 'refused',
        message: UV5RMINI_RADIO_INFO_REFUSAL,
      });
    }
  });

  it('gives the Radio Info answer for every combination in the table: one table, not two', () => {
    expect(UV5RMINI_STOCK_BASE_KEYS.length).toBeGreaterThan(0);
    const combos: (readonly [string, string, string])[] = [];
    for (const [suffix, firmware] of UV5RMINI_STOCK_BASE_KEYS) {
      for (const hardware of [...UV5RMINI_PROVEN_HARDWARE, 'V1.8']) {
        combos.push([suffix, firmware, hardware]);
      }
    }
    // Pairs crossed from the table's suffixes and Firmware lines, which have no base.
    for (const [suffix] of UV5RMINI_STOCK_BASE_KEYS) {
      for (const [, firmware] of UV5RMINI_STOCK_BASE_KEYS) {
        combos.push([suffix, firmware, 'V1.7']);
      }
    }
    // Every pair the Radio Info dropdowns offer, so a base added to one path only is caught.
    for (const suffix of UV5RMINI_SUFFIX_OPTIONS) {
      for (const firmware of UV5RMINI_FIRMWARE_OPTIONS) {
        if (suffix === UV5RMINI_RADIO_INFO_OTHER || firmware === UV5RMINI_RADIO_INFO_OTHER)
          continue;
        for (const hardware of [...UV5RMINI_PROVEN_HARDWARE, 'V1.8']) {
          combos.push([suffix, firmware, hardware]);
        }
      }
    }
    for (const [suffix, firmware, hardware] of combos) {
      const info = uv5rMiniLayoutFromRadioInfo({ firmware, suffix, hardware });
      const layout = info.kind === 'layout' ? (info.layout as 'L1' | 'L2') : 'L2';
      const reported = answer(
        radioReportFrame({ vm: VM[layout], suffix, version: firmware, hardware: `${hardware} ` }),
      );
      if (info.kind === 'layout') {
        expect(reported, `${suffix} ${firmware} ${hardware}`).toMatchObject({
          kind: 'layout',
          layout: info.layout,
          codeBase: info.codeBase,
        });
      } else {
        expect(reported, `${suffix} ${firmware} ${hardware}`).toEqual(info);
      }
    }
  });

  it('names each stock base key in the shared table only', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcRoot = join(here, '../../../..');
    const sources: { rel: string; text: string }[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          sources.push({
            rel: relative(srcRoot, full).split(sep).join('/'),
            text: readFileSync(full, 'utf8'),
          });
        }
      }
    };
    walk(srcRoot);
    for (const [suffix, firmware] of UV5RMINI_STOCK_BASE_KEYS) {
      const key = `${suffix} ${firmware}`;
      const holders = sources
        .filter((s) => s.text.includes(`'${key}'`) || s.text.includes(`"${key}"`))
        .map((s) => s.rel);
      expect(holders, key).toEqual(['core/radios/baofeng/uv-5r-mini/stockBases.ts']);
    }
  });
});
