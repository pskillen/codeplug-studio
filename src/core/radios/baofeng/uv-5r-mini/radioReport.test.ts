import { describe, expect, it } from 'vitest';

import {
  crc16Xmodem,
  decodeUv5rMiniRadioReport,
  UV5RMINI_RADIO_REPORT_ADDRESS,
  UV5RMINI_UNKNOWN_FORMAT_REFUSAL,
  UV5RMINI_UNKNOWN_LAYOUT_REFUSAL,
  uv5rMiniLayoutFromReport,
} from './radioReport.ts';

/**
 * The firmware project's example block, as it looks decoded: made up (an L2 build, register 0 0x1234), so it is
 * public-safe.
 */
const EXAMPLE_HEX =
  '4d4d3952010000000040090000a0060000400900341200006d6d397064792d4c322d302e322e302d72632e31000000000000000000000000000000000000cf95';

const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const example = () => fromHex(EXAMPLE_HEX);

const putU32 = (b: Uint8Array, at: number, v: number) => {
  for (let i = 0; i < 4; i++) b[at + i] = (v >>> (8 * i)) & 0xff;
};

/** Edit a block, then set its CRC right, so only the edited field differs. */
function edited(edit: (b: Uint8Array) => void): Uint8Array {
  const b = example();
  edit(b);
  const crc = crc16Xmodem(b.subarray(0, 0x3e));
  b[0x3e] = crc & 0xff;
  b[0x3f] = crc >> 8;
  return b;
}

const asL1 = (b: Uint8Array) => {
  putU32(b, 0x08, 0x95000);
  putU32(b, 0x0c, 0x68000);
  putU32(b, 0x10, 0x95000);
};

describe('crc16Xmodem', () => {
  it('matches the CRC-16/XMODEM check value', () => {
    expect(crc16Xmodem(new TextEncoder().encode('123456789'))).toBe(0x31c3);
  });
});

describe('decodeUv5rMiniRadioReport', () => {
  it('reads the frame at 0xEFC0', () => {
    expect(UV5RMINI_RADIO_REPORT_ADDRESS).toBe(0xefc0);
  });

  it('decodes the example block: an L2 build on the v0.27 code base', () => {
    expect(decodeUv5rMiniRadioReport(example())).toEqual({
      kind: 'report',
      layout: 'L2',
      codeBase: 'nrf-v0.27',
      flags: 0,
      vmStart: 0x94000,
      vmSize: 0x6a000,
      vmBank0: 0x94000,
      rf0: 0x1234,
      name: 'mm9pdy-L2-0.2.0-rc.1',
    });
  });

  it('decodes an L1 block, and flags bit 0 as the v0.04 code base', () => {
    const r = decodeUv5rMiniRadioReport(
      edited((b) => {
        asL1(b);
        b[5] = 0x01;
      }),
    );
    expect(r).toMatchObject({ kind: 'report', layout: 'L1', codeBase: 'nrfb-v0.04', flags: 1 });
  });

  it('treats a bad CRC as stock', () => {
    const b = example();
    b[0x3e] ^= 0x01;
    expect(decodeUv5rMiniRadioReport(b)).toEqual({ kind: 'stock', reason: 'crc' });
    // A changed field with the old CRC is a bad CRC too.
    const c = example();
    c[0x14] = 0x35;
    expect(decodeUv5rMiniRadioReport(c)).toEqual({ kind: 'stock', reason: 'crc' });
  });

  it('treats erased flash (all FF) and all zeros as stock', () => {
    expect(decodeUv5rMiniRadioReport(new Uint8Array(64).fill(0xff))).toEqual({
      kind: 'stock',
      reason: 'magic',
    });
    expect(decodeUv5rMiniRadioReport(new Uint8Array(64))).toEqual({
      kind: 'stock',
      reason: 'magic',
    });
  });

  it('treats a short read as stock', () => {
    expect(decodeUv5rMiniRadioReport(example().subarray(0, 63))).toEqual({
      kind: 'stock',
      reason: 'length',
    });
  });

  it('names an unknown format and reads nothing past the first six bytes', () => {
    const r = decodeUv5rMiniRadioReport(
      edited((b) => {
        b[4] = 2;
        putU32(b, 0x08, 0x12345); // would be an unknown layout in format 1
      }),
    );
    expect(r).toEqual({ kind: 'unknownFormat', format: 2 });
  });

  it('refuses any other VM pair as an unknown layout', () => {
    for (const [start, size] of [
      [0x95000, 0x6a000], // L1 start with L2 size
      [0x94000, 0x68000], // L2 start with L1 size
      [0x96000, 0x66000],
      [0, 0],
    ] as const) {
      const r = decodeUv5rMiniRadioReport(
        edited((b) => {
          putU32(b, 0x08, start);
          putU32(b, 0x0c, size);
        }),
      );
      expect(r).toEqual({
        kind: 'unknownLayout',
        vmStart: start,
        vmSize: size,
        name: 'mm9pdy-L2-0.2.0-rc.1',
      });
    }
  });

  it('returns vm_bank0 as read when it differs, and still decides on the pair', () => {
    const r = decodeUv5rMiniRadioReport(edited((b) => putU32(b, 0x10, 0x95000)));
    expect(r).toMatchObject({ kind: 'report', layout: 'L2', vmStart: 0x94000, vmBank0: 0x95000 });
  });
});

