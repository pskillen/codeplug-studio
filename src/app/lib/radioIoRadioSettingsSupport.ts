/** Which Web Serial profiles offer the Radio settings page and session overrides (#1393, #1476). */

import {
  isAtD890RadioIoProfileId,
  isRt95RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';

export function radioIoProfileSupportsRadioSettings(profileId: string): boolean {
  return isAtD890RadioIoProfileId(profileId) || isRt95RadioIoProfileId(profileId);
}
