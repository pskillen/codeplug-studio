import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  listWriteChunks,
  type AtD890DownloadCache,
} from './memory.ts';
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
    expect(isAtD890WritableAddress(D890_MAP.OptionalSettingsMain)).toBe(false);
    expect(isAtD890WritableAddress(D890_MAP.OptionalSettingsExt)).toBe(false);
    expect(isAtD890WritableAddress(D890_MAP.OptionalSettingsAprs)).toBe(false);
    expect(isAtD890WritableAddress(D890_MAP.AlarmBitmap)).toBe(false);
    expect(isAtD890WritableAddress(D890_MAP.AlarmData)).toBe(false);
  });

  it('Zone A/B writable extents do not overlap optional-settings spans', () => {
    const optionalMainEnd = 0x350_0000 + 0x200;
    const optionalExtEnd = 0x350_0900 + 0x60;
    const zoneAStart = D890_MAP.ZoneAChannel;
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

  it('listWriteChunks omits optional settings and alarm even when present in cache', () => {
    const cache: AtD890DownloadCache = {
      blocks: new Map([
        [
          D890_MAP.OptionalSettingsMain,
          new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0xbb),
        ],
        [
          D890_MAP.OptionalSettingsExt,
          new Uint8Array(D890_MAP.OptionalSettingsExtLength).fill(0xcc),
        ],
        [
          D890_MAP.OptionalSettingsAprs,
          new Uint8Array(D890_MAP.OptionalSettingsAprsLength).fill(0xdd),
        ],
        [D890_MAP.AlarmBitmap, new Uint8Array(D890_MAP.AlarmBitmapLength).fill(0xee)],
        [D890_MAP.AlarmData, new Uint8Array(D890_MAP.AlarmDataLength).fill(0xff)],
        [D890_MAP.ChannelSet, new Uint8Array(0x200)],
      ]),
    };
    const addrs = listWriteChunks(cache).map((c) => c.address);
    const inRange = (start: number, len: number) =>
      addrs.some((a) => a >= start && a < start + len);

    expect(inRange(D890_MAP.OptionalSettingsMain, D890_MAP.OptionalSettingsMainLength)).toBe(false);
    expect(inRange(D890_MAP.OptionalSettingsExt, D890_MAP.OptionalSettingsExtLength)).toBe(false);
    expect(inRange(D890_MAP.OptionalSettingsAprs, D890_MAP.OptionalSettingsAprsLength)).toBe(false);
    expect(inRange(D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength)).toBe(false);
    expect(inRange(D890_MAP.AlarmData, D890_MAP.AlarmDataLength)).toBe(false);
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

  it('rejects mirrored ChannelData upper-half addresses', () => {
    const mirrored = 0x184_0000;
    const backed = 0x180_0000;
    expect(isAtD890WritableAddress(mirrored)).toBe(false);
    expect(isAtD890WritableAddress(backed)).toBe(true);
    expect(() => assertAtD890WritableAddress(mirrored)).toThrow(RadioProtocolError);
    expect(() =>
      assertAtD890WritableSpan(mirrored, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    ).toThrow(RadioProtocolError);
  });

  it('accepts every channel primary and secondary address for slots 0..3999', () => {
    const boundarySlots = [0, 127, 128, AT_D890_LIMITS.MAX_CHANNELS - 1];
    for (const slot of boundarySlots) {
      const primary = channelPrimaryAddress(slot);
      const secondary = channelSecondaryAddress(slot);
      expect(isAtD890WritableAddress(primary)).toBe(true);
      expect(isAtD890WritableAddress(secondary)).toBe(true);
      expect(() =>
        assertAtD890WritableSpan(primary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
      ).not.toThrow();
      expect(() =>
        assertAtD890WritableSpan(secondary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
      ).not.toThrow();
    }

    for (let slot = 0; slot < AT_D890_LIMITS.MAX_CHANNELS; slot++) {
      expect(isAtD890WritableAddress(channelPrimaryAddress(slot))).toBe(true);
      expect(isAtD890WritableAddress(channelSecondaryAddress(slot))).toBe(true);
    }
  });
});
