/**
 * The radio report: one 64-byte clone frame at `0xEFC0` in which an MM9PDY build of the UV-5R Mini answers with its
 * own facts (its `VM` entry, which names the flash layout, its code base, its build name and its RF chip's register 0).
 * A stock radio answers with the bytes of its external flash there (erased, `FF`), so the same read says it is stock.
 * The frame format is the firmware project's interface; see docs/reference/radios/baofeng/uv-5r-mini/firmware.md
 * ("The radio report").
 *
 * Pure: the bytes come in decoded (the clone XOR already undone). Reading them is the integrations layer's job.
 */
import type { RadioLayoutAnswer } from '../../../firmware/types.ts';

/** Where the frame is: the clone address of one 64-byte `R`. */
export const UV5RMINI_RADIO_REPORT_ADDRESS = 0xefc0;
export const UV5RMINI_RADIO_REPORT_LENGTH = 64;
/** The only format this version of Studio reads. */
export const UV5RMINI_RADIO_REPORT_FORMAT = 1;

const MAGIC = [0x4d, 0x4d, 0x39, 0x52]; // "MM9R"
const NAME_OFFSET = 0x18;
const NAME_LENGTH = 24;
const CRC_OFFSET = 0x3e;

/** The two `VM` entries in the field, by flash layout: (start, size). */
const LAYOUTS: readonly { layout: 'L1' | 'L2'; vmStart: number; vmSize: number }[] = [
  { layout: 'L1', vmStart: 0x95000, vmSize: 0x68000 },
  { layout: 'L2', vmStart: 0x94000, vmSize: 0x6a000 },
];

/** Flags bit 0: the app is on the `nrfb-v0.04` code base (clear: `nrf-v0.27`). */
const FLAG_CODE_BASE_V004 = 0x01;

export type Uv5rMiniRadioReport =
  /** No report: no magic, a bad CRC or a short read. A stock radio, or an MM9PDY build from before the frame. */
  | { readonly kind: 'stock'; readonly reason: 'length' | 'magic' | 'crc' }
  /** A report in a format this version of Studio doesn't know. */
  | { readonly kind: 'unknownFormat'; readonly format: number }
  /** A good report whose `VM` entry is neither layout's. */
  | {
      readonly kind: 'unknownLayout';
      readonly vmStart: number;
      readonly vmSize: number;
      readonly name: string;
    }
  | {
      readonly kind: 'report';
      readonly layout: 'L1' | 'L2';
      /** The code base the app is built on, from flags bit 0. */
      readonly codeBase: 'nrfb-v0.04' | 'nrf-v0.27';
      readonly flags: number;
      readonly vmStart: number;
      readonly vmSize: number;
      /** Where the app's settings store put its first bank; equal to `vmStart` on a sane store. */
      readonly vmBank0: number;
      /** The RF chip's register 0. Shown, never gated on. */
      readonly rf0: number;
      readonly name: string;
    };

/** CRC-16/XMODEM: poly 0x1021, init 0, no reflection, no xorout. */
export function crc16Xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

const u16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number) =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

function readName(b: Uint8Array): string {
  let s = '';
  for (const c of b.subarray(NAME_OFFSET, NAME_OFFSET + NAME_LENGTH)) {
    if (c === 0) break;
    s += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '?';
  }
  return s;
}

/**
 * Decode the 64 bytes read at `0xEFC0`, as "What Studio concludes" says: magic and a good CRC make a report; the format
 * byte is checked next (an unknown one is named, not guessed at); the `VM` pair names the layout and any other pair is
 * an unknown layout. `vm_bank0` is returned as read.
 */
