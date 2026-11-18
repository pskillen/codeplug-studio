/**
 * Links from the flasher to the firmware project's public repository, where each radio's user guide lives. Links
 * only: nothing is fetched. URLs come from `firmwareUserGuideUrl` next to the release-index constants.
 */
import type { FirmwareRadioId } from '@core/firmware/types.ts';
import {
  FIRMWARE_PROJECT_URL,
  firmwareUserGuideUrl,
} from '@integrations/firmware-releases/publicReleaseIndex.ts';

import classes from './FirmwareFlasherPage.module.css';

/** Where the flasher introduces modded firmware: the project's front page. */
export function FirmwareProjectLink() {
  return (
    <p className={classes.description}>
      <a href={FIRMWARE_PROJECT_URL} target="_blank" rel="noopener noreferrer">
        MM9PDY firmware: user guides and releases
      </a>
    </p>
  );
}

/** One radio's user guide. */
export function FirmwareUserGuideLink({ radioId }: { radioId: FirmwareRadioId }) {
  return (
    <p className={classes.copy}>
      <a href={firmwareUserGuideUrl(radioId)} target="_blank" rel="noopener noreferrer">
        User guide
      </a>{' '}
      for this radio&apos;s modded firmware
    </p>
  );
}
