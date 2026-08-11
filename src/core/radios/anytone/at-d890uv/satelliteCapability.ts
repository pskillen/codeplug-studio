/**
 * Anytone AT-D890UV satellite transmitter **mode** capability (#1068, revised #1086) — distinct
 * question from the "Frequency ranges (Studio eligibility)" table in
 * docs/reference/radios/anytone/at-d890uv/capabilities.md (#612). That table filters standard
 * DMR/FM/AM **channel** RF band + TX eligibility for library/build lists; it says nothing about
 * which *demodulation modes* the D890 can use to track a satellite transmitter/transponder, and
 * neither anytone-cps nor qdmr GPL source declares a satellite-mode capability list at all — there
 * is no existing table to reuse here.
 *
 * **#1086 — reversal from denylist to allowlist, and from "default supported" to "default
 * unsupported":** the original (#1068) implementation shipped a denylist (`SSTV`/`SSB`/`CW`) with
 * unrecognised modes defaulting to *supported*, on the reasoning that Studio had no hardware
 * access and no positive evidence either way, so it defaulted permissively out of caution. An
 * operator has since **directly confirmed on real D890 hardware** that satellite tracking on this
 * radio only works with **FM** (and its narrowband spelling variants) — every other mode,
 * including ones the old denylist did not cover (e.g. GMSK, AFSK, DUV), silently failed. That is
 * materially stronger evidence than the prior placeholder had, so this module now ships an
 * **allowlist** of FM-family mode strings, and unrecognised/unknown modes default to **NOT
 * supported**. This is an intentional reversal of the previous default: the old default favoured
 * "assume supported" only because there was no positive evidence either way; now that real
 * hardware evidence exists and points at a narrow FM-only capability, defaulting unknown modes to
 * unsupported is the safer and more accurate choice.
 */

/**
 * FM-family mode spellings confirmed (by direct operator hardware testing, #1086) to work for
 * D890 satellite tracking. `SatelliteTransmitter.mode` is free text sourced from SatNOGS or
 * manual entry (no closed taxonomy — see `src/core/models/satelliteTransmitter.ts`); SatNOGS and
 * Studio's own docs/fixtures use bare `FM` almost exclusively (see
 * `docs/features/satellite-keps/feature-design.md`, `functions/api/satnogs/transmitters.test.ts`),
 * so `FM` is the only spelling with direct evidence. `FMN`/`NFM`/`FM NARROW`/`NARROW FM` are
 * included as reasonable narrowband-FM spelling variants (Studio's own CHIRP/DM32/OpenGD77
 * adapters use `NFM`/`FM` for narrowband/wideband FM channels elsewhere in this codebase) — these
 * variants are **not independently hardware-confirmed**, only the FM family as a whole is.
 * Case-insensitive, whitespace/hyphen/underscore-insensitive match (normalised before compare).
 */
const AT_D890_SUPPORTED_SATELLITE_MODES: readonly string[] = [
  'FM',
  'FMN',
  'NFM',
  'FM NARROW',
  'NARROW FM',
];

function normalizeMode(mode: string): string {
  return mode
    .trim()
    .toUpperCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Whether the D890 can plausibly track a satellite transmitter using `mode`. `null`/empty mode
 * strings default to `true` (supported) — Studio has no mode information to reject on. Any
 * non-empty mode string not on the FM-family allowlist defaults to `false` (**not** supported) —
 * see module doc comment for why this default reversed from the pre-#1086 denylist behaviour.
 */
export function isModeSupportedByAtD890(mode: string | null | undefined): boolean {
  if (!mode) return true;
  const normalized = normalizeMode(mode);
  return AT_D890_SUPPORTED_SATELLITE_MODES.includes(normalized);
}