describe('uv5rMiniLayoutFromReport', () => {
  const answer = (b: Uint8Array) => uv5rMiniLayoutFromReport(decodeUv5rMiniRadioReport(b));

  it('asks the Radio Info question for a stock radio', () => {
    expect(answer(new Uint8Array(64).fill(0xff))).toBeNull();
  });

  it('takes the layout and build from the report, with the facts as information only', () => {
    expect(answer(example())).toEqual({
      kind: 'layout',
      layout: 'L2',
      build: 'mm9pdy-L2-0.2.0-rc.1',
      reported: true,
      codeBase: 'nrf-v0.27',
      details: [
        'MM9PDY build: mm9pdy-L2-0.2.0-rc.1',
        'Flash layout: L2',
        'Code base: nrf-v0.27',
        'RF chip register 0: 0x1234',
      ],
    });
  });

  it('marks an empty-named report as reported, with no build', () => {
    const r = answer(edited((b) => b.fill(0, 0x18, 0x3e)));
    expect(r).toMatchObject({ kind: 'layout', layout: 'L2', reported: true });
    expect(r).not.toHaveProperty('build');
  });

  it('carries the code-base flag as the radio code base and as information, never as a warning', () => {
    const v004L1 = answer(
      edited((b) => {
        asL1(b);
        b[5] = 0x01;
      }),
    );
    expect(v004L1).toMatchObject({ kind: 'layout', layout: 'L1', codeBase: 'nrfb-v0.04' });
    expect(v004L1 && v004L1.kind === 'layout' ? v004L1.details : []).toContain(
      'Code base: nrfb-v0.04',
    );
    // No file moves a radio between code bases any more, so the old one-way warning is gone.
    expect(v004L1).not.toHaveProperty('warning');

    const v027L1 = answer(edited(asL1));
    expect(v027L1).toMatchObject({ kind: 'layout', layout: 'L1', codeBase: 'nrf-v0.27' });
    expect(v027L1).not.toHaveProperty('warning');

    const v004L2 = answer(edited((b) => (b[5] = 0x01)));
    expect(v004L2).toMatchObject({ layout: 'L2', codeBase: 'nrfb-v0.04' });
    expect(v004L2).not.toHaveProperty('warning');
  });

  it('reports a vm_bank0 mismatch and keeps the pair', () => {
    const r = answer(edited((b) => putU32(b, 0x10, 0x95000)));
    expect(r).toMatchObject({ kind: 'layout', layout: 'L2' });
    expect(r && r.kind === 'layout' ? r.details?.at(-1) : '').toBe(
      "The radio's settings store starts at 0x95000, not at its VM entry 0x94000. Studio goes by the VM entry.",
    );
  });

  it('refuses an unknown pair and an unknown format', () => {
    expect(
      answer(
        edited((b) => {
          putU32(b, 0x08, 0x96000);
          putU32(b, 0x0c, 0x66000);
        }),
      ),
    ).toEqual({ kind: 'refused', message: UV5RMINI_UNKNOWN_LAYOUT_REFUSAL(0x96000, 0x66000) });
    expect(UV5RMINI_UNKNOWN_LAYOUT_REFUSAL(0x96000, 0x66000)).toBe(
      "This radio reports a flash layout Studio doesn't support (VM entry at 0x96000, 0x66000 bytes). Nothing was sent.",
    );
    expect(answer(edited((b) => (b[4] = 7)))).toEqual({
      kind: 'refused',
      message: UV5RMINI_UNKNOWN_FORMAT_REFUSAL(7),
    });
  });
});
