import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { channelPrimaryAddress } from './memory.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  AT_D890_ERASE_UNIT_BYTES,
  assertEraseUnitAddressInTouchedSet,
  eraseUnitBaseFor,
  listTouchedEraseUnits,
  readSpanForEraseUnit,
} from './eraseUnits.ts';

describe('eraseUnitBaseFor', () => {
  it('aligns config-region addresses to 0x3480000 and 0x3500000', () => {
    expect(eraseUnitBaseFor(D890_MAP.ChannelSet)).toBe(0x348_0000);
    expect(eraseUnitBaseFor(D890_MAP.ZoneAChannel)).toBe(0x350_0000);
    expect(eraseUnitBaseFor(D890_MAP.OptionalSettingsMain)).toBe(0x350_0000);
  });

  it('aligns ChannelData block-0 and block-1 primaries to distinct units', () => {
    expect(eraseUnitBaseFor(channelPrimaryAddress(0))).toBe(0x100_0000);
    expect(eraseUnitBaseFor(channelPrimaryAddress(128))).toBe(0x108_0000);
    expect(channelPrimaryAddress(128)).toBe(0x108_0000);
  });

  it('maps mirrored ChannelData to the mirror unit base', () => {
    const mirrored = channelPrimaryAddress(0) + D890_MAP.ChannelDataAliasStride;
    expect(eraseUnitBaseFor(mirrored)).toBe(0x104_0000);
  });
});

describe('listTouchedEraseUnits', () => {
  it('returns unique sorted bases', () => {
    const bases = listTouchedEraseUnits([
      D890_MAP.ChannelSet,
      D890_MAP.ChannelSet + 0x10,
      D890_MAP.ZoneAChannel,
    ]);
    expect(bases).toEqual([0x348_0000, 0x350_0000]);
  });
});

describe('readSpanForEraseUnit', () => {
  it('returns a full erase unit for config bases', () => {
    expect(readSpanForEraseUnit(0x348_0000)).toEqual({
      start: 0x348_0000,
      length: AT_D890_ERASE_UNIT_BYTES,
    });
  });

  it('returns a full erase unit for ChannelData block-0', () => {
    expect(readSpanForEraseUnit(0x100_0000)).toEqual({
      start: 0x100_0000,
      length: AT_D890_ERASE_UNIT_BYTES,
    });
  });

  it('rejects mirrored ChannelData unit bases', () => {
    expect(() => readSpanForEraseUnit(0x104_0000)).toThrow(RadioProtocolError);
  });

  it('rejects misaligned unit bases', () => {
    expect(() => readSpanForEraseUnit(0x348_0001)).toThrow(RadioProtocolError);
  });
});

describe('assertEraseUnitAddressInTouchedSet', () => {
  it('passes when address lies in a touched unit', () => {
    const touched = new Set([0x350_0000]);
    expect(() =>
      assertEraseUnitAddressInTouchedSet(D890_MAP.OptionalSettingsMain, touched),
    ).not.toThrow();
  });

  it('fails when address unit was not touched', () => {
    const touched = new Set([0x348_0000]);
    expect(() =>
      assertEraseUnitAddressInTouchedSet(D890_MAP.OptionalSettingsMain, touched),
    ).toThrow(/outside touched erase units/);
  });
});
