/**
 * The radio report: one 64-byte clone frame at `0xEFC0` in which an MM9PDY build of the UV-5R Mini answers with its
 * own facts: its `VM` entry, which names the flash layout; the three strings its stock firmware calls itself (the
 * start-up screen's suffix, Radio Info's Firmware and Hardware lines), which name its stock base; its build name; and
 * its RF chip's register 0. A stock radio answers with the bytes of its external flash there (erased, `FF`), so the
 * same read says it is stock. The frame format is the firmware project's interface; see
 * docs/reference/radios/baofeng/uv-5r-mini/firmware.md ("The radio report").
 *
 * Pure: the bytes come in decoded (the clone XOR already undone). Reading them is the integrations layer's job.
 */
import type { RadioLayoutAnswer } from '../../../firmware/types.ts';
import {
  isUv5rMiniHardwareProven,
  UV5RMINI_NO_BUILD_FOR_RADIO,
  UV5RMINI_RADIO_INFO_REFUSAL,
  uv5rMiniStockBase,
} from './stockBases.ts';

/** Where the frame is: the clone address of one 64-byte `R`. */
export const UV5RMINI_RADIO_REPORT_ADDRESS = 0xefc0;
export const UV5RMINI_RADIO_REPORT_LENGTH = 64;
/** The only format this version of Studio reads. */
export const UV5RMINI_RADIO_REPORT_FORMAT = 2;

const MAGIC = [0x4d, 0x4d, 0x39, 0x52]; // "MM9R"
const NAME_OFFSET = 0x18;
const NAME_LENGTH = 24;
const CRC_OFFSET = 0x3e;

/** The three strings the stock firmware calls itself: where each is, its width (NUL-padded) and its name for the user. */
const STRINGS = {
  suffix: { offset: 0x30, length: 4, label: 'suffix' },
  version: { offset: 0x34, length: 5, label: 'Firmware' },
  hardware: { offset: 0x39, length: 5, label: 'Hardware' },
} as const;
type StringKey = keyof typeof STRINGS;
const STRING_KEYS = Object.keys(STRINGS) as StringKey[];

/** The two `VM` entries in the field, by flash layout: (start, size). */
const LAYOUTS: readonly { layout: 'L1' | 'L2'; vmStart: number; vmSize: number }[] = [
  { layout: 'L1', vmStart: 0x95000, vmSize: 0x68000 },
  { layout: 'L2', vmStart: 0x94000, vmSize: 0x6a000 },
];

/** Flags bit 0: set exactly when the strings read `NRFB` / `V0.04` / `V1.7`. A cross-check, never the base itself. */
const FLAG_NRFB_V004 = 0x01;
const NRFB_V004: Readonly<Record<StringKey, string>> = {
  suffix: 'NRFB',
  version: 'V0.04',
  hardware: 'V1.7',
};

export type Uv5rMiniRadioReport =
  /** No report: no magic or a bad CRC. A stock radio, or an MM9PDY build from before the frame. */
  | { readonly kind: 'stock'; readonly reason: 'magic' | 'crc' }
  /** A report in a format this version of Studio doesn't know (format 1 included). */
  | { readonly kind: 'unknownFormat'; readonly format: number }
  /** A read or a report that breaks the format's rules; `reason` says which, in the user's words. */
  | { readonly kind: 'invalid'; readonly reason: string }
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
      /** The suffix the start-up screen shows after `5RMINI` (`NRF`, `NRFB`). */
      readonly suffix: string;
      /** Radio Info's Firmware line (`V0.27`, `V0.04`). */
      readonly version: string;
      /** Radio Info's Hardware line, its trailing space removed (`V1.7`). */
      readonly hardware: string;
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
 * One of the three strings: its bytes with trailing NULs and spaces removed. What is left must be at least one
 * character, all printable ASCII (`0x20–0x7E`); anything else is bad (null).
 */
function readString(b: Uint8Array, key: StringKey): string | null {
  const { offset, length } = STRINGS[key];
  let end = offset + length;
  while (end > offset && (b[end - 1] === 0x00 || b[end - 1] === 0x20)) end--;
  if (end === offset) return null;
  let s = '';
  for (const c of b.subarray(offset, end)) {
    if (c < 0x20 || c > 0x7e) return null;
    s += String.fromCharCode(c);
  }
  return s;
}

/**
 * Decode the 64 bytes read at `0xEFC0` by the format's rules, in order: a read that isn't 64 bytes is refused; no magic
 * or a bad CRC is stock; a format other than 2 is named; a reserved flags bit, a bad string, or a bit 0 that disagrees
 * with the strings is refused; and a `VM` pair that is neither layout's is an unknown layout. `vm_bank0` is returned as
 * read; the reserved bytes decide nothing.
 */
