/**
 * Anytone AT-D890UV frequency range ("band code") table.
 *
 * The range is one byte, LocalInfo `+0x03`, code 0-18. The radio enforces **transmit** limits at PTT from
 * per-code firmware tables; it receives across the hardware bands regardless. Values here are the firmware
 * tables (stock V1.05), not the CPS display table: they differ for codes 15, 16 and 18.
 * Mirror of [band-code.md](../../../../../docs/reference/radios/anytone/at-d890uv/band-code.md). Studio never
 * writes LocalInfo; this module only describes and checks.
 */

/** Inclusive MHz bounds `[low, high]`. */
export type AtD890MhzRange = readonly [number, number];

export interface AtD890FrequencyRangeRow {
  code: number;
  /** CPS caption, or a plain label for codes the CPS does not list. */
  caption: string;
  /** True when the CPS offers this code in its picker. */
  cpsListed: boolean;
  rx: { uhf: AtD890MhzRange; vhf: AtD890MhzRange; b220?: AtD890MhzRange };
  /** `uhf` undefined = UHF transmit inhibited. */
  tx: { uhf?: AtD890MhzRange; vhf: AtD890MhzRange; b220?: AtD890MhzRange };
}

const NOT_LISTED = 'Not listed in the CPS';

/** Same range for RX and TX. */
function sym(
  code: number,
  caption: string,
  cpsListed: boolean,
  uhf: AtD890MhzRange,
  vhf: AtD890MhzRange,
): AtD890FrequencyRangeRow {
  return { code, caption, cpsListed, rx: { uhf, vhf }, tx: { uhf, vhf } };
}

const FULL_UHF: AtD890MhzRange = [400, 480];
const FULL_VHF: AtD890MhzRange = [136, 174];

/** The 19 firmware range codes (MHz, inclusive). */
export const AT_D890_FREQUENCY_RANGES: readonly AtD890FrequencyRangeRow[] = [
  sym(0, 'Commercial Europe', true, FULL_UHF, FULL_VHF),
  sym(1, 'Commercial US', true, FULL_UHF, FULL_VHF),
  sym(2, 'Mode 000002', true, [430, 440], [144, 146]),
  {
    code: 3,
    caption: 'Amateur Europe',
    cpsListed: true,
    rx: { uhf: FULL_UHF, vhf: FULL_VHF },
    tx: { uhf: [430, 440], vhf: [144, 146] },
  },
  sym(4, 'Band 4', true, [434, 438], [144, 146]),
  sym(5, 'Band 5', true, [434, 447], [144, 146]),
  sym(6, NOT_LISTED, false, [446, 447], FULL_VHF),
  {
    code: 7,
    caption: 'Amateur US',
    cpsListed: true,
    rx: { uhf: FULL_UHF, vhf: FULL_VHF },
    tx: { uhf: [420, 450], vhf: [144, 148] },
  },
  sym(8, 'Commercial', true, [400, 470], FULL_VHF),
  sym(9, NOT_LISTED, false, [430, 432], [144, 146]),
  {
    code: 10,
    caption: 'Amateur Australia / Canada',
    cpsListed: true,
    rx: { uhf: FULL_UHF, vhf: FULL_VHF },
    tx: { uhf: [430, 450], vhf: [144, 148] },
  },
  sym(11, 'Mode 0011', true, [400, 520], FULL_VHF),
  sym(12, NOT_LISTED, false, [400, 490], FULL_VHF),
  {
    code: 13,
    caption: 'Commercial',
    cpsListed: true,
    rx: { uhf: FULL_UHF, vhf: FULL_VHF },
    tx: { uhf: [403, 470], vhf: FULL_VHF },
  },
  {
    code: 14,
    caption: 'Maintenance (needs 890#)',
    cpsListed: true,
    rx: { uhf: [400, 520], vhf: FULL_VHF, b220: [220, 225] },
    tx: { uhf: [400, 520], vhf: FULL_VHF, b220: [220, 225] },
  },
  sym(15, NOT_LISTED, false, [420, 520], [144, 148]),
  {
    code: 16,
    caption: 'Amateur Thailand',
    cpsListed: true,
    rx: { uhf: [430, 440], vhf: [144, 147] },
    tx: { vhf: [144, 147] },
  },
  {
    code: 17,
    caption: 'Commercial Thailand',
    cpsListed: true,
    rx: { uhf: [430, 440], vhf: FULL_VHF },
    tx: { vhf: FULL_VHF },
  },
  {
    code: 18,
    caption: 'Mode 000018',
    cpsListed: true,
    rx: { uhf: FULL_UHF, vhf: FULL_VHF, b220: [220, 225] },
    tx: { uhf: [420, 450], vhf: [144, 148], b220: [222, 225] },
  },
];

