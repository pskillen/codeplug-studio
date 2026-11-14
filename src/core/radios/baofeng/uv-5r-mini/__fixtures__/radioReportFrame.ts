/**
 * Synthetic UV-5R Mini radio reports, format 2, as they look decoded (the clone XOR undone). Made up: no real radio's
 * values. The defaults are the firmware project's example (an `L2` build on `NRF` / `V0.27` / `V1.7`, register 0
 * `0x1234`), so `radioReportFrame()` equals `RADIO_REPORT_EXAMPLE_HEX`.
 */
import { crc16Xmodem } from '../radioReport.ts';

/** The firmware project's made-up example frame, decoded. */
export const RADIO_REPORT_EXAMPLE_HEX =
  '4d4d3952020000000040090000a0060000400900341200006d6d397064792d4c322d302e322e302d72632e31000000004e52460056302e323756312e3720dd1a';

export const fromHex = (h: string): Uint8Array =>
  Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

export const L1_VM: readonly [number, number] = [0x95000, 0x68000];
export const L2_VM: readonly [number, number] = [0x94000, 0x6a000];

export interface RadioReportFrameOptions {
  readonly format?: number;
  /** The whole flags byte; defaults to bit 0 set exactly for `NRFB` / `V0.04` / `V1.7`. */
  readonly flags?: number;
  readonly vm?: readonly [number, number];
  readonly bank0?: number;
  readonly rf0?: number;
  readonly name?: string;
  /** The raw string fields, as stored (NUL-padded here). Hardware is stored with its trailing space. */
  readonly suffix?: string | Uint8Array;
  readonly version?: string | Uint8Array;
  readonly hardware?: string | Uint8Array;
}

const putU32 = (b: Uint8Array, at: number, v: number) => {
  for (let i = 0; i < 4; i++) b[at + i] = (v >>> (8 * i)) & 0xff;
};

const ascii = (s: string | Uint8Array) => (typeof s === 'string' ? new TextEncoder().encode(s) : s);

/** Set a frame's CRC right, so only the edited fields differ. */
export function withCrc(b: Uint8Array): Uint8Array {
  const crc = crc16Xmodem(b.subarray(0, 0x3e));
  b[0x3e] = crc & 0xff;
  b[0x3f] = crc >> 8;
  return b;
}

/** A format-2 frame with a good CRC. */
export function radioReportFrame(o: RadioReportFrameOptions = {}): Uint8Array {
  const suffix = o.suffix ?? 'NRF';
  const version = o.version ?? 'V0.27';
  const hardware = o.hardware ?? 'V1.7 ';
  const nrfbV004 = suffix === 'NRFB' && version === 'V0.04' && hardware === 'V1.7 ';
  const [vmStart, vmSize] = o.vm ?? L2_VM;
  const b = new Uint8Array(64);
  b.set([0x4d, 0x4d, 0x39, 0x52, o.format ?? 2, o.flags ?? (nrfbV004 ? 1 : 0)]);
  putU32(b, 0x08, vmStart);
  putU32(b, 0x0c, vmSize);
  putU32(b, 0x10, o.bank0 ?? vmStart);
  const rf0 = o.rf0 ?? 0x1234;
  b.set([rf0 & 0xff, rf0 >> 8], 0x14);
  b.set(ascii(o.name ?? 'mm9pdy-L2-0.2.0-rc.1'), 0x18);
  b.set(ascii(suffix), 0x30);
  b.set(ascii(version), 0x34);
  b.set(ascii(hardware), 0x39);
  return withCrc(b);
}
