import { describe, expect, it } from 'vitest';
import {
  decodeContactRecord,
  encodeBcd8Be,
  encodeContactRecord,
  encodeContactsIntoImage,
  decodeContactsFromImage,
  decodeBcd8Be,
  mergeOrganisationContacts,
  contactIndexByDigitalId,
} from './contactCodec.ts';
import { encodeZonesIntoImage, decodeZonesFromImage } from './zoneCodec.ts';
import { encodeRxGroupsIntoImage, decodeRxGroupsFromImage } from './rxGroupCodec.ts';
import { createOpenUv380Image, openUv380ImageToBytes, readAbs, writeAbs } from './memory.ts';
import { extractOpenGd77Hydration, mergeChannelsIntoOpenGd77Hydration } from './hydration.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  channelRecordAbs,
  decodeChannelRecord,
  decodeChannelsFromImage,
  encodeChannelsIntoImage,
} from './channelCodec.ts';
import {
  OPENGD77_CHANNEL_RECORD_SIZE,
  OPENGD77_ZONE_BANK_SIZE,
  OPENUV380_OFFSET,
  openUv380AbsToOffset,
} from './constants.ts';

describe('opengd77 contactCodec', () => {
  it('round-trips BCD8 BE DMR id', () => {
    expect(decodeBcd8Be(encodeBcd8Be(2_345_678))).toBe(2_345_678);
  });

  it('round-trips contact record', () => {
    const rec = encodeContactRecord({
      index: 1,
      wireName: 'TG91',
      digitalId: 91,
      callType: 0,
    });
    const decoded = decodeContactRecord(rec, 1);
    expect(decoded).toEqual({
      index: 1,
      wireName: 'TG91',
      digitalId: 91,
      callType: 0,
    });
  });

  it('encodes Force TS1 and Force TS2 on contact byte 0x17', () => {
    const ts1 = encodeContactRecord({
      index: 1,
      wireName: 'Scot TS1',
      digitalId: 2355,
      callType: 0,
      timeSlotOverride: 1,
    });
    const ts2 = encodeContactRecord({
      index: 2,
      wireName: 'Scot TS2',
      digitalId: 2355,
      callType: 0,
      timeSlotOverride: 2,
    });
    expect(ts1[0x17]).toBe(0x00);
    expect(ts2[0x17]).toBe(0x02);
  });

  it('writes contacts into image bank', () => {
    const image = createOpenUv380Image();
    encodeContactsIntoImage(image, [
      { index: 1, wireName: 'TG91', digitalId: 91, callType: 0 },
      { index: 3, wireName: 'Alice', digitalId: 1234567, callType: 1 },
    ]);
    const decoded = decodeContactsFromImage(image);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]?.digitalId).toBe(91);
    expect(decoded[1]?.index).toBe(3);
  });

  it('merges talk groups and digital contacts', () => {
    const merged = mergeOrganisationContacts(
      [{ index: 1, wireName: 'TG91', digitalId: 91, callType: 1 }],
      [
        {
          wireName: 'Bob',
          digitalId: 999,
          callsign: 'Bob',
          city: '',
          province: '',
          country: '',
          remark: '',
        },
      ],
    );
    expect(merged[0]?.callType).toBe(0);
    expect(merged[1]?.callType).toBe(1);
    expect(merged[1]?.index).toBe(2);
  });
});

describe('opengd77 zoneCodec', () => {
  it('round-trips zones with members', () => {
    const image = createOpenUv380Image();
    encodeZonesIntoImage(image, [
      { wireName: 'Home', channelNumbers: [1, 2, 5] },
      { wireName: 'Travel', channelNumbers: [10] },
    ]);
    const zones = decodeZonesFromImage(image);
    expect(zones).toHaveLength(2);
    expect(zones[0]).toEqual({ wireName: 'Home', channelNumbers: [1, 2, 5] });
    expect(zones[1]).toEqual({ wireName: 'Travel', channelNumbers: [10] });
  });
});