export interface AtD890FrequencyRangeDescription {
  code: number;
  /** False for codes > 18, which the radio treats as code 0. */
  known: boolean;
  caption: string;
  cpsListed: boolean;
  /** Row the radio actually enforces (code 0 for unknown codes). */
  row: AtD890FrequencyRangeRow;
  /** e.g. `430–440, 144–146 MHz`; UHF inhibited reads `UHF off, 144–147 MHz`. */
  txSummary: string;
  rxSummary: string;
  /** e.g. `Amateur Europe (code 3) · TX 430–440, 144–146 MHz`. */
  summary: string;
}

function span([lo, hi]: AtD890MhzRange): string {
  return `${lo}–${hi}`;
}

function summarise(r: {
  uhf?: AtD890MhzRange;
  vhf: AtD890MhzRange;
  b220?: AtD890MhzRange;
}): string {
  const parts = [r.uhf ? span(r.uhf) : 'UHF off', span(r.vhf)];
  if (r.b220) parts.push(span(r.b220));
  return `${parts.join(', ')} MHz`;
}

/** Describe a LocalInfo `+0x03` range code. Codes > 18 are shown as unknown (the radio uses code 0). */
export function describeAtD890FrequencyRange(code: number): AtD890FrequencyRangeDescription {
  const exact = AT_D890_FREQUENCY_RANGES.find((r) => r.code === code);
  const known = exact !== undefined;
  const row = exact ?? AT_D890_FREQUENCY_RANGES[0]!;
  const caption = known ? row.caption : 'Unknown (treated as 0 by the radio)';
  const txSummary = summarise(row.tx);
  const rxSummary = summarise(row.rx);
  return {
    code,
    known,
    caption,
    cpsListed: known ? row.cpsListed : false,
    row,
    txSummary,
    rxSummary,
    summary: `${caption} (code ${code}) · TX ${txSummary}`,
  };
}

function inRange(mhz: number, r: AtD890MhzRange | undefined): boolean {
  // Tolerate float noise at the inclusive edges (Hz / 1e6).
  return r !== undefined && mhz >= r[0] - 1e-9 && mhz <= r[1] + 1e-9;
}

/** True when a radio with this range code will transmit on `mhz` (inclusive bounds). */
export function atD890TxAllowed(code: number, mhz: number): boolean {
  const row = AT_D890_FREQUENCY_RANGES.find((r) => r.code === code) ?? AT_D890_FREQUENCY_RANGES[0]!;
  return inRange(mhz, row.tx.uhf) || inRange(mhz, row.tx.vhf) || inRange(mhz, row.tx.b220);
}

/** Minimal channel shape (satisfied by `RadioChannelDto`). */
export interface AtD890RangeCheckChannel {
  txHz: number;
  empty?: boolean;
  rxOnly?: boolean;
}

/**
 * Channels that would be written but whose transmit frequency is outside the range code's TX table, so the
 * radio listens on them and refuses PTT. Empty slots and channels already receive-only are skipped.
 * The Write's Review warns about these; they are still written.
 */
export function listAtD890ReceiveOnlyChannels<T extends AtD890RangeCheckChannel>(
  channels: readonly T[],
  code: number,
): T[] {
  return channels.filter(
    (c) => !c.empty && !c.rxOnly && c.txHz > 0 && !atD890TxAllowed(code, c.txHz / 1e6),
  );
}
