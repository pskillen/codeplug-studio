/**
 * M17 wire codec for the RadioFoundry settings area.
 * Address text rules live in the vendor-neutral domain; base-40, the 7-byte
 * block and the 10-byte callsign record stay here.
 */
import { normalizeM17Callsign, normalizeM17Destination } from '@core/domain/m17Address.ts';
import {
  CHANNEL_TAG_KEY_FIRST,
  CHANNEL_TAG_KEY_LAST,
  RADIOFOUNDRY_KIND_M17,
} from './channelTags.ts';

/** Kind 6 radio-wide record (m17-codeplug.md §1). */
export const M17_RADIO_WIDE_KEY = 0x0a06;

const CALLSIGN_BYTES = 10;
const DESTINATION_BYTES = 6;
const BLOCK_BYTES = 7;
/** Largest 9-character base-40 address. Anything above it, including all-FF, reads as broadcast. */
const DESTINATION_MAX = 0xee6b27ffffff;

/** Space, A–Z, 0–9, `-`, `/`, `.`. Index is the base-40 digit. */
const BASE40 = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/.';

export interface DecodedM17Block {
  /** 0–15. */
  can: number;
  /** True: play only this CAN. False: play every CAN (byte 0 bit 4). */
  squelchOn: boolean;
  /** Empty when the address is broadcast, missing, all-FF or reserved. */
  destination: string;
  /**
   * Six destination bytes as 12 hex digits. `FFFFFFFFFFFF` when the address
   * reads as broadcast.
   */
  destinationHex: string;
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function readUnsigned(bytes: Uint8Array): number {
  let n = 0;
  for (const b of bytes) n = n * 256 + b;
  return n;
}

function writeUnsigned(bytes: Uint8Array, value: number): void {
  let n = value;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    bytes[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
}

/** Six big-endian destination bytes. Null when the text is not a destination. Blank, ALL and @ALL store 0. */
export function encodeM17Destination(text: string): Uint8Array | null {
  const normalised = normalizeM17Destination(text);
  if (normalised == null) return null;
  let n = 0;
  let place = 1;
  for (const ch of normalised) {
    const digit = BASE40.indexOf(ch);
    if (digit < 0) return null;
    n += digit * place;
    place *= 40;
  }
  const out = new Uint8Array(DESTINATION_BYTES);
  writeUnsigned(out, n);
  return out;
}

function destinationText(value: number): string {
  if (value === 0) return '';
  let text = '';
  let n = value;
  while (n > 0) {
    text += BASE40[n % 40]!;
    n = Math.floor(n / 40);
  }
  return text.replace(/ +$/, '');
}

/**
 * Destination text from the six address bytes. A short buffer, zero, all-FF
 * and the reserved range read as broadcast (empty text).
 */
export function decodeM17Destination(bytes: Uint8Array | null | undefined): string {
  if (!bytes || bytes.length < DESTINATION_BYTES) return '';
  const value = readUnsigned(bytes.subarray(0, DESTINATION_BYTES));
  if (value === 0 || value > DESTINATION_MAX) return '';
  return destinationText(value);
}

/** 7-byte channel block. Null when the destination text is rejected. CAN is stored in bits 0–3. */
export function encodeM17ChannelBlock(
  can: number,
  squelchOn: boolean,
  destination: string,
): Uint8Array | null {
  const address = encodeM17Destination(destination);
  if (!address) return null;
  const out = new Uint8Array(BLOCK_BYTES);
  out[0] = (can & 0x0f) | (squelchOn ? 0 : 0x10);
  out.set(address, 1);
  return out;
}

/** Absent or empty bytes are CAN 0, squelch on, broadcast. Extra bytes past the block are ignored. */
export function decodeM17ChannelBlock(bytes: Uint8Array | null | undefined): DecodedM17Block {
  if (!bytes || bytes.length === 0) {
    return { can: 0, squelchOn: true, destination: '', destinationHex: 'FFFFFFFFFFFF' };
  }
  const can = bytes[0]! & 0x0f;
  const squelchOn = (bytes[0]! & 0x10) === 0;
  if (bytes.length < BLOCK_BYTES) {
    return { can, squelchOn, destination: '', destinationHex: 'FFFFFFFFFFFF' };
  }
  const address = bytes.subarray(1, BLOCK_BYTES);
  const value = readUnsigned(address);
  const blank = value === 0 || value > DESTINATION_MAX;
  const destinationHex = blank ? 'FFFFFFFFFFFF' : [...address].map((b) => hexByte(b)).join('');
  return {
    can,
    squelchOn,
    destination: blank ? '' : destinationText(value),
    destinationHex,
  };
}

/**
 * Radio-wide callsign. Terminates on 0x00 or 0xFF, drops trailing spaces, folds
 * ASCII a–z, and rejects a leading or internal space, any other character, an
 * empty result, or ten characters with no end. Bytes past the first 10 are ignored.
 */
export function decodeM17CallsignRecord(bytes: Uint8Array | null | undefined): string | null {
  if (!bytes || bytes.length === 0) return null;
  const width = Math.min(bytes.length, CALLSIGN_BYTES);
  let end = width;
  for (let i = 0; i < width; i += 1) {
    const b = bytes[i]!;
    if (b === 0x00 || b === 0xff) {
      end = i;
      break;
    }
  }
  let text = '';
  for (let i = 0; i < end; i += 1) {
    const b = bytes[i]!;
    if (b >= 0x61 && b <= 0x7a) text += String.fromCharCode(b - 0x20);
    else if (b >= 0x20 && b <= 0x7e) text += String.fromCharCode(b);
    else return null;
  }
  while (text.endsWith(' ')) text = text.slice(0, -1);
  if (!/^[A-Z0-9./-]{1,9}$/.test(text)) return null;
  return text;
}

/** Upper case, 0x00 padded to 10. Null when the text is not a callsign. */
export function encodeM17CallsignRecord(text: string): Uint8Array | null {
  const callsign = normalizeM17Callsign(text);
  if (!callsign) return null;
  const out = new Uint8Array(CALLSIGN_BYTES);
  for (let i = 0; i < callsign.length; i += 1) out[i] = callsign.charCodeAt(i);
  return out;
}

/**
 * First word of the radio name: skip leading spaces, stop at space or `-`,
 * then the callsign alphabet. Invalid text is no callsign.
 */
export function m17CallsignFromRadioName(radioName: string): string | null {
  const word = radioName.replace(/^ +/, '').split(/[ -]/, 1)[0] ?? '';
  if (!word) return null;
  return normalizeM17Callsign(word);
}

/**
 * Settings-tab label for a kind-6 channel tag or the radio-wide callsign.
 * Null for every other key, so the row keeps its numbered label.
 */
export function describeRadioFoundrySettingsEntry(key: number, value: Uint8Array): string | null {
  if (key === M17_RADIO_WIDE_KEY) {
    const callsign = decodeM17CallsignRecord(value);
    return callsign ? `M17 callsign: ${callsign}` : 'M17 callsign';
  }
  if (
    key < CHANNEL_TAG_KEY_FIRST ||
    key > CHANNEL_TAG_KEY_LAST ||
    value.length < 5 ||
    value[0] !== RADIOFOUNDRY_KIND_M17
  ) {
    return null;
  }
  const decoded = decodeM17ChannelBlock(value.subarray(5));
  const channel = key - CHANNEL_TAG_KEY_FIRST + 1;
  const heard = decoded.squelchOn ? 'squelch' : 'every CAN';
  const destination = decoded.destination === '' ? 'ALL' : decoded.destination;
  return `Channel ${channel}: M17, CAN ${decoded.can}, ${heard}, ${destination}`;
}

/**
 * The callsign the radio uses: a valid record, otherwise the radio-name
 * fallback. A null record is absent.
 */
export function resolveM17Callsign(
  record: Uint8Array | null | undefined,
  radioName: string,
): string | null {
  return decodeM17CallsignRecord(record) ?? m17CallsignFromRadioName(radioName);
}
