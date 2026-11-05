/**
 * ID database field choice: `essentials` writes name, city and callsign and leaves state, country
 * and remark empty (just their terminator); `all` is byte-identical to the original encoder.
 */
import { describe, expect, it } from 'vitest';
import { encodeBcdAsHexU32 } from './bcd.ts';
import {
  encodeAtD890DigitalContactRecord,
  packAtD890DigitalContacts,
} from './digitalContactCodec.ts';
import { prepareAtD890DigitalContactWrite } from './digitalContactWrite.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';

function wide(text: string, max: number): number[] {
  const t = text.slice(0, max);
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) out.push(t.charCodeAt(i) & 0xff, t.charCodeAt(i) >> 8);
  out.push(0, 0);
  return out;
}

/** The encoder as it was before the field choice, kept verbatim as the reference. */
function referenceRecord(c: RadioDigitalContactDto): Uint8Array {
  return Uint8Array.from([
    0,
    0,
    ...encodeBcdAsHexU32(c.digitalId),
    ...wide(c.wireName, 16),
    ...wide(c.city, 15),
    ...wide(c.callsign, 8),
    ...wide(c.province, 16),
    ...wide(c.country, 16),
    ...wide(c.remark, 16),
  ]);
}

const FULL: RadioDigitalContactDto = {
  wireName: 'Jane Doe',
  digitalId: 2351234,
  callsign: 'MM7ABC',
  city: 'Glasgow',
  province: 'Scotland',
  country: 'United Kingdom',
  remark: 'Club',
};

/** Parse one record: 6-byte header, then six UTF-16LE strings each ended by 00 00. */
function parseRecord(buf: Uint8Array, start: number) {
  const fields: string[] = [];
  let p = start + 6;
  for (let f = 0; f < 6; f++) {
    let s = '';
    while (!(buf[p] === 0 && buf[p + 1] === 0)) {
      s += String.fromCharCode(buf[p]! | (buf[p + 1]! << 8));
      p += 2;
    }
    p += 2;
    fields.push(s);
  }
  return { fields, end: p };
}

function realistic(n: number): RadioDigitalContactDto[] {
  return Array.from({ length: n }, (_, i) => ({
    wireName: `Person${i % 1000} Surname`.slice(0, 16),
    digitalId: 1_000_000 + i,
    callsign: `M${String(i % 100000).padStart(5, '0')}`,
    city: 'Glasgow',
    province: 'Scotland',
    country: 'United Kingdom',
    remark: i % 5 === 0 ? 'Some note' : '',
  }));
}

describe('encodeAtD890DigitalContactRecord field choice', () => {
  it('all is byte-identical to the original encoder', () => {
    for (const c of [FULL, { ...FULL, city: '', remark: '' }, { ...FULL, wireName: '' }]) {
      expect([...encodeAtD890DigitalContactRecord(c, 'all')]).toEqual([...referenceRecord(c)]);
    }
  });

  it('essentials keeps name, city and callsign and empties the rest to bare terminators', () => {
    const rec = encodeAtD890DigitalContactRecord(FULL, 'essentials');
    expect([...rec]).toEqual([
      ...referenceRecord({ ...FULL, province: '', country: '', remark: '' }),
    ]);
    const parsed = parseRecord(rec, 0);
    expect(parsed.fields).toEqual(['Jane Doe', 'Glasgow', 'MM7ABC', '', '', '']);
    expect(parsed.end).toBe(rec.length);
    expect([...rec.subarray(-6)]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('is the same under both choices when the optional fields are already empty', () => {
    const c = { ...FULL, province: '', country: '', remark: '' };
    expect([...encodeAtD890DigitalContactRecord(c, 'essentials')]).toEqual([
      ...encodeAtD890DigitalContactRecord(c, 'all'),
    ]);
  });

  it('stays valid with an empty name or an empty callsign', () => {
    for (const c of [
      { ...FULL, wireName: '' },
      { ...FULL, callsign: '' },
    ]) {
      const rec = encodeAtD890DigitalContactRecord(c, 'essentials');
      const parsed = parseRecord(rec, 0);
      expect(parsed.end).toBe(rec.length);
      expect(parsed.fields[0]).toBe(c.wireName);
      expect(parsed.fields[2]).toBe(c.callsign);
    }
  });
});

describe('packAtD890DigitalContacts field choice', () => {
  it('every record in the stream parses and lines up with the order table', () => {
    const pack = packAtD890DigitalContacts(realistic(500), 'essentials');
    const view = new DataView(pack.orderLinear.buffer, pack.orderLinear.byteOffset);
    const offsets: number[] = [];
    for (let i = 0; i < pack.contactCount; i++) offsets.push(view.getUint32(i * 8 + 4, true));
    offsets.sort((a, b) => a - b);
    let expectedStart = 0;
    for (const off of offsets) {
      expect(off).toBe(expectedStart);
      const parsed = parseRecord(pack.dataLinear, off);
      expect(parsed.fields.slice(3)).toEqual(['', '', '']);
      expectedStart = parsed.end;
    }
    expect(expectedStart).toBe(pack.dataLinear.length);
  });

  it('sends fewer frames by default than for all fields', () => {
    const contacts = realistic(20_000);
    const slim = prepareAtD890DigitalContactWrite(contacts, 'essentials').chunks.length;
    const all = prepareAtD890DigitalContactWrite(contacts, 'all').chunks.length;
    expect(slim).toBeLessThan(all);
    expect(slim / all).toBeLessThan(0.7);
  });
});
