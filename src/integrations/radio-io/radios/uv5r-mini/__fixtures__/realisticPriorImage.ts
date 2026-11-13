/**
 * A realistic prior Read of a UV-5R Mini, built by hand. Synthetic: no bytes from any real radio.
 *
 * "Realistic" means every record carries the bytes Studio does not model, the way a radio or another CPS leaves
 * them: signal code, PTT ID, spare power and flag bits, `+0x10..+0x13`, tone `0xFFFF` as well as `0x0000` for
 * none, names padded with `0x00`, `0xFF` or spaces, TX `00×4` and `FF×4`, live slots 248 and 249 across
 * `0x1EF0`, an empty slot with leftovers after its `0xFF` first byte, and non-`0xFF` bytes in every kept region.
 */

import { encodeBcdFreq } from '../../uv17pro-family/channelCodec.ts';
import { UV5R_MINI_LAYOUT as layout } from '../../uv17pro-family/layout.ts';

export interface SyntheticRecord {
  slot: number;
  rxHz: number;
  /** TX bytes: a frequency, `'ff'` (TX off) or `'zero'` (`00×4`, read as simplex). */
  tx: number | 'ff' | 'zero';
  rxTone: number;
  txTone: number;
  signalCode: number;
  pttId: number;
  power: number;
  flags: number;
  reserved: readonly [number, number, number, number];
  name: string;
  /** Byte that fills the name after its text. */
  pad: number;
}

/** Records chosen to cover each unmodelled byte and bit at least once, with more than one value. */
// prettier-ignore
export const SYNTHETIC_RECORDS: readonly SyntheticRecord[] = [
  { slot: 1, rxHz: 145_500_000, tx: 145_500_000, rxTone: 0x0000, txTone: 0x0000, signalCode: 0x01, pttId: 0x00, power: 0x00, flags: 0x04, reserved: [0x00, 0x00, 0x00, 0x00], name: 'CALLING', pad: 0x00 },
  { slot: 2, rxHz: 145_600_000, tx: 145_000_000, rxTone: 0x0375, txTone: 0x0375, signalCode: 0x03, pttId: 0x02, power: 0x01, flags: 0x4c, reserved: [0x11, 0x22, 0x33, 0x44], name: 'RPT ALPHA', pad: 0xff },
  { slot: 3, rxHz: 433_500_000, tx: 'zero', rxTone: 0xffff, txTone: 0xffff, signalCode: 0x0f, pttId: 0x01, power: 0x02, flags: 0x10, reserved: [0xff, 0xff, 0xff, 0xff], name: 'SIMPLEX U', pad: 0x20 },
  { slot: 4, rxHz: 446_006_250, tx: 446_006_250, rxTone: 0x0001, txTone: 0x006a, signalCode: 0x00, pttId: 0x03, power: 0x11, flags: 0x25, reserved: [0x00, 0x01, 0x02, 0x03], name: 'PMR CH1', pad: 0x00 },
  { slot: 5, rxHz: 162_550_000, tx: 'ff', rxTone: 0x0000, txTone: 0x0000, signalCode: 0x05, pttId: 0x00, power: 0x00, flags: 0x82, reserved: [0xa5, 0x5a, 0xa5, 0x5a], name: 'WX RX ONLY', pad: 0xff },
  { slot: 6, rxHz: 438_800_000, tx: 431_200_000, rxTone: 0x0000, txTone: 0x0302, signalCode: 0x02, pttId: 0x00, power: 0x00, flags: 0x48, reserved: [0x00, 0x00, 0x00, 0x00], name: 'TWELVECHARSX', pad: 0x00 },
  // A DCS index past the end of the table: Studio reads "none" and must keep the raw bytes.
  { slot: 7, rxHz: 145_450_000, tx: 145_450_000, rxTone: 0x0069, txTone: 0x00d2, signalCode: 0x01, pttId: 0x00, power: 0x00, flags: 0x00, reserved: [0x00, 0x00, 0x00, 0x00], name: 'ODD DCS', pad: 0x20 },
  { slot: 100, rxHz: 145_237_500, tx: 145_237_500, rxTone: 0x0000, txTone: 0x0000, signalCode: 0x01, pttId: 0x00, power: 0x00, flags: 0x40, reserved: [0x00, 0x00, 0x00, 0x00], name: '', pad: 0x00 },
  { slot: 248, rxHz: 145_550_000, tx: 145_550_000, rxTone: 0x0000, txTone: 0x0000, signalCode: 0x01, pttId: 0x00, power: 0x01, flags: 0x04, reserved: [0x00, 0x00, 0x00, 0x00], name: 'SLOT 248', pad: 0x00 },
  { slot: 249, rxHz: 433_450_000, tx: 433_450_000, rxTone: 0x0000, txTone: 0x0000, signalCode: 0x01, pttId: 0x00, power: 0x00, flags: 0x04, reserved: [0x00, 0x00, 0x00, 0x00], name: 'SLOT 249', pad: 0xff },
  { slot: 999, rxHz: 439_975_000, tx: 430_575_000, rxTone: 0x040b, txTone: 0x040b, signalCode: 0x09, pttId: 0x01, power: 0x00, flags: 0x04, reserved: [0x10, 0x20, 0x30, 0x40], name: 'LAST SLOT', pad: 0x00 },
];

/** An empty slot (`0xFF` first byte) with leftovers after it. */
export const SYNTHETIC_EMPTY_WITH_LEFTOVERS_SLOT = 50;

export function encodeSyntheticRecord(r: SyntheticRecord): Uint8Array {
  const out = new Uint8Array(layout.channelSize);
  out.set(encodeBcdFreq(r.rxHz), 0);
  if (r.tx === 'ff') out.fill(0xff, 4, 8);
  else if (r.tx === 'zero') out.fill(0x00, 4, 8);
  else out.set(encodeBcdFreq(r.tx), 4);
  out.set([r.rxTone & 0xff, r.rxTone >> 8, r.txTone & 0xff, r.txTone >> 8], 8);
  out.set([r.signalCode, r.pttId, r.power, r.flags, ...r.reserved], 12);
  out.fill(r.pad, 20, 32);
  out.set(new TextEncoder().encode(r.name.slice(0, 12)), 20);
  return out;
}

/** Deterministic filler for the kept regions, so a lost or shifted byte shows. */
function filler(seed: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = (x >>> 16) & 0xff;
  }
  return out;
}

/** The packed prior image (`MEM_TOTAL` bytes). */
export function createRealisticPriorImage(): Uint8Array {
  const image = new Uint8Array(layout.memTotal).fill(0xff);
  for (const r of SYNTHETIC_RECORDS) {
    image.set(encodeSyntheticRecord(r), (r.slot - 1) * layout.channelSize);
  }
  const leftovers = (SYNTHETIC_EMPTY_WITH_LEFTOVERS_SLOT - 1) * layout.channelSize;
  image.set(filler(7, layout.channelSize - 1), leftovers + 1);
  // Past the channel span to the end of the first region (0x7CE0-0x803F): VFOs and whatever else is there.
  image.set(filler(11, 0x8040 - layout.channelSpan), layout.channelSpan);
  // Second and third regions: settings, ANI, PTT ID, codes.
  image.set(filler(13, layout.memTotal - 0x8040), 0x8040);
  return image;
}