describe('opengd77 rxGroupCodec', () => {
  it('encodes members as contact indices resolved from digital ids', () => {
    const image = createOpenUv380Image();
    const contacts = [
      { index: 1, wireName: 'TG91', digitalId: 91, callType: 0 },
      { index: 2, wireName: 'TG9', digitalId: 9, callType: 0 },
    ];
    encodeContactsIntoImage(image, contacts);
    const byId = contactIndexByDigitalId(contacts);
    encodeRxGroupsIntoImage(
      image,
      [{ index: 1, wireName: 'Local', memberDigitalIds: [91, 9] }],
      byId,
    );
    const byIndex = new Map(contacts.map((c) => [c.index, c.digitalId]));
    const groups = decodeRxGroupsFromImage(image, byIndex);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.memberDigitalIds).toEqual([91, 9]);
  });
});

describe('opengd77 hydration', () => {
  it('extracts contiguous bag and merges organisation', () => {
    const image = createOpenUv380Image();
    const bag = extractOpenGd77Hydration(image, { firmware: 'R20240101000000' });
    expect(bag.formatId).toBe('radio-clone');
    expect(bag.retain.firmware).toBe('R20240101000000');

    const channel: RadioChannelDto = {
      slotIndex: 1,
      empty: false,
      wireName: 'CH1',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      txContactId: 1,
    };
    const next = mergeChannelsIntoOpenGd77Hydration(bag, [channel], {
      talkGroups: [{ index: 1, wireName: 'TG91', digitalId: 91, callType: 0 }],
      zones: [{ wireName: 'Z1', channelNumbers: [1] }],
      rxGroups: [{ index: 1, wireName: 'RX1', memberDigitalIds: [91] }],
    });
    expect(next.size).toBe(image.size);
  });

  it('keeps prior contact and RX banks when organisation keys are omitted', () => {
    const image = createOpenUv380Image();
    const priorContacts = [{ index: 1, wireName: 'OLD-TG', digitalId: 42, callType: 0 }];
    encodeContactsIntoImage(image, priorContacts);
    encodeZonesIntoImage(image, [{ wireName: 'OldZone', channelNumbers: [3, 4] }]);
    const byId = contactIndexByDigitalId(priorContacts);
    encodeRxGroupsIntoImage(image, [{ index: 1, wireName: 'OldRx', memberDigitalIds: [42] }], byId);

    const bag = extractOpenGd77Hydration(image);
    const merged = mergeChannelsIntoOpenGd77Hydration(bag, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'NEW',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
      },
    ]);

    expect(decodeContactsFromImage(merged)).toEqual([
      expect.objectContaining({ digitalId: 42, wireName: 'OLD-TG' }),
    ]);
    expect(decodeRxGroupsFromImage(merged, new Map([[1, 42]]))).toEqual([
      expect.objectContaining({ wireName: 'OldRx' }),
    ]);
    expect(decodeZonesFromImage(merged)).toHaveLength(0);
    const zoneBank = readAbs(merged, OPENUV380_OFFSET.zoneBank, OPENGD77_ZONE_BANK_SIZE);
    expect(zoneBank.every((b) => b === 0x00)).toBe(true);
  });

  it('replaces dirty channel unmodelled bytes with encode defaults and keeps D023N tone', () => {
    const image = createOpenUv380Image();
    const dirtySlot = 5;
    encodeChannelsIntoImage(image, [
      {
        slotIndex: dirtySlot,
        empty: false,
        wireName: 'DIRTY',
        rxHz: 433_500_000,
        txHz: 433_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
      },
    ]);
    const dirtyRec = readAbs(image, channelRecordAbs(dirtySlot), OPENGD77_CHANNEL_RECORD_SIZE);
    dirtyRec[0x1b] = 0x0a; // txTimeout (non-default)
    dirtyRec[0x26] = 0xff; // flags
    dirtyRec[0x27] = 0xaa; // dmrId byte 0
    dirtyRec[0x2d] = 0x03; // aprsIndex
    dirtyRec[0x30] = 0x02; // alias
    dirtyRec[0x37] = 0x0f; // squelch closed
    writeAbs(image, channelRecordAbs(dirtySlot), dirtyRec);

    const bag = extractOpenGd77Hydration(image);
    const projection: RadioChannelDto = {
      slotIndex: 1,
      empty: false,
      wireName: 'CLEAN',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'dcs', code: 23, polarity: 'N' },
      txTone: { kind: 'none' },
      powerPercent: 20,
      bandwidth: 'FM',
      mode: 'digital',
      colorCode: 1,
      timeslot: 2,
    };
    const merged = mergeChannelsIntoOpenGd77Hydration(bag, [projection]);

    const channels = decodeChannelsFromImage(merged);
    expect(channels[dirtySlot - 1]?.empty).toBe(true);
    const encoded = decodeChannelRecord(
      readAbs(merged, channelRecordAbs(1), OPENGD77_CHANNEL_RECORD_SIZE),
      1,
    );
    expect(encoded.wireName).toBe('CLEAN');
    expect(encoded.rxTone).toEqual({ kind: 'dcs', code: 23, polarity: 'N' });
    expect(encoded.bandwidth).toBe('FM');
    expect(encoded.timeslot).toBe(2);

    const raw = readAbs(merged, channelRecordAbs(1), OPENGD77_CHANNEL_RECORD_SIZE);
    expect(raw[0x1b]).toBe(0); // txTimeout default
    expect(raw[0x26]).toBe(0); // flags clear
    expect(raw[0x27]).toBe(0); // dmrId clear
    expect(raw[0x2d]).toBe(0); // aprsIndex clear
    expect(raw[0x30]).toBe(0); // alias none
    expect(raw[0x37]).toBe(0); // squelch global
  });

  it('keeps settings, APRS, DTMF, and VFO spans unchanged on merge', () => {
    const image = createOpenUv380Image();
    const keptMarkers: { abs: number; value: number }[] = [
      { abs: OPENUV380_OFFSET.settings + 0x10, value: 0xa1 },
      { abs: OPENUV380_OFFSET.aprsSettings + 0x08, value: 0xb2 },
      { abs: OPENUV380_OFFSET.dtmfSettings + 0x04, value: 0xc3 },
      { abs: OPENUV380_OFFSET.vfoA + 0x18, value: 0xd4 },
      { abs: OPENUV380_OFFSET.vfoB + 0x20, value: 0xe5 },
    ];
    for (const { abs, value } of keptMarkers) {
      image.bytes[openUv380AbsToOffset(abs)] = value;
    }

    const priorBytes = openUv380ImageToBytes(image);
    const bag = extractOpenGd77Hydration(image);
    const merged = mergeChannelsIntoOpenGd77Hydration(
      bag,
      [
        {
          slotIndex: 2,
          empty: false,
          wireName: 'KEEP',
          rxHz: 146_520_000,
          txHz: 146_520_000,
          rxTone: { kind: 'none' },
          txTone: { kind: 'none' },
          powerPercent: 100,
          bandwidth: 'NFM',
        },
      ],
      {
        talkGroups: [{ index: 1, wireName: 'TG1', digitalId: 1, callType: 0 }],
        zones: [{ wireName: 'Z', channelNumbers: [2] }],
        rxGroups: [{ index: 1, wireName: 'RX', memberDigitalIds: [1] }],
      },
    );
    const mergedBytes = openUv380ImageToBytes(merged);
    for (const { abs, value } of keptMarkers) {
      expect(mergedBytes[openUv380AbsToOffset(abs)]).toBe(value);
      expect(mergedBytes[openUv380AbsToOffset(abs)]).toBe(priorBytes[openUv380AbsToOffset(abs)]);
    }
  });
});
