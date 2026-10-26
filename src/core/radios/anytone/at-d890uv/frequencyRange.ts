/**
 * Anytone AT-D890UV frequency range ("band code") table.
 *
 * The range is one byte, LocalInfo `+0x03`, code 0-18. The radio enforces **transmit** limits at PTT from
 * per-code firmware tables; it receives across the hardware bands regardless. Values here are the firmware
 * tables (stock V1.05), not the CPS display table: they differ for codes 15, 16 and 18.
 * Mirror of [band-code.md](../../../../../docs/reference/radios/anytone/at-d890uv/band-code.md). Studio writes
 * LocalInfo only through the Danger zone's range change
 * (`integrations/radio-io/radios/at-d890uv/rangeChange/`); this module only describes and checks, and lists the
 * codes a range change may target.
 */

/** Inclusive MHz bounds `[low, high]`. */
export type AtD890MhzRange = readonly [number, number];

export interface AtD890FrequencyRangeRow {
  code: number;
  /** CPS caption, or a plain label for codes the CPS does not list. */
  caption: string;
  /** True when the CPS offers this code in its picker. */
  cpsListed: boolean;
  /**
   * Receive bands. No `b220` for code 18: the RX clamp and out-of-band check only open 200-300 MHz for code 14, so
   * RX at 220 MHz on 18 is unconfirmed (needs a radio check) and not claimed.
   */
  rx: { uhf: AtD890MhzRange; vhf: AtD890MhzRange; b220?: AtD890MhzRange };
  /** `uhf` undefined = UHF transmit inhibited. */
  tx: { uhf?: AtD890MhzRange; vhf: AtD890MhzRange; b220?: AtD890MhzRange };
}

const NOT_LISTED = 'Unlisted range';

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
    rx: { uhf: FULL_UHF, vhf: FULL_VHF },
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

export interface AtD890DescribeOptions {
  /**
   * Whether LocalInfo `+0x0B..+0x0E` reads `890#`. The loader maps code 14 to 0 without it. `undefined` = not
   * known, so code 14 is described as listed. Pass the state when the whole LocalInfo is at hand.
   */
  maintenanceUnlocked?: boolean;
}

/** True when LocalInfo `+0x0B..+0x0E` is the ASCII unlock `890#`. */
export function atD890MaintenanceUnlocked(localInfo: Uint8Array): boolean {
  return [0x38, 0x39, 0x30, 0x23].every((b, i) => localInfo[0x0b + i] === b);
}

/**
 * Describe a LocalInfo `+0x03` range code. Codes > 18 are shown as unknown, and code 14 without the `890#`
 * unlock as locked; the radio uses code 0 for both. PR 4c must pass the SANITISED code (RAM `0x20015277`, ident
 * byte 8), never the raw LocalInfo byte.
 */
export function describeAtD890FrequencyRange(
  code: number,
  opts: AtD890DescribeOptions = {},
): AtD890FrequencyRangeDescription {
  const exact = AT_D890_FREQUENCY_RANGES.find((r) => r.code === code);
  const locked = code === 14 && opts.maintenanceUnlocked === false;
  const known = exact !== undefined && !locked;
  const row = known ? exact : AT_D890_FREQUENCY_RANGES[0]!;
  const caption = locked
    ? `${exact!.caption} not unlocked, treated as 0`
    : known
      ? row.caption
      : 'Unknown (treated as 0 by the radio)';
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

/**
 * Range codes a range change may target: every firmware code, 0 to 18. Code 14 only when LocalInfo holds `890#`
 * (the frame builder refuses it otherwise). Codes 6, 9, 12 and 15 are valid to the firmware but offered by neither
 * the CPS nor the radio's factory menu: they are targets, flagged `unlisted` so a screen can warn.
 */
export const AT_D890_RANGE_CHANGE_TARGET_CODES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
] as const;

export type AtD890RangeChangeTargetCode = (typeof AT_D890_RANGE_CHANGE_TARGET_CODES)[number];

export function isAtD890RangeChangeTarget(code: number): code is AtD890RangeChangeTargetCode {
  return (AT_D890_RANGE_CHANGE_TARGET_CODES as readonly number[]).includes(code);
}

type BandName = 'uhf' | 'vhf' | 'b220';
type Bands = Partial<Record<BandName, AtD890MhzRange>>;
const BANDS: readonly BandName[] = ['uhf', 'vhf', 'b220'];

