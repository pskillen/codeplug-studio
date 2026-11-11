/**
 * Synthetic UV-5R Mini `.ufw` containers for tests: valid ENC header and entries, CRCs, a seeded `flash.bin` and a
 * fake packed loader in a valid `ota.bin`. Nothing here is firmware; the bytes are seeded noise. Options break one
 * field each.
 */
import { seededBytes } from '@core/firmware/__fixtures__/synthetic.ts';

import { crc16Xmodem } from '../../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import { UFW_ENTRY_SIZE, UFW_HEADER_SIZE } from '../constants.ts';
import { encDecode } from '../ufw.ts';

export interface SyntheticUfwOptions {
  /** `flash.bin` bytes; default seeded noise of `flashSize`. */
  flash?: Uint8Array;
  flashSize?: number;
  flashSeed?: number;
  /** The fake packed loader; default seeded noise. */
  loader?: Uint8Array;
  loaderSeed?: number;
  /** Break one field. */
  badHeaderCrc?: boolean;
  badListCrc?: boolean;
  badFlashCrc?: boolean;
  badOtaCrc?: boolean;
  /** Declare three entries (a third `cfg_tool.bin`). */
  thirdEntry?: boolean;
  /** Name the second entry `flash2.bin` (type 0) instead of `ota.bin`. */
  noOta?: boolean;
  /** Put two loader entries in the `ota.bin` directory. */
  twoLoaders?: boolean;
  otaLoaderName?: string;
  otaAttr?: number;
  badOtaHeaderCrc?: boolean;
  badOtaDataCrc?: boolean;
}

export interface SyntheticUfw {
  readonly bytes: Uint8Array;
  readonly flash: Uint8Array;
  readonly loader: Uint8Array;
}

const put16 = (b: Uint8Array, o: number, v: number) => {
  b[o] = v & 0xff;
  b[o + 1] = (v >> 8) & 0xff;
};
const put32 = (b: Uint8Array, o: number, v: number) => {
  put16(b, o, v & 0xffff);
  put16(b, o + 2, (v >>> 16) & 0xffff);
};
const putName = (b: Uint8Array, o: number, name: string) => {
  for (let i = 0; i < 16; i++) b[o + i] = i < name.length ? name.charCodeAt(i) : 0;
};

function otaBin(loader: Uint8Array, o: SyntheticUfwOptions): Uint8Array {
  const dirEntries = o.twoLoaders ? 2 : 1;
  const off = 0x20 * dirEntries;
  const out = new Uint8Array(off + loader.length);
  for (let n = 0; n < dirEntries; n++) {
    const e = out.subarray(n * 0x20, (n + 1) * 0x20);
    put16(e, 2, crc16Xmodem(loader) ^ (o.badOtaDataCrc ? 1 : 0));
    put32(e, 4, off);
    put32(e, 8, loader.length);
    e[0xc] = o.otaAttr ?? 0x41;
    put16(e, 0xe, n);
    putName(e, 0x10, o.otaLoaderName ?? 'uart_user.bin');
    put16(e, 0, crc16Xmodem(e.subarray(2)) ^ (o.badOtaHeaderCrc ? 1 : 0));
  }
  out.set(loader, off);
  return out;
}

export function makeSyntheticUfw(o: SyntheticUfwOptions = {}): SyntheticUfw {
  const flash = o.flash ?? seededBytes(o.flashSeed ?? 1, o.flashSize ?? 0x4000);
  const loader = o.loader ?? seededBytes(o.loaderSeed ?? 2, 600);
  const ota = otaBin(loader, o);
  const bodies: { type: number; name: string; data: Uint8Array; badCrc: boolean }[] = [
    { type: 0, name: 'flash.bin', data: flash, badCrc: !!o.badFlashCrc },
    o.noOta
      ? { type: 0, name: 'flash2.bin', data: ota, badCrc: !!o.badOtaCrc }
      : { type: 100, name: 'ota.bin', data: ota, badCrc: !!o.badOtaCrc },
  ];
  if (o.thirdEntry) {
    bodies.push({ type: 1, name: 'cfg_tool.bin', data: seededBytes(3, 32), badCrc: false });
  }
  const tableEnd = UFW_HEADER_SIZE + bodies.length * UFW_ENTRY_SIZE;
  let off = tableEnd;
  const table = new Uint8Array(bodies.length * UFW_ENTRY_SIZE);
  bodies.forEach((e, i) => {
    const d = new Uint8Array(UFW_ENTRY_SIZE);
    put16(d, 0, e.type);
    put16(d, 2, i);
    put16(d, 4, crc16Xmodem(e.data) ^ (e.badCrc ? 1 : 0));
    put32(d, 8, off);
    put32(d, 0xc, e.data.length);
    put32(d, 0x10, e.data.length);
    putName(d, 0x40, e.name);
    table.set(encDecode(d), i * UFW_ENTRY_SIZE);
    off += e.data.length;
  });
  const hdr = new Uint8Array(UFW_HEADER_SIZE);
  put16(hdr, 2, crc16Xmodem(table) ^ (o.badListCrc ? 1 : 0));
  put32(hdr, 4, off);
  put16(hdr, 8, bodies.length);
  put16(hdr, 0xa, 4);
  put16(hdr, 0xc, 0x200);
  putName(hdr, 0x10, 'SYNTH');
  put16(hdr, 0, crc16Xmodem(hdr.subarray(2)) ^ (o.badHeaderCrc ? 1 : 0));

  const bytes = new Uint8Array(off);
  bytes.set(encDecode(hdr), 0);
  bytes.set(table, UFW_HEADER_SIZE);
  let at = tableEnd;
  for (const e of bodies) {
    bytes.set(e.data, at);
    at += e.data.length;
  }
  return { bytes, flash, loader };
}
