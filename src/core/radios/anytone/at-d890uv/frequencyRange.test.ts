import { describe, expect, it } from 'vitest';

import {
  AT_D890_FREQUENCY_RANGES,
  atD890TxAllowed,
  describeAtD890FrequencyRange,
  listAtD890ReceiveOnlyChannels,
} from './frequencyRange.ts';

const ch = (txMhz: number, extra: object = {}) => ({ txHz: Math.round(txMhz * 1e6), ...extra });

describe('AT_D890_FREQUENCY_RANGES', () => {
  it('has the 19 codes in order', () => {
    expect(AT_D890_FREQUENCY_RANGES.map((r) => r.code)).toEqual(
      Array.from({ length: 19 }, (_, i) => i),
    );
  });

  it('code 3 is Amateur Europe: RX full, TX 430-440 / 144-146', () => {
    const d = describeAtD890FrequencyRange(3);
    expect(d.caption).toBe('Amateur Europe');
    expect(d.row.rx.uhf).toEqual([400, 480]);
    expect(d.row.tx.uhf).toEqual([430, 440]);
    expect(d.row.tx.vhf).toEqual([144, 146]);
    expect(d.summary).toBe('Amateur Europe (code 3) · TX 430–440, 144–146 MHz');
  });

  it('pins the firmware values for codes 15, 16 and 18 (not the CPS display)', () => {
    const r = (c: number) => AT_D890_FREQUENCY_RANGES[c]!;
    expect(r(15).rx).toEqual({ uhf: [420, 520], vhf: [144, 148] });
    expect(r(15).tx).toEqual({ uhf: [420, 520], vhf: [144, 148] });
    expect(r(16).rx).toEqual({ uhf: [430, 440], vhf: [144, 147] });
    expect(r(16).tx).toEqual({ vhf: [144, 147] });
    // RX 220 on code 18 is not confirmed: the RX clamp and out-of-band check only open 200-300 MHz for code 14.
    expect(r(18).rx).toEqual({ uhf: [400, 480], vhf: [136, 174] });
    expect(r(18).tx).toEqual({ uhf: [420, 450], vhf: [144, 148], b220: [222, 225] });
  });

  it('UHF TX is inhibited on 16 and 17', () => {
    expect(AT_D890_FREQUENCY_RANGES[16]!.tx.uhf).toBeUndefined();
    expect(AT_D890_FREQUENCY_RANGES[17]!.tx.uhf).toBeUndefined();
    expect(atD890TxAllowed(17, 435)).toBe(false);
    expect(atD890TxAllowed(17, 150)).toBe(true);
    expect(describeAtD890FrequencyRange(16).txSummary).toBe('UHF off, 144–147 MHz');
  });

  it('flags codes the CPS does not list', () => {
    const unlisted = AT_D890_FREQUENCY_RANGES.filter((r) => !r.cpsListed).map((r) => r.code);
    expect(unlisted).toEqual([6, 9, 12, 15]);
  });

  it('code 14 without the 890# unlock is described and enforced as code 0', () => {
    const locked = describeAtD890FrequencyRange(14, { maintenanceUnlocked: false });
    expect(locked.row.code).toBe(0);
    expect(locked.caption).toBe('Maintenance (needs 890#) not unlocked, treated as 0');
    expect(locked.summary).toBe(
      'Maintenance (needs 890#) not unlocked, treated as 0 (code 14) · TX 400–480, 136–174 MHz',
    );
    const unlocked = describeAtD890FrequencyRange(14, { maintenanceUnlocked: true });
    expect(unlocked.row.code).toBe(14);
    expect(unlocked.summary).toBe(
      'Maintenance (needs 890#) (code 14) · TX 400–520, 136–174, 220–225 MHz',
    );
    // Unspecified keeps the table row (callers without the unlock state).
    expect(describeAtD890FrequencyRange(14).row.code).toBe(14);
    expect(describeAtD890FrequencyRange(3, { maintenanceUnlocked: false }).row.code).toBe(3);
  });

  it('code 19 is unknown and treated as 0', () => {
    const d = describeAtD890FrequencyRange(19);
    expect(d.caption).toBe('Unknown (treated as 0 by the radio)');
    expect(d.known).toBe(false);
    expect(atD890TxAllowed(19, 470)).toBe(true);
  });
});

