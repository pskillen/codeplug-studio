/**
 * Export panel extras keyed by radio-io profile (#1963 leftovers). The panel renders a list
 * from here; it does not branch on `is*RadioIoProfileId`.
 */

import {
  isAtD890RadioIoProfileId,
  isDm32RadioIoProfileId,
  isMm9pdyAtD890RadioIoProfileId,
  isMm9pdyDm32RadioIoProfileId,
  isRt95RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import { DM32_ANALOG_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';

export type RadioIoPanelExperimentalCopy = 'at-d890' | 'overlay';

export interface RadioIoPanelExtras {
  radioLabelSuffix: string;
  rangeChangeBanner: boolean;
  atD890RadioSettings: boolean;
  rt95RadioSettings: boolean;
  writeCoverageTable: boolean;
  writeCoverageMm9pdy: boolean;
  dangerZoneCard: boolean;
  summaryIncludesSettingChanges: boolean;
  beforeYouWriteTxRangeInfo: boolean;
  experimentalCopy: RadioIoPanelExperimentalCopy;
  dm32AnalogContactsNote?: string;
}

const OVERLAY_EXPERIMENTAL =
  'Write overlays modelled channels and organisation onto an in-session read of the connected radio. Unmodelled settings are preserved from that live FLASH image — not from a stored project clone. Identity is the radio on the cable this session, not a saved stash. Use Backup / Restore for a zip snapshot.';

const AT_D890_EXPERIMENTAL =
  'Write assembles modelled channels and organisation from the build, then reads co-resident bytes from the connected radio during upload. Unmodelled settings are preserved via erase-unit read-modify-write — not from a stored project image. Use Backup / Restore for a zip snapshot and ephemeral inspection.';

export function experimentalDetailsFor(copy: RadioIoPanelExperimentalCopy): string {
  return copy === 'at-d890' ? AT_D890_EXPERIMENTAL : OVERLAY_EXPERIMENTAL;
}

export function resolveRadioIoPanelExtras(
  profileId: string,
  offeredDangerZoneToolCount: number,
): RadioIoPanelExtras {
  const isAtD890 = isAtD890RadioIoProfileId(profileId);
  const isRt95 = isRt95RadioIoProfileId(profileId);
  const isMm9pdy =
    isMm9pdyAtD890RadioIoProfileId(profileId) || isMm9pdyDm32RadioIoProfileId(profileId);

  return {
    radioLabelSuffix: isMm9pdy ? ' (MM9PDY)' : '',
    rangeChangeBanner: isAtD890,
    atD890RadioSettings: isAtD890,
    rt95RadioSettings: isRt95,
    writeCoverageTable: isAtD890,
    writeCoverageMm9pdy: isMm9pdyAtD890RadioIoProfileId(profileId),
    dangerZoneCard: isAtD890 && offeredDangerZoneToolCount > 0,
    summaryIncludesSettingChanges: isAtD890,
    beforeYouWriteTxRangeInfo: isAtD890,
    experimentalCopy: isAtD890 ? 'at-d890' : 'overlay',
    dm32AnalogContactsNote: isDm32RadioIoProfileId(profileId)
      ? DM32_ANALOG_CONTACTS_WRITE_GAP
      : undefined,
  };
}
