import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { AtD890ChannelEncodeError } from './channelEncodeGuards.ts';
import { decodeAtD890ChannelNxdn, encodeAtD890ChannelRecord } from './channelCodec.ts';

const base: RadioChannelDto = {
  slotIndex: 7,
  empty: false,
  wireName: 'NXDN CH',
  rxHz: 438_800_000,
  txHz: 438_800_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: 100,
  bandwidth: 'NFM',
  mode: 'digital',
};

/** A downloaded slot whose `0x66`-`0x6e` bytes are all distinct, with the bits we model clear. */
function priorWithNxdnBytes(): Uint8Array {
  const prior = encodeAtD890ChannelRecord(base);
  for (let offset = 0x66; offset <= 0x6e; offset++) prior[offset] = 0xa0 + offset - 0x66;
  prior[0x66] = 0xf2; // b0 clear, b1 and b7:4 set: carried bits
  prior[0x6b] = 0x03;
  return prior;
}

describe('encodeAtD890ChannelRecord NXDN fields', () => {
  it('writes rate, TX RAN and RX RAN at 0x66 bit 0, 0x68 and 0x69', () => {
    const encoded = encodeAtD890ChannelRecord({
      ...base,
      nxdn: { rxRan: 7, txRan: 5, rate: 'nxdn96' },
    });
    expect(encoded[0x66]! & 1).toBe(1);
    expect(encoded[0x68]).toBe(5);
    expect(encoded[0x69]).toBe(7);
    expect(decodeAtD890ChannelNxdn(encoded)).toEqual({ rxRan: 7, txRan: 5, rate: 'nxdn96' });
  });

  it('nxdn48 clears the rate bit; RAN 0 and 63 are valid', () => {
    const encoded = encodeAtD890ChannelRecord({
      ...base,
      nxdn: { rxRan: 63, txRan: 0, rate: 'nxdn48' },
    });
    expect(encoded[0x66]! & 1).toBe(0);
    expect(encoded[0x68]).toBe(0);
    expect(encoded[0x69]).toBe(63);
  });

  it('keeps carried-over bits and bytes it does not model', () => {
    const prior = priorWithNxdnBytes();
    const encoded = encodeAtD890ChannelRecord(
      { ...base, nxdn: { rxRan: 7, txRan: 5, rate: 'nxdn96' } },
      prior,
    );
    // 0x66: only bit 0 changes (0xf2 -> 0xf3).
    expect(encoded[0x66]).toBe(0xf3);
    // Busy lock (0x67 b3:0) is carried over; PTT Call (b7:4) is Off with no call target.
    expect(encoded[0x67]).toBe(prior[0x67]! & 0x0f);
    expect(encoded[0x6a]).toBe(prior[0x6a]);
    // No call target: slot 0 and no status message. The RX group list is "none", not the old 0x03.
    expect(encoded[0x6b]).toBe(0xff);
    expect(encoded[0x6c]).toBe(0);
    expect(encoded[0x6d]).toBe(0);
    expect(encoded[0x6e]).toBe(0);
    expect(encoded[0x68]).toBe(5);
    expect(encoded[0x69]).toBe(7);
  });

  it('a call target sets PTT Call and the u16 slot; an RX group is its 0-based index', () => {
    const prior = priorWithNxdnBytes();
    const encoded = encodeAtD890ChannelRecord(
      { ...base, nxdn: { rxRan: 1, txRan: 1, txTargetIndex: 0x1234 & 0x3ff, rxGroupIndex: 3 } },
      prior,
    );
    expect(encoded[0x67]! >> 4).toBe(1);
    expect(encoded[0x67]! & 0x0f).toBe(prior[0x67]! & 0x0f);
    expect(encoded[0x6c]! | (encoded[0x6d]! << 8)).toBe(0x1234 & 0x3ff);
    expect(encoded[0x6b]).toBe(3);
    expect(encoded[0x6e]).toBe(0);
  });

  it('a call target at list slot 0 still turns PTT Call on', () => {
    const encoded = encodeAtD890ChannelRecord({
      ...base,
      nxdn: { rxRan: 1, txRan: 1, txTargetIndex: 0 },
    });
    expect(encoded[0x67]! >> 4).toBe(1);
    expect(encoded[0x6c]).toBe(0);
  });

  it('a missing rate or RAN leaves that byte as read', () => {
    const prior = priorWithNxdnBytes();
    const encoded = encodeAtD890ChannelRecord({ ...base, nxdn: { txRan: 9 } }, prior);
    expect(encoded[0x66]).toBe(prior[0x66]);
    expect(encoded[0x68]).toBe(9);
    expect(encoded[0x69]).toBe(prior[0x69]);
  });

  it('a fresh slot gets no RX group list (0xff), not list 0, and a zero contact slot', () => {
    const encoded = encodeAtD890ChannelRecord({ ...base, nxdn: { rxRan: 1, txRan: 1 } });
    expect(encoded[0x6b]).toBe(0xff);
    expect(encoded[0x67]).toBe(0);
    expect(encoded[0x6c]).toBe(0);
    expect(encoded[0x6d]).toBe(0);
    expect(encoded[0x6e]).toBe(0);
  });

  it('a slot whose previous 0x6b was 0 (list 0) or another index gets 0xff', () => {
    for (const previous of [0x00, 0x03]) {
      const prior = priorWithNxdnBytes();
      prior[0x6b] = previous;
      const encoded = encodeAtD890ChannelRecord({ ...base, nxdn: { rxRan: 1, txRan: 1 } }, prior);
      expect(encoded[0x6b]).toBe(0xff);
    }
  });

  it('a channel without nxdn leaves 0x6b as read', () => {
    const prior = priorWithNxdnBytes();
    prior[0x6b] = 0x00;
    expect(encodeAtD890ChannelRecord(base, prior)[0x6b]).toBe(0x00);
  });

  it('throws on an out-of-range or fractional RAN before producing a record', () => {
    for (const bad of [-1, 64, 2.5, Number.NaN]) {
      expect(() => encodeAtD890ChannelRecord({ ...base, nxdn: { rxRan: bad } })).toThrow(
        AtD890ChannelEncodeError,
      );
      expect(() => encodeAtD890ChannelRecord({ ...base, nxdn: { txRan: bad } })).toThrow(
        AtD890ChannelEncodeError,
      );
    }
  });

  it('without nxdn the record is byte-identical to the base encode', () => {
    const prior = priorWithNxdnBytes();
    const withoutField = encodeAtD890ChannelRecord(base, prior);
    expect([...withoutField.subarray(0x66, 0x6f)]).toEqual([...prior.subarray(0x66, 0x6f)]);
    const fresh = encodeAtD890ChannelRecord(base);
    expect([...fresh.subarray(0x66, 0x6f)]).toEqual(new Array(9).fill(0));
  });

  it('an empty channel stays all zero even with nxdn set', () => {
    const encoded = encodeAtD890ChannelRecord({ ...base, empty: true, nxdn: { rxRan: 3 } });
    expect(encoded.every((b) => b === 0)).toBe(true);
  });
});

