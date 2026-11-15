/**
 * The UV-5R Mini's stock bases: the one table both ways of knowing the radio use. A stock base is one exact stock
 * build, named by the three strings the stock firmware calls itself: the suffix after `5RMINI` on the hold-8 start-up
 * screen (`NRF`, `NRFB`), Radio Info's Firmware line and its Hardware line. The radio's Radio Info answers
 * (`radioInfo.ts`) and an MM9PDY build's radio report (`radioReport.ts`) both look the radio up here, so they can never
 * disagree. A radio only ever gets a file built on its own base; a combination not here has no build, and none is
 * offered instead.
 */

/** A base by suffix and Firmware line, with the flash layout the stock radios on it have. */
export interface Uv5rMiniStockBase {
  /** The stock descriptor's `baseName`: the code base every file for these radios is built on. */
  readonly base: string;
  readonly layout: 'L1' | 'L2';
  /**
   * The variant's prefix in a build name (D133): `<stock version>-<suffix>`, as in `v0.04-NRFB-1.0.0`. A release is
   * named `<prefix>-<semver>`; a PR or ad hoc build starts with the same prefix.
   */
  readonly prefix: string;
}

/** The stock bases, by `"<suffix> <Firmware line>"`. */
const BASES: Readonly<Record<string, Uv5rMiniStockBase>> = {
  'NRFB V0.04': { base: 'nrfb-v0.04', layout: 'L1', prefix: 'v0.04-NRFB' },
  'NRF V0.27': { base: 'nrf-v0.27', layout: 'L2', prefix: 'v0.27-NRF' },
};

/** The flash layout a release file on `base` is built for; undefined for a base not in the table. */
export function uv5rMiniLayoutOfBase(base: string): string | undefined {
  return Object.values(BASES).find((b) => b.base === base)?.layout;
}

/** A build name in the variant form (`v<digits>.<digits>-<LETTERS>-…`), registered prefix or not. */
const VARIANT_FORM = /^v\d+\.\d+-[A-Z]+-/;

/**
 * The stock base a build name names by its variant prefix (D133: `v0.27-NRF-1.0.1` → `nrf-v0.27`), with the rest of the
 * name after the prefix. Null for a name in that form whose prefix is no base in the table: refused, never guessed.
 * Undefined for a name in another form: a legacy `mm9pdy-L2-…` name, a to-stock patch (`nrf-v0.27`). The prefix is
 * matched exactly against the table, never split.
 */
export function uv5rMiniBaseFromBuildName(
  buildName: string,
): { readonly base: string; readonly rest: string } | null | undefined {
  if (!VARIANT_FORM.test(buildName)) return undefined;
  const hit = Object.values(BASES).find((b) => buildName.startsWith(`${b.prefix}-`));
  return hit ? { base: hit.base, rest: buildName.slice(hit.prefix.length + 1) } : null;
}

/** Every suffix and Firmware line in the table, as `[suffix, firmware]`. */
export const UV5RMINI_STOCK_BASE_KEYS: readonly (readonly [string, string])[] = Object.keys(
  BASES,
).map((k) => k.split(' ') as [string, string]);

/** The Hardware lines an update has been proven on. */
export const UV5RMINI_PROVEN_HARDWARE: readonly string[] = ['V1.7'];

/** The stock base for a suffix and Firmware line, exactly as the radio shows them; undefined when there is none. */
export function uv5rMiniStockBase(suffix: string, firmware: string): Uv5rMiniStockBase | undefined {
  return Object.hasOwn(BASES, `${suffix} ${firmware}`) ? BASES[`${suffix} ${firmware}`] : undefined;
}

/** Whether an update has been proven on a Hardware line, exactly as the radio shows it. */
export function isUv5rMiniHardwareProven(hardware: string): boolean {
  return UV5RMINI_PROVEN_HARDWARE.includes(hardware);
}

/** A Hardware line Studio hasn't seen proven: refused, whichever way the radio was read. */
export const UV5RMINI_RADIO_INFO_REFUSAL =
  "Studio hasn't been proven on this radio's Hardware version; nothing was sent.";

/** A combination of suffix and Firmware line with no stock base: no build exists for it, and none is offered instead. */
export const UV5RMINI_NO_BUILD_FOR_RADIO = (suffix: string, firmware: string): string =>
  `There is no MM9PDY build for this radio (${suffix} ${firmware}) yet; nothing was sent.`;
