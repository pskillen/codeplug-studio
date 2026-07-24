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
import { createOpenUv380Image } from './memory.ts';
import {
  extractOpenGd77Hydration,
  mergeChannelsIntoOpenGd77Hydration,
} from './hydration.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';

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
});