export function decodeUv5rMiniRadioReport(bytes: Uint8Array): Uv5rMiniRadioReport {
  if (bytes.length !== UV5RMINI_RADIO_REPORT_LENGTH) {
    return {
      kind: 'invalid',
      reason: `the read was ${bytes.length} bytes, not ${UV5RMINI_RADIO_REPORT_LENGTH}`,
    };
  }
  if (!MAGIC.every((m, i) => bytes[i] === m)) return { kind: 'stock', reason: 'magic' };
  if (crc16Xmodem(bytes.subarray(0, CRC_OFFSET)) !== u16(bytes, CRC_OFFSET)) {
    return { kind: 'stock', reason: 'crc' };
  }
  const format = bytes[4]!;
  if (format !== UV5RMINI_RADIO_REPORT_FORMAT) return { kind: 'unknownFormat', format };
  const flags = bytes[5]!;
  if (flags & ~FLAG_NRFB_V004) return { kind: 'invalid', reason: 'a reserved flags bit is set' };
  const strings: Record<StringKey, string> = { suffix: '', version: '', hardware: '' };
  for (const key of STRING_KEYS) {
    const s = readString(bytes, key);
    if (s === null) {
      return { kind: 'invalid', reason: `its ${STRINGS[key].label} string is unreadable` };
    }
    strings[key] = s;
  }
  const isNrfbV004 = STRING_KEYS.every((k) => strings[k] === NRFB_V004[k]);
  if (Boolean(flags & FLAG_NRFB_V004) !== isNrfbV004) {
    return {
      kind: 'invalid',
      reason: 'its NRFB V0.04 flag disagrees with its suffix, Firmware and Hardware strings',
    };
  }
  const vmStart = u32(bytes, 0x08);
  const vmSize = u32(bytes, 0x0c);
  const name = readName(bytes);
  const known = LAYOUTS.find((l) => l.vmStart === vmStart && l.vmSize === vmSize);
  if (!known) return { kind: 'unknownLayout', vmStart, vmSize, name };
  return {
    kind: 'report',
    layout: known.layout,
    suffix: strings.suffix,
    version: strings.version,
    hardware: strings.hardware,
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

export const UV5RMINI_UNKNOWN_LAYOUT_REFUSAL = (vmStart: number, vmSize: number): string =>
  `This radio reports a flash layout Studio doesn't support (VM entry at ${hex(vmStart, 5)}, ${hex(vmSize, 5)} bytes). Nothing was sent.`;

export const UV5RMINI_UNKNOWN_FORMAT_REFUSAL = (format: number): string =>
  `This radio's MM9PDY build answers in report format ${format}, which this version of Studio doesn't know. Nothing was sent; update Studio and try again.`;

export const UV5RMINI_BAD_REPORT_REFUSAL = (reason: string): string =>
  `This radio's MM9PDY report doesn't read right: ${reason}. Nothing was sent.`;

/**
 * What the wizard concludes from a report. Null for a radio with no report (stock): the wizard asks its Radio Info
 * instead. A report asks no question: the layout is the report's, the stock base is the shared table's entry for its
 * suffix and Firmware strings (refused, like the Radio Info answers, when there is none or the Hardware string isn't
 * proven), its build name decides "already installed", and the strings, build name and RF chip are shown as
 * information.
 */
export function uv5rMiniLayoutFromReport(report: Uv5rMiniRadioReport): RadioLayoutAnswer | null {
  switch (report.kind) {
    case 'stock':
      return null;
    case 'unknownFormat':
      return { kind: 'refused', message: UV5RMINI_UNKNOWN_FORMAT_REFUSAL(report.format) };
    case 'invalid':
      return { kind: 'refused', message: UV5RMINI_BAD_REPORT_REFUSAL(report.reason) };
    case 'unknownLayout':
      return {
        kind: 'refused',
        message: UV5RMINI_UNKNOWN_LAYOUT_REFUSAL(report.vmStart, report.vmSize),
      };
    case 'report': {
      // The same table and the same refusals as the Radio Info answers: the strings name the base, and bit 0 was only
      // the decoder's cross-check.
      if (!isUv5rMiniHardwareProven(report.hardware)) {
        return { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };
      }
      const stock = uv5rMiniStockBase(report.suffix, report.version);
      if (!stock) {
        return {
          kind: 'refused',
          message: UV5RMINI_NO_BUILD_FOR_RADIO(report.suffix, report.version),
        };
      }
      const details = [
        `MM9PDY build: ${report.name || '(no name)'}`,
        `Suffix: ${report.suffix}`,
        `Firmware: ${report.version}`,
        `Hardware: ${report.hardware}`,
        `Flash layout: ${report.layout}`,
        `Code base: ${stock.base}`,
        `RF chip register 0: ${hex(report.rf0, 4)}`,
      ];
      if (report.vmBank0 !== report.vmStart) {
        details.push(
          `The radio's settings store starts at ${hex(report.vmBank0, 5)}, not at its VM entry ${hex(report.vmStart, 5)}. Studio goes by the VM entry.`,
        );
      }
      return {
        kind: 'layout',
        layout: report.layout,
        reported: true,
        // A radio's code base never changes: the interlocks refuse a file on another base. The layout stays the
        // report's: Prepare matches a release file on both, and offers nothing when none has them.
        codeBase: stock.base,
        details,
        ...(report.name ? { build: report.name } : {}),
      };
    }
  }
}
