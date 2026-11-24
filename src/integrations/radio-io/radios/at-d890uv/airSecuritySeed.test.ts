import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  AIRSECURITY_SEED_ADDRESS,
  AIRSECURITY_SEED_CLEAR_RECORD,
  AIRSECURITY_SEED_FIELD_ID,
  AIRSECURITY_SEED_RECORD_LENGTH,
  airSecuritySeedRecordIsSet,
  encodeAirSecuritySeedRecord,
  parseAirSecuritySeedInput,
} from './airSecuritySeed.ts';

/** Brandmeister self-care Base32 for ASCII `12345678901234567890` (dummy only). */
const SELFCARE = 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq';
const SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const SECRET_ASCII = '12345678901234567890';
const SEED = new TextEncoder().encode(SECRET_ASCII);
const GOLDEN = hexToBytes('41530114313233343536373839303132333435363738393000000000000000c3');
const LINK = `otpauth://totp/BrandMeister:1234567?secret=${SECRET_B32}&issuer=BrandMeister`;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function expectSeed(text: string): void {
  const parsed = parseAirSecuritySeedInput(text);
  expect(parsed.ok, text).toBe(true);
  if (parsed.ok) expect(parsed.seed).toEqual(SEED);
}

function expectRefusal(text: string): void {
  const parsed = parseAirSecuritySeedInput(text);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) return;
  expect(parsed.reason.length).toBeGreaterThan(0);
  if (text.length > 0) expect(parsed.reason.includes(text)).toBe(false);
  expect(parsed.reason.includes(SECRET_B32)).toBe(false);
  expect(parsed.reason.includes(SECRET_B32.toLowerCase())).toBe(false);
  expect(parsed.reason.includes(SECRET_ASCII)).toBe(false);
  expect(parsed.reason.includes(SELFCARE)).toBe(false);
}

/** Otherwise-valid record with one field replaced, checksum recomputed over bytes 0-30. */
function recordWith(edit: (record: Uint8Array) => void): Uint8Array {
  const record = GOLDEN.slice();
  edit(record);
  let sum = 0;
  for (let i = 0; i < 31; i++) sum = (sum + record[i]!) & 0xff;
  record[31] = sum;
  return record;
}

describe('parseAirSecuritySeedInput', () => {
  it.each([
    ['selfcare groups', SELFCARE],
    ['uppercase', SECRET_B32],
    ['mixed case', 'GezdGnbvGy3tQojqGezdGnbvGy3tQojq'],
    ['no spaces', 'gezdgnbvgy3tqojqgezdgnbvgy3tqojq'],
    ['padding equals', `${SECRET_B32}======`],
    ['spaces and equals', `gezd gnbv gy3t qojq gezd gnbv gy3t qojq =`],
    ['otpauth link', LINK],
    ['link without issuer', `otpauth://totp/BrandMeister:1234567?secret=${SECRET_B32}`],
    [
      'link with sha1 any case',
      `otpauth://totp/BrandMeister:1234567?secret=${SECRET_B32.toLowerCase()}&algorithm=sha1&digits=6&period=30`,
    ],
  ])('accepts %s as the 20-byte seed', (_name, text) => {
    expectSeed(text);
  });

  it.each([
    ['algorithm SHA256', `${LINK}&algorithm=SHA256`],
    ['digits 8', `${LINK}&digits=8`],
    ['period 60', `${LINK}&period=60`],
    ['hotp', `otpauth://hotp/BrandMeister:1234567?secret=${SECRET_B32}&issuer=BrandMeister`],
    ['33rd char', `${SECRET_B32}A`],
    ['embedded 0', 'GEZDGNBVGY3TQOJ0'],
    ['digit 1', '1'],
    ['digit 8', '8'],
    ['digit 0', '0'],
    ['empty', ''],
    ['whitespace only', '   \n\t  '],
  ])('refuses %s and the reason does not contain the input', (_name, text) => {
    expectRefusal(text);
  });

  it('refuses 40 Base32 characters (25 bytes) as too long without echoing the input', () => {
    const text = 'GEZDGNBV'.repeat(5);
    const parsed = parseAirSecuritySeedInput(text);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe('AirSecurity seed is longer than twenty bytes');
    expect(parsed.reason.includes(text)).toBe(false);
  });
});

describe('encodeAirSecuritySeedRecord', () => {
  it('encodes the golden vector', () => {
    expect(encodeAirSecuritySeedRecord(SEED)).toEqual(GOLDEN);
  });

  it('zero-pads a shorter seed and leaves reserved bytes at 0', () => {
    const record = encodeAirSecuritySeedRecord(Uint8Array.of(0x7a));
    expect(record.length).toBe(32);
    expect(record[3]).toBe(1);
    expect(record[4]).toBe(0x7a);
    expect(record.subarray(5, 31).every((b) => b === 0)).toBe(true);
    expect(airSecuritySeedRecordIsSet(record)).toBe(true);
  });

  it.each([0, 21])('throws on length %i', (length) => {
    const seed = new Uint8Array(length).fill(0x31);
    expect(() => encodeAirSecuritySeedRecord(seed)).toThrow(RadioProtocolError);
    try {
      encodeAirSecuritySeedRecord(seed);
    } catch (err) {
      expect(String(err).includes(SECRET_ASCII)).toBe(false);
    }
  });
});

describe('airSecuritySeedRecordIsSet', () => {
  it('is true for the golden vector', () => {
    expect(airSecuritySeedRecordIsSet(GOLDEN)).toBe(true);
  });

  it('is false for all-FF and all-00', () => {
    expect(airSecuritySeedRecordIsSet(new Uint8Array(32).fill(0xff))).toBe(false);
    expect(airSecuritySeedRecordIsSet(AIRSECURITY_SEED_CLEAR_RECORD)).toBe(false);
    expect([...AIRSECURITY_SEED_CLEAR_RECORD]).toEqual(Array(32).fill(0));
  });

  it('is false for a bad sum', () => {
    const record = GOLDEN.slice();
    record[31] = (record[31]! + 1) & 0xff;
    expect(airSecuritySeedRecordIsSet(record)).toBe(false);
  });

  it('is false for a bad magic', () => {
    expect(airSecuritySeedRecordIsSet(recordWith((r) => (r[0] = 0x00)))).toBe(false);
  });

  it.each([0, 21])('is false for length %i', (length) => {
    expect(airSecuritySeedRecordIsSet(recordWith((r) => (r[3] = length)))).toBe(false);
  });

  it('is false when a reserved byte is non-zero', () => {
    expect(airSecuritySeedRecordIsSet(recordWith((r) => (r[24] = 1)))).toBe(false);
  });

  it('does not return the record bytes', () => {
    const set = airSecuritySeedRecordIsSet(GOLDEN);
    expect(set).toBe(true);
    expect(typeof set).toBe('boolean');
  });
});

describe('AirSecurity seed constants', () => {
  it('names the record address, length and field id', () => {
    expect(AIRSECURITY_SEED_ADDRESS).toBe(0x03500220);
    expect(AIRSECURITY_SEED_RECORD_LENGTH).toBe(32);
    expect(AIRSECURITY_SEED_FIELD_ID).toBe('mm9pdy-airsecurity-seed');
  });
});