type R = readonly [number, number];
/** Decoded from the stock V1.05 firmware range tables (main.elf), independent of the module's own literals. */
const FIRMWARE_TABLE: readonly {
  code: number;
  rxUhf: R;
  rxVhf: R;
  txUhf?: R;
  txVhf: R;
  tx220?: R;
}[] = [
  { code: 0, rxUhf: [400, 480], rxVhf: [136, 174], txUhf: [400, 480], txVhf: [136, 174] },
  { code: 1, rxUhf: [400, 480], rxVhf: [136, 174], txUhf: [400, 480], txVhf: [136, 174] },
  { code: 2, rxUhf: [430, 440], rxVhf: [144, 146], txUhf: [430, 440], txVhf: [144, 146] },
  { code: 3, rxUhf: [400, 480], rxVhf: [136, 174], txUhf: [430, 440], txVhf: [144, 146] },
  { code: 4, rxUhf: [434, 438], rxVhf: [144, 146], txUhf: [434, 438], txVhf: [144, 146] },
  { code: 5, rxUhf: [434, 447], rxVhf: [144, 146], txUhf: [434, 447], txVhf: [144, 146] },
  { code: 6, rxUhf: [446, 447], rxVhf: [136, 174], txUhf: [446, 447], txVhf: [136, 174] },
  { code: 7, rxUhf: [400, 480], rxVhf: [136, 174], txUhf: [420, 450], txVhf: [144, 148] },
  { code: 8, rxUhf: [400, 470], rxVhf: [136, 174], txUhf: [400, 470], txVhf: [136, 174] },
  { code: 9, rxUhf: [430, 432], rxVhf: [144, 146], txUhf: [430, 432], txVhf: [144, 146] },
  { code: 10, rxUhf: [400, 480], rxVhf: [136, 174], txUhf: [430, 450], txVhf: [144, 148] },
  { code: 11, rxUhf: [400, 520], rxVhf: [136, 174], txUhf: [400, 520], txVhf: [136, 174] },
  { code: 12, rxUhf: [400, 490], rxVhf: [136, 174], txUhf: [400, 490], txVhf: [136, 174] },
  { code: 13, rxUhf: [400, 480], rxVhf: [136, 174], txUhf: [403, 470], txVhf: [136, 174] },
  {
    code: 14,
    rxUhf: [400, 520],
    rxVhf: [136, 174],
    txUhf: [400, 520],
    txVhf: [136, 174],
    tx220: [220, 225],
  },
  { code: 15, rxUhf: [420, 520], rxVhf: [144, 148], txUhf: [420, 520], txVhf: [144, 148] },
  { code: 16, rxUhf: [430, 440], rxVhf: [144, 147], txVhf: [144, 147] },
  { code: 17, rxUhf: [430, 440], rxVhf: [136, 174], txVhf: [136, 174] },
  {
    code: 18,
    rxUhf: [400, 480],
    rxVhf: [136, 174],
    txUhf: [420, 450],
    txVhf: [144, 148],
    tx220: [222, 225],
  },
];

describe('firmware table, all 19 codes', () => {
  it.each(FIRMWARE_TABLE)('code $code matches the firmware', (f) => {
    const row = AT_D890_FREQUENCY_RANGES[f.code]!;
    expect(row.rx.uhf).toEqual(f.rxUhf);
    expect(row.rx.vhf).toEqual(f.rxVhf);
    expect(row.tx.uhf).toEqual(f.txUhf);
    expect(row.tx.vhf).toEqual(f.txVhf);
    expect(row.tx.b220).toEqual(f.tx220);

    const allowed = [f.txUhf, f.txVhf, f.tx220].filter((r): r is R => r !== undefined);
    for (const [lo, hi] of allowed) {
      expect(atD890TxAllowed(f.code, lo)).toBe(true);
      expect(atD890TxAllowed(f.code, hi)).toBe(true);
      expect(atD890TxAllowed(f.code, lo - 0.01)).toBe(false);
      expect(atD890TxAllowed(f.code, hi + 0.01)).toBe(false);
    }
    if (!f.txUhf) expect(atD890TxAllowed(f.code, f.rxUhf[0])).toBe(false);
    if (!f.tx220) expect(atD890TxAllowed(f.code, 223)).toBe(false);
  });
});

describe('atD890TxAllowed', () => {
  it('bounds are inclusive', () => {
    expect(atD890TxAllowed(3, 430)).toBe(true);
    expect(atD890TxAllowed(3, 440)).toBe(true);
    expect(atD890TxAllowed(3, 429.99)).toBe(false);
    expect(atD890TxAllowed(3, 440.01)).toBe(false);
    expect(atD890TxAllowed(3, 144)).toBe(true);
    expect(atD890TxAllowed(3, 146)).toBe(true);
    expect(atD890TxAllowed(3, 147)).toBe(false);
  });

  it('220 MHz TX on 14 and 18', () => {
    expect(atD890TxAllowed(14, 220)).toBe(true);
    expect(atD890TxAllowed(18, 221)).toBe(false);
    expect(atD890TxAllowed(18, 222)).toBe(true);
    expect(atD890TxAllowed(0, 223)).toBe(false);
  });
});

describe('listAtD890ReceiveOnlyChannels', () => {
  const chans = [ch(446.0), ch(439.0), ch(145.5), ch(150)];

  it('code 3 lists 446.0 and 150, not 439.0 or 145.5', () => {
    expect(listAtD890ReceiveOnlyChannels(chans, 3)).toEqual([chans[0], chans[3]]);
  });

  it('code 0 lists none', () => {
    expect(listAtD890ReceiveOnlyChannels(chans, 0)).toEqual([]);
  });

  it('code 7 allows 446 but not 150', () => {
    expect(listAtD890ReceiveOnlyChannels(chans, 7)).toEqual([chans[3]]);
  });

  it('code 16 lists every UHF channel', () => {
    expect(listAtD890ReceiveOnlyChannels(chans, 16)).toEqual([chans[0], chans[1], chans[3]]);
  });

  it('code 18 allows 439 and 446, not 150', () => {
    expect(listAtD890ReceiveOnlyChannels(chans, 18)).toEqual([chans[3]]);
  });

  it('skips receive-only and empty channels', () => {
    const input = [ch(446, { rxOnly: true }), ch(446, { empty: true }), ch(446)];
    expect(listAtD890ReceiveOnlyChannels(input, 3)).toEqual([input[2]]);
  });
});
