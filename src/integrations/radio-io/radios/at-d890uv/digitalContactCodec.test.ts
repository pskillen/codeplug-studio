import { describe, expect, it } from 'vitest';
import {
  encodeAtD890DigitalContactRecord,
  packAtD890DigitalContacts,
} from './digitalContactCodec.ts';
import { D890_MAP } from './constants.ts';

describe('encodeAtD890DigitalContactRecord', () => {
  it('encodes private call type and BCD radio id', () => {
    const record = encodeAtD890DigitalContactRecord({
      wireName: 'Contact 1',
      digitalId: 1234567,
      callsign: 'CALL',
      city: 'City',
      province: 'State',
      country: 'Country',
      remark: 'Note',
    });
    expect(record[0]).toBe(0);
    expect(record[1]).toBe(0);
    expect(record.length).toBeGreaterThan(6);
  });
});

describe('packAtD890DigitalContacts', () => {
  it('packs many contacts without pre-building a directory row array', () => {
    const contacts = Array.from({ length: 500 }, (_, i) => ({
      wireName: `User${i}`,
      digitalId: 1_000_000 + i,
      callsign: '',
      city: '',
      province: '',
      country: '',
      remark: '',
    }));

    const pack = packAtD890DigitalContacts(contacts);
    expect(pack.contactCount).toBe(500);
    expect(pack.dataLinear.length).toBeGreaterThan(0);
    expect(pack.orderLinear.length).toBeGreaterThan(0);
    expect(pack.stagingChunks.some((c) => c.address === D890_MAP.DigitalContactMeta)).toBe(true);
  });
});
