import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { MemoryMap } from '../../types.ts';
import {
  encodeAtD890ChannelRecord,
  encodeChannelsIntoAtD890Image,
  parseAtD890ChannelRecord,
} from './channelCodec.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { listDescriptorsForProfile } from '../../registry.ts';
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
    dmrOperatingMode: dto.dmrOperatingMode,
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

  it('writes omitted txContactId as five zero bytes (contact slot 0)', () => {
    const analog = { ...simplexDigital, mode: 'analog' as const, bandwidth: 'FM' as const };
    for (const ch of [simplexDigital, analog]) {
      const encoded = encodeAtD890ChannelRecord(ch);
      expect([...encoded.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);
    }
    // Digital slot 0 parses as txContactId 1. Analog records do not carry a TX contact.
    expect(
      parseAtD890ChannelRecord(encodeAtD890ChannelRecord(simplexDigital), simplexDigital.slotIndex)
        .txContactId,
    ).toBe(1);
    expect(
      parseAtD890ChannelRecord(encodeAtD890ChannelRecord(analog), analog.slotIndex).txContactId,
    ).toBeUndefined();
  });

  it('encodes txContactId 1 as talk-group slot 0', () => {
    const encoded = encodeAtD890ChannelRecord({ ...simplexDigital, txContactId: 1 });
    expect(encoded[0x13]).toBe(0);
    expect(encoded[0x14]).toBe(0);
    expect(encoded[0x15]).toBe(0);
    expect(encoded[0x16]).toBe(0);
    expect(encoded[0x17]).toBe(0);
    expect(parseAtD890ChannelRecord(encoded, 1).txContactId).toBe(1);
  });

  it('encodes txContactId 257 as a little-endian u32 at 0x14', () => {
    for (const mode of ['digital', 'fixed-digital'] as const) {
      const encoded = encodeAtD890ChannelRecord({ ...simplexDigital, mode, txContactId: 257 });
      expect(encoded[0x13]).toBe(0);
      expect(encoded[0x14]).toBe(0x00);
      expect(encoded[0x15]).toBe(0x01);
      expect(encoded[0x16]).toBe(0);
      expect(encoded[0x17]).toBe(0);
      expect(parseAtD890ChannelRecord(encoded, 1).txContactId).toBe(257);
    }
  });

  it('decodes a digital contact as none when byte 0x17 is 0x7F or 0x80', () => {
    for (const high of [0x7f, 0x80]) {
      const record = encodeAtD890ChannelRecord({ ...simplexDigital, txContactId: 2 });
      record[0x14] = 0x11;
      record[0x15] = 0x22;
      record[0x16] = 0x33;
      record[0x17] = high;
      expect(parseAtD890ChannelRecord(record, 1).txContactId).toBeUndefined();
    }
  });

  it('decodes an all-zero digital contact word as talk-group id 1', () => {
    const record = encodeAtD890ChannelRecord({ ...simplexDigital, txContactId: 2 });
    record[0x13] = 0;
    record[0x14] = 0;
    record[0x15] = 0;
    record[0x16] = 0;
    record[0x17] = 0;
    expect(parseAtD890ChannelRecord(record, 1).txContactId).toBe(1);
  });

  it('shares the channel contact and RX-group encoder between stock and MM9PDY', () => {
    const stock = listDescriptorsForProfile('radio-io', 'radio-io-at-d890uv');
    const mm9 = listDescriptorsForProfile('radio-io', 'radio-io-at-d890uv-mm9pdy');
    expect(stock).toHaveLength(1);
    expect(mm9).toHaveLength(1);
    expect(stock[0]).toBe(mm9[0]);
    const omitted = encodeAtD890ChannelRecord(simplexDigital);
    expect([...omitted.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);
    const wide = encodeAtD890ChannelRecord({ ...simplexDigital, txContactId: 257 });
    expect([...wide.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x01, 0x00, 0x00]);
    const firstList = encodeAtD890ChannelRecord({ ...simplexDigital, rxGroupIndex: 1 });
    expect(firstList[0x1c]).toBe(0);
    const secondList = encodeAtD890ChannelRecord({ ...simplexDigital, rxGroupIndex: 2 });
    expect(secondList[0x1c]).toBe(1);
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

  it('writes the DTO RX-group index as a 0-based wire byte', () => {
    const first = encodeAtD890ChannelRecord({
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
      rxGroupIndex: 1,
    });
    expect(first[0x1b]).toBe(0xff);
    expect(first[0x1c]).toBe(0);
    expect(parseAtD890ChannelRecord(first, 1).rxGroupIndex).toBe(1);

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
    expect(encoded[0x1b]).toBe(0xff);
    expect(encoded[0x1c]).toBe(1);
    expect(parseAtD890ChannelRecord(encoded, 1).rxGroupIndex).toBe(2);
  });

  it('parses RX-group wire 0 as DTO index 1', () => {
    const record = encodeAtD890ChannelRecord(simplexDigital);
    record[0x1c] = 0;
    expect(parseAtD890ChannelRecord(record, 1).rxGroupIndex).toBe(1);
  });

  it('encodes DCS tones', () => {
    const ch: RadioChannelDto = {
      slotIndex: 2,
      empty: false,
      wireName: 'DCS',
      rxHz: 430_000_000,
      txHz: 430_000_000,
      rxTone: { kind: 'dcs', code: 23, polarity: 'N' },
      txTone: { kind: 'dcs', code: 23, polarity: 'N' },
      powerPercent: 50,
      bandwidth: 'NFM',
      mode: 'digital',
      timeslot: 2,
      scanAdd: false,
    };
    const normal = encodeAtD890ChannelRecord(ch);
    expect(normal[0x0c]).toBe(0x13);
    expect(normal[0x0d]).toBe(0x00);
    expect(normal[0x0e]).toBe(0x13);
    expect(normal[0x0f]).toBe(0x00);

    const inverted = encodeAtD890ChannelRecord({
      ...ch,
      rxTone: { kind: 'dcs', code: 23, polarity: 'I' },
      txTone: { kind: 'dcs', code: 23, polarity: 'I' },
    });
    expect(inverted[0x0c]).toBe(0x13);
    expect(inverted[0x0d]).toBe(0x02);
    expect(inverted[0x0e]).toBe(0x13);
    expect(inverted[0x0f]).toBe(0x02);

    const planted = encodeAtD890ChannelRecord({
      ...ch,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
    });
    planted[0x09] = (2 << 2) | 2;
    planted[0x0e] = 0x13;
    planted[0x0f] = 0x02;
    expect(parseAtD890ChannelRecord(planted, 2).rxTone).toEqual({
      kind: 'dcs',
      code: 23,
      polarity: 'I',
    });

    planted[0x0c] = 0x23;
    planted[0x0d] = 0x80;
    expect(parseAtD890ChannelRecord(planted, 2).txTone).not.toEqual({
      kind: 'dcs',
      code: 23,
      polarity: 'N',
    });

    const decoded = parseAtD890ChannelRecord(normal, 2);
    expect(decoded.timeslot).toBe(2);
    expect(decoded.scanAdd).toBe(false);
    expect((normal[0x34]! >> 4) & 1).toBe(0);
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

  it('encodes DMO vs repeater on 0x34 bit 1 and keeps 0x21 bits 2-3 clear', () => {
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
    const repeater = encodeAtD890ChannelRecord({
      ...base,
      rxHz: 438_800_000,
      txHz: 434_000_000,
      dmrOperatingMode: 'repeater',
    });
    expect((dmo[0x21]! >> 2) & 0x3).toBe(0);
    expect((repeater[0x21]! >> 2) & 0x3).toBe(0);
    expect((dmo[0x34]! >> 1) & 1).toBe(1);
    expect((repeater[0x34]! >> 1) & 1).toBe(0);
    expect(parseAtD890ChannelRecord(dmo, 1).dmrOperatingMode).toBe('dmo-simplex');
    expect(parseAtD890ChannelRecord(repeater, 1).dmrOperatingMode).toBe('repeater');
  });

  it('writes rxOnly on 0x34 bit 3 and leaves 0x09 bit 5 clear', () => {
    const encoded = encodeAtD890ChannelRecord({
      ...simplexDigital,
      rxOnly: true,
      dmrOperatingMode: 'dmo-simplex',
      scanAdd: true,
    });
    expect((encoded[0x34]! >> 3) & 1).toBe(1);
    expect((encoded[9]! >> 5) & 1).toBe(0);
    expect((encoded[0x34]! >> 1) & 1).toBe(1);
    expect((encoded[0x34]! >> 4) & 1).toBe(1);
    expect(parseAtD890ChannelRecord(encoded, 1).rxOnly).toBe(true);
  });

  it('leaves 0x34 bit 3 clear when rxOnly is omitted or false', () => {
    const omitted = encodeAtD890ChannelRecord(simplexDigital);
    const explicitFalse = encodeAtD890ChannelRecord({ ...simplexDigital, rxOnly: false });
    expect((omitted[0x34]! >> 3) & 1).toBe(0);
    expect((explicitFalse[0x34]! >> 3) & 1).toBe(0);
    expect((omitted[9]! >> 5) & 1).toBe(0);
  });

  it('decodes rxOnly from 0x34 bit 3 only', () => {
    const rxOnlyRecord = encodeAtD890ChannelRecord(simplexDigital);
    rxOnlyRecord[0x34] = 1 << 3;
    expect(parseAtD890ChannelRecord(rxOnlyRecord, 1).rxOnly).toBe(true);

    const pttProhibit = encodeAtD890ChannelRecord(simplexDigital);
    pttProhibit[9] = 1 << 5;
    expect(parseAtD890ChannelRecord(pttProhibit, 1).rxOnly).toBe(false);
  });

  it('writes DMR MODE repeater on 0x34 bit 1 and SMS confirm On', () => {
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
    expect((encoded[0x21]! >> 2) & 0x3).toBe(0);
    expect((encoded[0x21]! >> 1) & 1).toBe(1);
    expect((encoded[0x34]! >> 1) & 1).toBe(0);
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
    expect(encoded[0x22]).toBe(0xfd);
    expect([...encoded.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
    expect([...encoded.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);
  });

  it('keeps NXDN and AES from a downloaded slot and rewrites the contact', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const prior = encodeAtD890ChannelRecord({ ...simplexDigital, txContactId: 9 });
    prior[0x10] = 0x10;
    prior[0x11] = 0x11;
    prior[0x12] = 0x12;
    prior[0x19] = 0x19;
    prior[0x1a] = 0x1a;
    prior[0x1d] = 0x1d;
    prior[0x1e] = 0x1e;
    prior[0x1f] = 0x1f;
    prior[0x22] = 0xab;
    prior[0x36] = 0x36;
    for (let offset = 0x39; offset <= 0x41; offset++) prior[offset] = offset;
    for (let offset = 0x66; offset <= 0x6e; offset++) prior[offset] = offset;
    prior[0x09] = 0xd0;
    prior[0x13] = 0xee;
    prior[0x14] = 0x11;
    prior[0x15] = 0x22;
    prior[0x16] = 0x33;
    prior[0x17] = 0x44;
    prior[0x1c] = 0x05;
    prior[0x23] = 0x23;
    prior[0x35] = 0x35;
    prior[0x37] = 0x37;
    prior[0x38] = 0x38;
    prior[0x42] = 0x42;
    prior[0x64] = 0x64;
    prior[0x65] = 0x65;
    prior[0x6f] = 0x6f;
    plantChannelRecord(image, 3, prior);
    plantChannelRecord(image, 8, prior);

    encodeChannelsIntoAtD890Image(image, [{ ...simplexDigital, slotIndex: 3 }]);

    const encoded = readChannelRecord(image, 3);
    expect([...encoded.subarray(0x10, 0x13)]).toEqual([0x10, 0x11, 0x12]);
    expect([...encoded.subarray(0x19, 0x1b)]).toEqual([0x19, 0x1a]);
    expect([...encoded.subarray(0x1d, 0x20)]).toEqual([0x1d, 0x1e, 0x1f]);
    expect(encoded[0x22]).toBe(0xab);
    expect(encoded[0x36]).toBe(0x36);
    expect([...encoded.subarray(0x39, 0x42)]).toEqual(
      Array.from({ length: 0x42 - 0x39 }, (_, i) => 0x39 + i),
    );
    expect([...encoded.subarray(0x66, 0x6f)]).toEqual(
      Array.from({ length: 0x6f - 0x66 }, (_, i) => 0x66 + i),
    );
    expect([...encoded.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(encoded[9]! & 0xd0).toBe(0);
    expect(encoded[0x1c]).toBe(0xff);
    expect(encoded[0x23]).toBe(0);
    expect(encoded[0x35]).toBe(0);
    expect(encoded[0x37]).toBe(0);
    expect(encoded[0x38]).toBe(0);
    expect(encoded[0x42]).toBe(0);
    expect(encoded[0x64]).toBe(0);
    expect(encoded[0x65]).toBe(0);
    expect(encoded[0x6f]).toBe(0);
    expect([...readChannelRecord(image, 8)]).toEqual(Array.from({ length: 0x80 }, () => 0));

    const withContact = createMemoryMap(AT_D890_MAP_SIZE);
    plantChannelRecord(withContact, 3, prior);
    encodeChannelsIntoAtD890Image(withContact, [
      { ...simplexDigital, slotIndex: 3, txContactId: 257 },
    ]);
    expect([...readChannelRecord(withContact, 3).subarray(0x13, 0x18)]).toEqual([
      0x00, 0x00, 0x01, 0x00, 0x00,
    ]);
  });

  it('keeps unmodelled 0x34 bits and writes DMO, RX-only, and auto scan from the DTO', () => {
    const unmodelled = (1 << 0) | (1 << 2) | (1 << 5) | (1 << 6) | (1 << 7);
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    const prior = encodeAtD890ChannelRecord(simplexDigital);
    prior[0x34] = unmodelled;
    plantChannelRecord(image, 4, prior);
    encodeChannelsIntoAtD890Image(image, [
      {
        ...simplexDigital,
        slotIndex: 4,
        dmrOperatingMode: 'dmo-simplex',
        scanAdd: true,
        rxOnly: true,
      },
    ]);
    const encoded = readChannelRecord(image, 4);
    expect(encoded[0x34]! & unmodelled).toBe(unmodelled);
    expect((encoded[0x34]! >> 1) & 1).toBe(1);
    expect((encoded[0x34]! >> 3) & 1).toBe(1);
    expect((encoded[0x34]! >> 4) & 1).toBe(1);

    const cleared = createMemoryMap(AT_D890_MAP_SIZE);
    const sticky = encodeAtD890ChannelRecord(simplexDigital);
    sticky[0x34] = 0xff;
    plantChannelRecord(cleared, 4, sticky);
    encodeChannelsIntoAtD890Image(cleared, [{ ...simplexDigital, slotIndex: 4 }]);
    const off = readChannelRecord(cleared, 4);
    expect(off[0x34]! & unmodelled).toBe(unmodelled);
    expect((off[0x34]! >> 1) & 1).toBe(0);
    expect((off[0x34]! >> 3) & 1).toBe(0);
    expect((off[0x34]! >> 4) & 1).toBe(0);
  });

  it('leaves preserve ranges at 0 when there is no real prior', () => {
    const noPrior = encodeAtD890ChannelRecord(simplexDigital);
    expect(noPrior[0x22]).toBe(0);
    expect(noPrior[0x66]).toBe(0);
    expect([...noPrior.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);

    const zeros = new Uint8Array(0x80);
    zeros[0x22] = 0xab;
    zeros[0x66] = 0xcd;
    const fromZeros = encodeAtD890ChannelRecord(simplexDigital, zeros);
    expect(fromZeros[0x22]).toBe(0);
    expect(fromZeros[0x66]).toBe(0);

    const virgin = new Uint8Array(0x80);
    virgin.fill(0xff);
    const fromVirgin = encodeAtD890ChannelRecord(simplexDigital, virgin);
    expect(fromVirgin[0x22]).toBe(0);
    expect(fromVirgin[0x66]).toBe(0);
    expect([...fromVirgin.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);

    const shortPrior = new Uint8Array(0x40);
    shortPrior[0] = 0x43;
    shortPrior[0x22] = 0xab;
    expect(encodeAtD890ChannelRecord(simplexDigital, shortPrior)[0x22]).toBe(0);

    const image = createMemoryMap(AT_D890_MAP_SIZE);
    plantChannelRecord(image, 1, virgin);
    encodeChannelsIntoAtD890Image(image, [simplexDigital]);
    const encoded = readChannelRecord(image, 1);
    expect(encoded[0x22]).toBe(0);
    expect(encoded[0x66]).toBe(0);
    expect(encoded[0x6e]).toBe(0);
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
        expect([...encoded.subarray(0x13, 0x18)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x00]);
      }
      if (slotIndex === 17) {
        expect(original[0x1c]).toBe(0);
        expect(encoded[0x1c]).toBe(0);
        expect(dto.rxGroupIndex).toBe(1);
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
