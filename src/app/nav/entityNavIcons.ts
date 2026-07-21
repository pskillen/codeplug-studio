import type { TablerIcon } from '@tabler/icons-react';
import {
  IconAddressBook,
  IconAdjustments,
  IconBroadcast,
  IconListDetails,
  IconMap2,
  IconRadar,
  IconSatellite,
  IconUsersGroup,
} from '@tabler/icons-react';

/**
 * Shared secondary-nav icons for library entities.
 * Build format nav reuses these for overlapping entity pages.
 */
export const entityNavIcons = {
  channels: IconBroadcast,
  zones: IconMap2,
  talkGroups: IconUsersGroup,
  contacts: IconAddressBook,
  rxGroupLists: IconListDetails,
  scanLists: IconRadar,
  aprsConfiguration: IconSatellite,
  channelDefaults: IconAdjustments,
  zoneDefaults: IconAdjustments,
} as const satisfies Record<string, TablerIcon>;
