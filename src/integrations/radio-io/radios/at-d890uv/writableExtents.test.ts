import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  AT_D890_CHANNEL_LOCATION,
  AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES,
  AT_D890_LIMITS,
  AT_D890_SATELLITE,
  D890_MAP,
} from './constants.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  listWriteChunks,
  scanListAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import {
  assertAtD890NotHardDenied,
  assertAtD890TransmitAddress,
  assertAtD890WritableAddress,
  assertAtD890WritableSpan,
  AT_D890_WRITABLE_EXTENTS,
  findWritableExtentForAddress,
  isAtD890HardDeniedWriteAddress,
  isAtD890TransmitAddress,
  isAtD890WritableAddress,
} from './writableExtents.ts';

describe('AT_D890 writable extents', () => {
  it('allow-lists banked scan-list slots and not the pitch gap', () => {
    expect(isAtD890WritableAddress(scanListAddress(32))).toBe(true);
    expect(isAtD890WritableAddress(scanListAddress(255))).toBe(true);
    expect(findWritableExtentForAddress(0x210_4000)?.id ?? '').not.toMatch(/^ScanListData/);
    expect(findWritableExtentForAddress(0x214_0000)?.id ?? '').not.toMatch(/^ScanListData/);
    expect(isAtD890WritableAddress(0x210_4000)).toBe(false);
    expect(isAtD890WritableAddress(0x214_0000)).toBe(false);
  });

  it('ReceiveGroupData writable span matches RX_GROUP_SET_BYTES bitmap width', () => {
    const receiveGroupData = AT_D890_WRITABLE_EXTENTS.find((e) => e.id === 'ReceiveGroupData')!;
    expect(receiveGroupData.length).toBe(
      AT_D890_LIMITS.RX_GROUP_STRIDE * AT_D890_LIMITS.RX_GROUP_SET_BYTES * 8,
    );
  });

  it('includes modelled static banks', () => {
    expect(isAtD890WritableAddress(D890_MAP.ChannelSet)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.ZoneAChannel)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.MasterIdData)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AmAirSet)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AmAirData)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AmZoneSet)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AmZoneData)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AmZoneAChannel)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AmZoneScan)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AprsConfigMain)).toBe(true);
    expect(isAtD890WritableAddress(D890_MAP.AprsReceiveFilters)).toBe(true);
  });

  it('excludes AmAir VFO (retain-only companion of the programmable bank)', () => {
    expect(isAtD890WritableAddress(D890_MAP.AmAirVfo)).toBe(false);
  });

  it('SatelliteData: base address and every address within MAX_SATELLITES * stride is writable', () => {
    const { BASE_ADDRESS, RECORD_STRIDE } = AT_D890_SATELLITE;
    const extentLength = RECORD_STRIDE * AT_D890_LIMITS.MAX_SATELLITES;
    const lastByte = BASE_ADDRESS + extentLength - 1;

    expect(isAtD890WritableAddress(BASE_ADDRESS)).toBe(true);
    expect(isAtD890WritableAddress(lastByte)).toBe(true);
    expect(lastByte).toBe(0x4a831ff);
    // Spot-check a mid-extent record boundary too, not just the ends.
    expect(isAtD890WritableAddress(BASE_ADDRESS + RECORD_STRIDE * 3)).toBe(true);
  });

  it('SatelliteData: the address immediately before/after the extent is not writable', () => {
    const { BASE_ADDRESS, RECORD_STRIDE } = AT_D890_SATELLITE;
    const nextAddress = BASE_ADDRESS + RECORD_STRIDE * AT_D890_LIMITS.MAX_SATELLITES;

    expect(isAtD890WritableAddress(BASE_ADDRESS - 1)).toBe(false);
    expect(isAtD890WritableAddress(nextAddress)).toBe(false);
    expect(nextAddress).toBe(0x4a83200);
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
    expect(() => assertAtD890WritableSpan(mirrored, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE)).toThrow(
      RadioProtocolError,
    );
    expect(isAtD890TransmitAddress(mirrored, new Set([0x180_0000]))).toBe(false);
  });

  it('allows optional settings inside a touched erase unit during upload', () => {
    const touched = new Set([0x350_0000]);
    expect(isAtD890TransmitAddress(D890_MAP.OptionalSettingsMain, touched)).toBe(true);
    expect(isAtD890TransmitAddress(D890_MAP.ZoneAChannel, touched)).toBe(true);
    expect(() => assertAtD890TransmitAddress(D890_MAP.OptionalSettingsMain, touched)).not.toThrow();
  });

  it('still refuses LocalInfo even when other units are touched', () => {
    const touched = new Set([0x350_0000, 0x348_0000]);
    expect(isAtD890TransmitAddress(D890_MAP.LocalInfo, touched)).toBe(false);
    expect(() => assertAtD890TransmitAddress(D890_MAP.LocalInfo, touched)).toThrow(
      RadioProtocolError,
    );
  });

  it('refuses erase-unit flash sector-management markers even inside a touched unit', () => {
    const touched = new Set([0x350_0000]);
    const markerA = 0x350_0000 + 0x3fbf0;
    const markerB = 0x350_0000 + 0x3fff0;
    expect(isAtD890TransmitAddress(markerA, touched)).toBe(false);
    expect(isAtD890TransmitAddress(markerB, touched)).toBe(false);
    expect(() => assertAtD890TransmitAddress(markerA, touched)).toThrow(/sector-management marker/);
    expect(() => assertAtD890TransmitAddress(markerB, touched)).toThrow(/sector-management marker/);
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

describe('AT_D890 channel location table extent (#1383)', () => {
  const base = AT_D890_CHANNEL_LOCATION.BASE_ADDRESS;

  it('allows the header and every entry of the A half', () => {
    expect(findWritableExtentForAddress(base)?.id).toBe('ChannelLocationTable');
    expect(isAtD890WritableAddress(base)).toBe(true);
    expect(isAtD890WritableAddress(base + AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES - 0x10)).toBe(
      true,
    );
    expect(() =>
      assertAtD890WritableSpan(base, AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES),
    ).not.toThrow();
  });

  it('still refuses its neighbours, the rest of the unit and the B half', () => {
    expect(isAtD890WritableAddress(base - 0x10)).toBe(false);
    expect(isAtD890WritableAddress(base + AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES)).toBe(false);
    expect(isAtD890WritableAddress(base + 0x3_fbf0)).toBe(false);
    expect(isAtD890WritableAddress(AT_D890_CHANNEL_LOCATION.PAIR_B_ADDRESS)).toBe(false);
    expect(() =>
      assertAtD890WritableSpan(base, AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES + 0x10),
    ).toThrow(RadioProtocolError);
    expect(isAtD890TransmitAddress(AT_D890_CHANNEL_LOCATION.PAIR_B_ADDRESS, new Set())).toBe(false);
  });
});

describe('hard deny (LocalInfo, calibration, markers, safe-skip)', () => {
  it('transmit fence refuses vital units even when the unit is in the touched set', () => {
    expect(isAtD890TransmitAddress(0x04f8_0000, new Set([0x04f8_0000]))).toBe(false);
    expect(isAtD890TransmitAddress(0x04f0_0010, new Set([0x04f0_0000]))).toBe(false);
    expect(isAtD890TransmitAddress(0x04fc_0000, new Set([0x04fc_0000]))).toBe(false);
  });

  it('range boundaries', () => {
    expect(isAtD890HardDeniedWriteAddress(0x04ef_ffe0)).toBe(false);
    expect(isAtD890HardDeniedWriteAddress(0x04f0_0000)).toBe(true);
    expect(isAtD890HardDeniedWriteAddress(0x04ff_fff0)).toBe(true);
    expect(isAtD890HardDeniedWriteAddress(0x0500_0000)).toBe(false);
  });

  it('denies bookkeeping and safe-skip, with the reason in the message', () => {
    expect(isAtD890HardDeniedWriteAddress(0x03a3_fbf0)).toBe(true);
    expect(isAtD890HardDeniedWriteAddress(0x03a3_fff0)).toBe(true);
    expect(() => assertAtD890NotHardDenied(0x03a3_fbf0)).toThrow(/sector-management marker/);
    expect(() => assertAtD890NotHardDenied(0x02fa_0010)).toThrow(/family safe-skip/);
    expect(() => assertAtD890NotHardDenied(0x04f8_0000)).toThrow(/LocalInfo \/ calibration/);
    expect(() => assertAtD890TransmitAddress(0x04f8_0000, new Set([0x04f8_0000]))).toThrow(
      /LocalInfo \/ calibration/,
    );
  });
});
