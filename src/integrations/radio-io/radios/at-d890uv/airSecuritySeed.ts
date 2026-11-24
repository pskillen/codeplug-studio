/**
 * Brandmeister AirSecurity seed for the MM9PDY AT-D890UV.
 *
 * The firmware reads a 32-byte record at `0x03500220` (optional-settings unit `0x03500000`,
 * immediately after the 32-byte M6 settings store at `+0x200`). Studio is the only writer.
 * The firmware's own seed-record page is authoritative for the layout.
 *
 * Valid record: magic `41 53`, version 1, length 1..20, seed bytes at offset 4 zero-padded to
 * 20, reserved bytes 24-30 all zero, byte 31 the 8-bit sum of bytes 0-30. Anything else,
 * including a blank or erased record, is no seed.
 *
 * Refusal reasons never include the operator's text or any part of the secret.
 */

import { RadioProtocolError } from '../../kit/errors.ts';

export const AIRSECURITY_SEED_ADDRESS = 0x03500220;
export const AIRSECURITY_SEED_RECORD_LENGTH = 32;
export const AIRSECURITY_SEED_FIELD_ID = 'mm9pdy-airsecurity-seed';

/** Clear record: 32 zero bytes. The firmware treats this as no seed. */
export const AIRSECURITY_SEED_CLEAR_RECORD: Uint8Array = new Uint8Array(
  AIRSECURITY_SEED_RECORD_LENGTH,
);

const SEED_MAX_BYTES = 20;
const VERSION = 1;
const MAGIC_A = 0x41;
const MAGIC_S = 0x53;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type AirSecuritySeedParse = { ok: true; seed: Uint8Array } | { ok: false; reason: string };

const REASON_EMPTY = 'AirSecurity seed is empty';
const REASON_ALPHABET = 'AirSecurity seed is not Base32';
const REASON_LENGTH = 'AirSecurity seed length is not a whole number of bytes';
const REASON_TOO_LONG = 'AirSecurity seed is longer than twenty bytes';
const REASON_TOTP = 'AirSecurity seed link must be TOTP';
const REASON_ALGORITHM = 'AirSecurity seed link algorithm must be SHA1';
const REASON_DIGITS = 'AirSecurity seed link digits must be 6';
const REASON_PERIOD = 'AirSecurity seed link period must be 30';
const REASON_NO_SECRET = 'AirSecurity seed link has no secret';
const REASON_BAD_LINK = 'AirSecurity seed link is not a valid otpauth URL';

function fail(reason: string): AirSecuritySeedParse {
  return { ok: false, reason };
}

/**
 * Base32 (RFC 4648) to bytes. `text` is already stripped, uppercased, and a whole number of
 * bytes. Returns a reason key when a character is outside the alphabet or a padding bit is set.
 */
function decodeBase32(text: string): Uint8Array | 'alphabet' {
  const out = new Uint8Array(Math.floor((text.length * 5) / 8));
  let buffer = 0;
  let bits = 0;
  let at = 0;
  for (const ch of text) {
    const value = BASE32.indexOf(ch);
    if (value < 0) return 'alphabet';
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (buffer >> bits) & 0xff;
    }
  }
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return 'alphabet';
  return out;
}

/** Self-care text: Base32, any case, spaces anywhere, optional `=` padding. */
function parseSelfcare(text: string): AirSecuritySeedParse {
  const compact = text.replace(/[\s=]/g, '').toUpperCase();
  if (compact.length === 0) return fail(REASON_EMPTY);
  for (const ch of compact) {
    if (BASE32.indexOf(ch) < 0) return fail(REASON_ALPHABET);
  }
  const mod = compact.length % 8;
  if (mod === 1 || mod === 3 || mod === 6) return fail(REASON_LENGTH);
  const decoded = decodeBase32(compact);
  if (decoded === 'alphabet') return fail(REASON_ALPHABET);
  if (decoded.length === 0) return fail(REASON_EMPTY);
  if (decoded.length > SEED_MAX_BYTES) return fail(REASON_TOO_LONG);
  return { ok: true, seed: decoded };
}

function parseLink(text: string): AirSecuritySeedParse {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail(REASON_BAD_LINK);
  }
  if (url.protocol !== 'otpauth:') return fail(REASON_BAD_LINK);
  if (url.hostname.toLowerCase() !== 'totp') return fail(REASON_TOTP);
  const algorithm = url.searchParams.get('algorithm');
  if (algorithm !== null && algorithm.toUpperCase() !== 'SHA1') return fail(REASON_ALGORITHM);
  const digits = url.searchParams.get('digits');
  if (digits !== null && digits !== '6') return fail(REASON_DIGITS);
  const period = url.searchParams.get('period');
  if (period !== null && period !== '30') return fail(REASON_PERIOD);
  const secret = url.searchParams.get('secret');
  if (secret === null) return fail(REASON_NO_SECRET);
  return parseSelfcare(secret);
}

/**
 * Parse a Brandmeister self-care seed or an `otpauth://totp/` link. Defaults are SHA1, 6 digits
 * and a 30-second period. A bad input returns a reason that does not contain the input.
 */
export function parseAirSecuritySeedInput(text: string): AirSecuritySeedParse {
  const trimmed = text.trim();
  if (trimmed.toLowerCase().startsWith('otpauth://')) return parseLink(trimmed);
  return parseSelfcare(text);
}

/** 32-byte record. Throws when `seed` is empty or longer than 20 bytes. */
export function encodeAirSecuritySeedRecord(seed: Uint8Array): Uint8Array {
  if (seed.length < 1 || seed.length > SEED_MAX_BYTES) {
    throw new RadioProtocolError('AirSecurity seed has a length the record cannot hold');
  }
  const record = new Uint8Array(AIRSECURITY_SEED_RECORD_LENGTH);
  record[0] = MAGIC_A;
  record[1] = MAGIC_S;
  record[2] = VERSION;
  record[3] = seed.length;
  record.set(seed, 4);
  let sum = 0;
  for (let i = 0; i < 31; i++) sum = (sum + record[i]!) & 0xff;
  record[31] = sum;
  return record;
}

/**
 * True when `record` is a valid v1 seed. Returns a boolean only: the seed bytes are not part of
 * the result.
 */
export function airSecuritySeedRecordIsSet(record: Uint8Array): boolean {
  if (record.length < AIRSECURITY_SEED_RECORD_LENGTH) return false;
  if (record[0] !== MAGIC_A || record[1] !== MAGIC_S) return false;
  if (record[2] !== VERSION) return false;
  const length = record[3]!;
  if (length < 1 || length > SEED_MAX_BYTES) return false;
  for (let i = 24; i <= 30; i++) {
    if (record[i] !== 0) return false;
  }
  let sum = 0;
  for (let i = 0; i < 31; i++) sum = (sum + record[i]!) & 0xff;
  return sum === record[31];
}