describe('encodeAtD890ChannelRecord clearNxdnBytes (MM9PDY, channel without NXDN fields)', () => {
  it('writes zeros into 0x66-0x6E over a slot that held NXDN bytes, and leaves 0x6F onward', () => {
    const prior = priorWithNxdnBytes();
    prior[0x6f] = 0x5a;
    prior[0x7f] = 0x6b;
    const encoded = encodeAtD890ChannelRecord({ ...base, clearNxdnBytes: true }, prior);
    expect([...encoded.subarray(0x66, 0x6f)]).toEqual(Array(9).fill(0));
    // Everything from 0x6F on is exactly what the encode did before the flag.
    const without = encodeAtD890ChannelRecord(base, prior);
    expect([...encoded.subarray(0x6f)]).toEqual([...without.subarray(0x6f)]);
    expect([...encoded.subarray(0, 0x66)]).toEqual([...without.subarray(0, 0x66)]);
  });

  it('writes zeros over an erased FF slot', () => {
    // A slot whose NXDN bytes read FF (erased), inside an otherwise used record.
    const prior = encodeAtD890ChannelRecord(base);
    prior.fill(0xff, 0x66, 0x6f);
    const encoded = encodeAtD890ChannelRecord({ ...base, clearNxdnBytes: true }, prior);
    expect([...encodeAtD890ChannelRecord(base, prior).subarray(0x66, 0x6f)]).toEqual(
      Array(9).fill(0xff),
    );
    expect([...encoded.subarray(0x66, 0x6f)]).toEqual(Array(9).fill(0));
    const without = encodeAtD890ChannelRecord(base, prior);
    expect([...encoded.subarray(0x6f)]).toEqual([...without.subarray(0x6f)]);
  });

  it('the stock target (no flag) still carries the bytes over', () => {
    const prior = priorWithNxdnBytes();
    const encoded = encodeAtD890ChannelRecord(base, prior);
    expect([...encoded.subarray(0x66, 0x6f)]).toEqual([...prior.subarray(0x66, 0x6f)]);
  });

  it('a channel with NXDN fields is not cleared by the flag', () => {
    const encoded = encodeAtD890ChannelRecord({
      ...base,
      clearNxdnBytes: true,
      nxdn: { rxRan: 7, txRan: 5 },
    });
    expect(encoded[0x69]).toBe(7);
  });
});