export function decodeUv5rMiniRadioReport(bytes: Uint8Array): Uv5rMiniRadioReport {
  if (bytes.length !== UV5RMINI_RADIO_REPORT_LENGTH) return { kind: 'stock', reason: 'length' };
  if (!MAGIC.every((m, i) => bytes[i] === m)) return { kind: 'stock', reason: 'magic' };
  if (crc16Xmodem(bytes.subarray(0, CRC_OFFSET)) !== u16(bytes, CRC_OFFSET)) {
    return { kind: 'stock', reason: 'crc' };
  }
  const format = bytes[4]!;
  if (format !== UV5RMINI_RADIO_REPORT_FORMAT) return { kind: 'unknownFormat', format };
  const flags = bytes[5]!;
  const vmStart = u32(bytes, 0x08);
  const vmSize = u32(bytes, 0x0c);
  const name = readName(bytes);
  const known = LAYOUTS.find((l) => l.vmStart === vmStart && l.vmSize === vmSize);
  if (!known) return { kind: 'unknownLayout', vmStart, vmSize, name };
  return {
    kind: 'report',
    layout: known.layout,
    codeBase: flags & FLAG_CODE_BASE_V004 ? 'nrfb-v0.04' : 'nrf-v0.27',
    flags,
    vmStart,
    vmSize,
    vmBank0: u32(bytes, 0x10),
    rf0: u16(bytes, 0x14),
    name,
  };
}

const hex = (n: number, digits: number) =>
  `0x${n.toString(16).toUpperCase().padStart(digits, '0')}`;

/**
 * The one-way warning for an MM9PDY radio on layout 1 that still runs the v0.04 code base: the next layout-1 release
 * moves it to the v0.27 code base, and there is no way back to V0.04 after that.
 */
export const UV5RMINI_ONE_WAY_WARNING =
  "This radio's MM9PDY build is on Baofeng's v0.04 code. The next L1 release moves it to the v0.27 code for good: channels and settings are kept, and the radio can go back to stock V0.27, but never to V0.04.";

export const UV5RMINI_UNKNOWN_LAYOUT_REFUSAL = (vmStart: number, vmSize: number): string =>
  `This radio reports a flash layout Studio doesn't support (VM entry at ${hex(vmStart, 5)}, ${hex(vmSize, 5)} bytes). Nothing was sent.`;

export const UV5RMINI_UNKNOWN_FORMAT_REFUSAL = (format: number): string =>
  `This radio's MM9PDY build answers in report format ${format}, which this version of Studio doesn't know. Nothing was sent; update Studio and try again.`;

/**
 * What the wizard concludes from a report. Null for a radio with no report (stock): the wizard asks its Radio Info
 * instead. A report asks no question: the layout is the report's, its build name decides "already installed", and the
 * build name and RF chip are shown as information only.
 */
export function uv5rMiniLayoutFromReport(report: Uv5rMiniRadioReport): RadioLayoutAnswer | null {
  switch (report.kind) {
    case 'stock':
      return null;
    case 'unknownFormat':
      return { kind: 'refused', message: UV5RMINI_UNKNOWN_FORMAT_REFUSAL(report.format) };
    case 'unknownLayout':
      return {
        kind: 'refused',
        message: UV5RMINI_UNKNOWN_LAYOUT_REFUSAL(report.vmStart, report.vmSize),
      };
    case 'report': {
      const details = [
        `MM9PDY build: ${report.name || '(no name)'}`,
        `Flash layout: ${report.layout}`,
        `RF chip register 0: ${hex(report.rf0, 4)}`,
      ];
      if (report.vmBank0 !== report.vmStart) {
        details.push(
          `The radio's settings store starts at ${hex(report.vmBank0, 5)}, not at its VM entry ${hex(report.vmStart, 5)}. Studio goes by the VM entry.`,
        );
      }
      const oneWay = report.layout === 'L1' && report.codeBase === 'nrfb-v0.04';
      return {
        kind: 'layout',
        layout: report.layout,
        details,
        ...(report.name ? { build: report.name } : {}),
        ...(oneWay ? { warning: UV5RMINI_ONE_WAY_WARNING } : {}),
      };
    }
  }
}
