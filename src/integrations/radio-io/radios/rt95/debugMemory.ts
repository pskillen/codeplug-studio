/** Evidence-preserving, read-only interpretation of the ordinary clone slots. */
import { decodeBcdFreq } from './bcd.ts';
import { ctcssIndexToHz } from './ctcssToneTable.ts';
import { dtcsWireIndexToCode } from './allDtcsCodes.ts';
import {
  RT95_CHANNEL_COUNT,
  RT95_CHANNEL_RECORD_SIZE,
  RT95_OCCUPIED_BITFIELD_OFFSET,
  RT95_SCAN_BITFIELD_OFFSET,
} from './constants.ts';

const hex = (n: number) => `0x${n.toString(16).padStart(2, '0')}`;
const bcd = (bytes: Uint8Array) =>
  bytes.every((b) => (b & 15) < 10 && b >> 4 < 10) ? decodeBcdFreq(bytes) : undefined;
const frequency = (n: number | undefined) =>
  n === undefined ? 'Invalid BCD' : `${(n / 1e6).toFixed(5)} MHz`;
function tone(raw: Uint8Array, direction: 'rx' | 'tx'): string {
  const mode = direction === 'rx' ? (raw[11]! >> 2) & 3 : raw[11]! & 3;
  if (mode === 0) return 'Off';
  if (mode === 3) return 'Invalid tone mode 3';
  if (mode === 1) {
    const index = raw[direction === 'rx' ? 12 : 13]!;
    const hz = index === 0x33 ? (raw[30]! | (raw[31]! << 8)) / 10 : ctcssIndexToHz(index);
    return hz == null
      ? `Invalid CTCSS index ${hex(index)}`
      : `CTCSS ${hz.toFixed(1)} Hz${index === 0x33 ? ' (custom)' : ''}`;
  }
  const offset = direction === 'rx' ? 14 : 16;
  const flags = raw[offset + 1]!;
  const code = dtcsWireIndexToCode(raw[offset]! | ((flags & 1) << 8));
  return code == null
    ? 'Invalid DCS code'
    : `DCS ${String(code).padStart(3, '0')} ${flags & 2 ? 'inverted' : 'normal'}`;
}
export interface Rt95DebugSlot {
  slot: number;
  occupancy: 'occupied' | 'empty' | 'unavailable';
  raw?: Uint8Array;
  name: string;
  rx: string;
  duplex: string;
  tx: string;
  power: string;
  width: string;
  rxTone: string;
  txTone: string;
  scan: string;
  toneSquelch: string;
  signalling: string;
  dtmf: string;
  fiveTone: string;
}
export function decodeRt95DebugSlots(image: Uint8Array | undefined, base = 0): Rt95DebugSlot[] {
  const at = (address: number, length: number) =>
    image && address >= base && address + length <= base + image.length
      ? image.subarray(address - base, address - base + length)
      : undefined;
  return Array.from({ length: RT95_CHANNEL_COUNT }, (_, i) => {
    const bit = at(RT95_OCCUPIED_BITFIELD_OFFSET + (i >> 3), 1);
    const occupancy = !bit ? 'unavailable' : bit[0]! & (1 << (i & 7)) ? 'occupied' : 'empty';
    const raw = at(i * RT95_CHANNEL_RECORD_SIZE, RT95_CHANNEL_RECORD_SIZE);
    const result: Rt95DebugSlot = {
      slot: i + 1,
      occupancy,
      raw,
      name: '',
      rx: 'Unavailable',
      duplex: 'Unavailable',
      tx: 'Unavailable',
      power: 'Unavailable',
      width: 'Unavailable',
      rxTone: 'Unavailable',
      txTone: 'Unavailable',
      scan: 'Unavailable',
      toneSquelch: 'Unavailable',
      signalling: 'Unavailable',
      dtmf: 'Unavailable',
      fiveTone: 'Unavailable',
    };
    if (occupancy !== 'occupied' || !raw) return result;
    if (raw.every((b) => b === 0xff)) {
      result.rx = 'Unreadable blank record';
      return result;
    }
    for (const byte of raw.subarray(24, 30)) {
      if (byte === 0 || byte === 0xff) break;
      result.name += String.fromCharCode(byte >= 32 && byte <= 126 ? byte : 32);
    }
    result.name = result.name.trimEnd();
    const rx = bcd(raw.subarray(0, 4));
    const offset = bcd(raw.subarray(4, 8));
    const duplex = raw[9]! & 3;
    const power = (raw[9]! >> 2) & 3;
    const width = (raw[10]! >> 2) & 3;
    result.rx = frequency(rx);
    result.duplex = `${duplex} · offset ${frequency(offset)}`;
    result.tx =
      raw[10]! & 1
        ? 'Disabled'
        : duplex === 3
          ? 'Unknown (duplex 3)'
          : rx === undefined || (duplex !== 0 && offset === undefined)
            ? 'Unavailable (invalid BCD)'
            : frequency(rx + (duplex === 1 ? offset! : duplex === 2 ? -offset! : 0));
    result.power = `${power} · ${['Low', 'Medium', 'High'][power] ?? 'invalid'}`;
    result.width = ['12.5 kHz', '20 kHz', '25 kHz'][width] ?? `Invalid width ${width}`;
    result.rxTone = tone(raw, 'rx');
    result.txTone = tone(raw, 'tx');
    const scan = at(RT95_SCAN_BITFIELD_OFFSET + (i >> 3), 1);
    result.scan = scan ? (scan[0]! & (1 << (i & 7)) ? 'Included' : 'Excluded') : 'Unavailable';
    result.toneSquelch = raw[20]! & 1 ? 'On' : 'Off';
    result.signalling = `${raw[21]} · ${['Off', 'DTMF', 'reserved (CPS shows Off)', '5-Tone'][raw[21]!] ?? 'invalid'}`;
    result.dtmf = String(raw[11]! >> 4);
    result.fiveTone = String(raw[23]);
    return result;
  });
}
