import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { listWriteChunks, type AtD890DownloadCache } from './memory.ts';
import {
  assertAtD890WritableAddress,
  assertAtD890WritableSpan,
  isAtD890WritableAddress,
} from './writableExtents.ts';

describe('AT_D890 writable extents', () => {
  it('includes modelled static banks', () => {
    expect(isAtD890WritableAddress(D890_MAP.ChannelSet)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.ZoneAChannel)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.MasterIdData)).toBe(true);
  });

  it('excludes LocalInfo and optional settings', () => {
    expect(isAtD890WritableAddress(D890_MAP.LocalInfo)).toBe(false);
    expect(isAtD890WritableAddress(0x350_0000)).toBe(false);
    expect(isAtD890WritableAddress(0x350_0900)).toBe(false);
  });

  it('Zone A/B writable extents do not overlap optional-settings spans', () => {
    const optionalMainEnd = 0x350_0000 + 0x200;
    const optionalExtEnd = 0x350_0900 + 0x60;
    const zoneAStart = D890_MAP.ZoneAChannel;
    const zoneAEnd = D890_MAP.ZoneAChannel + D890_MAP.ZoneTableBytes;
    const zoneBEnd = D890_MAP.ZoneBChannel + D890_MAP.ZoneTableBytes;
    expect(zoneAStart).toBeGreaterThanOrEqual(optionalMainEnd);
    expect(zoneBEnd).toBeLessThanOrEqual(optionalExtEnd);
    expect(isAtD890WritableAddress(0x350_0005)).toBe(false);
    expect(isAtD890WritableAddress(D890_MAP.ZoneAChannel)).toBe(true);
  });

  it('listWriteChunks omits LocalInfo even when present in cache', () => {
    const cache: AtD890DownloadCache = {
      blocks: new Map([
        [D890_MAP.LocalInfo, new Uint8Array(0x100).fill(0xaa)],
        [D890_MAP.ChannelSet, new Uint8Array(0x200)],
      ]),
    };
    const chunks = listWriteChunks(cache);
    const addrs = chunks.map((c) => c.address);
    expect(addrs.some((a) => a >= D890_MAP.LocalInfo && a < D890_MAP.LocalInfo + 0x100)).toBe(
      false,
    );
    expect(addrs).toContain(D890_MAP.ChannelSet);
  });

  it('assertAtD890WritableAddress throws for LocalInfo', () => {
    expect(() => assertAtD890WritableAddress(D890_MAP.LocalInfo)).toThrow(RadioProtocolError);
  });

  it('assertAtD890WritableSpan rejects spill past ZoneAChannel extent', () => {
    expect(() =>
      assertAtD890WritableSpan(D890_MAP.ZoneAChannel, D890_MAP.ZoneTableBytes + 0x10),
    ).toThrow(RadioProtocolError);
  });

  it('allows full Zone A table within extent', () => {
    expect(() =>
      assertAtD890WritableSpan(D890_MAP.ZoneAChannel, D890_MAP.ZoneTableBytes),
    ).not.toThrow();
  });

  it('allows channel data within bank span', () => {
    expect(() =>
      assertAtD890WritableSpan(D890_MAP.ChannelData, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    ).not.toThrow();
  });
});
