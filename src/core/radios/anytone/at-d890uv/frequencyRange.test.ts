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

  it('code 19 is unknown and treated as 0', () => {
    const d = describeAtD890FrequencyRange(19);
    expect(d.caption).toBe('Unknown (treated as 0 by the radio)');
    expect(d.known).toBe(false);
    expect(atD890TxAllowed(19, 470)).toBe(true);
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
