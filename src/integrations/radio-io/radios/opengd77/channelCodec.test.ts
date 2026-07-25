import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  decodeBcdFreqHz,
  decodeChannelRecord,
  decodeChannelsFromImage,
  decodeOpenGd77SquelchPercent,
  decodeSelectiveCall,
  encodeBcdFreqHz,
  encodeChannelRecord,
  encodeChannelsIntoImage,
  encodeOpenGd77SquelchByte,
  encodeSelectiveCall,
  powerPercentToWire,
  powerWireToPercent,
} from './channelCodec.ts';
import {
  OPENGD77_CHANNEL_RECORD_SIZE,
  OPENGD77_CHANNEL_SLOTS,
  OPENGD77_MD9600_POWER_STEPS,
} from './constants.ts';
import { createOpenUv380Image } from './memory.ts';

function sampleDto(overrides: Partial<RadioChannelDto> = {}): RadioChannelDto {
  return {
    slotIndex: 1,
    empty: false,
    wireName: 'TEST',
    rxHz: 145_500_000,
    txHz: 145_500_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'NFM',
    mode: 'analog',
    ...overrides,
  };
}

describe('opengd77 channelCodec BCD / tone / power', () => {
  it('round-trips BCD frequency (×10 Hz LE)', () => {
    const encoded = encodeBcdFreqHz(433_125_000);
    expect(decodeBcdFreqHz(encoded)).toBe(433_125_000);
  });

  it('encodes CTCSS selective call', () => {
    const code = encodeSelectiveCall({ kind: 'ctcss', hz: 88.5 });
    expect(decodeSelectiveCall(code)).toEqual({ kind: 'ctcss', hz: 88.5 });
  });

  it('encodes DCS normal selective call (D023N)', () => {
    const code = encodeSelectiveCall({ kind: 'dcs', code: 23, polarity: 'N' });
    expect(decodeSelectiveCall(code)).toEqual({ kind: 'dcs', code: 23, polarity: 'N' });
  });

  it('encodes DCS inverted selective call', () => {
    const code = encodeSelectiveCall({ kind: 'dcs', code: 23, polarity: 'I' });
    expect(decodeSelectiveCall(code)).toEqual({ kind: 'dcs', code: 23, polarity: 'I' });
  });

  it('maps Master/null power to wire 0', () => {
    expect(powerPercentToWire(null)).toBe(0);
    expect(powerWireToPercent(0)).toBeNull();
  });

  it('maps P9 / 100% to wire 9', () => {
    expect(powerPercentToWire(100)).toBe(9);
    expect(powerWireToPercent(9)).toBe(100);
  });

  it('maps MD-9600 power ladder nearest steps', () => {
    expect(powerPercentToWire(63, OPENGD77_MD9600_POWER_STEPS)).toBe(8);
    expect(powerWireToPercent(8, OPENGD77_MD9600_POWER_STEPS)).toBe(63);
    expect(powerPercentToWire(25, OPENGD77_MD9600_POWER_STEPS)).toBe(7);
    expect(powerPercentToWire(13, OPENGD77_MD9600_POWER_STEPS)).toBe(6);
    expect(powerPercentToWire(1, OPENGD77_MD9600_POWER_STEPS)).toBe(1);
  });

  it('round-trips MD-9600 power on channel record', () => {
    const dto = sampleDto({ powerPercent: 63 });
    const raw = encodeChannelRecord(dto, OPENGD77_MD9600_POWER_STEPS);
    expect(raw[0x19]).toBe(8);
    expect(decodeChannelRecord(raw, 1, OPENGD77_MD9600_POWER_STEPS).powerPercent).toBe(63);
  });

  it('encodes analogue squelch percent with qDMR Global/Open/Normal/Closed scaling', () => {
    expect(encodeOpenGd77SquelchByte(null, 'analog')).toBe(0);
    expect(encodeOpenGd77SquelchByte(0, 'analog')).toBe(0);
    expect(encodeOpenGd77SquelchByte(50, 'analog')).toBe(8);
    expect(encodeOpenGd77SquelchByte(100, 'analog')).toBe(15);
    expect(encodeOpenGd77SquelchByte(75, 'digital')).toBe(0);
  });

  it('decodes squelch wire byte to internal percent', () => {
    expect(decodeOpenGd77SquelchPercent(0)).toBeNull();
    expect(decodeOpenGd77SquelchPercent(1)).toBeNull();
    expect(decodeOpenGd77SquelchPercent(15)).toBe(100);
    expect(decodeOpenGd77SquelchPercent(8)).toBe(50);
  });
});

describe('opengd77 channelCodec record', () => {
  it('encodes empty as 0xFF fill', () => {
    const rec = encodeChannelRecord(sampleDto({ empty: true, rxHz: 0 }));
    expect(rec.every((b) => b === 0xff)).toBe(true);
    expect(decodeChannelRecord(rec, 3).empty).toBe(true);
  });

  it('record size is 0x38', () => {
    expect(encodeChannelRecord(sampleDto()).length).toBe(OPENGD77_CHANNEL_RECORD_SIZE);
  });

  it('round-trips name, digital mode, power, tones, scan bits', () => {
    const dto = sampleDto({
      wireName: 'GB3XX-TG91',
      mode: 'digital',
      powerPercent: 20,
      bandwidth: 'FM',
      colorCode: 1,
      timeslot: 2,
      txContactId: 5,
      rxGroupIndex: 2,
      skipScan: true,
      skipZoneScan: false,
      rxOnly: true,
      rxTone: { kind: 'ctcss', hz: 77.0 },
      txTone: { kind: 'none' },
    });
    const decoded = decodeChannelRecord(encodeChannelRecord(dto), 1);
    expect(decoded.wireName).toBe('GB3XX-TG91');
    expect(decoded.mode).toBe('digital');
    expect(decoded.powerPercent).toBe(20);
    expect(decoded.bandwidth).toBe('FM');
    expect(decoded.colorCode).toBe(1);
    expect(decoded.timeslot).toBe(2);
    expect(decoded.txContactId).toBe(5);
    expect(decoded.rxGroupIndex).toBe(2);
    expect(decoded.skipScan).toBe(true);
    expect(decoded.skipZoneScan).toBe(false);
    expect(decoded.rxOnly).toBe(true);
    expect(decoded.rxTone).toEqual({ kind: 'ctcss', hz: 77 });
  });

  it('round-trips analogue squelch on encode/decode', () => {
    const dto = sampleDto({
      mode: 'analog',
      squelchPercent: 50,
    });
    const raw = encodeChannelRecord(dto);
    expect(raw[0x37]).toBe(8);
    const decoded = decodeChannelRecord(raw, 1);
    expect(decoded.squelchPercent).toBe(50);
  });

  it('writes bank0 slot and bank1 slot into image', () => {
    const image = createOpenUv380Image();
    encodeChannelsIntoImage(image, [
      sampleDto({ slotIndex: 1, wireName: 'A1' }),
      sampleDto({ slotIndex: 129, wireName: 'B1', rxHz: 433_000_000, txHz: 433_000_000 }),
    ]);
    const channels = decodeChannelsFromImage(image);
    expect(channels).toHaveLength(OPENGD77_CHANNEL_SLOTS);
    expect(channels[0]?.wireName).toBe('A1');
    expect(channels[0]?.empty).toBe(false);
    expect(channels[128]?.wireName).toBe('B1');
    expect(channels[128]?.empty).toBe(false);
    expect(channels[1]?.empty).toBe(true);
  });
});
