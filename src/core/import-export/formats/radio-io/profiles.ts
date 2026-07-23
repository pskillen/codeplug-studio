/**
 * Direct-radio (Web Serial) profiles — wire limits for UI hints only.
 * No CPS import/export adapter; binary I/O lives in integrations/radio-io.
 */

export interface RadioIoUv5rMiniProfile {
  id: 'radio-io-uv5r-mini';
  label: string;
  /** Binary memory slots (UV-5R Mini channel count). */
  maxMemorySlots: number;
  /** Name bytes in channel record (Mini codec truncates to 12). */
  nameLimit: number;
}

export type RadioIoRadioProfile = RadioIoUv5rMiniProfile;

export const RADIO_IO_UV5R_MINI_PROFILE: RadioIoUv5rMiniProfile = {
  id: 'radio-io-uv5r-mini',
  label: 'Baofeng UV-5R Mini',
  maxMemorySlots: 999,
  nameLimit: 12,
};

export const RADIO_IO_PROFILES: readonly RadioIoRadioProfile[] = [RADIO_IO_UV5R_MINI_PROFILE];

export function getRadioIoProfile(profileId: string): RadioIoRadioProfile {
  const found = RADIO_IO_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown Direct radio profile: ${profileId}`);
  return found;
}
