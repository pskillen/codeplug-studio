/**
 * Anytone AT-D890UV satellite transmitter **mode** capability (#1068) — distinct question from
 * the "Frequency ranges (Studio eligibility)" table in
 * docs/reference/radios/anytone/at-d890uv/capabilities.md (#612). That table filters standard
 * DMR/FM/AM **channel** RF band + TX eligibility for library/build lists; it says nothing about
 * which *demodulation modes* the D890 can use to track a satellite transmitter/transponder, and
 * neither anytone-cps nor qdmr GPL source (searched for this ticket) declares a satellite-mode
 * capability list at all — there is no existing table to reuse here, placeholder or otherwise.
 *
 * Placeholder reasoning (not hardware-verified): the D890 is a DMR/analog-FM handheld with no
 * documented SSB/CW/digital-voice-transponder demodulation hardware. `SatelliteTransmitter.mode`
 * is free text sourced from SatNOGS or manual entry (no closed taxonomy — see
 * `src/core/models/satelliteTransmitter.ts`), so an **allowlist** would silently reject any mode
 * string it doesn't recognise (typos, SatNOGS mode spellings Studio hasn't seen yet, …). A
 * **denylist** of modes we have reasonable confidence the D890 cannot demodulate is safer to
 * ship: unknown/unrecognised mode strings default to *supported* rather than being silently
 * dropped, matching this ticket's "skip with a visible reason, not a silent drop" principle
 * applied to the filter's own uncertainty, not just its UI.
 */

/**
 * Modes reasonably believed unsupported for D890 satellite tracking — not hardware-verified.
 * Case-insensitive match. `SSTV` is the issue's own example (slow-scan TV image mode, no
 * demodulation path on a DMR/FM handheld). `SSB`/`CW` added on the same "no demod hardware"
 * reasoning; genuinely uncertain modes (digital voice variants, unfamiliar SatNOGS strings) are
 * intentionally left off this list rather than guessed onto it.
 */
const AT_D890_UNSUPPORTED_SATELLITE_MODES: readonly string[] = ['SSTV', 'SSB', 'CW'];

/**
 * Whether the D890 can plausibly track a satellite transmitter using `mode`. `null`/empty/
 * unrecognised mode strings default to `true` (supported) — Studio has no positive evidence
 * against them, and this filter should never silently drop a transmitter it cannot confidently
 * rule out. See module doc comment for the denylist-vs-allowlist reasoning.
 */
export function isModeSupportedByAtD890(mode: string | null | undefined): boolean {
  if (!mode) return true;
  const normalized = mode.trim().toUpperCase();
  return !AT_D890_UNSUPPORTED_SATELLITE_MODES.includes(normalized);
}
