import { describe, expect, it } from 'vitest';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import {
  OPENUV380_USER_DB_ENTRIES0_MAX,
  OPENUV380_USER_DB_ENTRY_SIZE,
  OPENUV380_USER_DB_HEADER_ABS,
  OPENUV380_USER_DB_ENTRIES1_ABS,
} from './constants.ts';
import {
  composeUserDatabaseText,
  decodeOpenGd77UserDatabase,
  decodeUserDatabaseHeader,
  encodeOpenGd77UserDatabase,
  packUserDatabaseText,
  unpackUserDatabaseText,
} from './userDatabaseCodec.ts';

function row(
  partial: Partial<RadioDigitalContactDto> & { digitalId: number },
): RadioDigitalContactDto {
  return {
    wireName: partial.wireName ?? `N${partial.digitalId}`,
    digitalId: partial.digitalId,
    callsign: partial.callsign ?? `C${partial.digitalId}`,
    city: partial.city ?? '',
    province: partial.province ?? '',
    country: partial.country ?? '',
    remark: partial.remark ?? '',
  };
}

describe('OpenGD77 User Database codec', () => {
  it('packs and unpacks 6-bit LUT text', () => {
    const packed = packUserDatabaseText('M0ABC Test.town');
    expect(packed.byteLength).toBe(24);
    expect(unpackUserDatabaseText(packed)).toBe('M0ABC Test.town');
  });

  it('skips characters outside the LUT', () => {
    expect(unpackUserDatabaseText(packUserDatabaseText('A-B'))).toBe('AB');
  });

  it('composes callsign then name then location like qdmr fromEntry', () => {
    expect(
      composeUserDatabaseText(
        row({ digitalId: 1, callsign: 'M0ABC', wireName: 'Ada', city: 'Bath', country: 'UK' }),
      ),
    ).toBe('M0ABC Ada Bath UK');
  });

  it('round-trips two entries sorted by DMR ID with UV380 header', () => {
    const encoded = encodeOpenGd77UserDatabase([
      row({ digitalId: 2002, callsign: 'M1ZZZ', wireName: 'Zed' }),
      row({ digitalId: 1001, callsign: 'M0ABC', wireName: 'Ada' }),
    ]);
    expect(encoded.headerAbs).toBe(OPENUV380_USER_DB_HEADER_ABS);
    expect(encoded.entries1Abs).toBe(OPENUV380_USER_DB_ENTRIES1_ABS);
    expect(encoded.entryCount).toBe(2);
    expect(encoded.truncated).toBe(0);
    expect(encoded.header.byteLength).toBe(12);
    expect(String.fromCharCode(encoded.header[0]!, encoded.header[1]!)).toBe('Id');
    expect(encoded.header[2]).toBe(78);
    expect(encoded.header[3]).toBe(0x4a + OPENUV380_USER_DB_ENTRY_SIZE);
    const decoded = decodeOpenGd77UserDatabase(encoded.header, encoded.entries0, encoded.entries1);
    expect(decoded.map((e) => e.digitalId)).toEqual([1001, 2002]);
    expect(decoded[0]?.text).toBe('M0ABC Ada');
    expect(decoded[1]?.text).toBe('M1ZZZ Zed');
  });

  it('encodes an empty database as header count 0', () => {
    const encoded = encodeOpenGd77UserDatabase([]);
    expect(decodeUserDatabaseHeader(encoded.header).entryCount).toBe(0);
    expect(encoded.entries0.byteLength).toBe(0);
    expect(encoded.entries1.byteLength).toBe(0);
  });

  it('splits overflow past segment 0 onto entries1', () => {
    const n0 = OPENUV380_USER_DB_ENTRIES0_MAX;
    const rows = [row({ digitalId: 1 }), row({ digitalId: 2 })];
    const encoded = encodeOpenGd77UserDatabase(rows);
    expect(encoded.entries0.byteLength).toBe(2 * OPENUV380_USER_DB_ENTRY_SIZE);
    expect(encoded.entries1.byteLength).toBe(0);

    const many: RadioDigitalContactDto[] = [];
    for (let i = 1; i <= n0 + 2; i++) {
      many.push(row({ digitalId: i, callsign: 'A', wireName: 'B' }));
    }
    const overflow = encodeOpenGd77UserDatabase(many);
    expect(overflow.entryCount).toBe(n0 + 2);
    expect(overflow.entries0.byteLength).toBe(n0 * OPENUV380_USER_DB_ENTRY_SIZE);
    expect(overflow.entries1.byteLength).toBe(2 * OPENUV380_USER_DB_ENTRY_SIZE);
    const decoded = decodeOpenGd77UserDatabase(
      overflow.header,
      overflow.entries0,
      overflow.entries1,
    );
    expect(decoded).toHaveLength(n0 + 2);
    expect(decoded[n0]?.digitalId).toBe(n0 + 1);
  });
});
