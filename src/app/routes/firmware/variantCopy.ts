/**
 * The Firmware step's words for a radio whose releases are keyed by stock base (UV-5R Mini, D133/D134): each base is a
 * variant with its own releases, and one version is the same behaviour on every variant.
 */

/** Shown when no release is built on the radio's firmware (its stock base) yet. */
export const NO_RELEASE_FOR_RADIO_FIRMWARE = (radioLabel: string, stockVersion: string): string =>
  `No firmware release is published for the ${radioLabel} on stock ${stockVersion} yet.`;

/**
 * Shown when another variant has a newer final release than the radio's (D134: one version behaves the same on every
 * variant, so this radio's is behind).
 */
export const VARIANT_BEHIND = (
  title: string,
  supports: readonly string[] | undefined,
  stockVersion: string,
): string =>
  `${title} is out${supports?.length ? ` for radios on stock ${supports.join(' or ')}` : ''}, but not yet for stock ${stockVersion}. Your radio gets it once its own release is published.`;
