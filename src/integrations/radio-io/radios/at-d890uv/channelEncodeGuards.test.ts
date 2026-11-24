import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  assertAtD890MrChannelFrequencies,
  AtD890ChannelEncodeError,
  checkAtD890WriteChannels,
} from './channelEncodeGuards.ts';
import { AT_D890UV_DESCRIPTOR } from './descriptor.ts';
import { encodeAtD890ChannelRecord } from './channelCodec.ts';

function sampleChannel(overrides: Partial<RadioChannelDto>): RadioChannelDto {
  return {
    slotIndex: 1,
    empty: false,
    wireName: 'Test',
    rxHz: 145_520_000,
    txHz: 145_520_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
    mode: 'analog',
    ...overrides,
  };
}

describe('assertAtD890MrChannelFrequencies', () => {
  it('allows normal VHF MR frequencies', () => {
    expect(() =>
      assertAtD890MrChannelFrequencies(sampleChannel({ rxHz: 145_520_000 })),
    ).not.toThrow();
  });

  it('rejects AM airband RX with channel index', () => {
    expect(() =>
      assertAtD890MrChannelFrequencies(sampleChannel({ slotIndex: 42, rxHz: 118_000_000 })),
    ).toThrow(AtD890ChannelEncodeError);
    expect(() =>
      assertAtD890MrChannelFrequencies(sampleChannel({ slotIndex: 42, rxHz: 118_000_000 })),
    ).toThrow(/channel 42/);
    expect(() =>
      assertAtD890MrChannelFrequencies(sampleChannel({ slotIndex: 42, rxHz: 118_000_000 })),
    ).toThrow(/airband/i);
  });

  it('rejects AM airband TX', () => {
    expect(() =>
      assertAtD890MrChannelFrequencies(sampleChannel({ rxHz: 145_520_000, txHz: 121_500_000 })),
    ).toThrow(/airband/i);
  });

  it('rejects non-positive RX', () => {
    expect(() => assertAtD890MrChannelFrequencies(sampleChannel({ rxHz: 0 }))).not.toThrow();
    expect(() =>
      assertAtD890MrChannelFrequencies(sampleChannel({ empty: false, rxHz: -1 })),
    ).toThrow(/positive frequency/);
  });

  it('encodeAtD890ChannelRecord invokes airband guard', () => {
    expect(() =>
      encodeAtD890ChannelRecord(sampleChannel({ slotIndex: 7, rxHz: 125_000_000 })),
    ).toThrow(/channel 7/);
  });
});

describe('checkAtD890WriteChannels', () => {
  it('returns every bad channel, not just the first', () => {
    const refusals = checkAtD890WriteChannels([
      sampleChannel({ slotIndex: 2, rxHz: 118_000_000 }),
      sampleChannel({ slotIndex: 5, rxHz: 121_500_000, txHz: 121_500_000 }),
      sampleChannel({ slotIndex: 8, nxdn: { txRan: 99 } }),
    ]);
    expect(refusals).toHaveLength(3);
    expect(refusals.every((r) => r.retry === 'none')).toBe(true);
    expect(refusals.map((r) => r.channelIndex).sort()).toEqual([2, 5, 8]);
  });

  it('returns nothing for a clean projection', () => {
    expect(
      checkAtD890WriteChannels([
        sampleChannel({ slotIndex: 1, rxHz: 145_520_000 }),
        sampleChannel({ slotIndex: 2, nxdn: { txRan: 10, rxRan: 10 } }),
      ]),
    ).toEqual([]);
  });

  it('skips empty slots', () => {
    expect(
      checkAtD890WriteChannels([
        sampleChannel({ slotIndex: 3, empty: true, rxHz: 118_000_000 }),
        sampleChannel({ slotIndex: 4, rxHz: 145_520_000 }),
      ]),
    ).toEqual([]);
  });
});

describe('AT-D890UV descriptor projection check', () => {
  it('the D890 descriptor checks the projection', () => {
    expect(AT_D890UV_DESCRIPTOR.checkWriteProjection).toBeTypeOf('function');
    const refusals = AT_D890UV_DESCRIPTOR.checkWriteProjection!({
      channels: [sampleChannel({ slotIndex: 9, rxHz: 125_000_000 })],
      organisation: {},
    });
    expect(refusals).toHaveLength(1);
    expect(refusals[0]!.message).toMatch(/channel 9/);
  });
});
