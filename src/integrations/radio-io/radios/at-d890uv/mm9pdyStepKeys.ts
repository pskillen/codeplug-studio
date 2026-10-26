/**
 * MM9PDY AT-D890UV talk-group step keys.
 *
 * The codeplug byte is the firmware function index. Official CPS lists the same
 * functions one higher: item 15 Record is TG next, item 14 Record Switch is
 * TG previous. Offsets are short-press P1 (`+0x13`) and P2 (`+0x14`) inside
 * optional settings. They are ordinary settings fields (`keyShortP1`, `keyShortP2`):
 * the nudge in Review turns into two overrides, and upload applies them as field
 * patches on the fresh read of the settings unit. See `settingsFields.ts`.
 */

import type { AtD890SettingsOverride } from './settingsFields.ts';

/** Firmware function index for TG next (CPS item 15 Record). */
export const MM9PDY_TG_NEXT_FUNCTION = 14;
/** Firmware function index for TG previous (CPS item 14 Record Switch). */
export const MM9PDY_TG_PREVIOUS_FUNCTION = 13;

/** Short-press P1, offset from {@link D890_MAP.OptionalSettingsMain}. */
export const AT_D890_P1_SHORT_OFFSET = 0x13;
/** Short-press P2, offset from {@link D890_MAP.OptionalSettingsMain}. */
export const AT_D890_P2_SHORT_OFFSET = 0x14;

/** The two settings overrides the build's MM9PDY step-key switch stands for. */
export function mm9pdyStepKeyOverrides(): AtD890SettingsOverride[] {
  return [
    { fieldId: 'keyShortP1', value: MM9PDY_TG_NEXT_FUNCTION },
    { fieldId: 'keyShortP2', value: MM9PDY_TG_PREVIOUS_FUNCTION },
  ];
}
