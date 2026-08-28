import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { MemoryMap } from '../../types.ts';
import {
  encodeAtD890ChannelRecord,
  encodeChannelsIntoAtD890Image,
  parseAtD890ChannelRecord,
} from './channelCodec.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { AT_D890_INVALID_U16, AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { setBitmapBit } from './bitmap.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';
import { HEALTHY_CHANNEL_RECORDS } from './__fixtures__/healthyChannelRecords.ts';

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
}

function modelledFields(dto: RadioChannelDto) {
  return {
    slotIndex: dto.slotIndex,
    empty: dto.empty,
    wireName: dto.wireName,
    rxHz: dto.rxHz,
    txHz: dto.txHz,
    rxTone: dto.rxTone,
    txTone: dto.txTone,
    powerPercent: dto.powerPercent,
    bandwidth: dto.bandwidth,
    mode: dto.mode,
    txContactId: dto.txContactId,
    rxGroupIndex: dto.rxGroupIndex,
    scanListId: dto.scanListId,
    scanAdd: dto.scanAdd,
    dmrRadioIdIndex: dto.dmrRadioIdIndex,
    timeslot: dto.timeslot,
    rxOnly: dto.rxOnly,
    colorCode: dto.colorCode,
    aprsReceive: dto.aprsReceive,
    aprsReportMode: dto.aprsReportMode,
    aprsDigitalPttMode: dto.aprsDigitalPttMode,
    aprsReportSlotIndex: dto.aprsReportSlotIndex,
  };
}

function plantChannelRecord(image: MemoryMap, slotIndex: number, record: Uint8Array): void {
  const idx = slotIndex - 1;
  image.set(channelPrimaryAddress(idx), record.subarray(0, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE));
  image.set(
    channelSecondaryAddress(idx),
    record.subarray(AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, AT_D890_LIMITS.CHANNEL_RECORD_SIZE),
  );
  const set = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  setBitmapBit(set, idx, true);
  image.set(D890_MAP.ChannelSet, set);
}