function rowFor(code: number): AtD890FrequencyRangeRow {
  return AT_D890_FREQUENCY_RANGES.find((r) => r.code === code) ?? AT_D890_FREQUENCY_RANGES[0]!;
}

function covers(outer: AtD890MhzRange | undefined, inner: AtD890MhzRange | undefined): boolean {
  if (inner === undefined) return true;
  return outer !== undefined && outer[0] <= inner[0] && outer[1] >= inner[1];
}

function coversAll(outer: Bands, inner: Bands): boolean {
  return BANDS.every((b) => covers(outer[b], inner[b]));
}

/** `a` minus `b` as spans (zero-width remainders are dropped). */
function subtractSpan(
  a: AtD890MhzRange | undefined,
  b: AtD890MhzRange | undefined,
): AtD890MhzRange[] {
  if (a === undefined) return [];
  if (b === undefined || b[1] <= a[0] || b[0] >= a[1]) return [a];
  const out: AtD890MhzRange[] = [];
  if (a[0] < b[0]) out.push([a[0], b[0]]);
  if (b[1] < a[1]) out.push([b[1], a[1]]);
  return out;
}

function spansOnlyIn(a: Bands, b: Bands): string[] {
  return BANDS.flatMap((band) => subtractSpan(a[band], b[band]))
    .sort((x, y) => x[0] - y[0])
    .map(span);
}

/**
 * True when `toCode`'s receive coverage is not a superset of `fromCode`'s: the radio would hear less somewhere
 * it hears today.
 */
export function atD890ReceiveNarrower(fromCode: number, toCode: number): boolean {
  return !coversAll(rowFor(toCode).rx, rowFor(fromCode).rx);
}

export interface AtD890RangeChangeTarget {
  code: number;
  caption: string;
  isCurrent: boolean;
  /** True for 6, 9, 12 and 15: firmware-valid, but not offered by the CPS or the factory menu. */
  unlisted: boolean;
  /** Code 14 only. */
  requiresMaintenanceUnlock: boolean;
  /** False for code 14 while the radio is not `890#`-unlocked. */
  available: boolean;
  /** RX narrower than the full 136-174 / 400-480 MHz hardware bands. */
  receiveNarrowerThanFull: boolean;
  /** Codes 16 and 17 inhibit UHF transmit. */
  uhfTxInhibited: boolean;
  /** How the transmit coverage compares with the current code's. */
  txChange: 'wider' | 'narrower' | 'different';
}

/**
 * One entry per target code (0 to 18), in code order. `currentCode` may itself be an unlisted code. Pure facts only: which entries a screen shows, and in what
 * words, is the caller's policy.
 */
export function atD890RangeChangeTargets(
  currentCode: number,
  opts: { maintenanceUnlocked: boolean },
): AtD890RangeChangeTarget[] {
  const cur = rowFor(currentCode);
  return AT_D890_RANGE_CHANGE_TARGET_CODES.map((code) => {
    const row = rowFor(code);
    const wider = coversAll(row.tx, cur.tx) && !coversAll(cur.tx, row.tx);
    const narrower = coversAll(cur.tx, row.tx) && !coversAll(row.tx, cur.tx);
    return {
      code,
      caption: row.caption,
      isCurrent: code === currentCode,
      unlisted: !row.cpsListed,
      requiresMaintenanceUnlock: code === 14,
      available: code !== 14 || opts.maintenanceUnlocked,
      receiveNarrowerThanFull: !(covers(row.rx.uhf, FULL_UHF) && covers(row.rx.vhf, FULL_VHF)),
      uhfTxInhibited: row.tx.uhf === undefined,
      txChange: wider ? 'wider' : narrower ? 'narrower' : 'different',
    };
  });
}

export interface AtD890TxChangeSummary {
  /** Transmit summary of the current code, as `describeAtD890FrequencyRange` prints it. */
  from: string;
  to: string;
  /** Spans (MHz, e.g. `146–148`) the radio can transmit on after the change and cannot now. */
  opens: string[];
  /** Spans it can transmit on now and cannot after the change. */
  closes: string[];
}

export function atD890TxChangeSummary(fromCode: number, toCode: number): AtD890TxChangeSummary {
  const from = rowFor(fromCode);
  const to = rowFor(toCode);
  return {
    from: summarise(from.tx),
    to: summarise(to.tx),
    opens: spansOnlyIn(to.tx, from.tx),
    closes: spansOnlyIn(from.tx, to.tx),
  };
}
