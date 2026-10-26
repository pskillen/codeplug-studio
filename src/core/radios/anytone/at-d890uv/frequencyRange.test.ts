import { describe, expect, it } from 'vitest';

import {
  AT_D890_FREQUENCY_RANGES,
  atD890TxAllowed,
  AT_D890_RANGE_CHANGE_TARGET_CODES,
  atD890RangeChangeTargets,
  atD890ReceiveNarrower,
  atD890TxChangeSummary,
  isAtD890RangeChangeTarget,
  describeAtD890FrequencyRange,
  listAtD890ReceiveOnlyChannels,
  sanitiseAtD890RangeCode,
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
    // The firmware's receive clamp and TX check accept code 18 at 220 MHz (RX 220-225, TX 222-225).
    expect(r(18).rx).toEqual({ uhf: [400, 480], vhf: [136, 174], b220: [220, 225] });
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

describe('range change targets', () => {
  it('lists every code 0 to 18, flagging 6, 9, 12 and 15 as unlisted', () => {
    const targets = atD890RangeChangeTargets(3, { maintenanceUnlocked: true });
    expect(targets.map((t) => t.code)).toEqual(Array.from({ length: 19 }, (_, i) => i));
    expect(targets.map((t) => t.code)).toEqual([...AT_D890_RANGE_CHANGE_TARGET_CODES]);
    expect(targets.filter((t) => t.unlisted).map((t) => t.code)).toEqual([6, 9, 12, 15]);
    for (const code of [0, 6, 14, 18]) expect(isAtD890RangeChangeTarget(code)).toBe(true);
    for (const bad of [-1, 19, 255]) expect(isAtD890RangeChangeTarget(bad)).toBe(false);
  });

  it('a radio already on an unlisted code still gets the full list', () => {
    const targets = atD890RangeChangeTargets(9, { maintenanceUnlocked: false });
    expect(targets).toHaveLength(19);
    expect(targets.find((t) => t.isCurrent)?.code).toBe(9);
    expect(targets.find((t) => t.isCurrent)?.unlisted).toBe(true);
  });

  it('marks the current code, and code 14 unavailable until unlocked', () => {
    const locked = atD890RangeChangeTargets(3, { maintenanceUnlocked: false });
    expect(locked.find((t) => t.isCurrent)?.code).toBe(3);
    const c14 = locked.find((t) => t.code === 14)!;
    expect(c14.requiresMaintenanceUnlock).toBe(true);
    expect(c14.available).toBe(false);
    expect(locked.filter((t) => !t.available)).toHaveLength(1);
    const open = atD890RangeChangeTargets(3, { maintenanceUnlocked: true });
    expect(open.find((t) => t.code === 14)!.available).toBe(true);
    expect(open.filter((t) => t.requiresMaintenanceUnlock)).toHaveLength(1);
  });

  it('narrow-receive set is the listed 2, 4, 5, 8, 16, 17 plus unlisted 6, 9, 15; UHF TX inhibited for 16 and 17', () => {
    const t = atD890RangeChangeTargets(3, { maintenanceUnlocked: true });
    expect(t.filter((x) => x.receiveNarrowerThanFull).map((x) => x.code)).toEqual([
      2, 4, 5, 6, 8, 9, 15, 16, 17,
    ]);
    expect(t.filter((x) => x.uhfTxInhibited).map((x) => x.code)).toEqual([16, 17]);
  });

  it('classifies the TX change against the current code', () => {
    const t = atD890RangeChangeTargets(3, { maintenanceUnlocked: true });
    const by = (c: number) => t.find((x) => x.code === c)!.txChange;
    expect(by(7)).toBe('wider');
    expect(by(4)).toBe('narrower');
    expect(by(16)).toBe('different');
    expect(by(18)).toBe('wider');
  });

  it('atD890ReceiveNarrower', () => {
    expect(atD890ReceiveNarrower(3, 2)).toBe(true);
    expect(atD890ReceiveNarrower(3, 7)).toBe(false);
    expect(atD890ReceiveNarrower(3, 11)).toBe(false);
    expect(atD890ReceiveNarrower(2, 3)).toBe(false);
    // Code 18 receives 220-225, so leaving it for a code without 220 loses receive; 18 -> 14 loses nothing.
    expect(atD890ReceiveNarrower(18, 3)).toBe(true);
    expect(atD890ReceiveNarrower(18, 14)).toBe(false);
    expect(atD890ReceiveNarrower(3, 18)).toBe(false);
    // An unlisted source code is described like any other.
    expect(atD890ReceiveNarrower(9, 3)).toBe(false);
    expect(atD890ReceiveNarrower(3, 9)).toBe(true);
  });

  it('summary 3 to 7 opens 146-148, 420-430, 440-450 and closes nothing', () => {
    const s = atD890TxChangeSummary(3, 7);
    expect(s.from).toBe('430–440, 144–146 MHz');
    expect(s.to).toBe('420–450, 144–148 MHz');
    expect(s.opens).toEqual(['146–148', '420–430', '440–450']);
    expect(s.closes).toEqual([]);
  });

  it('summary 7 to 16 closes UHF TX and 147-148', () => {
    const s = atD890TxChangeSummary(7, 16);
    expect(s.closes).toEqual(['147–148', '420–450']);
    expect(s.opens).toEqual([]);
  });
});

describe('sanitiseAtD890RangeCode', () => {
  it('codes above 18 read as 0, and 14 without 890# reads as 0', () => {
    expect(sanitiseAtD890RangeCode(19, true)).toBe(0);
    expect(sanitiseAtD890RangeCode(255, false)).toBe(0);
    expect(sanitiseAtD890RangeCode(14, false)).toBe(0);
    expect(sanitiseAtD890RangeCode(14, true)).toBe(14);
    expect(sanitiseAtD890RangeCode(7, false)).toBe(7);
    expect(sanitiseAtD890RangeCode(15, false)).toBe(15);
  });
});