function readChannelRecord(image: MemoryMap, slotIndex: number): Uint8Array {
  const idx = slotIndex - 1;
  const combined = new Uint8Array(AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
  combined.set(image.get(channelPrimaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE), 0);
  combined.set(
    image.get(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
  );
  return combined;
}

const simplexDigital: RadioChannelDto = {
  slotIndex: 1,
  empty: false,
  wireName: 'GB7GL',
  rxHz: 438_800_000,
  txHz: 438_800_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: 100,
  bandwidth: 'NFM',
  mode: 'digital',
};

describe('encodeAtD890ChannelRecord', () => {
  it('round-trips a simple FM channel', () => {
    const ch: RadioChannelDto = {
      slotIndex: 1,
      empty: false,
      wireName: 'Test CH',
      rxHz: 145_520_000,
      txHz: 145_520_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'FM',
      mode: 'analog',
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    expect(encoded.length).toBe(0x80);
    expect([...encoded.subarray(0, 4)]).toEqual([0x14, 0x55, 0x20, 0x00]);
    expect((encoded[8]! >> 4) & 0x3).toBe(1);
    const decoded = parseAtD890ChannelRecord(encoded, 1);
    expect(decoded.rxHz).toBe(145_520_000);
    expect(decoded.wireName).toBe('Test CH');
    expect(decoded.powerPercent).toBe(100);
    expect(decoded.bandwidth).toBe('FM');
  });

  it('round-trips colour code and CTCSS indices', () => {
    const ch: RadioChannelDto = {
      slotIndex: 5,
      empty: false,
      wireName: 'DMR',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'ctcss', hz: 88.5 },
      txTone: { kind: 'ctcss', hz: 88.5 },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      colorCode: 0x11,
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    expect((encoded[8]! >> 4) & 0x3).toBe(0);
    expect(encoded[0x20]).toBe(0x11);
    expect(encoded[0x43]).toBe(0x11);
    expect(encoded[0x0a]).toBe(9);
    expect(encoded[0x0b]).toBe(9);
    const decoded = parseAtD890ChannelRecord(encoded, 5);
    expect(decoded.colorCode).toBe(0x11);
    expect(decoded.bandwidth).toBe('NFM');
    expect(decoded.rxTone).toEqual({ kind: 'ctcss', hz: 88.5 });
    expect(decoded.txTone).toEqual({ kind: 'ctcss', hz: 88.5 });
  });

  it('writes unmodelled crypto/talkaround as defaults, not occupant bytes', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'Keep',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
    });
    expect(encoded[0x22]).toBe(0);
    expect(encoded[9]! & 0xd0).toBe(0);
  });

  it('writes omitted txContactId as 0xffff, not talk-group slot 0', () => {
    const encoded = encodeAtD890ChannelRecord(simplexDigital);
    const contactWire = (encoded[0x13]! << 8) | encoded[0x14]!;
    expect(contactWire).toBe(AT_D890_INVALID_U16);
    expect(parseAtD890ChannelRecord(encoded, 1).txContactId).toBeUndefined();
  });

  it('encodes txContactId 1 as talk-group slot 0', () => {
    const encoded = encodeAtD890ChannelRecord({ ...simplexDigital, txContactId: 1 });
    expect(encoded[0x13]).toBe(0);
    expect(encoded[0x14]).toBe(0);
    expect(parseAtD890ChannelRecord(encoded, 1).txContactId).toBe(1);
  });

  it('encodes scan-list and RX-group none as 0xff', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 2,
      empty: false,
      wireName: 'None FK',
      rxHz: 430_000_000,
      txHz: 430_000_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
    });
    expect(encoded[0x1b]).toBe(0xff);
    expect(encoded[0x1c]).toBe(0xff);
  });

  it('writes RX-group none as 0xff when DTO omits rxGroupIndex', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'None RGL',
      rxHz: 438_800_000,
      txHz: 434_000_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
    });
    expect(encoded[0x1c]).toBe(0xff);
  });

  it('writes the DTO RX-group index', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'Scratch',
      rxHz: 438_800_000,
      txHz: 434_000_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      rxGroupIndex: 2,
    });
    expect(encoded[0x1c]).toBe(2);
  });

  it('encodes DCS tones', () => {
    const ch: RadioChannelDto = {
      slotIndex: 2,
      empty: false,
      wireName: 'DCS',
      rxHz: 430_000_000,
      txHz: 430_000_000,
      rxTone: { kind: 'dcs', code: 123, polarity: 'N' },
      txTone: { kind: 'dcs', code: 456, polarity: 'I' },
      powerPercent: 50,
      bandwidth: 'NFM',
      mode: 'digital',
      timeslot: 2,
      scanAdd: false,
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    const decoded = parseAtD890ChannelRecord(encoded, 2);
    expect(decoded.rxTone).toEqual({ kind: 'dcs', code: 123, polarity: 'N' });
    expect(decoded.txTone).toEqual({ kind: 'dcs', code: 456, polarity: 'I' });
    expect(decoded.timeslot).toBe(2);
    expect(decoded.scanAdd).toBe(false);
    expect((encoded[0x34]! >> 4) & 1).toBe(0);
  });

  it('encodes timeslot on 0x21 bit 0 and leaves SMS confirm on bit 1', () => {
    const ts1 = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'TS1',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      timeslot: 1,
    });
    const ts2 = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'TS2',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      timeslot: 2,
    });
    expect(ts1[0x21]! & 1).toBe(0);
    expect(ts2[0x21]! & 1).toBe(1);
    expect((ts1[0x21]! >> 1) & 1).toBe(1);
    expect((ts2[0x21]! >> 1) & 1).toBe(1);
    expect(parseAtD890ChannelRecord(ts1, 1).timeslot).toBe(1);
    expect(parseAtD890ChannelRecord(ts2, 1).timeslot).toBe(2);
  });

  it('encodes timeslot 1, auto-scan off, and SMS confirm On', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'Clear',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      timeslot: 1,
      scanAdd: false,
    });
    expect(encoded[0x21]! & 1).toBe(0);
    expect((encoded[0x21]! >> 1) & 1).toBe(1);
    expect((encoded[0x34]! >> 4) & 1).toBe(0);
  });

  it('encodes DMR MODE on 0x21 bits 2-3 as DMO or repeater', () => {
    const base = {
      slotIndex: 1,
      empty: false as const,
      wireName: 'DMR',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'none' as const },
      txTone: { kind: 'none' as const },
      powerPercent: 100,
      bandwidth: 'NFM' as const,
      mode: 'digital' as const,
    };
    const dmo = encodeAtD890ChannelRecord({ ...base, dmrOperatingMode: 'dmo-simplex' });
    const repeater = encodeAtD890ChannelRecord({ ...base, dmrOperatingMode: 'repeater' });
    expect((dmo[0x21]! >> 2) & 0x3).toBe(0);
    expect((repeater[0x21]! >> 2) & 0x3).toBe(1);
  });

  it('writes DMR MODE repeater and SMS confirm On', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'Rpt',
      rxHz: 438_800_000,
      txHz: 434_000_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      dmrOperatingMode: 'repeater',
    });
    expect((encoded[0x21]! >> 2) & 0x3).toBe(1);
    expect((encoded[0x21]! >> 1) & 1).toBe(1);
  });

  it('preserves ChannelSet bits at or above MAX_CHANNELS on Write', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const set = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
    setBitmapBit(set, 4000, true);
    setBitmapBit(set, 4001, true);
    image.set(D890_MAP.ChannelSet, set);

    encodeChannelsIntoAtD890Image(image, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH1',
        rxHz: 145_520_000,
        txHz: 145_520_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'analog',
      },
    ]);

    const after = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
    expect((after[500]! & 0x01) !== 0).toBe(true); // bit 4000
    expect((after[500]! & 0x02) !== 0).toBe(true); // bit 4001
    expect((after[0]! & 0x01) !== 0).toBe(true); // bit 0 set for channel 1
  });

  it('does not copy hotspot occupant bytes onto a different DTO at the same slot', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const occupant = new Uint8Array(0x80);
    occupant.set([0x43, 0x01, 0x25, 0x00], 0);
    occupant.set([0x00, 0x60, 0x00, 0x00], 4);
    occupant[8] = 0x41;
    occupant[9] = 0xd0;
    occupant[0x13] = 0x00;
    occupant[0x14] = 0x01;
    occupant[0x21] = 0x00;
    occupant[0x22] = 0xfd;
    plantChannelRecord(image, 7, occupant);

    encodeChannelsIntoAtD890Image(image, [{ ...simplexDigital, slotIndex: 7 }]);

    const encoded = readChannelRecord(image, 7);
    expect(encoded[9]! & 0xd0).toBe(0);
    expect((encoded[0x21]! >> 1) & 1).toBe(1);
    expect(encoded[0x22]).toBe(0);
    expect([...encoded.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
    expect((encoded[0x13]! << 8) | encoded[0x14]!).toBe(AT_D890_INVALID_U16);
  });

  it('returns empty record for vacant slot', () => {
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 3,
      empty: true,
      wireName: '',
      rxHz: 0,
      txHz: 0,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: null,
      bandwidth: 'NFM',
    });
    expect(encoded[0]).toBe(0);
    expect(encoded[1]).toBe(0);
  });

  it('round-trips modelled fields of healthy forensic records with write-defaults', () => {
    for (const { slotIndex, bytesHex } of HEALTHY_CHANNEL_RECORDS) {
      const original = hexToBytes(bytesHex);
      const dto = parseAtD890ChannelRecord(original, slotIndex);
      const encoded = encodeAtD890ChannelRecord(dto);
      expect(modelledFields(parseAtD890ChannelRecord(encoded, slotIndex))).toEqual(
        modelledFields(dto),
      );
      expect((encoded[0x21]! >> 1) & 1).toBe(1);
      expect(encoded[0x22]).toBe(0);
      if (dto.txContactId == null) {
        expect((encoded[0x13]! << 8) | encoded[0x14]!).toBe(AT_D890_INVALID_U16);
      }
      if (original[0x1c] === 0) {
        expect(encoded[0x1c]).toBe(0xff);
      }
    }
  });

  it('encodes and decodes digital APRS channel bindings', () => {
    const ch: RadioChannelDto = {
      slotIndex: 2,
      empty: false,
      wireName: 'APRS',
      rxHz: 430_125_000,
      txHz: 430_125_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      aprsReceive: true,
      aprsReportMode: 'digital',
      aprsDigitalPttMode: 'on',
      aprsReportSlotIndex: 3,
    };
    const encoded = encodeAtD890ChannelRecord(ch);
    expect((encoded[0x21]! >> 5) & 1).toBe(1);
    expect(encoded[0x35]).toBe(2);
    expect(encoded[0x37]).toBe(1);
    expect(encoded[0x38]).toBe(2);
    expect(encoded[0x36]).toBe(0);
    const decoded = parseAtD890ChannelRecord(encoded, 2);
    expect(decoded.aprsReceive).toBe(true);
    expect(decoded.aprsReportMode).toBe('digital');
    expect(decoded.aprsDigitalPttMode).toBe('on');
    expect(decoded.aprsReportSlotIndex).toBe(3);
  });
});
