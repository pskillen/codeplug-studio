import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  assertAtD890MrChannelFrequencies,
  AtD890ChannelEncodeError,
} from './channelEncodeGuards.ts';
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
    expect(() => assertAtD890MrChannelFrequencies(sampleChannel({ rxHz: 145_520_000 }))).not.toThrow();
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
      assertAtD890MrChannelFrequencies(
        sampleChannel({ rxHz: 145_520_000, txHz: 121_500_000 }),
      ),
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
